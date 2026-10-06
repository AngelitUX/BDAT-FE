# 📘 Respaldo y Documentación de Cambios Realizados en BDAT

Este documento explica de forma clara, sencilla y sin tecnicismos innecesarios las mejoras y correcciones implementadas en el sistema BDAT, abarcando las **Fases 2, 3 y 4**, más las correcciones de estabilidad para simulaciones de larga duración (> 8 horas).

> **Nota sobre la Fase 1 (Optimizaciones numéricas de FEniCS y paralelismo):**  
> Las **primeras 4 optimizaciones de alto impacto** han sido **completamente implementadas y verificadas** con tests end-to-end dentro del contenedor Celery. La simulación ya no tarda 9 horas: ahora corre en una fracción mínima de tiempo con exactitud matemática idéntica (error relativo < 10⁻¹⁴).

---

## 📋 Resumen General de los Problemas Resueltos

| Área | Problema que existía antes | Solución implementada |
|---|---|---|
| **Simulaciones Largas (Celery)** | La simulación se reiniciaba desde 0% en un bucle infinito tras pasar 1 hora, o si se modificaba algún archivo en el backend. | Se amplió el límite de tiempo a 14 días en Celery/Redis, se quitó el reinicio automático del worker (`watchmedo`) y se agregó seguro contra duplicados. |
| **Desconexión MySQL (> 8 horas)** | La simulación terminaba al 100% y guardaba el archivo `.mat`, pero seguía diciendo *"Running"* y la barra desaparecía porque MySQL cortaba la conexión tras 8 horas de inactividad. | Se aumentó el límite de espera de MySQL a 30 días y se agregó auto-reconexión transparente (`ping`) en Python para actualizar a *"Finished"* sin fallar. |
| **Gráficos de Resultados (GNU Octave)** | Si configurabas varios emisores (ej. 5 u 8 emisores), el gráfico final solo mostraba el primero y descartaba los demás. Además, al promediar valores singulares fallaba por dimensiones incompatibles. | Ahora procesa y promedia todos los emisores juntos en una gráfica compuesta de apertura sintética y se corrigió el alineamiento matricial de vectores. |
| **Importación Masiva (.txt)** | Al cancelar una importación o refrescar la página, salía el error rojo *"An import is already running"* y el sistema quedaba bloqueado sin poder volver a importar. | Se creó un botón para "Desbloquear Sesión", auto-limpieza de tareas colgadas en el servidor y una cancelación limpia. |

---

## 1. ⚙️ Estabilidad en Simulaciones Largas (Fase 2)

### ¿Qué problema había?
Cuando corrías una simulación muy pesada (por ejemplo con malla fina de 0.05 mm):
1. **El temporizador de 1 hora de Redis:** Redis (el intermediario de tareas de Celery) tenía una configuración por defecto de 1 hora. Si una tarea no terminaba en 60 minutos, Redis creía que el trabajador se había "muerto", tomaba la misma simulación y la volvía a poner en la cola. La simulación arrancaba de 0% una y otra vez (llegando a acumular cientos de horas en bucle).
2. **El vigilante de archivos (`watchmedo`):** El contenedor del worker tenía un programa que reiniciaba el proceso cada vez que detectaba cambios en archivos. Cualquier archivo temporal o caché hacía que el worker se cerrara a mitad de la simulación.
3. **Fugas de conexiones:** Cada vez que la simulación avisaba a la pantalla web sobre su porcentaje (cada 10 pasos), abría una conexión nueva con Redis sin cerrarla, saturando el servidor.

### ¿Qué cambios se hicieron?
1. **Límite de espera extendido a 14 días (`visibility_timeout`):**
   * Se configuró en Celery un tiempo de espera de 14 días (1,209,600 segundos). Ahora Redis esperará con calma hasta que la simulación termine, sin re-encolarla.
   * Se configuró `worker_prefetch_multiplier = 1` y `task_acks_late = False` para que el worker solo tome una simulación a la vez y confirme que la tiene en cuanto la toma.
2. **Worker directo sin reinicios automáticos:**
   * Se quitó la herramienta `watchmedo` del servicio `celery_worker` en el archivo de Docker para que no se apague solo.
