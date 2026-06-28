# Constitución arquitectónica — EventFlow ERP

> Principios no negociables. Toda corrección y todo código nuevo debe cumplirlos.
> Esta constitución existe porque el sistema arrastra, desde el inicio, lógica de
> negocio **duplicada y divergente** repartida por los route handlers, lo que
> produce un ERP inconexo (efectos distintos según el camino que tome el usuario).

## P1 · Una operación de negocio = una única implementación canónica
Cada transacción de negocio (aceptar presupuesto, registrar pago, cerrar evento,
recalcular coste, generar factura…) vive en **una sola función** de la capa de
dominio `src/lib/domain/`. Los route handlers (admin, público, cron, webhook) son
**controladores finos**: autentican, validan input y **delegan**. Prohibido copiar
`INSERT INTO event_orders/payments/invoices` en un handler.

**Hoy se viola:** `event_order` se crea en 4 sitios, `payments` en 7, factura en 4,
aceptación en ≥4 (`quotes/[id]`, `quotes/public/[id]/accept`, `events/[id]` PUT,
`events/[id]/confirm`).

## P2 · Fuente de verdad única por dato
- **Coste del evento** = Σ `event_shopping_items.estimated_cost` (escandallo
  estimado). `events.total_cost` es una **proyección cacheada** que solo se
  escribe desde `recalcEventCost()`. El coste **real** se deriva después como
  desviación al congelar. Nadie más escribe `total_cost`.
- **Estado del evento** = máquina de estados. `events.status` solo se escribe vía
  `src/app/api/events/[id]/transitions` (o la función de dominio equivalente).
- **Precio (PVP)** = `quotes.total_pvp` de la quote aceptada, proyectado a
  `events.total_pvp` y `event_orders.confirmed_price` por la operación de
  aceptación. Una sola escritura, un solo origen.

## P3 · La máquina de estados es el único guardián del estado
Ninguna ruta hace `UPDATE events SET status=...` por su cuenta (hoy lo hacen 18).
Las transiciones válidas, sus precondiciones y sus efectos colaterales (fan-out)
viven en un solo módulo.

## P4 · La aceptación hace fan-out atómico a todos los roles
Aceptar un presupuesto es **una** transacción que deja el evento listo para
TODAS las perspectivas: finanzas (event_order + pagos 40/60 + factura diferida),
cocina (escandallo + coste), sala (sugerencia mesas/camareros + `client_token`),
cliente (enlace de invitados activo). Si falta cualquiera, la operación falla y
revierte. No existen "aceptaciones a medias" según el botón pulsado.

## P5 · Idempotencia en todo efecto financiero/stock
Aceptar, pagar, cerrar, deducir stock y facturar son idempotentes: repetir la
llamada no duplica filas ni importes. Se protege con flags/constraints
(`stock_deducted`, unicidad de factura por evento, `ON CONFLICT`).

## P6 · Un contrato UI↔API, una forma de respuesta
Toda API responde `{ success, data, error? }`. La UI consume exactamente esa
forma. Las rutas se nombran en un solo idioma (inglés en el path). Prohibido que
la UI llame a rutas inexistentes o espere otra forma (hoy pasa en cocina:
tabs Pases/Hojas).

## P7 · Sin datos huérfanos
Toda tabla cuelga del agregado raíz `events` por FK y alguien la lee. Toda
columna que el código escribe, alguien la consume. Las pantallas accesibles
tienen un punto de entrada real (enlace generado por el sistema).

## Definición de "hecho" (Definition of Done)
Un caso de uso está **conectado** cuando: (a) tiene un único camino canónico,
(b) ese camino propaga datos a todas las perspectivas afectadas, (c) existe una
verificación end-to-end automatizada que lo demuestra sobre una BD recién creada
desde `schema.sql`, y (d) no quedan caminos alternativos que produzcan estados
divergentes.
