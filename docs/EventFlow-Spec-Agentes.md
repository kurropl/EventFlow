# EventFlow — Especificación de Implementación para Agentes de Código

**Versión:** 1.0 · 30/07/2026
**Destino:** Flota de agentes pi (pi.dev) orquestados con Orca (onorca.dev), modelo DeepSeek-V4-Flash
**Proyecto:** EventFlow — ERP/CRM de catering y salones (Next.js 14, TypeScript, PostgreSQL, Docker, Tailwind, JWT, API Routes) — https://eventcater.duckdns.org
**Objetivo global:** Unificar los 9 módulos existentes eliminando islas de información mediante (a) el Evento como agregado raíz, (b) máquina de estados + outbox de eventos de dominio, (c) ciclo completo cocina→compras→trazabilidad, (d) entidad Menú, (e) orquestación operativa, (f) finanzas por hitos, (g) portal del cliente. **Respetando y reutilizando todo lo ya implementado.**

---

## §0. CÓMO USAR ESTE DOCUMENTO (COORDINADOR ORCA)

1. La unidad de trabajo es el **Work Package (WP)**. Cada WP se despacha a **un worktree aislado** con **un agente pi**.
2. El orden de despacho es por **olas** (§8). Dentro de una ola, los WP marcados `paralelizable: sí` pueden ejecutarse simultáneamente; los WP de olas posteriores NO se despachan hasta que la ola anterior pase su **gate** (§9).
3. A cada agente se le entrega como contexto: este documento completo + el archivo `docs/SCHEMA-MAP.md` generado en WP-00 + las **Reglas Operativas** (§2), que deben instalarse además como `AGENTS.md` en la raíz del repo para que pi las cargue siempre.
4. Configuración recomendada del modelo: `reasoning_effort: high` como mínimo en todos los WP; `xhigh`/Pro en el rol de coordinador-revisor y en los WP marcados **[COMPLEJO]**.
5. Ningún WP se considera terminado hasta cumplir su bloque **Aceptación** con comandos que devuelven éxito. El coordinador ejecuta el gate antes de hacer merge del worktree.
6. **Prohibido a todos los agentes:** re-arquitecturar, renombrar tablas/rutas existentes, cambiar el sistema de auth, introducir dependencias nuevas de npm sin que el WP lo autorice explícitamente, o tocar archivos fuera del `Alcance` de su WP.

---

## §1. RESTRICCIONES INVIOLABLES (NO-ROMPER)

Estas reglas prevalecen sobre cualquier interpretación de cualquier WP.

- **NR-1 — Compatibilidad de datos:** Hay datos reales en producción (≈91 tablas, 135 recetas, 165 leads, 6 proveedores, eventos históricos). Toda migración debe ser **aditiva o transformadora con backfill**, nunca destructiva. Prohibido `DROP TABLE`, `DROP COLUMN` o `TRUNCATE` sobre tablas existentes. Columnas obsoletas se marcan `-- DEPRECATED(fecha, WP-xx)` en comentario SQL y se retiran en un WP futuro dedicado, nunca de paso.
- **NR-2 — Rutas y contratos existentes:** Las ≈137 rutas API y ≈35 páginas admin actuales deben seguir respondiendo igual (misma URL, mismo shape de respuesta) salvo que un WP indique explícitamente una extensión de payload (extensiones = añadir campos, nunca quitar ni renombrar).
- **NR-3 — RBAC:** Los 7 roles existentes (Admin, Gerente, Analista, Jefe Cocina, Cocinero, Maitre, Camarero) se conservan. Toda ruta nueva declara qué roles acceden. Las rutas del portal del cliente usan un mecanismo separado por token, jamás el JWT de admin.
- **NR-4 — Migraciones:** Una migración SQL por WP, numerada y con nombre `NNN_wpXX_descripcion.sql`, idempotente (`IF NOT EXISTS` / guards), con script de verificación al final que hace `SELECT` de comprobación. Nunca editar migraciones ya aplicadas.
- **NR-5 — Tests:** Los 72+ tests existentes deben pasar tras cada WP. Cada WP añade sus propios tests. Un WP que deja tests rojos no se mergea.
- **NR-6 — Estados de lead y evento existentes:** Los valores actuales de estado se conservan; solo se **añaden** valores nuevos (WP-04). Ningún dato histórico puede quedar en un estado inválido.
- **NR-7 — Convenciones del código:** Respetar las convenciones detectadas en WP-00 (naming de tablas, estructura de API Routes, componentes, Tailwind compacto, Phosphor Icons). No introducir un segundo estilo.
- **NR-8 — Sin secretos en código:** SMTP, tokens de pasarela y credenciales van por variables de entorno, siguiendo el patrón existente.
- **NR-9 — Idioma:** UI y textos de negocio en español (es-ES). Código, nombres de tablas y columnas: seguir la convención dominante detectada en WP-00 (no mezclar).

---

## §2. REGLAS OPERATIVAS DEL AGENTE (instalar como `AGENTS.md`)

```markdown
# AGENTS.md — Reglas para agentes en EventFlow

## Flujo de trabajo obligatorio por tarea
1. Lee tu WP completo en docs/EventFlow-Spec-Agentes.md y docs/SCHEMA-MAP.md.
2. INSPECCIONA antes de escribir: abre las tablas, rutas y componentes reales
   que tu WP dice ampliar. Si el nombre real difiere del usado en la spec
   (la spec usa nombres lógicos), usa el real y anótalo en tu informe final.
3. Escribe primero la migración SQL, aplícala en local, verifica con SELECT.
4. Implementa API → lógica → UI, en ese orden. Commits pequeños y atómicos.
5. Ejecuta TODA la suite de tests + los tests nuevos de tu WP.
6. Ejecuta los comandos del bloque "Aceptación" de tu WP. Si alguno falla,
   corrige antes de dar por terminado. No declares éxito sin evidencia.
7. Informe final: archivos tocados, decisiones de mapeo de nombres,
   comandos de aceptación con su salida.

## Prohibiciones duras
- No tocar archivos fuera del "Alcance" de tu WP.
- No borrar/renombrar tablas, columnas, rutas o componentes existentes.
- No instalar dependencias npm salvo autorización explícita del WP.
- No "mejorar" código ajeno al WP aunque parezca mejorable: anótalo en el
  informe como sugerencia.
- Si la spec y la realidad del código chocan y no puedes resolverlo con la
  regla de mapeo de nombres: DETENTE y reporta al coordinador. No inventes.

## Convenciones
- Migraciones: db/migrations/NNN_wpXX_descripcion.sql, idempotentes.
- Eventos de dominio: emitir SIEMPRE vía helper emitDomainEvent() (WP-04)
  dentro de la misma transacción que el cambio de estado. Nunca INSERT manual.
- Toda tabla nueva: id (uuid o serial según convención), created_at,
  updated_at, y event_id FK cuando la entidad pertenece a un evento.
- Tests: mismo framework y ubicación que los 72 existentes.
```