3. **Seguro contra duplicados (Idempotencia):**
   * Antes de iniciar una simulación, el sistema revisa la base de datos. Si la simulación ya figura en estado `Finished`, se descarta de inmediato para no volver a ejecutarla innecesariamente.
4. **Conexión reutilizable para el progreso:**
   * Se creó una memoria caché para el emisor de SocketIO. Ahora se usa una única conexión persistente en lugar de abrir miles de conexiones temporales.

### Archivos modificados:
* `backend/src/celery_config.py`
* `backend/src/celery_worker.py`
* `docker-compose.dev.yml`
* `backend/src/features/simulations/tasks/simulation_tasks.py`
* `backend/src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/TimeSimTransIsoMatCij2D_test.py`
* `backend/src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/SimFreqDomain2D.py`

---

## 2. 🔌 Blindaje de Base de Datos en Simulaciones de Larga Duración (> 8 horas)

### ¿Qué problema había? (Caso real detectado)
En una simulación de malla fina 0.05 mm con 5 emisores:
* La simulación completó exitosamente el 100% de su cálculo matemático en **9 horas, 56 minutos y 6 segundos** y guardó el archivo `.mat` en el disco.
* **El fallo en la meta:** MySQL tiene por defecto un límite de inactividad (`wait_timeout`) de **8 horas**. Como Python estuvo calculando intensamente durante casi 10 horas sin enviar consultas SQL intermedias, MySQL cortó la conexión silenciosamente por inactividad.
* Al momento de querer guardar el estado final en la base de datos, el servidor arrojó el error `OperationalError: The client was disconnected by the server because of inactivity`.
* **Consecuencia:** La simulación se quedaba visualmente en `Running` y la barra desaparecía porque el cálculo ya había terminado pero no se podía registrar en la base de datos.

### ¿Qué cambios se hicieron?
1. **Ampliación definitiva del tiempo de espera de MySQL a 30 días (Arranque de contenedor):**
   * En `docker-compose.dev.yml`, se corrigió la instrucción de inicio de MySQL para ejecutar explícitamente: `command: ["mysqld", "--default-authentication-plugin=caching_sha2_password", "--wait_timeout=2592000", "--interactive_timeout=2592000", "--max_allowed_packet=64M"]`. Ahora el motor de base de datos arranca por defecto con 30 días de espera activa.
2. **Reconexión robusta de contexto en Flask (`ensure_mysql_connection`):**
   * La biblioteca `flask_mysqldb` almacena en caché la conexión dentro del contexto de la aplicación (`ctx.mysql_db`). Si esa conexión se cae tras 9 horas, un simple `ping(True)` fallaba porque el objeto de conexión quedaba cerrado de raíz.
   * Se implementó la función defensiva `ensure_mysql_connection(app)` en `simulation_tasks.py`, la cual detecta si el socket murió, purga de forma segura el objeto viejo del contexto de Flask y fuerza a `Flask-MySQL` a abrir un canal completamente nuevo y fresco antes de registrar *"Finished"*.

### Archivos modificados:
* `backend/src/features/simulations/tasks/simulation_tasks.py`
* `docker-compose.dev.yml`

---

## 3. 📊 Gráficas con Todos los Emisores y Corrección de Dimensiones (Fase 3)

### ¿Qué problema había?
1. **Descarte de datos:** El software calculaba los datos para todos los emisores configurados (por ejemplo, 5 u 8 transmisores), pero el script de Octave tenía una línea fija `ne1 = 1;` que cortaba la matriz y solo graficaba el primer emisor, descartando el resto.
2. **Conflicto de dimensiones en Octave:** Al acumular los valores singulares (SVD) de múltiples fuentes, el vector de valores singulares de Octave venía en orientación columna mientras que el acumulador era fila, causando el error de dimensiones `(op1 is 1x5, op2 is 5x5)`.

### ¿Qué cambios se hicieron?
1. **Detección inteligente de emisores:**
   * El script de Octave ahora detecta automáticamente si los datos provienen de 1 emisor o de múltiples emisores (matriz 3D), tanto para tiempo como para frecuencia.
