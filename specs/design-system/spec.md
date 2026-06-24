# EventFlow — Especificación del sistema de diseño (homogeneización)

> Referencia canónica para las subtareas **[UI]** de `../lifecycle-16-fases/tasks.md`.
> El diseño hoy NO es homogéneo; este doc fija el patrón único y lista los infractores.

## 1. Tokens (única fuente)
- **Paleta:** gold `#C9A84C` (+ `gold-dark #A88A3A`), cream `#F8F3E6`, ink `#1A1A1A`,
  paper `#FFFFFF`, divider `#ECECF1`, texto sec. `#6B7280`.
- **Acentos de estado** (semánticos, derivados de marca): éxito `#16A34A`, aviso
  `#D9920B`, error `#DC2626`, info `#2563EB`. Solo para chips de estado, no para chrome.
- **Acción:** definirlos en `tailwind.config.ts` (`gold`, `cream`, `ink`, `paper`,
  `divider`) y **prohibir** `stone-*`, `blue-*`, `gray-*` crudos en `src/components/b2b`.

## 2. Tipografía
- Titulares: **Playfair Display** vía clase `font-heading` (NO `style={{fontFamily}}` inline, NO `font-serif` suelto).
- Cuerpo: **Inter** (`font-body`). Todo el texto en **español con acentos**.

## 3. Primitivos obligatorios (`src/components/ui/`)
Todo panel usa: `PageHeader` (título Playfair + subtítulo + acción), `Card`
(`rounded-2xl border-divider`), `Button` (variant default = **gold**, no amber),
`StatStrip`/`DataCard` para KPIs, `DataList` para listas, `EmptyState` y `ErrorState`
(crear si falta) para vacío/error. Iconos **solo** vía `src/components/shared/Icon.tsx`.

## 4. Patrón de pantalla (todas iguales)
`<PageHeader/>` → (KPIs `StatStrip`) → contenido en `Card`(s) → estados de
**carga** (skeleton claro `bg-stone-200`… unificar a token), **vacío** (`EmptyState`)
y **error** (`ErrorState` + reintentar). Animación: framer‑motion suave y **consistente**
en todos (o en ninguno) — decidir uno y aplicarlo igual.

## 5. Inventario de infractores (de la auditoría) — qué corregir
| Problema | Severidad | Dónde (ejemplos) |
|---|---|---|
| Colores fuera de paleta (stone/blue/red/…) ~531 usos | CRÍTICO | 20+ paneles b2b; `StatusBadge.tsx`, `BillingPanel`, `LeadsCRM`, `HACCPPanel`, `CalendarView` |
| `Button` usa `bg-amber-600` (no dorado) | CRÍTICO | `src/components/ui/button.tsx` |
| `StatusBadge` con azul/rojo/morado en vez de marca | CRÍTICO | `StatusBadge.tsx` |
| 16+ paneles con markup propio en vez de primitivos | ALTO | `HACCPPanel, CocinaPanel, CalendarView, EventDetail, WebhooksPanel, BillingPanel, ClientsCRM, KanbanPipeline` |
| 43 `fontFamily` inline en vez de `font-heading` | ALTO | `AdminLayout, WebhooksPanel, KanbanPipeline`, b2c wizard |
| 2 sistemas de iconos (lucide directo vs `Icon`) | MEDIO | 20 ficheros b2b importan lucide directo; b2c con `<svg>` inline |
| framer‑motion en 14/35 paneles (inconsistente) | MEDIO | añadir/uniformar; unificar skeleton de carga |
| borde `#ECECF1` hardcodeado 120+ veces | BAJO | usar token `divider` |

## 6. Criterio de "homogéneo" (Definition of Done de UI)
- `grep -rE "(stone|gray|blue|red|amber|purple|emerald|indigo)-[0-9]" src/components/b2b` → 0 (salvo acentos de estado justificados).
- Cero `style={{ fontFamily }}` en `src/components` (usar `font-heading`).
- Todos los paneles importan de `@/components/ui` y `@/components/shared/Icon`.
- Cada panel tiene estados de carga, vacío y error visibles.
