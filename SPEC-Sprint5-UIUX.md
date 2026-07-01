# SPEC · Sprint 5 — Auditoría y unificación UI/UX

**Metodología:** SDD. Este documento describe el QUÉ, el PORQUÉ y el CÓMO. **No se ha tocado código** — FASE 1 (especificación + hallazgos), a la espera de revisión y aprobación explícita antes de implementar (FASE 3).

**Origen:** con los 14 gaps del Gap Analysis cerrados (Sprint 4), auditoría solicitada del frontend completo: (1) unificar el sistema de diseño, (2) asegurar que la UI expone y permite usar toda la lógica de backend de los Sprints 1-4, (3) traducir/adaptar cualquier texto en inglés.

**Método:** 3 agentes de auditoría en paralelo — consistencia visual, cobertura de UI sobre backend, e idioma — sobre ~35 ficheros de `src/app/admin/**`, `src/components/{b2b,b2c,shared,ui}/**` y los flujos públicos (`configurador`, `presupuesto`, `evento`, `invitados`, `contrato`).

---

## 0. Resumen ejecutivo

- **Sistema de diseño**: existe un embrión de design system real (`src/components/ui/` con `Button`/`Card`/`Badge`/`PageHeader`/`DataCard`/`EmptyState`, basado en `cva` + tokens de `tailwind.config.ts`), adoptado consistentemente por 6 paneles (Catalog, Clientes, Leads, Staffing, Stock, Operations) — pero **ignorado por otros 5-8** (Trazabilidad, EventDetail, Billing, Kanban, Providers, y las páginas `rentabilidad`/`confirmacion`/`config`), que reinventan su propio color/spacing/tipografía con hex arbitrarios. Incluso el propio `ui/button.tsx` usa `amber-600` en vez del dorado de marca (`#C9A84C`) que domina el resto de la app — el "design system" está internamente descoordinado con la marca.
- **Cobertura de UI sobre backend**: confirmado un backlog real y esperado (acordado desde el inicio del ciclo: "backend primero, UI después"). **10 capacidades de los Sprints 1-4 no tienen ningún control de UI**, o lo tienen parcial/enterrado. Ninguna es sorprendente — es exactamente el trabajo que quedaba pendiente.
- **Traducción**: al contrario que los dos puntos anteriores, aquí el hallazgo es tranquilizador — la app ya está **mayoritariamente en español, de forma consistente**. Solo 3 puntos concretos, ninguno grave.

---

## 1. Sistema de diseño — hallazgos detallados

### 1.1 Color
| Rol semántico | Variantes encontradas | Ficheros |
|---|---|---|
| Texto principal ("ink") | `#1A1A1A` (mayoritario) / `#1A1A2E` / `#1A1208` / `text-stone-800/900` | CatalogCRUD, ClientsCRM, StockManager, AdminLayout vs. LeadsCRM, BillingPanel vs. rentabilidad/page.tsx vs. TrazabilidadPanel, confirmacion/page.tsx |
| Dorado de marca / acción primaria | `#C9A84C` (raw hex, mayoritario) vs. Tailwind `amber-600`/`amber-700` | StockManager, StaffingManager, CatalogCRUD, AdminLayout vs. `ui/button.tsx` (variante `default`), TrazabilidadPanel |
| Éxito/aviso/peligro (badges) | `DataCard.tsx`: `#15803D`/`#B45309` vs. `StaffingManager.tsx`: `#16A34A`/`#D97706`/`#F59E0B` (3ª variante para "pendiente") vs. `ProvidersManager.tsx`: `bg-green-500`/`bg-red-400` (Tailwind puro, sin hex) | — |
| Texto secundario/muted | `#6B7280`/`#9CA3AF` (raw hex) vs. `text-stone-500/600` vs. `text-gray-500/600` | ClientsCRM, KanbanPipeline, BillingPanel, LeadsCRM, CatalogCRUD vs. TrazabilidadPanel (30+ veces), EventDetail vs. OperationsManager, ProvidersManager |
| Error/validación | `#DC2626` (raw hex) vs. `text-red-500/600/700` | StockManager, StaffingManager, ClientsCRM vs. TrazabilidadPanel |

