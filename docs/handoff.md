## Último agente: Claude Code
## Fecha: 03/07/2026 (Sprint 6)
## Rama: main
## Último commit: (ver `git log -1`, tras este handoff)

### Qué se hizo (03/07 · Sprint 6 · cumplimiento del acta de cocina/APPCC)
- [x] **SPEC-Sprint6-Cocina-APPCC.md** (SDD): a partir de la transcripción
  de la reunión de cocina (18 puntos), auditoría en 3 frentes en paralelo
  (configurador/presupuesto, cocina/APPCC/trazabilidad, staffing/
  proveedores/memo) → matriz de cumplimiento fila-por-fila, plan de
  ejecución por checkpoints F0-F4. Objetivo explícito del cliente: reducir
  tiempos de gestión de cocina y APPCC.
- [x] **F0 · Desbloqueos.** F0.1 escandallo por evento daba 500 (`esi.
  custom_qty` no existe — exactamente el bug que Sprint 5 había dejado
  documentado como fuera de alcance). F0.2 `catalog_items.allergens`/
  `description` (nuevas columnas + editor con toggles de los 14 alérgenos
  UE + textarea) — mismo bug de esquema que Sprint 5 dejó pendiente
  (`ci.allergens` no existía). F0.3 el cron `pre-event-briefing` solo
  contaba memos y no enviaba nada pese a que la infraestructura de envío
  (WhatsApp/email) ya existía — ahora envía de verdad, idempotente vía
  `briefing_send_log`.
- [x] **F1 · APPCC recepción rápida.** F1.1 `gs1Parser.ts` interpreta
  códigos GS1-128 (bracketed y flujo de dígitos crudo) para auto-rellenar
  lote/caducidad al escanear una etiqueta — antes el escáner volcaba texto
  sin procesar. F1.2 botón "Recibir pedido completo" en Pedidos a
  Proveedores (backend `receiving/from-order` existía sin caller); de paso,
  el CHECK constraint de `supplier_orders.status` no incluía `'ordered'`
  — el botón "Marcar enviado" fallaba siempre. F1.3 el escaneo de etiqueta
  (OCR) escribía SOLO en `stock_entries`, nunca en `ingredients.quantity`
  (fuente canónica de escandallo/FEFO) — unificado con el ledger único (G6)
  de Sprint 2; de paso, `ingredient_price_history` usaba columnas
  inexistentes (500 en cualquier OCR con cambio de precio).
- [x] **F2 · Hojas de cocina completas e imprimibles.** F2.1 la hoja de
  carga agrupaba por pase pero los campos quedaban siempre vacíos (tipo
  declarado, nunca poblado) — ahora agrupa de verdad con cantidades
  agregadas por producto+unidad. F2.2 la hoja de logística calculaba
  producto seco/perecedero/desechables pero la UI solo mostraba el
  equipamiento — ahora se renderizan las 3 tablas. F2.3 botón "Imprimir /
  PDF" en las 3 hojas operativas vía impresión nativa del navegador.
- [x] **F3 · Presupuesto según lo acordado.** F3.1 `BudgetEditor` en
  borrador solo permite editar comensales y precio final (backend ya
  exponía `edit_only_price_and_guests`, sin consumidor). F3.2 toda
  cancelación desde el Kanban exige motivo y va por transición gobernada
  (INV-1); se elimina el botón Cancelar de la columna Aceptado — la
  cancelación excepcional (INV-3, retiene la señal como penalización)
  ahora vive solo en la ficha del evento (tampoco tenía consumidor antes).
  F3.3 sección "Sugerencias adicionales" en el configurador, revive el
  dataset `SUGGESTIONS`. F3.4 UI de gastos previos en la ficha (backend
  existía sin caller) + línea propia en el desglose de Rentabilidad (antes
  se fundían con "extras").
- [x] **F4 · Staffing y proveedores.** F4.1 firma de nómina tras marcar
  pagado (pizarra táctil, mismo mecanismo que la firma de contrato de
  Sprint 3) — la API ya existía sin consumidor y ni siquiera se exponía
  `signature_url` en el GET. F4.2 pestaña "Cuentas a pagar" en Proveedores
  (backend `/api/provider-invoices` sin caller). F4.3 campo protocolo del
  memo — completa los 7 campos del acta junto a F0.2; `events/[id]` PUT
  no aceptaba `protocol_notes` pese a que columna y memo ya existían.
  F4.4 el plano del venue externo (`venue_pdf_url`) se renderiza como capa
  de fondo en el editor de sitting; de paso, la página `/admin/mapa-mesas`
  ignoraba por completo el `?event_id=` con el que navega Operaciones — el
  editor abría siempre sin evento y "guardar" no persistía nada.