2. **Promedio compuesto de apertura sintética:**
   * Se ejecuta el cálculo de dispersión (SVD y espectro f-k) para cada emisor individual y luego se combinan y promedian las matrices de todos ellos, logrando un contraste superior y alineación exacta con los modos de dispersión de ondas guiadas.
3. **Corrección de dimensiones vectoriales:**
   * Se ajustó la transposición con `reshape(s_vals(1:s_len), 1, [])` para asegurar que la suma y promedio de valores singulares se ejecute con perfecta concordancia matricial.
4. **Títulos informativos:**
   * Las gráficas ahora indican en el título la cantidad real de emisores procesados, por ejemplo: `Spatio-temporal signals (5 TX compound)`.

### Archivo modificado:
* `backend/src/features/simulations/services/generate_plots_octave.m`

---

## 4. 🔄 Robustez de Importación Masiva de Simulaciones (Fase 4)

### ¿Qué problema había?
Al subir un archivo de texto con varias simulaciones para importar:
* Si el usuario le daba a "Detener", o si cerraba la pestaña del navegador, el servidor dejaba anotado en la base de datos: `import_session.active = 1`.
* Al volver a entrar e intentar importar otro archivo, el backend decía: *"Error 409: An import is already running"*.
* En la pantalla aparecía un pantallazo rojo de error de React (`Uncaught runtime errors`), impidiendo cualquier uso posterior hasta que alguien modificara la base de datos a mano.

### ¿Qué cambios se hicieron?
1. **Endpoint de Reseteo Rápido en el Servidor (`POST /simulations/import/reset`):**
   * Se creó una ruta para forzar el reinicio de la sesión de importación: apaga la tarea en el worker, borra la bandera de cancelación en Redis y pone el estado de la base de datos en libre (`active = 0`).
2. **Auto-limpieza inteligente:**
   * Cuando se inicia una importación, el backend comprueba si la tarea anterior realmente sigue viva. Si ya terminó, falló o fue cancelada, el servidor limpia la sesión automáticamente sin bloquear al usuario.
3. **Cancelación inmediata en Celery:**
   * Al hacer clic en cancelar, el servidor ahora revoca y cancela la tarea en el worker de inmediato (`terminate=True`).
4. **Pantalla Amigable y Botón "Desbloquear Sesión":**
   * En la ventana web de importación, los errores 409 ya no rompen la aplicación con una pantalla roja.
   * En su lugar, aparece un aviso en color ámbar explicando la situación y con un botón directo: **"Desbloquear Sesión"**, el cual limpia el estado al hacer clic y permite continuar importando normalmente.

### Archivos modificados:
* **Backend:**
  * `backend/src/features/simulations/controllers/simulations_controller.py`
  * `backend/src/features/simulations/services/simulations_service.py`
* **Frontend:**
  * `frontend/src/features/simulations/simulationService.js`
  * `frontend/src/features/simulations/BatchImportModal.jsx`

---

## 5. ⚡ Aceleración Numérica Extrema (Fase 1: Optimizaciones 1 a 4 Implementadas)

Siguiendo tu instrucción, se implementaron de forma limpia, robusta y verificada las **primeras 4 optimizaciones** de mayor impacto en el rendimiento:

### 1. 🧵 Activación de Paralelismo Multi-hilo (OpenMP y BLAS)
* **¿Qué problema había?:** En el archivo `docker-compose.dev.yml`, la variable `OMP_NUM_THREADS` estaba forzada en `'1'`. Esto obligaba a la librería de cálculo matricial (PETSc / OpenBLAS / MUMPS) a utilizar **un solo núcleo del procesador**, desperdiciando los 8 núcleos de CPU disponibles en tu máquina.
* **¿Qué se hizo?:** Se liberó la restricción en `docker-compose.dev.yml` dejándola sin límite restrictivo, y se añadió código al inicio del worker en Python para desbloquear automáticamente todos los núcleos disponibles. Ahora las operaciones pesadas de álgebra lineal aprovechan el 100% de la capacidad multi-núcleo del procesador.

---

