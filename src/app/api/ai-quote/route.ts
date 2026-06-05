/**
 * AI Quote API — EventFlow
 * POST /api/ai-quote
 * 
 * Accepts a user message + conversation history,
 * sends it to an OpenAI-compatible LLM with a comprehensive
 * system prompt about J.Benitez catalogs and pricing,
 * and returns the AI response with optional parsed data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CATALOG_ITEMS, PROPOSED_MENUS } from '@/data/menus';

// ── Build catalog summary for the system prompt ──────────────────────
function buildCatalogSummary(): string {
  const lines: string[] = [];

  // Proposed menus
  for (const menu of PROPOSED_MENUS) {
    const sections = menu.sections.map(s => `  - ${s.section}: ${s.items.join(', ')}`).join('\n');
    lines.push(`• ${menu.name} (${menu.tag}${menu.is_kid ? ' - Infantil' : ''}):\n${sections}`);
  }

  // Catalog items (just names grouped by category)
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
- Saludo inicial: "¡Hola! Soy el asistente de J. Benitez. Cuéntame sobre tu evento y te preparo un presupuesto al instante. 🎉"
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
- Disponible como complemento para cualquier tipo de evento.

## Impuestos
- IVA: 10% sobre el total.

## Menús disponibles (catálogo J. Benitez)
${catalog}

## Reglas de comportamiento
1. **Haz preguntas aclaratorias** si falta información clave: tipo de evento, número de invitados, fecha aproximada, si desean barra libre.
2. **Genera un presupuesto preliminar** cuando tengas suficiente información (mínimo: tipo de evento + número de invitados).
3. **Formato del presupuesto**: Usa una tabla o lista clara con desglose:
   - Tipo de evento
   - Número de comensales
   - Menú orientativo (rango de precio)
   - Barra libre (si aplica)
   - Subtotal
   - IVA (10%)
   - **Total estimado**
4. **NUNCA inventes platos o menús** que no estén en el catálogo. Solo menciona los que aparecen arriba.
5. Si el cliente pregunta por un plato específico, confirma si lo tenemos o sugiere alternativas similares del catálogo.
6. Cuando proporciones un presupuesto, invita al cliente a usar el configurador online para personalizar su menú: https://eventcater.duckdns.org/
7. Si el cliente pide confirmar o reservar, indica que puede llamar al 615 60 08 63 o escribir a info@salonesjosebenitez.com.
8. Mantén las respuestas concisas pero completas. Máximo 3-4 párrafos.
9. Usa emojis con moderación para dar calidez.

## Ejemplo de respuesta con presupuesto
Cuando tengas suficiente info, responde algo como:

"¡Perfecto! Veo que es una **boda** con **120 invitados**. Aquí tienes un presupuesto orientativo:

📌 **Tipo de evento**: Boda
👥 **Comensales**: 120
🍽️ **Menú**: 45 – 65 €/pax (aperitivo, platos, postre y bebidas)
🍺 **Barra libre**: ~15 €/hora/persona (opcional)

**Desglose estimado:**
- Comensales × menú: 120 × 55€ = 6.600 €
- Barra libre (4h): 120 × 15€ × 4 = 7.200 €
- **Subtotal**: 13.800 €
- IVA (10%): 1.380 €
- **Total estimado**: 15.180 €

Este es un presupuesto orientativo. Para personalizar tu menú y ver opciones exactas, te invito a usar nuestro configurador: https://eventcater.duckdns.org/

¿Quieres que te prepare algo más detallado o tienes alguna otra pregunta? 😊";

Responde siempre de forma natural y conversacional, adaptándote al tono del cliente.`;
}

// ── Parse structured data from LLM reply ─────────────────────────────
function parseStructuredData(reply: string) {
  const parsed: Record<string, string | number | undefined> = {};

  // Event type
  const eventLower = reply.toLowerCase();
  const eventPatterns: [RegExp, string][] = [
    [/bodas?\b/i, 'boda'],
    [/comuni[oó]n/i, 'comunión'],
    [/bautizo/i, 'bautizo'],
    [/corporativ/i, 'corporativo'],
    [/cumplea[añ]o/i, 'cumpleaños'],
  ];
  for (const [re, type] of eventPatterns) {
    if (re.test(eventLower)) {
      parsed.eventType = type;
      break;
    }
  }

  // Guest count — look for numbers near "comensal", "invitado", "persona", "pax"
  const guestMatch = reply.match(/(\d{1,4})\s*(comensal|invitad|persona|pax|personas)/i);
  if (guestMatch) {
    parsed.guestCount = parseInt(guestMatch[1], 10);
  }

  // Date — look for patterns like "15 de junio", "junio 2025", "15/06/2025"
  const datePatterns = [
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de?\s*(\d{4}))?/i,
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  ];
  for (const re of datePatterns) {
    const m = reply.match(re);
    if (m) {
      parsed.date = m[0];
      break;
    }
  }

  // Budget — look for "total estimado" or "total" followed by a number with €
  const budgetMatch = reply.match(/(?:total\s+estimado|total)[:\s]*(\d[\d.,]*)\s*€/i)
    || reply.match(/(\d[\d.,]*)\s*€/g)?.pop();
  if (budgetMatch) {
    const numStr = typeof budgetMatch === 'string'
      ? budgetMatch.replace(/[^\d]/g, '')
      : budgetMatch[1]?.replace(/[^\d]/g, '');
    if (numStr) {
      parsed.estimatedBudget = parseInt(numStr, 10);
    }
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

// ── POST handler ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'El campo "message" es obligatorio.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL || 'https://api.nan.builders/v1';
    const model = process.env.LLM_MODEL || 'deepseek-v4-flash';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'LLM API key no configurada.' },
        { status: 500 }
      );
    }

    // Build messages array
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    // Call the LLM
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
        { success: false, error: `Error del servicio de IA: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return NextResponse.json(
        { success: false, error: 'El servicio de IA no devolvió respuesta.' },
        { status: 502 }
      );
    }

    // Try to parse structured data from the reply
    const parsed = parseStructuredData(reply);

    return NextResponse.json({ success: true, reply, parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ai-quote] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
