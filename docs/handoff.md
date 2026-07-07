## Último agente: Hermes
## Fecha: 03/07/2026 21:15
## Rama: main
## Último commit: 68b32cd

### Qué se hizo - Auditoría adversarial
- [x] Fase 0: Crashes de esquema confirmados (recipes INSERT $13, stock_entries cost_price, guest columns)
- [x] Fase 1: 8 arreglos mecánicos (recipes, signal route, ocr/apply, workers, zod, assignments, passes, docena)
- [x] Fase 2: 8 tareas seguridad (appcc allowlist, cron auth, webhook fail-closed, rate-limit login, dead code, invoices)
- [x] Fase 3: Flujos rotos (guest-forms validation, VALID_EVENT_STATUSES aligned, FWD-3 atómico con deposit sync, kids tables en calculate, INV-2 atómico)
- [x] Fase 5: fix-cocina-theme.py eliminado
- [x] Fase 6: nodemailer eliminado de package.json (no se usa)

### Pendiente
- [ ] T3.1 — 🔸 WhatsApp invite (decidir si usar /api/invite directo o Twilio)
- [ ] T3.3 — 🔸 guest_count en cambio de estado (decidir si se actualiza automático)
- [ ] T3.9 — 🔸 briefings sin staffing (decidir si se permite)
- [ ] Fase 4: 8 tareas integridad transaccional restantes (INV-3, INV-4, INV-5 atomic)
- [ ] Fase 7: Documentación
- [ ] Deploy a VPS (main build + restart)

### Decisiones clave
- Ponytail: raíz de todos los problemas = estados no alineados entre código/BD/middleware + operaciones no atómicas
- FWD-3 ya no delega vía HTTP loopback, usa pool directo + BEGIN/COMMIT
- INV-2 convertido a transacción atómica
- Calculate route ahora separa mesas adultos/infantiles con kids_count

### Observaciones
- El proyecto necesita una migración de esquema que unifique todas las CHECK constraints
- Los errores de LSP son todos de node_modules de Next.js (pre-existentes)
- Tests de regresión pendientes: 290/290 del plan original
