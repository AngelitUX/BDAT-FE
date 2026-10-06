from flask import Blueprint, request, send_file, jsonify, current_app
import os
from ..services.simulations_service import (
    input_data_service, load_data_service, delete_sim_service,
    delete_all_sims_service, load_data_id_service, load_data_porosity_service,
    load_data_distance_service, load_data_download_service, run_simulation_service,
    load_data_id_test_service, active_sims_service, rerun_simulation_service, abort_simulation_service,
    list_mesh_files_service, download_mesh_file_service, update_simulation_service, duplicate_simulation_service,
    run_all_simulations_service, abort_all_simulations_service, download_simulations_batch_zip_service,
    import_start_service, import_update_service, import_end_service, import_status_service,
    import_run_service, import_cancel_service, import_reset_service
)
from ..services.results_processor import process_simulation_results
from ..services.queue_service import (
    dequeue_simulation, queue_simulation, reorder_queue
)
from ..models.simulation_model import get_simulation_by_id
simulations_bp = Blueprint('simulations', __name__)


# ===== IMPORT SESSION ENDPOINTS =====

@simulations_bp.route('/simulations/import/start', methods=['POST'])
def import_start():
    """Notify backend that a batch import has started."""
    return import_start_service(request)


@simulations_bp.route('/simulations/import/update', methods=['POST'])
def import_update():
    """Notify backend about current simulation being imported."""
    return import_update_service(request)


@simulations_bp.route('/simulations/import/end', methods=['POST'])
def import_end():
    """Notify backend that a batch import has ended (completed or cancelled)."""
    return import_end_service()


@simulations_bp.route('/simulations/import/status', methods=['GET'])
def import_status():
    """Get current import session status."""
    return import_status_service()


@simulations_bp.route('/simulations/import/run', methods=['POST'])
def import_run():
    """Start a backend-driven batch import (Celery task). Body: {simulations: [...]}."""
    return import_run_service(request)


@simulations_bp.route('/simulations/import/cancel', methods=['POST'])
def import_cancel():
    """Request cancellation of the currently running batch import."""
    return import_cancel_service()


@simulations_bp.route('/simulations/import/reset', methods=['POST'])
def import_reset():
    """Reset any stuck import session in DB and clear Redis cancel flags."""
    return import_reset_service()

@simulations_bp.route('/simulations/batch/download-zip', methods=['POST'])
def download_simulations_zip():
    """Download multiple simulations as a ZIP file"""
    return download_simulations_batch_zip_service(request)


@simulations_bp.route('/simulations', methods=['GET'])
def load_data():
    return load_data_service()


@simulations_bp.route('/simulations', methods=['POST'])
def input_data():
    return input_data_service(request)


@simulations_bp.route('/simulations/import-mesh', methods=['POST'])
def import_mesh():
    """Import an existing mesh file (.msh or .xml) and create a simulation with it."""
    from ..services.simulations_service import import_mesh_simulation_service
    return import_mesh_simulation_service(request)

# Route for deleting all simulations - must come BEFORE the <id> route
@simulations_bp.route('/simulations/all', methods=['DELETE'])
def delete_all_sims():
    return delete_all_sims_service()

@simulations_bp.route('/simulations/<id>', methods=['PUT'])
def update_simulation(id):
    """Update simulation parameters"""
    return update_simulation_service(id, request)

@simulations_bp.route('/simulations/<id>', methods=['DELETE'])
def delete_sim(id):
    return delete_sim_service(id)

@simulations_bp.route('/simulations/<id>/duplicate', methods=['POST'])
def duplicate_simulation(id):
    """Duplicate an existing simulation with a new name"""
    return duplicate_simulation_service(id, request)

@simulations_bp.route('/Load_data/<id>', methods=['GET'])
def load_data_id(id):
    return load_data_id_service(id)

@simulations_bp.route('/Load_data/porosity/<v>', methods=['GET'])
def load_data_porosity(v):
    return load_data_porosity_service(v)

@simulations_bp.route('/Load_data/distance/<v>', methods=['GET'])
def load_data_distance(v):
    return load_data_distance_service(v)

@simulations_bp.route('/Load_data/download/<v>', methods=['GET'])
def load_data_download(v):
    return load_data_download_service(v)

@simulations_bp.route('/simulations/<id>/download/graphics', methods=['GET'])
def download_graphics(id):
    from ..services.simulations_service import download_graphics_service
    return download_graphics_service(id)

