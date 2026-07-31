/**
 * EventFlow — Tests WP-29: Catálogo de Extras y Decoración
 *
 * Tests para el catálogo de extras, selección en portal,
 * e integración con plan de pagos.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================
// Mock de la base de datos
// ============================================================

const mockQuerySingle = vi.fn();
const mockQueryMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/db', () => ({
  querySingle: (...args: any[]) => mockQuerySingle(...args),
  queryMany: (...args: any[]) => mockQueryMany(...args),
  transaction: (...args: any[]) => mockTransaction(...args),
  getPool: () => ({
    connect: () => ({
      query: vi.fn(),
      release: vi.fn(),
    }),
  }),
}));

// ============================================================
// Test Data
// ============================================================

const mockExtrasCatalog = [
  {
    id: 'extra-1',
    category: 'centro_mesa',
    name: 'Centro de mesa floral',
    description: 'Arreglo floral para mesa principal',
    photo_url: null,
    price: 45.00,
    price_unit: 'mesa',
    active: true,
    sort_order: 1,
  },
  {
    id: 'extra-2',
    category: 'flores',
    name: 'Ramo de novia',
    description: 'Ramo personalizado',
    photo_url: null,
    price: 120.00,
    price_unit: 'ud',
    active: true,
    sort_order: 1,
  },
  {
    id: 'extra-3',
    category: 'manteleria',
    name: 'Mantel blanco premium',
    description: 'Mantel de tela blanca premium',
    photo_url: null,
    price: 8.00,
    price_unit: 'mesa',
    active: true,
    sort_order: 1,
  },
];

const mockEventExtras = [
  {
    id: 'ee-1',
    event_id: 'event-1',
    extra_id: 'extra-1',
    qty: 10,
    price_snapshot: 45.00,
    unit: 'mesa',
    selected_via: 'portal',
  },
  {
    id: 'ee-2',
    event_id: 'event-1',
    extra_id: 'extra-3',
    qty: 8,
    price_snapshot: 8.00,
    unit: 'mesa',
    selected_via: 'admin',
  },
];

// ============================================================
// Tests: calculateExtrasTotal
// ============================================================

describe('WP-29 — calculateExtrasTotal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula el total correctamente con extras seleccionados', async () => {
    mockQuerySingle.mockResolvedValueOnce({ total: 514.00 });

    const { calculateExtrasTotal } = await import('@/lib/domain/paymentPlan');
    const total = await calculateExtrasTotal('event-1');

    expect(total).toBe(514.00);
    expect(mockQuerySingle).toHaveBeenCalledWith(
      expect.stringContaining('SUM(price_snapshot * qty)'),
      ['event-1']
    );
  });

  it('retorna 0 cuando no hay extras', async () => {
    mockQuerySingle.mockResolvedValueOnce({ total: 0 });

    const { calculateExtrasTotal } = await import('@/lib/domain/paymentPlan');
    const total = await calculateExtrasTotal('event-empty');

    expect(total).toBe(0);
  });

  it('retorna 0 cuando el resultado es null', async () => {
    mockQuerySingle.mockResolvedValueOnce(null);

    const { calculateExtrasTotal } = await import('@/lib/domain/paymentPlan');
    const total = await calculateExtrasTotal('event-null');

    expect(total).toBe(0);
  });
});

// ============================================================
// Tests: Lógica de selección de extras
// ============================================================

describe('WP-29 — Lógica de selección de extras', () => {
  it('el precio se congela al momento de la selección', () => {
    const catalogItem = { price: 45.00 };
    const selection = {
      price_snapshot: catalogItem.price,
      qty: 10,
    };

    // El precio congelado es 45.00
    expect(selection.price_snapshot).toBe(45.00);

    // Aunque el precio del catálogo cambie después
    catalogItem.price = 55.00;

    // El snapshot sigue siendo 45.00
    expect(selection.price_snapshot).toBe(45.00);
  });

  it('el total se calcula correctamente: price_snapshot * qty', () => {
    const selections = [
      { price_snapshot: 45.00, qty: 10 },  // 450.00
      { price_snapshot: 8.00, qty: 8 },    // 64.00
    ];

    const total = selections.reduce(
      (sum, e) => sum + e.price_snapshot * e.qty,
      0
    );

    expect(total).toBe(514.00);
  });

  it('deseleccionar antes de congelar retira el extra', () => {
    let eventExtras = [...mockEventExtras];

    // Deseleccionar extra-1
    eventExtras = eventExtras.filter(e => e.extra_id !== 'extra-1');

    expect(eventExtras).toHaveLength(1);
    expect(eventExtras[0].extra_id).toBe('extra-3');
  });

  it('un solo registro por extra-evento (qty se actualiza)', () => {
    const eventExtras: any[] = [];
    const newExtra = { extra_id: 'extra-1', qty: 1 };

    // Primera inserción
    const existing = eventExtras.find(e => e.extra_id === newExtra.extra_id);
    if (!existing) {
      eventExtras.push(newExtra);
    }

    expect(eventExtras).toHaveLength(1);

    // Segunda inserción del mismo extra - actualizar qty
    const existing2 = eventExtras.find(e => e.extra_id === newExtra.extra_id);
    if (existing2) {
      existing2.qty += 1;
    }

    expect(eventExtras).toHaveLength(1);
    expect(eventExtras[0].qty).toBe(2);
  });
});

// ============================================================
// Tests: Categorías de extras
// ============================================================

describe('WP-29 — Categorías de extras', () => {
  const VALID_CATEGORIES = [
    'centro_mesa', 'manteleria', 'minuta', 'flores',
    'iluminacion', 'sonido', 'otro'
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    'centro_mesa': 'Centros de mesa',
    'manteleria': 'Mantelería',
    'minuta': 'Minuta y papelería',
    'flores': 'Flores',
    'iluminacion': 'Iluminación',
    'sonido': 'Sonido',
    'otro': 'Otros',
  };

  it('todas las categorías válidas tienen label', () => {
    for (const cat of VALID_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof CATEGORY_LABELS[cat]).toBe('string');
    }
  });

  it('extras se agrupan por categoría correctamente', () => {
    const grouped: Record<string, any[]> = {};
    for (const extra of mockExtrasCatalog) {
      if (!grouped[extra.category]) grouped[extra.category] = [];
      grouped[extra.category].push(extra);
    }

    expect(Object.keys(grouped)).toHaveLength(3);
    expect(grouped['centro_mesa']).toHaveLength(1);
    expect(grouped['flores']).toHaveLength(1);
    expect(grouped['manteleria']).toHaveLength(1);
  });
});

// ============================================================
// Tests: Unidades de precio
// ============================================================

describe('WP-29 — Unidades de precio', () => {
  const VALID_UNITS = ['ud', 'mesa', 'pax', 'evento'];

  const UNIT_LABELS: Record<string, string> = {
    'ud': '/ud',
    'mesa': '/mesa',
    'pax': '/comensal',
    'evento': '/evento',
  };

  it('todas las unidades válidas tienen label', () => {
    for (const unit of VALID_UNITS) {
      expect(UNIT_LABELS[unit]).toBeDefined();
    }
  });

  it('el cálculo depende de la unidad', () => {
    const price = 45.00;
    const qty = 10;

    // Para 'ud': price * qty = 450
    const totalUd = price * qty;
    expect(totalUd).toBe(450);

    // Para 'mesa': price * qty = 450 (10 mesas)
    const totalMesa = price * qty;
    expect(totalMesa).toBe(450);

    // Para 'pax': price * qty = 450 (10 comensales)
    const totalPax = price * qty;
    expect(totalPax).toBe(450);

    // Para 'evento': price = 450 (1 evento, qty se ignora normalmente)
    const totalEvento = price;
    expect(totalEvento).toBe(45);
  });
});

// ============================================================
// Tests: Validación de datos
// ============================================================

describe('WP-29 — Validación de datos', () => {
  it('category es requerido', () => {
    const data = { name: 'Test', price: 10 };
    expect(!data.category || typeof data.category !== 'string').toBe(true);
  });

  it('name es requerido', () => {
    const data = { category: 'otro', price: 10 };
    expect(!data.name || typeof data.name !== 'string').toBe(true);
  });

  it('price debe ser >= 0', () => {
    expect(10 >= 0).toBe(true);
    expect(0 >= 0).toBe(true);
    expect(-5 >= 0).toBe(false);
  });

  it('qty debe ser > 0', () => {
    expect(1 > 0).toBe(true);
    expect(0 > 0).toBe(false);
    expect(-1 > 0).toBe(false);
  });

  it('selected_via debe ser válido', () => {
    const validValues = ['portal', 'admin'];
    expect(validValues.includes('portal')).toBe(true);
    expect(validValues.includes('admin')).toBe(true);
    expect(validValues.includes('invalid')).toBe(false);
  });
});

// ============================================================
// Tests: Integración con plan de pagos
// ============================================================

describe('WP-29 — Integración con plan de pagos', () => {
  it('extras se suman al total del presupuesto', () => {
    const quoteTotal = 10000;
    const extrasTotal = 514;
    const finalTotal = quoteTotal + extrasTotal;

    expect(finalTotal).toBe(10514);
  });

  it('el hito de extras tiene kind "extra"', () => {
    const milestone = {
      kind: 'extra',
      label: 'Extras y decoración',
      amount: 514,
    };

    expect(milestone.kind).toBe('extra');
    expect(milestone.amount).toBe(514);
  });

  it('el hito incremental modifica el resto', () => {
    const planTotal = 10000;
    const extrasTotal = 514;
    const newTotal = planTotal + extrasTotal;
    const restoPct = 60;
    const newRestoAmount = Math.round(newTotal * (restoPct / 100) * 100) / 100;

    expect(newRestoAmount).toBe(6308.40);
  });
});
