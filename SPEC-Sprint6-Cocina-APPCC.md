# SPEC · Sprint 6 — Cumplimiento del acta de reunión: Cocina, APPCC y resto de apartados

**Metodología:** SDD. FASE 1 (auditoría + especificación), **sin cambios de código todavía**, a la espera de aprobación antes de implementar (FASE 3).

**Origen:** acta de la reunión de cocina (`reunion_cocina_benitez.txt`). Objetivo declarado del cliente: **reducir los tiempos de gestión de cocina y de APPCC**.

**Método:** 3 agentes de auditoría en paralelo contrastando cada punto literal del acta contra el código actual (cocina+APPCC · presupuesto/configurador · staffing/proveedores/notificaciones), con verificación cruzada de los 2 bugs de esquema ya anotados en el handoff del Sprint 5.

---

## 0. Matriz de cumplimiento (los 18 puntos del acta)

| # | Requisito del acta (literal) | Estado | Detalle |
|---|---|---|---|
| 1 | Sugerencias adicionales entre menú y extras | ❌ **FALTA** | El dataset `SUGGESTIONS` existe en `src/data/catalog.ts:310` (Barra Libre, Estación de Mariscos, Menú Infantil) pero **nunca se importa** — dato muerto. El wizard pasa de Menú (Step3) a Extras (Step4) sin sección de sugerencias. |
| 2 | Estados: borrador → 1º contacto → aceptado → realizado | ✅ **CUMPLE** | `KanbanPipeline.COLUMNS` = Borrador / 1º contacto / Aceptado / Realizado (+Descartados). Menor: `LeadsCRM` aún etiqueta `sent` como "Enviado" en vez de "1º contacto". |
| 3 | Borrador: quitar unidades; solo precio final y comensales editables | ❌ **ROTO (invertido)** | `BudgetEditor` hace exactamente lo contrario: unidades con steppers −/+ editables y **comensales en solo-lectura**, sin campo de precio final. El helper de backend `canEditOnlyPriceAndGuests` existe pero ninguna UI lo consume. |
| 4 | Cancelar presupuesto exige motivo | ⚠️ **ROTO en UI** | La ruta de quotes lo valida (FR-A03 ✅), pero los botones Cancelar del Kanban van por `PUT /api/events/[id]` **sin pedir motivo nunca** — esquivan la validación. |
| 5 | Quitar botón Cancelar de presupuesto aceptado | ❌ **ROTO** | El backend lo rechaza para quotes (FR-A04 ✅), pero la columna Aceptado del Kanban **sigue mostrando "Cancelar"**, que cancela el evento por la vía no gobernada. |
| 6 | Ratios camareros: cóctel 1×12; menú 1×10 + refuerzo/25 | ✅ **CUMPLE exacto** | `operations.ts:57-68` implementa literalmente ambas fórmulas. [MEJORA]: ratios hardcodeados, no configurables desde ajustes. |
| 7 | Mapa interactivo; venue externo: subir PDF + 3D/360; sitting | ⚠️ **PARCIAL** | Editor de mesas propio ✅. La columna `events.venue_pdf_url` existe pero **no hay UI de subida ni el PDF se usa como fondo del sitting** (el editor solo pinta una cuadrícula CSS). 3D/360: inexistente. |
| 8 | Proveedores: debe, fechas de pago, justificante, cobros | ❌ **Backend sí, UI no** | `/api/provider-invoices` (FR-A10) calcula debe_total/vencidos y guarda justificante+vencimiento — **cero componentes lo llaman**. `ProvidersManager` es solo un CRM de contactos. |
| 9 | Nómina: firma tras pago; pago total por trabajador | ⚠️ **Backend sí, firma sin UI** | `pay/[id]/sign` exige `paid` antes de firmar ✅ y `payroll` agrega el total por trabajador ✅ — pero **no existe ninguna UI de firma** (endpoint huérfano). |
| 10 | Aviso email/WhatsApp del briefing a todos los camareros | ❌ **ROTO (crítico)** | El cron `pre-event-briefing` **no envía nada**: solo cuenta memos y devuelve JSON. La infraestructura real de envío existe y funciona (`whatsapp.ts` Meta Cloud, `email.ts` Resend/SMTP) pero el flujo no la usa. |
| 11 | Presupuesto incluye gastos varios previos (gasolina…) | ⚠️ **Backend sí, UI no** | `POST /api/events/[id]/gastos-previos` suma al coste vía `recalcEventCost` ✅ — sin UI de alta, y en Rentabilidad se funde con la etiqueta genérica "extras". |
| 12 | Memo camareros: 7 campos, enviar la noche antes | ⚠️ **5 de 7 campos** | Tiene: datos personales, menú, mantelería, anotaciones, barra libre ✅. **Faltan: intolerancias y protocolo.** El envío "noche antes" depende del punto 10 (roto). |
| 13 | "Para alboroto incluir dónde es el evento" | ✅ **CUMPLE** | El memo resuelve y muestra la ubicación (incl. venue externo). |
| 14 | Hoja de producción (previa, desde el escandallo) | ✅ **CUMPLE** | `generateProductionSheet` agrupa por pase desde `event_shopping_items` ✅. [MEJORA]: sin botón imprimir/PDF (el componente imprimible `HojaOperativaPDF` es código muerto, nadie lo importa). |
| 15 | Hoja de carga: divide **cada plato por pase y unidades** | ❌ **ROTO/FALTA** | La agrupación por pase está *stub*: devuelve `perecederoPasses: []` **siempre vacío**, y la UI ni siquiera muestra la columna pase. Tampoco hay desglose plato×unidades (solo gramos de ingrediente). El núcleo del requisito no existe. |
| 16 | Hoja logística: equipamiento + **lo seco** (harina, aceite) | ⚠️ **Calculado pero invisible** | El backend calcula `dryGoods`, `disposables` (papel absorbente ✅) y `perishableGoods` — pero la UI **solo pinta `equipment`**, así que lo seco que pidió el cliente se genera y jamás se muestra. En eventos en local la pestaña sale vacía del todo. |
| 17 | APPCC: escáner que mete fecha de entrada, lotes y sanidad | ❌ **NO CUMPLE** | El QR de recepción solo vuelca el texto crudo al campo `qr_code` — **no auto-rellena nada** (lote, caducidad, fecha, proveedor: todo manual, ~7 campos por recepción). El OCR sí extrae lote/caducidad pero vive desconectado del alta APPCC. Y el endpoint `receiving/from-order/[orderId]` (recibir un pedido entero en 1 clic con lotes automáticos) está **construido y sin ningún botón que lo llame**. |
| 18 | Bugs de esquema que rompen lo anterior | ❌ **ROTO** | (a) `stock/escandallos` consulta `esi.custom_qty` (columna inexistente) → 500 → **la vista de escandallo sale en blanco** en Ficha de Evento y Stock. (b) `briefing/[eventId]` consulta `ci.allergens`/`ci.description` (inexistentes en `catalog_items`) → 500 → **el memo de camareros no se puede generar** en eventos nuevos. |

