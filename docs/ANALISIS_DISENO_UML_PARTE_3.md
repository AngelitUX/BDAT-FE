# Análisis y Diseño UML 2.0 - Sistema BDAT (Parte 3/4)
## Diagramas de Secuencia, Estado y Modelo Conceptual

**Versión:** 1.1.0  
**Notación:** UML 2.0

---

## 6. Diagramas de Secuencia del Sistema (DSS)

### 6.1 DSS: Crear y Ejecutar Simulación

```
Investigador   Frontend     Backend      GMSH      FEniCS     WebSocket    Base de Datos
    │             │            │           │          │            │             │
    ├──Click─────►│            │           │          │            │             │
    │  "New"      │            │           │          │            │             │
    │             │            │           │          │            │             │
    ├──Ingresa───►│            │           │          │            │             │
    │  Parámetros │            │           │          │            │             │
    │             │            │           │          │            │             │
    ├──Click─────►│            │           │          │            │             │
    │  "Create"   │            │           │          │            │             │
    │             │            │           │          │            │             │
    │             ├─POST /simulations────►│           │            │             │
    │             │            │           │          │            │             │
    │             │            ├─ValidarDatos()       │            │             │
    │             │            │           │          │            │             │
    │             │            ├────────INSERT────────────────────────────────────►│
    │             │            │           │          │            │             │
    │             │            ├─emit("nueva_simulacion")────────►│             │
    │             │◄───200 OK──┤           │          │            │             │
    │             │            │           │          │            │             │
    │             │            ├─Generar Malla──────►│            │             │
    │             │            │           │          │            │             │
    │             │            │           ├─Crear geometría       │             │
    │             │            │           ├─Refinar              │             │
    │             │            │           ├─Guardar XML/MSH      │             │
    │             │            │◄──Archivos─┤          │            │             │
    │             │            │           │          │            │             │
    │             │            ├───────UPDATE─────────────────────────────────────►│
    │             │            │  (xml_file, msh_file, status="Not started")     │
    │             │            │           │          │            │             │
    │             │            ├─emit("mesh_ready")───────────────►│             │
    │             │◄───WebSocket Notification───────────────────────┤             │
    │             │            │           │          │            │             │
    ├──Click─────►│            │           │          │            │             │
    │  "Execute"  │            │           │          │            │             │
    │             │            │           │          │            │             │
    │             ├─PUT /simulations/{id}/run───────►│            │             │
    │             │            │           │          │            │             │
    │             │            ├─Encolar()│          │            │             │
    │             │            ├───────UPDATE status="Queued"─────────────────────►│
    │             │            ├─emit("estado_simulacion")────────►│             │
    │             │◄───200 OK──┤           │          │            │             │
    │             │            │           │          │            │             │
    │             │            ├─Procesar Cola()      │            │             │
    │             │            ├───────UPDATE status="Running"────────────────────►│
    │             │            ├─emit("estado_simulacion")────────►│             │
    │             │            │           │          │            │             │
    │             │            ├────────Ejecutar─────────────────►│             │
    │             │            │           │          │            │             │
    │             │            │           │          ├─Cargar malla             │
    │             │            │           │          ├─Configurar FEniCS        │
    │             │            │           │          ├─Newmark β-γ              │
    │             │            │           │          ├─Resolver ecuaciones       │
    │             │            │           │          ├─Evaluar sensores          │
    │             │            │           │          ├─Generar .mat              │
    │             │            │◄────Resultados.mat───┤            │             │
    │             │            │           │          │            │             │
    │             │            ├───────UPDATE─────────────────────────────────────►│
    │             │            │  (file_data, status="Finished", end_datetime)   │
    │             │            │           │          │            │             │
    │             │            ├─emit("estado_simulacion")────────►│             │
    │             │◄───WebSocket Notification───────────────────────┤             │
    │◄──Sonido────┤            │           │          │            │             │
    │             │            │           │          │            │             │
```

### 6.2 DSS: Visualizar Resultados