- [x] Verificación: nuevo `scripts/verify-sprint6.sh` **33/33**; sin
  regresión (E2E 32/32 · RBAC 41/41 · Operativos 14/14 · ERP 17/17 ·
  Sprint1 26/26 · Sprint2 27/27 · Sprint3 32/32 · Sprint4 50/50 · Sprint5
  18/18 — 290/290 en total); build de producción exit 0; verificado
  manualmente vía curl+psql cada flujo nuevo (escáner GS1, recepción
  completa, OCR moviendo stock real, hoja de carga por pase, cancelación
  gobernada INV-1/INV-3, gastos previos, firma de nómina, plano de venue).

### Pendiente / próximos pasos sugeridos (Sprint 6)
- [ ] Diferido explícitamente en el SPEC: vista 3D/360 del venue (cubierto
  por F4.4 — sitting sobre el plano 2D subido — como alternativa
  operativa); ratios de camareros configurables (hoy hardcodeados, la
  fórmula en sí ya es correcta).
- [ ] `guest-forms/decor` (401 sin cookie pese a ser pública) — sigue sin
  tocar, arrastrado desde sprints anteriores.
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el
  usuario, por política de red del entorno bloquea el push de borrado).
- [ ] Nivel C del Gap Analysis (G9/G14/G18/G23, Sprint 4) — backlog
  documentado para un futuro Spec dedicado.

### Histórico (02/07 · Sprint 5 · auditoría y unificación UI/UX)
- [x] **SPEC-Sprint5-UIUX.md** (SDD): auditoría en 3 frentes (3 agentes en
  paralelo) — consistencia del sistema de diseño, cobertura de UI sobre la
  lógica de backend de Sprints 1-4, y traducción al español. Plan de
  ejecución por checkpoints C1-C5, sin decisiones de negocio pendientes
  (a diferencia de Sprint 4) — propuestas técnicas concretas.
- [x] **C1 · Fundamentos del design system.** `tailwind.config.ts`: nuevos
  tokens `success`/`warning`/`danger` (antes cada panel redefinía estos 3
  colores con su propio hex). `ui/button.tsx`: variante `default` de
  `amber-600` (Tailwind genérico) a `gold` (el dorado de marca real que ya
  dominaba el resto de la app) — el propio primitivo compartido estaba
  desalineado con la marca. `ui/PageHeader.tsx`: elimina el `style` inline
  de Playfair Display en favor de la clase `font-heading`. Nuevo
  `ui/Spinner.tsx` (antes cada panel hardcodeaba su "Cargando...").
  `ui/DataList.tsx::DataListEmpty` pasa a delegar en `EmptyState` (eran dos
  implementaciones casi idénticas duplicadas).
- [x] **C2 · Migración de paneles heredados.** `TrazabilidadPanel`,
  `EventDetail`, `BillingPanel`, `KanbanPipeline`, `ProvidersManager`,
  `LeadsCRM`, `CocinaPanel` y las páginas `rentabilidad`/`confirmacion`/
  `config` — hex sueltos (`#1A1A1A`, `#C9A84C`, `#9CA3AF`, `stone-*`,
  `emerald/amber/red` de Tailwind) migrados a los tokens únicos. Se
  preservan como categóricas (no severidad) las paletas intencionalmente
  distintivas: etapas del Kanban, categorías de proveedor. **Hallazgo real
  más serio de lo esperado**: la pestaña "Guía del evento" de Cocina (y el
  contenedor de las 6 pestañas del módulo) usaba un tema oscuro (fondo casi
  negro, texto claro) completamente aislado del resto del admin — no era
  solo hex sueltos, era una inconsistencia visual real de "coherencia en
  todas las vistas". Migrado a los tokens únicos.
- [x] **C3 · 10 features de UI sobre lógica de backend ya implementada**
  (Sprints 1-4, sin ningún punto de UI que las usara hasta ahora):
  selector de salón (`EventDetail`, `PUT {venue}`), margen real con coste
  de personal (`rentabilidad`, `laborCostPaid`/`laborCostTotal` ya los
  devolvía el backend del Sprint 1/G3), botón "Generar contrato"
  (`EventDetail`), avisos de trazabilidad (`traceGaps`) separados
  visualmente del éxito genérico del cierre, importe opcional al cerrar +
  botón "Facturar importe adicional" (facturación parcial/posterior,
  Sprint 4/B5), checkbox `block_accept_on_stock_shortage` (`config`, con
  `GET/PUT /api/settings` ampliados), badge de propietario + toggle "Mis
  leads" (`LeadsCRM`, con protección para que el admin maestro por
  variables de entorno no intente "poseer" leads con su id sintético),
  timeline de interacciones (`LeadsCRM`, `GET/POST /api/interactions`),
  reserva de equipamiento con marcar enviado/devuelto (`CocinaPanel`,
  `GET/PATCH /api/cocina/equipment/checkout/[eventId]`).