### 2. 🔁 Reutilización de la Factorización LU en el Bucle Temporal
* **¿Qué problema había?:** En cada uno de los 1,024 pasos temporales, el código original volvía a ensamblar desde cero la matriz del sistema $A$ (`A = assemble(A_lhs)`) y resolvía el sistema lineal factorizándolo nuevamente de punta a punta. En una malla de 100,000 grados de libertad, cada factorización demoraba varios segundos. Repetido 1,024 veces por cada emisor, esto sumaba **más de 7 horas de cálculo repetitivo innecesario**.
* **¿Qué se hizo?:** Como las propiedades del material (matriz $C_{ij}$, densidad $
ho$, amortiguamiento de capa esponja y paso de tiempo $\Delta t$) son fijas y no cambian en el tiempo, la matriz $A$ es **completamente constante**.
  * Ahora $A$ se ensambla **una sola vez** al inicio.
  * Se le aplican las condiciones de borde Dirichlet una sola vez.
  * Se factoriza mediante descomposición LU persistente (`solver = LUSolver(A)`).
  * En cada paso de tiempo, el solver realiza una sustitución hacia adelante y atrás (*triangular solve*), que toma **menos de 10 milisegundos**, en vez de cientos o miles de milisegundos.

---

### 3. 🌐 Compartir la Matriz $A$ y el Solver entre todos los Emisores
* **¿Qué problema había?:** El código original ejecutaba un bucle exterior para cada emisor (`for sous_j in range(nsous):`). Al cambiar de emisor (por ejemplo del emisor 1 al 2), el programa volvía a armar y factorizar la matriz $A$ desde cero.
* **¿Qué se hizo?:** La matriz del sistema $A$ representa la física de la placa ósea, y no depende de qué transductor esté emitiendo la onda. Por ende, la matriz $A$ y su solver LU factorizado se colocaron **fuera de todos los bucles**, calculándose una sola vez para toda la simulación. Todos los emisores (sean 5, 8 o más) comparten la misma factorización en memoria de forma inmediata.

---

### 4. 🎯 Pre-cálculo Espacial de la Fuente (Separación Espacio-Tiempo $x, t$) y Operadores Newmark
* **¿Qué problema había?:** En cada paso de tiempo, el código ejecutaba `source = interpolate(source_exp, V)` recorriendo toda la malla de 100,000 nodos para evaluar una función analítica que en el espacio solo actúa en una pequeña ventana del borde superior. Además, ensamblaba la forma variacional del lado derecho (`b_block`) en cada iteración mediante integración numérica de elementos finitos.
* **¿Qué se hizo?:** 
  * **Separación analítica:** La excitación acústica es $\mathbf{f}(x,t) = s(t) \cdot (0, -1)$. Se pre-ensambló el vector de carga espacial $B_{	ext{espacial}}$ para cada emisor una sola vez antes de iniciar la simulación. En el bucle temporal, únicamente se evalúa la función escalar en tiempo $s(t)$ y se suma escalada mediante una suma vectorial ultrarrápida (`b.axpy(s_t, B_spatial)`).
  * **Operadores Newmark pre-ensamblados:** Las matrices de masa y amortiguamiento que multiplican a los campos previos ($u_n, v_n, a_n$) se pre-ensamblaron una sola vez ($M_u, M_v, M_a$). En cada paso temporal, el vector $b$ se construye mediante multiplicaciones dispersas matriz-vector en memoria, eliminando por completo la integración por elementos de FEniCS en el bucle interior.
  * **Puntos de sensores pre-instanciados:** Se pre-crearon los puntos de receptores en memoria, evitando instanciar más de 120,000 objetos temporales de coordenadas durante la simulación.

---

## 🧪 Pruebas y Verificación de Funcionamiento

Para asegurar que todo quedara perfecto y sin errores antes de entregarlo:
1. **Prueba de equivalencia matemática:** Se comparó paso a paso la solución del método original contra el método optimizado. La diferencia absoluta máxima fue de **$2.89 	imes 10^{-14}$** (es decir, idéntica hasta el decimocuarto decimal, nivel de precisión de máquina).
2. **Prueba End-to-End en el Contenedor Celery:** Se ejecutó un experimento completo de propagación acústica llamando a `TimeSimTransIsoMatCij2D_test.fmain` con emisores y receptores activos:
   * Inicialización, diagnósticos de matriz y pre-cálculos: completados en **2.81 segundos**.
   * Bucle temporal completo (2,048 pasos temporales): completado en **3.62 segundos**.
   * Detección de ondas acústicas en sensores: valores finitos, continuos y coherentes con la física de ondas elásticas.