```
Investigador   Frontend     Backend     results_processor    Base de Datos
    │             │            │              │                    │
    ├──Click─────►│            │              │                    │
    │  "View      │            │              │                    │
    │  Results"   │            │              │                    │
    │             │            │              │                    │
    │             ├─GET /simulations/{id}/results────►│            │
    │             │            │              │                    │
    │             │            ├────────SELECT────────────────────►│
    │             │            │◄──simulation_data────────────────┤
    │             │            │              │                    │
    │             │            ├─process_simulation_results()────►│
    │             │            │              │                    │
    │             │            │              ├─Cargar .mat       │
    │             │            │              ├─Parse datos       │
    │             │            │              ├─Calcular FFT      │
    │             │            │              ├─Calcular SVD      │
    │             │            │              ├─Calcular f-k      │
    │             │            │◄──results_data────────┤          │
    │             │            │              │                    │
    │             │◄───200 OK + JSON─────────┤                    │
    │             │   {spatioTemporal,       │                    │
    │             │    singularValues,       │                    │
    │             │    spectrumData}         │                    │
    │             │            │              │                    │
    │             ├─Renderizar Recharts       │                    │
    │             ├─Renderizar Heatmap        │                    │
    │             ├─Renderizar Gráficos       │                    │
    │             │            │              │                    │
    │◄──Visualiza─┤            │              │                    │
    │  Resultados │            │              │                    │
    │             │            │              │                    │
```

### 6.3 DSS: Sistema de Cola

```
Backend       QueueManager    SimulationTask    FEniCS    WebSocket
   │               │                │              │           │
   ├─Encolar───────►│                │              │           │
   │  Simulación   │                │              │           │
   │               │                │              │           │
   │               ├─Agregar a queue[]             │           │
   │               ├─Cambiar status="Queued"       │           │
   │               ├─emit("estado_simulacion")─────────────────►│
   │               │                │              │           │
   │               ├─Verificar si puede procesar   │           │
   │               │  (no hay Running)             │           │
   │               │                │              │           │
   │               ├─Extraer primera simulación    │           │
   │               ├─Cambiar status="Running"      │           │
   │               ├─emit("estado_simulacion")─────────────────►│
   │               │                │              │           │
   │               ├─Lanzar tarea────────────────►│            │
   │               │                │              │           │
   │               │                ├─Ejecutar─────────────►│  │
   │               │                │              │           │
   │               │                │◄──Resultados──┤           │
   │               │                │              │           │
   │               │                ├─Cambiar status="Finished"│
   │               │                ├─emit("estado_simulacion")─►│
   │               │                │              │           │
   │               │◄──Completado───┤              │           │
   │               │                │              │           │
   │               ├─Procesar siguiente en cola    │           │
   │               │                │              │           │
```

---

## 7. Diagramas de Estado

### 7.1 Máquina de Estados: Simulación