- [x] **Bugs reales encontrados de paso** (no introducidos por Sprint 5,
  pero solo detectables auditando/tocando estos ficheros):
  - `events/[id]/route.ts` GET solo devolvía `venue_id` (UUID), insuficiente
    para que la UI supiera qué salón mostrar seleccionado — se añade
    `venue_slug` vía `LEFT JOIN venues`.
  - `<EmptyState icon="nombreDeIcono">` pasaba un string literal en vez de
    un elemento `<Icon>` en 9 sitios (`CocinaPanel.tsx`,
    `TrazabilidadPanel.tsx`) — el nombre del icono se renderizaba como
    texto plano en vez de un icono. Corregido en los 2 ficheros.
- [x] **C4 · 3 fixes de traducción** (la app ya estaba mayoritariamente en
  español, hallazgo tranquilizador de la auditoría): pestaña "Dashboard" →
  "Resumen" en `HACCPPanel`; texto `sr-only` "Close" → "Cerrar" en
  `ui/dialog.tsx`/`ui/sheet.tsx` (boilerplate de shadcn); `floor-plan/
  generate/route.ts` usa `sanitizeError()` como el resto de rutas.
- [x] Verificación: nuevo `scripts/verify-sprint5-ui.sh` **18/18**
  (estática: hex de roles unificados, bug `icon="string"`; funcional:
  las 10 features de C3 vía API; C4); sin regresión (E2E 32/32 · RBAC
  41/41 · Operativos 14/14 · ERP 17/17 · Sprint1 26/26 · Sprint2 27/27 ·
  Sprint3 32/32 · Sprint4 50/50); build de producción exit 0. Verificado
  visualmente con Playwright durante el desarrollo (staffing, Ficha del
  Evento, Configuración, Rentabilidad, Cocina antes/después del fix del
  tema oscuro).

### Pendiente / próximos pasos sugeridos
- [ ] **Bugs pre-existentes encontrados pero fuera de alcance de Sprint 5**
  (no son de diseño/UI ni de traducción, son de esquema/backend):
  `/api/stock/escandallos` falla con "column esi.custom_qty does not
  exist"; `/api/briefing/[eventId]` falla con "column ci.allergens does
  not exist". Ambos son bugs de esquema reales, detectados al navegar la
  Ficha del Evento, no relacionados con el trabajo de este sprint.
- [ ] `guest-forms/decor` (401 sin cookie pese a ser pública, Sprint 3) —
  sigue sin tocar.
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el
  usuario, por política de red del entorno bloquea el push de borrado).
- [ ] Nivel C del Gap Analysis (G9/G14/G18/G23, Sprint 4) — backlog
  documentado para un futuro Spec dedicado.

### Histórico (01/07 · Sprint 4 · los 14 gaps restantes del Gap Analysis, Nivel A+B)
- [x] **SPEC-Sprint4-RemainingGaps.md** (SDD): 14 gaps (no 15 — G7 ya se
  resolvió de rebote en Sprint 2), agrupados en Nivel A (5 arreglos
  mecánicos), Nivel B (6 features acotadas, con decisiones de negocio E-B1
  a E-B6 resueltas por el usuario) y Nivel C (3 iniciativas grandes,
  documentadas pero NO construidas — ver más abajo).
- [x] **Nivel A (G19,G20,G21,G22,bug-G9)**: enlace lead↔evento en
  `transitions.ts` (fwd2/inv1/inv2) pasa de `LOWER(name)` difuso a la FK
  real `quotes.lead_id`/`events.quote_id`; `freezeEventEscandallo`
  (`recalcEscandallo.ts`, más pobre) eliminada, todo el mundo llama a
  `freezeEscandallo` (`lib/escandallo.ts`, canónica); FK
  `admins.worker_id → workers(id)` (`NOT VALID` + `VALIDATE`, sin bloquear
  por huérfanos); typo `mapa-mas`→`mapa-mesas` en el dispatcher de
  `admin/page.tsx`; `client?.nif` (columna inexistente, NIF de factura
  siempre vacío) → `client?.fiscal_nif`, corregido en 2 sitios
  (`close/route.ts` y `fwd4`, este segundo no detectado en el Spec inicial).
- [x] **B1 (G10) · Staffing.** `domain/staffingSizing.ts::upsertStaffingLines`
  — antes solo se regeneraba `camarero` (dejando cocinero/metre obsoletos
  tras cambiar comensales) y el `ON CONFLICT DO NOTHING` no tenía
  constraint única contra la que chocar, así que cada recálculo insertaba
  un duplicado. Nuevo índice único parcial `(event_id, role) WHERE
  status='open'` — redimensiona solo líneas abiertas (decisión E-B1).
- [x] **B2 (G12) · Equipamiento.** Nueva tabla `event_equipment_checkout` +
  `domain/equipmentCheckout.ts`. Reserva automática (E-B2, sin botón
  manual) al generar la hoja de logística, solo eventos `externo`.
  `PATCH /api/cocina/equipment/checkout/[eventId]` para marcar
  enviado/devuelto con notas de rotura/merma.
