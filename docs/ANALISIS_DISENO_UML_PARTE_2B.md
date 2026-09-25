# Análisis y Diseño UML 2.0 - Sistema BDAT (Parte 2B/4)
## Especificación Detallada de Casos de Uso

**Versión:** 1.1.0  
**Notación:** UML 2.0

---

## 5. Especificación Detallada de Casos de Uso

### 5.1 CU-01.1: Crear Simulación

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-01.1 |
| **Nombre** | Crear Simulación |
| **Actores** | Investigador Científico (Principal), Sistema GMSH (Secundario) |
| **Propósito** | Configurar y crear nueva simulación de ondas guiadas |
| **Tipo** | Primario, Esencial |
| **Referencias** | RF-01.1, RF-04.1, RNF-05.1, RNF-10.1 |

**Pre-condiciones:**
- Sistema en ejecución
- Base de datos disponible

**Post-condiciones:**
- Simulación creada
- Malla generada (XML/MSH)
- Estado "Not started"

**Curso Normal:**
1. Usuario: Click "New Simulation"
2. Sistema: Abre modal con formulario
3. Usuario: Ingresa nombre y parámetros
4. Usuario: Click "Create"
5. Sistema: Valida datos (campos, tipos, rangos)
6. Sistema: Calcula plate_length automáticamente
7. Sistema: Inserta en base de datos
8. Sistema: Cambia a "Generating mesh"
9. Sistema: Emite WebSocket "nueva_simulacion"
10. Sistema: Genera malla con GMSH
11. Sistema: Guarda XML y MSH
12. Sistema: Cambia a "Not started"
13. Sistema: Emite "mesh_ready"
14. Sistema: Actualiza lista

**Cursos Alternativos:**
- **5a. Validación falla:** Muestra errores, usuario corrige
- **10a. Error GMSH:** Estado "Mesh generation failed", emite "mesh_error"

---

### 5.2 CU-02.1: Ejecutar Simulación

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-02.1 |
| **Nombre** | Ejecutar Simulación Nueva |
| **Actores** | Investigador (Principal), FEniCS (Secundario), WebSocket (Secundario) |
| **Propósito** | Ejecutar simulación científica y generar resultados |
| **Tipo** | Primario, Esencial |
| **Referencias** | RF-02.1, RF-02.4, RF-03.1, RNF-01.1, RNF-04.1 |

**Pre-condiciones:**
- Simulación en "Not started"
- Malla generada
- FEniCS disponible

**Post-condiciones:**
- Estado "Finished"
- Archivo .mat generado
- Notificación sonora

**Curso Normal:**
1. Usuario: Click "Execute"
2. Sistema: Valida estado y malla
3. Sistema: Cambia a "Queued", inserta en cola
4. Sistema: Emite "estado_simulacion" = "Queued"
5. Sistema: Procesa cola
6. Sistema: Cambia a "Running"
7. Sistema: Emite "estado_simulacion" = "Running"
8. Sistema: Carga malla XML
9. Sistema: Lee parámetros desde DB
10. Sistema: Carga materiales (C_values_mathilde.mat)
11. Sistema: Configura FEniCS (función spaces, condiciones frontera)
12. Sistema: Esquema Newmark β-γ
13. Sistema: Itera pasos de tiempo
14. Sistema: Resuelve sistema lineal
15. Sistema: Evalúa sensores (sol_sensors_y, sol_sensors_z)
16. Sistema: Genera .mat
17. Sistema: Almacena en DB (BLOB)
18. Sistema: Cambia a "Finished"
19. Sistema: Emite "estado_simulacion" = "Finished"
20. Cliente: Reproduce sonido
21. Usuario: Visualiza "Finished"

**Cursos Alternativos:**
- **2a. Estado inválido:** Muestra error, fin
- **2b. Malla no existe:** "Mesh files not found", fin
- **14a. Error FEniCS:** Estado "Error", registra logs, fin
- **15a. Sensores en cero:** Intenta fallback (PointSource, nodo cercano)

---

### 5.3 CU-03.2: Reordenar Cola

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-03.2 |
| **Nombre** | Reordenar Cola de Simulaciones |
| **Actores** | Investigador Científico (Principal) |
| **Propósito** | Cambiar prioridad de simulaciones en cola |
| **Tipo** | Secundario, Esencial |
| **Referencias** | RF-03.2, RNF-05.3 |

**Pre-condiciones:**
- Al menos 2 simulaciones "Queued"
- Vista de cola abierta

**Post-condiciones:**
- Orden de cola actualizado

**Curso Normal:**
1. Usuario: Click "Queue"
2. Sistema: Abre modal de cola
3. Sistema: Carga simulaciones "Queued" ordenadas
4. Usuario: Arrastra simulación a nueva posición
5. Sistema: Detecta drag & drop
6. Sistema: Calcula nuevo orden
7. Sistema: Actualiza queue_position en DB
8. Sistema: Emite WebSocket actualización
9. Sistema: Actualiza vista
10. Usuario: Visualiza nuevo orden

**Cursos Alternativos:**
- **7a. Error transacción:** Rollback, muestra error, recarga original

---