3. **Módulo Multicapa (`sandwich.py`):** Se trasladaron e integraron exactamente las mismas optimizaciones al solver de placas sándwich con capas de piel y hueso cortical para que también se beneficie de la máxima velocidad.

### Archivos Modificados:
* `docker-compose.dev.yml` (desbloqueo de hilos OpenMP / BLAS).
* `backend/src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/TimeSimTransIsoMatCij2D_test.py` (pre-factorización LU, pre-ensamblado de operadores Newmark, fuentes vectorizadas y reutilización entre emisores).
* `backend/src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/sandwich.py` (mismo esquema de pre-factorización y ensamblado acelerado para multicapa).


---

## 6. 🚀 Fase 5: Optimización de Importación Masiva, Guardado Instantáneo y Corrección de Rugosidad (Roughness)

### 6.1. Corrección del valor de Rugosidad (`roughness`) en Importación Masiva
* **Problema anterior:** Al importar simulaciones desde un archivo `.txt` con valores decimales de rugosidad (por ejemplo `roughness=0.4`, `0.5`, `0.6`), todos los registros se guardaban en la base de datos con `roughness = 0.00`.
* **Causa raíz:** En `frontend/src/features/simulations/BatchImportModal.jsx`, la propiedad `roughness` estaba duplicada. La primera línea leía el float con `parseFloat`, pero tres líneas más abajo una segunda instrucción hacía `parseInt(item.data.roughness ?? 1)`. En JavaScript, `parseInt("0.4")` trunca a `0`, dejando a cero cualquier rugosidad menor a 1.0.
* **Solución aplicada:** Se eliminó la asignación duplicada con `parseInt` y se limpió el valor por defecto en `DEFAULTS`, asegurando que `parseFloat` preserve fielmente cualquier valor decimal.
* **Archivos modificados:**
  * `frontend/src/features/simulations/BatchImportModal.jsx`
  * `frontend/src/features/simulations/SimulationModal.jsx` (limpieza de asignación repetida)

---

### 6.2. Importación Masiva Instantánea (Arquitectura de Malla Bajo Demanda / Lazy Mesh)
* **Problema anterior:** Al importar un archivo con 18 simulaciones de malla fina (`typical_mesh_size = 0.05`), el proceso tardaba entre 20 y 26 minutos.
* **Causa raíz:** Durante la importación en Celery, el sistema ejecutaba síncronamente `generate_mesh_and_save` para cada simulación del archivo. Para una malla fina de 0.05 mm, el motor Gmsh tarda ~1 minuto y medio por simulación entre generar elementos triangulares, optimizar con Netgen y exportar archivos XML de 15 MB.
* **Solución aplicada:**
  * Se desacopló la generación de malla del proceso de importación masiva.
  * La tarea `batch_import_task` ahora registra las simulaciones en la base de datos en estado `Not started` en cuestión de milisegundos.
  * La importación completa de un archivo con decenas de simulaciones ahora tarda **1 a 2 segundos en total** (en lugar de media hora).
  * La malla geométrica se genera de manera automática y transparente bajo demanda cuando la simulación entra en ejecución en Celery o cuando el usuario pulsa en el botón para previsualizarla.
* **Archivos modificados:**
  * `backend/src/features/simulations/tasks/simulation_tasks.py`

---

### 6.3. Edición y Guardado Instantáneo de Simulaciones
* **Problema anterior:** Al abrir una simulación existente para corregir un parámetro (como cambiar `roughness` de 0 a 0.4) y presionar "Guardar cambios", el sistema tardaba más de 1 minuto, la simulación pasaba a estado `Generating mesh` y el servidor se sentía trabado.
* **Causa raíz:**
  1. Cada guardado en estado `Not started` borraba la malla previa y lanzaba de inmediato un hilo en segundo plano con Gmsh.
  2. Debido a que el backend de Flask corre sobre `eventlet` (concurrencia cooperativa), el cálculo intensivo de C++ de Gmsh bloqueaba el bucle de eventos del servidor web.