- [x] **B3 (G11) · Merma.** `recipe_items.merma_pct` ahora se persiste en
  el import de recetas (antes se calculaba y se tiraba). Opción A (E-B3,
  decisión del usuario): sin migración de filas existentes, el usuario
  reimportará sus recetas manualmente.
- [x] **B4 (G13) · CRM ownership.** `leads.assigned_to` como fuente única
  (E-B4) — NO se duplica en `quotes`/`events`; se deriva siempre por JOIN
  (`quotes.lead_id`, `events.quote_id→quotes.lead_id`). Nueva tabla
  `interactions` (timeline comercial). `PATCH /api/leads/[id]/assign`
  reasigna y automáticamente "arrastra" todos los presupuestos/eventos
  derivados sin tocar ninguna otra fila.
- [x] **B5 (G16) · Cierre unificado + facturación parcial.** Nuevo
  `domain/closeEvent.ts` — única implementación de "cerrar un evento",
  reemplaza 2 copias divergentes (`close/route.ts` y `fwd4` en
  `transitions.ts`) que diferían en 5 puntos reales (`fwd4` forzaba TODOS
  los pagos a `paid=true`, no escribía `event_cost_deviations`, tenía su
  propio freeze inline más pobre...). E-B5 (decisión del usuario, va más
  allá de mis 2 propuestas originales): el cierre NUNCA fuerza pagos; la
  primera factura cubre el total por defecto o un importe explícito
  (`invoiceAmount`), dejando el resto facturable MÁS TARDE con la nueva
  ruta reutilizable `POST /api/events/[id]/invoice {amount}` (facturación
  incremental real, varias facturas por evento mientras no se supere el
  precio confirmado — solo aviso, nunca bloqueo).
- [x] **B6 (G17) · Whitelist de status.** E-B6 (delegado a mi criterio):
  alcance acotado, no la reforma completa de `setEventStatus`. Los 2
  puntos que aceptaban `events.status` sin validar ningún valor (`PUT
  /api/events/[id]` y `automation.ts`, incluido el bypass vía
  `update_event_field`) ahora exigen pertenencia a `VALID_EVENT_STATUSES`.
  Documentadas también 2 transiciones reales no representadas en
  `VALID_TRANSITIONS` (`PAY-1` accepted→presupuestado, `PAY-2`
  completed→paid) — sin cambiar su comportamiento, solo para que sean
  visibles/auditables.
- [x] **2 bugs reales encontrados escribiendo `verify-sprint4.sh`** (no
  introducidos por B1-B6, pero solo detectables ejercitando estos flujos
  de punta a punta):
  - `upsertEventOrderStaffing.ts` escribía `event_orders.guest_count`,
    columna que no existe en esa tabla — `POST
    /api/event-flow/[eventId]/calculate` fallaba con 500 en cuanto el
    evento ya tenía un `event_order` (o sea, casi siempre tras aceptar).
    Su rama INSERT tampoco incluía `quote_id` (NOT NULL sin default).
    Corregido: quita `guest_count` (la fuente ya es `events.guest_count`),
    deriva `quote_id` del evento.
  - `POST /api/leads` y `POST /api/interactions` usaban
    `getCurrentUser().id` como FK directa a `admins.id`. El admin
    "maestro" por variables de entorno usa un id sintético `'admin-1'`
    que no es una fila real de `admins` — crear un lead o registrar una
    interacción autenticado como ese admin rompía con un error de FK.
    Corregido: solo se usa el id si es un UUID válido, `null` en caso
    contrario.
- [x] Verificación: nuevo `scripts/verify-sprint4.sh` **50/50** (AC-A1..A5
  + AC-B1..B6); sin regresión (E2E 32/32 · RBAC 41/41 · Operativos 14/14 ·
  ERP 17/17 · Sprint1 26/26 · Sprint2 27/27 · Sprint3 32/32); build de
  producción exit 0.

### Nivel C — grandes iniciativas documentadas, NO construidas (backlog futuro)
- **C1 (G9) · Facturae/Verifactu.** Cumplimiento fiscal real requiere:
  direcciones fiscales estructuradas (hoy texto libre), `invoice_lines`
  persistidas de forma inmutable (hoy solo hay totales agregados), firma
  digital XAdES con certificado cualificado, y para Verifactu específico:
  encadenado por hash + envío a la AEAT. Primer paso realista si se aborda
  en un Spec dedicado: `GET /api/invoices/[id]/facturae.xml` sin firma
  (claramente marcado como no válido para envío oficial).
- **C2 (G14) · IVA multi-tasa real.** Entrelazado con C1 — el primer paso
  correcto es `catalog_items.iva_pct` (10% por defecto, 21% para bebidas
  alcohólicas — hoy `bebida` mezcla agua/refrescos con vino/cerveza sin
  campo que los distinga), llevado a líneas de presupuesto/factura, con
  `createInvoice` reestructurado para sumar por tasa. Depende de resolver
  primero la falta de tabla de líneas de factura de C1.
