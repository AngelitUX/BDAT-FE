from celery import current_task
import sys
import os

# Configurar paths para importar módulos de simulación
DOCKER_ROUTE = "src/features/simulations/services/Reidmen/"
FENICS_PATH = DOCKER_ROUTE + "Reidmen Fenics/ipnyb propagation"
if FENICS_PATH not in sys.path:
    sys.path.append(FENICS_PATH)

try:
    Reidmen = __import__("TimeSimTransIsoMatCij2D_test")
    ReidmenFreq = __import__("SimFreqDomain2D")
    Sandwich = __import__("sandwich")
    LEGACY_FENICS_AVAILABLE = True
    print("✅ Scripts de simulación cargados en worker: TimeSimTransIsoMatCij2D_test, SimFreqDomain2D, sandwich")
except Exception as e:
    Reidmen = None
    ReidmenFreq = None
    Sandwich = None
    LEGACY_FENICS_AVAILABLE = False
    print(f"Error importando scripts de simulación: {e}")

from ..models.simulation_model import update_simulation_status, update_simulation_result
from ..services.file_manager import get_mat_file_path, ensure_simulation_dirs
from flask import current_app
import tempfile

def ensure_mysql_connection(app_instance=None):
    """Garantizar conexion activa y limpia con MySQL eliminando conexiones caidas en Flask context."""
    from flask import _app_ctx_stack
    ctx = _app_ctx_stack.top
    if ctx is not None and hasattr(ctx, 'mysql_db'):
        try:
            ctx.mysql_db.ping(False)
        except Exception:
            try:
                ctx.mysql_db.close()
            except Exception:
                pass
            try:
                del ctx.mysql_db
            except Exception:
                pass

def check_abort_signal(sim_id):
    """Verificar si existe una señal de aborto para la simulación"""
    # Usar directorio compartido entre contenedores
    signal_dir = '/app/temp_signals' if os.environ.get('DOCKER_ENV') else tempfile.gettempdir()
    abort_signal_file = os.path.join(signal_dir, f'abort_sim_{sim_id}.signal')
    if os.path.exists(abort_signal_file):
        try:
            os.remove(abort_signal_file)
            print(f"🚩 Abort signal detected and removed for simulation {sim_id}")
            print(f"📁 Signal file location: {abort_signal_file}")
            return True
        except Exception as e:
            print(f"⚠️ Error removing abort signal: {e}")
            return True  # Aún así considerarlo como abortado
    return False

def notificar_estado_worker(sim_id, estado, app_instance):
    """Notificar cambio de estado desde el worker usando la función completa del servicio"""
    try:
        # Usar la función completa del servicio que envía todos los datos
        with app_instance.app_context():
            from ..services.simulations_service import notificar_estado_simulacion
            notificar_estado_simulacion(sim_id, estado)
            print(f"📡 WebSocket con datos completos emitido desde worker: sim {sim_id} -> {estado}")
    except Exception as e:
        print(f"❌ Error emitiendo WebSocket desde worker: {e}")
        # Fallback: emitir solo estado básico
        try:
            if app_instance and hasattr(app_instance, 'socketio'):
                app_instance.socketio.emit('estado_simulacion', {
                    'id': sim_id, 
                    'estado': estado
                })
                print(f"⚠️ Fallback: WebSocket básico emitido desde worker: sim {sim_id} -> {estado}")
        except Exception as fallback_error:
            print(f"❌ Error en fallback WebSocket: {fallback_error}")