### 1.2 Espaciado
- Padding de "tarjeta" sin regla aparente, incluso dentro del mismo fichero: `StaffingManager.tsx` mezcla `p-4`, `p-5` y `p-12` para contenedores estructuralmente iguales.
- `ui/card.tsx` (primitivo compartido) usa `p-6` por defecto, pero casi ningún panel lo usa — cuando `LeadsCRM.tsx` sí lo usa, mezcla `p-6`/`p-4`/`p-3` para secciones similares del mismo modal.
- `gap` de filas de botones sin convención: `gap-2`/`gap-3`/`gap-4` intercambiados sin patrón.

### 1.3 Tipografía (títulos de página)
4 combinaciones distintas para lo que estructuralmente es siempre "título de página", y 3 mecanismos distintos para aplicar la fuente serif de marca:
- `rentabilidad/page.tsx`: `text-2xl font-serif font-bold` + hex propio
- `confirmacion/page.tsx`: `text-xl font-bold` — sin serif
- `BillingPanel.tsx`: `text-xl font-bold` — sin serif
- `TrazabilidadPanel.tsx` / `config/page.tsx` / `StockManager.tsx`: `text-2xl`/`text-xl` + **`style={{fontFamily:"'Playfair Display'..."}}` inline**, redundante con el `font-heading` ya definido en `tailwind.config.ts` (que casi nadie usa — solo `ui/card.tsx:38`)
- `PageHeader.tsx` (el único primitivo compartido de título): también usa el inline `style`, no la clase `font-heading`

### 1.4 Estado de componentes
- **Loading**: sin spinner/skeleton compartido — cada fichero inventa el suyo (`"Cargando..."`, `"Cargando rentabilidad..."`, un div de spinner con borde dorado hardcodeado, o el `PanelSkeleton` de `admin/page.tsx`, que nadie más reutiliza).
- **Empty state**: existe `ui/EmptyState.tsx` pero solo lo usan 2 de los ficheros muestreados (`CocinaPanel`, `TrazabilidadPanel`) — el resto hardcodea su propio mensaje/markup (`KanbanPipeline`, `ProvidersManager`, `BillingPanel`, `EventDetail`, cada uno con texto y estructura distintos).
- **Botones deshabilitados**: opacidad sin estandarizar — `disabled:opacity-30`, `-40`, `-50` (la que usa el propio `ui/button.tsx`), `-60` (la más repetida en el código hand-rolled). `cursor-not-allowed` solo se empareja explícitamente en 5 sitios de toda la muestra.

### 1.5 Veredicto
No es "cada página por su cuenta" total, pero tampoco hay un sistema único: son **dos sistemas de diseño coexistiendo** (uno moderno con primitivos tipados en `ui/`, adoptado por ~6 paneles; otro heredado con hex sueltos, en ~8 paneles/páginas más) — y encima el sistema "moderno" tiene su propio color de marca mal configurado (`amber-600` en vez de `gold`).

---

## 2. Sistema de diseño — plan de unificación propuesto

**Principio: una sola fuente de verdad en `tailwind.config.ts`, todo lo demás la consume — nunca más un hex suelto en un componente.**

1. **Tokens de color** (`tailwind.config.ts`, ya existen `ink`/`gold`/`cream`/`paper`/`burgundy` — se completan):
   - Mantener `ink.DEFAULT = #1a1a1a` y `gold.DEFAULT = #c9a84c` (ya son los valores dominantes reales de la marca — no se inventan, se consolidan).
   - Añadir tokens que hoy faltan y se resuelven ad-hoc: `success = #15803D`, `warning = #B45309` (adoptando los valores que ya usa `DataCard.tsx`, el sitio con más disciplina), `danger = #DC2626` (el valor ya dominante para errores).
   - `ink.soft` ya existe para texto secundario (`#6b6158` + variantes de opacidad) — se usa como único muted en vez de `stone-500`/`gray-500`/hex sueltos.
