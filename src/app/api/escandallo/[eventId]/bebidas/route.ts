/**
 * EventFlow — Drink Calculator API (Bebidas automáticas + Margen/PVP)
 * 
 * GET  /api/escandallo/[eventId]/bebidas — Obtener config + cálculo
 * PUT  /api/escandallo/[eventId]/bebidas — Guardar config
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

interface DrinkCalculation {
  tipo: string;
  nombre: string;
  cantidad_total: number;
  unidad: string;
  paquetes_necesarios: number;
  coste_total: number;
}

function calculateDrinks(
  pax: number,
  config: any,
  products: any[]
): DrinkCalculation[] {
  const bebedores = Math.round(pax * (config.pct_bebedores / 100));
  const total_bebidas = Math.round(bebedores * config.bebidas_por_persona);
  
  const results: DrinkCalculation[] = [];
  
  // Distribución por tipo
  const distribucion = [
    { tipo: 'vino', pct: config.pct_vino },
    { tipo: 'cerveza', pct: config.pct_cerveza },
    { tipo: 'refresco', pct: config.pct_refresco },
    { tipo: 'agua', pct: config.pct_agua },
  ];
  
  for (const dist of distribucion) {
    const bebidas_tipo = Math.round(total_bebidas * (dist.pct / 100));
    if (bebidas_tipo <= 0) continue;
    
    // Buscar producto más barato de este tipo
    const prod = products
      .filter(p => p.tipo === dist.tipo && p.active)
      .sort((a, b) => a.coste_unitario - b.coste_unitario)[0];
    
    if (!prod) continue;
    
    const paquetes = Math.ceil(bebidas_tipo / prod.unidades_por_paquete);
    const coste = paquetes * prod.coste_unitario;
    
    results.push({
      tipo: dist.tipo,
      nombre: prod.nombre,
      cantidad_total: bebidas_tipo,
      unidad: dist.tipo === 'cerveza' ? 'latas' : dist.tipo === 'agua' ? 'vasos' : 'copas',
      paquetes_necesarios: paquetes,
      coste_total: coste,
    });
  }
  
  // Café
  if (config.cafe_por_persona) {
    const prod = products.find(p => p.tipo === 'cafe' && p.active);
    if (prod) {
      const cafes = pax;
      const paquetes = Math.ceil(cafes / prod.unidades_por_paquete);
      results.push({
        tipo: 'cafe',
        nombre: prod.nombre,
        cantidad_total: cafes,
        unidad: 'tazas',
        paquetes_necesarios: paquetes,
        coste_total: paquetes * prod.coste_unitario,
      });
    }
  }
  
  // Hielo
  if (config.hielo_por_persona > 0) {
    const prod = products.find(p => p.tipo === 'hielo' && p.active);
    if (prod) {
      const total_hielo = pax * config.hielo_por_persona;
      const sacos = Math.ceil(total_hielo / (prod.unidades_por_paquete * 2)); // 2kg por saco
      results.push({
        tipo: 'hielo',
        nombre: prod.nombre,
        cantidad_total: total_hielo,
        unidad: 'kg',
        paquetes_necesarios: sacos,
        coste_total: sacos * prod.coste_unitario,
      });
    }
  }
  
  return results;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const { eventId } = await params;
    
    // Get or create config
    let config = await querySingle<any>(
      "SELECT * FROM event_drink_config WHERE event_id = $1",
      [eventId]
    );
    
    if (!config) {
      // Create default config
      config = await querySingle<any>(
        `INSERT INTO event_drink_config (event_id) VALUES ($1) RETURNING *`,
        [eventId]
      );
    }
    
    // Get event pax
    const event = await querySingle<any>(
      "SELECT guest_count FROM events WHERE id = $1",
      [eventId]
    );
    
    const pax = event?.guest_count || 100;
    
    // Get drink products
    const products = await queryMany<any>(
      "SELECT * FROM drink_products WHERE active = true ORDER BY tipo, coste_unitario",
      []
    );
    
    // Calculate drinks
    const bebidas = calculateDrinks(pax, config, products);
    const total_bebidas = bebidas.reduce((sum, b) => sum + b.coste_total, 0);
    
    // Get escandallo cost
    const escandallo = await querySingle<any>(
      "SELECT COALESCE(SUM(el.cost_total), 0) as total FROM escandallo_lines el JOIN escandallos e ON e.id = el.escandallo_id WHERE e.event_id = $1",
      [eventId]
    );
    
    const coste_alimentos = escandallo?.total || 0;
    
    // Calculate margin
    const subtotal = coste_alimentos + total_bebidas + (config.coste_personal || 0) + (config.coste_equipamiento || 0) + (config.coste_otros || 0);
    const imprevistos = subtotal * ((config.pct_imprevistos || 5) / 100);
    const coste_total = subtotal + imprevistos;
    const margen = coste_total * ((config.pct_margen || 25) / 100);
    const pvp_total = coste_total + margen;
    const pvp_pax = pax > 0 ? pvp_total / pax : 0;
    
    return NextResponse.json({
      success: true,
      data: {
        config,
        pax,
        bebidas,
        resumen: {
          coste_alimentos,
          coste_bebidas: total_bebidas,
          coste_personal: config.coste_personal || 0,
          coste_equipamiento: config.coste_equipamiento || 0,
          coste_otros: config.coste_otros || 0,
          subtotal,
          imprevistos,
          coste_total,
          margen,
          pvp_total,
          pvp_pax,
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const { eventId } = await params;
    const body = await request.json();
    
    // Upsert config
    const config = await querySingle<any>(
      `INSERT INTO event_drink_config (event_id, pct_bebedores, bebidas_por_persona, pct_cerveza, pct_vino, pct_refresco, pct_agua, cafe_por_persona, hielo_por_persona, pct_imprevistos, pct_margen, coste_personal, coste_equipamiento, coste_otros, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (event_id) DO UPDATE SET
         pct_bebedores = EXCLUDED.pct_bebedores,
         bebidas_por_persona = EXCLUDED.bebidas_por_persona,
         pct_cerveza = EXCLUDED.pct_cerveza,
         pct_vino = EXCLUDED.pct_vino,
         pct_refresco = EXCLUDED.pct_refresco,
         pct_agua = EXCLUDED.pct_agua,
         cafe_por_persona = EXCLUDED.cafe_por_persona,
         hielo_por_persona = EXCLUDED.hielo_por_persona,
         pct_imprevistos = EXCLUDED.pct_imprevistos,
         pct_margen = EXCLUDED.pct_margen,
         coste_personal = EXCLUDED.coste_personal,
         coste_equipamiento = EXCLUDED.coste_equipamiento,
         coste_otros = EXCLUDED.coste_otros,
         updated_at = NOW()
       RETURNING *`,
      [
        eventId,
        body.pct_bebedores ?? 60,
        body.bebidas_por_persona ?? 2.5,
        body.pct_cerveza ?? 30,
        body.pct_vino ?? 50,
        body.pct_refresco ?? 15,
        body.pct_agua ?? 5,
        body.cafe_por_persona ?? true,
        body.hielo_por_persona ?? 0.5,
        body.pct_imprevistos ?? 5,
        body.pct_margen ?? 25,
        body.coste_personal ?? 0,
        body.coste_equipamiento ?? 0,
        body.coste_otros ?? 0,
      ]
    );
    
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}