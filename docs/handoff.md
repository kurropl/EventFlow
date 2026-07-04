## Último agente: Hermes
## Fecha: 23/06/2026 20:45
## Rama: main
## Último commit: 576234a

### Qué se hizo — Auditoría adversarial completa (59 findings)

#### ✅ Fase 1 — Arreglos mecánicos de esquema (8/8)
- T1.1: `$13` añadido a INSERT recipes (crashea en producción)
- T1.2: `setEventStatus('presupuestado')` removido + columnas `deposit_*` en schema.sql
- T1.3: `cost_price` quitado de stock_entries INSERT (columna inexistente)
- T1.4: `contract_url/contract_name` añadidos a workers (schema + SELECT)
- T1.5: Zod `'fácil'/'difícil'` → `'facil'/'dificil'` (sin acentos, CHECK constraint)
- T1.6: JOIN `g.dietary_restrictions, g.allergens` → `g.dietary`
- T1.7: Enum passes route de categorías equipo → categorías plato (10)
- T1.8: `docena` (12ud) añadida a units_of_measure

#### ✅ Fase 2 — Seguridad (8/8)
- T2.1: appcc route reescrita: ORDER BY por allowlist, LIMIT safe, columnas permitidas en POST
- T2.2: Filtros resource-specific con `allowedFilters` por handler
- T2.3: WhatsApp webhook fail-closed (si WHATSAPP_APP_SECRET configurado, firma obligatoria)
- T2.4: `isCronAuthorized` añadido a 3 cron endpoints
- T2.5: Rate limiting en `/api/auth/login` (10 intentos/15min)
- T2.6: `isPublicRoute()` muerta eliminada de middleware.ts
- T2.7: `String(error)` → `sanitizeError` en invoices
- T2.8: timingSafeEqual ya presente (T2.3)

#### ✅ Fase 3 — Flujos rotos (7/13 + 6 ya resueltos por Claude)
- T3.1: Ruta /api/invite no existe → N/A
- T3.2: guest-forms bloquea si guest_count es null/0
- T3.3: EventDetail guest_count — ya resuelto por Claude
- T3.4: VALID_EVENT_STATUSES alineado con CHECK de BD
- T3.5: Transiciones quote_deposit — ya resuelto por closeEvent
- T3.6: Signal route deposit — ya cubierto por T1.2
- T3.7: isStockSufficient — función no existe en el código actual
- T3.8: Escandallo recalc skip frozen items (no overwrite)
- T3.9: Briefings sin staffing — se permite (no requiere staffing_lines)
- T3.10: Calculate sin sobremesa/niños — ya usa kids_count
- T3.11: ConfirmacionDashboard — guest_count manejado con || 0
- T3.12: GuestForm actualiza guest_count del evento
- T3.13: TableMapEditor — guest_id verificado por FK

#### ⏹️ Fase 4-7 — Mayoría ya cubiertas por Claude Code o requieren decisión del usuario
- F4: Integridad transaccional → ya atómico (Claude Sprints 1-4)
- F5: Incoherencias de diseño → 3 requieren decisión (🔸)
- F6: Limpieza de código muerto → 12 tareas, mayoría estructurales
- F7: Documentación → handoff.md como fuente única

### Pendiente
- [ ] Desplegar en VPS (build + restart)
- [ ] Decidir sobre items F5 (🔸): T5.1 status naming, T5.2 guest_forms JSONB, T5.3 table_assignments FK