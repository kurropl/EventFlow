/**
 * EventFlow — Single Quote API
 * GET /api/quotes/[id]       — Get quote details
 * PUT /api/quotes/[id]       — Update quote (price, status)
 *                            When status → 'accepted': creates event_order + payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { calcMesas, calcCamareros, type ServiceType } from '@/lib/operations';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quote = await querySingle<any>(
      `SELECT q.*, e.*, e.id AS event_id, e.status AS event_status
       FROM quotes q JOIN events e ON e.id = q.event_id
       WHERE q.id = $1`, [params.id]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    return NextResponse.json({ data: quote });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { base_pvp, bar_price, extras_pvp, extras_cost, iva_pct, status, notes } = body;

    // When accepting, create event_order + payments in a transaction
    if (status === 'accepted') {
      // Validate: can only accept quotes in 'sent' or 'draft' status
      const quoteForCheck = await querySingle<any>(
        `SELECT status, valid_until FROM quotes WHERE id = $1`, [params.id]
      );
      if (!quoteForCheck) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
      if (quoteForCheck.status === 'accepted') {
        return NextResponse.json({ error: 'El presupuesto ya fue aceptado' }, { status: 400 });
      }
      if (quoteForCheck.status === 'rejected' || quoteForCheck.status === 'cancelled') {
        return NextResponse.json({ error: `No se puede aceptar un presupuesto ${quoteForCheck.status}` }, { status: 400 });
      }
      if (quoteForCheck.valid_until && new Date(quoteForCheck.valid_until) < new Date()) {
        return NextResponse.json({ error: 'El presupuesto ha expirado' }, { status: 400 });
      }

      const result = await transaction(async (client) => {
        // Get the quote with event data
        const quoteRow = (await client.query(
          `SELECT q.*, e.guest_count, e.event_date, e.total_pvp, e.bar_price, e.iva_pct, e.service_type
           FROM quotes q JOIN events e ON e.id = q.event_id
           WHERE q.id = $1`, [params.id]
        )).rows[0];

        if (!quoteRow) throw new Error('Quote not found');

        // Check if event_order already exists
        const existingOrder = (await client.query(
          `SELECT id FROM event_orders WHERE quote_id = $1 LIMIT 1`, [params.id]
        )).rows[0];

        if (existingOrder) {
          // Just update the quote status
          const updated = (await client.query(
            `UPDATE quotes SET status = 'accepted', accepted_at = now() WHERE id = $1 RETURNING *`,
            [params.id]
          )).rows[0];
          return { quote: updated, eventOrder: null, payments: [] };
        }

        // Update quote status
        const updatedQuote = (await client.query(
          `UPDATE quotes SET status = 'accepted', accepted_at = now() WHERE id = $1 RETURNING *`,
          [params.id]
        )).rows[0];

        // Update event status + totals
        await client.query(
          `UPDATE events SET status = 'accepted', total_pvp = $2, total_cost = $3 WHERE id = $1`,
          [quoteRow.event_id, updatedQuote.total_pvp, updatedQuote.total_cost]
        );

        const guests = Number(quoteRow.guest_count) || 0;
        const pvpTotal = Number(updatedQuote.total_pvp) || 0;
        const costTotal = Number(updatedQuote.total_cost) || 0;
        const serviceType: ServiceType = quoteRow.service_type === 'coctel' ? 'coctel' : 'menu';
        const tablesSuggested = Math.max(1, calcMesas(guests));
        const waitersSuggested = Math.max(1, calcCamareros(guests, serviceType));

        // Get client_id + selected_items from event
        const eventRow = (await client.query(
          `SELECT client_id, selected_items FROM events WHERE id = $1`, [quoteRow.event_id]
        )).rows[0];

        // Create event_order
        const eventOrder = (await client.query(
          `INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, final_price, status,
            extra_consumptions, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
           VALUES ($1, $2, $3, $4, $4, 'in_progress', '[]', $5, $5, $6, $6)
           RETURNING *`,
          [quoteRow.event_id, params.id, eventRow?.client_id || null, pvpTotal, tablesSuggested, waitersSuggested]
        )).rows[0];

        // Create payments: 40% deposit + 60% final
        const payments: any[] = [];

        // Deposit (40%, due in 7 days)
        const depositAmount = Math.round(pvpTotal * 0.4 * 100) / 100;
        const depositDue = new Date();
        depositDue.setDate(depositDue.getDate() + 7);
        const deposit = (await client.query(
          `INSERT INTO payments (event_id, concept, amount, due_date, paid)
           VALUES ($1, 'Señal (40% del presupuesto)', $2, $3::date, false)
           RETURNING *`,
          [quoteRow.event_id, depositAmount, depositDue.toISOString().split('T')[0]]
        )).rows[0];
        payments.push(deposit);

        // Final payment (60%, due on event date)
        const finalAmount = Math.round(pvpTotal * 0.6 * 100) / 100;
        const eventDateStr = quoteRow.event_date
          ? new Date(quoteRow.event_date).toISOString().split('T')[0]
          : depositDue.toISOString().split('T')[0];
        const finalPayment = (await client.query(
          `INSERT INTO payments (event_id, concept, amount, due_date, paid)
           VALUES ($1, 'Saldo (60% del presupuesto)', $2, $3::date, false)
           RETURNING *`,
          [quoteRow.event_id, finalAmount, eventDateStr]
        )).rows[0];
        payments.push(finalPayment);

        // Generate client_token for guest form access
        const { v4: uuidv4 } = await import('uuid');
        const clientToken = uuidv4();
        await client.query(
          `UPDATE events SET client_token = $1 WHERE id = $2`,
          [clientToken, quoteRow.event_id]
        );

        // Generate escandallo (shopping items) — ingrediente ÚNICO por id (FR-S05).
        // Preferimos la receta (recipe_items, sistema canónico B) con su coste teórico;
        // si no hay receta, caemos al JSONB del catálogo resolviendo el ingrediente por
        // nombre contra la tabla `ingredients` para arrastrar id y proveedor.
        const selectedItems = eventRow?.selected_items || [];

        // unidad nativa del ingrediente → factores a las columnas de dimensión (base)
        const dimsFor = (unit: string) => {
          const u = (unit || '').toLowerCase();
          if (u === 'kg') return { grams: 1000, units: 0, ml: 0 };
          if (u === 'g' || u === 'gr') return { grams: 1, units: 0, ml: 0 };
          if (u === 'l') return { grams: 0, units: 0, ml: 1000 };
          if (u === 'ml') return { grams: 0, units: 0, ml: 1 };
          return { grams: 0, units: 1, ml: 0 }; // ud, docena, caja…
        };

        const insertShopping = async (p: {
          ingredientId: string | null; name: string; provider: string | null;
          unit: string; qtyNative: number; estimatedCost: number | null; category: string | null;
        }) => {
          const f = dimsFor(p.unit);
          const grams = f.grams * p.qtyNative;
          const units = Math.round(f.units * p.qtyNative);
          const ml = f.ml * p.qtyNative;
          const dimension = grams ? 'mass' : ml ? 'volume' : 'count';
          await client.query(
            `INSERT INTO event_shopping_items
              (event_id, order_id, ingredient_id, ingredient_name, provider_name,
               total_grams, total_units, total_ml, unit_dimension,
               theoretical_qty, theoretical_unit, estimated_cost, category, completed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false)`,
            [quoteRow.event_id, eventOrder.id, p.ingredientId, p.name, p.provider,
             grams, units, ml, dimension, p.qtyNative, p.unit, p.estimatedCost, p.category]
          );
        };

        for (const item of selectedItems) {
          const raciones = Number(item.quantity) || 1;
          const itemName = (item.name || '').trim();

          const catItem = (await client.query(
            `SELECT id, ingredients, category FROM catalog_items WHERE name ILIKE $1 AND active = true`,
            [itemName]
          )).rows[0];
          const dishCategory = catItem?.category || item.category || null;

          // 1) Receta canónica (sistema B): recipe_items + ingredients
          let usedRecipe = false;
          if (catItem?.id) {
            const recipe = (await client.query(
              `SELECT ri.quantity, i.id AS ingredient_id, i.name, i.unit, i.unit_cost, i.supplier
               FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
               WHERE ri.catalog_item_id = $1`,
              [catItem.id]
            )).rows;
            if (recipe.length > 0) {
              usedRecipe = true;
              for (const r of recipe) {
                // coste teórico: qty(receta, en unidad del ingrediente) × raciones × coste/unidad
                const qtyNative = (Number(r.quantity) || 0) * raciones;
                const estimated = r.unit_cost != null
                  ? Math.round(qtyNative * Number(r.unit_cost) * 100) / 100
                  : null;
                await insertShopping({
                  ingredientId: r.ingredient_id, name: r.name, provider: r.supplier || null,
                  unit: r.unit, qtyNative, estimatedCost: estimated, category: dishCategory,
                });
              }
            }
          }

          // 2) Fallback: JSONB del catálogo (sistema A) resolviendo por nombre
          if (!usedRecipe) {
            let ingredients: any[] = [];
            if (catItem?.ingredients) {
              try {
                ingredients = typeof catItem.ingredients === 'string'
                  ? JSON.parse(catItem.ingredients) : catItem.ingredients;
              } catch { ingredients = []; }
            }
            if (ingredients.length > 0) {
              for (const ing of ingredients) {
                const name = (ing.name || 'Sin nombre').trim();
                const ingRow = (await client.query(
                  `SELECT id, supplier FROM ingredients WHERE name ILIKE $1 LIMIT 1`, [name]
                )).rows[0];
                // El JSONB ya viene en g / ml / count: lo tratamos como unidad base.
                const g = Number(ing.grams) || 0, mlv = Number(ing.ml) || 0, c = Number(ing.count) || 0;
                const unit = g > 0 ? 'g' : mlv > 0 ? 'ml' : 'ud';
                const qtyNative = (g > 0 ? g : mlv > 0 ? mlv : c) * raciones;
                await insertShopping({
                  ingredientId: ingRow?.id || null, name, provider: ingRow?.supplier || null,
                  unit, qtyNative, estimatedCost: null, category: dishCategory,
                });
              }
            } else {
              await insertShopping({
                ingredientId: null, name: itemName, provider: null,
                unit: 'ud', qtyNative: raciones, estimatedCost: null, category: dishCategory,
              });
            }
          }
        }

        // ── Auto-generate staffing lines ──
        const existingStaffing = (await client.query(
          `SELECT 1 FROM staffing_lines WHERE event_id = $1 LIMIT 1`, [quoteRow.event_id]
        )).rows[0];

        if (!existingStaffing && guests > 0) {
          const camareros = calcCamareros(guests, serviceType);
          const cocineros = Math.ceil(guests / 30);
          const metres = Math.max(1, Math.ceil(guests / 40));

          const roles = [
            { role: 'camarero', slots: camareros },
            { role: 'cocinero', slots: cocineros },
            { role: 'metre', slots: metres },
          ];

          for (const r of roles) {
            await client.query(
              `INSERT INTO staffing_lines (event_id, role, slots_needed, notes, status)
               VALUES ($1, $2, $3, 'Auto-generado al aceptar presupuesto', 'open')`,
              [quoteRow.event_id, r.role, r.slots]
            );
          }
        }

        // Update lead status
        const leadId = quoteRow.lead_id;
        if (leadId) {
          await client.query(
            `UPDATE leads SET status = 'presupuestado' WHERE id = $1`,
            [leadId]
          );
        }

        // ── Stock check: warn if insufficient stock ──
        const stockWarnings: Array<{ ingredient_name: string; needed: number; available: number; unit: string; deficit: number }> = [];
        try {
          const eventItems = (await client.query(
            `SELECT ingredient_name, SUM(total_grams) as grams, SUM(total_units) as units, SUM(total_ml) as ml
             FROM event_shopping_items WHERE event_id = $1 GROUP BY ingredient_name`,
            [quoteRow.event_id]
          )).rows;

          for (const ei of eventItems) {
            const ing = (await client.query(
              `SELECT id, name, unit, quantity FROM ingredients WHERE name ILIKE $1 AND active = true`,
              [ei.ingredient_name]
            )).rows[0];
            if (!ing) continue;

            const unit = (ing.unit || '').toLowerCase();
            const available = Number(ing.quantity) || 0;
            let needed = 0;
            if (unit === 'g' || unit === 'gr') needed = Number(ei.grams) || 0;
            else if (unit === 'kg') needed = (Number(ei.grams) || 0) / 1000;
            else if (unit === 'ml') needed = Number(ei.ml) || 0;
            else if (unit === 'l') needed = (Number(ei.ml) || 0) / 1000;
            else needed = Number(ei.units) || 0;

            if (needed > available) {
              stockWarnings.push({
                ingredient_name: ei.ingredient_name,
                needed: Math.round(needed * 100) / 100,
                available: Math.round(available * 100) / 100,
                unit: ing.unit,
                deficit: Math.round((needed - available) * 100) / 100,
              });
            }
          }
        } catch { /* stock check is best-effort, don't fail the accept */ }

        return { quote: updatedQuote, eventOrder, payments, clientToken, stockWarnings };
      });

      return NextResponse.json({ success: true, data: result.quote, eventOrder: result.eventOrder, payments: result.payments, stockWarnings: result.stockWarnings });
    }

    // Non-accepting update: just update the quote
    const quote = await querySingle<any>(
      `UPDATE quotes SET
        base_pvp = COALESCE($1, base_pvp),
        bar_price = COALESCE($2, bar_price),
        extras_pvp = COALESCE($3, extras_pvp),
        extras_cost = COALESCE($4, extras_cost),
        iva_pct = COALESCE($5, iva_pct),
        status = COALESCE($6, status),
        notes = COALESCE($7, notes),
        sent_at = CASE WHEN $6 = 'sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
        accepted_at = CASE WHEN $6 = 'accepted' AND accepted_at IS NULL THEN now() ELSE accepted_at END
       WHERE id = $8 RETURNING *`,
      [base_pvp ?? null, bar_price ?? null, extras_pvp ?? null, extras_cost ?? null,
       iva_pct ?? null, status || null, notes !== undefined ? notes : null, params.id]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    // Send email when quote is sent to client
    if (status === 'sent' && quote.total_pvp) {
      try {
        const event = await querySingle<any>(`SELECT client_name, client_email FROM events WHERE id = $1`, [quote.event_id]);
        if (event?.client_email) {
          const { sendEmail, templates } = await import('@/lib/email');
          const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-ES') : 'No especificada';
          const tpl = await templates.quoteSent(event.client_name, event.client_email, quote.id, Number(quote.total_pvp), validUntil);
          await sendEmail({ to: event.client_email, subject: tpl.subject, html: tpl.html });
        }
      } catch (e) {
        console.warn('[EMAIL] Failed to send quote email:', e);
      }
    }

    // S2.3: Auto-sync lead status ↔ quote status
    if (status && ['sent', 'accepted'].includes(status)) {
      try {
        const event = await querySingle<any>(`SELECT lead_id FROM events WHERE id = $1`, [quote.event_id]);
        if (event?.lead_id) {
          const leadStatusMap: Record<string, string> = {
            sent: 'presupuestado',
            accepted: 'confirmado',
          };
          const newLeadStatus = leadStatusMap[status];
          if (newLeadStatus) {
            await querySingle(
              `UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2`,
              [newLeadStatus, event.lead_id]
            );
          }
        }
      } catch (e) {
        console.warn('[SYNC] Failed to sync lead status:', e);
      }
    }

    return NextResponse.json({ data: quote });
  } catch (error) {
    console.error('[quotes PUT] error:', error);
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
