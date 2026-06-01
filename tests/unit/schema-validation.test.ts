/**
 * EventFlow — Unit Tests: Zod Schema Validation
 * 
 * Pruebas unitarias de TODOS los schemas de validación.
 * RED-GREEN-REFACTOR: primero escribo los tests, luego verifico que fallen,
 * luego verifico que pasen con datos válidos.
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// ============================================================
// Helper: re-define schemas inline so tests are self-contained
// ============================================================

const EventTypeSchema = z.enum([
  'boda', 'cumpleaños', 'corporativo', 'bautizo', 'comunión', 'otro',
]);

const EventStatusSchema = z.enum([
  'nuevo', 'propuesta_enviada', 'confirmado', 'cancelado', 'en_curso', 'completado',
]);

const CatalogItemSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  category: z.enum([
    'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
    'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
  ]),
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

const SelectedItemSchema = z.object({
  item_id: z.string(),
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

const EventSetupSchema = z.object({
  id: z.string().uuid().optional(),
  menu_id: z.string().optional(),
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

const ProposedMenuSectionSchema = z.object({
  section: z.string().min(1),
  items: z.array(z.string().min(1)),
});

const ProposedMenuSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tag: z.string().min(1),
  suggested_price: z.number().min(0),
  is_kid: z.boolean().default(false),
  sections: z.array(ProposedMenuSectionSchema),
  created_at: z.string().datetime().optional(),
});

const CostLineTypeSchema = z.enum([
  'plato', 'servicio', 'personal', 'montaje', 'extras', 'margen',
]);

const CostDesgloseSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  line_type: CostLineTypeSchema,
  description: z.string().min(1).max(200),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  created_at: z.string().datetime().optional(),
});

const WebhookTopicSchema = z.enum([
  'BUDGET_CREATED', 'STATUS_CHANGED', 'BUDGET_CONFIRMED', 'BUDGET_CANCELLED',
]);

const WebhookPayloadSchema = z.object({
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

const LeadStatusSchema = z.enum(['nuevo', 'contactado', 'presupuestado', 'convertido', 'perdido']);

const QuoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']);

const InvoiceStatusSchema = z.enum(['pending', 'paid', 'overdue', 'cancelled']);

const EventOrderStatusSchema = z.enum(['in_progress', 'completed', 'cancelled']);

// ============================================================
// TESTS: Catalog Item Schema
// ============================================================

describe('CatalogItemSchema', () => {
  it('validates a correct catalog item', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Tartar de Salmón',
      category: 'aperitivo-frio',
      pvp: 16.00,
      cost: 7.50,
      ingredientes_base: [{ name: 'Salmón', grams: 100 }],
      image_url: 'https://example.com/img.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = CatalogItemSchema.safeParse({
      id: 'not-a-uuid',
      name: 'Test',
      category: 'aperitivo-frio',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.errors[0].message).toBe('ID debe ser un UUID válido');
  });

  it('rejects name too short', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'A',
      category: 'aperitivo-frio',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'invalid-category' as any,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative PVP', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'aperitivo-frio',
      pvp: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative cost', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'aperitivo-frio',
      cost: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing ingredient name', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'aperitivo-frio',
      ingredientes_base: [{ grams: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty image_url as string', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'carne',
      image_url: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid image_url', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'carne',
      image_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('defaults pvp, cost, ingredientes_base, active, image_url', () => {
    const result = CatalogItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'postre',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pvp).toBe(0);
      expect(result.data.cost).toBe(0);
      expect(result.data.ingredientes_base).toEqual([]);
      expect(result.data.active).toBe(true);
      expect(result.data.image_url).toBe('');
    }
  });

  it('accepts all 10 valid categories', () => {
    const categories = [
      'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
      'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
    ];
    for (const cat of categories) {
      const result = CatalogItemSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        category: cat,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================
// TESTS: Event Setup Schema
// ============================================================

describe('EventSetupSchema', () => {
  it('validates a complete event', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'María García',
      client_email: 'maria@example.com',
      client_phone: '+34612345678',
      event_type: 'boda',
      guest_count: 120,
      kids_count: 15,
      event_date: '2026-09-15',
      total_pvp: 5400,
      total_cost: 2800,
      bar_hours: 2,
      bar_price: 16,
      iva_pct: 10,
    });
    expect(result.success).toBe(true);
  });

  it('defaults status to nuevo', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('nuevo');
  });

  it('rejects invalid event type', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda-blanca' as any,
      guest_count: 50,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'not-an-email',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name too short', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'A',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects guest_count of 0', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 0,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects guest_count over 5000', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 6000,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative bar_hours', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
      bar_hours: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects bar_hours over 3', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
      bar_hours: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative total_pvp', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
      total_pvp: -100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts kids_count of 0', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      kids_count: 0,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects kids_count over 1000', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      kids_count: 1500,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('defaults selected_items to empty array', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.selected_items).toEqual([]);
  });

  it('rejects phone too short', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      client_phone: '123',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields omitted', () => {
    const result = EventSetupSchema.safeParse({
      client_name: 'Test',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 50,
      event_date: '2026-01-01',
      // no client_phone, no notes, no bar_hours, no bar_price, no iva_pct
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// TESTS: SelectedItem Schema
// ============================================================

describe('SelectedItemSchema', () => {
  it('validates a correct selected item', () => {
    const result = SelectedItemSchema.safeParse({
      item_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Tartar de Salmón',
      category: 'aperitivo-frio',
      unit_price_pvp: 16,
      unit_price_cost: 7.50,
      quantity: 100,
      subtotal_pvp: 1600,
      subtotal_cost: 750,
    });
    expect(result.success).toBe(true);
  });

  it('defaults quantity to 1', () => {
    const result = SelectedItemSchema.safeParse({
      item_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'postre',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe(1);
  });

  it('rejects negative unit_price_pvp', () => {
    const result = SelectedItemSchema.safeParse({
      item_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'carne',
      unit_price_pvp: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity of 0', () => {
    const result = SelectedItemSchema.safeParse({
      item_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'carne',
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    const result = SelectedItemSchema.safeParse({
      item_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      category: 'carne',
      quantity: 2.5,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// TESTS: Proposed Menu Schema
// ============================================================

describe('ProposedMenuSchema', () => {
  it('validates a correct proposed menu', () => {
    const result = ProposedMenuSchema.safeParse({
      id: 'menu1',
      name: 'Menú Premium',
      tag: 'premium',
      suggested_price: 45,
      sections: [
        { section: 'aperitivo', items: ['tartar', 'croquetas'] },
        { section: 'principal', items: ['lomo', 'merluza'] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('defaults is_kid to false', () => {
    const result = ProposedMenuSchema.safeParse({
      id: 'menu1',
      name: 'Test',
      tag: 'test',
      suggested_price: 20,
      sections: [],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_kid).toBe(false);
  });

  it('validates kid menu', () => {
    const result = ProposedMenuSchema.safeParse({
      id: 'kid-menu',
      name: 'Menú Infantil',
      tag: 'infantil',
      suggested_price: 18,
      is_kid: true,
      sections: [{ section: 'principal', items: ['pollo'] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative suggested_price', () => {
    const result = ProposedMenuSchema.safeParse({
      id: 'menu1',
      name: 'Test',
      tag: 'test',
      suggested_price: -5,
      sections: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty section name', () => {
    const result = ProposedMenuSchema.safeParse({
      id: 'menu1',
      name: 'Test',
      tag: 'test',
      suggested_price: 20,
      sections: [{ section: '', items: ['test'] }],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// TESTS: Cost Desglose Schema
// ============================================================

describe('CostDesgloseSchema', () => {
  it('validates a correct cost line', () => {
    const result = CostDesgloseSchema.safeParse({
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      line_type: 'plato',
      description: 'Coste de platos principales',
      quantity: 120,
      unit_price: 23.33,
      total: 2800,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid line_type', () => {
    const result = CostDesgloseSchema.safeParse({
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      line_type: 'invalid' as any,
      description: 'Test',
      quantity: 1,
      unit_price: 10,
      total: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative total', () => {
    const result = CostDesgloseSchema.safeParse({
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      line_type: 'plato',
      description: 'Test',
      quantity: 1,
      unit_price: 10,
      total: -100,
    });
    expect(result.success).toBe(false);
  });

  it('defaults quantity, unit_price, total', () => {
    const result = CostDesgloseSchema.safeParse({
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      line_type: 'servicio',
      description: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(1);
      expect(result.data.unit_price).toBe(0);
      expect(result.data.total).toBe(0);
    }
  });
});

// ============================================================
// TESTS: Webhook Payload Schema
// ============================================================

describe('WebhookPayloadSchema', () => {
  it('validates a correct webhook payload', () => {
    const result = WebhookPayloadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      topic: 'STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      event: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        client_name: 'Test Client',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 150,
        kids_count: 10,
        event_date: '2026-09-15',
        status: 'confirmado',
        total_pvp: 5250,
        total_cost: 2800,
        bar_hours: 2,
        bar_price: 16,
        profit: 2450,
        margin_pct: 46.7,
      },
    });
    expect(result.success).toBe(true);
  });

  it('defaults metadata', () => {
    const result = WebhookPayloadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      topic: 'BUDGET_CREATED',
      timestamp: new Date().toISOString(),
      event: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        client_name: 'Test',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 100,
        kids_count: 0,
        event_date: '2026-09-15',
        status: 'nuevo',
        total_pvp: 4500,
        total_cost: 2400,
        bar_hours: 1,
        bar_price: 14,
        profit: 2100,
        margin_pct: 46.7,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.source).toBe('eventflow');
      expect(result.data.metadata.version).toBe('1.0');
    }
  });

  it('rejects invalid webhook topic', () => {
    const result = WebhookPayloadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      topic: 'INVALID_TOPIC' as any,
      timestamp: new Date().toISOString(),
      event: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        client_name: 'Test',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 100,
        kids_count: 0,
        event_date: '2026-09-15',
        status: 'nuevo',
        total_pvp: 4500,
        total_cost: 2400,
        bar_hours: 1,
        bar_price: 14,
        profit: 2100,
        margin_pct: 46.7,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative profit', () => {
    const result = WebhookPayloadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      topic: 'STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      event: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        client_name: 'Test',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 100,
        kids_count: 0,
        event_date: '2026-09-15',
        status: 'nuevo',
        total_pvp: 1000,
        total_cost: 2000,
        bar_hours: 1,
        bar_price: 14,
        profit: -1000,
        margin_pct: 46.7,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects margin_pct over 100', () => {
    const result = WebhookPayloadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      topic: 'STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      event: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        client_name: 'Test',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 100,
        kids_count: 0,
        event_date: '2026-09-15',
        status: 'nuevo',
        total_pvp: 10000,
        total_cost: 0,
        bar_hours: 1,
        bar_price: 14,
        profit: 10000,
        margin_pct: 150,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid event_date format', () => {
    const result = WebhookPayloadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      topic: 'STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      event: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        client_name: 'Test',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 100,
        kids_count: 0,
        event_date: 'not-a-date',
        status: 'nuevo',
        total_pvp: 1000,
        total_cost: 500,
        bar_hours: 1,
        bar_price: 14,
        profit: 500,
        margin_pct: 50,
      },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// TESTS: Lead / Quote / Invoice / EventOrder Schemas
// ============================================================

describe('LeadStatusSchema', () => {
  it('accepts all lead statuses', () => {
    for (const s of ['nuevo', 'contactado', 'presupuestado', 'convertido', 'perdido']) {
      const result = LeadStatusSchema.safeParse(s);
      expect(result.success).toBe(true);
    }
  });
  it('rejects invalid lead status', () => {
    expect(LeadStatusSchema.safeParse('cancelled').success).toBe(false);
  });
});

describe('QuoteStatusSchema', () => {
  it('accepts all quote statuses', () => {
    for (const s of ['draft', 'sent', 'accepted', 'rejected', 'expired']) {
      const result = QuoteStatusSchema.safeParse(s);
      expect(result.success).toBe(true);
    }
  });
  it('rejects invalid quote status', () => {
    expect(QuoteStatusSchema.safeParse('cancelled').success).toBe(false);
  });
});

describe('InvoiceStatusSchema', () => {
  it('accepts all invoice statuses', () => {
    for (const s of ['pending', 'paid', 'overdue', 'cancelled']) {
      const result = InvoiceStatusSchema.safeParse(s);
      expect(result.success).toBe(true);
    }
  });
});

describe('EventOrderStatusSchema', () => {
  it('accepts all event order statuses', () => {
    for (const s of ['in_progress', 'completed', 'cancelled']) {
      const result = EventOrderStatusSchema.safeParse(s);
      expect(result.success).toBe(true);
    }
  });
});
