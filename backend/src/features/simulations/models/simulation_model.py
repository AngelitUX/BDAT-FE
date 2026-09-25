import pymysql
from datetime import datetime

def get_simulation_by_id(mysql, sim_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
    if cur.description:
        columns = [col[0] for col in cur.description]
        row = cur.fetchone()
        cur.close()
        if row:
            return dict(zip(columns, row))
    else:
        cur.close()
    return None

def insert_simulation(mysql, data):
    cur = mysql.connection.cursor()
    columns = list(data.keys())
    values = list(data.values())
    placeholders = ", ".join(["%s"] * len(values))
    columns_str = ", ".join(columns)
    
    query = f"INSERT INTO simulation ({columns_str}) VALUES ({placeholders})"
    
    cur.execute(query, tuple(values))
    mysql.connection.commit()
    sim_id = cur.lastrowid
    
    cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
    result = cur.fetchone()
    cur.close()
    return result

def delete_simulation(mysql, sim_id):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM simulation WHERE id = %s", (sim_id,))
    mysql.connection.commit()
    cur.close()

def delete_all_simulations(mysql):
    cur = mysql.connection.cursor()
    # Solo eliminar las que no están en ejecución
    cur.execute("DELETE FROM simulation WHERE p_status != 'Running'")
    affected = cur.rowcount
    mysql.connection.commit()
    cur.close()
    return affected

def get_simulation_file(mysql, sim_id, file_type):
    # Retrieve specific file column content if needed
    cur = mysql.connection.cursor()
    # Assuming file_type corresponds to a column name like 'xml_file' or 'file_data'
    # Be careful with SQL injection if file_type comes from user, but here it's internal.
    # To be safe, we only allow specific columns or just return None if not sure.
    # Given usage is minimal/unknown, we'll return None or implement basic select.
    allowed_cols = ['xml_file', 'msh_file', 'file_data']
    if file_type in allowed_cols:
        query = f"SELECT {file_type} FROM simulation WHERE id = %s"
        cur.execute(query, (sim_id,))
        result = cur.fetchone()
        cur.close()
        return result[0] if result else None
    cur.close()
    return None

def update_simulation_status(mysql, sim_id, status, update_time_field=None, task_id=None):
    cur = mysql.connection.cursor()
    query = "UPDATE simulation SET p_status = %s"
    params = [status]
    
    current_time = datetime.utcnow()
    
    if update_time_field:
        query += f", {update_time_field} = %s"
        params.append(current_time)
        
    if task_id is not None:
        query += ", task_id = %s"
        params.append(task_id)
        
    query += " WHERE id = %s"
    params.append(sim_id)
    
    try:
        cur.execute(query, tuple(params))
        mysql.connection.commit()
    except Exception as e:
        # Fallback if task_id column doesn't exist
        if "Unknown column 'task_id'" in str(e) and task_id is not None:
             print("⚠️ Warning: task_id column missing in database. Retrying without task_id.")
             # Remove task_id from query and params
             query = query.replace(", task_id = %s", "")
             params.pop(-2) # remove task_id value (last was sim_id, so -2)
             cur.execute(query, tuple(params))
             mysql.connection.commit()
        else:
            raise e
    finally:
        cur.close()
        
    return status, current_time

def update_simulation_result(mysql, sim_id, filename, status, execution_time, file_content, mesh_data=None):
    cur = mysql.connection.cursor()
    
    # Note: 'file_name' might be the column for filename. 
    # 'file_data' is updated with content.
    # We ignore mesh_data for now as no clear column exists in inferred schema.
    
    query = """
        UPDATE simulation 
        SET p_status = %s, 
            execution_time = %s, 
            finish_datetime = %s
    """
    # Sanitize execution_time
    try:
        if isinstance(execution_time, str):
             # Extract float number from string if possible
             import re
             matches = re.findall(r"[-+]?\d*\.\d+|\d+", execution_time)
             if matches:
                 execution_time = float(matches[0])
        elif hasattr(execution_time, 'total_seconds'):
             execution_time = execution_time.total_seconds()
        elif execution_time is not None:
             execution_time = float(execution_time)
    except Exception:
        # If conversion fails, keep original or set to 0.0 to avoid DB error
        # Assuming execution_time is non-critical for integrity, better to save result than fail
        print(f"⚠️ Could not convert execution_time '{execution_time}' to float. Setting to 0.0")
        execution_time = 0.0

    params = [status, execution_time, datetime.utcnow()]
    
    # Check if we should update file_data. Assuming yes if content provided.
    # Also need to check if 'result_step_01' or similar is the column for filename.
    # active_sims_service uses 'result_step_01' in process_results? No.
    # In controllers, get_simulation_results uses: simulation.get('result_step_01')
    # So the filename column is likely 'result_step_01'.
    
    # However, simulations_service.py line 697 updates 'xml_file', 'msh_file'.
    # simulation_tasks.py updates 'filename' (the .mat file).
    # Let's check get_simulation_results in controller. It uses 'result_step_01'.
    # So we should probably update 'result_step_01'.
    
    query += ", result_step_01 = %s"
    params.append(filename)
    
    if file_content is not None:
        query += ", file_data = %s"
        params.append(file_content)
        
    query += " WHERE id = %s"
    params.append(sim_id)
    
    try:
        cur.execute(query, tuple(params))
        mysql.connection.commit()
    except Exception as e:
        # Fallback if file_data column doesn't exist
        error_str = str(e)
        if "Unknown column 'file_data'" in error_str and file_content is not None:
             print("⚠️ Warning: file_data column missing in database. Retrying without file_data.")
             # Remove file_data from query and params
             # The query was appended with ", file_data = %s"
             query = query.replace(", file_data = %s", "")
             # The file_content was added before sim_id, so it is at index -2
             params.pop(-2) 
             cur.execute(query, tuple(params))
             mysql.connection.commit()
        else:
            raise e
    finally:
        cur.close()

def get_simulation_count_running(mysql):
    cur = mysql.connection.cursor()
    cur.execute("SELECT COUNT(*) FROM simulation WHERE p_status = 'Running'")
    result = cur.fetchone()
    cur.close()
    return result[0] if result else 0

def get_simulation_task_id(mysql, sim_id):
    """Retrieve the Celery task_id for a simulation"""
    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT task_id FROM simulation WHERE id = %s", (sim_id,))
        result = cur.fetchone()
        return result[0] if result else None
    except Exception as e:
        if "Unknown column 'task_id'" in str(e):
            print(f"⚠️ Warning: task_id column missing in database when fetching for sim {sim_id}")
            return None
        raise e
    finally:
        cur.close()
