/**
 * EventFlow — Zod Schemas (Data Validation Layer)
 * 
 * Catálogo real: Alboroto Eventos 2025
 * Fuente: https://byalboroto.duckdns.org/
 * 
 * REGLA CRÍTICA: El configurador B2C NUNCA muestra precios.
 * El precio solo se calcula en el backend y se visualiza en el Dashboard B2B.
 * Determinismo puro: sin IA generativa en tiempo de ejecución.
 */

import { z } from 'zod';

// ============================================================
// CATALOG ITEM
// ============================================================

export const CatalogItemSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  category: z.enum([
    'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
    'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
  ], {
    errorMap: () => ({ message: 'Categoría inválida' }),
  }),
  subcategory: z.string().max(100).optional(),
  pvp: z.number().min(0, 'El PVP debe ser ≥ 0').max(99999).default(0),
  cost: z.number().min(0, 'El coste interno debe ser ≥ 0').max(99999).default(0),
  ingredientes_base: z.array(
    z.object({
      name: z.string().min(1, 'El ingrediente debe tener nombre'),
      grams: z.number().min(0).optional(),
      ml: z.number().min(0).optional(),
      count: z.number().min(0).optional(),
    })
  ).default([]),
  image_url: z.string().url('image_url debe ser una URL válida').or(z.literal('')).default(''),
  active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const CatalogItemCreateSchema = CatalogItemSchema.omit({ id: true, created_at: true, updated_at: true });
export type CatalogItemCreate = z.infer<typeof CatalogItemCreateSchema>;

export const CatalogItemUpdateSchema = CatalogItemCreateSchema.partial();
export type CatalogItemUpdate = z.infer<typeof CatalogItemUpdateSchema>;

// ============================================================
// PROPOSED MENUS
// ============================================================

export const ProposedMenuSectionSchema = z.object({
  section: z.string().min(1),
  items: z.array(z.string().min(1)),
});
export type ProposedMenuSection = z.infer<typeof ProposedMenuSectionSchema>;

export const ProposedMenuSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tag: z.string().min(1),
  suggested_price: z.number().min(0),
  is_kid: z.boolean().default(false),
  sections: z.array(ProposedMenuSectionSchema),
  created_at: z.string().datetime().optional(),
});
export type ProposedMenu = z.infer<typeof ProposedMenuSchema>;

// ============================================================
// EVENT SETUP
// ============================================================

export const EventTypeSchema = z.enum([
  'boda', 'cumpleaños', 'corporativo', 'bautizo', 'comunión', 'otro',
]);

export const EventStatusSchema = z.enum([
  'nuevo', 'propuesta_enviada', 'confirmado', 'cancelado', 'en_curso', 'completado',
]);

export const SelectedItemSchema = z.object({
  item_id: z.string(), // UUID or dish name
  name: z.string().min(1),
  category: z.enum([
    'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
    'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
  ]),
  unit_price_pvp: z.number().min(0).default(0),
  unit_price_cost: z.number().min(0).default(0),
  quantity: z.number().int().min(1).default(1),
  subtotal_pvp: z.number().min(0).default(0),
  subtotal_cost: z.number().min(0).default(0),
});
export type SelectedItem = z.infer<typeof SelectedItemSchema>;

export const EventSetupSchema = z.object({
  id: z.string().uuid().optional(),
  menu_id: z.string().optional(), // menu1, menu2, etc. or UUID
  client_name: z.string().min(2, 'Nombre del cliente obligatorio').max(120),
  client_email: z.string().email('Email inválido'),
  client_phone: z.string().min(9).max(20).optional(),
  event_type: EventTypeSchema,
  guest_count: z.number().int().min(1).max(5000, 'Máximo 5000 comensales'),
  kids_count: z.number().int().min(0).max(1000).default(0),
  event_date: z.string().datetime().or(z.string().date()),
  status: EventStatusSchema.default('nuevo'),
  selected_items: z.array(SelectedItemSchema).default([]),
  total_pvp: z.number().min(0).default(0),
  total_cost: z.number().min(0).default(0),
  bar_hours: z.number().int().min(0).max(3).default(0),
  bar_price: z.number().min(0).default(0),
  iva_pct: z.number().min(0).max(100).default(10),
  notes: z.string().max(2000).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});
