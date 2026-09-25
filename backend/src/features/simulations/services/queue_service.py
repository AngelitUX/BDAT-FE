"""
Sistema de cola para simulaciones
Gestiona la ejecución secuencial de simulaciones (una a la vez)
"""
from flask import current_app
from ..models.simulation_model import get_simulation_count_running, update_simulation_status
import threading

# Lock para operaciones thread-safe
queue_lock = threading.RLock()

def _compact_queue_unlocked(mysql):
    """
    Reasigna queue_order 1, 2, 3... a las simulaciones Queued restantes.
    Debe llamarse con queue_lock adquirido.
    """
    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT id, queue_order FROM simulation 
            WHERE p_status = 'Queued'
            ORDER BY COALESCE(queue_order, id) ASC
        """)
        queued_sims = cur.fetchall()
        
        from ..services.simulations_service import notificar_estado_simulacion
        for pos, (sim_id, current_order) in enumerate(queued_sims, start=1):
            if current_order != pos:
                cur.execute("""
                    UPDATE simulation 
                    SET queue_order = %s 
                    WHERE id = %s
                """, (pos, sim_id))
                notificar_estado_simulacion(sim_id, 'Queued', queue_position=pos)
        
        mysql.connection.commit()
        cur.close()
    except Exception as e:
        print(f"❌ Error compactando cola: {e}")

def compact_queue():
    """
    Expone la funcionalidad de compactación con el lock adecuado.
    """
    with queue_lock:
        mysql = current_app.config.get('mysql') or current_app.mysql
        _compact_queue_unlocked(mysql)

def get_active_simulations_count():
    """
    Cuenta simulaciones activas (Running)
    """
    try:
        mysql = current_app.config.get('mysql') or current_app.mysql
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM simulation 
            WHERE p_status = 'Running'
        """)
        count = cur.fetchone()[0]
        cur.close()
        return count
    except Exception as e:
        print(f"❌ Error contando simulaciones activas: {e}")
        return 0


def should_queue_simulation():
    """
    Determina si una nueva simulación debe encolarse o ejecutarse directamente
    
    Returns:
        bool: True si debe encolarse, False si puede ejecutarse directamente
    """
    active_count = get_active_simulations_count()
    print(f"📊 Simulaciones activas: {active_count}")
    
    # Si hay al menos una simulación activa, encolar
    return active_count > 0


def get_queue_position(sim_id):
    """
    Obtiene la posición de una simulación en la cola
    
    Args:
        sim_id: ID de la simulación
        
    Returns:
        int: Posición en la cola (1-indexed), o None si no está en cola
    """
    try:
        mysql = current_app.config.get('mysql') or current_app.mysql
        cur = mysql.connection.cursor()
        
        # Obtener todas las simulaciones en cola ordenadas por ID (FIFO)
        cur.execute("""
            SELECT id FROM simulation 
            WHERE p_status = 'Queued'
            ORDER BY id ASC
        """)
        
        queued_sims = [row[0] for row in cur.fetchall()]
        cur.close()
        
        # Encontrar posición (1-indexed)
        if sim_id in queued_sims:
            return queued_sims.index(sim_id) + 1
        return None
        
    except Exception as e:
        print(f"❌ Error obteniendo posición en cola: {e}")
        return None


def queue_simulation(sim_id):
    """
    Encola una simulación cambiando su estado a 'Queued'
    
    Args:
        sim_id: ID de la simulación a encolar
    """
    with queue_lock:
        try:
            mysql = current_app.config.get('mysql') or current_app.mysql
            
            # Calcular posición ANTES de encolar (contar cuántas ya están en cola + 1)
            cur = mysql.connection.cursor()
            cur.execute("""
                SELECT COUNT(*) FROM simulation 
                WHERE p_status = 'Queued'
            """)
            queue_position = cur.fetchone()[0] + 1  # +1 porque esta será la siguiente
            
            print(f"📥 Encolando simulación {sim_id} en posición {queue_position}")
            
            # Actualizar estado a Queued y asignar queue_order
            cur.execute("""
                UPDATE simulation 
                SET p_status = 'Queued', queue_order = %s 
                WHERE id = %s
            """, (queue_position, sim_id))
            
            mysql.connection.commit()
            cur.close()
            
            print(f"✅ Simulación {sim_id} encolada en posición {queue_position}")
            
            # Notificar cambio de estado con posición en cola
            from ..services.simulations_service import notificar_estado_simulacion
            notificar_estado_simulacion(sim_id, 'Queued', queue_position=queue_position)
            
            return True
        except Exception as e:
            print(f"❌ Error encolando simulación {sim_id}: {e}")
            import traceback
            print(traceback.format_exc())
            return False


