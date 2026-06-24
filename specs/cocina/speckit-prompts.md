# EventFlow — Prompts `/speckit.specify` listos para copiar y pegar

> **Cómo usar este archivo**
> 1. Una rama git por feature, en el orden indicado: `git checkout -b 001-saneamiento-unidades`
> 2. Copia el bloque ENTERO de esa feature (todo lo que hay bajo "PEGAR EN /speckit.specify") y pégalo tras escribir `/speckit.specify` en tu agente.
> 3. spec-kit detecta la feature por la rama git activa.
> 4. Después tú grilleas: `/speckit.clarify` → `/speckit.checklist` → `/speckit.plan` → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`.
>
> Los prompts están redactados en clave **qué/por qué** (sin detalle técnico: eso va en `/speckit.plan`). Las decisiones abiertas van marcadas como `[NEEDS CLARIFICATION]` para que `/speckit.clarify` te pregunte.
>
> **Constitución primero** (una sola vez, antes de la rama 001): ver bloque 0.

---

## 0 · Constitución (ejecutar una vez, antes de todo)

> Escribe `/speckit.constitution` y pega:

```
Proyecto: EventFlow — plataforma de gestión de catering de eventos (bodas, celebraciones, corporativo). Sistema brownfield ya en producción.

Stack fijo (no negociable): Next.js + TypeScript + PostgreSQL (Supabase), Docker + Caddy. Tests con vitest y Playwright (ya presentes en el repo).

Principios no negociables:
1. Cálculo centralizado: todo cálculo de coste, margen, escalado por comensales y conversión de unidades pasa por módulos únicos (src/lib/costing.ts y src/lib/units.ts). Prohibido recalcular o convertir en componentes o rutas sueltas.
2. Dimensiones separadas: nunca sumar magnitudes de distinta dimensión (masa, volumen, conteo) en un mismo total.
3. Ingrediente único: un ingrediente es una sola entidad referenciada por id en toda la aplicación. Prohibido nombres de ingrediente sueltos en texto libre.
4. RBAC con doble verificación: cada endpoint valida el rol del usuario en servidor; ocultar en UI no es suficiente.
5. Test-first en cálculos: toda feature que toque coste o cantidades incluye tests que fijan el resultado esperado antes de implementar.
6. Migraciones versionadas: todo cambio de esquema se hace por migración, nunca editando el schema base a mano en producción.
7. Idempotencia de cifras: el coste de un evento debe ser idéntico en presupuesto, escandallo y factura.
```

---

## RAMA 001 · Saneamiento de unidades y formatos
`git checkout -b 001-saneamiento-unidades`

**PEGAR EN /speckit.specify:**

```
Quiero sanear cómo el sistema maneja unidades de medida y cantidades, porque hoy los cálculos de cantidades son incorrectos y los formatos inconsistentes.

Problema actual: el sistema suma gramos, unidades y mililitros en un mismo número total, lo que produce cifras sin sentido. No existe ninguna conversión entre unidades (kilos y gramos se suman como si fueran lo mismo). Las cantidades se formatean de forma distinta en cada pantalla y algunas cantidades fraccionables se fuerzan a enteros, perdiendo precisión.

Qué debe hacer la funcionalidad:
- Establecer una unidad base canónica por dimensión: masa en gramos, volumen en mililitros, conteo en unidades. Toda cantidad se almacena y se calcula en su unidad base, y se muestra al usuario en la unidad legible que corresponda.
- Convertir correctamente entre unidades de la misma dimensión (kilos a gramos, litros a mililitros, docenas a unidades, etc.).
- Prohibir y eliminar cualquier suma entre dimensiones distintas. Los totales se presentan separados por dimensión, nunca mezclados (por ejemplo "2,4 kg · 1,2 L · 18 ud", nunca un único número agregado).
- Permitir cantidades fraccionables con decimales donde corresponda; el redondeo ocurre solo en la presentación, una sola vez, nunca en cálculos intermedios.
- Formato unificado en toda la aplicación con locale español (es-ES).

Criterios de aceptación:
- 1,5 kg + 300 g se suma correctamente como 1,8 kg y se muestra así.
- Un escandallo con ingredientes en distintas dimensiones muestra los totales separados por dimensión, no un número único.
- Ninguna cantidad pierde precisión por un redondeo intermedio.

[NEEDS CLARIFICATION] ¿Algún tipo de ingrediente debe permanecer obligatoriamente como entero (por ejemplo tartas o piezas no divisibles), o todos pasan a admitir decimales?
[NEEDS CLARIFICATION] ¿Cuántos decimales por dimensión? (propuesta: masa y volumen 0-1 decimal, conteo 0, dinero 2).