@simulations_bp.route('/simulations/<id>/run', methods=['PUT'])
def run_simulation(id):
    return run_simulation_service(id, request)

@simulations_bp.route('/simulations/<id>/rerun', methods=['PUT'])
def rerun_simulation(id):
    """Re-ejecutar una simulación (Error, Finished, Aborted)"""
    return rerun_simulation_service(id)

@simulations_bp.route('/simulations/<id>/abort', methods=['PUT'])
def abort_simulation(id):
    return abort_simulation_service(id)

@simulations_bp.route('/simulations/<int:id>/dequeue', methods=['PUT'])
def dequeue_sim(id):
    """Desencolar una simulación"""
    success, message = dequeue_simulation(id)
    if success:
        return jsonify({'message': message, 'simulation_id': id}), 200
    else:
        return jsonify({'error': message, 'simulation_id': id}), 400

@simulations_bp.route('/simulations/queue/reorder', methods=['PUT'])
def reorder_queue():
    """Reordenar la cola de simulaciones"""
    from ..services.queue_service import reorder_queue
    try:
        data = request.get_json()
        ordered_ids = data.get('ordered_ids', [])
        
        if not ordered_ids:
            return jsonify({'status': 'error', 'message': 'ordered_ids is required'}), 400
        
        success = reorder_queue(ordered_ids)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': f'Queue reordered successfully',
                'ordered_ids': ordered_ids
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Failed to reorder queue'}), 500
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@simulations_bp.route('/Load_data_test/<id>', methods=['GET'])
def load_data_id_test(id):
    return load_data_id_test_service(id)

@simulations_bp.route('/Active_Simulations', methods=['GET'])
def active_sims():
    return active_sims_service()

# ===== BATCH OPERATIONS =====

@simulations_bp.route('/simulations/batch/run', methods=['POST'])
def batch_run_simulations():
    """
    Run (or queue) multiple simulations at once.
    Body: { "ids": [1, 2, 3] }
    Each simulation is run if no other is currently running, otherwise it is queued.
    """
    from ..services.simulations_service import batch_run_simulations_service
    return batch_run_simulations_service(request)


@simulations_bp.route('/simulations/run-all', methods=['POST'])
def run_all_simulations():
    """
    Run ALL eligible simulations ordered by ID DESC (highest first).
    Body (optional): { "status_filter": ["Not started"] }
    """
    return run_all_simulations_service(request)


@simulations_bp.route('/simulations/abort-all', methods=['POST'])
def abort_all_simulations():
    """
    Abort all Running simulations and dequeue all Queued ones.
    """
    return abort_all_simulations_service()


# ===== QUEUE MANAGEMENT ENDPOINTS =====
# Comentados temporalmente - funciones no implementadas en queue_service.py

# @simulations_bp.route('/simulations/<id>/queue', methods=['PUT'])
# def queue_simulation_endpoint(id):
#     """Add a simulation to the queue with priority"""
#     return queue_simulation_service(id, request)

# @simulations_bp.route('/simulations/<id>/pause', methods=['PUT'])
# def pause_simulation(id):
#     """Pause a running simulation"""
#     return pause_simulation_service(id)

# @simulations_bp.route('/simulations/<id>/resume', methods=['PUT'])
# def resume_simulation(id):
#     """Resume a paused simulation"""
#     return resume_simulation_service(id)

# @simulations_bp.route('/simulations/queue/status', methods=['GET'])
# def get_queue_status():
#     """Get current queue status"""
#     return get_queue_status_service()

# @simulations_bp.route('/simulations/<id>/priority', methods=['PUT'])
# def change_simulation_priority(id):
#     """Change priority of a queued simulation"""
#     return change_simulation_priority_service(id, request)

# @simulations_bp.route('/simulations/<id>/queue', methods=['DELETE'])
# def remove_from_queue(id):
#     """Remove a simulation from the queue"""
#     return remove_from_queue_service(id)

