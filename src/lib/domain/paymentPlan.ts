/**
 * EventFlow — Dominio: Plan de Pagos y Hitos (WP-21)
 *
 * Gestiona la creación, consulta y actualización de planes de pago
 * con hitos configurables. Al aceptar un presupuesto se genera un
 * plan default (señal + resto). El job diario marca vencidos y
 * emite recordatorios.
 */

import type { PoolClient } from 'pg';
import { querySingle, queryMany, getPool } from '@/lib/db';
import { emitDomainEvent, emitDomainEventStandalone } from '@/domain/events';

// ── Types ───────────────────────────────────────────────────────

export interface MilestoneConfig {
  kind: 'senal' | 'intermedio' | 'resto' | 'extra';
  label: string;
  pct: number;
  daysOffset: number | null;  // días desde hoy (senal) o desde evento (resto: negativo)
}

export interface PaymentPlan {
  id: string;
  event_id: string;
  quote_id: string;
  total: number;
  status: string;
  created_at: string;
  milestones?: PaymentMilestone[];
}

export interface PaymentMilestone {
  id: string;
  plan_id: string;
  kind: string;
  label: string;
  pct: number;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  payment_id: string | null;
  last_reminder_at: string | null;
  created_at: string;
}

export interface PlanAlert {
  event_id: string;
  client_name: string;
  event_date: string;
  milestone_id: string;
  milestone_label: string;
  milestone_amount: number;
  milestone_due_date: string;
  milestone_status: string;
  days_until_due: number;
}

// ── Config ──────────────────────────────────────────────────────

/**
 * Lee la configuración de hitos desde business_settings.
 */
export async function getMilestoneConfig(): Promise<{
  deposit_pct: number;
  deposit_days: number;
  final_days_before_event: number;
  reminder_days: number;
}> {
  const row = await querySingle<{
    deposit_pct: number;
    deposit_days: number;
    final_days_before_event: number;
    milestone_reminder_days: number;
  }>(
    `SELECT deposit_pct, deposit_days, final_days_before_event, milestone_reminder_days
     FROM business_settings LIMIT 1`
  );
  return {
    deposit_pct: Number(row?.deposit_pct ?? 40),
    deposit_days: Number(row?.deposit_days ?? 7),
    final_days_before_event: Number(row?.final_days_before_event ?? 7),
    reminder_days: Number(row?.milestone_reminder_days ?? 7),
  };
}

/**
 * Construye la lista de hitos por defecto según la config del negocio.
 */
export function buildDefaultMilestones(
  total: number,
  eventDate: string | Date,
  config: { deposit_pct: number; deposit_days: number; final_days_before_event: number }
): MilestoneConfig[] {
  const restoPct = Math.round((100 - config.deposit_pct) * 100) / 100;
  const ed = new Date(eventDate);

  // Señal: importe calculado por porcentaje
  const senalAmount = Math.round(total * (config.deposit_pct / 100) * 100) / 100;
  const restoAmount = Math.round((total - senalAmount) * 100) / 100;

  return [
    {
      kind: 'senal',
      label: `Señal (${config.deposit_pct}% del total)`,
      pct: config.deposit_pct,
      daysOffset: config.deposit_days,  // días desde hoy
    },
    {
      kind: 'resto',
      label: `Resto (${restoPct}% del total)`,
      pct: restoPct,
      daysOffset: -(config.final_days_before_event),  // días antes del evento (negativo)
    },
  ];
}

// ── Generación de plan ──────────────────────────────────────────

/**
 * Genera el plan de pago default para un evento al aceptar el presupuesto.
 * Idempotente: si ya existe plan para el evento, retorna el existente.
 */