Alcance: esta feature es la base sobre la que se calcularán los escandallos y presupuestos, por lo que debe completarse antes que el resto del módulo de cocina. No incluye el cálculo de coste (eso es una feature aparte), solo el manejo correcto de unidades y cantidades.
```

---

## RAMA 002 · Cálculo de coste único e ingrediente unificado
`git checkout -b 002-costing-unico`

**PEGAR EN /speckit.specify:**

```
Quiero un único motor de cálculo de costes para toda la aplicación y unificar la entidad ingrediente, porque hoy cada pantalla calcula los costes a su manera y existen tres definiciones distintas de "ingrediente" que no se enlazan entre sí.

Problema actual: el coste de un evento puede salir diferente según se mire desde el presupuesto, el escandallo o la factura, porque cada uno lo recalcula por su cuenta. Además un mismo ingrediente existe como entidad propia en un sitio, como texto embebido en otro, y como nombre suelto en un tercero, lo que rompe el enlace entre ingrediente, su coste y su stock. Hoy el escandallo de un evento ni siquiera calcula lo que cuesta.

Qué debe hacer la funcionalidad:
- Un único punto de cálculo que resuelva: coste de una línea (cantidad en base por coste unitario), coste total de un escandallo (suma de líneas más gastos previos), PVP, margen en euros y en porcentaje, y el escalado de todo por número de comensales.
- Todas las vistas (catálogo, presupuesto, escandallo, facturación) consumen ese mismo cálculo; ninguna recalcula por su cuenta.
- El ingrediente pasa a ser una sola entidad referenciada por identificador en todas partes. Se eliminan los nombres de ingrediente sueltos en texto y los ingredientes embebidos como texto en el catálogo.
- Cambiar el coste de un ingrediente se propaga automáticamente a todo escandallo y presupuesto que lo use.

Criterios de aceptación:
- El coste de un mismo evento es idéntico en presupuesto, escandallo y factura.
- Modificar el coste de un ingrediente actualiza el coste calculado de todas las recetas que lo contienen.
- Existe una batería de tests que fija los resultados esperados de conversión, suma por dimensión, coste de escandallo escalado por comensales y margen, y que pasa antes de dar la feature por terminada.

[NEEDS CLARIFICATION] Hay datos vivos de ingredientes en formato texto embebido y nombres sueltos. ¿Deben migrarse a la entidad ingrediente unificada, o se puede partir de un catálogo limpio? Esto define el esfuerzo de migración.

Alcance: depende de la feature de saneamiento de unidades (debe estar hecha antes). Incluye los tests de cálculo como red de seguridad.
```

---

## RAMA 003 · Roles y visualización de módulos (RBAC)
`git checkout -b 003-rbac-roles`

**PEGAR EN /speckit.specify:**

```
Quiero un sistema de roles que controle qué módulos ve y puede usar cada usuario, porque hoy cualquier usuario autenticado ve y puede hacer todo.

Qué debe hacer la funcionalidad:
- Cuatro perfiles de acceso:
  - Administración: acceso total a todos los módulos, incluida la gestión de usuarios y roles.
  - Gestión cocina: escandallos, recetas, stock, hojas de producción, carga y logística, trazabilidad sanitaria, y consulta de pedidos a proveedor. Sin acceso a facturación ni a la gestión comercial de clientes.
  - Gestión camareros (maître o responsable de sala): personal y asignaciones, briefing y memo a camareros, mapa de mesas, checklist del día del evento. Sin acceso a costes, márgenes ni escandallo de coste.
  - Gestión clientes (comercial): leads, clientes, presupuestos y agenda. Sin acceso a cocina ni a nóminas.
- El menú de navegación se construye según el perfil: cada usuario ve solo sus módulos.
- La autorización se verifica en el servidor en cada operación, no solo ocultando opciones en la interfaz.
- Pantalla de gestión de usuarios (solo para Administración): crear usuarios, asignarles un perfil y activarlos o desactivarlos. Opcionalmente vincular un usuario de acceso a un trabajador (por ejemplo un cocinero o un maître con su propio acceso).
- Las vistas públicas existentes para clientes (presupuesto, evento e invitados por enlace) quedan fuera de este control de acceso interno, pero deben asegurar que no exponen costes, márgenes ni datos del personal.

Criterios de aceptación:
- Un usuario del perfil cocina que intente acceder a una operación de presupuestos o de pago de nóminas recibe un acceso denegado, tanto en la interfaz como en el servidor.
- Cada perfil ve en su menú exactamente los módulos que le corresponden y ninguno más.
- Solo Administración puede crear usuarios y asignar perfiles.

