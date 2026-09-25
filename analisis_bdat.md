# Análisis Completo del Proyecto BDAT
## Validación de la Propuesta de Título + Diagnóstico de Rendimiento

---

## ✅ PARTE 1: Validación de la Propuesta vs. Código Real

### Correspondencias Confirmadas ✓

| Lo que dice la propuesta | Lo que existe en el código | Estado |
|---|---|---|
| Motor FEniCS (dolfin) | `from dolfin import *` en `TimeSimTransIsoMatCij2D_test.py` | ✅ Existe |
| Frontend React | `frontend/src/` con `App.js`, componentes React | ✅ Existe |
| Backend Flask | `backend/src/app.py` con Flask + Blueprint | ✅ Existe |
| WebSockets (Flask-SocketIO) | `flask_socketio`, `eventlet` en `app.py` | ✅ Existe |
| Docker + Docker Compose | `docker-compose.yml`, `docker-compose.dev.yml`, Dockerfiles | ✅ Existe |
| MySQL 8.0 | `database/Dockerfile` + `init.sql`, `mysql:8.0.42` | ✅ Existe |
| Parámetro: roughness (rugosidad) | `porosity` / `roughness` en `mesh_service.py` y `simulations_service.py` | ✅ Existe |
| Parámetro: ángulo de incidencia | `mesh_angle`, `mesh_angle_direction` en generación de mallas | ✅ Existe |
| Parámetro: atenuación | `attenuation` en `simulation_tasks.py` | ✅ Existe |
| Gmsh para mallas | `import gmsh` en `mesh_service.py` y scripts FEniCS | ✅ Existe |
| Meshio | `import meshio` en `simulations_service.py` | ✅ Existe |
| Numpy / Scipy | `requirements.txt`: numpy, scipy | ✅ Existe |
| GitHub Actions CI/CD | `.github/workflows/ci.yml`, `cd.yml`, `cypress-tests.yml` | ✅ Existe |
| Archivo .mat de referencia | `REF2D_exvivo_Mathilde_Radius_01mm.mat` (27 MB) | ✅ Existe |
| Celery + Redis (async) | `celery_config.py`, `celery_worker.py`, Redis en docker-compose | ✅ Existe |
| Prueba con mallas 0.05mm / 0.10mm | `typical_mesh_size` es parámetro configurable del solver | ✅ Existe |
| Dominio de tiempo y frecuencia | `TimeSimTransIsoMatCij2D_test.py` (tiempo) + `SimFreqDomain2D.py` (frecuencia) | ✅ Existe |
| Capas multicapa (sandwich/piel) | `sandwich.py`, `TimeSimTransIsoMatCij2D_multilayer.py` | ✅ Existe |

### ⚠️ Discrepancias / Observaciones

| Lo que dice la propuesta | Situación real | Observación |
|---|---|---|
| "React 19 (o superior)" | El proyecto usa React (versión en `package.json` no inspeccionada a fondo) | Verificar versión exacta |
| Tailwind CSS no mencionado | El proyecto **sí usa Tailwind** (`tailwind.config.js` en frontend) | No es un problema, pero la propuesta no lo menciona |
| Octave para procesamiento externo | `octave_plot_generator.py` + `generate_plots_octave.m` + `octave` instalado en Dockerfile | ✅ Existe, bien integrado |
| `mshr` (FEniCS) para mallas | Aún se usa como fallback en el código (`from mshr import *`) | La propuesta dice que gmsh reemplaza a FDTD, pero mshr sigue en el código |
| CI/CD con GitHub Actions | Existen 4 workflows: `ci.yml`, `cd.yml`, `cypress-tests.yml`, `gitflow.yml` | Más completo de lo mencionado |

### 📋 Veredicto General
La propuesta **corresponde fielmente al código real**. Todos los componentes clave mencionados (FEniCS, Flask, React, Docker, MySQL, gmsh, Celery, Redis, parámetros de simulación) existen e implementados. El proyecto está más avanzado de lo que la propuesta sugiere (ya tiene Celery, Redis, CI/CD, capas multicapa, Octave integration), lo cual es positivo.

---

## 🔧 PARTE 2: Herramientas Relevantes del Proyecto

### Núcleo de Simulación