### 5.4 CU-04.1: Ver Malla 3D

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-04.1 |
| **Nombre** | Visualizar Malla 3D Interactiva |
| **Actores** | Investigador Científico (Principal) |
| **Propósito** | Visualizar geometría de malla con sensores |
| **Tipo** | Secundario, Real |
| **Referencias** | RF-04.5, RF-04.6, RNF-01.3 |

**Pre-condiciones:**
- Simulación con malla generada
- Modal de simulación abierto

**Post-condiciones:**
- Malla visualizada en 3D

**Curso Normal:**
1. Usuario: Abre simulación con malla
2. Sistema: Detecta archivos MSH/XML
3. Sistema: Carga datos de malla desde DB
4. Sistema: Parse vertices y faces
5. Sistema: Calcula posiciones de sensores
6. Sistema: Crea geometría Three.js
7. Sistema: Renderiza triángulos
8. Sistema: Renderiza sensores (rojo/azul)
9. Sistema: Habilita controles (rotar, zoom, pan)
10. Usuario: Interactúa con malla 3D

**Cursos Alternativos:**
- **3a. Malla no disponible:** Muestra mensaje, deshabilita vista 3D

---

### 5.5 CU-05.3: Visualizar Espectro f-k

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-05.3 |
| **Nombre** | Visualizar Espectro de Ondas Guiadas |
| **Actores** | Investigador Científico (Principal) |
| **Propósito** | Analizar espectro frecuencia-número de onda |
| **Tipo** | Secundario, Real |
| **Referencias** | RF-05.4, RF-05.5, RNF-01.4 |

**Pre-condiciones:**
- Simulación "Finished"
- Archivo .mat disponible

**Post-condiciones:**
- Espectro f-k visualizado

**Curso Normal:**
1. Usuario: Click "View Results"
2. Sistema: Verifica estado "Finished"
3. Sistema: Carga archivo .mat desde DB
4. Sistema: Extrae sol_sensors_y, sol_sensors_z
5. Sistema: Aplica FFT en tiempo (dominio f)
6. Sistema: Aplica FFT en espacio (dominio k)
7. Sistema: Calcula espectro 2D (f-k)
8. Sistema: Normaliza magnitud
9. Sistema: Genera heatmap (colormap jet)
10. Sistema: Calcula curvas de dispersión teóricas
11. Sistema: Superpone líneas de referencia
12. Sistema: Renderiza con Canvas API
13. Usuario: Visualiza espectro f-k

**Cursos Alternativos:**
- **3a. Archivo .mat corrupto:** Muestra error, fin
- **4a. Datos faltantes:** Muestra "Incomplete data", fin

---

### 5.6 CU-06.1: Buscar por Texto

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-06.1 |
| **Nombre** | Buscar Simulaciones por Texto |
| **Actores** | Investigador Científico (Principal) |
| **Propósito** | Encontrar simulaciones por nombre/ID/código |
| **Tipo** | Secundario, Real |
| **Referencias** | RF-07.1, RNF-05.3 |

**Pre-condiciones:**
- Simulaciones existentes

**Post-condiciones:**
- Lista filtrada mostrada

**Curso Normal:**
1. Usuario: Click en barra de búsqueda
2. Usuario: Ingresa término de búsqueda
3. Sistema: Filtra por nombre (case-insensitive)
4. Sistema: Filtra por ID (coincidencia exacta)
5. Sistema: Filtra por código
6. Sistema: Combina resultados
7. Sistema: Actualiza vista con resultados
8. Sistema: Muestra badge con filtros activos
9. Usuario: Visualiza resultados filtrados

**Cursos Alternativos:**
- **6a. Sin resultados:** Muestra "No simulations found"

---

### 5.7 CU-07.3: Recibir Notificaciones

| Campo | Descripción |
|-------|-------------|
| **ID** | CU-07.3 |
| **Nombre** | Recibir Notificaciones en Tiempo Real |
| **Actores** | Sistema WebSocket (Principal), Investigador (Secundario) |
| **Propósito** | Mantener UI actualizada automáticamente |
| **Tipo** | Secundario, Esencial |
| **Referencias** | RF-08.1, RF-08.5, RNF-01.2 |

**Pre-condiciones:**
- Conexión WebSocket activa

**Post-condiciones:**
- UI actualizada en tiempo real

**Curso Normal:**
1. Sistema Backend: Detecta cambio de estado
2. Sistema Backend: Emite evento "estado_simulacion"
3. Sistema WebSocket: Transmite a clientes conectados
4. Cliente: Recibe evento (< 500ms)
5. Cliente: Actualiza simulations array
6. Cliente: Actualiza selectedSimulation si corresponde
7. Cliente: Re-renderiza componentes afectados
8. Cliente: Si estado = "Finished", reproduce sonido
9. Usuario: Visualiza cambio automáticamente

**Eventos Soportados:**
- **estado_simulacion:** Cambios de estado
- **nueva_simulacion:** Nueva simulación creada
- **mesh_ready:** Malla generada
- **mesh_error:** Error en generación

---

**Continúa en Parte 3: Diagramas de Secuencia, Estado y Modelo Conceptual**