[NEEDS CLARIFICATION] ¿Bastan estos cuatro roles fijos, o se necesita configurar permisos por módulo de forma granular y editable? (propuesta: empezar con cuatro roles fijos y evolucionar si hace falta).

Alcance: transversal a toda la aplicación. Conviene tenerlo antes de añadir los módulos nuevos de cocina para que nazcan ya con el control de acceso aplicado.
```

---

## RAMA 004 · Workflow de presupuestos
`git checkout -b 004-workflow-presupuestos`

**PEGAR EN /speckit.specify:**

```
Quiero unificar y corregir el flujo de estados de un presupuesto, porque hoy conviven dos máquinas de estado paralelas y desalineadas con el negocio real.

Qué debe hacer la funcionalidad:
- Un único flujo de cuatro fases visibles para el presupuesto: borrador, primer contacto, aceptado y realizado. La fase "primer contacto" representa la reunión de toma de contacto y ajuste de menú. Se conserva un estado de rechazado o descartado por trazabilidad.
- En estado borrador, en el presupuesto solo son editables el precio final y el número de comensales; el desglose por unidades queda oculto.
- Cancelar un presupuesto exige indicar obligatoriamente un motivo.
- En un presupuesto ya aceptado, no se muestra la opción de cancelar.

Criterios de aceptación:
- El tablero de presupuestos muestra exactamente esas cuatro columnas activas más los descartados.
- No se puede cancelar un presupuesto sin registrar un motivo.
- En borrador, intentar editar las unidades no es posible; solo precio final y comensales.
- En aceptado, la acción de cancelar no aparece.

Alcance: afecta al módulo comercial de presupuestos y su relación con el evento. No cambia el cálculo de coste (ya saneado en feature previa).
```

---

## RAMA 005 · Ratios de camareros por tipo de servicio
`git checkout -b 005-ratios-camareros`

**PEGAR EN /speckit.specify:**

```
Quiero que el número de camareros sugerido se calcule según el tipo de servicio del evento, porque hoy se usa una proporción fija única que no refleja las reglas reales.

Qué debe hacer la funcionalidad:
- Distinguir el tipo de servicio del evento entre cóctel y menú sentado.
- Para cóctel: un camarero por cada doce comensales.
- Para menú sentado: un camarero por cada diez comensales, más un refuerzo adicional por cada veinticinco comensales.
- Las proporciones deben ser parámetros editables en la configuración, no valores fijos en el código, para poder ajustarlas sin tocar el programa.

Criterios de aceptación:
- 120 comensales en menú sentado sugieren 16 camareros (12 por la base de uno cada diez, más 4 refuerzos de uno cada veinticinco).
- 120 comensales en cóctel sugieren 10 camareros.
- Cambiar las proporciones en configuración cambia el resultado sin modificar código.

[NEEDS CLARIFICATION] ¿El refuerzo de uno por cada veinticinco se suma a la base de uno por cada diez (interpretación asumida), o sustituye tramos?

Alcance: afecta al cálculo de personal sugerido al generar las operaciones de un evento.
```

---

## RAMA 006 · Escandallo versionado: teórico vs real y coste
`git checkout -b 006-escandallo-versionado`

**PEGAR EN /speckit.specify:**

```
Quiero convertir el escandallo en la fuente de verdad de la cocina, con versionado y distinción entre lo teórico y lo real, porque es la base de la que derivan compras, producción y costes.

Qué debe hacer la funcionalidad:
- Cada escandallo (de un plato o de un evento) tiene una versión y dos vistas: la teórica (la receta estándar) y la real (el consumo efectivamente registrado el día del evento).
- Las cantidades del escandallo escalan automáticamente según el número de comensales y el tipo de servicio.
- Cálculo de coste estimado (cantidad teórica por coste actual del ingrediente) y de coste real (cantidad real registrada por su coste, más los gastos previos). Se muestra la desviación entre estimado y real por evento, y la media histórica por plato.
- Actualización continua: cuando cambia el coste de compra de un ingrediente, queda registrado en el historial de precios, se recalcula el coste estimado de todos los escandallos que lo usan, y se avisa si algún plato cae por debajo de su margen mínimo.
- Al cerrar un evento, su escandallo real se congela y se calcula la desviación final.

Criterios de aceptación:
- Cambiar el número de comensales recalcula todas las cantidades y el coste total del escandallo.
- Actualizar el precio de un ingrediente propaga el nuevo coste a todos los escandallos afectados en una sola operación.
- Cada evento cerrado muestra la desviación entre coste teórico y coste real.