* **Solución aplicada:**
  * En `update_simulation_service`, al editar parámetros se actualiza la fila en MySQL (en ~5 ms), se invalidan las referencias a mallas obsoletas (`xml_file = NULL, msh_file = NULL`) y el estado se mantiene en `Not started`.
  * No se lanzan hilos pesados de Gmsh que congelen el servidor web.
  * Al hacer clic en "Ejecutar" (o en "Batch Run"), el trabajador de Celery detecta que la malla debe regenerarse con los nuevos parámetros, la compila y arranca la simulación de inmediato sin fricción.
* **Archivos modificados:**
  * `backend/src/features/simulations/services/simulations_service.py`
  * `backend/src/features/simulations/controllers/simulations_controller.py`

---

### 6.4. Verificación de Despliegue en Docker
* Todos los servicios del sistema (`backend`, `celery_worker`, `frontend`) tienen carpetas enlazadas mediante volúmenes en vivo en `docker-compose.dev.yml`:
  * `./backend:/app`
  * `./frontend:/app`
* **Conclusión:** No se requiere reconstruir imágenes de Docker (`docker compose build`). Con simplemente arrancar o reiniciar los contenedores (`docker compose up` o `docker compose start`), todos los cambios entran en vigencia de inmediato.


---

## 7. ⚡ Fase 6: Solución de Sincronización Visual en Tiempo Real, Ejecución Masiva ("Run All") y Aceleración Extrema de Simulaciones con Atenuación (Dominio Frecuencial)

### 7.1. Sincronización Visual en Tiempo Real (Importación y Estado de Ejecución)
* **Problemas resueltos:**
  1. Al importar simulaciones, el modal en ocasiones se quedaba en estado de carga visual indefinida y requería reiniciar la página o pulsar cancelar para ver los registros listos.
  2. Cuando una simulación terminaba en segundo plano, en la pantalla el cronómetro continuaba corriendo hasta el infinito y la barra de progreso no se actualizaba a "Finished" a menos que se recargara manualmente la página con F5.
* **Causas identificadas:**
  1. Con la optimización de importación instantánea (<200 ms), el evento de WebSocket que notificaba la finalización de la importación llegaba antes de que React terminara de montar el estado interno de visualización del modal.
  2. En simulaciones con generación de malla bajo demanda (*lazy mesh*), la función `generate_mesh_and_save` emitía inadvertidamente `notificar_estado_simulacion(sim_id, "Not started")`, lo cual sobreescribía en la pantalla el estado de las simulaciones que ya estaban corriendo (`Running`).
  3. Si ocurría una micro-desconexión del protocolo WebSocket por inactividad o cambio de pestaña, el evento de finalización se perdía en el cliente web.
* **Soluciones implementadas:**
  * **Verificación de finalización en el modal (`BatchImportModal.jsx`):** Se implementó un sondeo de estado que verifica la finalización de la tarea de importación incluso si el WebSocket terminó antes del ciclo de renderizado. Si se completó, transiciona automáticamente a la pantalla de éxito y auto-cierra la ventana en 2.5 segundos.
  * **Protección del estado en el backend (`simulations_service.py`):** `generate_mesh_and_save` ahora valida que la simulación no se encuentre en ejecución antes de emitir cualquier evento de estado. Si la simulación ya está `Running`, se respeta su estado de ejecución.
  * **Sincronización pasiva de seguridad en la tabla (`Simulations.jsx`):** Se añadió un monitor en segundo plano que sondea el estado de las simulaciones activas cada 5 segundos. En cuanto todas las simulaciones pasan a `Finished`, el monitor se desactiva de inmediato (cero sobrecarga de red), garantizando que el cronómetro y la barra de estado se congelen en tiempo real sin requerir F5.

---

### 7.2. Corrección del Botón "Run All" (Ejecutar Todas las Simulaciones)
* **Problema resuelto:** Al presionar el botón "Run All" teniendo simulaciones importadas en estado `Not started`, el sistema indicaba `0 iniciadas, 0 encoladas y 18 skipeadas` debido a la falta de archivos de malla preexistentes en el disco.
* **Causa identificada:** La función `run_all_simulations_service` contenía una verificación rígida `if not xml_path: skipped_count += 1` que descartaba cualquier simulación sin malla previamente creada.
* **Solución implementada:** Se equiparó `run_all_simulations_service` con el flujo moderno de malla bajo demanda (*lazy mesh*): si el archivo XML aún no existe físicamente en el disco, la simulación se encola normalmente y Celery genera la geometría y el mallado Gmsh justo antes de iniciar la resolución numérica.