```
                            ┌──────────────────┐
                            │                  │
                            │  [INITIAL]       │
                            │                  │
                            └────────┬─────────┘
                                     │
                                     │ create()
                                     ▼
                            ┌──────────────────┐
                            │                  │
                     ┌──────┤ Generating Mesh  │
                     │      │                  │
                     │      └────────┬─────────┘
                     │               │
                     │               │ mesh_generated()
                     │               ▼
                     │      ┌──────────────────┐
                     │      │                  │
                ┌────┴──────┤   Not started    │
                │           │                  │
                │           └────────┬─────────┘
                │                    │
                │                    │ execute()
                │                    ▼
                │           ┌──────────────────┐
                │           │                  │
                │           │     Queued       │
                │           │                  │
                │           └────────┬─────────┘
                │                    │
                │     dequeue()      │ process_queue()
                │    ◄───────────────┤
                │                    │
                │                    ▼
                │           ┌──────────────────┐
                │           │                  │
          abort()│    ┌─────┤     Running      │
                │     │     │                  │
                ▼     │     └────────┬─────────┘
       ┌────────────┐ │              │
       │            │ │              │ error()
       │  Aborting  │ │              ├─────────────────┐
       │            │ │              │                  │
       └─────┬──────┘ │              │ finished()      │
             │        │              ▼                  ▼
             │        │     ┌──────────────┐   ┌──────────────┐
             │        │     │              │   │              │
    cleanup()│        │     │   Finished   │   │    Error     │
             │        │     │              │   │              │
             ▼        │     └──────┬───────┘   └──────┬───────┘
       ┌────────────┐ │            │                  │
       │            │ │            │                  │
       │  Aborted   │ │            │ re-execute()    │
       │            │ │            │                  │
       └─────┬──────┘ │            └──────────────┬───┘
             │        │                           │
             │        │                           │
             │        └───────────────────────────┘
             │                      │
             │ re-execute()        │
             └──────────────────────┘
                      │
                      ▼
             ┌──────────────────┐
             │                  │
             │     Queued       │
             │                  │
             └──────────────────┘


Estados:
• Not started: Simulación creada, lista para ejecutar
• Queued: En cola de ejecución
• Running: Ejecutándose actualmente
• Finished: Completada exitosamente
• Error: Fallo durante ejecución
• Aborting: En proceso de abortar
• Aborted: Abortada por usuario
• Generating Mesh: Generando malla computacional

Transiciones:
• create() → Generating Mesh
• mesh_generated() → Not started
• execute() → Queued
• process_queue() → Running
• finished() → Finished
• error() → Error
• abort() → Aborting
• cleanup() → Aborted
• re-execute() → Queued
• dequeue() → Not started
```

### 7.2 Estados de Malla

```
       ┌──────────────┐
       │              │
       │  No Mesh     │
       │              │
       └──────┬───────┘
              │
              │ create_simulation()
              ▼
       ┌──────────────┐
       │              │
       │  Generating  │
       │              │
       └──────┬───────┘
              │
       ┌──────┴────────┐
       │               │
       │ success       │ error
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│              │  │              │
│  Generated   │  │    Failed    │
│ (XML + MSH)  │  │              │
└──────────────┘  └──────────────┘
```

---

## 8. Modelo Conceptual

### 8.1 Diagrama de Clases del Dominio

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                         MODELO CONCEPTUAL                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘


┌──────────────────────────┐
│      Simulation          │
├──────────────────────────┤
│ - id: Integer            │
│ - sim_name: String       │
│ - code: String           │
│ - p_status: String       │
│ - start_datetime: DateTime│
│ - end_datetime: DateTime │
│ - execution_time: Float  │
├──────────────────────────┤
│ + create()               │
│ + execute()              │
│ + abort()                │
│ + update()               │
│ + delete()               │
└──────────┬───────────────┘
           │
           │ 1
           │ has
           │
           ▼ 1
┌──────────────────────────┐         1     ┌──────────────────────────┐
│   GeometricParameters    │◄──────────────┤      MeshData            │
├──────────────────────────┤   defines     ├──────────────────────────┤
│ - plate_thickness: Float │               │ - xml_file: String       │
│ - plate_length: Float    │               │ - msh_file: String       │
│ - typical_mesh_size: Float│              │ - mesh_vertices: JSON    │
│ - sensor_edge_margin: Float│             │ - mesh_faces: JSON       │
└──────────────────────────┘               │ - mesh_metadata: JSON    │
                                            ├──────────────────────────┤
           ┌ 1                              │ + generate()             │
           │                                │ + visualize()            │
           │ has                            │ + export()               │
           │                                └──────────────────────────┘
           ▼ 1
┌──────────────────────────┐
│   SensorConfiguration    │
├──────────────────────────┤
│ - n_transmitter: Integer │
│ - n_receiver: Integer    │               1     ┌──────────────────────┐
│ - emitters_pitch: Float  │◄──────────────┤─────┤    SensorPosition    │
│ - receivers_pitch: Float │   defines     │     ├──────────────────────┤
│ - sensor_distance: Float │               *     │ - id: Integer        │
└──────────────────────────┘                     │ - position_z: Float  │
                                                  │ - position_y: Float  │
                                                  │ - type: String       │
           ┌ 1                                    │   (transmitter/      │
           │                                      │    receiver)         │
           │ has                                  └──────────────────────┘
           │
           ▼ 1