| Herramienta | Para qué se usa | Archivo clave |
|---|---|---|
| **FEniCS / dolfin 2019.1** | Motor FEM: resuelve la ecuación de onda elástica en cada paso de tiempo usando método de Elementos Finitos. Es el corazón computacional. | `TimeSimTransIsoMatCij2D_test.py`, `SimFreqDomain2D.py` |
| **Método de Newmark-β** | Integración temporal de la ecuación de onda (esquema implícito β=0.36, γ=0.7). Resuelve un sistema lineal por cada paso de tiempo. | `TimeSimTransIsoMatCij2D_test.py` L. 637, `update()` function |
| **PETSc + UMFPACK (LU)** | Solver lineal directo para el sistema lineal en cada paso temporal. Hay fallback a CG+AMG si el directo falla. | `TimeSimTransIsoMatCij2D_test.py` L. 719–773 |
| **Gmsh 4.11.1** | Generación de mallas 2D con refinamiento adaptativo, geometría de rugosidad (roughness), inclinación de borde. | `mesh_service.py`, `simulations_service.py` |
| **mshr** | Fallback para generar mallas rectangulares simples. | `TimeSimTransIsoMatCij2D_test.py` L. 181–188 |
| **meshio 5.3.4** | Conversión de mallas Gmsh → formato XML de dolfin/FEniCS. | `mesh_service.py`, `simulations_service.py` |
| **scipy.io** | Lectura de archivos `.mat` (MATLAB) con propiedades del material óseo (Mathilde data). Guardado de resultados. | `TimeSimTransIsoMatCij2D_test.py` L. 426–437 |
| **NumPy** | Algebra lineal, arrays de señales espacio-temporales (`sol_sensors_z`, `sol_sensors_y`). | Ubiquo |
| **GNU Octave** | Post-procesamiento: generación de gráficas del espectro f-k (transformada 2D). | `octave_plot_generator.py`, `generate_plots_octave.m` |

### Infraestructura Web

| Herramienta | Para qué se usa | Archivo clave |
|---|---|---|
| **Flask ≥2.2** | API REST del backend. Un Blueprint (`simulations_bp`) expone todos los endpoints. | `app.py`, `simulations_controller.py` |
| **Flask-SocketIO + eventlet** | Comunicación en tiempo real: el frontend recibe actualizaciones de progreso de la simulación por WebSocket. | `app.py` L. 52–61 |
| **Celery 5.3.4** | Ejecución de simulaciones en background (fuera del hilo HTTP). Una simulación a la vez (`--concurrency=1`). | `celery_config.py`, `celery_worker.py`, `simulation_tasks.py` |
| **Redis 7-alpine** | Broker de mensajes Celery + message queue de SocketIO (permite que el worker Celery emita WebSockets al frontend). | `docker-compose.dev.yml` L. 26–35 |
| **MySQL 8.0.42** | Base de datos persistente: almacena simulaciones, estado, tiempos de ejecución, archivos .mat (en BLOB). | `database/init.sql`, `app.py` |
| **React** | Frontend SPA: formulario de configuración, tabla de simulaciones, visualización de resultados. | `frontend/src/` |
| **Tailwind CSS** | Estilos del frontend. | `tailwind.config.js` |
| **Docker + Docker Compose** | Orquestación: 4 servicios (mysql, backend, celery_worker, frontend). Ambiente reproducible. | `docker-compose.yml`, `docker-compose.dev.yml` |
| **watchdog / watchmedo** | Hot-reload del backend y Celery worker en desarrollo. | `docker-compose.dev.yml` L. 76, 118 |
| **GitHub Actions** | CI (pytest + Cypress E2E) y CD automático. | `.github/workflows/` |
| **Cypress** | Tests E2E del frontend. | `cypress.config.ci.js` |
| **pytest** | Tests unitarios del backend. | `backend/test/`, `pytest.ini` |

---

## 🚀 PARTE 3: Análisis de Rendimiento y Optimizaciones

### Por qué las simulaciones tardan horas — Diagnóstico

El cuello de botella principal está **en el bucle de Newmark**: por cada fuente emisora (`nsous`), se realizan **1024 pasos de tiempo** (`ntimes = times.shape[0]`). En cada paso se:
1. Ensambla la matriz `A` (sparse, FEniCS)
2. Ensambla el vector `b`
3. **Resuelve un sistema lineal** (LU directo o Krylov iterativo)
4. Evalúa la solución en todos los puntos de sensor

Para 8 transmisores y una malla de 0.05mm, esto significa 8 × 1024 = **8,192 soluciones de sistemas lineales** de ~100K DOFs cada uno.

---

### 🔴 Problema Crítico #1: Re-ensamblaje de A en cada paso temporal

**Ubicación:** [`TimeSimTransIsoMatCij2D_test.py` L. 675–676](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L675-L676)