export async function generatePaymentPlan(
  client: PoolClient,
  eventId: string,
  quoteId: string,
  total: number,
  eventDate: string | Date
): Promise<PaymentPlan> {
  // Idempotente: si ya existe plan, retornar el existente con sus hitos
  const existing = await client.query(
    `SELECT * FROM payment_plans WHERE event_id = $1 LIMIT 1`,
    [eventId]
  );
  if (existing.rows.length > 0) {
    const plan = existing.rows[0];
    const milestones = (await client.query(
      `SELECT * FROM payment_milestones WHERE plan_id = $1 ORDER BY created_at`,
      [plan.id]
    )).rows;
    return { ...plan, milestones };
  }

  const config = await getMilestoneConfig();
  const milestoneConfigs = buildDefaultMilestones(total, eventDate, config);

  // Crear el plan
  const plan = (await client.query(
    `INSERT INTO payment_plans (event_id, quote_id, total, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [eventId, quoteId, total]
  )).rows[0];

  const ed = new Date(eventDate);
  const now = new Date();
  const milestones: PaymentMilestone[] = [];

  for (const mc of milestoneConfigs) {
    const amount = Math.round(total * (mc.pct / 100) * 100) / 100;
    let dueDate: Date;

    if (mc.kind === 'senal') {
      // Señal: X días desde hoy
      dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + mc.daysOffset!);
    } else {
      // Resto: X días antes del evento
      dueDate = new Date(ed);
      dueDate.setDate(dueDate.getDate() + mc.daysOffset!);
    }

    const milestone = (await client.query(
      `INSERT INTO payment_milestones (plan_id, kind, label, pct, amount, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6::date, 'pendiente')
       RETURNING *`,
      [plan.id, mc.kind, mc.label, mc.pct, amount, dueDate.toISOString().split('T')[0]]
    )).rows[0];

    milestones.push(milestone);
  }

  return { ...plan, milestones };
}

// ── Consulta ────────────────────────────────────────────────────

/**
 * Obtiene el plan de pago de un evento (con hitos).
 */
export async function getPaymentPlanByEvent(eventId: string): Promise<PaymentPlan | null> {
  const plan = await querySingle<PaymentPlan>(
    `SELECT * FROM payment_plans WHERE event_id = $1`,
    [eventId]
  );
  if (!plan) return null;

  const milestones = await queryMany<PaymentMilestone>(
    `SELECT * FROM payment_milestones WHERE plan_id = $1 ORDER BY due_date ASC NULLS LAST, created_at`,
    [plan.id]
  );

  return { ...plan, milestones };
}

// ── Alertas dashboard ───────────────────────────────────────────

/**
 * Obtiene hitos pendientes/vencidos para el dashboard.
 * Retorna los más urgentes primero (vencidos, luego por fecha de vencimiento).
 */
export async function getMilestoneAlerts(): Promise<PlanAlert[]> {
  return queryMany<PlanAlert>(
    `SELECT
      pp.event_id,
      e.client_name,
      TO_CHAR(e.event_date, 'YYYY-MM-DD') AS event_date,
      pm.id AS milestone_id,
      pm.label AS milestone_label,
      pm.amount AS milestone_amount,
      TO_CHAR(pm.due_date, 'YYYY-MM-DD') AS milestone_due_date,
      pm.status AS milestone_status,
      (pm.due_date - CURRENT_DATE)::int AS days_until_due
    FROM payment_milestones pm
    JOIN payment_plans pp ON pp.id = pm.plan_id
    JOIN events e ON e.id = pp.event_id
    WHERE pm.status IN ('pendiente', 'vencido')
      AND pp.status = 'active'
    ORDER BY
      CASE pm.status WHEN 'vencido' THEN 0 ELSE 1 END,
      pm.due_date ASC NULLS LAST
    LIMIT 50`
  );
}

/**
 * Marca como 'vencido' los hitos cuya due_date ya pasó y no están pagados.
 * Retorna los hitos recién marcados (para emitir eventos de dominio).
 */
export async function markOverdueMilestones(): Promise<PaymentMilestone[]> {
  return queryMany<PaymentMilestone>(
    `UPDATE payment_milestones
     SET status = 'vencido', updated_at = NOW()
     WHERE status = 'pendiente'
       AND due_date < CURRENT_DATE
     RETURNING *`
  );
}

/**
 * Obtiene hitos próximos a vencer (dentro de reminder_days) sin recordatorio
 * reciente, para enviar email de recordatorio.
 */
export async function getMilestonesForReminder(reminderDays: number): Promise<(PaymentMilestone & {
  event_id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  event_date: string;
})[]> {
  return queryMany(
    `SELECT
      pm.*,
      pp.event_id,
      e.client_name,
      e.client_email,
      e.event_type,
      TO_CHAR(e.event_date, 'YYYY-MM-DD') AS event_date
    FROM payment_milestones pm
    JOIN payment_plans pp ON pp.id = pm.plan_id
    JOIN events e ON e.id = pp.event_id
    WHERE pm.status = 'pendiente'
      AND pm.due_date <= CURRENT_DATE + INTERVAL '1 day' * $1
      AND (pm.last_reminder_at IS NULL OR pm.last_reminder_at < NOW() - INTERVAL '1 day' * $1)
      AND e.client_email IS NOT NULL
      AND e.client_email != ''
    ORDER BY pm.due_date ASC
    LIMIT 50`,
    [reminderDays]
  );
}

/**
 * Registra que se envió recordatorio para un hito.
 */
export async function markReminderSent(client: PoolClient, milestoneId: string): Promise<void> {
  await client.query(
    `UPDATE payment_milestones SET last_reminder_at = NOW() WHERE id = $1`,
    [milestoneId]
  );
}

/**
 * Registra el pago de un hito (vincula con un registro de payments).
 * Si el hito es 'senal' y se marca como pagado, emite deposit.paid.
 */
export async function markMilestonePaid(
  client: PoolClient,
  milestoneId: string,
  paymentId: string
): Promise<PaymentMilestone> {
  const milestone = (await client.query(
    `UPDATE payment_milestones
     SET status = 'pagado', paid_at = NOW(), payment_id = $2
     WHERE id = $1 AND status IN ('pendiente', 'vencido')
     RETURNING *`,
    [milestoneId, paymentId]
  )).rows[0];

  if (!milestone) {
    throw new Error(`Hito ${milestoneId} no encontrado o ya en estado ${milestone?.status}`);
  }

  // Si es señal pagada, emitir evento de dominio
  if (milestone.kind === 'senal') {
    const plan = (await client.query(
      `SELECT event_id FROM payment_plans WHERE id = $1`, [milestone.plan_id]
    )).rows[0];

    if (plan) {
      await emitDomainEvent(client, 'deposit.paid', 'event', plan.event_id, {
        event_id: plan.event_id,
        milestone_id: milestoneId,
        amount: Number(milestone.amount),
      });
    }
  }

  // Verificar si todos los hitos del plan están pagados → marcar plan como 'completed'
  const plan = (await client.query(
    `SELECT id, event_id FROM payment_plans WHERE id = $1`, [milestone.plan_id]
  )).rows[0];
  if (plan) {
    const pending = (await client.query(
      `SELECT COUNT(*)::int AS cnt FROM payment_milestones
       WHERE plan_id = $1 AND status IN ('pendiente', 'vencido')`,
      [plan.id]
    )).rows[0];
    if (pending.cnt === 0) {
      await client.query(
        `UPDATE payment_plans SET status = 'completed' WHERE id = $1`,
        [plan.id]
      );
    }
  }

  return milestone;
}
