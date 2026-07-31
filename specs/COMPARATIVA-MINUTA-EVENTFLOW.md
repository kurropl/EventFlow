# Análisis Comparativo: Borah Minuta vs EventFlow Cocina

## 📊 Resumen Ejecutivo

| Aspecto | Minuta (Borah) | EventFlow (Actual) | Valoración |
|---------|---------------|-------------------|------------|
| **Presupuestos** | ✅ Wizard 12 pasos | ❌ No existe | **CRÍTICO** |
| **Motor bebidas** | ✅ Automático | ❌ Manual | **ALTO** |
| **Cálculo personal** | ✅ 1:30 regla | ✅ Manual assignment | MEDIO |
| **Margen/PVP** | ✅ En vivo | ⚠️ Básico | **ALTO** |
| **PDF profesional** | ✅ Con marca | ❌ No existe | **ALTO** |
| **Multi-día** | ✅ Congresos | ❌ No existe | MEDIO |
| **Inventario** | ❌ No tiene | ✅ Completo | Nuestro优势 |
| **Proveedores** | ❌ No tiene | ✅ CRUD completo | Nuestro优势 |
| **Stock** | ❌ No tiene | ✅ Con alertas | Nuestro优势 |
| **Producción** | ❌ No tiene | ✅ Hojas + tareas | Nuestro优势 |
| **APPCC** | ❌ No tiene | ✅ Trazabilidad | Nuestro优势 |
| **Escandallos** | ⚠️ Básico | ✅ Detallado | Nuestro优势 |

---

## 🔴 Features CRÍTICOS a implementar (de Minuta)

### 1. Wizard de Presupuesto Guiado
**Minuta:** "Del «¿me pasas precio?» al PDF enviado en 12 pasos"
**Estado EventFlow:** No existe

**Propuesta:**
```
Paso 1: Cliente y evento (tipo, fecha, hora, comensales)
Paso 2: Selección de menú del catálogo
Paso 3: Configuración de bebidas (% bebedores)
Paso 4: Equipamiento necesario
Paso 5: Personal sugerido
Paso 6: Cálculo de costes
Paso 7: Margen y PVP
Paso 8: Resumen y envío
```

### 2. Motor de Bebidas Automático
**Minuta:** "Defines % de bebedores y consumiciones por persona. Convierte vasos en botellas, cafés y hielo"
**Estado EventFlow:** Cálculo manual en escandallos

**Propuesta:**
- Configurar % bebedores (ej: 70%)
- Consumiciones por persona (ej: 2.5 bebidas)
- El motor calcula: botellas vino, refrescos, agua, café, hielo
- Mostrar desglose por categoría de bebida

### 3. Margen y PVP en Vivo
**Minuta:** "Coste base + imprevistos + margen objetivo = PVP por persona"
**Estado EventFlow:** Escandallo muestra coste, no PVP

**Propuesta:**
```
Coste食材: 15.00€
Coste_personal: 5.00€
Subtotal: 20.00€
+ Imprevistos (5%): 1.00€
+ Margen (30%): 6.30€
= PVP por persona: 27.30€
= Total evento (120 pax): 3.276€
```

### 4. Generación PDF Profesional
**Minuta:** "Logo, color y referencia de tu catering en un documento listo para enviar"
**Estado EventFlow:** No genera PDFs de presupuesto

**Propuesta:**
- Template PDF con branding del usuario
- Desglose por categorías
- Logo y colores configurables
- Enviar por email directamente

---

## 🟡 Features de NIVEL MEDIO (a considerar)

### 5. Reglas de Personal Automáticas
**Minuta:** "1 camarero por cada 30 comensales, por las horas del servicio"
**EventFlow:** Asignación manual

**Propuesta:** Añadir reglas configurables:
- 1 camarero / 30 comensales (servicio normal)
- 1 camarero / 20 comensales (servicio premium)
- 1 cocinero / 50 comensales
- Horas de servicio → coste total

### 6. Soporte Multi-día
**Minuta:** "Congresos de varios días, varios eventos por día, menús distintos por jornada"
**EventFlow:** Solo eventos individuales

**Propuesta:** Soporte para:
- Congresos de 2-5 días
- Menú diferente por jornada
- Copiar eventos entre días
- Coste total del congreso

---

## 🟢 Donde EventFlow SUPERA a Minuta

### ✅ Inventario Completo
- Stock de ingredientes con alertas
- Historial de movimientos
- Vinculación con recetas

### ✅ Gestión de Proveedores
- CRUD completo
- Vinculación con ingredientes
- Historial de pedidos

### ✅ Producción y Logística
- Hojas de producción por evento
- Control de carga
- Gestión de equipamiento

### ✅ APPCC y Trazabilidad
- Control sanitario por Centro de Trabajo
- Recepción con temperatura
- Limpieza y mantenimiento

### ✅ Escandallos Detallados
- Desglose ingrediente × ingrediente
- Coste por pax automático
- Vinculación con recetas

---

## 📋 Plan de Implementación Propuesto

### Fase 1: Motor de Presupuesto (2-3 semanas)
1. ✅ API para reglas de cálculo (margen, % bebedores, ratios personal)
2. ✅ Wizard de creación de presupuesto
3. ✅ Motor de cálculo automático de bebidas
4. ✅ Vista previa de costes en tiempo real

### Fase 2: Exportación y Margen (1-2 semanas)
1. ✅ Cálculo de margen y PVP
2. ✅ Generación PDF con branding
3. ✅ Envío por email

### Fase 3: Multi-día y Reglas (1-2 semanas)
1. ✅ Soporte congresos
2. ✅ Reglas de personal configurables
3. ✅ Duplicar eventos

### Fase 4: Integración con Cocina (1 semana)
1. ✅ Presupuesto → Escandallo automático
2. ✅ Presupuesto → Hoja de producción
3. ✅ Validación de stock vs presupuesto

---

## 🎯 Conclusión

**EventFlow tiene una base sólida** (inventario, proveedores, producción, APPCC) que Minuta NO tiene.

**Lo que falta** es el "motor de ventas":
- Presupuestación rápida (wizard)
- Cálculo automático (bebidas, personal)
- Margen visible
- PDF profesional

**Recomendación:** Implementar Fase 1 y 2 para tener un módulo de presupuestación completo que supere a Minuta.