- **C3 (G18) · 6 redundancias de modelo.** Confirmadas las 6, una peor de
  lo que decía la auditoría: los planos de mesa son 4 tablas distintas
  (`tables`, `table_plans`, `event_floorplans`, `floor_plans`), no 2 — con
  `/api/plans` trayendo su propio `schema.sql` separado. Cada consolidación
  (planos de mesa, sistemas de receta, `guest_forms` vs `guests`,
  `selected_items` vs `event_menu_items`, `waiters` vs `workers` —
  confirmado NO muerto, con ruta CRUD activa —, triple alias de coste) toca
  funcionalidad real en producción. Recomendado: NO tocar en un sprint,
  abordar de una en una con su propio Spec y batería de regresión.
- **G23 · Dos proveedores de WhatsApp — NO es un bug.** Twilio (captación
  pública, solo entrante) y Meta Cloud API (staffing interno,
  entrante+saliente) cubren flujos genuinamente distintos con modelos de
  confianza distintos. Decisión de arquitectura intencional, documentada
  para que no se reabra como si fuera deuda técnica.

### Pendiente / próximos pasos sugeridos
- [ ] **Rediseño del UI del admin** (siguiente paso acordado con el
  usuario, ahora que los 14 gaps de backend están cerrados): badge de
  propietario + filtro "mis leads" en `LeadsCRM.tsx`/`KanbanPipeline.tsx`
  (B4, el dato ya es servible), UI de reserva/devolución de equipamiento
  (B2), botón de facturación parcial/manual en la ficha de evento (B5),
  además de lo ya pendiente de Sprints 1-3 (selector de salón, aviso de
  stock, margen real con coste de personal, botón "Generar contrato").
- [ ] **Arreglar el bug de `guest-forms/decor`** (401 sin cookie pese a ser
  pública) — encontrado en Sprint 3, sigue sin tocar.
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el
  usuario, por política de red del entorno bloquea el push de borrado).
- [ ] Nivel C del Gap Analysis (G9/G14/G18/G23) — ver arriba, con su primer
  paso ya perfilado para un futuro Spec dedicado. G4/G15 (TPV/KDS/
  pasarela) siguen excluidos por mandato del usuario.

### Histórico (01/07 · Sprint 3 · G5 trazabilidad FEFO + G8 contrato/firma)
- [x] **SPEC-Sprint3-Trazabilidad-Contrato.md** (SDD): aprobado por el usuario
  con alcance ampliado sobre la propuesta inicial de G8 — (D1) HTML
  confirmado, (D2) **firma dibujada en canvas** (no solo nombre+NIF+checkbox
  como proponía la FASE 1), (D3) **botón separado** (el contrato ya NO se
  genera dentro de `acceptQuote`, que queda sin tocar), (D4) texto legal
  estándar redactado por el propio Spec (boilerplate razonable, pendiente de
  revisión por abogado antes de producción real).
- [x] **G5 · Trazabilidad de lote FEFO automática al cierre.** Nuevo
  `domain/lotTraceability.ts::consumeLotsFEFO` — complementa (no sustituye)
  el ledger único de G6: `adjustIngredientStock` sigue siendo el único
  escritor del saldo; esto añade el RASTRO, consumiendo lotes por caducidad
  más próxima primero, repartiendo entre varios si hace falta. Si el stock
  consumido no viene de ningún lote registrado, no se inventa un origen: se
  reporta como `traceGaps` (visible en la respuesta de `/close` y `FWD-4`,
  nunca oculto). `stockDeduct.ts` lo invoca tras cada deducción real.
- [x] **G8 · Contrato de cliente + firma dibujada.** Nueva tabla
  `event_contracts` (con `signature_data` PNG en base64). Se genera BAJO
  DEMANDA (`POST /api/events/[id]/contract/generate`, admin), nunca
  automático. Página pública nueva `src/app/contrato/[token]/page.tsx` con
  pizarra de firma real (canvas + pointer events, funciona con dedo en
  móvil) — **verificada en navegador real con Playwright** (no solo a nivel
  de API): carga del contrato, dibujo, envío, confirmación y persistencia en
  BD, todo comprobado. Reutiliza el patrón `client_token` ya asentado
  (`guest-forms/decor`).
