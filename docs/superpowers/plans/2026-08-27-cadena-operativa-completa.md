# Plan: Cadena operativa completa (WP-0 → WP-1 → WP-2)

> **Estado**: 🟡 Plan aprobado — preparación de scripts en curso. NO ejecutado todavía.
> **Entorno**: Solo VPS de producción (`eventcater.duckdns.org` / `root@62.171.134.0`). No hay entorno local.
> **Métrica de avance**: transiciones de estado que el test E2E pasa en verde sin intervención manual.
> **Fecha**: 2026-08

## Contexto / decisiones rectoras (heredadas)

- A1: un solo cliente operativo (J. Benítez). Cero multi-tenant; solo no-hardcodear lo que impida futuro.
- A2: escalera 4 escalones (E2E → sombra → piloto con red → piloto sin red). Listón = "sin salirse del sistema".
- B3: compras HITL — propuesta OC automática (necesidad − stock por lotes) → aprobación humana → estados.
- B4: receta primero, catálogo emergente. Dedup maestro + unidad base fija. Contrato de receta.
- C5: cierre económico = prioridad absoluta. El test E2E llega hasta la factura real.
- C6: APPCC→stock vinculado (lote + stock, producción FEFO, consumo→coste real).
- D7/D8: descartados (TPV/comandero/delivery/Uber/rascas/galerías) y post-MVP (doble-booking primero).
- E9: documentación/webs/menú CONGELADOS hasta fin de cadena.

## Contratos de entidad (fuente de verdad para importador y test)

### Ingrediente (maestro)
- `name` — nombre canónico; **dedup** al crear (normalizar mayúsculas/plurales; sugerir existente ante "tomate pera"/"Tomate Pera").
- `base_unit` + `unit` — unidad base fija (kg/l/ud/g). Las recetas convierten a base vía `ingredient_unit_conversions`.
- `supplier_id` → proveedor del maestro.
- Contrato: ingrediente solo válido si tiene unidad base definida.

### Receta
- `published` bool. Reglas de validación para "publicada":
  1. ≥1 `recipe_ingredients` vinculado a ingrediente del maestro.
  2. cada línea con `quantity` + `unit` (convertible a base).
  3. `merma_pct` definido (aplica 25% por defecto si no, según política vigente — ver escandallos).
  4. escandallo calculable (`cost_per_serving > 0`).
- Si NO cumple → queda en **borrador** e invisible en selector de plato/menú.

### OC / Compras (HITL)
- Estados: `necesidad → enviado → confirmado → recibido`.
- Propuesta OC = diferencia (necesidad del evento escala por pax − stock disponible por lotes FEFO).
- La propuesta NO se envía sola: requiere aprobación humana (agrupada por proveedor).

### Recepción APPCC (C6)
- Crea **lote trazable** (`stock_lots`/`receiving_log`) Y **sube stock disponible** (`inventory`/`stock_movements`).
- Incidencia en línea (entrega parcial) → la OC no cierra completa, queda pendiente.

### Producción (FEFO)
- Consume por FEFO: el lote con caducidad más próxima se consume primero.
- Registro APPCC de elaboración + generación de lote interno.

### Cierre económico (C5)
- Registra mermas y sobrante → **coste real ≠ coste escandallo** → desviación cuadrada al céntimo.
- Genera **factura real** vía `closeEvent` (E-B5: facturación parcial explícita; `invoiceAmount` opcional).

### Trazabilidad inversa (aserción final del test)
- Desde el plato servido, una query resuelve hasta el lote del proveedor.

## WP-0 · Reset de datos sucios es `scripts/reset_seed.mjs`

Nuevo script, NO tocar `reset-and-seed.mjs`. Idempotente. Salvaguardas OBLIGATORIAS:

1. `SEED_ALLOW_DESTRUCTIVE=true` obligatorio.
2. **Negarse si detecta datos de eventos reales facturados**: antes del truncado, comprobar si existe alguna `invoice` con `status IN ('paid')` o `event_orders` con `status='completed'` y no-`final_price=0`, o eventos con `client_email` real no-test. Si los detecta → ABORTAR (pedir flag `--force` explícito).
3. `pg_dump` completo previo a `backups/`; si falla → abortar.
4. Nunca aceptar host de producción contradicho... (mantener hosts de bloqueo del patrón existente, pero aquí SÍ es el único entorno, así que el guard 1b debe convertirse en "confirmación interactiva/flag" en lugar de bloqueo ciego).
5. TRUNCATE en orden inverso de dependencias.
6. Conserva maestros estructurales: `units_of_measure`, `admins` (admin de test), work center "Cocina Central", 1 proveedor de test, 1 cliente de test.
7. Recreable N veces con mismo resultado.

## WP-1 · Importador de receta desde Excel (PASTA ESPEJO)

- Lee `C:\Users\Kurro\Downloads\PASTA ESPEJO.xlsx` real.
- Crea ingredientes en el maestro (dedup + unidad base) + receta en borrador.
- Valida contra contrato; si algo falla → lo **lista como error y no lo inventa**.
- Si pasa → publicada → seleccionable.

## WP-2 · Test E2E de cadena completa

`tests/cadena-operativa.spec.ts` — Playwright contra `https://eventcater.duckdns.org` (la app ya corre; sin build).

Fixture: genera la receta **llamando al importador con el Excel real** (no hardcode). Afirma cada transición:

1. Publicada aparece en selector; borrador NO.
2. Evento test 30 pax local externo + menú PASTA ESPEJO → `event_shopping_items` escalado (aserción cantidad = receta × 30 / raciones).
3. Stock 0 → propuesta OC diferencia en estado `necesidad`.
4. Aprobación humana → `enviado` → `confirmado`.
5. Recepción con lote+caducidad+temp → aserción doble (lote + stock sube).
6. Recepción con incidencia (entrega parcial) → OC no cierra.
7. Producción FEFO → stock baja del lote correcto + APPCC elaboración + lote interno.
8. Carga → servicio: estados avanzan en orden.
9. Cierre: mermas/sobrante → coste real ≠ escandallo, desviación cuadra.
10. Factura real → importe = presupuesto ± desviación/extras.
11. Trazabilidad inversa plato→lote proveedor.

## Regla de gestión

El test corre en CI. Cualquier cambio que lo rompa NO se mergea.

## Orden de trabajo

1. ✓ Blueprint (este documento).
2. `scripts/reset_seed.mjs` (WP-0) — preparado, sin ejecutar.
3. Ajustes al importador para cumplir contrato estricto (validación → borrador/publicada).
4. `tests/cadena-operativa.spec.ts` (WP-2).
5. Ejecución contra VPS + corrección hasta verde.
