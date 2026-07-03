/**
 * EventFlow — Motor de generación de hojas operativas de cocina
 * 
 * Genera 3 hojas desde el escandallo del evento:
 * 1. Producción (previa al evento): ingredientes por pase de servicio
 * 2. Carga (día del evento): producto a cargar, perecedero/no
 * 3. Logística: equipamiento + seco + perecedero + descartables
 * 
 * SIN tabla de cache — se calcula en caliente cada vez.
 * Las queries son JOIN de 4-5 tablas, PostgreSQL las resuelve en <10ms.
 */

import { getPool } from '@/lib/db';
import { reserveEquipmentForEvent } from '@/lib/domain/equipmentCheckout';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Query resiliente: si una tabla OPCIONAL del módulo cocina (equipment,
 * service_passes…) no existe en este despliegue, degradamos a filas vacías en
 * lugar de romper la hoja. En producción esas tablas existen (migraciones).
 */
async function softQuery(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
  try {
    return await getPool().query(sql, params);
  } catch {
    return { rows: [] };
  }
}

// ── Interfaces ───────────────────────────────────────────────

interface PassInfo {
  passNumber: number;
  passName: string;
  icon: string;
}

interface ProductionItem {
  ingredientName: string;
  ingredientQty: number;
  unit: string;
  passNumber: number;
  passName: string;
  catalogItemName: string;
}

interface ProductionByPass {
  pass: PassInfo;
  items: ProductionItem[];
  totalIngredients: { ingredientName: string; totalQty: number; unit: string }[];
}

interface LoadingItem {
  productName: string;
  quantity: number;
  unit: string;
  perishable: boolean;
  passNumber: number;
  passName: string;
  catalogItemName: string;
}

interface LogisticsEquipment {
  name: string;
  category: string;
  needed: number;
  available: number;
  short: number;
  unit: string;
}

interface LogisticsGoods {
  productName: string;
  quantity: number;
  unit: string;
  category: string;
}

// ── Mapeo de categorías para perecedero/no perecedero ──
// Esto se podría mover a tabla si se necesita personalización
const PERISHABLE_INGREDIENTS = new Set([
  'carne', 'pescado', 'verdura', 'hortaliza', 'lacteo', 'huevo',
  'marisco', 'fruta', 'seta', 'charcuteria',
]);

// ── Equipamiento por tipo de plato ──
// Mapeo categoría de plato → equipment_rules (fallback si no hay reglas explícitas)
const DEFAULT_EQUIPMENT_MAP: Record<string, { equipmentName: string; qtyPerUse: number }[]> = {
  'aperitivo-frio': [
    { equipmentName: 'Bandeja de aperitivos', qtyPerUse: 2 },
  ],
  'aperitivo-caliente': [
    { equipmentName: 'Fuente caliente', qtyPerUse: 2 },
  ],
  'compartir-mesa': [
    { equipmentName: 'Cuenco compartir', qtyPerUse: 1 },
  ],
  'carne': [
    { equipmentName: 'Bandeja grande', qtyPerUse: 1 },
    { equipmentName: 'Tabla de corte', qtyPerUse: 1 },
  ],
  'pescado': [
    { equipmentName: 'Bandeja grande', qtyPerUse: 1 },
  ],
  'arroz': [
    { equipmentName: 'Paellera', qtyPerUse: 1 },
  ],
  'postre': [
    { equipmentName: 'Plato de postre', qtyPerUse: 1 },
  ],
  'sorbete': [
    { equipmentName: 'Copa de sorbete', qtyPerUse: 1 },
  ],
  'bebida': [
    { equipmentName: 'Cubitera', qtyPerUse: 1 },
    { equipmentName: 'Hielera', qtyPerUse: 1 },
  ],
};

// ── Helper: obtener pase de servicio para un plato ──