- [x] **Bug real encontrado y corregido de paso**: el middleware (`src/
  middleware.ts::isPublicMethod`) NO whitelisteaba las rutas públicas nuevas
  — se añadió `/api/contract/public/*`. Se detectó además que la ruta
  hermana `guest-forms/decor` (que se documenta a sí misma como "sin auth
  requerida") **está rota hoy** (401 sin cookie, confirmado con curl): el
  middleware nunca la whitelistea pese a que su propio código no comprueba
  sesión. **No se ha tocado** (fuera de alcance de G5/G8) — queda anotado
  para un futuro arreglo.
- [x] Verificación: `scripts/verify-sprint3.sh` **32/32** (G5: 12, G8: 20);
  sin regresión (E2E 32/32, RBAC 41/41, Operativos 14/14, ERP 17/17,
  Sprint1 26/26, Sprint2 27/27); build de producción exit 0.

### Pendiente / próximos pasos sugeridos
- [ ] **Arreglar el bug de `guest-forms/decor`** (401 sin cookie pese a ser
  pública) — fuera del alcance de G5/G8, encontrado incidentalmente.
- [ ] **Rediseño del UI del admin** (siguiente paso acordado con el usuario):
  botón "Generar contrato" en la ficha de evento (el backend ya existe:
  `POST /api/events/[id]/contract/generate`), selector de salón (Sprint 1),
  aviso de faltante de stock + toggle de bloqueo (Sprint 2), margen real con
  coste de personal en `rentabilidad` (Sprint 1) — todo servido por el
  backend, falta solo la UI.
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el usuario,
  por política de red del entorno bloquea el push de borrado).
- [ ] Gaps del Gap Analysis restantes: G9 (Facturae/Verifactu), G10
  (auto-dimensionado staffing frágil), G11 (merma en coste real), G12
  (menaje eventos externos), G13 (CRM sin owner), G14 (IVA por línea),
  G16-G23 (deuda técnica/cohesión, P2). G4/G15 (TPV/KDS/pasarela) siguen
  excluidos por mandato del usuario.

### Histórico (30/06 · Sprint 2 · G2 compromiso de inventario + G6 ledger único)
- [x] **SPEC-Sprint2-Inventory.md** (SDD): aprobado por el usuario con
  alcance ampliado sobre la propuesta inicial — el usuario pidió (E1) bloqueo
  **opcional** configurable (no solo no-bloqueante), (E2) confirmar que el
  pedido auto-generado requiere confirmación humana, (E3) dejar el modo
  automático para ingredientes sin resolver como extensión futura, y (E4)
  **adelantar G6** (unificación del doble ledger) a este mismo sprint en vez
  de diferirlo.
- [x] **G6 · Ledger único de stock.** `ingredients.quantity` es ahora la
  única fuente de verdad. Nuevo `domain/stockLedger.ts::adjustIngredientStock`
  — única función que debe escribir esa columna; en la misma transacción
  registra en `stock_entries` (log canónico) y refleja `inventory`+
  `inventory_movements` (espejo para Trazabilidad). Trigger
  `sync_inventory_quantity` (INSERT + UPDATE de quantity/min_stock) como
  defensa en profundidad. **Bugs reales confirmados leyendo el código**:
  `trazabilidad/receiving/from-order/[orderId]` y `trazabilidad/
  lot-consumption/[eventId]` escribían SOLO en `inventory.quantity`, nunca en
  `ingredients.quantity` (la fuente que consume escandallo/stockDeduct) —
  divergencia silenciosa real, no solo teórica. `stock/supplier-orders`
  (marcar entregado) restockeaba sin dejar rastro en ningún log.
  `stockDeduct.ts` era invisible a los ledgers de movimiento. `min_stock`
  tenía la misma duplicación silenciosa que `quantity`. Los 6 puntos de
  escritura redirigidos al ledger único.
- [x] **G2 · Compromiso de inventario al aceptar + compra automática.**
  Nueva tabla `inventory_commitments` (1 fila por evento+ingrediente).
  Dominio nuevo `domain/inventoryCommitment.ts` (`commitInventoryForEvent`/
  `releaseInventoryCommitments`/`checkInventoryShortages` — compara demanda
  del evento contra stock físico MENOS lo comprometido por OTROS eventos) y
  `domain/generateSupplierOrders.ts` (pedido borrador `pending`, nunca se
  envía). `acceptQuote` comprueba faltantes tras generar el escandallo; si
  `business_settings.block_accept_on_stock_shortage` está activo (default
  `false`), bloquea con 409 y revierte todo; si no, avisa + genera el
  pedido borrador. **Arregla la funcionalidad muerta `stockWarnings`**:
  `quotes/[id]` PUT nunca la devolvía pese a que `LeadsCRM.tsx` y
  `transitions::fwd3` ya la leían — confirmado con código, no solo
  documentado en la auditoría. También arreglado: `convert_uom()`, llamada
  por `/api/stock/generate-order` pero **ausente de `schema.sql`** (bug real
  confirmado empíricamente — la ruta daba 500 contra cualquier BD limpia).
  Compromisos se liberan en INV-1/INV-2/INV-3 y al cerrar (deducción real).
- [x] Verificación: nuevo `scripts/verify-sprint2.sh` **27/27**; sin
  regresión (E2E 32/32 · RBAC 41/41 · Operativos 14/14 · ERP 17/17 ·
  Sprint1 26/26); build de producción exit 0.