def run_simulation_task(sim_id, simulation_params):
    """
    Tarea de Celery para ejecutar simulación en background
    
    Args:
        sim_id: ID de la simulación
        simulation_params: Diccionario con parámetros de la simulación
    """
    from src.app import create_app, socketio
    
    app = create_app()
    
    with app.app_context():
        try:
            # ===== Pre-chequeos de malla (Generación bajo demanda si está pendiente) =====
            xml_file = simulation_params.get('xml_file')
            xml_exists = False
            if xml_file:
                if not os.path.isabs(xml_file):
                    xml_file = os.path.abspath(xml_file)
                if os.path.exists(xml_file):
                    xml_exists = True

            if not xml_exists:
                print(f"⚡ [Celery Worker] Malla no encontrada o pendiente para simulación {sim_id}. Generando con Gmsh...")
                current_task.update_state(
                    state='PROGRESS',
                    meta={'current': 0, 'total': 100, 'status': 'Generando malla geométrica...'}
                )
                from ..services.simulations_service import generate_mesh_and_save
                generate_mesh_and_save(app, sim_id)

                cur = app.mysql.connection.cursor()
                cur.execute("SELECT xml_file FROM simulation WHERE id = %s", (sim_id,))
                row = cur.fetchone()
                cur.close()
                if not row or not row[0] or not os.path.exists(row[0]):
                    raise FileNotFoundError(f"Error al generar o localizar archivo de malla XML para simulación {sim_id}")
                xml_file = os.path.abspath(row[0])
                simulation_params['xml_file'] = xml_file

            # Verificar módulos de simulación disponibles
            if not LEGACY_FENICS_AVAILABLE or Reidmen is None or ReidmenFreq is None:
                raise RuntimeError('FEniCS simulation modules not available in worker')
            
            # Verificar que los módulos tengan la función fmain
            if not hasattr(Reidmen, 'fmain'):
                raise RuntimeError('TimeSimTransIsoMatCij2D_test.fmain not available')
            if not hasattr(ReidmenFreq, 'fmain'):
                raise RuntimeError('SimFreqDomain2D.fmain not available')
            
            print(f"✅ Módulos de simulación verificados correctamente (Time Domain y Frequency Domain)")

            # ===== NOTA: El estado ya fue cambiado a Running por el backend =====
            # No es necesario cambiar el estado aquí, el backend ya lo hizo
            print(f"ℹ️ Simulación {sim_id} ya está en estado Running (configurado por backend)")

            # Actualizar progreso
            current_task.update_state(
                state='PROGRESS',
                meta={'current': 0, 'total': 100, 'status': 'Iniciando simulación...'}
            )
            
            # Extraer parámetros
            n_transmitter = simulation_params['n_transmitter']
            n_receiver = simulation_params['n_receiver']
            emitters_pitch = simulation_params['emitters_pitch']
            receivers_pitch = simulation_params['receivers_pitch']
            sensor_edge_margin = simulation_params['sensor_edge_margin']
            typical_mesh_size = simulation_params['typical_mesh_size']
            sensor_distance = simulation_params['sensor_distance']
            plate_thickness = simulation_params['plate_thickness']
            porosity = simulation_params['porosity']
            plate_length = simulation_params['plate_length']
            attenuation = simulation_params['attenuation']
            mesh_type = simulation_params['mesh_type']
            xml_file = xml_file  # ya validado y normalizado
            
            # Verificar DOBLE señal de aborto ANTES de ejecutar la simulación:
            # 1) Archivo de señal (mecanismo legacy)
            # 2) Estado en DB (mecanismo principal - el backend lo pone en Aborting/Aborted)
            abort_detected = check_abort_signal(sim_id)
            if not abort_detected:
                cur = app.mysql.connection.cursor()
                cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
                pre_run_status = cur.fetchone()
                cur.close()
                if pre_run_status and pre_run_status[0] == 'Finished':
                    print(f"ℹ️ Simulation {sim_id} is already Finished. Skipping duplicate execution.")
                    return {
                        'status': 'success',
                        'simulation_id': sim_id,
                        'message': 'Simulation already finished'
                    }
                if pre_run_status and pre_run_status[0] in ('Aborting', 'Aborted'):
                    abort_detected = True
                    print(f"⚠️ Simulation {sim_id} already marked as {pre_run_status[0]} in DB before execution")

            if abort_detected:
                print(f"⚠️ Simulation {sim_id} was aborted before execution started (resetting to Not started)")
                cur_res = app.mysql.connection.cursor()
                cur_res.execute("""
                    UPDATE simulation 
                    SET p_status = 'Not started', 
                        start_datetime = NULL, 
                        finish_datetime = NULL, 
                        execution_time = NULL, 
                        task_id = NULL,
                        queue_order = NULL
                    WHERE id = %s
                """, (sim_id,))
                app.mysql.connection.commit()
                cur_res.close()
                notificar_estado_worker(sim_id, "Not started", app)
                return {
                    'status': 'not_started',
                    'simulation_id': sim_id,
                    'message': 'Simulation was aborted before execution started'
                }
            

            print(f"🚀 Ejecutando simulación {sim_id} en Celery worker")
            
            # Check if multilayer (skin layers) is enabled
            skin_layer_config = simulation_params.get('skin_layer_config', 'none')
            use_multilayer = skin_layer_config != 'none'
            
            # Seleccionar el módulo apropiado según configuración
            # Priority 1: Check if multilayer is enabled
            # Priority 2: Check attenuation value
            if use_multilayer:
                print(f"🧬 Usando enfoque SANDWICH (Multicapa) con capas de piel (config: {skin_layer_config})")
                simulation_module = Sandwich
                module_name = "sandwich"
            elif attenuation == 1:
                print(f"🔄 Usando enfoque de dominio de FRECUENCIA para attenuation=1")
                simulation_module = ReidmenFreq
                module_name = "SimFreqDomain2D"
            else:
                print(f"🔄 Usando enfoque de dominio TEMPORAL para attenuation={attenuation}")
                simulation_module = Reidmen
                module_name = "TimeSimTransIsoMatCij2D_test"
            
            print(f"📊 Parámetros de simulación:")
            print(f"   - Módulo: {module_name}")
            print(f"   - n_transmitter: {n_transmitter}")
            print(f"   - n_receiver: {n_receiver}")
            print(f"   - sensor_distance: {sensor_distance}")
            print(f"   - typical_mesh_size: {typical_mesh_size}")
            print(f"   - plate_thickness: {plate_thickness}")
            print(f"   - porosity: {porosity}")
            print(f"   - attenuation: {attenuation}")
            print(f"   - mesh_type: {mesh_type}")
            print(f"   - xml_file: {xml_file}")
            if use_multilayer:
                # Para simulación sandwich, necesitamos core_thickness y skin_thickness
                # core_thickness = plate_thickness (grosor del hueso)
                # skin_thickness se obtiene de los parámetros (asumiendo simétrico por ahora)
                core_thickness = plate_thickness
                skin_thickness = simulation_params.get('skin_thickness_top', 1.3)
                
                # Calcular total_height (retornado por create_sandwich_mesh_gradual)
                # total_height = skin_thickness + core_thickness + skin_thickness
                total_height = 2 * skin_thickness + core_thickness
                
                print(f"   - skin_layer_config: {skin_layer_config}")
                print(f"   - core_thickness (hueso): {core_thickness} mm")
                print(f"   - skin_thickness: {skin_thickness} mm")
                print(f"   - total_height: {total_height} mm")
                
                # Llamar a sandwich.fmain con los parámetros correctos
                result = simulation_module.fmain(
                    n_transmitter, n_receiver, sensor_distance,
                    emitters_pitch, receivers_pitch, sensor_edge_margin,
                    typical_mesh_size, core_thickness, skin_thickness,
                    porosity, attenuation, str(sim_id), mesh_type, xml_file,
                    total_height
                )
            else:
                result = simulation_module.fmain(
                    n_transmitter, n_receiver, sensor_distance,
                    emitters_pitch, receivers_pitch, sensor_edge_margin,
                    typical_mesh_size, plate_thickness,
                    porosity, attenuation, str(sim_id), mesh_type, xml_file
                )
            
            print(f"✅ Simulación completada, resultado: {result}")
            
            # --- Detectar aborto por retorno (None, None) desde los scripts de simulación ---
            # sandwich.py y otros scripts retornan (None, None) cuando detectan la señal de
            # aborto en medio de la ejecución, en lugar de lanzar una excepción.
            if result is None or (isinstance(result, (tuple, list)) and len(result) >= 1 and result[0] is None):
                print(f"⚠️ Simulación {sim_id} abortada (script retornó None). Reiniciando a Not started.")
                cur_res = app.mysql.connection.cursor()
                cur_res.execute("""
                    UPDATE simulation 
                    SET p_status = 'Not started', 
                        start_datetime = NULL, 
                        finish_datetime = NULL, 
                        execution_time = NULL, 
                        task_id = NULL,
                        queue_order = NULL
                    WHERE id = %s
                """, (sim_id,))
                app.mysql.connection.commit()
                cur_res.close()
                notificar_estado_worker(sim_id, "Not started", app)
                try:
                    from ..services.queue_service import process_next_in_queue
                    print(f"🔄 Verificando si hay simulaciones en cola (después de aborto)...")
                    process_next_in_queue()
                except Exception as queue_error:
                    print(f"⚠️ Error procesando cola: {queue_error}")
                return {
                    'status': 'not_started',
                    'simulation_id': sim_id,
                    'message': 'Simulation was aborted during execution'
                }

            if not result or len(result) < 2:
                raise RuntimeError(f"Resultado de simulación inválido: {result}")
            
            filename = result[0]
            tiempo_ejecucion = result[1]
            mesh_data = result[2] if len(result) > 2 else None
            
            print(f"📄 Archivo generado: {filename}")
            print(f"⏱️ Tiempo de ejecución: {tiempo_ejecucion}")
            print(f"🕸️ Mesh data disponible: {mesh_data is not None}")
            
            # Crear estructura de carpetas para esta simulación
            dirs = ensure_simulation_dirs(sim_id)
            print(f"📁 Estructura de carpetas creada: {dirs}")
            
            # Leer archivo temporal generado
            temp_filepath = DOCKER_ROUTE + "Reidmen Fenics/ipnyb propagation/Files_mat/" + filename
            print(f"📂 Buscando archivo temporal en: {temp_filepath}")
            
            if not os.path.exists(temp_filepath):
                # Listar archivos disponibles para debugging
                files_dir = DOCKER_ROUTE + "Reidmen Fenics/ipnyb propagation/Files_mat/"
                if os.path.exists(files_dir):
                    available_files = os.listdir(files_dir)
                    print(f"📁 Archivos disponibles en {files_dir}: {available_files}")
                raise FileNotFoundError(f"Archivo '{filename}' no encontrado en {temp_filepath}")
            
            # Leer contenido del archivo temporal
            with open(temp_filepath, 'rb') as f:
                file_content = f.read()
            
            print(f"📄 Archivo leído exitosamente, tamaño: {len(file_content)} bytes")
            
            # Copiar archivo .mat a la carpeta organizada
            try:
                print(f"📁 Obteniendo ruta permanente para archivo .mat...")
                permanent_mat_path = get_mat_file_path(sim_id, filename)
                print(f"📂 Ruta permanente: {permanent_mat_path}")
                
                # Verificar que el directorio existe
                mat_dir = os.path.dirname(permanent_mat_path)
                if not os.path.exists(mat_dir):
                    print(f"⚠️ Directorio no existe, creando: {mat_dir}")
                    os.makedirs(mat_dir, exist_ok=True)
                
                # Guardar archivo
                with open(permanent_mat_path, 'wb') as f:
                    f.write(file_content)
                
                # Verificar que se guardó
                if os.path.exists(permanent_mat_path):
                    saved_size = os.path.getsize(permanent_mat_path)
                    print(f"✅ Archivo .mat guardado exitosamente: {permanent_mat_path} ({saved_size} bytes)")
                else:
                    print(f"❌ ERROR: El archivo no se guardó: {permanent_mat_path}")
                    
            except Exception as mat_error:
                print(f"❌ ERROR guardando archivo .mat: {str(mat_error)}")
                import traceback
                traceback.print_exc()
                # Continuar con el proceso aunque falle el guardado
            
            # ===== VERIFICAR ESTADO ANTES DE ACTUALIZAR =====
            # La simulación puede haber sido abortada mientras se ejecutaba
            try:
                ensure_mysql_connection(app)
            except Exception:
                pass
            cur = app.mysql.connection.cursor()
            cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
            current_status_result = cur.fetchone()
            cur.close()
            
            if current_status_result:
                current_status = current_status_result[0]
                if current_status in ('Aborted', 'Aborting'):
                    print(f"⚠️ Simulación {sim_id} fue abortada durante la ejecución. No se actualizará a Finished.")
                    print(f"🗑️ Eliminando archivo temporal: {temp_filepath}")
                    if os.path.exists(temp_filepath):
                        os.remove(temp_filepath)
                    return {
                        'status': 'aborted',
                        'simulation_id': sim_id,
                        'message': 'Simulation was aborted during execution'
                    }
            
            # Actualizar base de datos solo si no fue abortada
            update_simulation_result(app.mysql, sim_id, filename, "Finished", tiempo_ejecucion, file_content, mesh_data)
            
            # ============================================================
            #  GENERAR GRÁFICOS DE RESULTADOS
            # ============================================================
            print(f"🎨 Generando gráficos de resultados para simulación {sim_id}...")
            try:
                from ..services.octave_plot_generator import generate_results_plots_octave as generate_results_plots
                
                # Usar archivo permanente si existe, sino usar temporal
                mat_path_for_plots = permanent_mat_path if os.path.exists(permanent_mat_path) else temp_filepath
                print(f"📊 Usando archivo para gráficos: {mat_path_for_plots}")
                
                plot_path = generate_results_plots(sim_id, mat_path_for_plots, simulation_params)
                
                if plot_path:
                    print(f"✅ Gráficos generados exitosamente: {plot_path}")
                else:
                    print(f"⚠️ No se pudieron generar los gráficos para simulación {sim_id}")
                    
            except Exception as plot_error:
                print(f"❌ Error generando gráficos: {str(plot_error)}")
                import traceback
                traceback.print_exc()
                # Continuar aunque falle la generación de gráficos
            
            # Eliminar archivo temporal
            os.remove(temp_filepath)
            print(f"🗑️ Archivo temporal eliminado: {temp_filepath}")
            
            # ===== VERIFICAR ESTADO NUEVAMENTE ANTES DE MARCAR COMO FINISHED =====
            cur = app.mysql.connection.cursor()
            cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
            final_status_result = cur.fetchone()
            cur.close()
            
            if final_status_result and final_status_result[0] in ('Aborted', 'Aborting'):
                print(f"⚠️ Simulación {sim_id} fue abortada. No se cambiará a Finished.")
                return {
                    'status': 'aborted',
                    'simulation_id': sim_id,
                    'message': 'Simulation was aborted before final status update'
                }
            
            # Actualizar estado final (limpia task_id automáticamente)
            update_simulation_status(app.mysql, sim_id, "Finished", update_time_field='finish_datetime')
            app.mysql.connection.commit()
            
            print(f"✅ Simulación {sim_id} completada exitosamente")
            
            # Notificar cambio a Finished mediante WebSocket
            try:
                # Crear instancia de SocketIO con Redis para emitir desde Celery
                from flask_socketio import SocketIO
                
                redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
                socketio_external = SocketIO(message_queue=redis_url)
                
                # Obtener datos de la simulación para el WebSocket
                cur = app.mysql.connection.cursor()
                cur.execute("""
                    SELECT id, p_status, start_datetime, finish_datetime, execution_time
                    FROM simulation 
                    WHERE id = %s
                """, (sim_id,))
                result = cur.fetchone()
                cur.close()
                
                if result:
                    payload = {
                        'id': int(sim_id),
                        'estado': 'Finished',
                        'update_data': {
                            'id': result[0],
                            'p_status': 'Finished',
                            'finish_datetime': result[3].isoformat() + 'Z' if result[3] else None,
                            'execution_time': float(result[4]) if result[4] else None
                        }
                    }
                    
                    print(f"📡 Enviando WebSocket desde Celery: sim {sim_id} -> Finished")
                    print(f"📦 Payload: {payload}")
                    print(f"🔗 Redis URL: {redis_url}")
                    
                    # Emitir usando SocketIO externo con Redis
                    socketio_external.emit('estado_simulacion', payload, namespace='/')
                    
                    print(f"✅ WebSocket emitido exitosamente desde Celery a través de Redis")
            except Exception as ws_error:
                print(f"❌ Error emitiendo WebSocket desde Celery: {ws_error}")
                import traceback
                print(traceback.format_exc())
            
            # ===== PROCESAR SIGUIENTE EN COLA =====
            try:
                from ..services.queue_service import process_next_in_queue
                print(f"🔄 Verificando si hay simulaciones en cola...")
                process_next_in_queue()
            except Exception as queue_error:
                print(f"⚠️ Error procesando cola: {queue_error}")
                # No fallar la simulación actual por errores en la cola
            
            return {
                'status': 'success',
                'simulation_id': sim_id,
                'filename': filename,
                'execution_time': str(tiempo_ejecucion)
            }
            
        except Exception as e:
            import traceback
            error_msg = str(e)
            error_trace = traceback.format_exc()
            
            print(f"❌ Error en simulación {sim_id}: {error_msg}")
            print(error_trace)
            
            # Detectar si es un aborto del usuario
            # Los scripts pueden indicar aborto lanzando RuntimeError("...aborted by user")
            is_abort = isinstance(e, RuntimeError) and "aborted by user" in error_msg.lower()
            
            # También verificar si el estado en DB ya es Aborting/Aborted (el backend lo marcó así)
            if not is_abort:
                try:
                    try:
                        ensure_mysql_connection(app)
                    except Exception:
                        pass
                    cur_check = app.mysql.connection.cursor()
                    cur_check.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
                    pre_err_status = cur_check.fetchone()
                    cur_check.close()
                    if pre_err_status and pre_err_status[0] in ('Aborting', 'Aborted'):
                        is_abort = True
                        print(f"⚠️ Error ocurrió mientras la simulación {sim_id} estaba en estado {pre_err_status[0]}. Tratando como abort.")
                except Exception:
                    pass
            
            # Verificar estado actual ANTES de actualizar
            cur = app.mysql.connection.cursor()
            cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
            current_status_result = cur.fetchone()
            cur.close()
            
            current_status = current_status_result[0] if current_status_result else None
            
            if is_abort:
                # Si ya está marcado como Aborted por el backend, no cambiar
                if current_status in ('Aborted', 'Aborting'):
                    print(f"✅ Simulación {sim_id} ya está marcada como {current_status} por el backend")
                    final_status = current_status
                else:
                    # Regresar a Not started si fue abortado por el usuario
                    final_status = "Not started"
                    print(f"🚫 Simulación {sim_id} abortada por el usuario (regresando a Not started)")
                    cur_res = app.mysql.connection.cursor()
                    cur_res.execute("""
                        UPDATE simulation 
                        SET p_status = 'Not started', 
                            start_datetime = NULL, 
                            finish_datetime = NULL, 
                            execution_time = NULL, 
                            task_id = NULL,
                            queue_order = NULL
                        WHERE id = %s
                    """, (sim_id,))
                    app.mysql.connection.commit()
                    cur_res.close()
            else:
                # Marcar como Error para errores reales
                final_status = "Error"
                print(f"❌ Simulación {sim_id} terminó con error")
                update_simulation_status(app.mysql, sim_id, final_status, update_time_field='finish_datetime')
                app.mysql.connection.commit()
            
            # Notificar cambio mediante WebSocket solo si el worker cambió el estado
            # Si el backend ya lo marcó como Aborted, no enviar WebSocket duplicado
            if not (is_abort and current_status in ('Aborted', 'Aborting')):
                try:
                    # Crear instancia de SocketIO con Redis para emitir desde Celery
                    from flask_socketio import SocketIO
                    
                    redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
                    socketio_external = SocketIO(message_queue=redis_url)
                    
                    # Obtener datos de la simulación para el WebSocket
                    cur = app.mysql.connection.cursor()
                    cur.execute("""
                        SELECT id, p_status, start_datetime, finish_datetime
                        FROM simulation 
                        WHERE id = %s
                    """, (sim_id,))
                    result = cur.fetchone()
                    cur.close()
                    
                    if result:
                        payload = {
                            'id': int(sim_id),
                            'estado': final_status,
                            'update_data': {
                                'id': result[0],
                                'p_status': final_status,
                                'finish_datetime': result[3].isoformat() + 'Z' if result[3] else None
                            }
                        }
                        
                        print(f"📡 Enviando WebSocket desde Celery: sim {sim_id} -> {final_status}")
                        print(f"📦 Payload: {payload}")
                        print(f"🔗 Redis URL: {redis_url}")
                        
                        # Emitir usando SocketIO externo con Redis
                        socketio_external.emit('estado_simulacion', payload, namespace='/')
                        
                        print(f"✅ WebSocket emitido exitosamente desde Celery a través de Redis")
                except Exception as ws_error:
                    print(f"❌ Error emitiendo WebSocket desde Celery: {ws_error}")
                    import traceback
                    print(traceback.format_exc())
            else:
                print(f"ℹ️ Backend ya envió WebSocket para {final_status}, omitiendo envío desde worker")
            
            # ===== PROCESAR SIGUIENTE EN COLA (incluso si esta falló o fue abortada) =====
            try:
                from ..services.queue_service import process_next_in_queue
                action = "aborto" if is_abort else "error"
                print(f"🔄 Verificando si hay simulaciones en cola (después de {action})...")
                process_next_in_queue()
            except Exception as queue_error:
                print(f"⚠️ Error procesando cola: {queue_error}")
            
            # Si fue abortado, retornar resultado sin lanzar excepción
            if is_abort:
                return {
                    'status': 'aborted',
                    'simulation_id': sim_id,
                    'message': 'Simulation aborted by user'
                }
            
            # Para errores reales, lanzar la excepción
            raise