┌──────────────────────────┐
│   MaterialProperties     │
├──────────────────────────┤
│ - porosity: Integer      │               1     ┌──────────────────────┐
│ - attenuation: Integer   │◄──────────────┤─────┤   MaterialData       │
│ - skin_layer_config:String│  uses        │     ├──────────────────────┤
└──────────────────────────┘                     │ - C11, C12, C13: Float│
                                                  │ - C33, C55, C66: Float│
                                                  │ - density: Float     │
                                                  │ - source: String     │
           ┌ 1                                    │   (C_values_mathilde)│
           │                                      └──────────────────────┘
           │ produces
           │
           ▼ 1
┌──────────────────────────┐
│     SimulationResults    │
├──────────────────────────┤
│ - file_data: BLOB        │
│ - result_step_01: String │               1     ┌──────────────────────┐
├──────────────────────────┤◄──────────────┤─────┤    SensorData        │
│ + download()             │   contains    │     ├──────────────────────┤
│ + visualize()            │               *     │ - sol_sensors_y: Array│
│ + process()              │                     │ - sol_sensors_z: Array│
└──────────────────────────┘                     │ - times: Array       │
                                                  │ - nsens: Integer     │
                                                  │ - ntimes: Integer    │
                                                  └──────────────────────┘


           ┌───────────────────────────────┐
           │                               │
           │   ExecutionQueue              │
           │                               │
           ├───────────────────────────────┤
           │ - queue: List<Simulation>     │
           │ - max_concurrent: Integer     │
           │ - current_running: Integer    │
           ├───────────────────────────────┤
           │ + enqueue(sim: Simulation)    │
           │ + dequeue(sim: Simulation)    │
           │ + reorder(order: List)        │
           │ + process_queue()             │
           └───────────────────────────────┘
                        │
                        │ manages
                        │
                        ▼ *
                ┌───────────────┐
                │   Simulation  │
                └───────────────┘
```

### 8.2 Asociaciones y Cardinalidades

| Clase A | Relación | Clase B | Cardinalidad |
|---------|----------|---------|--------------|
| Simulation | has | GeometricParameters | 1 a 1 |
| Simulation | has | SensorConfiguration | 1 a 1 |
| Simulation | has | MaterialProperties | 1 a 1 |
| Simulation | has | MeshData | 1 a 1 |
| Simulation | produces | SimulationResults | 1 a 1 |
| GeometricParameters | defines | MeshData | 1 a 1 |
| SensorConfiguration | defines | SensorPosition | 1 a muchos |
| MaterialProperties | uses | MaterialData | 1 a 1 |
| SimulationResults | contains | SensorData | 1 a muchos |
| ExecutionQueue | manages | Simulation | 1 a muchos |

### 8.3 Atributos Clave

**Simulation:**
- `id`: Identificador único autoincremental
- `sim_name`: Nombre descriptivo asignado por usuario
- `code`: Código único generado automáticamente
- `p_status`: Estado actual (Not started, Running, Finished, Error, etc.)
- `start_datetime`: Timestamp de inicio de ejecución
- `end_datetime`: Timestamp de finalización
- `execution_time`: Tiempo total en segundos

**MeshData:**
- `xml_file`: Ruta absoluta al archivo XML (FEniCS)
- `msh_file`: Ruta absoluta al archivo MSH (GMSH)
- `mesh_vertices`: JSON con coordenadas [x, y, z]
- `mesh_faces`: JSON con conectividad triangular
- `mesh_metadata`: JSON con estadísticas (num_vertices, num_faces, hmin, hmax)

**SensorData:**
- `sol_sensors_y`: Arreglo 2D [nsens × ntimes] de desplazamientos verticales
- `sol_sensors_z`: Arreglo 2D [nsens × ntimes] de desplazamientos horizontales
- `times`: Vector temporal con ntimes puntos
- `nsens`: Número total de sensores
- `ntimes`: Número de pasos temporales

---

**FIN PARTE 3/4**

Ver ANALISIS_DISENO_UML_PARTE_4.md para Diagramas Adicionales y Conclusiones.