export type EventSetup = z.infer<typeof EventSetupSchema>;

export const EventSetupCreateSchema = EventSetupSchema.omit({
  id: true, created_at: true, updated_at: true,
}).extend({
  total_pvp: z.number().default(0),
  total_cost: z.number().default(0),
});
export type EventSetupCreate = z.infer<typeof EventSetupCreateSchema>;

// ============================================================
// COST BREAKDOWN
// ============================================================

export const CostLineTypeSchema = z.enum([
  'plato', 'servicio', 'personal', 'montaje', 'extras', 'margen',
]);

export const CostDesgloseSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  line_type: CostLineTypeSchema,
  description: z.string().min(1).max(200),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  created_at: z.string().datetime().optional(),
});
export type CostDesglose = z.infer<typeof CostDesgloseSchema>;

// ============================================================
// OPERATIONAL NEEDS (Ratios de operaciones)
// ============================================================

export const OperationalNeedsSchema = z.object({
  event_id: z.string().uuid(),
  guest_count: z.number().int().min(1),
  kids_count: z.number().int().min(0).default(0),
  event_type: EventTypeSchema,
  staff: z.object({
    camareros: z.number().int().min(1),
    metros: z.number().int().min(1),
    cocineros: z.number().int().min(1),
    seguridad: z.number().int().min(0),
  }),
  tables: z.object({
    count: z.number().int().min(1),
    seats_per_table: z.number().int().min(2).max(20, 'Máximo 20 asientos por mesa'),
  }),
  stock: z.object({
    buffer_pct: z.number().min(0).max(50).default(10),
    items: z.record(
      z.string(),
      z.object({
        base_amount: z.number().min(0),
        with_buffer: z.number().min(0),
        unit: z.string(),
      })
    ),
  }),
  generated_at: z.string().datetime().optional(),
});
export type OperationalNeeds = z.infer<typeof OperationalNeedsSchema>;

// ============================================================
// WEBHOOK PAYLOAD
// ============================================================

export const WebhookTopicSchema = z.enum([
  'BUDGET_CREATED',
  'STATUS_CHANGED',
  'BUDGET_CONFIRMED',
  'BUDGET_CANCELLED',
]);

export const WebhookPayloadSchema = z.object({
  id: z.string().uuid('webhook_id debe ser un UUID válido'),
  topic: WebhookTopicSchema,
  timestamp: z.string().datetime(),
  event: z.object({
    id: z.string().uuid(),
    client_name: z.string(),
    client_email: z.string(),
    event_type: EventTypeSchema,
    guest_count: z.number().int().min(1),
    kids_count: z.number().int().min(0),
    event_date: z.string().date(),
    status: EventStatusSchema,
    total_pvp: z.number().min(0),
    total_cost: z.number().min(0),
    bar_hours: z.number().int().min(0).max(3),
    bar_price: z.number().min(0),
    profit: z.number().min(0),
    margin_pct: z.number().min(0).max(100),
  }),
  changes: z.record(z.unknown()).optional(),
  metadata: z.object({
    source: z.literal('eventflow'),
    version: z.literal('1.0'),
  }).default({ source: 'eventflow', version: '1.0' }),
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// ============================================================
// WIZARD INPUTS (B2C configurador — SIN PRECIOS)
// ============================================================

export const WizardStep1Schema = z.object({
  event_type: EventTypeSchema,
  event_date: z.string().date('Fecha inválida'),
  guest_count: z.number().int().min(10).max(5000),
  kids_count: z.number().int().min(0).max(1000).default(0),
});
export type WizardStep1 = z.infer<typeof WizardStep1Schema>;

export const WizardStep2Schema = z.object({
  menu_id: z.string().min(1, 'Debe seleccionar un menú base').optional(),
  selected_menu: z.string().uuid('Debe seleccionar un menú base').optional(),
  use_proposed: z.boolean().default(true),
});
export type WizardStep2 = z.infer<typeof WizardStep2Schema>;

export const WizardStep3Schema = z.object({
  selected_items: z.array(SelectedItemSchema).min(1, 'Debe seleccionar al menos un artículo'),
});
export type WizardStep3 = z.infer<typeof WizardStep3Schema>;

export const WizardStep4Schema = z.object({
  selected_suggestions: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]), // alias for backward compat
  bar_hours: z.number().int().min(0).max(3).default(0),
});
export type WizardStep4 = z.infer<typeof WizardStep4Schema>;