# ─── Batch Import Task ───────────────────────────────────────────────────────
# Runs the entire batch import loop in the Celery worker so it survives page
# reloads. Progress is broadcast via WebSocket (import_status event).

_IMPORT_CANCEL_KEY = 'batch_import_cancel'


def _emit_import_status_from_worker(import_session: dict):
    """Emit import_status via Socket.IO Redis message queue (works from Celery)."""
    try:
        from flask_socketio import SocketIO
        import redis
        
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
        sio = SocketIO(message_queue=redis_url)
        
        try:
            r = redis.from_url(redis_url)
            is_cancelling = bool(r.exists(_IMPORT_CANCEL_KEY))
        except:
            is_cancelling = False
            
        import_session['is_cancelling'] = is_cancelling
        
        sio.emit('import_status', import_session, namespace='/')
        print(f"📡 [batch_import] import_status emitted: {import_session}")
    except Exception as e:
        print(f"⚠️  [batch_import] Failed to emit import_status: {e}")


def _set_import_cancel_flag(redis_client, value: bool):
    """Set/clear the cancel flag in Redis."""
    try:
        if value:
            redis_client.set(_IMPORT_CANCEL_KEY, '1', ex=3600)
        else:
            redis_client.delete(_IMPORT_CANCEL_KEY)
    except Exception as e:
        print(f"⚠️  [batch_import] Redis cancel flag error: {e}")