**Resumen:** de los 18 puntos, **4 cumplen**, **6 están rotos** (incluidos 2 críticos para cocina/APPCC), y **8 son parciales o tienen el backend hecho pero sin UI**. El patrón dominante es el mismo que destapó el Sprint 5: capacidades construidas en el servidor que nunca llegaron a la pantalla.

---

## 1. Plan de ejecución propuesto (FASE 3, por checkpoints)

Ordenado por impacto directo en el objetivo "reducir tiempos de cocina y APPCC":

### F0 — Desbloqueos (bugs que rompen flujos del acta)
- **F0.1** Quitar `esi.custom_qty` del SELECT de `stock/escandallos/route.ts:69,101` (nadie consume ese valor) → vuelve el escandallo a Ficha de Evento y Stock.
- **F0.2** `catalog_items`: **añadir** las columnas `allergens JSONB DEFAULT '[]'` y `description TEXT` (no quitarlas del query — el acta exige intolerancias en el memo, así que la columna hace falta de verdad), + campo de alérgenos en el editor de Catálogo, + incluir intolerancias en el memo (el render ya está preparado). Cubre el punto 12a.
- **F0.3** Cablear el envío real del briefing: el cron `pre-event-briefing` pasa de contar a **enviar** el memo por email (`sendEmail`, ya operativo) y WhatsApp (`WhatsAppCloudClient`, best-effort si hay credenciales), con registro de enviados/fallidos. Cubre el punto 10 y hace real el "noche antes" del 12.

### F1 — APPCC: recepción en segundos, no en 7 campos (punto 17)
- **F1.1** Parser del QR/código de barras de recepción: interpretar payloads GS1-128/QR (lote `(10)`, caducidad `(15)/(17)`, GTIN) y **auto-rellenar** lote, caducidad y fecha de entrada (hoy por defecto) en el formulario; el texto crudo se conserva en `qr_code` como hasta ahora.
- **F1.2** Botón **"Recibir pedido completo"** en Recepciones/Pedidos, cableado al endpoint ya existente `POST /api/trazabilidad/receiving/from-order/[orderId]`: una recepción de pedido entero en 1 clic con lotes autogenerados, en vez de N recepciones × 7 campos.
- **F1.3** Unificar el OCR de etiquetas con el alta APPCC: "Aplicar" en modo etiqueta lleva lote/caducidad extraídos al formulario de recepción (una sola fuente de alta sanitaria, en línea con la referencia oidotipi).

