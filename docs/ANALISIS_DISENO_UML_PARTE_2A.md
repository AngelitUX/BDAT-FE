# Análisis y Diseño UML 2.0 - Sistema BDAT (Parte 2A/4)
## Diagramas de Casos de Uso

**Versión:** 1.1.0  
**Notación:** UML 2.0

---

## 4. Diagramas de Casos de Uso

### 4.1 Diagrama General

```
               Sistema BDAT - Bone Guided Wave Simulation
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│     Investigador                                              │
│     Científico                                                │
│          │                                                    │
│          ├──► CU-01: Gestionar Simulaciones                  │
│          │    • Crear, visualizar, editar, duplicar, eliminar│
│          │                                                    │
│          ├──► CU-02: Ejecutar Simulaciones                   │
│          │    • Ejecutar, re-ejecutar, abortar              │
│          │                                                    │
│          ├──► CU-03: Gestionar Cola                          │
│          │    • Ver, reordenar, desencolar                   │
│          │                                                    │
│          ├──► CU-04: Visualizar Mallas                       │
│          │    • Ver 3D, descargar archivos                   │
│          │                                                    │
│          ├──► CU-05: Analizar Resultados                     │
│          │    • Señales, SVD, espectro f-k                   │
│          │                                                    │
│          ├──► CU-06: Buscar y Filtrar                        │
│          │    • Múltiples criterios                          │
│          │                                                    │
│          └──► CU-07: Monitorear Sistema                      │
│               • Estadísticas, notificaciones                 │
│                                                               │
│                                                               │
│   Actores Secundarios:                                       │
│   • Sistema FEniCS (Motor simulación)                        │
│   • Sistema WebSocket (Notificaciones)                       │
│   • Sistema GMSH (Generación mallas)                         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 CU-01: Gestionar Simulaciones

```
┌──────────────────────────────────────────────────────────────┐
│               CU-01: Gestionar Simulaciones                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Investigador                                                │
│        │                                                      │
│        ├──► CU-01.1: Crear Simulación                        │
│        │    «include» ValidarDatos                           │
│        │    «include» GenerarMalla                           │
│        │                                                      │
│        ├──► CU-01.2: Visualizar Simulación                   │
│        │    • Ver detalles completos                         │
│        │                                                      │
│        ├──► CU-01.3: Editar Simulación                       │
│        │    «extends» [Estado: Not started]                  │
│        │    «include» RegenerarMalla                         │
│        │                                                      │
│        ├──► CU-01.4: Duplicar Simulación                     │
│        │    • Copiar configuración                           │
│        │                                                      │
│        └──► CU-01.5: Eliminar Simulación(es)                 │
│             • Individual, múltiple, todas                    │
│             «include» ConfirmarAcción                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 CU-02: Ejecutar Simulaciones

```
┌──────────────────────────────────────────────────────────────┐
│               CU-02: Ejecutar Simulaciones                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Investigador                    Sistema FEniCS             │
│        │                                │                     │
│        ├──► CU-02.1: Ejecutar ─────────►│ Procesar          │
│        │    «include» Encolar           │ Ecuaciones        │
│        │                                │                     │
│        ├──► CU-02.2: Re-ejecutar                             │
│        │    «extends» [Finished|Error]                       │
│        │                                                      │
│        └──► CU-02.3: Abortar                                 │
│             «extends» [Running]                              │
│             «include» LimpiarRecursos                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 CU-03 a CU-07 (Resumen)

**CU-03: Gestionar Cola**
- Ver, reordenar, desencolar simulaciones en espera

**CU-04: Visualizar Mallas**
- Ver malla 3D con Three.js
- Descargar archivos XML/MSH

**CU-05: Analizar Resultados**
- Señales espacio-temporales
- Valores singulares (SVD)
- Espectro f-k

**CU-06: Buscar y Filtrar**
- Texto, estado, atenuación, tejido, porosidad, fechas

**CU-07: Monitorear Sistema**
- Estadísticas, simulaciones activas, notificaciones WebSocket

---

**Continúa en Parte 2B: Especificación Detallada de Casos de Uso**