---

## §3. WP-00 — RECONOCIMIENTO DEL SISTEMA **(obligatorio, secuencial, bloquea todo)**

- **Objetivo:** Producir el mapa real del sistema para que el resto de WPs no adivinen nombres. La spec usa *nombres lógicos*; este WP crea la tabla de equivalencias.
- **Paralelizable:** no. **Dependencias:** ninguna. **[COMPLEJO]**
- **Alcance:** solo lectura del repo + escritura exclusiva en `docs/` y `AGENTS.md`.
- **Tareas:**
  1. Volcar el esquema real: `pg_dump --schema-only` → analizar y generar `docs/SCHEMA-MAP.md` con: (a) tabla lógica de esta spec → tabla real; (b) columnas clave; (c) FKs existentes y FALTANTES hacia eventos; (d) convención de naming detectada (idioma, snake_case, tipo de PK).
     Entidades lógicas a mapear obligatoriamente: `events, leads, clients, quotes, quote_lines, invoices, payments, dishes/recipes (¿una o dos tablas?), recipe_ingredients, ingredients, suppliers, supplier_ingredients, equipment_stock, employees, work_hours, payrolls, appcc_* (7 secciones), event_load (carga), event_logistics, production_timing, production_tasks, guests, tables (mesas), users, roles`.
  2. Volcar el inventario de rutas API reales (`app/api/**` o `pages/api/**`) → `docs/API-MAP.md` con método, ruta, roles y shape de respuesta resumido.
  3. Confirmar mecanismo de workers/webhooks existente (Config→Integraciones): dónde vive el runner, cómo se registra un job. → sección "Workers" en SCHEMA-MAP.
  4. Confirmar framework de tests, comando de ejecución y baseline: ejecutar la suite y registrar el resultado (`docs/TEST-BASELINE.md`). Si hay tests rojos preexistentes, listarlos: esos y solo esos pueden seguir rojos.
  5. Detectar la duplicidad platos (Sala 3.1) vs recetas (Cocina 4.2): ¿una tabla o dos? Documentar con conteos de filas. (Insumo crítico de WP-11.)
  6. Instalar `AGENTS.md` (§2) en la raíz.
- **Aceptación:**
  - Existen `docs/SCHEMA-MAP.md`, `docs/API-MAP.md`, `docs/TEST-BASELINE.md` y `AGENTS.md`.
  - SCHEMA-MAP contiene las ~24 entidades lógicas mapeadas o marcadas explícitamente `NO EXISTE`.
  - La suite de tests se ejecuta y su resultado coincide con TEST-BASELINE.

---

## §4. MODELO DE DATOS OBJETIVO (DDL DE REFERENCIA)

Los agentes adaptan tipos de PK, naming e idioma a lo detectado en SCHEMA-MAP (NR-7/NR-9), manteniendo la **semántica exacta** de estas definiciones. `events(id)` representa la tabla real de eventos.