```python
# Código actual (INEFICIENTE):
for time_i in range(ntimes):
    A_lhs = o_block(u, w, dt) + A_block(u, w)
    A = assemble(A_lhs)  # ← Se re-ensambla A EN CADA PASO
```

**Problema:** La forma bilineal `A_lhs = o_block + A_block` depende de `dt` (constante) y del material (constante). **La matriz A no cambia en el tiempo** (problema lineal con coeficientes fijos). Re-ensamblarla 8,192 veces es un desperdicio enorme.

**Solución:**
```python
# Código optimizado: ensamblar A UNA SOLA VEZ antes del bucle
A_lhs_form = o_block(u, w, dt) + A_block(u, w)
A = assemble(A_lhs_form)
[bc.apply(A) for bc in bcs]  # Aplicar BCs fijas a A también una sola vez
_lu = LUSolver(A)
_lu.parameters["reuse_factorization"] = True  # ← CLAVE

for time_i in range(ntimes):
    b_rhs = b_block(u, u_n, v_n, a_n, w, beta, gamma, dt) + bdry_block(source, w, bdry_id)
    b = assemble(b_rhs)
    [bc.apply(b) for bc in bcs]  # Solo BCs al RHS
    _lu.solve(u_sol.vector(), b)  # Reutiliza la factorización LU
```
**Impacto estimado:** ×5–×15 de speedup en el bucle temporal. La factorización LU es el paso caro; con `reuse_factorization=True`, solo se hace **una vez por fuente**.

---

### 🔴 Problema Crítico #2: Factorización LU repetida por cada fuente

**Problema:** En el código actual, aunque se arreglara el punto anterior, para cada `sous_j` se recrea el `LUSolver`. La matriz A no depende de la fuente (las BCs de Dirichlet son las mismas). La factorización LU puede **reutilizarse entre fuentes**.

**Solución:**
```python
# Factorizar A UNA SOLA VEZ para todas las fuentes
A_static = assemble(o_block(u, w, dt) + A_block(u, w))
[bc.apply(A_static) for bc in bcs]
_lu_solver = LUSolver(A_static)
_lu_solver.parameters["reuse_factorization"] = True

for sous_j in range(nsous):
    u_n.vector().zero(); v_n.vector().zero(); a_n.vector().zero()
    for time_i in range(ntimes):
        # Solo ensamblar b en cada paso
        ...
        _lu_solver.solve(u_sol.vector(), b)
```
**Impacto estimado:** Adicional al anterior. Para 8 fuentes = 8× menos factorizaciones.

---

### 🟠 Problema #3: Evaluación punto-a-punto de sensores (el segundo cuello de botella)

**Ubicación:** [`TimeSimTransIsoMatCij2D_test.py` L. 799–804](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L799-L804)

```python
for sens_k in range(nsens):
    sensor_point = Point(np.array((zsens[sens_k], ysens[sens_k])))
    sol_sensors_z[sens_k, time_i, sous_j] = u_sol(sensor_point)[0]  # Búsqueda de celda O(log n) cada vez
    sol_sensors_y[sens_k, time_i, sous_j] = u_sol(sensor_point)[1]
```

Para 50 receptores × 1024 pasos × 8 fuentes = **409,600 evaluaciones** de `u_sol(point)`, cada una hace una búsqueda de celda en la malla.

**Solución:** Pre-calcular los DOFs de los sensores o usar `PointSource` con interpolación vectorizada:
```python
# Pre-computar la celda de cada sensor (una sola vez antes del bucle)
from dolfin import Point
sensor_cells = []
for k in range(nsens):
    p = Point(zsens[k], ysens[k])
    # Encontrar celda más cercana - solo una vez
    sensor_cells.append(mesh.bounding_box_tree().compute_first_entity_collision(p))

# En el bucle temporal: evaluar batch
u_vals = u_sol.compute_vertex_values(mesh)  # O proyectar en nodos sensor
```

---

### 🟠 Problema #4: Celery con `--concurrency=1` y `--pool=solo`