2. **`ui/button.tsx`**: variante `default` pasa de `bg-amber-600` a `bg-gold text-ink hover:bg-gold-dark` (ya existe `gold.dark` en el config) — el primitivo compartido se alinea con la marca en vez de al revés.
3. **Tipografía**: `PageHeader.tsx` deja de usar `style={{fontFamily:...}}` inline y pasa a la clase `font-heading` ya definida en el config; **todas las páginas/paneles pasan a renderizar su título vía `PageHeader`** (hoy varios lo hacen a mano) — un único punto de verdad para tamaño/peso/fuente de título.
4. **Espaciado**: convención documentada (comentario en `ui/card.tsx`) — `p-6` para tarjetas de sección de primer nivel, `p-4` para tarjetas anidadas/compactas; se aplica al tocar cada fichero (no es un sprint de refactor de espaciado en sí, se corrige de paso al migrar cada panel).
5. **Estados**:
   - Nuevo `ui/Spinner.tsx` (o extender `EmptyState.tsx` con un modo `loading`) — sustituye todos los `"Cargando..."` ad-hoc.
   - `ui/EmptyState.tsx` pasa a usarse en los 5+ sitios que hoy lo hardcodean.
   - `disabled:opacity-50` como único valor en toda la base (es el que ya trae `ui/button.tsx` de fábrica) — se corrige donde diverge (`-30`/`-40`/`-60`).
6. **Migración de paneles al `ui/` existente**: `TrazabilidadPanel`, `EventDetail`, `BillingPanel`, `KanbanPipeline`, `ProvidersManager`, y las páginas `rentabilidad`/`confirmacion`/`config` pasan a construirse sobre `PageHeader`/`Card`/`Badge`/`EmptyState` en vez de hex + divs a mano. Esto es lo que más ficheros toca — se hace panel por panel con verificación visual entre medias (Playwright, como ya se hizo con la firma de contrato en Sprint 3), no todo de una vez.

---

## 3. Cobertura de UI sobre lógica de backend — hallazgos y plan

| # | Capacidad (sprint) | Estado hoy | Backend | Plan de UI |
|---|---|---|---|---|
| 1 | Selector de salón (Arriba/Abajo/Externo) | **Inexistente** | `PUT /api/events/[id]` (`venue`/`venue_id`, 409 si choca) | Selector en la ficha de evento (`EventDetail.tsx`), 3 opciones, muestra error 409 si el salón ya está reservado ese día |
| 2 | Margen real con coste de personal | **Inexistente** | `GET /api/rentabilidad` ya devuelve `laborCostPaid/Total/Pending`, `totalCostFull` | `rentabilidad/page.tsx` añade estas columnas/desglose a la tabla existente |
| 3 | Aviso de falta de stock al aceptar | **Parcial** (modal post-hoc en LeadsCRM, solo informativo) | `quotes/[id]` PUT → `stockWarnings` | Mismo aviso, pero también en el posible flujo de aceptación desde Kanban si existe; queda como aviso no bloqueante salvo que `block_accept_on_stock_shortage` esté activo (ítem 4) |
| 4 | Toggle `block_accept_on_stock_shortage` | **Inexistente** | `business_settings.block_accept_on_stock_shortage` | Checkbox nuevo en `config/page.tsx` |
| 5 | Botón "Generar contrato" | **Inexistente** | `POST /api/events/[id]/contract/generate` (+ GET/void) | Botón en `EventDetail.tsx`, con estado (pending/signed/voided) y enlace al PDF/token público |
| 6 | Avisos de hueco de trazabilidad (`traceGaps`) | **Parcial** (mezclados sin distinguir dentro del mensaje de éxito genérico del cierre) | `closeEvent.ts` los añade a `effects` | En `EventDetail.tsx`, separar los `⚠ Trazabilidad: ...` del resto de `effects` y renderizarlos con color/icono de aviso, no como confirmación verde |
| 7 | Badge de propietario + filtro "mis leads" | **Inexistente** | `GET /api/leads?assigned_to=`, `PATCH /api/leads/[id]/assign` | Badge con nombre del comercial en cada tarjeta de `LeadsCRM`/`KanbanPipeline`; filtro/toggle "Mis leads" en la barra de la vista |
| 8 | Timeline de interacciones | **Inexistente** | `GET/POST /api/interactions` | Widget en la ficha de lead/evento: lista + formulario rápido (tipo + notas) |
| 9 | Reserva/devolución de equipamiento | **Inexistente** | `GET/PATCH /api/cocina/equipment/checkout/[eventId]` | Nueva pestaña/sección en `CocinaPanel.tsx` (o en la ficha de evento, junto a logística): lista de equipamiento reservado, botón marcar enviado/devuelto con notas de rotura |
| 10 | Facturación parcial/posterior | **Parcial/Inexistente** | `POST /api/events/[id]/close {invoiceAmount}`, `POST /api/events/[id]/invoice {amount}` | En `EventDetail.tsx`/`BillingPanel.tsx`: campo de importe opcional al cerrar; botón "Facturar importe adicional" reutilizable post-cierre |

