## Último agente: Claude Code
## Fecha: 28/06/2026 19:50
## Rama: main
## Último commit: (ver `git log -1`, tras este handoff)

### Qué se hizo
- [x] Verificado el merge de Hermes (commit 929f8c1, resuelve conflicto en
  CocinaPanel.tsx/PremiumTableMapEditor.tsx/Icon.tsx con FASE 4+5) — los
  cambios de FASE 5 (passOptions, SHEET_ROUTE, flattenSheet) sobrevivieron
  intactos a la resolución de conflicto.
- [x] Re-ejecutada la batería completa de verificación sobre `main` tras el
  merge: `verify-e2e.sh` 32/32, `verify-rbac-cocina.sh` 41/41,
  `verify-operativos.sh` 14/14, build de producción exit 0. Todo verde.
- [x] Confirmado: landing + configurador + admin/ERP (incluida Cocina) viven
  todos en `main`, una sola rama. La rama huérfana
  `claude/event-venue-redesign-JAUif` queda obsoleta (sin ancestro común,
  superada por `main` en todo — branding, landing, configurador y ERP
  completo); no se ha borrado, a la espera de confirmación del usuario.

### En progreso
- [ ] Nada abierto por mi parte en este momento.

### Decisiones
- Rama única: `main` (todas las sesiones, todos los agentes).
- Handoff en `docs/handoff.md` (leer al empezar, escribir al terminar).
- Siempre `git fetch origin && git log --oneline -5 origin/main` antes de
  empezar a codificar.
- Antes de avanzar de fase/feature: 3 E2E (32/32, 41/41, 14/14) + build.
- `verify-erp-conectado.sh`: 16/17 esperado (INV6 diferido a FASE 6 del spec
  001, ver `specs/001-erp-conectado/tasks.md`).

### Pendiente
- [ ] FASE 6 (R6) del spec 001: limpieza de huérfanos (fallback escandallo
  FWD-4, `is_equipment`/`is_dry` en hojas logística, invitados↔
  table_assignments).
- [ ] CIERRE del spec 001 (TZ.1-TZ.4): verify-erp-conectado.sh 100%,
  grep de duplicación en cero, actualizar spec.md → "Implementada".
- [ ] Decidir destino de `claude/event-venue-redesign-JAUif` (borrar /
  documentar como obsoleta / nada) — pendiente de confirmación del usuario.

### Observaciones
- El servidor dev local debe levantarse con `next dev` (no `next start`),
  variables de entorno en el .env de cada sesión; tras cualquier reinicio de
  postgres hay que volver a levantarlo y resembrar `eventflow_verify` con
  `schema.sql` + `scripts/verify-ejemplo-e2e.sql` antes de cada script E2E
  (cada script requiere reseed independiente).
