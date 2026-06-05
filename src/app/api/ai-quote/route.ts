/**
 * AI Quote API — EventFlow (SECURED)
 * POST /api/ai-quote
 * 
 * Security measures:
 * - Input sanitization (strip injection patterns, control chars)
 * - Rate limiting (10 requests/minute per IP)
 * - Message length limit (500 chars)
 * - History sanitization (max 5 messages, 300 chars each)
 * - Prompt injection detection
 * - Response sanitization (no data leakage)
 * - Guardrails in system prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { CATALOG_ITEMS, PROPOSED_MENUS } from '@/data/menus';
import {
  sanitizeText,
  sanitizeHistory,
  hasPromptInjection,
  wrapWithGuardrails,
  sanitizeReply,
  checkRateLimit,
  securityHeaders,
} from '@/lib/security';

// ── Build catalog summary for the system prompt ──────────────────────
function buildCatalogSummary(): string {
  const lines: string[] = [];
  for (const menu of PROPOSED_MENUS) {
    const sections = menu.sections.map(s => `  - ${s.section}: ${s.items.join(', ')}`).join('\n');
    lines.push(`• ${menu.name} (${menu.tag}${menu.is_kid ? ' - Infantil' : ''}):\n${sections}`);
  }
  for (const [cat, items] of Object.entries(CATALOG_ITEMS)) {
    lines.push(`• Catálogo ${cat}: ${items.slice(0, 8).join(', ')}${items.length > 8 ? `... y ${items.length - 8} más` : ''}`);
  }
  return lines.join('\n');
}

// ── System prompt ────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  const catalog = buildCatalogSummary();
  return `Eres el asistente virtual de **J. Benitez**, salón de celebraciones premium en Sevilla.

## Tu identidad
- Nombre: Asistente de J. Benitez
- Saludo inicial: "¡Hola! Soy el asistente de J. Benitez. Cuéntame sobre tu evento y te preparo un presupuesto al instante."
- Tono: Cálido, profesional, cercano pero respetuoso. Siempre en español.
- Objetivo: Ayudar al cliente a calcular un presupuesto preliminar para su celebración.

## Datos del negocio
- Dirección: C. Villanueva del Ariscal 1, Umbrete, Sevilla
- Teléfono: 615 60 08 63
- Email: info@salonesjosebenitez.com
- Configurador online: https://eventcater.duckdns.org/

## Tipos de evento y precios orientativos (por comensal)
- **Boda**: 45 – 65 €/pax
- **Comunión**: 35 – 50 €/pax
- **Corporativo**: 40 – 60 €/pax
- **Bautizo**: 30 – 45 €/pax
- **Cumpleaños**: 35 – 55 €/pax

Estos rangos incluyen: aperitivo, platos principales, postre y bebidas (cava, vino, cerveza, refrescos, agua).

## Barra libre
- Precio orientativo: ~15 €/hora/persona

## Impuestos
- IVA: 10% sobre el total.

## Menús disponibles (catálogo J. Benitez)
${catalog}

## Reglas de comportamiento
1. Haz preguntas aclaratorias si falta información clave.
2. Genera un presupuesto preliminar con suficiente información.
3. Formato: desglose claro con menú, barra libre, subtotal, IVA, total.
4. NUNCA inventes platos o menús que no estén en el catálogo.
5. Invita al configurador online para personalizar.
6. Para reservas, indica teléfono/email.
7. Respuestas concisas: máximo 3-4 párrafos.
8. Responde SOLO sobre eventos y celebraciones.`;
}

// ── Parse structured data from LLM reply ─────────────────────────────
function parseStructuredData(reply: string) {
  const parsed: Record<string, string | number | undefined> = {};
  const eventLower = reply.toLowerCase();
  const eventPatterns: [RegExp, string][] = [
    [/bodas?\b/i, 'boda'],
    [/comuni[oó]n/i, 'comunión'],
    [/bautizo/i, 'bautizo'],
    [/corporativ/i, 'corporativo'],
    [/cumplea[añ]o/i, 'cumpleaños'],
  ];
  for (const [re, type] of eventPatterns) {
    if (re.test(eventLower)) { parsed.eventType = type; break; }
  }
  const guestMatch = reply.match(/(\d{1,4})\s*(comensal|invitad|persona|pax|personas)/i);
  if (guestMatch) parsed.guestCount = parseInt(guestMatch[1], 10);
  const datePatterns = [
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de?\s*(\d{4}))?/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  ];
  for (const re of datePatterns) {
    const m = reply.match(re);
    if (m) { parsed.date = m[0]; break; }
  }
  const budgetMatch = reply.match(/(?:total\s+estimado|total)[:\s]*(\d[\d.,]*)\s*€/i)
    || reply.match(/(\d[\d.,]*)\s*€/g)?.pop();
  if (budgetMatch) {
    const numStr = typeof budgetMatch === 'string'
      ? budgetMatch.replace(/[^\d]/g, '')
      : budgetMatch[1]?.replace(/[^\d]/g, '');
    if (numStr) parsed.estimatedBudget = parseInt(numStr, 10);
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

// ── POST handler ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting ─────────────────────────────────────────────
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rl = checkRateLimit(`ai-quote:${clientIp}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas peticiones. Espera un momento.' },
        { status: 429, headers: { ...securityHeaders(), 'Retry-After': '60' } }
      );
    }

    // ── Parse & validate body ────────────────────────────────────
    const body = await request.json();
    const { message, history = [] } = body as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'El campo "message" es obligatorio.' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // ── Sanitize message ─────────────────────────────────────────
    const cleanMessage = sanitizeText(message, 500);

    if (cleanMessage.length < 2) {
      return NextResponse.json(
        { success: false, error: 'El mensaje es demasiado corto.' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // ── Prompt injection detection ───────────────────────────────
    if (hasPromptInjection(cleanMessage)) {
      // Log the attempt but don't reveal detection to user
      console.warn(`[ai-quote] Prompt injection attempt from ${clientIp}: "${cleanMessage.slice(0, 100)}"`);
      return NextResponse.json({
        success: true,
        reply: 'Solo puedo ayudarte con consultas sobre eventos y celebraciones en J. Benitez. Cuéntame sobre tu celebración y te preparo un presupuesto.',
      }, { headers: securityHeaders() });
    }

    // ── Sanitize history ─────────────────────────────────────────
    const cleanHistory = sanitizeHistory(history, 5, 300);

    // ── API key check ────────────────────────────────────────────
    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL || 'https://api.nan.builders/v1';
    const model = process.env.LLM_MODEL || 'deepseek-v4-flash';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Servicio de IA no configurado.' },
        { status: 500, headers: securityHeaders() }
      );
    }

    // ── Build messages with guardrails ───────────────────────────
    const messages = [
      { role: 'system', content: wrapWithGuardrails(buildSystemPrompt()) },
      ...cleanHistory.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: cleanMessage },
    ];

    // ── Call LLM ─────────────────────────────────────────────────
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      console.error('[ai-quote] LLM API error:', res.status, errText);
      return NextResponse.json(
        { success: false, error: 'El servicio de IA no está disponible temporalmente.' },
        { status: 502, headers: securityHeaders() }
      );
    }

    const data = await res.json();
    const rawReply = data.choices?.[0]?.message?.content || '';

    if (!rawReply) {
      return NextResponse.json(
        { success: false, error: 'El servicio de IA no devolvió respuesta.' },
        { status: 502, headers: securityHeaders() }
      );
    }

    // ── Sanitize reply ───────────────────────────────────────────
    const reply = sanitizeReply(rawReply);

    // ── Parse structured data ────────────────────────────────────
    const parsed = parseStructuredData(reply);

    return NextResponse.json(
      { success: true, reply, parsed },
      { headers: securityHeaders() }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ai-quote] Error:', msg);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor.' },
      { status: 500, headers: securityHeaders() }
    );
  }
}