[NEEDS CLARIFICATION] ¿El escandallo teórico se mantiene a nivel de plato (plantilla en catálogo) y se instancia por evento, o se edita libremente en cada evento? (propuesta: plantilla a nivel de plato que se instancia por evento).
[NEEDS CLARIFICATION] La actualización de precios y consumos se inspira en captura por voz o escáner sin teclear. ¿Integración con un servicio externo de voz u OCR en esta fase, o entrada manual asistida de momento?

Alcance: depende del motor de coste único y del saneamiento de unidades. Es el corazón del módulo de cocina; las hojas de producción, carga y logística derivan de aquí.
```

---

## RAMA 007 · Importar recetas desde Excel o en la app
`git checkout -b 007-import-recetas`

**PEGAR EN /speckit.specify:**

```
Quiero poder dar de alta el desglose de componentes de las recetas subiéndolas desde Excel o introduciéndolas en la aplicación, para alimentar el escandallo de cada plato sin teclear receta a receta de cero.

Qué debe hacer la funcionalidad:
- Dos vías que alimentan la misma estructura de receta:
  - Subida de un archivo Excel o CSV con las recetas y sus ingredientes.
  - Editor dentro de la aplicación para añadir ingrediente, cantidad, unidad y notas paso a paso.
- Plantilla de importación con una fila por componente, agrupando por plato: plato, categoría, ingrediente, cantidad, unidad, merma en porcentaje y notas.
- El nombre de cada ingrediente del archivo se resuelve contra los ingredientes ya existentes; si no existe se ofrece crearlo, respetando que cada ingrediente es una sola entidad.
- Las unidades del archivo se validan y se convierten a la unidad base; las cantidades admiten decimales.
- Flujo de importación en dos pasos: primero una previsualización con validación que resalta ingredientes nuevos, unidades no reconocidas y posibles duplicados, y permite resolver coincidencias (por ejemplo mapear "harina trigo" al "Harina de trigo" ya existente); después la confirmación que crea o actualiza las recetas y recalcula su coste.
- Posibilidad de descargar desde la aplicación una plantilla vacía para que cocina la rellene.

Criterios de aceptación:
- Subir un Excel con varios platos crea cada plato con su desglose de ingredientes correctamente, con unidades normalizadas y coste calculado automáticamente.
- Las filas con errores se reportan sin abortar la importación del resto.
- Una receta importada queda lista para generar el escandallo del evento al escalar por comensales.

[NEEDS CLARIFICATION] ¿Existe ya un Excel de recetas con un formato concreto que la plantilla deba respetar, o se define la plantilla desde cero?
[NEEDS CLARIFICATION] ¿La importación debe contemplar la merma por ingrediente (diferencia entre peso bruto comprado y neto aprovechable), habitual en escandallos de cocina, o se omite?

Alcance: depende del motor de coste único y del ingrediente unificado. Es la vía de carga en lote que complementa la entrada manual.
```

---

## RAMA 008 · Hojas de producción, carga y logística
`git checkout -b 008-hojas-produccion-carga-logistica`

**PEGAR EN /speckit.specify:**

```
Quiero generar automáticamente, a partir del escandallo, las hojas operativas que cocina y logística necesitan para preparar y montar un evento.

Qué debe hacer la funcionalidad:
- Hoja de producción, previa al evento: qué se cocina y en qué cantidades por plato, agrupado por partida o pase. Exportable e imprimible.
- Hoja de carga de comida, generada el mismo día del evento para cargar la furgoneta: divide cada plato por pase de servicio y por unidades. Para ello el menú del evento debe poder agruparse por momento de servicio (pase).
- Hoja logística: lista del equipamiento necesario (freidora, bandejas, platos, papel absorbente) y del producto seco (harina, aceite), separando lo perecedero de lo no perecedero y el equipamiento reutilizable.

Criterios de aceptación:
- Las tres hojas se generan a partir del escandallo del evento sin reintroducir datos.
- La hoja de carga muestra cada plato desglosado por pase y por número de unidades.
- La hoja logística separa equipamiento, producto seco e ingredientes perecederos.

[NEEDS CLARIFICATION] ¿Los pases de servicio se definen manualmente por evento, o se derivan de la categoría del plato (por ejemplo aperitivos en el primer pase, principales en el segundo)?
[NEEDS CLARIFICATION] El equipamiento (freidoras, bandejas): ¿se gestiona como stock con control de existencias, o basta una lista de carga de tipo checklist?

