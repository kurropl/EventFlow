/**
 * EventFlow — Automation Rules Engine
 *
 * Evaluates automation rules when webhook events are emitted.
 * Rules have conditions (field comparisons) and actions (status update, email, etc.)
 */

import { queryMany, querySingle } from '@/lib/db';
import { setEventStatus, VALID_EVENT_STATUSES } from '@/lib/domain/eventState';

// ============================================================
// Types
// ============================================================

export interface AutomationCondition {
  field: string;          // e.g. "event.total_pvp", "event.status"
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

export interface AutomationAction {
  type: 'update_event_status' | 'send_notification' | 'forward_webhook' | 'log_message' | 'update_event_field';
  config: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_topic: string;
  match_type: 'all' | 'any';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  cooldown_minutes: number;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  rule_name: string;
  event_id: string | null;
  topic: string;
  conditions_met: boolean;
  actions_taken: AutomationAction[];
  success: boolean;
  error_message: string | null;
  execution_ms: number;
  created_at: string;
}

// ============================================================
// CRUD — Rules
// ============================================================

export async function getRules(): Promise<AutomationRule[]> {
  return queryMany<AutomationRule>(
    'SELECT * FROM automation_rules ORDER BY created_at DESC'
  );
}

export async function getRule(id: string): Promise<AutomationRule | null> {
  return querySingle<AutomationRule>(
    'SELECT * FROM automation_rules WHERE id = $1',
    [id]
  );
}

export async function createRule(data: {
  name: string;
  description?: string;
  trigger_topic: string;
  match_type?: 'all' | 'any';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  cooldown_minutes?: number;
}): Promise<AutomationRule> {
  const result = await querySingle<AutomationRule>(
    `INSERT INTO automation_rules (name, description, trigger_topic, match_type, conditions, actions, cooldown_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.description ?? '',
      data.trigger_topic,
      data.match_type ?? 'all',
      JSON.stringify(data.conditions),
      JSON.stringify(data.actions),
      data.cooldown_minutes ?? 0,
    ]
  );
  if (!result) throw new Error('Failed to create automation rule');
  return result;
}

export async function updateRule(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    enabled: boolean;
    trigger_topic: string;
    match_type: 'all' | 'any';
    conditions: AutomationCondition[];
    actions: AutomationAction[];
    cooldown_minutes: number;
  }>
): Promise<AutomationRule | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled); }
  if (data.trigger_topic !== undefined) { sets.push(`trigger_topic = $${idx++}`); params.push(data.trigger_topic); }
  if (data.match_type !== undefined) { sets.push(`match_type = $${idx++}`); params.push(data.match_type); }
  if (data.conditions !== undefined) { sets.push(`conditions = $${idx++}`); params.push(JSON.stringify(data.conditions)); }
  if (data.actions !== undefined) { sets.push(`actions = $${idx++}`); params.push(JSON.stringify(data.actions)); }
  if (data.cooldown_minutes !== undefined) { sets.push(`cooldown_minutes = $${idx++}`); params.push(data.cooldown_minutes); }

  if (sets.length === 0) return getRule(id);

  params.push(id);
  return querySingle<AutomationRule>(
    `UPDATE automation_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
}

export async function deleteRule(id: string): Promise<boolean> {
  const result = await querySingle<{id: string}>(
    'DELETE FROM automation_rules WHERE id = $1 RETURNING id',
    [id]
  );
  return result !== null;
}

// ============================================================
// Logging
// ============================================================

export async function getLogs(
  limit = 50,
  offset = 0,
  ruleId?: string
): Promise<AutomationLog[]> {
  if (ruleId) {
    return queryMany<AutomationLog>(
      'SELECT * FROM automation_logs WHERE rule_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [ruleId, limit, offset]
    );
  }
  return queryMany<AutomationLog>(
    'SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
}

async function logExecution(entry: {
  rule_id: string;
  rule_name: string;
  event_id: string | null;
  topic: string;
  conditions_met: boolean;
  actions_taken: AutomationAction[];
  success: boolean;
  error_message: string | null;
  execution_ms: number;
}): Promise<void> {
  await querySingle(
    `INSERT INTO automation_logs
       (rule_id, rule_name, event_id, topic, conditions_met, actions_taken, success, error_message, execution_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.rule_id,
      entry.rule_name,
      entry.event_id,
      entry.topic,
      entry.conditions_met,
      JSON.stringify(entry.actions_taken),
      entry.success,
      entry.error_message,
      entry.execution_ms,
    ]
  );
}

// ============================================================
// Condition Evaluation
// ============================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCondition(
  condition: AutomationCondition,
  payload: Record<string, unknown>
): boolean {
  const actualValue = getNestedValue(payload, condition.field);

  switch (condition.operator) {
    case 'eq':
      return actualValue === condition.value;
    case 'ne':
      return actualValue !== condition.value;
    case 'gt':
      return Number(actualValue) > Number(condition.value);
    case 'gte':
      return Number(actualValue) >= Number(condition.value);
    case 'lt':
      return Number(actualValue) < Number(condition.value);
    case 'lte':
      return Number(actualValue) <= Number(condition.value);
    case 'contains': {
      if (typeof actualValue === 'string' && typeof condition.value === 'string') {
        return actualValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(condition.value);
      }
      return String(actualValue).includes(String(condition.value));
    }
    case 'in': {
      if (Array.isArray(condition.value)) {
        return condition.value.includes(actualValue);
      }
      return false;
    }
    default:
      return false;
  }
}

// ============================================================
// Action Execution
// ============================================================

interface ActionContext {
  rule: AutomationRule;
  event: Record<string, unknown>;
  payload: Record<string, unknown>;
}

async function executeAction(
  action: AutomationAction,
  context: ActionContext
): Promise<void> {
  switch (action.type) {
    case 'log_message': {
      const msg = String(action.config.message ?? 'Action triggered');
      console.log(`[automation:${context.rule.name}] ${msg}`);
      break;
    }

    case 'update_event_status': {
      const newStatus = String(action.config.status ?? '');
      const eventId = context.event.id as string;
      // G17/B6: whitelist — antes cualquier string configurado por el admin
      // se escribía tal cual, sin ejecutar ningún efecto de negocio asociado.
      if (eventId && newStatus && VALID_EVENT_STATUSES.has(newStatus)) {
        await setEventStatus(eventId, newStatus);
      }
      break;
    }

    case 'update_event_field': {
      const field = String(action.config.field ?? '');
      const value = action.config.value;
      const eventId = context.event.id as string;
      // Allowlist of fields that can be updated by automation rules
      const ALLOWED_FIELDS = new Set([
        'status', 'notes', 'bar_hours', 'kids_count', 'guest_count',
        'linen_type', 'centerpiece', 'client_phone',
      ]);
      // G17/B6: 'status' es el mismo campo peligroso que update_event_status
      // — misma whitelist antes de escribir.
      if (field === 'status' && !VALID_EVENT_STATUSES.has(String(value))) {
        break;
      }
      if (eventId && field && value !== undefined && ALLOWED_FIELDS.has(field)) {
        await querySingle(
          `UPDATE events SET ${field} = $1, updated_at = now() WHERE id = $2`,
          [value, eventId]
        );
      }
      break;
    }

    case 'send_notification': {
      const channel = String(action.config.channel ?? 'console');
      const message = String(action.config.message ?? '');
      if (channel === 'console') {
        console.log(`[automation:notification] ${message}`);
      }
      // Future: integrate with email/SMS/WhatsApp
      break;
    }

    case 'forward_webhook': {
      const targetUrl = String(action.config.url ?? '');
      if (targetUrl) {
        try {
          await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-EventFlow-Source': 'automation',
            },
            body: JSON.stringify({
              rule: context.rule.name,
              event: context.event,
              payload: context.payload,
              triggered_at: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error(`[automation:forward] Failed to forward to ${targetUrl}:`, err);
          throw err;
        }
      }
      break;
    }

    default:
      console.warn(`[automation] Unknown action type: ${(action as any).type}`);
  }
}

// ============================================================
// Main: evaluateRules
// ============================================================

export async function evaluateRules(
  topic: string,
  event: Record<string, unknown>,
  additionalContext: Record<string, unknown> = {}
): Promise<{ matched: number; executed: number; errors: string[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let matched = 0;
  let executed = 0;

  try {
    const rules = await queryMany<AutomationRule>(
      `SELECT * FROM automation_rules
       WHERE enabled = true AND trigger_topic = $1
       ORDER BY created_at ASC`,
      [topic]
    );

    if (rules.length === 0) return { matched: 0, executed: 0, errors: [] };

    const payload: Record<string, unknown> = {
      topic,
      event,
      ...additionalContext,
      timestamp: new Date().toISOString(),
    };

    for (const rule of rules) {
      try {
        const ruleStart = Date.now();
        const conditions: AutomationCondition[] = rule.conditions as AutomationCondition[];
        const actions: AutomationAction[] = rule.actions as AutomationAction[];

        // Evaluate conditions
        let conditionsMet = true;
        if (conditions.length === 0) {
          conditionsMet = true; // No conditions = always trigger
        } else if (rule.match_type === 'all') {
          conditionsMet = conditions.every((c) => evaluateCondition(c, payload));
        } else {
          conditionsMet = conditions.some((c) => evaluateCondition(c, payload));
        }

        if (!conditionsMet) {
          // Log non-match for audit
          await logExecution({
            rule_id: rule.id,
            rule_name: rule.name,
            event_id: (event.id as string) ?? null,
            topic,
            conditions_met: false,
            actions_taken: [],
            success: true,
            error_message: null,
            execution_ms: Date.now() - ruleStart,
          });
          continue;
        }

        matched++;

        // Check cooldown
        if (rule.cooldown_minutes > 0 && rule.last_triggered_at) {
          const lastAt = new Date(rule.last_triggered_at).getTime();
          const elapsed = (Date.now() - lastAt) / 60000;
          if (elapsed < rule.cooldown_minutes) {
            continue; // Skip — in cooldown
          }
        }

        // Execute actions
        const context: ActionContext = { rule, event, payload };
        let allActionsSuccess = true;
        let lastError: string | null = null;

        for (const action of actions) {
          try {
            await executeAction(action, context);
          } catch (err) {
            allActionsSuccess = false;
            lastError = err instanceof Error ? err.message : String(err);
            errors.push(`Rule "${rule.name}" action "${action.type}": ${lastError}`);
          }
        }

        executed++;

        // Update rule stats
        await querySingle(
          `UPDATE automation_rules
           SET last_triggered_at = now(), trigger_count = trigger_count + 1
           WHERE id = $1`,
          [rule.id]
        );

        // Log execution
        await logExecution({
          rule_id: rule.id,
          rule_name: rule.name,
          event_id: (event.id as string) ?? null,
          topic,
          conditions_met: true,
          actions_taken: actions,
          success: allActionsSuccess,
          error_message: lastError,
          execution_ms: Date.now() - ruleStart,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Rule "${rule.name}": ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Automation engine: ${msg}`);
  }

  return { matched, executed, errors };
}

export default {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  getLogs,
  evaluateRules,
};
