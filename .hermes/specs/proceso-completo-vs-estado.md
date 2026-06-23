# Mapeo Proceso Completo EventFlow vs Estado Actual

## Flujo de Negocio (J.Benitez — Alboroto Catering)

```
FASE 1: PRE-VENTA
  1. Configurador menú (público)
  2. Presupuesto borrador
  3. Cálculo precio
  4. 1ª reunión → modificaciones → señal → cierre presupuesto
  5. Presupuesto aceptado

FASE 2: PRE-EVENTO
  6. Cálculo mesas + camareros
  7. Enlace cliente para invitados
  8. Cálculo escandallos
  9. T-7 días: confirmación invitados + mesas rellenas
  10. Generación hojas operación + logística

FASE 3: EJECUCIÓN
  11. Noche antes: briefing camareros
  12. Checklist evento por áreas (cocina, servicio)
  13. Ejecución del evento

FASE 4: CIERRE
  14. Cierre de evento
  15. Actualización stock
  16. Cobros y facturación
```

---

## ESTADO ACTUAL POR FASE

### FASE 1 — PRE-VENTA

| Paso | Estado | Componentes/APIs | Gap |
|---|---|---|---|
| **1. Configurador menú** | ✅ Existe | `src/app/configurador/page.tsx` — 5 pasos (Detalles, Menú, Personalizar, Extras, Resumen). WizardStore persistido. | ✅ Funciona. ¿Quieres que lo revise contra tu diseño de referencia? |
| **2. Presupuesto borrador** | ✅ Existe | `POST /api/quotes` con status='draft'. `proposed_menus` como borrador. | ✅ OK |
| **3. Cálculo precio** | ✅ Existe | `quotes.base_pvp`, `base_cost`, `extras_pvp`, `total_pvp`, `margin_pct`. Catalogo en `catalog_items` con precio. | ✅ OK |
| **4. 1ª reunión → modificaciones** | ⚠️ Parcial | `quotes` tiene status 'draft' → 'sent' → 'accepted'/'rejected'. `PUT /api/quotes/[id]` modifica. | ❌ **Falta**: workflow de "señal" (pago parcial como aceptación), flujo de modificaciones con versionado |
| **5. Presupuesto aceptado** | ✅ Existe | `quotes.status='accepted'`, `quotes.accepted_at`. Crea evento vía `events.quote_id`. | ✅ OK. Verificar que el lead pase a 'convertido'. |

### FASE 2 — PRE-EVENTO

| Paso | Estado | Componentes/APIs | Gap |
|---|---|---|---|
| **6. Cálculo mesas + camareros** | ⚠️ Parcial | `event_orders` con `tables_suggested`, `tables_confirmed`, `waiters_suggested`, `waiters_confirmed`. API `staffing/lines` + `staffing/workers`. | ❌ **Falta**: UI de cálculo automático (mesas = guest_count / 10, camareros = mesas * 1.5). Algoritmo de asignación. |
| **7. Enlace cliente para invitados** | ✅ Existe | `events.client_token` (uuid). `src/app/invitados/[token]/page.tsx` — página pública RSVP. `guests` con RSVP. | ❌ **Falta**: Formulario de invitados con selección de menú por persona (actualmente solo `menu_type` adulto/nino/bebe, sin enlace a plato concreto del menú del evento). |
| **8. Cálculo escandallos** | ✅ Existe | `event_shopping_items` con `recipe_version`, `theoretical_qty`, escalado por guest_count. API `POST /api/escandallo/[eventId]/recalc`. | ⚠️ El recalc existe pero necesita ser trigger automático al aceptar presupuesto. |
| **9. T-7 días: confirmación invitados** | ⚠️ Parcial | API `GET /api/guests` con filtro eventId. `cron/pre-event-reminders`. | ❌ **Falta**: Dashboard de "confirmación final" que compare invitados confirmados vs mesas. Alertas si sobran/faltan mesas. |
| **10. Hojas operación + logística** | ✅ Nuevo | `GET /api/hoja-operacion/[eventId]`. `POST /api/generate-operations/[id]`. Componente `HojaOperativaPDF`. | ⚠️ Falta generar realmente la logística: `api/cocina/event/[eventId]/logistics`. Falta UI de "Generar operaciones" con botón en evento. |

### FASE 3 — EJECUCIÓN

| Paso | Estado | Componentes/APIs | Gap |
|---|---|---|---|
| **11. Briefing camareros** | ❌ **No existe** | No hay tabla `briefings` ni componente. `staffing_assignments` existe pero sin contenido de briefing. | ❌ **Crítico**: No existe sistema de briefings. Debería incluir: mapa mesas, menú por mesa, alérgenos, asignación de zona a cada camarero. |
| **12. Checklist por áreas** | ✅ Existe | `checklist_tasks`, `checklist_templates`, `POST /api/checklist/init`. Admin page `/admin/checklist`. | ⚠️ Falta vinculación automática: al generar operaciones, crear checklist de cocina y servicio. |
| **13. Ejecución evento** | ✅ Existe | CocinaPanel con tabs: Producción, Carga, Logística, Alertas, OCR, APPCC. Mapa mesas. | ✅ OK |

### FASE 4 — CIERRE

| Paso | Estado | Componentes/APIs | Gap |
|---|---|---|---|
| **14. Cierre de evento** | ✅ Existe | `POST /api/escandallo/[eventId]/freeze`. `events.status='completed'`. Transitions API. | ⚠️ Falta: al cerrar evento, debe trigger automático de actualización stock + facturación. |
| **15. Actualización stock** | ⚠️ Parcial | `POST /api/stock/deduct` — deducir stock. `stock_entries`, `inventory`, `inventory_movements`. | ❌ **Falta**: Al cerrar evento, deducir automáticamente `actual_quantity` de `event_shopping_items` del inventario. No hay conexión evento→stock. |
| **16. Cobros y facturación** | ✅ Parcial | `payments` con `paid` boolean. `invoices` con status, balance_due. Admin `/admin/cobros`. | ⚠️ Falta: auto-generar factura al cerrar evento. Enlace payments → invoice. |

---

## RESUMEN DE GAPS CRÍTICOS

| # | Gap | Impacto | Prioridad |
|---|---|---|---|
| 1 | **Briefing camareros** — No existe | Día del evento sin instrucciones al personal | 🔴 Alta |
| 2 | **Señal (pago parcial)** — No hay flujo de "señal" como aceptación formal | No se distingue "aceptado" de "pagó señal" | 🔴 Alta |
| 3 | **Auto-deducción stock al cerrar evento** — No conectado | Stock no se actualiza al terminar evento | 🔴 Alta |
| 4 | **Auto-generación factura al cerrar** — No conectado | Hay que facturar manualmente | 🟡 Media |
| 5 | **Confirmación invitados vs mesas** — Sin dashboard | No se ve si sobran/faltan mesas a T-7 | 🟡 Media |
| 6 | **Menú por invitado** — Solo tipo (adulto/nino), sin plato concreto | No se puede personalizar menú por invitado | 🟡 Media |
| 7 | **Cálculo automático mesas/camareros** — Sin UI | Se hace a mano | 🟢 Baja |