async function getPassForCategory(
  category: string,
  customPassOrder: Record<string, number> | null,
  catalogItemName: string
): Promise<number> {
  // Si hay reasignación manual, priorizar (T5.3: forma única JSON
  // { item_name: pass_number }, la misma que escribe/lee
  // api/cocina/event/[eventId]/passes/route.ts).
  if (customPassOrder && typeof customPassOrder === 'object' && !Array.isArray(customPassOrder)) {
    const manual = customPassOrder[catalogItemName];
    if (manual) return manual;
  }

  // Mapeo por defecto desde la BD (si las tablas de pases no existen, caemos al hardcode)
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT sp.pass_number FROM category_pass_mapping cpm
       JOIN service_passes sp ON sp.id = cpm.pass_id
       WHERE cpm.category = $1`,
      [category]
    );
    if (result.rows.length) return result.rows[0].pass_number;
  } catch { /* sin tablas de pases → hardcode */ }

  // Fallback hardcode
  const passMap: Record<string, number> = {
    'aperitivo-frio': 1, 'aperitivo-caliente': 1,
    'compartir-mesa': 2,
    'arroz': 3, 'carne': 3, 'pescado': 3,
    'sorbete': 4, 'postre': 4,
    'bebida': 5,
  };
  return passMap[category] || 99;
}

// ── 1. Hoja de producción ──

export async function generateProductionSheet(
  eventId: string
): Promise<{ eventName: string; guestCount: number; passes: ProductionByPass[] }> {
  const pool = getPool();

  const event = await pool.query(
    `SELECT id, client_name, guest_count, event_date, custom_pass_order FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event.rows.length) throw new Error('Evento no encontrado');

  const ev = event.rows[0];
  const guestCount = Number(ev.guest_count) || 1;
  const customPassOrder = ev.custom_pass_order;

  // Obtener todos los items del escandallo con sus ingredientes
  const items = await pool.query(
    `SELECT esi.id AS item_id, esi.ingredient_name, esi.theoretical_qty, esi.theoretical_unit,
            esi.estimated_cost, esi.category, esi.recipe_item_id,
            ri.quantity AS recipe_qty, ri.unit AS recipe_unit
     FROM event_shopping_items esi
     LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     WHERE esi.event_id = $1 AND esi.frozen = false
     ORDER BY esi.category, esi.ingredient_name`,
    [eventId]
  );

  if (!items.rows.length) {
    return {
      eventName: ev.client_name,
      guestCount,
      passes: [],
    };
  }

  // Agrupar por pase
  const passMap = new Map<number, ProductionItem[]>();

  for (const row of items.rows) {
    const passNum = await getPassForCategory(row.category, customPassOrder, row.ingredient_name);
    if (!passMap.has(passNum)) passMap.set(passNum, []);
    passMap.get(passNum)!.push({
      ingredientName: row.ingredient_name,
      ingredientQty: Number(row.theoretical_qty) || 0,
      unit: row.theoretical_unit || row.recipe_unit || 'g',
      passNumber: passNum,
      passName: '',
      catalogItemName: row.ingredient_name,
    });
  }

  // Obtener nombres de pases
  const passesResult = await softQuery('SELECT * FROM service_passes ORDER BY sort_order');
  const passNames = new Map(passesResult.rows.map((p: any) => [p.pass_number, { name: p.name, icon: p.icon }]));

  const passes: ProductionByPass[] = [];
  const sortedPasses = [...passMap.entries()].sort((a, b) => a[0] - b[0]);

  for (const [passNum, items] of sortedPasses) {
    const passInfo = passNames.get(passNum) || { name: `Pase ${passNum}`, icon: '🍽️' };

    // Agregar totales por ingrediente
    const ingredientTotals = new Map<string, { totalQty: number; unit: string }>();
    for (const item of items) {
      const key = item.ingredientName;
      const existing = ingredientTotals.get(key) || { totalQty: 0, unit: item.unit };
      existing.totalQty += item.ingredientQty;
      ingredientTotals.set(key, existing);
    }

    passes.push({
      pass: { passNumber: passNum, passName: passInfo.name, icon: passInfo.icon },
      items,
      totalIngredients: Array.from(ingredientTotals.entries()).map(([name, data]) => ({
        ingredientName: name,
        totalQty: data.totalQty,
        unit: data.unit,
      })),
    });
  }

  return {
    eventName: ev.client_name,
    guestCount,
    passes,
  };
}