### F2 — Hojas de cocina completas e imprimibles (puntos 14-16)
- **F2.1** Hoja de carga real "por pase y unidades": poblar la agrupación por pase (hoy stub vacío) y añadir el desglose **plato × unidades por pase** desde `event_menu_items`; mostrar la columna pase en la UI.
- **F2.2** Hoja logística: renderizar `dryGoods` (harina, aceite), `disposables` (papel absorbente) y `perishableGoods` que ya se calculan; en eventos en local, mensaje claro "No aplica (evento en salones propios)" en las secciones de transporte en lugar de tabla vacía.
- **F2.3** Botón **Imprimir** por hoja (vista imprimible con CSS de impresión; se recupera el componente imprimible hoy muerto). Producción, carga y logística salen a papel de cocina en 1 clic.

### F3 — Presupuesto según lo acordado (puntos 1, 3-5, 11)
- **F3.1** `BudgetEditor` en borrador: ocultar steppers de unidades y alta con cantidad; **comensales y precio final editables** (cablear `edit_only_price_and_guests` que el backend ya expone).
- **F3.2** Cancelaciones: todo Cancelar del Kanban pide **motivo** obligatorio y va por la transición gobernada; se **elimina el botón Cancelar de la columna Aceptado** (la cancelación excepcional de un evento aceptado queda disponible solo desde la ficha, gobernada por INV-3 con motivo).
- **F3.3** Sección "Sugerencias adicionales" entre Menú y Extras en el configurador, reviviendo el dataset `SUGGESTIONS` ya definido.
- **F3.4** UI de **gastos previos** en la Ficha de Evento (alta rápida concepto+importe) + línea propia "Gastos previos" en Rentabilidad (hoy se funde con "extras").

### F4 — Staffing y proveedores (puntos 7-9)
- **F4.1** **Firma de nómina** en StaffingManager: tras marcar pagado, pizarra de firma (se reutiliza el canvas de firma del contrato del Sprint 3) → `POST /api/staffing/pay/[id]/sign`.
- **F4.2** **Cuentas a pagar a proveedores**: nueva pestaña en Proveedores consumiendo `/api/provider-invoices` — debe total, vencidos en rojo, alta de factura con vencimiento, subir justificante, marcar pagado.
- **F4.3** Memo: añadir campo **protocolo** (nota de protocolo por evento) — con F0.2 (intolerancias) completa los 7 campos del acta.
- **F4.4** Sitting sobre el **PDF del venue externo**: subida del PDF desde la ficha/guía (rellena `venue_pdf_url`, hoy sin UI) y render como fondo del editor de mesas.

### Diferido explícitamente (Nivel C)
- **3D/360 del venue externo** (punto 7): requiere visor/motor 3D o integración de terceros — merece su propio Spec; el sitting sobre PDF (F4.4) cubre el 90% del valor operativo.
- **Ratios de camareros configurables** (punto 6 [MEJORA]): la fórmula ya es exacta; hacerla editable desde Configuración es un extra menor que puede entrar si sobra tiempo.

---

## 2. Decisiones marcadas (con recomendación)

- **E-S6.1 — Intolerancias:** ¿añadir columnas `allergens`/`description` al catálogo y editor (recomendado, cumple el acta) o solo quitar del query (memo sin intolerancias)? → *Recomendado: añadir.*
- **E-S6.2 — Canal del aviso de briefing:** email siempre (ya operativo) + WhatsApp best-effort si hay credenciales Meta configuradas. → *Recomendado: ambos.*
- **E-S6.3 — Cancelar aceptado:** quitar el botón del Kanban (literal del acta) manteniendo la cancelación gobernada (INV-3, con motivo) solo en la ficha para casos excepcionales. → *Recomendado: sí.*
- **E-S6.4 — 3D/360:** diferir a Spec propio; F4.4 (PDF como fondo del sitting) cubre la necesidad operativa. → *Recomendado: diferir.*

Verificación prevista: `verify-sprint6.sh` (AC por cada F) + regresión completa de los 9 scripts existentes + build + verificación visual Playwright de las hojas imprimibles y el flujo de recepción APPCC.