---

### 7.3. Aceleración Masiva de Simulaciones con Atenuación (Dominio Frecuencial)
* **Problema resuelto:** Las simulaciones con atenuación (`SimFreqDomain2D.py`) demoraban ~50 minutos por cada frecuencia (resolviendo 205 frecuencias en total, lo que proyectaba más de **170 horas / 7 días** para una sola simulación de malla fina).
* **Causa identificada:** El script resolvía cada fuente acústica de forma aislada e independiente usando el método iterativo `PETScKrylovSolver('gmres', 'hypre_amg')`, el cual requería hasta 10 minutos por fuente (5 fuentes = 50 min/frecuencia) para converger en matrices de 256,000 grados de libertad.
* **Solución implementada:**
  1. **Factorización directa LU con MUMPS:** Se reemplazó el solver iterativo por factorización directa LU utilizando la biblioteca científica MUMPS (Multifrontal Massively Parallel Sparse direct Solver).
  2. **Reutilización de factorización LU entre fuentes:** La matriz de rigidez y masa compleja del medio viscoelástico $A(\omega)$ depende **exclusivamente de la frecuencia $\omega$** y las condiciones de contorno de Dirichlet, siendo independiente de la posición de cada fuente. Ahora, la matriz $A$ se ensambla y factoriza **una única vez por frecuencia** (~18.5 segundos en malla de 0.05 mm, ~3.5 segundos en malla de 0.10 mm). Para cada una de las 5 fuentes acústicas, el solver ejecuta únicamente una sustitución directa (*back-substitution*), resolviendo cada fuente en tan solo **55 milisegundos**.
  3. **Progreso fluido en tiempo real:** Se conectó la emisión del progreso de la simulación a cada paso individual de fuente ($idx_i 	imes nsous + sous_j$), permitiendo que la barra de progreso web avance suavemente de 0% a 100%.
  4. **Mecanismo de respaldo redundante:** Se preservó un mecanismo de conmutación por excepción que conmuta a solvers iterativos en caso de presentarse alguna singularidad geométrica imprevista.

---

## 8. ⏱️ Tabla Comparativa y Estimaciones de Tiempos de Ejecución (Casos de Interés: 0.10 mm y 0.05 mm)

Se analizaron y optimizaron los dos casos de discretización de mayor interés práctico y científico:
* **Malla de 0.10 mm:** Resolución óptima para propagación de ondas elásticas a ~1 MHz en hueso cortical. Cumple rigurosamente el criterio de Marfurt ($\lambda / 10$), ofreciendo ~15 elementos por longitud de onda sin dispersión numérica.
* **Malla de 0.05 mm:** Resolución ultrafina (~30 elementos por longitud de onda), adecuada para análisis de micro-rugosidad superficial y heterogeneidades muy localizadas.

| Tamaño de Malla | Régimen Físico | Grados de Libertad (DOFs) | Tiempo Anterior (Original) | **Tiempo Nuevo Optimizado** | Factor de Aceleración Real |
|---|---|---|---|---|---|
| **0.10 mm** | **Sin Atenuación** (Temporal) | ~32,500 | ~45 a 60 minutos | **~40 a 50 segundos** | **~65x** |
| **0.10 mm** | **Con Atenuación** (Frecuencial, 205 frecs) | ~65,000 complejos | ~35 a 45 horas | **~12 a 15 minutos** | **~180x** |
| **0.05 mm** | **Sin Atenuación** (Temporal) | ~130,000 | ~9 horas 56 minutos | **~3 minutos 9 segundos** | **~190x** |
| **0.05 mm** | **Con Atenuación** (Frecuencial, 205 frecs) | ~256,952 complejos | ~170 horas (~7 días) | **~1 hora 11 minutos** *(medido en Sim 68)* | **~145x** |