Alcance: deriva del escandallo versionado (debe estar hecho antes). Introduce el concepto de pase de servicio en el menú del evento.
```

---

## RAMA 009 · APPCC y trazabilidad sanitaria
`git checkout -b 009-appcc-trazabilidad`

**PEGAR EN /speckit.specify:**

```
Quiero registrar la trazabilidad sanitaria de las mercancías y cerrar el círculo entre pedido, recepción, inventario y consumo, para cumplir con los requisitos de control sanitario (APPCC).

Qué debe hacer la funcionalidad:
- Registro de cada recepción de mercancía mediante escaneo que capture automáticamente la fecha de entrada, el lote, el proveedor y los datos sanitarios relevantes (caducidad y temperatura cuando aplique).
- Vincular cada lote recibido con el escandallo real del evento donde se consume, de modo que se pueda trazar del lote al plato servido.
- Cerrar el círculo operativo: un pedido a proveedor pasa a recepción mediante el escaneo, la recepción da entrada en inventario, y el consumo se descuenta según el escandallo real, calculando la desviación. El stock se actualiza al marcar la recepción, no manualmente.

Criterios de aceptación:
- Dado un evento, se pueden listar todos los lotes de ingredientes consumidos, como exige una inspección sanitaria.
- El stock aumenta automáticamente al registrar una recepción escaneada, sin ajuste manual.
- Cada recepción queda registrada con fecha de entrada, lote y proveedor.

[NEEDS CLARIFICATION] La captura por escaneo: ¿integración con lector u OCR en esta fase, o entrada manual asistida con los mismos campos de momento?

Alcance: depende del escandallo versionado y de las hojas operativas. Cierra el flujo inventario-recibido-consumo.
```

---

## RAMA 010 · Operativos: firma de pagos, proveedores, memo y sitting externo
`git checkout -b 010-operativos`

> Si prefieres, esta rama puede partirse en varias features más pequeñas. Aquí van juntas porque son complementos operativos independientes entre sí.

**PEGAR EN /speckit.specify:**

```
Quiero varios complementos operativos que cierran la gestión de personal, proveedores y comunicación del evento.

Qué debe hacer la funcionalidad:
- Firma tras el pago de nóminas: al pagar a un trabajador, se registra su firma de conformidad y el pago se cierra como total por trabajador.
- Control de proveedores: registrar lo que se debe a cada proveedor, las fechas de pago, el estado (pendiente, pagado, vencido) y el justificante, con una vista de cuentas a pagar.
- Gastos previos en el presupuesto: poder incluir gastos previos como gasolina y desplazamientos como una línea más que suma al total del presupuesto.
- Ubicación del evento: registrar dónde se celebra el evento, distinguiendo si es en el salón propio o en una ubicación externa.
- Distinción en el menú entre los platos seleccionados y las sugerencias adicionales; las sugerencias no computan en el coste base salvo que se confirmen.
- Comunicación al personal: aviso del briefing del evento a todos los camareros por correo o mensajería, y un memo individual por trabajador (con sus datos, el menú, intolerancias, mantelería, protocolo, anotaciones y barra libre) que se envía la noche anterior.
- Para ubicaciones externas: poder subir el plano del sitio en PDF y montar el sitting de mesas sobre él.

Criterios de aceptación:
- Un pago de nómina no se cierra sin la firma del trabajador.
- La vista de cuentas a pagar muestra el debe por proveedor con sus vencimientos y estado.
- Los gastos previos suman al total del presupuesto.
- El memo individual se envía a cada camarero la noche anterior al evento.

[NEEDS CLARIFICATION] La vista 3D o 360 grados del sitio para ubicaciones externas: ¿entra en esta fase, o basta de momento con subir el plano en PDF y montar el sitting en dos dimensiones? (propuesta: PDF más sitting en dos dimensiones ahora, 3D más adelante).

Alcance: complementos sobre módulos existentes (personal, proveedores, presupuestos, eventos, comunicaciones). Independientes entre sí; pueden implementarse o separarse en cualquier orden.
```

---

### Recordatorio del grilleo (tras cada /speckit.specify)

```
/speckit.clarify     → responde las preguntas; cierra los [NEEDS CLARIFICATION]
/speckit.checklist   → valida completitud y coherencia de requisitos
/speckit.plan        → da la dirección técnica (archivos, tablas, migraciones, tests)
/speckit.tasks       → genera tareas ordenadas por dependencia
/speckit.analyze     → revisa consistencia spec/plan/tasks antes de implementar
/speckit.implement   → ejecuta
```

Para features pequeñas y sin ambigüedad (por ejemplo la 005) puedes ir directo: specify → plan → tasks → implement.
Para refinar tras analyze: prompt en lenguaje natural ("arregla A1, C2"), no relances /speckit.specify.