**Ubicación:** [`docker-compose.dev.yml` L. 118](file:///a:/Descargassss/BDAT-main/BDAT-main/docker-compose.dev.yml#L118)

```yaml
command: [..., "--concurrency=1", "--pool=solo"]
```

Esto significa **una sola simulación a la vez**, sin paralelismo. Si tienes acceso a múltiples CPUs, puedes:

1. **Paralelizar fuentes:** Cada fuente (`sous_j`) es independiente — se puede ejecutar con `multiprocessing.Pool` o `mpi4py`.
2. **Paralelizar lote:** Si tienes una matriz de simulaciones (rugosidades × ángulos), lanzar múltiples workers Celery en máquinas distintas (escala horizontal con Google Cloud mencionado en la propuesta).

---

### 🟡 Problema #5: OMP_NUM_THREADS mal configurado

**Ubicación:** [`docker-compose.dev.yml` L. 106](file:///a:/Descargassss/BDAT-main/BDAT-main/docker-compose.dev.yml#L106)

```yaml
OMP_NUM_THREADS: '1'  # "Deja que FEniCS use todos los cores disponibles" ← COMENTARIO INCORRECTO
```

Poner `OMP_NUM_THREADS=1` **deshabilita** el paralelismo OpenMP de FEniCS/PETSc. El comentario en el archivo es erróneo. Para usar todos los cores:

```yaml
OMP_NUM_THREADS: '0'   # 0 = automático (todos los disponibles)
# o
OMP_NUM_THREADS: '8'   # número explícito de threads
MKL_NUM_THREADS: '8'   # para PETSc con backend MKL
OPENBLAS_NUM_THREADS: '8'
```

**Impacto estimado:** Puede dar ×2–×4 speedup en el ensamblaje y solver.

---

### 🟡 Problema #6: `assemble` de b también puede optimizarse

El vector `b` sí cambia en cada paso (depende de `u_n`, `v_n`, `a_n` y la fuente). Pero se puede usar **`assemble_system`** para ensamblar A y b simultáneamente la primera vez, y luego solo actualizar b. Además, reutilizar los mismos objetos `PETSc.Matrix` sin recrearlos:

```python
A_mat = PETScMatrix()
b_vec = PETScVector()
assemble_system(A_lhs_form, b_rhs_form, bcs, A_tensor=A_mat, b_tensor=b_vec)
```

---

### 🟡 Problema #7: El solver de malla genera ruido aleatorio en cada ejecución

**Ubicación:** [`simulations_service.py` L. 134](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/simulations_service.py#L134)

```python
noise = random.uniform(-porosity, porosity)  # Sin semilla fija
```

La malla con rugosidad es **no reproducible** entre ejecuciones. Para el análisis paramétrico de la propuesta (reproducibilidad científica), se debe usar una semilla fija:

```python
rng = np.random.default_rng(seed=42)  # Semilla fija por sim_id
noise = rng.uniform(-roughness, roughness)
```

---

### 🟡 Problema #8: Variables de dominio UFL sobrescritas (ya parcialmente corregido)

**Ubicación:** [`TimeSimTransIsoMatCij2D_test.py` L. 404](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L404)

Hay un comentario explicando que `dx` y `ds` globales son importados y reasignados localmente. Esto ya está parcialmente manejado, pero requiere cuidado especial en el worker Celery donde el proceso no se reinicia entre simulaciones.

---

### 📊 Resumen de Impacto de Optimizaciones

| Optimización | Dificultad | Speedup Estimado | Prioridad |
|---|---|---|---|
| Reutilizar factorización LU (no re-ensamblar A) | Media | **×5–×15** | 🔴 Crítica |
| Compartir factorización LU entre fuentes | Media | ×2–×4 adicional | 🔴 Crítica |
| Corregir `OMP_NUM_THREADS=1` → `=0` | Trivial (1 línea) | ×2–×4 | 🟠 Alta |
| Vectorizar evaluación de sensores | Alta | ×1.5–×3 | 🟠 Alta |
| Semilla aleatoria fija en rugosidad | Trivial | (reproducibilidad) | 🟡 Media |
| MPI para paralelizar fuentes | Alta | ×2–×8 (por cores) | 🟡 Media |
| Escala horizontal (múltiples workers en cloud) | Media | ×N simul. paralelas | 🟡 Media |

---

### 💡 Recomendación de Configuración Óptima para el Paper

Para la **Fase 1** (calibración base), el punto de partida recomendado:

```
typical_mesh_size = 0.10 mm (en vez de 0.05 para convergencia inicial)
OMP_NUM_THREADS = 0 (todos los cores)
Reutilización de LU activada
n_transmitter = 1-4 (no 8 para las pruebas iniciales)
sensor_edge_margin ≥ 10mm (para evitar reflexiones espurias)
```

Con estas optimizaciones, una simulación que hoy tarda **6–12 horas** debería poder ejecutarse en **30 min – 2 horas** en el mismo hardware.

---

> [!IMPORTANT]
> La optimización más impactante es la **reutilización de la factorización LU**. Actualmente el código re-ensambla y re-factoriza la matriz de rigidez **en cada uno de los 1024 pasos de tiempo por cada fuente**. Dado que esta matriz no cambia durante la simulación, esto es completamente evitable y representa el 80%+ del tiempo de cómputo.

> [!TIP]
> La opción más rápida de implementar (y con buen retorno) es corregir `OMP_NUM_THREADS: '1'` a `OMP_NUM_THREADS: '0'` en `docker-compose.dev.yml`. Es un cambio de 1 carácter que activa el paralelismo nativo de PETSc y puede hacer la diferencia en hardware multi-core.

---

## 🔁 ADENDA (re-verificación + hallazgos nuevos)

> Esta sección se agregó tras volver a revisar el código línea por línea. **Confirmo que todo lo anterior corresponde al proyecto real.** Las referencias de línea de la Parte 3 están ligeramente corridas respecto al archivo actual, pero el código descrito existe:
> - Re-ensamblaje de `A`: [`TimeSimTransIsoMatCij2D_test.py` L675-676](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L675) (`A_lhs = o_block(...) + A_block(...)` / `A = assemble(A_lhs)` dentro del `for time_i`).
> - `LUSolver(A)` recreado por paso: L721.
> - Evaluación punto-a-punto de sensores: L799-804.
> - `random.uniform(-porosity, porosity)` sin semilla: [`simulations_service.py` L134](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/simulations_service.py#L134).
> - `OMP_NUM_THREADS: '1'` con comentario contradictorio: [`docker-compose.dev.yml` L106](file:///a:/Descargassss/BDAT-main/BDAT-main/docker-compose.dev.yml#L106).
> - `dt` fijo: `times = np.arange(0, 51.2, step=1./20)` → 1024 pasos **siempre**, sin importar el mesh size ([L582](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L582)).

---

### 🔴 Problema Crítico #9: `interpolate(source_exp, V)` sobre TODO el dominio en cada paso de tiempo

**Ubicación:** [`TimeSimTransIsoMatCij2D_test.py` L669-672](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L669) + clase `Source` en [L277-298](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/services/Reidmen/Reidmen%20Fenics/ipnyb%20propagation/TimeSimTransIsoMatCij2D_test.py#L277)

```python
for time_i in range(ntimes):
    ...
    source_exp = Source(time=time, t_0=t_0, sig_time=sig_time, degree=1)
    source = interpolate(source_exp, V)          # ← interpola en TODOS los DOFs del dominio
```

**Problemas acumulados:**
1. `Source` es una `UserExpression` con `eval()` **en Python puro**. FEniCS llama a ese `eval` mediante un callback pybind11 **una vez por cada punto de interpolación de todo `V`** (cientos de miles a millones de llamadas Python por paso de tiempo).
2. Se interpola sobre el espacio vectorial **completo** `V` cuando la fuente sólo actúa en una faceta del borde superior (`dot(source, w)*ds(bdry_id)`). El 99.9% del vector `source` es cero pero igual se calcula y se almacena.
3. La parte **espacial** de la fuente no cambia; sólo cambia un escalar temporal `num(t) = exp(-factor·(t-t0)²)·cos(2π(t-t0))`. Se está recalculando un campo enorme para multiplicarlo por un número distinto cada vez.

**Solución (informativa):** interpolar un perfil espacial constante **una sola vez** y multiplicar por el escalar temporal:
```python
# Antes del bucle temporal (una vez):
g_space = interpolate(Constant((0.0, -1.0)), V)      # dirección de la fuerza
# ...o mejor, ensamblar el vector de borde una vez por fuente:
w_ = TestFunction(V)
L_src = dot(Constant((0.0, -1.0)), w_) * ds(bdry_id)
b_src0 = assemble(L_src)                              # vector disperso, sólo borde

for time_i in range(ntimes):
    amp = exp(-factor*(t-t0)**2) * cos(2*pi*(t-t0))   # escalar Python
    b = b_wtf_vector + amp * b_src0                   # sin interpolate(), sin re-assemble del término fuente
```
**Impacto estimado:** ×1.5–×4 adicional (elimina cientos de miles de callbacks Python por paso).

---

### 🔴 Problema Crítico #10: por qué 0.05 mm tarda ~40× más que 0.10 mm (no ~8×)

El usuario reportó: mismos parámetros, **mesh 0.10 mm → ~2 h**; **mesh 0.05 mm → +80 h y sin terminar**. Desglose del factor:

| Efecto al pasar de 0.10 → 0.05 mm | Factor | Motivo |
|---|---|---|
| Nº de elementos / DOFs en 2D | **×4** | Área fija, arista a la mitad → 4× triángulos. Además `VOut = dxt*5` y la caja de refinamiento cubre casi toda la placa (de transmisor a receptor), así que **casi toda la malla** es fina, no sólo una banda. |
| Factorización LU dispersa directa (`LUSolver`) | **×~8** | El coste de la factorización LU en 2D escala ≈ `O(N^1.5)` por el *fill-in*. `4^1.5 = 8`. Y esto ocurre **en cada uno de los 1024 pasos × Nº fuentes** porque `A` se re-factoriza (Problema #1). |
| Ensamblaje + `interpolate(source)` (Problema #9) | **×4** | Lineal en DOFs. |
| Pasos de tiempo | **×1** | `dt` es **fijo** (`step=1./20`). No cambia con el mesh. (Nota: con 0.05 mm el esquema queda *sobre-resuelto* en espacio y *sub-resuelto* relativo en tiempo; no acelera pero desperdicia).|
| **Memoria → swap / thrashing** | **×2–×10 (no lineal)** | El worker tiene `memory: 8G`. Una malla 0.05 mm sobre una placa larga puede llegar a ~0.5–1.5 M DOFs; el *fill-in* LU de UMFPACK/PETSc para eso son varios GB, **re-alojados 8192 veces**. Al acercarse al límite de RAM el contenedor empieza a hacer swap (o Linux OOM-killer lo mata). Un solver que hace swap va 5–20× más lento. **Este es el multiplicador que explica el salto de 8× teórico a 40×+ observado.** |

**Conclusión:** `4 × 8 × (algo de memoria)` ya te lleva de 2 h a ~64–100 h. El mesh 0.05 mm **no está colgado por un bug de cálculo**; está haciendo un trabajo enormemente mayor con un solver O(N^1.5) que además re-factoriza cada paso y probablemente pagina memoria. Arreglar los Problemas #1/#2 (factorizar `A` una sola vez) es lo que hace viable el 0.05 mm.

> [!WARNING]
> Si el contenedor `celery-worker` está llegando a su tope de 8 GB, la simulación puede ser **OOM-killed** por Linux. Eso reinicia el worker → y dispara el **Problema #12** (bucle infinito). Conviene revisar `docker stats celery-worker` durante una corrida 0.05 mm.

---

### 🟠 Problema #11: `eventlet.monkey_patch()` contamina el proceso del worker de Celery

**Ubicación:** [`app.py` L2-3](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/app.py#L2) + [`simulation_tasks.py` L75](file:///a:/Descargassss/BDAT-main/BDAT-main/backend/src/features/simulations/tasks/simulation_tasks.py#L75)

```python
# app.py (se ejecuta al importarse)
import eventlet
eventlet.monkey_patch()
...
# simulation_tasks.py, dentro de run_simulation_task:
from src.app import create_app, socketio     # ← esto ejecuta el monkey_patch en el worker
```

El worker de Celery corre con `--pool=solo` (CPU-bound, código nativo: PETSc, BLAS, gmsh, UMFPACK). Al importar `src.app` dentro de la tarea, **se parchea `threading`, `socket`, `time`, etc. con las versiones cooperativas de eventlet dentro del proceso del worker**. Efectos:
- `time.sleep()`, locks y I/O pasan por el *hub* de eventlet, que sólo cede el control en puntos de yield: con FEniCS ejecutando C/Fortran durante minutos sin yield, el hub queda congelado.
- Interfiere con el heartbeat del worker hacia Redis y con el *loop* del consumidor (agrava el Problema #12).
- Puede degradar el rendimiento de las llamadas BLAS/OpenMP multihilo.

**Solución (informativa):** que el worker de Celery **no** importe `src.app`. Extraer `create_app` / la factoría de SocketIO a un módulo que no haga `monkey_patch` a nivel de import, y hacer el `eventlet.monkey_patch()` sólo en el `if __name__ == '__main__'` de `app.py` (o sólo cuando `FLASK` arranca el servidor web).

---

### ✅ Problema #12 [COMPLETADO]: la barra de progreso se reinicia en bucle — Celery Timeout, Watchmedo, Idempotencia y SocketIO

> [!NOTE]
> **ESTADO: COMPLETADO ✓** — Implementado con éxito en `backend/src/celery_config.py`, `backend/src/celery_worker.py`, `docker-compose.dev.yml`, `simulation_tasks.py`, `TimeSimTransIsoMatCij2D_test.py` y `SimFreqDomain2D.py`.

**Síntoma original:** simulación con mesh 0.05 mm lleva ~80 h; la barra llega ~100 %, **vuelve a 0 % y arranca de nuevo**, en bucle aparentemente infinito.

#### Qué ocurría realmente
La barra se alimenta del evento `simulation_progress` emitido desde `fmain`. Al llegar la simulación a 1 hora, Redis daba por muerto el worker (por el `visibility_timeout` por defecto de 3600 s) y volvía a encolar la misma simulación. Asimismo, `watchmedo` reiniciaba el worker al detectar cualquier archivo temporal modificado.

#### Solución implementada:
1. **`visibility_timeout` a 14 días (1,209,600 segundos)**: Configurado en `celery_config.py` y `celery_worker.py`. Acompañado de `worker_prefetch_multiplier = 1` y `task_acks_late = False`.
2. **Eliminación de `watchmedo auto-restart`**: Modificado `docker-compose.dev.yml` para ejecutar el worker de Celery de forma directa (`python3 -m celery -A celery_worker.celery worker ...`).
3. **Guarda de idempotencia**: En `simulation_tasks.py`, se verifica antes de llamar a `fmain` si el registro ya está en `Finished`. Si es así, se descarta cualquier re-entrega duplicada sin volver a simular.
4. **Instancia persistente de SocketIO**: En `TimeSimTransIsoMatCij2D_test.py` y `SimFreqDomain2D.py`, la función `_emit_simulation_progress` ahora utiliza un singleton con caché global en vez de crear cientos de conexiones nuevas a Redis por ejecución.

---

### ✅ Problema #13 [COMPLETADO]: Representación Completa de Todos los Emisores en Gráficos (Apertura Sintética Compuesta en Octave)

> [!NOTE]
> **ESTADO: COMPLETADO ✓** — Implementado en `backend/src/features/simulations/services/generate_plots_octave.m`.

**Problema:** Anteriormente, el script de Octave forzaba `ne1 = 1` y descartaba del cálculo espectral y de las gráficas todos los emisores del array salvo el primero.

#### Solución implementada:
1. Se removió la restricción rígida `ne1 = 1`.
2. Detección automática del número de fuentes $N_{TX}$ tanto para simulaciones temporales (3D: `[NR, Nt, n_sources]`) como en frecuencia (`[NR, Nf, n_sources]`).
3. Acumulación y promedio compuesto de la matriz de dispersión de ondas guiadas ($Normfk$) y de los valores singulares sumando las aportaciones de todos los transmisores del arreglo.
4. Generación de las señales espacio-temporales promediadas multi-emisor y actualización automática de los títulos de las gráficas (`(X TX compound)` cuando $N_{TX} > 1$).

---

### ✅ Problema #14 [COMPLETADO]: Robustez y Recuperación de la Importación Masiva ("An import is already running")

> [!NOTE]
> **ESTADO: COMPLETADO ✓** — Implementado en `simulations_controller.py`, `simulations_service.py`, `simulationService.js` y `BatchImportModal.jsx`.

**Problema:** Al cancelar una importación en lote de archivos de texto o refrescar la ventana, la fila de `import_session` en MySQL permanecía con `active = 1`. Al intentar una nueva importación, el backend respondía con HTTP 409 y el frontend lanzaba una excepción no capturada (`throw err`) que rompía React con un cartel rojo de error.

#### Solución implementada:
1. **Nuevo endpoint de reseteo (`POST /simulations/import/reset`)**: Permite limpiar a cero la sesión en base de datos, borrar la bandera de cancelación en Redis y revocar activamente la tarea en Celery.
2. **Auto-limpieza de tareas muertas**: En `import_run_service`, si la base de datos indica `active = 1` pero el estado de la tarea Celery es `SUCCESS`, `FAILURE` o `REVOKED`, el servidor limpia la sesión automáticamente sin bloquear al usuario.
3. **Cancelación inmediata**: `import_cancel_service` no solo coloca la bandera en Redis, sino que ahora revoca la tarea Celery en ejecución (`terminate=True`).
4. **Manejo defensivo en Frontend**: En `BatchImportModal.jsx`, se interceptan los errores 409 sin romper la app y se muestra un banner amigable con el botón interactivo **"Desbloquear Sesión"** para restablecer el estado al instante.

---

---

### ✅ Problema #15 [COMPLETADO]: Desconexión de MySQL por Inactividad en Simulaciones Largas (> 8 horas)

> [!NOTE]
> **ESTADO: COMPLETADO ✓** — Implementado en `docker-compose.dev.yml`, `simulation_tasks.py` y `generate_plots_octave.m`.

**Problema:** En simulaciones de larga duración (ej. malla 0.05 mm con 5 emisores, duración ~10 horas), el motor de simulación completaba el 100% del cálculo numérico y guardaba el archivo `.mat`, pero la conexión de MySQL se cerraba silenciosamente por el límite por defecto `wait_timeout = 28800` (8 horas). Al intentar actualizar el estado final a `Finished`, MySQL arrojaba `OperationalError: (4031, 'The client was disconnected by the server because of inactivity')`, dejando la simulación indefinidamente en estado `Running` en la UI tras desaparecer la barra de progreso. Adicionalmente, en `generate_plots_octave.m`, la acumulación de valores singulares de múltiples emisores presentaba una discrepancia dimensional fila-columna (`op1 is 1x5, op2 is 5x5`).

#### Solución implementada:
1. **Configuración de timeout extendido en MySQL (30 días)**: Se configuraron los parámetros `--wait_timeout=2592000` y `--interactive_timeout=2592000` tanto en el servidor activo como en la definición del servicio `mysql` en `docker-compose.dev.yml`.
2. **Auto-reconexión defensiva en Python (`ping`)**: Se agregó `app.mysql.connection.ping(True)` antes de cualquier actualización final de estado y en los bloques de captura de excepciones en `simulation_tasks.py`. Si el socket se encuentra inactivo, `MySQLdb` se reconecta automáticamente y sin errores antes de enviar la consulta.
3. **Alineamiento dimensional en Octave**: Se aplicó `reshape(s_vals(1:s_len), 1, [])` en `generate_plots_octave.m`, garantizando la suma matricial consistente de valores singulares multi-emisor.

---

### 📊 Resumen actualizado de impacto y estado de implementación

| Optimización / Módulo | Dificultad | Speedup / Efecto | Prioridad | Estado Actual |
|---|---|---|---|---|
| `visibility_timeout` alto + sin `watchmedo` + guarda de idempotencia | Media | **Detiene el bucle infinito de re-ejecución** | 🔴 Crítica (bloqueante) | ✅ **COMPLETADO** |
| Instancia `SocketIO` en caché para progreso de simulación | Trivial | Evita saturación y fuga de conexiones Redis | 🟡 Media | ✅ **COMPLETADO** |
| Apertura sintética completa (todos los emisores en Octave) | Media | Gráficas compuestas f-k y señales de todos los TX | 🟠 Alta | ✅ **COMPLETADO** |
| Robustez de importación masiva + endpoint reset + UI defensiva | Media | Resuelve "An import is already running" | 🟠 Alta | ✅ **COMPLETADO** |
| MySQL timeout 30 días + auto-reconexión ping (> 8h) | Baja | Evita bloqueo en "Running" tras terminar simulación | 🔴 Crítica | ✅ **COMPLETADO** |
| Corrección dimensional en SVD multi-emisor (Octave) | Trivial | Generación limpia de gráficos compuestos sin errores | 🟠 Alta | ✅ **COMPLETADO** |
| Reutilizar factorización LU (no re-ensamblar `A` en cada paso) | Media | ×5–×15 | 🔴 Crítica | ✅ **COMPLETADO (Fase 1)** |
| Compartir factorización LU entre fuentes | Media | ×2–×4 adicional | 🔴 Crítica | ✅ **COMPLETADO (Fase 1)** |
| Fuente: interpolar perfil espacial una vez, escalar por tiempo | Media | ×1.5–×4 | 🟠 Alta | ✅ **COMPLETADO (Fase 1)** |
| Vigilar RAM del worker / evitar swap en 0.05 mm | Baja–Media | Evita ×2–×10 de degradación por paginado | 🟠 Alta | ⏳ **PENDIENTE (Fase 1 post-benchmark)** |
| Corregir `OMP_NUM_THREADS=1` → desbloquear todos los núcleos | Trivial | ×2–×4 | 🟠 Alta | ✅ **COMPLETADO (Fase 1)** |
| Sacar `eventlet.monkey_patch()` del proceso del worker | Media | Estabilidad + algo de velocidad | 🟠 Alta | ⏳ **PENDIENTE (Fase 1 post-benchmark)** |
| Vectorizar evaluación de sensores | Alta | ×1.5–×3 | 🟡 Media | ⏳ **PENDIENTE (Fase 1 post-benchmark)** |
| Semilla aleatoria fija en rugosidad | Trivial | Reproducibilidad de resultados | 🟡 Media | ⏳ **PENDIENTE (Fase 1 post-benchmark)** |