// ── 2. Hoja de carga ──

export async function generateLoadingSheet(
  eventId: string
): Promise<{
  eventName: string;
  guestCount: number;
  venueType: string;
  applies: boolean;
  reason?: string;
  perecedero: LoadingItem[];
  noPerecedero: LoadingItem[];
  perecederoPasses: { pass: PassInfo; items: LoadingItem[] }[];
  noPerecederoPasses: { pass: PassInfo; items: LoadingItem[] }[];
}> {
  const pool = getPool();

  const event = await pool.query(
    `SELECT id, client_name, guest_count, event_date, custom_pass_order,
            COALESCE(venue_type,'benitez') AS venue_type
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event.rows.length) throw new Error('Evento no encontrado');

  const ev = event.rows[0];
  const guestCount = Number(ev.guest_count) || 1;
  const customPassOrder = ev.custom_pass_order;
  const venueType = ev.venue_type === 'externo' ? 'externo' : 'benitez';

  // FR-A07/C06: en el local (Benítez) no hay transporte → la Hoja de Carga no aplica.
  if (venueType !== 'externo') {
    return {
      eventName: ev.client_name,
      guestCount,
      venueType,
      applies: false,
      reason: 'El evento es en el local (Salones Benítez): no hay carga de furgoneta.',
      perecedero: [],
      noPerecedero: [],
      perecederoPasses: [],
      noPerecederoPasses: [],
    };
  }

  const items = await pool.query(
    `SELECT esi.ingredient_name, esi.theoretical_qty, esi.theoretical_unit, esi.category, esi.id,
            ri.quantity AS recipe_qty, i.is_dry, i.is_equipment
     FROM event_shopping_items esi
     LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     LEFT JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );

  const passesResult = await softQuery('SELECT * FROM service_passes ORDER BY sort_order');
  const passNames = new Map(passesResult.rows.map((p: any) => [p.pass_number, p.name]));
  const passInfoOf = (passNum: number): PassInfo => ({
    passNumber: passNum,
    passName: (passNames.get(passNum) as string | undefined) || `Pase ${passNum}`,
    icon: '📦',
  });

  // Clasificar por perecedero/no perecedero, agrupando por pase (F2.1: antes
  // perecederoPasses/noPerecederoPasses quedaban siempre vacíos pese a estar
  // declarados en el tipo — la hoja de carga no distinguía qué cargar en cada
  // pase, solo un listado plano).
  const perecedero: LoadingItem[] = [];
  const noPerecedero: LoadingItem[] = [];
  const perecederoByPass = new Map<number, LoadingItem[]>();
  const noPerecederoByPass = new Map<number, LoadingItem[]>();

  for (const row of items.rows) {
    const passNum = await getPassForCategory(row.category, customPassOrder, row.ingredient_name);
    const qty = Number(row.theoretical_qty) || 0;
    const unit = row.theoretical_unit || 'g';

    const item: LoadingItem = {
      productName: row.ingredient_name,
      quantity: qty,
      unit,
      perishable: false,
      passNumber: passNum,
      passName: passInfoOf(passNum).passName,
      catalogItemName: row.ingredient_name,
    };

    // is_dry/is_equipment (ingredients) es la fuente canónica cuando el ingrediente
    // resuelve; si no, cae al heurístico por categoría (sistema legacy).
    const isPerishable = row.is_dry != null
      ? !row.is_dry && !row.is_equipment
      : PERISHABLE_INGREDIENTS.has(row.category?.toLowerCase() || '');

    if (isPerishable) {
      item.perishable = true;
      perecedero.push(item);
      if (!perecederoByPass.has(passNum)) perecederoByPass.set(passNum, []);
      perecederoByPass.get(passNum)!.push(item);
    } else {
      noPerecedero.push(item);
      if (!noPerecederoByPass.has(passNum)) noPerecederoByPass.set(passNum, []);
      noPerecederoByPass.get(passNum)!.push(item);
    }
  }

  // Agregar cantidades por producto dentro de cada pase (mismo patrón que
  // totalIngredients en generateProductionSheet) para que la hoja de carga
  // muestre unidades reales a meter en la furgoneta por pase, no líneas sueltas.
  const groupByPass = (byPass: Map<number, LoadingItem[]>) =>
    [...byPass.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([passNum, passItems]) => {
        const totals = new Map<string, LoadingItem>();
        for (const it of passItems) {
          const key = `${it.productName}::${it.unit}`;
          const existing = totals.get(key);
          if (existing) existing.quantity += it.quantity;
          else totals.set(key, { ...it });
        }
        return { pass: passInfoOf(passNum), items: [...totals.values()] };
      });

  return {
    eventName: ev.client_name,
    guestCount,
    venueType,
    applies: true,
    perecedero,
    noPerecedero,
    perecederoPasses: groupByPass(perecederoByPass),
    noPerecederoPasses: groupByPass(noPerecederoByPass),
  };
}