### Pendiente / próximos pasos sugeridos
- [ ] **Rediseño del UI del admin** (siguiente paso acordado con el usuario):
  selector de salón, aviso de faltante de stock en el flujo de aceptación,
  toggle de `block_accept_on_stock_shortage`, y mostrar `laborCostPaid`/
  margen real en `rentabilidad/page.tsx` (Sprint 1) — todo ya servido por
  el backend, falta solo la UI.
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el usuario,
  por política de red del entorno bloquea el push de borrado).
- [ ] Siguientes gaps del Gap Analysis (P0/P1 restantes): G5 (FEFO + lote→
  consumo automático en el cierre, requisito legal APPCC), G8 (contrato/
  firma de cliente), G9 (Facturae/Verifactu), G14 (IVA por línea). G4/G15
  (TPV/KDS/pasarela) siguen excluidos por mandato del usuario.

### Histórico (30/06 · Auditoría ERP + Sprint 1 Core Business)
- [x] **Auditoría ERP/CRM completa** → `docs/auditoria-erp-2026-06.md` (Gap
  Analysis con doble óptica operaciones+arquitectura; 5 ejes auditados en
  paralelo). Veredicto: back-office sólido, faltan los lazos del medio
  operativo (compromiso de inventario, compra auto, coste de personal en
  margen, disponibilidad de salón, lote→consumo APPCC) + la ruta del dinero.
- [x] **Rama huérfana `claude/event-venue-redesign-JAUif`**: analizada (sin
  ancestro común, superada por `main` en todo). El usuario aprobó borrarla,
  pero el push de borrado da **403 por política de red** del entorno → debe
  borrarla el usuario desde GitHub web / su CLI. Sigue existiendo en remoto.
- [x] **SPEC-Sprint1-CoreBusiness.md** (SDD): especificación de G1+G3,
  aprobada por el usuario (D1–D4) e **implementada**.
- [x] **G1 · Doble reserva de salón imposible a nivel BD.** Tres ubicaciones:
  Salón de Arriba, Salón de Abajo (exclusivos) y "fuera de los salones"
  (externo, no reserva). DDL nuevo en `schema.sql`: `CREATE EXTENSION
  btree_gist`, tabla `venues` (+seed 2 salones), `events.venue_id`, tabla
  `venue_bookings` con `EXCLUDE USING gist (venue_id WITH =, daterange(...)
  WITH &&)`. Dominio nuevo `domain/venueBooking.ts` (`reserveVenue`/
  `releaseVenue`/`resolveVenueId`, traduce 23P01 → 409). Interceptación:
  `acceptQuote` (rollback transaccional si choca), PUT `events/[id]` (bloqueo
  temprano al asignar `venue`), INV-1/INV-3 liberan (INV-2 mantiene hold, D1).
- [x] **G3 · Coste de personal en el P&L.** Dominio nuevo
  `domain/recalcEventLaborCost.ts`: mantiene 1 línea `cost_desglose('personal')`
  = Σ `worker_event_pay` **pagadas** (D4), idempotente. Invocado desde
  `staffing/pay` (POST/PUT/DELETE). `rentabilidad` recompone el margen real
  = `pvp − (total_cost + personal_pagado)` y expone `laborCostPaid`/
  `laborCostTotal`/`laborCostPending`/`totalCostFull`. **`events.total_cost`
  NO cambia** (sigue comida+extras, R2/Opción B → AC2.1 intacto).
- [x] Verificación: nuevo `scripts/verify-sprint1.sh` **26/26**; sin regresión
  (E2E 32/32 · RBAC 41/41 · Operativos 14/14 · ERP 17/17); build exit 0.

### Pendiente / próximos pasos sugeridos (del Gap Analysis)
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el usuario,
  por política de red del entorno).
- [ ] **UI de rentabilidad** (`rentabilidad/page.tsx`) y ficha de evento:
  mostrar la línea de personal y el margen real (el dato ya viaja en la API).
- [ ] Selector de salón (Arriba/Abajo/Externo) en la UI de evento (el backend
  `PUT {venue}` ya lo soporta).
- [ ] Siguientes gaps P0/P1 del Gap Analysis: G2 (compromiso inventario +
  compra auto), G5 (FEFO + lote→consumo en cierre), G6 (unificar doble ledger
  de stock), G8 (contrato/firma cliente), G9 (Facturae/Verifactu). G4/G15
  (TPV/KDS/pasarela) EXCLUIDOS por mandato del usuario.

### Histórico (28/06 · spec 001 cierre + sidebar)
- [x] **FASE 6 (R6) del spec 001 — limpieza de huérfanos** (commit `9ea9e24`):
  - T6.1: el fallback de escandallo en FWD-4 (`events/[id]/transitions.ts`)
    ya no hace su propio SQL ad-hoc contra `event_menu_items` (divergente de
    `events.selected_items`); delega en la fuente canónica
    `domain/generateEscandallo.ts` (la misma que usa `acceptQuote`).
  - T6.2: `cocinaSheets.ts` (hojas de carga/logística) usa
    `ingredients.is_dry`/`is_equipment` (columnas de schema que estaban sin
    usar) como fuente primaria de clasificación, con el heurístico por
    nombre/categoría como fallback solo si el ingrediente no resuelve.
  - T6.3: dos bugs reales corregidos — `assignments/auto/route.ts` filtraba
    por una columna `guests.status` que no existe (es `rsvp`, valores en
    español: `'confirmado'`); y el formulario público de invitados
    (`guest_forms`, JSONB) nunca sincronizaba con la tabla relacional
    `guests` que consume el mapa de mesas — ahora `guest-forms/route.ts`
    también upsert-ea `guests` en cada envío.
