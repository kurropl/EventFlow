## Último agente: Hermes
## Fecha: 28/06/2026 19:15
## Rama: main
## Último commit: 99c65d9

### Qué se hizo
- [x] APPCC completo (haccp_*, escandallo, API unificada /api/appcc/) - commit 65b6c86
- [x] Briefing camareros (tabla event_briefings, API, UI en EventDetail) - commit 65b6c86
- [x] Señal + flujo aceptación (deposit_pct, POST /api/payments/signal) - commit 99c65d9
- [x] Cierre automático FWD-4 (freeze escandallo + deducir stock + factura) - commit 3542949
- [x] Dashboard confirmación invitados vs mesas (/admin/confirmacion) - commit f53afd9
- [x] Menú por invitado API (/api/guest-menus/[eventId]) - commit f53afd9
- [x] Cálculo automático mesas/camareros (POST /api/event-flow/[eventId]/calculate) - commit f53afd9
- [x] Demo completa + seed de ejemplo (/admin/demo, POST /api/admin/seed-ejemplo) - commit b667ac3
- [x] Ramas unificadas en main - hoy

### En progreso
- [ ] Verificar que VPS corre el build de main
- [ ] Probar flujo E2E en producción

### Decisiones
- Rama única: main (todas las sesiones, todos los agentes)
- Handoff en docs/handoff.md (leer al empezar, escribir al terminar)
- Siempre git fetch + git log antes de empezar a codificar
- VPS: git checkout main, build y deploy

### Pendiente
- [ ] Desplegar main en VPS (ahora mismo está en claude/erp-conectado-001)
- [ ] Crear seed de ejemplo ejecutable

### Observaciones
- Build en VPS tarda ~5-6 minutos (VPS limitado de RAM/CPU)
- DeepSeek v4 flash no soporta visión, no puedo analizar screenshots