export const WizardCompleteSchema = z.object({
  step1: WizardStep1Schema,
  step2: WizardStep2Schema,
  step3: WizardStep3Schema,
  step4: WizardStep4Schema,
  client_name: z.string().min(2),
  client_email: z.string().email(),
  client_phone: z.string().min(9).max(20).optional(),
  notes: z.string().max(2000).optional(),
  total_pvp: z.number().min(0),
  total_cost: z.number().min(0),
});
export type WizardComplete = z.infer<typeof WizardCompleteSchema>;

// ============================================================
// OPERATIONS CALCULATION HELPERS
// ============================================================

export const OPERATIONAL_RATIOS = {
  CAMARERO_POR_PAX: 15,
  COCINERO_POR_80: 80,
  SEGURIDAD_POR_100: 100,
  COCINERO_BASE: 2,
  STOCK_BUFFER_PCT: 10,
  ASIENTOS_POR_MESA: 10,
} as const;

export const BAR_PRICES = { 0: 0, 1: 10, 2: 16, 3: 18 } as const;

export function calculateStaff(guestCount: number): OperationalNeeds['staff'] {
  const camareros = Math.ceil(guestCount / OPERATIONAL_RATIOS.CAMARERO_POR_PAX);
  const cocineros = Math.max(
    OPERATIONAL_RATIOS.COCINERO_BASE,
    Math.ceil(guestCount / OPERATIONAL_RATIOS.COCINERO_POR_80)
  );
  const seguridad = Math.ceil(guestCount / OPERATIONAL_RATIOS.SEGURIDAD_POR_100);

  if (camareros < 1 || cocineros < 1) {
    throw new Error(`Cálculo de personal inválido: camareros=${camareros}, cocineros=${cocineros}`);
  }

  return {
    camareros,
    metros: Math.max(1, Math.ceil(camareros / 3)),
    cocineros,
    seguridad,
  };
}

export function calculateTables(guestCount: number): OperationalNeeds['tables'] {
  const count = Math.ceil(guestCount / OPERATIONAL_RATIOS.ASIENTOS_POR_MESA);
  return { count, seats_per_table: OPERATIONAL_RATIOS.ASIENTOS_POR_MESA };
}

export function calculateStock(
  items: SelectedItem[],
  bufferPct: number = OPERATIONAL_RATIOS.STOCK_BUFFER_PCT
): OperationalNeeds['stock'] {
  const stock: Record<string, { base_amount: number; with_buffer: number; unit: string }> = {};
  
  for (const item of items) {
    for (const ing of item.ingredientes_base || []) {
      const key = ing.name;
      const base = ing.grams ?? ing.ml ?? ing.count ?? 0;
      const amount = base * item.quantity;
      stock[key] = {
        base_amount: amount,
        with_buffer: Math.ceil(amount * (1 + bufferPct / 100)),
        unit: ing.grams ? 'g' : ing.ml ? 'ml' : 'unidades',
      };
    }
  }

  return { buffer_pct: bufferPct, items: stock };
}

// ============================================================
// EXPORTS
// ============================================================

export const schemas = {
  CatalogItem: CatalogItemSchema,
  ProposedMenu: ProposedMenuSchema,
  EventSetup: EventSetupSchema,
  CostDesglose: CostDesgloseSchema,
  OperationalNeeds: OperationalNeedsSchema,
  WebhookPayload: WebhookPayloadSchema,
  WizardStep1: WizardStep1Schema,
  WizardStep2: WizardStep2Schema,
  WizardStep3: WizardStep3Schema,
  WizardStep4: WizardStep4Schema,
  WizardComplete: WizardCompleteSchema,
};

export const ratios = OPERATIONAL_RATIOS;
export const barPrices = BAR_PRICES;