// ── 3. Hoja logística ──

export async function generateLogisticsSheet(
  eventId: string
): Promise<{
  eventName: string;
  eventDate: string;
  venueType: string;
  includesEquipmentTransport: boolean;
  equipment: LogisticsEquipment[];
  dryGoods: LogisticsGoods[];
  perishableGoods: LogisticsGoods[];
  disposables: LogisticsGoods[];
  dateConflicts: { eventId: string; eventName: string; date: string }[];
}> {
  const pool = getPool();

  const event = await pool.query(
    `SELECT id, client_name, event_date, guest_count,
            COALESCE(venue_type,'benitez') AS venue_type
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event.rows.length) throw new Error('Evento no encontrado');

  const ev = event.rows[0];
  const eventDate = ev.event_date;
  // FR-C07: en externo hay que TRANSPORTAR el equipamiento; en el local ya está in situ.
  const venueType = ev.venue_type === 'externo' ? 'externo' : 'benitez';
  const includesEquipmentTransport = venueType === 'externo';

  // 1. Equipamiento: calcular needed desde equipment_rules + DEFAULT_EQUIPMENT_MAP
  const items = await pool.query(
    `SELECT DISTINCT esi.category, esi.id
     FROM event_shopping_items esi
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );

  const categories = new Set(items.rows.map((r: any) => r.category));
  const equipmentNeeded = new Map<string, number>();

  // Buscar reglas en equipment_rules
  for (const cat of categories) {
    const rules = await softQuery(
      `SELECT e.name, e.stock_quantity, er.quantity_per_use, er.per_guest
       FROM equipment_rules er
       JOIN equipment e ON e.id = er.equipment_id
       WHERE er.category = $1 OR er.catalog_item_id IS NULL`,
      [cat]
    );

    if (rules.rows.length) {
      for (const rule of rules.rows) {
        const needed = Number(rule.per_guest)
          ? Number(rule.quantity_per_use) * Number(ev.guest_count)
          : Number(rule.quantity_per_use);
        equipmentNeeded.set(rule.name, (equipmentNeeded.get(rule.name) || 0) + needed);
      }
    } else if (DEFAULT_EQUIPMENT_MAP[cat]) {
      // Fallback a mapeo hardcodeado
      for (const def of DEFAULT_EQUIPMENT_MAP[cat]) {
        const eqResult = await softQuery(
          'SELECT id, name, stock_quantity FROM equipment WHERE name = $1 AND active = true LIMIT 1',
          [def.equipmentName]
        );
        if (eqResult.rows.length) {
          equipmentNeeded.set(def.equipmentName, (equipmentNeeded.get(def.equipmentName) || 0) + def.qtyPerUse);
        }
      }
    }
  }

  // 2. Concurrencia: consultar otros eventos en la misma fecha
  const sameDayEvents = await pool.query(
    `SELECT id, client_name, event_date::date,
       (SELECT jsonb_agg(ei.*) 
        FROM event_shopping_items ei 
        WHERE ei.event_id = events.id AND ei.frozen = false) AS items
     FROM events 
     WHERE event_date::date = $1::date AND id != $2 AND status != 'lost' AND status != 'cancelled'`,
    [eventDate, eventId]
  );

  // 3. Obtener stock disponible de equipment
  const equipmentList = await softQuery(
    'SELECT id, name, stock_quantity, unit, category FROM equipment WHERE active = true'
  );
  const stockMap = new Map(equipmentList.rows.map((r: any) => [r.name, { id: r.id, qty: Number(r.stock_quantity), unit: r.unit, category: r.category }]));

  const equipment: LogisticsEquipment[] = [];
  const neededByEquipmentId = new Map<string, number>();
  for (const [name, needed] of equipmentNeeded) {
    const stock = stockMap.get(name);
    const available = stock?.qty || 0;
    equipment.push({
      name,
      category: stock?.category || 'utensilio',
      needed: Math.ceil(needed),
      available,
      short: Math.max(0, Math.ceil(needed) - available),
      unit: stock?.unit || 'ud',
    });
    if (stock?.id) neededByEquipmentId.set(stock.id, needed);
  }

  // G12 (Sprint 4, E-B2): reserva automática — solo eventos externos, donde
  // aplica transporte de equipamiento. Reutiliza el cálculo de arriba, no lo
  // duplica. Idempotente (upsert por evento+equipo).
  if (includesEquipmentTransport && neededByEquipmentId.size > 0) {
    await reserveEquipmentForEvent(pool, eventId, neededByEquipmentId);
  }

  // 4. Producto seco, perecedero y equipamiento-ingrediente desde escandallo.
  // Fuente canónica (AC6.3): ingredients.is_equipment/is_dry cuando el
  // ingrediente resuelve; heurístico por nombre/categoría como fallback
  // (ingredientes legacy sin fila resuelta en `ingredients`).
  const shoppingItems = await pool.query(
    `SELECT esi.ingredient_name, esi.theoretical_qty, esi.theoretical_unit, esi.category,
            i.is_dry, i.is_equipment
     FROM event_shopping_items esi
     LEFT JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.frozen = false`,
    [eventId]
  );

  const dryGoods: LogisticsGoods[] = [];
  const perishableGoods: LogisticsGoods[] = [];
  const disposables: LogisticsGoods[] = [];
  const ingredientEquipment: LogisticsEquipment[] = [];

  for (const row of shoppingItems.rows) {
    const qty = Number(row.theoretical_qty) || 0;
    const unit = row.theoretical_unit || 'g';
    const cat = (row.category || '').toLowerCase();
    const name = row.ingredient_name;

    if (row.is_equipment) {
      ingredientEquipment.push({ name, category: cat || 'utensilio', needed: Math.ceil(qty), available: 0, short: Math.ceil(qty), unit });
      continue;
    }

    const isDisposable = ['papel', 'film', 'bolsa', 'guante', 'servilleta', 'bandeja de cartón']
      .some(k => name.toLowerCase().includes(k));
    if (isDisposable) {
      disposables.push({ productName: name, quantity: qty, unit, category: cat });
      continue;
    }

    const isDry = row.is_dry != null ? row.is_dry : !(
      PERISHABLE_INGREDIENTS.has(cat) ||
      ['carne', 'carrillera', 'pescado', 'pollo', 'huevo', 'leche', 'nata', 'mantequilla', 'verdura', 'fruta']
        .some(k => name.toLowerCase().includes(k))
    );

    if (isDry) {
      dryGoods.push({ productName: name, quantity: qty, unit, category: cat });
    } else {
      perishableGoods.push({ productName: name, quantity: qty, unit, category: cat });
    }
  }

  return {
    eventName: ev.client_name,
    eventDate,
    venueType,
    includesEquipmentTransport,
    // En el local el equipamiento ya está in situ: no es lista de transporte.
    equipment: includesEquipmentTransport ? [...equipment, ...ingredientEquipment] : [],
    dryGoods,
    perishableGoods,
    disposables,
    dateConflicts: sameDayEvents.rows.map((r: any) => ({
      eventId: r.id,
      eventName: r.client_name,
      date: r.event_date,
    })),
  };
}