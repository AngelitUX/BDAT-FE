"""
Procesador de resultados de simulaciones ultrasónicas
Carga los gráficos pregenerados cuando la simulación finaliza
Si no existen, los genera on-demand usando GNU Octave
"""

import os
import glob
from .octave_plot_generator import get_results_plot_base64, generate_results_plots_octave as generate_results_plots
from .file_manager import get_mat_file_path


def process_simulation_results(simulation_id, simulation_data):
    """
    Carga los resultados pregenerados de una simulación
    Si no existen, intenta generarlos on-demand
    """
    try:
        print(f"📊 Cargando resultados de simulación {simulation_id}...")
        
        # Intentar cargar imagen pregenerada
        image_base64 = get_results_plot_base64(simulation_id)
        
        # Si no existe, intentar generarla on-demand
        if not image_base64:
            print(f"⚠️ Gráfico no encontrado, intentando generar on-demand...")
            
            # Buscar archivo .mat
            mat_path = None
            
            # Intentar con el nombre del archivo si está disponible
            filename = simulation_data.get('filename')
            if filename:
                mat_path = get_mat_file_path(simulation_id, filename)
            
            # Si no existe, buscar cualquier .mat en la carpeta de la simulación
            if not mat_path or not os.path.exists(mat_path):
                sim_dir = f"simulation_results/sim_{simulation_id}"
                mat_files = glob.glob(f"{sim_dir}/**/*.mat", recursive=True)
                
                if mat_files:
                    mat_path = mat_files[0]
                    print(f"📂 Archivo .mat encontrado: {mat_path}")
            
            if mat_path and os.path.exists(mat_path):
                # Preparar parámetros para generación
                simulation_params = {
                    'attenuation': simulation_data.get('attenuation', 0),
                    'typical_mesh_size': simulation_data.get('typical_mesh_size', 0.1),
                    'sensor_edge_margin': simulation_data.get('sensor_edge_margin', 20),
                    'porosity': simulation_data.get('porosity', 10),
                    'receiver_pitch': simulation_data.get('receiver_pitch', 0.4)
                }
                
                print(f"🎨 Generando gráfico on-demand con parámetros: {simulation_params}")
                
                # Generar gráfico
                plot_path = generate_results_plots(simulation_id, mat_path, simulation_params)
                
                if plot_path:
                    print(f"✅ Gráfico generado exitosamente: {plot_path}")
                    # Intentar cargar nuevamente
                    image_base64 = get_results_plot_base64(simulation_id)
                else:
                    print(f"❌ No se pudo generar el gráfico")
            else:
                print(f"❌ No se encontró archivo .mat para simulación {simulation_id}")
        
        # Si aún no hay imagen, retornar error
        if not image_base64:
            return {
                "error": "No se encontraron gráficos generados para esta simulación y no se pudo generar on-demand",
                "simulationId": simulation_id
            }
        
        # Preparar respuesta con la imagen
        results = {
            "simulationId": simulation_id,
            "combinedImage": image_base64,
            "metadata": {
                "porosity": simulation_data.get('porosity'),
                "meshSize": simulation_data.get('typical_mesh_size'),
                "thickness": simulation_data.get('plate_thickness'),
                "attenuation": simulation_data.get('attenuation')
            }
        }
        
        print(f"✅ Resultados cargados para simulación {simulation_id}")
        return results
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "error": f"Error al cargar resultados: {str(e)}",
            "simulationId": simulation_id
        }