def dequeue_simulation(sim_id):
    """
    Desencola una simulación cambiando su estado de 'Queued' a 'Not started'
    
    Args:
        sim_id: ID de la simulación a desencolar
    """
    with queue_lock:
        try:
            mysql = current_app.config.get('mysql') or current_app.mysql
            
            # Verificar que esté en cola
            cur = mysql.connection.cursor()
            cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
            row = cur.fetchone()
            
            if not row:
                cur.close()
                return False, "Simulación no encontrada"
            
            if row[0] != 'Queued':
                cur.close()
                return False, f"La simulación no está en cola (estado actual: {row[0]})"
            
            # Cambiar a Not started y limpiar queue_order
            cur.execute("""
                UPDATE simulation 
                SET p_status = 'Not started', queue_order = NULL 
                WHERE id = %s
            """, (sim_id,))
            mysql.connection.commit()
            cur.close()
            print(f"📤 Simulación {sim_id} desencolada → Not started")
            
            _compact_queue_unlocked(mysql)
            
            # Notificar cambio de estado
            from ..services.simulations_service import notificar_estado_simulacion
            notificar_estado_simulacion(sim_id, 'Not started')
            
            return True, "Simulación desencolada exitosamente"
        except Exception as e:
            print(f"❌ Error desencolando simulación {sim_id}: {e}")
            return False, str(e)