```sql
-- ===== TRANSVERSAL (WP-04) =====
CREATE TABLE IF NOT EXISTS domain_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,              -- catálogo §5
  aggregate_type TEXT NOT NULL,             -- 'event','purchase_order','menu',...
  aggregate_id  TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,                -- NULL = pendiente
  attempts      INT NOT NULL DEFAULT 0,
  last_error    TEXT
);
CREATE INDEX IF NOT EXISTS idx_domain_events_pending
  ON domain_events (created_at) WHERE processed_at IS NULL;

-- Estados de evento: AÑADIR a los existentes (nuevo, propuesta_enviada,
-- confirmado, en_curso, completado):
--   'en_preparacion', 'cerrado_operativo', 'cerrado_contable', 'cancelado'
-- 'completado' se conserva como alias legado de 'cerrado_operativo' para
-- datos históricos; la UI muestra ambos como "Completado".

-- ===== UNIDADES Y STOCK (WP-01, WP-02, WP-07) =====
-- En ingredients (tabla real según SCHEMA-MAP): añadir
--   base_unit TEXT NOT NULL DEFAULT 'ud'   -- 'g','ml','ud'
--   (backfill WP-01 desde la unidad actual)
CREATE TABLE IF NOT EXISTS ingredient_unit_conversions (
  id            SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id),
  unit_name     TEXT NOT NULL,              -- 'kg','caja','botella75'
  factor_to_base NUMERIC(14,4) NOT NULL,    -- 1 kg = 1000 g
  UNIQUE (ingredient_id, unit_name)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            BIGSERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN
                 ('entrada','salida','merma','ajuste','retorno')),
  qty_base      NUMERIC(14,4) NOT NULL,     -- en unidad base, signo según tipo
  lot_id        INT REFERENCES stock_lots(id),
  event_id      INT REFERENCES events(id),  -- NULL si no imputable
  purchase_order_line_id INT,               -- FK tras WP-06
  reason        TEXT,
  user_id       INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- REGLA: el stock actual de un ingrediente = SUM(qty_base). La columna de
-- stock existente pasa a ser cache materializada, recalculada por trigger
-- o en el mismo servicio que inserta el movimiento (elegir según convención).

CREATE TABLE IF NOT EXISTS stock_lots (
  id            SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id),
  lot_code      TEXT,
  expiry_date   DATE,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_id   INT REFERENCES suppliers(id),
  qty_base_initial NUMERIC(14,4) NOT NULL,
  qty_base_remaining NUMERIC(14,4) NOT NULL
);

-- ===== COMPRAS (WP-06) =====
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            SERIAL PRIMARY KEY,
  supplier_id   INT NOT NULL REFERENCES suppliers(id),
  status        TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN
                 ('borrador','enviada','recibida_parcial','recibida','cancelada')),
  event_id      INT REFERENCES events(id),  -- NULL = reposición general
  expected_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id            SERIAL PRIMARY KEY,
  purchase_order_id INT NOT NULL REFERENCES purchase_orders(id),
  ingredient_id INT NOT NULL REFERENCES ingredients(id),
  qty_ordered_base NUMERIC(14,4) NOT NULL,
  qty_received_base NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_price    NUMERIC(12,4),              -- por unidad base
  status        TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN
                 ('pendiente','recibida_parcial','recibida'))
);

-- ===== MENÚS (WP-12) =====
CREATE TABLE IF NOT EXISTS menus (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  version       INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN
                 ('borrador','publicado','pausado','retirado')),
  price_per_pax NUMERIC(10,2) NOT NULL,
  description   TEXT,
  parent_menu_id INT REFERENCES menus(id),  -- versionado: nueva versión = nueva fila
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
CREATE TABLE IF NOT EXISTS menu_sections (
  id        SERIAL PRIMARY KEY,
  menu_id   INT NOT NULL REFERENCES menus(id),
  name      TEXT NOT NULL,   -- 'Aperitivos','Entrante','Principal','Postre','Recena','Bebida'
  position  INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS menu_section_dishes (
  id         SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES menu_sections(id),
  dish_id    INT NOT NULL,   -- FK a la tabla unificada de platos/recetas (WP-11)
  variant_tag TEXT           -- NULL | 'celiaco' | 'vegetariano' | 'infantil' | ...
);
CREATE TABLE IF NOT EXISTS event_menus (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL REFERENCES events(id),
  menu_id   INT NOT NULL REFERENCES menus(id),  -- versión CONGELADA
  pax       INT NOT NULL,
  UNIQUE (event_id, menu_id)
);
-- REGLA versionado: un menú 'publicado' con eventos vinculados NO se edita:
-- editar => crear fila nueva version+1 (parent_menu_id) en 'borrador'.

-- ===== FINANZAS POR HITOS (WP-21) =====
CREATE TABLE IF NOT EXISTS payment_plans (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL UNIQUE REFERENCES events(id),
  quote_id  INT NOT NULL,                    -- FK real según SCHEMA-MAP (WP-03)
  total     NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_milestones (
  id        SERIAL PRIMARY KEY,
  plan_id   INT NOT NULL REFERENCES payment_plans(id),
  kind      TEXT NOT NULL CHECK (kind IN ('senal','intermedio','resto','extra')),
  label     TEXT NOT NULL,
  amount    NUMERIC(12,2) NOT NULL,
  due_date  DATE,
  status    TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN
             ('pendiente','pagado','vencido','anulado')),
  paid_at   TIMESTAMPTZ,
  payment_id INT                              -- FK a tabla real de cobros
);

-- ===== STAFFING PLANIFICADO (WP-17) =====
CREATE TABLE IF NOT EXISTS event_staff_requirements (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL REFERENCES events(id),
  role      TEXT NOT NULL,                   -- roles de empleado existentes
  headcount INT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time   TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS event_shifts (
  id          SERIAL PRIMARY KEY,
  requirement_id INT NOT NULL REFERENCES event_staff_requirements(id),
  employee_id INT NOT NULL,                  -- FK a tabla real de empleados
  status      TEXT NOT NULL DEFAULT 'ofrecido' CHECK (status IN
               ('ofrecido','confirmado','rechazado','cancelado','realizado')),
  offer_token TEXT UNIQUE,                   -- para confirmación por enlace
  responded_at TIMESTAMPTZ
);

-- ===== PORTAL DEL CLIENTE (WP-25..31) =====
CREATE TABLE IF NOT EXISTS client_portals (
  id           SERIAL PRIMARY KEY,
  event_id     INT NOT NULL UNIQUE REFERENCES events(id),
  access_token TEXT NOT NULL UNIQUE,         -- aleatorio >=32 bytes, hasheado si convención
  status       TEXT NOT NULL DEFAULT 'activo' CHECK (status IN
                ('activo','congelado','cerrado')),
  freeze_date  DATE NOT NULL,                -- default: fecha_evento - 14 días
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS extras_catalog (
  id        SERIAL PRIMARY KEY,
  category  TEXT NOT NULL,   -- 'centro_mesa','manteleria','minuta','otros'
  name      TEXT NOT NULL,
  photo_url TEXT,
  price     NUMERIC(10,2) NOT NULL,
  price_unit TEXT NOT NULL DEFAULT 'ud' CHECK (price_unit IN ('ud','mesa','pax','evento')),
  active    BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS event_extras (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL REFERENCES events(id),
  extra_id  INT NOT NULL REFERENCES extras_catalog(id),
  qty       INT NOT NULL DEFAULT 1,
  price_snapshot NUMERIC(10,2) NOT NULL,     -- precio congelado al seleccionar
  selected_via TEXT NOT NULL DEFAULT 'portal' CHECK (selected_via IN ('portal','admin'))
);
CREATE TABLE IF NOT EXISTS event_messages (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL REFERENCES events(id),
  sender    TEXT NOT NULL CHECK (sender IN ('cliente','equipo')),
  body      TEXT NOT NULL,
  read_at   TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== CIERRE (WP-18, WP-24) =====
CREATE TABLE IF NOT EXISTS event_closure_checklists (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL UNIQUE REFERENCES events(id),
  logistics_returned BOOLEAN NOT NULL DEFAULT false,
  waste_recorded     BOOLEAN NOT NULL DEFAULT false,
  hours_validated    BOOLEAN NOT NULL DEFAULT false,
  appcc_resolved     BOOLEAN NOT NULL DEFAULT false,
  closed_by  INT, closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS event_financial_closures (
  id        SERIAL PRIMARY KEY,
  event_id  INT NOT NULL UNIQUE REFERENCES events(id),
  planned_food_cost  NUMERIC(12,2), real_food_cost  NUMERIC(12,2),
  planned_staff_cost NUMERIC(12,2), real_staff_cost NUMERIC(12,2),
  extras_revenue     NUMERIC(12,2), total_revenue   NUMERIC(12,2),
  real_margin_pct    NUMERIC(6,2),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## §5. CATÁLOGO DE EVENTOS DE DOMINIO (contratos)

Emisión SIEMPRE vía `emitDomainEvent(tx, type, aggregateType, aggregateId, payload)` en la **misma transacción** que la escritura de negocio. Payloads mínimos (pueden extenderse, nunca reducirse):

| event_type | Emisor (WP) | Payload mínimo | Consumidores (WP) |
|---|---|---|---|
| `event.confirmed` | WP-04 (transición a confirmado) | `{event_id, venue_type, pax, date}` | WP-15 plantillas venue, WP-17 staffing |
| `deposit.paid` | WP-22 (cobro hito señal) | `{event_id, milestone_id, amount}` | WP-04 confirmar evento, WP-25 crear portal |
| `payment.milestone_due` | WP-21 (job diario) | `{event_id, milestone_id, due_date}` | WP-21 recordatorio email |
| `portal.frozen` | WP-31 (job diario freeze_date) | `{event_id}` | WP-06 explosión compras, WP-15, WP-17, WP-20 |
| `portal.updated` | WP-26/27/28/29 | `{event_id, section, summary}` | WP-04 timeline, notificación interna |
| `menu.published` / `menu.price_changed` | WP-12/WP-13 | `{menu_id, version}` | WP-13 alerta margen, WP-14 configurador |
| `ingredient.price_changed` | WP-06 (recepción con precio nuevo) | `{ingredient_id, old_price, new_price}` | WP-13 recálculo costes |
| `purchase_order.received` | WP-07 | `{purchase_order_id, line_ids}` | WP-02 entrada stock (misma tx), timeline |
| `stock.below_minimum` | WP-02 (tras cada movimiento) | `{ingredient_id, current, minimum}` | WP-08 propuesta reposición |
| `event.operationally_closed` | WP-18 | `{event_id}` | WP-24 cierre económico |
| `event.financially_closed` | WP-24 | `{event_id, real_margin_pct}` | dashboard |
| `shift.offered` / `shift.confirmed` | WP-17 | `{shift_id, employee_id, event_id}` | email empleado / precarga horas |

**Worker consumidor (WP-04):** bucle sobre `domain_events WHERE processed_at IS NULL ORDER BY id` con reintentos (`attempts`, backoff, máx 5, luego `last_error` + alerta en dashboard). Un handler por `event_type`, registrados en un mapa único `src/domain/handlers/index.ts`. Handlers idempotentes obligatoriamente.

---

## §6. WORK PACKAGES — OLAS 1 A 3

Formato de cada WP: **Objetivo · Dependencias · Paralelizable · Alcance (zonas del repo) · Especificación · Aceptación**. "Aceptación" son condiciones verificables por comando o SQL; el coordinador las ejecuta en el gate.

### OLA 1 — Saneamiento del modelo (Fase 0)

#### WP-01 — Unidades base y conversiones **[COMPLEJO]**
- **Objetivo:** Eliminar el bug de suma de stock sin unidades. Cada ingrediente tiene `base_unit` ('g','ml','ud') y conversiones.
- **Dep:** WP-00 · **Paralelizable:** con WP-03, WP-04.
- **Alcance:** migración; modelo/servicio de ingredientes; formularios de ingrediente y receta; `docs/UNIT-MIGRATION-REPORT.md`.
- **Especificación:** (1) Migración: añadir `base_unit` + tabla `ingredient_unit_conversions` (§4). (2) Backfill: mapear la unidad actual de cada ingrediente → unidad base con factor (kg→g:1000, l→ml:1000, ud→ud:1; unidades ambiguas como 'caja' → crear conversión con factor 1 y marcar en el informe para revisión humana). (3) Toda cantidad de `recipe_ingredients` se convierte y almacena en base (columna nueva `qty_base`; la columna vieja se conserva, DEPRECATED). (4) Helper único `convertToBase(ingredientId, qty, unit)` en `src/domain/units.ts`; prohibido convertir inline en otros archivos. (5) UI: el formulario de ingrediente pide unidad base + conversiones; el de receta permite introducir en cualquier unidad registrada y muestra la conversión.
- **Aceptación:** `SELECT count(*) FROM ingredients WHERE base_unit IS NULL` = 0 · `SELECT count(*) FROM recipe_ingredients WHERE qty_base IS NULL` = 0 · test unitario de `convertToBase` con kg/g, l/ml, caja, unidad desconocida (error) · suite completa verde · informe generado listando ingredientes con mapeo dudoso.

#### WP-02 — Movimientos de stock y trazabilidad base
- **Objetivo:** Sustituir el "+/- inline" destructivo por un libro mayor de movimientos.
- **Dep:** WP-01 · **Paralelizable:** con WP-05.
- **Alcance:** migración (`stock_movements`, `stock_lots` §4); servicio de stock; ruta API de ajuste existente; UI de inventario (historial).
- **Especificación:** (1) Servicio único `recordStockMovement()` que inserta movimiento + actualiza cache de stock en la misma tx + emite `stock.below_minimum` si procede. (2) La ruta API existente de ajuste inline se reescribe por dentro para crear un movimiento tipo 'ajuste' (misma URL y payload → NR-2). (3) Backfill: un movimiento inicial 'ajuste' con `reason='saldo inicial migración'` por ingrediente con su stock actual. (4) UI: pestaña "Movimientos" en la ficha de ingrediente (tabla paginada: fecha, tipo, cantidad, evento, usuario, motivo).
- **Aceptación:** para todo ingrediente, `SUM(qty_base)` de movimientos = stock cache (query de verificación incluida en la migración) · ajustar stock desde la UI crea fila en `stock_movements` · suite verde.

#### WP-03 — Integridad referencial evento↔presupuesto
- **Objetivo:** Corregir el bug conocido: FK evento↔presupuesto y unicidad de presupuesto aceptado.
- **Dep:** WP-00 · **Paralelizable:** con WP-01, WP-04.
- **Alcance:** migración; servicio de presupuestos; `docs/FK-AUDIT.md`.
- **Especificación:** (1) Añadir `event_id` FK a la tabla real de presupuestos (nullable primero). (2) Backfill por coincidencia lead/cliente+fecha; los no resolubles se listan en `docs/FK-AUDIT.md` para asignación manual (NO adivinar). (3) Constraint parcial: máximo un presupuesto en estado 'aceptado' por evento (`CREATE UNIQUE INDEX ... WHERE status='aceptado'`). (4) Auditar FKs a `event_id` en escandallos, cargas, logística, timing, tareas, horas: las que falten se añaden en este WP (nullable + backfill donde sea inequívoco).
- **Aceptación:** FK creada y válida (`SELECT ... WHERE event_id IS NULL` documentado en FK-AUDIT con motivo) · imposible aceptar dos presupuestos del mismo evento (test) · suite verde.

#### WP-04 — Outbox, worker y máquina de estados **[COMPLEJO]**
- **Objetivo:** El sistema nervioso: `domain_events`, `emitDomainEvent()`, worker consumidor y máquina de estados ampliada del evento.
- **Dep:** WP-00 · **Paralelizable:** con WP-01, WP-03.
- **Alcance:** migración (`domain_events`); `src/domain/events.ts`, `src/domain/handlers/`; integración con el runner de workers detectado en WP-00; servicio de eventos (transiciones); ficha de evento (UI de estado + Timeline).
- **Especificación:** (1) Estados nuevos según §4; matriz de transiciones válidas en `src/domain/eventStateMachine.ts` (única fuente de verdad; la API de cambio de estado la usa y rechaza transiciones ilegales con 422). (2) `emitDomainEvent()` exige recibir la tx activa. (3) Worker según §5, montado sobre el runner existente de Config→Integraciones; si no existe runner, crear un job Node en el mismo contenedor con intervalo 30s (documentado). (4) Toda transición de estado emite `event.<estado>` genérico además de los específicos de §5. (5) Timeline (A4): pestaña en ficha de evento que lista `domain_events` del agregado + interacciones CRM, orden cronológico inverso.
- **Aceptación:** transición ilegal → 422 (test) · transición legal crea fila en `domain_events` y el worker la marca procesada <60s (test de integración) · handler que lanza error reintenta y tras 5 intentos fija `last_error` (test) · Timeline visible con rol Gerente · suite verde.

#### WP-05 — Corrección del cálculo de coste del escandallo
- **Objetivo:** El escandallo por evento calcula coste real: Σ(qty_base × pax × coste_unitario_base), agrupado por categoría, integrando el motor de bebidas existente sin alterarlo.
- **Dep:** WP-01 · **Paralelizable:** con WP-02.
- **Alcance:** servicio de escandallo; ruta API de escandallo; página `/admin/cocina/escandallos` (solo corrección de datos mostrados, no rediseño).
- **Especificación:** función pura `computeEscandallo(eventId)` en `src/domain/escandallo.ts` que devuelve `{lines[], food_cost, beverage_cost, cost_per_pax}`; los KPIs de la página consumen esta función; coste unitario = precio de proveedor vigente por unidad base.
- **Aceptación:** test con fixture (receta de 3 ingredientes, 100 pax) cuyo total cuadra a mano con decimales exactos · la página muestra los mismos números que la función (test de API) · suite verde.

**GATE OLA 1:** todos los WP-01..05 aceptados + `docs/UNIT-MIGRATION-REPORT.md` y `docs/FK-AUDIT.md` revisados por humano (decision gate de Orca) antes de continuar.

### OLA 2 — Ciclo compras y trazabilidad (Fase 1)

#### WP-06 — Órdenes de compra y explosión de necesidades **[COMPLEJO]**
- **Objetivo:** Nueva ruta `/admin/cocina/compras`: OC con ciclo borrador→enviada→recibida y generación automática de necesidades: `max(0, escandallo×pax − stock_disponible)` agrupado por proveedor preferente.
- **Dep:** WP-02, WP-04, WP-05 · **Paralelizable:** con WP-08, WP-10.
- **Alcance:** migración (§4 compras); `src/domain/purchasing.ts`; rutas API nuevas `/api/purchase-orders*`; página nueva; handler de `portal.frozen` (registrado, activo desde OLA 6); generación de PDF reutilizando el generador existente de presupuestos.
- **Especificación:** (1) `explodeNeeds(eventId)` usa `computeEscandallo` + stock cache; ingredientes sin proveedor → grupo "sin proveedor" (bloquea envío de esa línea, no de la OC). (2) Botón "Generar compra" en escandallo crea OCs en borrador con `event_id`. (3) Enviar = estado 'enviada' + PDF + email al proveedor (SMTP existente). (4) Roles: Jefe Cocina y superiores. (5) Precio de línea precargado del histórico proveedor-ingrediente.
- **Aceptación:** fixture: evento 100 pax con stock parcial genera OC con cantidades netas exactas (test) · OC enviada genera PDF y email (test con SMTP mock) · RBAC verificado (Camarero → 403) · suite verde.

#### WP-07 — Recepción unificada APPCC ↔ stock ↔ OC
- **Objetivo:** Validar la recepción APPCC de una línea de OC da entrada al stock con lote/caducidad y actualiza el precio del proveedor si cambió. Un solo acto, tres efectos.
- **Dep:** WP-06 · **Paralelizable:** con WP-09.
- **Alcance:** formulario APPCC-Recepción existente (extensión, no reemplazo); servicio de recepción; migración menor (FK `stock_movements.purchase_order_line_id`).
- **Especificación:** (1) El formulario APPCC-Recepción añade selector opcional "Línea de OC pendiente" (las líneas 'pendiente'/'recibida_parcial' del proveedor tecleado). (2) Al validar con línea seleccionada, en una tx: registro APPCC (flujo actual intacto) + `stock_lots` + movimiento 'entrada' + actualización `qty_received_base` y estados de línea/OC + si el precio difiere, actualizar histórico proveedor y emitir `ingredient.price_changed` + emitir `purchase_order.received`. (3) Sin línea seleccionada, el formulario funciona exactamente como hoy (NR-2).
- **Aceptación:** recepción con OC crea las 4 escrituras en una tx (test de integración; forzar fallo a mitad → rollback total) · recepción sin OC = comportamiento actual (test de regresión) · suite verde.

#### WP-08 — Reposición automática por mínimos
- **Objetivo:** Handler de `stock.below_minimum` que agrega faltantes en una "propuesta de compra semanal" (OC borrador sin `event_id`, una por proveedor, reutilizada si ya existe en borrador).
- **Dep:** WP-06 · **Paralelizable:** con WP-07, WP-09, WP-10.
- **Alcance:** `src/domain/handlers/stockBelowMinimum.ts`; badge de alertas en panel Cocina.
- **Especificación:** cantidad propuesta = (mínimo × 2) − stock actual, redondeada hacia arriba a la unidad de compra habitual del proveedor si existe conversión; no duplicar líneas si el ingrediente ya está en la OC borrador (actualizar cantidad).
- **Aceptación:** bajar stock bajo mínimo genera/actualiza línea en OC borrador (test) · no crea OCs duplicadas en 5 emisiones seguidas (test de idempotencia) · suite verde.

#### WP-09 — Consumo por evento desde Carga y retorno
- **Objetivo:** Marcar ítems en Carga descuenta stock imputado al evento; el control ida/vuelta de Logística reingresa lo no consumido; la diferencia se registra como merma del evento.
- **Dep:** WP-02, WP-07 · **Paralelizable:** con WP-08, WP-10.
- **Alcance:** servicios de Carga y Logística; UI existente de ambas (añadir feedback de stock, no rediseñar).
- **Especificación:** (1) Check de ítem de comida en Carga → movimiento 'salida' con `event_id` (des-check → movimiento inverso). (2) En Logística-vuelta, sección "Retorno de consumibles": cantidad devuelta → movimiento 'retorno'; al cerrar la vuelta, `salidas − retornos` por ingrediente → movimiento 'merma' con `event_id`. (3) FEFO: las salidas descuentan del lote con caducidad más próxima (`stock_lots.qty_base_remaining`).
- **Aceptación:** ciclo completo en test de integración: cargar 10, devolver 3 → merma 7 imputada al evento y lotes cuadran · stock cache = Σ movimientos tras el ciclo · suite verde.

#### WP-10 — Vista de trazabilidad por lote
- **Objetivo:** Nueva vista en Inventario: dado un lote, ver proveedor, recepción APPCC, y a qué eventos/platos fue (vía movimientos). Exportable a PDF (inspección sanitaria).
- **Dep:** WP-07 · **Paralelizable:** con WP-08, WP-09.
- **Alcance:** ruta API `/api/traceability/lot/[id]`; página nueva enlazada desde Inventario; generador PDF existente.
- **Aceptación:** fixture con lote usado en 2 eventos muestra ambos con fechas (test) · PDF se genera · rol Analista puede ver, Camarero no · suite verde.

**GATE OLA 2:** aceptación de WP-06..10 + prueba manual guiada: crear evento de prueba → generar compra → recibir → cargar → retornar; el coordinador verifica que `SELECT` de movimientos del evento cuadra.

### OLA 3 — Catálogo de menús (Fase 2)

#### WP-11 — Unificación platos/recetas **[COMPLEJO]**
- **Objetivo:** Una sola entidad plato/receta con dos vistas (Sala y Cocina), según la duplicidad documentada en WP-00 §3.5.
- **Dep:** WP-00 (informe duplicidad) · **Paralelizable:** no (toca entidad central).
- **Especificación:** Si son dos tablas: elegir como canónica la de recetas (tiene ingredientes), añadir columnas que solo existan en la otra, backfill por matching de nombre normalizado (informe `docs/DISH-MERGE-REPORT.md` con no-matcheados para humano), crear VISTA SQL con el nombre de la tabla vieja para no romper lecturas (NR-2), redirigir escrituras de la API de catálogo a la canónica. Si ya es una tabla: solo consolidar servicios duplicados.
- **Aceptación:** `/admin/catalog` y `/admin/cocina/recetas` muestran el mismo conjunto (test de API comparando ambos endpoints) · 135 recetas siguen presentes (`count` idéntico al baseline) · suite verde.

#### WP-12 — Entidad Menú con estados, versionado y variantes
- **Objetivo:** Nueva ruta `/admin/menus` con el modelo §4: composición por secciones, estados borrador→publicado→pausado→retirado, versionado inmutable, variantes por dieta.
- **Dep:** WP-11 · **Paralelizable:** con WP-13 tras acordar interfaz (mismo agente o secuencial recomendado).
- **Especificación:** coste del menú = Σ coste platos (de `computeEscandallo` a nivel plato) ÷ estructura por pax; margen = (PVP−coste)/PVP mostrado en la ficha; regla de inmutabilidad de §4 aplicada en servicio (editar menú publicado con `event_menus` → clonar a versión+1); emitir `menu.published`.
- **Aceptación:** editar menú publicado vinculado a evento crea versión nueva y NO altera la vinculada (test) · solo 'publicado' aparece en el endpoint público (test) · RBAC: Gerente/Admin editan, Jefe Cocina consulta coste · suite verde.

#### WP-13 — Coste vivo y alertas de margen
- **Objetivo:** Handler de `ingredient.price_changed`: recalcular coste de platos afectados → menús afectados; si el margen de un menú publicado cae bajo umbral configurable (default 20%, en Config), alerta en dashboard + email a Gerente.
- **Dep:** WP-12 · **Paralelizable:** con WP-14.
- **Aceptación:** subir precio de un ingrediente presente en un menú publicado dispara recálculo y alerta si margen<umbral (test de integración vía outbox) · suite verde.

#### WP-14 — Configurador web sobre menús publicados
- **Objetivo:** El configurador público pasa de formulario genérico a ofrecer los menús 'publicado' reales con precio/pax; la selección queda en el lead creado.
- **Dep:** WP-12 · **Paralelizable:** con WP-13.
- **Alcance:** página `/configurador` (extensión); endpoint público `GET /api/public/menus`; campo `menu_id` en lead (migración menor).
- **Aceptación:** el configurador lista solo menús publicados (test) · lead creado guarda el menú y se ve en el panel del lead (test) · flujo actual sin selección de menú sigue funcionando (NR-2, test de regresión) · suite verde.

**GATE OLA 3:** aceptación WP-11..14 + revisión humana de `DISH-MERGE-REPORT.md`.

---

## §7. WORK PACKAGES — OLAS 4 A 6

### OLA 4 — Orquestación del evento y staffing (Fase 3)

#### WP-15 — Plantillas automáticas por tipo de venue
- **Objetivo:** Handler de `event.confirmed`: si `venue_type='externo'` genera esqueleto de logística, packs, timing por defecto y centro APPCC "Truck Externo" para la fecha; si `'benitez'`, checklist de sala y mapa de mesas base del salón.
- **Dep:** WP-04 · **Paralelizable:** con WP-16, WP-17.
- **Especificación:** las plantillas viven en datos (`event_templates` JSONB en Config, editables por Admin), no hardcodeadas; el handler es idempotente (re-confirmar no duplica).
- **Aceptación:** confirmar evento externo crea registros de logística/timing/APPCC vinculados (test) · confirmarlo dos veces no duplica (test) · plantilla editable desde Config · suite verde.

#### WP-16 — Plan de transporte (eventos externos)
- **Objetivo:** Pestaña "Transporte" en Logística: vehículos, conductor (empleado), hora de salida calculada hacia atrás desde el primer hito del timing (hora llegada − trayecto estimado − margen configurable 30min).
- **Dep:** WP-15 · **Paralelizable:** con WP-17, WP-18.
- **Aceptación:** cambiar la hora de llegada del timing recalcula la hora de salida (test) · solo visible si `venue_type='externo'` · suite verde.

#### WP-17 — Planificación de personal y turnos **[COMPLEJO]**
- **Objetivo:** Necesidades por evento (plantilla por pax configurable, p.ej. 1 camarero/15 pax) → turnos ofrecidos a empleados por email con enlace de confirmación (`offer_token`) → turno confirmado precarga el registro de horas del evento.
- **Dep:** WP-04, WP-15 · **Paralelizable:** con WP-16, WP-18.
- **Alcance:** migración (§4 staffing); nueva sección Staffing→Planificación; página pública mínima `/turno/[token]` (aceptar/rechazar, sin login); integración con Control de Horas existente.
- **Especificación:** al confirmarse el evento se generan `event_staff_requirements` desde plantilla; el Maitre asigna empleados → `shift.offered` → email; respuesta por token → estado + `shift.confirmed`; al pasar el evento a `en_curso`, los turnos confirmados crean filas de horas 'pendiente' con las horas planificadas, editables después (flujo de aprobación existente intacto).
- **Aceptación:** ciclo ofrecer→confirmar→precarga de horas en test de integración · token inválido/caducado → 404 (test) · doble clic en aceptar no duplica (test) · suite verde.

#### WP-18 — Cierre operativo del evento
- **Objetivo:** Pestaña "Cierre" en ficha de evento con checklist §4 (`event_closure_checklists`); los 4 checks se autocompletan desde sus fuentes (logística retornada WP-09, mermas WP-09, horas aprobadas, APPCC sin incidencias abiertas del día) y son sobreescribibles por Gerente con motivo; al completarse, transición `en_curso→cerrado_operativo` (vía máquina de estados) y emisión de `event.operationally_closed`.
- **Dep:** WP-04, WP-09, WP-17 · **Paralelizable:** con WP-19, WP-20.
- **Aceptación:** con checklist incompleto la transición devuelve 422 (test) · completo → estado cambia y evento de dominio emitido (test) · suite verde.

#### WP-19 — Hoja de servicio
- **Objetivo:** PDF/vista móvil generada por evento: timing + distribución por zonas + turnos confirmados + dietas especiales por mesa (de invitados). Botón en Producción.
- **Dep:** WP-17 · **Paralelizable:** sí.
- **Aceptación:** PDF generado con fixture completo contiene las 4 secciones (test de snapshot) · accesible a todos los roles operativos · suite verde.

#### WP-20 — Vajilla y packs automáticos
- **Objetivo:** Completar lo "en desarrollo": necesidades de vajilla = f(pax, nº pases del menú del evento); packs (Camareros/Alérgenos/Supervivencia) generados según plantilla y dietas de invitados; ambos aparecen en Carga como hoy pero precalculados.
- **Dep:** WP-12 (menú define pases), WP-15 · **Paralelizable:** sí.
- **Aceptación:** evento 100 pax, menú 5 pases → 500 juegos calculados (test) · invitado celíaco en el evento → pack alérgenos incluye ítems sin gluten (test) · suite verde.

**GATE OLA 4:** WP-15..20 aceptados + simulacro: evento externo de prueba confirmado genera todo el andamiaje sin intervención manual (verificación del coordinador con checklist).

### OLA 5 — Finanzas por hitos (Fase 4)

#### WP-21 — Plan de pagos, hitos y recordatorios
- **Objetivo:** `payment_plans`/`payment_milestones` (§4); al aceptar un presupuesto se genera plan default (señal 40% a 7 días, resto 60% a evento−7días; porcentajes/plazos en Config); job diario emite `payment.milestone_due` → email recordatorio al cliente + alerta dashboard; hito vencido → estado 'vencido' + aviso destacado.
- **Dep:** WP-03, WP-04 · **Paralelizable:** con WP-23.
- **Aceptación:** aceptar presupuesto crea plan con importes exactos (test) · job marca vencidos y envía email (test con reloj simulado y SMTP mock) · suite verde.

#### WP-22 — Automatismo de señal pagada **[COMPLEJO]**
- **Objetivo:** Registrar un cobro contra el hito 'senal' (extensión del formulario de cobros existente: selector de hito) marca el hito 'pagado' y emite `deposit.paid`; su handler ejecuta la transición del evento a 'confirmado' (si procede) — la creación del portal se activa en OLA 6 sobre este mismo evento de dominio.
- **Dep:** WP-21 · **Paralelizable:** con WP-23, WP-24.
- **Especificación:** el formulario de cobros sin selección de hito funciona como hoy (NR-2); cobro parcial de un hito lo deja 'pendiente' con acumulado visible; cobro que completa el importe → 'pagado'.
- **Aceptación:** cobro completo de señal → hito pagado + evento confirmado + fila en domain_events (test de integración) · cobro sin hito = flujo actual (regresión) · suite verde.

#### WP-23 — Facturación por hitos
- **Objetivo:** Factura de anticipo por hito pagado (opcional, botón) y factura final que deduce anticipos; numeración F-AAAA-NNNN existente intacta; estructura de datos preparada para Verifactu (campos reservados documentados, sin implementarlo).
- **Dep:** WP-21 · **Paralelizable:** con WP-22.
- **Aceptación:** factura final de un evento con señal facturada muestra base − anticipo con IVA correcto (test con caso numérico cerrado) · numeración sin huecos ni duplicados en test concurrente · suite verde.

#### WP-24 — Cierre económico del evento
- **Objetivo:** Handler de `event.operationally_closed`: calcular `event_financial_closures` (§4) — previsto (escandallo WP-05 + staff planificado WP-17) vs real (mermas+consumos WP-09, horas aprobadas, compras imputadas WP-06, extras WP-29) — y mostrarlo en Finanzas→Rentabilidad (la página existente pasa a leer datos reales cuando existen, estimados si no, con etiqueta "estimado/real"). Transición manual final `cerrado_operativo→cerrado_contable` por Gerente, que congela la fila.
- **Dep:** WP-18, WP-21 · **Paralelizable:** con WP-22, WP-23.
- **Aceptación:** fixture completo produce margen real correcto a mano (test) · evento cerrado contablemente rechaza nuevos cobros/gastos imputados (test 422) · suite verde.

**GATE OLA 5:** WP-21..24 aceptados + caso de negocio completo simulado (presupuesto→señal→evento→cierre) validado por humano.

### OLA 6 — Portal del cliente (Fase 5)

#### WP-25 — Infraestructura del portal **[COMPLEJO]**
- **Objetivo:** Rutas públicas `/portal/[token]`; creación automática al `deposit.paid` (handler nuevo); acceso adicional por magic link al email del cliente (genera token de sesión corto); scope de datos estricto al `event_id` del portal; página Inicio (F2: resumen, pagos, cuenta atrás, fecha de congelación); email de bienvenida con el enlace.
- **Dep:** WP-22 · **Paralelizable:** no (base del resto de la ola).
- **Especificación de seguridad:** token ≥32 bytes aleatorios, almacenado hasheado; middleware único `withPortalAuth()` que resuelve token→event_id y lo inyecta: **ninguna ruta del portal acepta event_id del cliente**; rate limit básico por IP en rutas públicas; portal 'congelado' → middleware fuerza solo-lectura (POST/PUT/DELETE → 423).
- **Aceptación:** pagar señal crea portal y envía email (test) · token de otro evento no accede a datos ajenos (test negativo obligatorio) · portal congelado rechaza escrituras con 423 (test) · suite verde.

#### WP-26 — Portal: invitados y RSVP
- **Objetivo:** El cliente gestiona su lista (alta, edición, importación CSV), lanza invitaciones RSVP reutilizando el formulario público existente de invitados, y ve dietas/alergias consolidadas. Sincronización total con Sala→Invitados (misma tabla, sin duplicar).
- **Dep:** WP-25 · **Paralelizable:** con WP-27, WP-28, WP-29, WP-30.
- **Aceptación:** invitado creado en portal aparece en admin al instante y viceversa (test sobre misma tabla) · import CSV de 50 filas con 2 erróneas: 48 altas + reporte de errores (test) · emite `portal.updated` · suite verde.

#### WP-27 — Portal: distribución de mesas
- **Objetivo:** Versión simplificada del editor de mapa de mesas (componente existente en modo restringido: mover invitados entre mesas sí, editar plano no) sobre el plano real del salón; solo invitados confirmados son asignables.
- **Dep:** WP-25, WP-26 · **Paralelizable:** con WP-28, WP-29, WP-30.
- **Aceptación:** asignación desde portal visible en admin (misma tabla) · invitado no confirmado no asignable (test) · aforo de mesa no superable (test) · emite `portal.updated` · suite verde.

#### WP-28 — Portal: menú y variantes por invitado
- **Objetivo:** El cliente ve su menú contratado (versión congelada) y asigna variantes (infantil, celíaco, vegetariano) por invitado, alimentando dietas (WP-26) y packs (WP-20).
- **Dep:** WP-25, WP-12 · **Paralelizable:** sí (resto de ola).
- **Aceptación:** variante asignada aparece en dietas del invitado y en el cálculo de packs (test) · el cliente no puede cambiar de menú, solo variantes (test 403) · suite verde.

#### WP-29 — Portal: extras y decoración
- **Objetivo:** `extras_catalog` administrable en `/admin/extras` (CRUD, foto, precio, unidad); en el portal, catálogo visual; seleccionar añade `event_extras` con `price_snapshot` y **línea automática en el presupuesto/plan de pagos** (hito 'extra' o incremento del hito 'resto' según Config).
- **Dep:** WP-25, WP-21 · **Paralelizable:** sí (resto de ola).
- **Aceptación:** seleccionar 10 centros de mesa añade línea con importe exacto al plan (test) · deseleccionar antes de congelar la retira (test) · precio del catálogo cambia después → snapshot intacto (test) · suite verde.

#### WP-30 — Portal: mensajería integrada en CRM
- **Objetivo:** Hilo cliente↔equipo (`event_messages`); cada mensaje del cliente crea interacción CRM en el lead/cliente y notificación interna; respuesta del equipo desde la ficha del evento.
- **Dep:** WP-25 · **Paralelizable:** sí (resto de ola).
- **Aceptación:** mensaje de portal → interacción CRM visible (test) · contador de no leídos correcto en ambos lados (test) · suite verde.

#### WP-31 — Congelación y disparo de la cadena operativa **[COMPLEJO]**
- **Objetivo:** Job diario: portales con `freeze_date <= hoy` y estado 'activo' → 'congelado' + email resumen al cliente (PDF con invitados, mesas, variantes, extras) + `portal.frozen`. Handlers de `portal.frozen`: explosión de compras (WP-06), plantillas/ajustes de producción (WP-15), staffing definitivo (WP-17), vajilla/packs (WP-20) — recalculados con pax e invitados definitivos.
- **Dep:** todos los WP de OLA 6 + WP-06, WP-15, WP-17, WP-20 · **Paralelizable:** no (integración final).
- **Aceptación:** test de integración end-to-end: evento con portal poblado alcanza freeze_date simulada → portal solo-lectura + OCs generadas con cantidades netas del pax final + turnos recalculados + packs correctos, todo verificado por SQL en el test · idempotente si el job corre dos veces (test) · suite verde.

**GATE OLA 6 (FINAL):** WP-25..31 aceptados + ensayo general con un evento real ficticio recorrido por un humano de principio a fin (lead → presupuesto → señal → portal → congelación → evento → cierre operativo → cierre contable) con checklist firmado.

---

## §8. PLAN DE DESPACHO EN ORCA (matriz de olas)

| Ola | WPs en paralelo | Secuenciales dentro de la ola | Gate |
|---|---|---|---|
| 0 | — | WP-00 | docs generados + baseline |
| 1 | WP-01 ∥ WP-03 ∥ WP-04 | luego WP-02 ∥ WP-05 (dependen de WP-01) | Gate Ola 1 + revisión humana de informes |
| 2 | WP-06 primero; luego WP-07 ∥ WP-08 ∥ WP-09 ∥ WP-10 | WP-07 antes de cerrar WP-09/10 | Gate Ola 2 + prueba manual |
| 3 | WP-11 solo; luego WP-12; luego WP-13 ∥ WP-14 | — | Gate Ola 3 + revisión merge de platos |
| 4 | WP-15 primero; luego WP-16 ∥ WP-17; luego WP-18 ∥ WP-19 ∥ WP-20 | — | Gate Ola 4 + simulacro |
| 5 | WP-21 primero; luego WP-22 ∥ WP-23; luego WP-24 | — | Gate Ola 5 + caso completo |
| 6 | WP-25 primero; luego WP-26..30 en paralelo; WP-31 al final | — | Gate final + ensayo general |

Reglas de despacho:
- **Un WP = un worktree = una rama** `wpXX-descripcion`. Merge solo tras gate del WP (tests + aceptación) ejecutado por el coordinador, y merges de una ola integrados y con suite verde en la rama principal antes de despachar la siguiente.
- Conflictos de merge dentro de una ola: resolver en orden de número de WP; el WP posterior rebasea.
- Los **decision gates** de Orca marcados "revisión humana" requieren tu aprobación explícita (informes de migración de unidades, FK huérfanas, fusión de platos): son los tres puntos donde un agente NO debe decidir solo.

## §9. PROTOCOLO DE VERIFICACIÓN Y NO-REGRESIÓN

1. **Por WP (ejecuta el agente, verifica el coordinador):** suite completa verde (o igual a TEST-BASELINE) → comandos de Aceptación del WP con salida adjunta → `git diff --stat` sin archivos fuera de Alcance → migración aplicada e idempotente (aplicarla dos veces no falla).
2. **Por ola (ejecuta el coordinador en la rama integrada):** suite + smoke test HTTP de las ~137 rutas del API-MAP (script generado en WP-00: cada ruta responde el mismo código de estado que en baseline) + arranque limpio de Docker Compose.
3. **Continuo:** si en cualquier momento un agente detecta que necesita violar una NR-* para avanzar, se detiene y reporta. La spec se corrige (por humano o coordinador Pro), nunca se ignora.

## §10. DEFINICIÓN DE HECHO GLOBAL

El proyecto está completo cuando: (a) los 31 WPs pasaron sus gates; (b) el ensayo general del Gate Final se completa sin intervención manual en los automatismos (compras, portal, turnos, cierres se generan solos); (c) la suite de tests supera el baseline inicial en cobertura de los flujos nuevos; (d) `docs/` contiene SCHEMA-MAP, API-MAP, los tres informes de migración revisados y un CHANGELOG por ola; (e) ningún endpoint ni página del sistema original ha cambiado de contrato salvo las extensiones autorizadas.