- [x] **CIERRE del spec 001 (TZ.1-TZ.4)** (commit `9ea9e24`):
  - Nuevas fuentes canónicas `domain/createInvoice.ts`,
    `domain/recordPayment.ts` y `domain/upsertEventOrderStaffing.ts`.
  - Consolidados sobre ellas los 7 handlers que violaban INV6 (INSERT
    directo a `event_orders`/`payments`/`invoices` fuera de
    `src/lib/domain/`): `invoices/route.ts`, `events/[id]/close`,
    `events/[id]/transitions` (fwd4/inv5), `payments/route.ts`,
    `payments/signal/route.ts`, `event-orders/route.ts` (ahora delega
    íntegramente en `domain/acceptQuote.ts`) y
    `event-flow/[eventId]/calculate/route.ts`.
  - Grep de duplicación a cero confirmado: `INSERT INTO
    {event_orders,payments,invoices}` y `UPDATE events SET status`, ambos
    0 coincidencias fuera de `src/lib/domain/`.
  - `specs/001-erp-conectado/spec.md` §Estado → "Implementada".
- [x] **Sidebar: opción Demo eliminada** (commit `4596278`): quitada la
  entrada "Demo" de `AdminLayout.tsx` y su permiso en `rbac.ts`
  (`NAV_ROLES.demo`); borrada `src/app/admin/demo/page.tsx` (scaffold de
  desarrollo, quedaba huérfana sin la entrada de nav). Revisado el resto
  del sidebar: ya seguía criterios ERP (Captación · Planificación · Evento
  · Cocina & Catering · Staffing · Stock & Proveedores · Finanzas ·
  Configuración) con iconos `lucide-react` en cada item — no requería
  reestructuración adicional. Confirmado que todas las páginas nuevas de
  FASE 4/5 (`ocupacion`, `rentabilidad`, `confirmacion`, `evento`) usan el
  mismo `AdminLayout` y el mismo lenguaje visual, sin divergencias de
  diseño que alinear.
- [x] Verificación completa tras cada bloque de cambios: `verify-erp-
  conectado.sh` 17/17 (las 6 invariantes en verde, INV6 incluida),
  `verify-e2e.sh` 32/32, `verify-rbac-cocina.sh` 41/41,
  `verify-operativos.sh` 14/14, build de producción exit 0. Todo verde,
  sin regresiones.

### En progreso
- [ ] Nada abierto por mi parte en este momento.

### Decisiones
- Rama única: `main` (todas las sesiones, todos los agentes).
- Handoff en `docs/handoff.md` (leer al empezar, escribir al terminar).
- Siempre `git fetch origin && git log --oneline -5 origin/main` antes de
  empezar a codificar.
- Antes de avanzar de fase/feature: 4 verify scripts (17/17, 32/32, 41/41,
  14/14) + build, todos en verde.
- Spec 001 (`specs/001-erp-conectado/`) queda íntegramente implementada y
  cerrada (FASE 0-6 + CIERRE); no quedan tareas abiertas en
  `tasks.md`.

### Pendiente
- [ ] Decidir destino de `claude/event-venue-redesign-JAUif` (borrar /
  documentar como obsoleta / nada) — pendiente de confirmación del usuario,
  sigue sin tocar.

### Observaciones
- El servidor dev local debe levantarse con `next dev` (no `next start`),
  variables de entorno en el .env de cada sesión; tras cualquier reinicio de
  postgres hay que volver a levantarlo y resembrar `eventflow_verify` con
  `schema.sql` + `scripts/verify-ejemplo-e2e.sql` antes de cada script E2E
  (cada script requiere reseed independiente). Si `DROP DATABASE` falla con
  "being accessed by other users", ejecutar antes:
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE
  datname='eventflow_verify' AND pid <> pg_backend_pid();`
- `domain/createInvoice.ts`/`domain/recordPayment.ts`/
  `domain/upsertEventOrderStaffing.ts` están tipadas para `PoolClient` (pg),
  pero varios call sites no-transaccionales solo tienen `Pool` (vía
  `getPool()` de `@/lib/db`); se pasa `getPool() as any` en esos casos
  (mismo patrón pragmático que ya existía en `acceptQuote`/T6.1). No hay
  rotura de tipos real porque `Pool` y `PoolClient` comparten la interfaz
  `.query()` que estas funciones usan.