def get_next_queued_simulation():
    """
    Obtiene la siguiente simulación en cola (ordenada por queue_order o ID)
    
    Returns:
        int or None: ID de la siguiente simulación en cola, o None si no hay ninguna
    """
    try:
        mysql = current_app.config.get('mysql') or current_app.mysql
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT id FROM simulation 
            WHERE p_status = 'Queued'
            ORDER BY COALESCE(queue_order, id) ASC
            LIMIT 1
        """)
        row = cur.fetchone()
        cur.close()
        
        if row:
            return row[0]
        return None
    except Exception as e:
        print(f"❌ Error obteniendo siguiente simulación en cola: {e}")
        return None


def process_next_in_queue():
    """
    Procesa la siguiente simulación en cola si no hay simulaciones activas
    Esta función debe llamarse cuando una simulación termina
    """
    with queue_lock:
        try:
            # Verificar si hay simulaciones activas
            if get_active_simulations_count() > 0:
                print("⏸️ Hay simulaciones activas, no se procesa la cola")
                return False
            
            # Obtener siguiente en cola
            next_sim_id = get_next_queued_simulation()
            if not next_sim_id:
                print("✅ No hay simulaciones en cola")
                return False
            
            print(f"🚀 Procesando siguiente simulación en cola: {next_sim_id}")
            
            # Obtener parámetros de la simulación
            mysql = current_app.config.get('mysql') or current_app.mysql
            cur = mysql.connection.cursor()
            cur.execute("""
                SELECT n_transmitter, n_receiver, emitters_pitch, receivers_pitch,
                       sensor_edge_margin, typical_mesh_size, sensor_distance,
                       plate_thickness, porosity, plate_length, attenuation,
                       mesh_type, xml_file, skin_layer_config, skin_thickness_top, skin_thickness_bottom
                FROM simulation WHERE id = %s
            """, (next_sim_id,))
            row = cur.fetchone()
            cur.close()
            
            if not row:
                print(f"❌ No se encontraron datos para simulación {next_sim_id}")
                return False
            
            # Preparar parámetros
            simulation_params = {
                'n_transmitter': row[0],
                'n_receiver': row[1],
                'emitters_pitch': row[2],
                'receivers_pitch': row[3],
                'sensor_edge_margin': row[4],
                'typical_mesh_size': row[5],
                'sensor_distance': row[6],
                'plate_thickness': row[7],
                'porosity': row[8],
                'plate_length': row[9],
                'attenuation': row[10],
                'mesh_type': row[11],
                'xml_file': row[12],
                'skin_layer_config': row[13] if len(row) > 13 and row[13] is not None else 'none',
                'skin_thickness_top': float(row[14]) if len(row) > 14 and row[14] is not None else 1.3,
                'skin_thickness_bottom': float(row[15]) if len(row) > 15 and row[15] is not None else 1.3,
            }
            
            # Enviar a Celery
            from app import celery
            from datetime import datetime
            
            # Generar un task_id único para evitar conflictos con tareas revocadas
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            task_id = f'simulation_{next_sim_id}_{timestamp}'
            
            # Cambiar estado a Running Y almacenar task_id (también limpiar queue_order)
            update_simulation_status(mysql, next_sim_id, 'Running', update_time_field='start_datetime', task_id=task_id)
            # Limpiar queue_order ahora que sale de la cola
            cur_q = mysql.connection.cursor()
            cur_q.execute("UPDATE simulation SET queue_order = NULL WHERE id = %s", (next_sim_id,))
            mysql.connection.commit()
            cur_q.close()
            
            _compact_queue_unlocked(mysql)
            
            print(f"✅ Estado actualizado a Running en DB con start_datetime")
            print(f"🆔 Task ID almacenado en DB: {task_id}")
            
            # IMPORTANTE: Esperar un momento para asegurar que el commit se completó
            import time
            time.sleep(0.1)  # 100ms para asegurar que la DB está actualizada
            
            # Notificar cambio (después del commit)
            from ..services.simulations_service import notificar_estado_simulacion
            notificar_estado_simulacion(next_sim_id, 'Running')
            print(f"📡 WebSocket enviado para simulación {next_sim_id} → Running")
            
            task = celery.send_task(
                'simulations.run_simulation',
                args=[next_sim_id, simulation_params],
                task_id=task_id
            )
            
            print(f"✅ Simulación {next_sim_id} enviada a Celery desde la cola. Task ID: {task_id}")
            return True
            
        except Exception as e:
            print(f"❌ Error procesando cola: {e}")
            import traceback
            traceback.print_exc()
            return False


def reorder_queue(ordered_ids):
    """
    Reordena la cola de simulaciones según el orden especificado
    
    Args:
        ordered_ids: Lista de IDs en el orden deseado [id1, id2, id3, ...]
        
    Returns:
        bool: True si se reordenó exitosamente, False en caso contrario
    """
    with queue_lock:
        try:
            mysql = current_app.config.get('mysql') or current_app.mysql
            cur = mysql.connection.cursor()
            
            # Verificar que todos los IDs estén en cola
            placeholders = ','.join(['%s'] * len(ordered_ids))
            cur.execute(f"""
                SELECT id FROM simulation 
                WHERE id IN ({placeholders}) AND p_status = 'Queued'
            """, tuple(ordered_ids))
            
            queued_ids = [row[0] for row in cur.fetchall()]
            
            # Verificar que todos los IDs proporcionados estén en cola
            if set(queued_ids) != set(ordered_ids):
                missing = set(ordered_ids) - set(queued_ids)
                print(f"⚠️ Algunos IDs no están en cola: {missing}")
                cur.close()
                return False
            
            # Actualizar queue_order para cada simulación
            print(f"📋 Nuevo orden de cola: {ordered_ids}")
            
            for position, sim_id in enumerate(ordered_ids, start=1):
                cur.execute("""
                    UPDATE simulation 
                    SET queue_order = %s 
                    WHERE id = %s AND p_status = 'Queued'
                """, (position, sim_id))
                print(f"  → Simulación {sim_id} → posición {position}")
            
            mysql.connection.commit()
            cur.close()
            
            # Notificar a todos los clientes del nuevo orden
            from ..services.simulations_service import notificar_estado_simulacion
            for position, sim_id in enumerate(ordered_ids, start=1):
                notificar_estado_simulacion(sim_id, 'Queued', queue_position=position)
            
            print(f"✅ Cola reordenada exitosamente")
            return True
            
        except Exception as e:
            print(f"❌ Error reordenando cola: {e}")
            import traceback
            print(traceback.format_exc())
            return False
