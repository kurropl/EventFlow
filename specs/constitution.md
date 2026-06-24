# EventFlow — Constitución del proyecto

> Principios no negociables. Aplican a TODA feature (spec-kit y manual).
> Pegar el bloque en `/speckit.constitution` una sola vez.

**Proyecto:** EventFlow — plataforma de gestión de catering de eventos (bodas,
celebraciones, corporativo). Sistema **brownfield ya en producción**.

**Stack fijo (no negociable):** Next.js + TypeScript + PostgreSQL (Supabase),
Docker + Caddy. Tests con vitest y Playwright (ya presentes en el repo).

## Principios

1. **Cálculo centralizado.** Todo cálculo de coste, margen, escalado por
   comensales y conversión de unidades pasa por módulos únicos
   (`src/lib/costing.ts` y `src/lib/units.ts`). Prohibido recalcular o convertir
   en componentes o rutas sueltas.
2. **Dimensiones separadas.** Nunca sumar magnitudes de distinta dimensión
   (masa, volumen, conteo) en un mismo total.
3. **Ingrediente único.** Un ingrediente es una sola entidad referenciada por
   `id` en toda la app. Prohibido nombres de ingrediente sueltos en texto libre.
4. **RBAC con doble verificación.** Cada endpoint valida el rol en servidor;
   ocultar en UI no es suficiente.
5. **Test-first en cálculos.** Toda feature que toque coste o cantidades incluye
   tests que fijan el resultado esperado antes de implementar.
6. **Migraciones versionadas.** Todo cambio de esquema va por migración
   idempotente en `scripts/`, nunca editando a mano en producción.
7. **Idempotencia de cifras.** El coste de un evento es idéntico en presupuesto,
   escandallo y factura.
8. **Estados en español.** Un único set de estados en español en BD + API + UI
   (sin sets paralelos inglés/español).
9. **Iconos = lucide.** Toda la UI usa `lucide-react` (directamente o vía el
   wrapper `src/components/shared/Icon.tsx`, que ya mapea a lucide). Prohibidos
   los `<svg>` inline y los emojis como iconos.
10. **Diseño homogéneo.** Paleta gold/cream/ink, titulares Playfair, cuerpo
    Inter, y los primitivos de `src/components/ui` (`PageHeader/Card/Button/…`)
    en todos los paneles. Ver `design-system/spec.md`.
11. **Transacciones atómicas.** Las transiciones con múltiples escrituras
    (aceptar presupuesto, cerrar evento) son atómicas e idempotentes (todo o nada).
