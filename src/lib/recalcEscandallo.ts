     1|/**
     2| * EventFlow — Motor de recálculo centralizado del escandallo
     3| * 
     4| * Escala automáticamente recipe_items por guest_count cuando:
     5| * - Cambia el número de comensales
     6| * - Se asigna un plato a un evento
     7| * - Se actualiza el precio de un ingrediente
     8| */
     9|
    10|import { getPool } from '@/lib/db';
    11|
    12|interface IngredientUpdate {
    13|  ingredientId: string;
    14|  oldCost: number;
    15|  newCost: number;
    16|}
    17|
    18|/**
    19| * Recalcula el escandallo de un evento completo
    20| * - Escala recipe_items por guest_count
    21| * - Actualiza theoretical_qty en event_shopping_items
    22| * - Actualiza event_costs
    23| * - Marca los items no congelados
    24| */
    25|export async function recalcEventEscandallo(
    26|  eventId: string,
    27|  guestCount?: number
    28|): Promise<void> {
  const { pool } = await import('@/lib/db');
    30|
    31|  const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    32|  if (!event.rows.length) return;
    33|  
    34|  const gc = guestCount ?? Number(event.rows[0].guest_count) ?? 1;
    35|  
    36|  // Recalcular todos los event_shopping_items con recipe_item_id
    37|  await pool.query(
    38|    `UPDATE event_shopping_items esi
    39|     SET theoretical_qty = (
    40|       SELECT COALESCE(ri.quantity_override, ri.quantity) * $1
    41|       FROM recipe_items ri
    42|       WHERE ri.id = esi.recipe_item_id AND ri.catalog_item_id IS NOT NULL
    43|     ),
    44|     theoretical_unit = (
    45|       SELECT ri.unit FROM recipe_items ri WHERE ri.id = esi.recipe_item_id
    46|     ),
    47|     estimated_cost = (
    48|       SELECT theoretical_qty * (
    49|         SELECT COALESCE(cost_per_unit, 0) FROM ingredients WHERE id = esi.ingredient_id
    50|       )
    51|       FROM recipe_items ri WHERE ri.id = esi.recipe_item_id
    52|     )
    53|     WHERE esi.event_id = $2
    54|       AND esi.frozen = false
    55|       AND esi.recipe_item_id IS NOT NULL`,
    56|    [gc, eventId]
    57|  );
    58|}
    59|
    60|/**
    61| * Recalcula el coste estimado de todos los eventos que usan
    62| * un ingrediente concreto (propagación de precio)
    63| */
    64|export async function propagatePriceToAllEvents(
    65|  ingredientId: string,
    66|  oldCost: number,
    67|  newCost: number
    68|): Promise<number> {
  const { pool } = await import('@/lib/db');
    70|
    71|  // Registrar en historial
    72|  await pool.query(
    73|    `INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by)
    74|     VALUES ($1, $2, $3, 'system')`,
    75|    [ingredientId, oldCost, newCost]
    76|  );
    77|
    78|  // Actualizar precio del ingrediente
    79|  await pool.query(
    80|    `UPDATE ingredients SET unit_cost = $1 WHERE id = $2`,
    81|    [newCost, ingredientId]
    82|  );
    83|
    84|  // Contar eventos afectados
    85|  const result = await pool.query(
    86|    `SELECT COUNT(DISTINCT event_id) AS affected
    87|     FROM event_shopping_items
    88|     WHERE ingredient_id = $1 AND frozen = false`,
    89|    [ingredientId]
    90|  );
    91|
    92|  return Number(result.rows[0]?.affected) || 0;
    93|}
    94|
    95|/**
    96| * Verifica si algún plato del evento ha caído por debajo del
    97| * margen mínimo después de un cambio de precio
    98| */
    99|export async function checkMarginAlerts(
   100|  eventId: string,
   101|  minMarginPct: number = 15
   102|): Promise<{ itemId: string; catalogItemId: string; currentMargin: number; below: boolean }[]> {
  const { pool } = await import('@/lib/db');
   104|
   105|  const result = await pool.query(
   106|    `SELECT esi.id AS item_id, ci.id AS catalog_id,
   107|            (ci.pvp - esi.estimated_cost) / NULLIF(ci.pvp, 0) * 100 AS current_margin
   108|     FROM event_shopping_items esi
   109|     JOIN recipe_items ri ON ri.id = esi.recipe_item_id
   110|     JOIN catalog_items ci ON ci.id = ri.catalog_item_id
   111|     WHERE esi.event_id = $1
   112|       AND esi.frozen = false
   113|       AND esi.estimated_cost > 0
   114|       AND (ci.pvp - esi.estimated_cost) / NULLIF(ci.pvp, 0) * 100 < $2`,
   115|    [eventId, minMarginPct]
   116|  );
   117|
   118|  return result.rows.map((row: any) => ({
   119|    itemId: row.item_id,
   120|    catalogItemId: row.catalog_id,
   121|    currentMargin: Number(row.current_margin),
   122|    below: true,
   123|  }));
   124|}
   125|
   126|/**
   127| * Congela el escandallo de un evento y calcula la desviación final
   128| */
   129|export async function freezeEventEscandallo(
   130|  eventId: string
   131|): Promise<{
   132|  deviationAmount: number;
   133|  deviationPct: number;
   134|  estimatedTotal: number;
   135|  actualTotal: number;
   136|}> {
  const { pool } = await import('@/lib/db');
   138|
   139|  // Marcar congelado
   140|  await pool.query(
   141|    `UPDATE event_shopping_items SET frozen = true WHERE event_id = $1`,
   142|    [eventId]
   143|  );
   144|
   145|  // Calcular total estimado
   146|  const estimated = await pool.query(
   147|    `SELECT COALESCE(SUM(estimated_cost), 0) AS total
   148|     FROM event_shopping_items WHERE event_id = $1`,
   149|    [eventId]
   150|  );
   151|
   152|  // Calcular total real
   153|  const actual = await pool.query(
   154|    `SELECT COALESCE(SUM(actual_cost_total), 0) AS total
   155|     FROM event_shopping_items WHERE event_id = $1`,
   156|    [eventId]
   157|  );
   158|
   159|  const estimatedTotal = Number(estimated.rows[0]?.total) || 0;
   160|  const actualTotal = Number(actual.rows[0]?.total) || 0;
   161|  const deviation = actualTotal - estimatedTotal;
   162|  const pct = estimatedTotal > 0 ? (deviation / estimatedTotal) * 100 : 0;
   163|
   164|  // Guardar en tabla de desviaciones
   165|  await pool.query(
   166|    `INSERT INTO event_cost_deviations
   167|     (event_id, estimated_total_cost, actual_total_cost, deviation_amount, deviation_pct)
   168|     VALUES ($1, $2, $3, $4, $5)`,
   169|    [eventId, estimatedTotal, actualTotal, deviation, Math.round(pct * 100) / 100]
   170|  );
   171|
   172|  return {
   173|    deviationAmount: deviation,
   174|    deviationPct: pct,
   175|    estimatedTotal,
   176|    actualTotal,
   177|  };
   178|}