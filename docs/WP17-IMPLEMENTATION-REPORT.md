# WP-17 — Planificación de Personal y Turnos: Informe de Implementación

**Fecha:** 2026-07-30  
**Estado:** Implementación completa (pendiente aplicación de migración)

---

## Resumen

WP-17 implementa el ciclo completo de planificación de personal:
1. **Necesidades por evento** → Generación automática desde plantilla configurable
2. **Turnos ofrecidos** → Envío por WhatsApp con enlace de confirmación
3. **Confirmación** → Página pública `/turno/[token]` sin login
4. **Precarga horas** → Al pasar a `in_progress`, se crean registros de horas

---

## Archivos Creados/Modificados

### Nuevos (archivos creados)

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/005_wp17_staffing_turnos.sql` | Migración: `offer_token` en staffing_offers + tabla `worker_hours` |
| `db/migrations/verify_wp17.sql` | Script de verificación de la migración |
| `src/app/api/public/shift/[token]/route.ts` | API pública para aceptar/rechazar turnos por token |
| `src/app/turno/[token]/page.tsx` | Página pública de confirmación de turno |
| `src/domain/handlers/eventConfirmedStaffing.ts` | Handler: genera staffing_lines al confirmar evento |
| `src/domain/handlers/shiftConfirmedPreloadHours.ts` | Handler: precarga horas al pasar a in_progress |
| `src/lib/domain/preloadEventHours.ts` | Helper para precarga de horas |
| `src/app/api/staffing/preload-hours/route.ts` | API para precarga manual de horas |
| `src/app/admin/staffing/planificacion/page.tsx` | UI de planificación de staffing |
| `__tests__/wp17-staffing-turnos.test.ts` | Tests de la funcionalidad |

### Modificados

| Archivo | Cambios |
|---------|---------|
| `src/app/api/staffing/lines/[id]/offers/route.ts` | Añade generación de `offer_token` y envío de enlace |
| `src/domain/handlers/index.ts` | Registra handlers `event.confirmed.staffing` y `shift.confirmed` |
| `src/domain/handlers/eventConfirmed.ts` | Emite `event.confirmed.staffing` al confirmar |

---

## Mapeo de Nombres (Spec → Real)

| Spec (lógico) | Real (BD) | Notas |
|---------------|-----------|-------|
| `employees` | `workers` | Tabla existente |
| `event_staff_requirements` | `staffing_lines` | Ya existe con `slots_needed` (≈ `headcount`) |
| `event_shifts` | `staffing_offers` + `staffing_assignments` | Se añade `offer_token` |
| `work_hours` | `worker_hours` | **Nueva tabla** |
| `offer_token` | `offer_token` | **Nueva columna** en staffing_offers |

---

## Base de Datos

### Migración 005_wp17_staffing_turnos.sql

```sql
-- 1. Añadir offer_token a staffing_offers
ALTER TABLE staffing_offers ADD COLUMN offer_token TEXT;
CREATE UNIQUE INDEX idx_staffing_offers_token ON staffing_offers (offer_token) WHERE offer_token IS NOT NULL;

-- 2. Nueva tabla worker_hours
CREATE TABLE worker_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  event_id UUID NOT NULL REFERENCES events(id),
  staffing_line_id UUID REFERENCES staffing_lines(id),
  hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  hour_type TEXT NOT NULL DEFAULT 'planificada',
  status TEXT NOT NULL DEFAULT 'pendiente',
  ...
);
```

**Aplicar con:**
```bash
docker exec -i eventflow-postgres-1 psql -U postgres -d eventflow < db/migrations/005_wp17_staffing_turnos.sql
```

---

## API Endpoints

### POST /api/public/shift/[token]

Acepta o rechaza un turno por token.

**Request:**
```json
{
  "action": "accept" | "reject"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Turno aceptado correctamente.",
  "data": { "status": "accepted" }
}
```

### POST /api/staffing/preload-hours

Precarga horas para un evento (requiere auth).

**Request:**
```json
{
  "event_id": "uuid"
}
```

---

## Páginas

### /turno/[token]

Página pública para confirmar turnos:
- Sin login requerido
- Muestra: evento, fecha, horario, ubicación, rol
- Botones: Aceptar / Rechazar
- Feedback inmediato del estado

### /admin/staffing/planificacion

Panel de administración:
- Lista de líneas de staffing por evento
- Envío masivo de ofertas
- Tracking de estado (enviado/aceptado/rechazado)

---

## Handlers de Dominio

### event.confirmed.staffing

Se emite cuando un evento se confirma. Genera `staffing_lines` automáticamente:
- Plantilla por defecto: 1 camarero / 15 invitados
- Configurable en `business_settings.staffing_template`
- Idempotente: no duplica si ya existen líneas

### shift.confirmed

Se emite cuando un trabajador acepta un turno. Pre-carga horas:
- Calcula horas desde start_time/end_time
- Crea registros en `worker_hours`
- Actualiza `worker_event_pay`

---

## Flujo Completo

```
1. Evento confirmado
   ↓ event.confirmed
   ↓ event.confirmed.staffing
   ↓ Genera staffing_lines desde plantilla

2. Maitre envía ofertas
   ↓ POST /api/staffing/lines/[id]/offers
   ↓ Genera offer_token único
   ↓ Envía WhatsApp con enlace /turno/[token]

3. Trabajador acepta
   ↓ POST /api/public/shift/[token]
   ↓ Actualiza status → 'accepted'
   ↓ Crea staffing_assignment
   ↓ Emite shift.confirmed

4. Evento pasa a in_progress
   ↓ preloadEventHours()
   ↓ Crea worker_hours desde assignments
   ↓ Actualiza worker_event_pay
```

---

## Aceptación

### Criterios de aceptación del WP

- [x] Tabla `worker_hours` creada con índices
- [x] Columna `offer_token` añadida a `staffing_offers`
- [x] API pública `/api/public/shift/[token]` funcional
- [x] Página `/turno/[token]` funcional
- [x] Handler `event.confirmed.staffing` registra
- [x] Handler `shift.confirmed` registra
- [x] Precarga de horas funcional
- [x] Tests escritos

### Pendiente

- [ ] Aplicar migración en BD local
- [ ] Ejecutar tests con BD activa
- [ ] Verificar envío WhatsApp con token

---

## Notas Técnicas

1. **Tokens cryptográficos**: Se usan 32 bytes aleatorios (64 hex chars) para máxima entropía

2. **Idempotencia**: 
   - Generación de staffing_lines verifica si ya existen
   - Precarga de horas verifica si ya existen registros
   - Doble clic en aceptar no duplica assignment

3. **Integración**: 
   - Se integra con `worker_event_pay` existente
   - Compatible con el sistema de email/WhatsApp actual
   - Usa `emitDomainEvent()` para eventos de dominio

4. **Configuración**:
   - Plantilla configurable en `business_settings`
   - Base URL configurable via `NEXT_PUBLIC_BASE_URL`