**Fuera de alcance de este sprint** (rutas huérfanas detectadas pero no ligadas a los Sprints 1-4, no se construye UI para ellas ahora salvo que el usuario lo pida expresamente): `provider-invoices`, `plans`/`event-plans`, `staffing/payroll`, `costing/[eventId]`, `bar-config`, varias de `escandallo/*`, `cocina/equipment-rules`, `guest-menus`/`proposed-menus`, `trazabilidad/movements`, `stock/{recipes,deduct,uom}`, `events/[id]/gastos-previos`, `generate-operations/[id]`. Se documentan aquí para que quede constancia, no como deuda urgente.

---

## 4. Traducción — hallazgos y plan

Hallazgo tranquilizador: la app ya está mayoritariamente en español de forma consistente (placeholders, `alert()`/`confirm()`, mensajes de validación, tooltips, nav completo — todo revisado y limpio). Solo 3 puntos:

1. `HACCPPanel.tsx:185` — pestaña `label: 'Dashboard'` mientras el resto de pestañas del mismo array están en español (`Neveras`, `Limpieza`, `Trazabilidad`, `Alertas`). → `'Panel'` o `'Resumen'`.
2. `ui/dialog.tsx:46` y `ui/sheet.tsx:67` — texto `sr-only` (solo lectores de pantalla) `"Close"` dentro del botón de cierre de todo modal/sheet de la app (boilerplate de shadcn sin adaptar). → `"Cerrar"`.
3. `src/app/api/floor-plan/generate/route.ts` devuelve `error.message` sin pasar por `sanitizeError()` (a diferencia del resto de rutas) — comprobado que su único consumidor actual (`PremiumTableMapEditor.tsx`) no muestra ese campo en pantalla (usa mensajes Spanish fijos), así que no hay fuga real hoy, pero se corrige por higiene/consistencia con el resto del código.

---

## 5. Alcance y plan de ejecución (FASE 3, por checkpoints)

Dado el volumen (sistema de diseño + 10 features de UI + 3 fixes de idioma), se ejecuta en checkpoints verificables, igual que los Sprints 1-4, no todo en un commit:

- **C1 — Fundamentos del sistema de diseño**: tokens `success`/`warning`/`danger` en `tailwind.config.ts`, `ui/button.tsx` a `gold`, `PageHeader` a `font-heading`, `Spinner`/`EmptyState` reforzados. Sin tocar paneles todavía.
- **C2 — Migración de paneles heredados**: `TrazabilidadPanel`, `EventDetail`, `BillingPanel`, `KanbanPipeline`, `ProvidersManager`, `rentabilidad`/`confirmacion`/`config` — uno a uno, verificado visualmente (Playwright) entre cada uno.
- **C3 — Features de UI (backend→UI, tabla de la sección 3)**: se agrupan por página afectada para minimizar re-touching: `EventDetail.tsx` concentra los ítems 1, 5, 6, 10; `LeadsCRM`/`KanbanPipeline` el ítem 7; nuevo widget de interacciones el ítem 8; `CocinaPanel` el ítem 9; `rentabilidad`/`config` los ítems 2 y 4.
- **C4 — Traducción**: los 3 fixes de la sección 4 (triviales, se hacen en un solo commit).
- **C5 — Verificación final**: nuevo `scripts/verify-sprint5-ui.sh` (Playwright, ya que esto es UI — no solo API) que recorra las páginas migradas y las nuevas features, + regresión completa de los 8 scripts existentes (no deberían verse afectados al ser cambios de frontend, pero se corre igual) + build de producción.

No hay decisiones de negocio pendientes en este Spec (a diferencia de Sprint 4) — los valores de tokens y la ubicación de cada feature nueva son propuestas técnicas concretas, no alternativas de negocio. Si no hay objeciones, se interpretará "SPEC Aprobado" como luz verde para ejecutar C1→C5 en ese orden, con un commit por checkpoint.