def _is_import_cancelled(redis_client) -> bool:
    """Check if the user requested a cancel via Redis."""
    try:
        return redis_client.exists(_IMPORT_CANCEL_KEY) > 0
    except Exception:
        return False


def _poll_mesh_ready(app, sim_id: int, timeout: int = 300) -> bool:
    """Poll the DB until the simulation leaves 'Generating mesh' status or times out."""
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            cur = app.mysql.connection.cursor()
            cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
            row = cur.fetchone()
            cur.close()
            if row and row[0] != 'Generating mesh':
                return True
        except Exception as e:
            print(f"⚠️  [batch_import] DB poll error for sim {sim_id}: {e}")
        time.sleep(2)
    return False


def batch_import_task(simulations_data: list):
    """
    Execute a batch import entirely on the server (Celery worker).
    Progress is persisted in the `import_session` DB table and broadcast
    via WebSocket (import_status). Survives page reloads.
    """
    from src.app import create_app
    import redis
    import time

    app = create_app()

    redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
    try:
        r = redis.from_url(redis_url)
    except Exception as e:
        print(f"\u274c [batch_import] Cannot connect to Redis: {e}")
        r = None

    total = len(simulations_data)
    cancelled = False
    processed = 0  # count of successfully created simulations

    # Helper: write session to DB and emit WS (within app_context)
    def _update_session(active, current_index=0, current_name='', task_id=None, final_processed=None):
        try:
            ensure_mysql_connection(app)
            cur = app.mysql.connection.cursor()
            cur.execute(
                """INSERT INTO import_session
                     (id, active, total, current_index, current_name, task_id, started_at)
                   VALUES (1, %s, %s, %s, %s, %s, IF(%s, NOW(), NULL))
                   ON DUPLICATE KEY UPDATE
                     active        = VALUES(active),
                     total         = VALUES(total),
                     current_index = VALUES(current_index),
                     current_name  = VALUES(current_name),
                     task_id       = IF(VALUES(task_id) IS NOT NULL, VALUES(task_id), task_id),
                     started_at    = IF(VALUES(active) = 1 AND started_at IS NULL, NOW(), started_at)
                """,
                (int(active), total, current_index, current_name, task_id, int(active))
            )
            app.mysql.connection.commit()
            cur.close()

            # Emit WS via Redis
            payload = {
                'active': bool(active),
                'total': total,
                'current_index': current_index,
                'current_name': current_name,
            }
            if final_processed is not None:
                payload['processed'] = final_processed
            _emit_import_status_from_worker(payload)
        except Exception as e:
            print(f"[batch_import] _update_session error: {e}")

    # Clear stale cancel flag
    if r:
        _set_import_cancel_flag(r, False)

    with app.app_context():
        try:
            from decimal import Decimal
            from datetime import datetime, date
            from ..services.simulations_service import (
                ValidData, insert_simulation, notificar_estado_simulacion
            )

            # Signal start in DB + WS
            _update_session(active=True, current_index=0, current_name='')

            for idx, sim_data in enumerate(simulations_data):

                # Check cancel flag before each simulation
                if r and _is_import_cancelled(r):
                    print(f"[batch_import] Cancelled by user at index {idx}")
                    cancelled = True
                    break

                sim_name = sim_data.get('sim_name', f'Simulation_{idx+1}')
                _update_session(active=True, current_index=idx + 1, current_name=sim_name)

                print(f"[batch_import] Creating simulation {idx+1}/{total}: {sim_name}")

                try:
                    # ── Compute plate_length ──────────────────────────────────
                    n_transmitter = int(sim_data['n_transmitter'])
                    n_receiver = int(sim_data['n_receiver'])
                    emitters_pitch = float(sim_data['emitters_pitch'])
                    receivers_pitch = float(sim_data['receivers_pitch'])
                    sensor_edge_margin = float(sim_data['sensor_edge_margin'])
                    sensor_distance = float(sim_data['sensor_distance'])

                    emitters_span = max(0, (n_transmitter - 1) * emitters_pitch)
                    receivers_span = max(0, (n_receiver - 1) * receivers_pitch)
                    plate_length = sensor_edge_margin * 2 + emitters_span + sensor_distance + receivers_span

                    db_data = {
                        'sim_name': sim_name,
                        'n_transmitter': n_transmitter,
                        'n_receiver': n_receiver,
                        'emitters_pitch': emitters_pitch,
                        'receivers_pitch': receivers_pitch,
                        'sensor_distance': sensor_distance,
                        'sensor_edge_margin': sensor_edge_margin,
                        'typical_mesh_size': float(sim_data.get('typical_mesh_size', 1.0)),
                        'plate_thickness': float(sim_data.get('plate_thickness', 5.0)),
                        'plate_length': plate_length,
                        'porosity': int(sim_data.get('porosity', 0)),
                        'attenuation': int(sim_data.get('attenuation', 0)),
                        'p_status': 'Not started',
                        'mesh_type': sim_data.get('mesh_type', 'rectangular'),
                        'skin_layer_config': sim_data.get('skin_layer_config', 'none'),
                        'skin_thickness_top': float(sim_data.get('skin_thickness_top', 1.3)),
                        'skin_thickness_bottom': float(sim_data.get('skin_thickness_bottom', 1.3)),
                        'mesh_angle': float(sim_data.get('mesh_angle', 0.0)),
                        'mesh_angle_direction': sim_data.get('mesh_angle_direction', 'none'),
                        'roughness': float(sim_data.get('roughness', 0.2)),
                        'xml_file': None,
                        'msh_file': None,
                    }

                    ensure_mysql_connection(app)
                    sim_id_row = insert_simulation(app.mysql, db_data)
                    sim_id = sim_id_row[0]

                    # Emit nueva_simulacion so the list updates in real-time
                    cur = app.mysql.connection.cursor()
                    cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
                    columns = [col[0] for col in cur.description]
                    row = cur.fetchone()
                    cur.close()
                    if row:
                        row_dict = dict(zip(columns, row))
                        for key, val in row_dict.items():
                            if isinstance(val, Decimal):
                                row_dict[key] = float(val)
                            elif isinstance(val, (datetime, date)):
                                row_dict[key] = val.isoformat() if val else None
                        from flask_socketio import SocketIO as _SIO
                        _sio = _SIO(message_queue=redis_url)
                        _sio.emit('nueva_simulacion', row_dict, namespace='/')

                    # Generación bajo demanda (Lazy): No bloqueamos la importación masiva.
                    # Las simulaciones se registran instantáneamente como 'Not started'
                    # y la malla se generará en Celery cuando se ejecuten o al visualizarlas.

                    processed += 1  # count successful creations
                    print(f"[batch_import] Simulation {sim_name} (id={sim_id}) created. ({processed}/{total})")

                except Exception as e:
                    import traceback
                    print(f"\u274c [batch_import] Error creating simulation {sim_name}: {e}")
                    print(traceback.format_exc())
                    # Continue with next simulation

        finally:
            # Mark session as done in DB + emit final WS with processed count
            _update_session(active=False, current_index=0, current_name='', final_processed=processed)
            if r:
                _set_import_cancel_flag(r, False)
            print(f"[batch_import] Batch import finished. Cancelled={cancelled}, Processed={processed}/{total}")

    return {
        'status': 'cancelled' if cancelled else 'done',
        'total': total,
        'processed': processed,
    }