@simulations_bp.route('/simulations/<int:id>/mesh-info', methods=['GET'])
def get_mesh_info(id):
    """Get mesh file information for a specific simulation"""
    try:
        from ..models.simulation_model import get_simulation_by_id
        
        print(f"🔍 Getting mesh info for simulation ID: {id}")
        
        # Get simulation data from database
        simulation = get_simulation_by_id(current_app.mysql, id)
        
        if not simulation:
            print(f"❌ Simulation {id} not found in database")
            return jsonify({'error': 'Simulation not found'}), 404
        
        # Get both mesh file paths from database
        xml_file_path = simulation.get('xml_file')
        msh_file_path = simulation.get('msh_file')
        
        print(f"📁 XML file path from DB: {xml_file_path}")
        print(f"📁 MSH file path from DB: {msh_file_path}")
        
        mesh_files = []
        
        # Check XML file
        if xml_file_path:
            if not os.path.isabs(xml_file_path):
                xml_file_path = os.path.abspath(xml_file_path)
            
            if os.path.exists(xml_file_path):
                xml_size = os.path.getsize(xml_file_path)
                xml_filename = os.path.basename(xml_file_path)
                mesh_files.append({
                    'format': 'xml',
                    'filename': xml_filename,
                    'file_size': xml_size,
                    'file_path': xml_file_path
                })
                print(f"✅ XML file found - {xml_filename}, Size: {xml_size} bytes")
        
        # Check MSH file
        if msh_file_path:
            if not os.path.isabs(msh_file_path):
                msh_file_path = os.path.abspath(msh_file_path)
            
            if os.path.exists(msh_file_path):
                msh_size = os.path.getsize(msh_file_path)
                msh_filename = os.path.basename(msh_file_path)
                mesh_files.append({
                    'format': 'msh',
                    'filename': msh_filename,
                    'file_size': msh_size,
                    'file_path': msh_file_path
                })
                print(f"✅ MSH file found - {msh_filename}, Size: {msh_size} bytes")
        
        if not mesh_files:
            print(f"❌ No mesh files available for simulation {id}")
            print(f"   XML path in DB: {xml_file_path}")
            print(f"   MSH path in DB: {msh_file_path}")
            print(f"   XML exists: {os.path.exists(xml_file_path) if xml_file_path else False}")
            print(f"   MSH exists: {os.path.exists(msh_file_path) if msh_file_path else False}")
            return jsonify({
                'error': 'No mesh files available for this simulation',
                'debug_info': {
                    'xml_file_path': xml_file_path,
                    'msh_file_path': msh_file_path,
                    'xml_exists': os.path.exists(xml_file_path) if xml_file_path else False,
                    'msh_exists': os.path.exists(msh_file_path) if msh_file_path else False
                }
            }), 404
        
        # Return info for the first available file (prefer MSH for visualization)
        primary_file = next((f for f in mesh_files if f['format'] == 'msh'), mesh_files[0])
        
        return jsonify({
            'simulation_id': id,
            'filename': primary_file['filename'],
            'file_size': primary_file['file_size'],
            'file_format': primary_file['format'],
            'has_mesh_file': True,
            'mesh_type': simulation.get('mesh_type', 'unknown'),
            'file_path': primary_file['file_path'],
            'available_formats': [f['format'] for f in mesh_files],
            'all_files': mesh_files
        })
        
    except Exception as e:
        print(f"💥 Exception in get_mesh_info: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@simulations_bp.route('/simulations/<int:id>/mesh/<filename>', methods=['GET'])
def download_mesh_file(id, filename):
    """Download mesh file for a specific simulation"""
    try:
        from ..models.simulation_model import get_simulation_by_id
        
        print(f"📥 Downloading mesh file '{filename}' for simulation ID: {id}")
        
        # Get simulation data from database
        simulation = get_simulation_by_id(current_app.mysql, id)
        
        if not simulation:
            print(f"❌ Simulation {id} not found in database")
            return jsonify({'error': 'Simulation not found'}), 404
        
        # Get both mesh file paths from database
        xml_file_path = simulation.get('xml_file')
        msh_file_path = simulation.get('msh_file')
        
        print(f"📁 XML file path from DB: {xml_file_path}")
        print(f"📁 MSH file path from DB: {msh_file_path}")
        
        # Find which file matches the requested filename
        target_file_path = None
        file_format = None
        
        if xml_file_path:
            if not os.path.isabs(xml_file_path):
                xml_file_path = os.path.abspath(xml_file_path)
            if os.path.basename(xml_file_path) == filename:
                target_file_path = xml_file_path
                file_format = 'xml'
        
        if msh_file_path and not target_file_path:
            if not os.path.isabs(msh_file_path):
                msh_file_path = os.path.abspath(msh_file_path)
            if os.path.basename(msh_file_path) == filename:
                target_file_path = msh_file_path
                file_format = 'msh'
        
        if not target_file_path:
            print(f"⚠️ Filename '{filename}' not found in database records")
            return jsonify({
                'error': 'Requested filename does not match any mesh files for this simulation',
                'requested': filename,
                'available_xml': os.path.basename(xml_file_path) if xml_file_path else None,
                'available_msh': os.path.basename(msh_file_path) if msh_file_path else None
            }), 400
        
        # Check if file exists
        if not os.path.exists(target_file_path):
            print(f"❌ Mesh file not found at path: {target_file_path}")
            return jsonify({
                'error': 'Mesh file path exists in database but file not found on disk',
                'path': target_file_path
            }), 404
        
        # Send file
        print(f"✅ Sending mesh file: {filename} (format: {file_format})")
        
        # Determine mimetype based on format
        if file_format == 'xml':
            mimetype = 'application/xml'
        elif file_format == 'msh':
            mimetype = 'application/octet-stream'
        else:
            mimetype = 'application/octet-stream'
        
        return send_file(
            target_file_path,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetype
        )
        
    except Exception as e:
        print(f"💥 Exception in download_mesh_file: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@simulations_bp.route('/simulations/<int:id>/mesh-data', methods=['GET'])
def get_mesh_visualization_data(id):
    """Get mesh data for 3D visualization"""
    try:
        from ..models.simulation_model import get_simulation_by_id
        import xml.etree.ElementTree as ET
        
        print(f"🎨 Getting mesh visualization data for simulation ID: {id}")
        
        # Get simulation data from database
        simulation = get_simulation_by_id(current_app.mysql, id)
        
        if not simulation:
            print(f"❌ Simulation {id} not found in database")
            return jsonify({'error': 'Simulation not found'}), 404
        
        # Get mesh file paths from database (prefer MSH for visualization)
        msh_file_path = simulation.get('msh_file')
        xml_file_path = simulation.get('xml_file')
        
        print(f"📁 MSH file path from DB: {msh_file_path}")
        print(f"📁 XML file path from DB: {xml_file_path}")
        
        # Prefer MSH file for visualization, fallback to XML
        mesh_file_path = msh_file_path if msh_file_path else xml_file_path
        
        # Si la malla aún no existe (generación bajo demanda), generarla ahora para previsualización
        if not mesh_file_path or not os.path.exists(mesh_file_path if os.path.isabs(mesh_file_path) else os.path.abspath(mesh_file_path)):
            print(f"🎨 Generando malla bajo demanda para previsualización (simulación {id})...")
            from ..services.simulations_service import generate_mesh_and_save
            generate_mesh_and_save(current_app, id)
            simulation = get_simulation_by_id(current_app.mysql, id)
            msh_file_path = simulation.get('msh_file') if simulation else None
            xml_file_path = simulation.get('xml_file') if simulation else None
            mesh_file_path = msh_file_path if msh_file_path else xml_file_path
        
        if not mesh_file_path:
            print(f"❌ No mesh file path in database for simulation {id}")
            return jsonify({'error': 'No mesh file available for this simulation'}), 404
        
        # Convert to absolute path if it's relative
        if not os.path.isabs(mesh_file_path):
            mesh_file_path = os.path.abspath(mesh_file_path)
            print(f"📁 Converted to absolute path: {mesh_file_path}")
        
        # Check if file exists
        if not os.path.exists(mesh_file_path):
            print(f"❌ Mesh file not found at path: {mesh_file_path}")
            return jsonify({
                'error': 'Mesh file not found on disk',
                'path': mesh_file_path
            }), 404
        
        # Parse mesh file based on extension
        file_extension = os.path.splitext(mesh_file_path)[1].lower()
        print(f"📖 Parsing mesh file: {mesh_file_path} (format: {file_extension})")
        
        if file_extension == '.msh':
            # Parse MSH file using meshio
            import meshio
            mesh_data = meshio.read(mesh_file_path)
            
            # Extract vertices and faces from meshio data
            vertices = mesh_data.points.tolist()
            faces = []
            
            # Get triangular cells
            for cell_block in mesh_data.cells:
                if cell_block.type == 'triangle':
                    faces.extend(cell_block.data.tolist())
            
            print(f"✅ MSH file parsed - Vertices: {len(vertices)}, Faces: {len(faces)}")
            
        else:
            # Parse XML file using ElementTree
            tree = ET.parse(mesh_file_path)
            root = tree.getroot()
            
            # Extract vertices
            vertices = []
            vertices_elem = root.find('.//vertices')
            if vertices_elem is not None:
                for vertex in vertices_elem.findall('vertex'):
                    index = int(vertex.get('index'))
                    x = float(vertex.get('x'))
                    y = float(vertex.get('y'))
                    z = float(vertex.get('z', 0.0))  # Default z=0 for 2D meshes
                    vertices.append([x, y, z])
            
            # Extract triangular faces/cells
            faces = []
            cells_elem = root.find('.//cells')
            if cells_elem is not None:
                for cell in cells_elem.findall('triangle'):
                    v0 = int(cell.get('v0'))
                    v1 = int(cell.get('v1'))
                    v2 = int(cell.get('v2'))
                    faces.append([v0, v1, v2])
            
            print(f"✅ XML file parsed - Vertices: {len(vertices)}, Faces: {len(faces)}")
        
        # Calculate sensor positions based on simulation parameters
        sensors = calculate_sensor_positions_from_simulation(simulation)
        
        print(f"✅ Mesh parsed - Vertices: {len(vertices)}, Faces: {len(faces)}")
        
        mesh_data = {
            'vertices': vertices,
            'faces': faces,
            'sensors': sensors,
            'metadata': {
                'num_vertices': len(vertices),
                'num_faces': len(faces),
                'mesh_type': simulation.get('mesh_type', 'unknown'),
                'simulation_name': simulation.get('sim_name', f'Simulation {id}')
            }
        }
        
        return jsonify({
            'simulation_id': id,
            'mesh_data': mesh_data,
            'success': True
        })
        
    except ET.ParseError as e:
        print(f"❌ XML Parse Error: {str(e)}")
        return jsonify({'error': f'Invalid XML mesh file: {str(e)}'}), 400
    except Exception as e:
        print(f"💥 Exception in get_mesh_visualization_data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def calculate_sensor_positions_from_simulation(simulation):
    """Calculate sensor positions based on simulation parameters"""
    try:
        n_transmitter = simulation.get('n_transmitter', 0)
        n_receiver = simulation.get('n_receiver', 0)
        emitters_pitch = float(simulation.get('emitters_pitch', 1.0))
        receivers_pitch = float(simulation.get('receivers_pitch', 1.0))
        sensor_distance = float(simulation.get('sensor_distance', 3.0))
        sensor_edge_margin = float(simulation.get('sensor_edge_margin', 1.0))
        plate_thickness = float(simulation.get('plate_thickness', 1.0))
        
        sensors = {
            'transmitters': [],
            'receivers': []
        }
        
        # Calculate transmitter positions (bottom edge)
        transmitter_start_z = sensor_edge_margin
        for i in range(n_transmitter):
            z_pos = transmitter_start_z + (i * emitters_pitch)
            sensors['transmitters'].append({
                'id': i,
                'position': [z_pos, 0.0, 0.0],
                'type': 'transmitter'
            })
        
        # Calculate receiver positions (top edge)
        receiver_start_z = transmitter_start_z + (n_transmitter * emitters_pitch) + sensor_distance
        for i in range(n_receiver):
            z_pos = receiver_start_z + (i * receivers_pitch)
            sensors['receivers'].append({
                'id': i,
                'position': [z_pos, plate_thickness, 0.0],
                'type': 'receiver'
            })
        
        return sensors
        
    except Exception as e:
        print(f"⚠️ Error calculating sensor positions: {e}")
        return {'transmitters': [], 'receivers': []}

@simulations_bp.route('/simulations/mesh/test', methods=['GET'])
def test_mesh_endpoint():
    """Test endpoint to verify mesh functionality is working"""
    return jsonify({
        'status': 'ok',
        'message': 'Mesh endpoint is working',
        'timestamp': '2025-01-03T00:49:59'
    })

@simulations_bp.route('/simulations/<int:id>/debug', methods=['GET'])
def debug_simulation(id):
    """Debug endpoint to check simulation state and files"""
    try:
        from ..models.simulation_model import get_simulation_by_id
        
        print(f"🔍 Debug info for simulation ID: {id}")
        
        # Get simulation data from database
        simulation = get_simulation_by_id(current_app.mysql, id)
        
        if not simulation:
            return jsonify({'error': 'Simulation not found'}), 404
        
        # Check file paths and existence
        xml_file_path = simulation.get('xml_file')
        msh_file_path = simulation.get('msh_file')
        
        debug_info = {
            'simulation_id': id,
            'simulation_name': simulation.get('sim_name'),
            'status': simulation.get('p_status'),
            'mesh_type': simulation.get('mesh_type'),
            'xml_file_path': xml_file_path,
            'msh_file_path': msh_file_path,
            'xml_exists': os.path.exists(xml_file_path) if xml_file_path else False,
            'msh_exists': os.path.exists(msh_file_path) if msh_file_path else False,
            'current_directory': os.getcwd(),
            'meshes_directory_exists': os.path.exists('meshes'),
            'meshes_directory_contents': []
        }
        
        # List meshes directory contents
        if os.path.exists('meshes'):
            try:
                debug_info['meshes_directory_contents'] = os.listdir('meshes')
            except Exception as e:
                debug_info['meshes_directory_error'] = str(e)
        
        return jsonify(debug_info)
        
    except Exception as e:
        print(f"💥 Exception in debug_simulation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@simulations_bp.route('/simulations/<int:id>/results', methods=['GET'])
def get_simulation_results(id):
    """
    Obtiene los resultados procesados de una simulación
    Lee el archivo .mat y procesa los datos
    """
    try:
        # Buscar la simulación
        simulation = get_simulation_by_id(current_app.mysql, id)
        
        if not simulation:
            return jsonify({"error": "Simulation not found"}), 404
        
        # Verificar que la simulación esté finalizada
        p_status = simulation.get('p_status', '')
        if p_status != 'Finished' and p_status != '2':
            return jsonify({
                "error": "Simulation not finished yet",
                "status": p_status
            }), 400
        
        # Preparar datos de la simulación
        simulation_data = {
            'id': id,
            'filename': simulation.get('result_step_01'),
            'porosity': simulation.get('porosity'),
            'plate_thickness': simulation.get('plate_thickness'),
            'typical_mesh_size': simulation.get('typical_mesh_size'),
            'sensor_edge_margin': simulation.get('sensor_edge_margin'),
            'receiver_pitch': simulation.get('receivers_pitch'),
            'emitter_pitch': simulation.get('emitters_pitch'),
            'n_transmitter': simulation.get('n_transmitter'),
            'n_receiver': simulation.get('n_receiver'),
            'sensor_distance': simulation.get('sensor_distance'),
            'attenuation': simulation.get('attenuation'),
            'roughness': simulation.get('roughness')
        }
        
        # Procesar resultados
        results = process_simulation_results(str(id), simulation_data)
        
        if 'error' in results:
            return jsonify(results), 500
        
        return jsonify(results), 200
        
    except Exception as e:
        print(f"💥 Error getting simulation results: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@simulations_bp.route('/simulations/<int:id>/visualization', methods=['GET'])
def get_simulation_visualization(id):
    """
    Genera y devuelve visualizaciones gráficas para los resultados de la simulación
    """
    try:
        # Buscar la simulación
        simulation = get_simulation_by_id(current_app.mysql, id)
        
        if not simulation:
            return jsonify({"error": "Simulation not found"}), 404
        
        # Verificar que la simulación esté finalizada
        p_status = simulation.get('p_status', '')
        if p_status != 'Finished' and p_status != '2':
            return jsonify({
                "error": "Simulation not finished yet",
                "status": p_status
            }), 400
        
        # Preparar datos de la simulación
        simulation_data = {
            'id': id,
            'filename': simulation.get('result_step_01'),
            'porosity': simulation.get('porosity'),
            'plate_thickness': simulation.get('plate_thickness'),
            'typical_mesh_size': simulation.get('typical_mesh_size'),
            'sensor_edge_margin': simulation.get('sensor_edge_margin'),
            'receiver_pitch': simulation.get('receivers_pitch'),
            'emitter_pitch': simulation.get('emitters_pitch'),
            'n_transmitter': simulation.get('n_transmitter'),
            'n_receiver': simulation.get('n_receiver'),
            'sensor_distance': simulation.get('sensor_distance'),
            'attenuation': simulation.get('attenuation'),
            'roughness': simulation.get('roughness')
        }
        
        # Usar el mismo procesador de resultados
        results = process_simulation_results(str(id), simulation_data)
        
        if 'error' in results:
            return jsonify(results), 500
        
        return jsonify(results), 200
        
    except Exception as e:
        print(f"💥 Error generating visualization: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
