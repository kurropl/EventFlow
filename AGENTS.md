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