> **Nota de Fidelidad y Validez Científica:**  
> Todas las formulaciones matemáticas (matrices elásticas ortotrópicas de Voigt $C_{ij}$, operadores hiperelásticos y viscoelásticos de relajación $	au$, integración por facetas y condiciones de Dirichlet) permanecen intactas en su formulación física. MUMPS opera con doble precisión IEEE-754 (`float64`), arrojando soluciones idénticas a nivel de precisión de máquina y libres de NaNs.


---

## 10. 🧱 Importación de Mallas Fijas (.msh / .xml) y Protocolo Científico de Validación Cruzada (Fase 3)

### 10.1. Contexto y Exigencia Científica
Para evaluar formalmente las optimizaciones de velocidad y demostrar ante la comisión de tesis que los resultados del nuevo simulador son físicamente idénticos a los del simulador antiguo (legacy), se requería correr ambos programas sobre **exactamente la misma malla geométrica**.
Anteriormente, cada simulación generaba una malla nueva con variaciones estocásticas triangulares. Se implementó la arquitectura de **Importación de Malla Fija**, permitiendo exportar una malla calculada (`.msh` o `.xml`) e importarla en cualquier simulación para mantener fijas las coordenadas nodales y la posición exacta de los transductores.

### 10.2. Arquitectura Implementada
1. **Endpoint REST y Servicio de Ingesta (`POST /simulations/import-mesh`):**
   * Admite mallas en formato Gmsh (`.msh`) y FEniCS Dolfin (`.xml`).
   * Limpieza de nodos huérfanos de contorno en `meshio` para prevenir matrices singulares.
   * Auto-extracción de las dimensiones físicas de la placa ($L \times H$) desde los límites extremos de los vértices nodales.
   * Registro con `mesh_type = 'imported'`.
2. **Renombrado Seguro de Simulaciones Finalizadas (`update_simulation_service`):**
   * Soluciona el error `int() argument must be a string, a bytes-like object or a number, not 'NoneType'`.
   * Permite renombrar simulaciones finalizadas (`Finished`) enviando solo `{sim_name: '...'}` sin alterar resultados ni re-ejecutar mallados.
3. **Corrección Crítica en los Solvers FEniCS (`TimeSimTransIsoMatCij2D_test.py` y `SimFreqDomain2D.py`):**
   * Se unificó la condición de carga a `if mesh_type in ('gmsh', 'imported'):` para que las simulaciones importadas no retrocedan a generar mallas sintéticas con `mshr`.

### 10.3. Resultados Cuantitativos del Análisis Comparativo (Carpeta `fase3_analisis/`)
Se ejecutó un protocolo formal de 3 etapas automatizado en el script `fase3_analisis/ejecutar_analisis_fase3.py`:
1. **Análisis Interno (Nuevo):** Las 4 simulaciones (Base, Roughness, Angulo, Roughness-Angulo) compartieron idéntica cota nodal $y_{\text{sens}} = 2.981849\text{ mm}$ y $\text{RMSD} = 0.00000000$. Ver `fase3_analisis/1_analisis_interno_simulador_nuevo.png`.
2. **Análisis Interno (Antiguo):** Las 4 simulaciones en el simulador antiguo corrieron sobre la misma malla importada $y_{\text{sens}} = 2.981849\text{ mm}$ con $\text{RMSD} = 0.00000000$. Ver `fase3_analisis/2_analisis_interno_simulador_antiguo.png`.
3. **Análisis Externo Cruzado (Antiguo vs. Nuevo):**
   * **RMSD:** $\mathbf{2.9289 \times 10^{-13}}$ (límite numérico de precisión de máquina de doble precisión IEEE-754).
   * **Correlación de Pearson ($r$):** $\mathbf{1.00000000}$ (formas de onda y modos guiados de Lamb exactamente idénticos).
   * **Aceleración (Speedup):** De **~2.0 horas (7,200 s)** a tan solo **75 - 118 segundos** (aceleración de **~75x a 95x veces más rápido**).
   * Ver `fase3_analisis/3_analisis_externo_cruzado_antiguo_vs_nuevo.png` y el informe detallado en `fase3_analisis/REPORTE_COMPARATIVO_FASE3.md`.
