"""
Generador de gráficos usando GNU Octave
Reemplaza results_generator.py con llamadas a scripts de Octave
"""

import os
import subprocess
import sys
from .file_manager import get_plot_file_path, ensure_simulation_dirs


def generate_results_plots_octave(simulation_id, mat_file_path, simulation_params):
    """
    Genera los gráficos de resultados usando GNU Octave
    
    Args:
        simulation_id: ID de la simulación
        mat_file_path: Ruta al archivo .mat con los resultados
        simulation_params: Diccionario con parámetros de la simulación
    
    Returns:
        str: Ruta al archivo PNG generado o None si falla
    """
    try:
        print(f"🎨 Generando gráficos con Octave para simulación {simulation_id}...")
        print(f"📂 Archivo .mat de entrada: {mat_file_path}")
        
        # Verificar que el archivo .mat existe
        if not os.path.exists(mat_file_path):
            print(f"❌ ERROR: Archivo .mat no encontrado: {mat_file_path}")
            return None
        
        # Crear estructura de carpetas
        dirs = ensure_simulation_dirs(simulation_id)
        print(f"📁 Carpetas creadas: {dirs}")
        
        # Ruta del archivo de imagen
        plot_path = get_plot_file_path(simulation_id)
        print(f"📊 Ruta de salida del gráfico: {plot_path}")
        
        # Si ya existe, no regenerar
        if os.path.exists(plot_path):
            print(f"✅ Gráfico ya existe: {plot_path}")
            return plot_path
        
        # Extraer parámetros
        attenuation = simulation_params.get('attenuation', 0)
        porosity = simulation_params.get('porosity', 10)
        plate_thickness = simulation_params.get('plate_thickness', 2.0)
        mesh_size = simulation_params.get('typical_mesh_size', 0.1)
        margin = simulation_params.get('sensor_edge_margin', 20)
        # El campo puede llamarse 'receivers_pitch' (BD) o 'receiver_pitch' (legacy)
        receiver_pitch = simulation_params.get('receivers_pitch') or simulation_params.get('receiver_pitch', 0.4)
        
        print(f"📋 Parámetros de simulación:")
        print(f"   Attenuation: {attenuation}")
        print(f"   Porosity: {porosity}%")
        print(f"   Plate thickness: {plate_thickness} mm")
        print(f"   Mesh size: {mesh_size} mm")
        print(f"   Margin: {margin} mm")
        print(f"   Receiver pitch: {receiver_pitch} mm")
        
        # Ruta al script de Octave
        script_dir = os.path.dirname(os.path.abspath(__file__))
        octave_script = os.path.join(script_dir, 'generate_plots_octave.m')
        
        if not os.path.exists(octave_script):
            print(f"❌ ERROR: Script de Octave no encontrado: {octave_script}")
            return None
        
        print(f"📜 Script de Octave: {octave_script}")
        
        # Construir comando de Octave
        # Formato: octave --no-gui --eval "generate_plots_octave('input.mat', 'output.png', att, por, thick, mesh, marg, pitch)"
        octave_cmd = (
            f"generate_plots_octave("
            f"'{mat_file_path}', "
            f"'{plot_path}', "
            f"{attenuation}, "
            f"{porosity}, "
            f"{plate_thickness}, "
            f"{mesh_size}, "
            f"{margin}, "
            f"{receiver_pitch}"
            f")"
        )
        
        # Comando completo
        cmd = [
            'octave',
            '--no-gui',
            '--no-window-system',
            '--quiet',
            '--eval',
            f"addpath('{script_dir}'); {octave_cmd}"
        ]
        
        print(f"🚀 Ejecutando Octave...")
        print(f"   Comando: {' '.join(cmd[:5])}...")
        
        # Ejecutar Octave
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos máximo
        )
        
        # Mostrar salida de Octave
        if result.stdout:
            print("📄 Salida de Octave:")
            for line in result.stdout.split('\n'):
                if line.strip():
                    print(f"   {line}")
        
        if result.stderr:
            print("⚠️  Errores/Advertencias de Octave:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"   {line}")
        
        # Verificar código de retorno
        if result.returncode != 0:
            print(f"❌ ERROR: Octave terminó con código {result.returncode}")
            return None
        
        # Verificar que se generó el archivo
        if os.path.exists(plot_path):
            file_size = os.path.getsize(plot_path)
            print(f"✅ Gráfico generado exitosamente: {plot_path} ({file_size} bytes)")
            return plot_path
        else:
            print(f"❌ ERROR: El archivo no se generó: {plot_path}")
            return None
        
    except subprocess.TimeoutExpired:
        print(f"❌ ERROR: Timeout ejecutando Octave (>5 minutos)")
        return None
    except FileNotFoundError:
        print(f"❌ ERROR: Octave no está instalado o no está en el PATH")
        print(f"   Instalar con: sudo apt-get install octave (Linux)")
        print(f"   O descargar de: https://www.gnu.org/software/octave/")
        return None
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error generando gráficos con Octave: {str(e)}")
        return None


def check_octave_installation():
    """
    Verifica si Octave está instalado y accesible
    
    Returns:
        tuple: (bool, str) - (está_instalado, versión)
    """
    try:
        result = subprocess.run(
            ['octave', '--version'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            return True, version_line
        else:
            return False, "No se pudo obtener versión"
    except FileNotFoundError:
        return False, "Octave no encontrado en PATH"
    except Exception as e:
        return False, f"Error: {str(e)}"


def get_results_plot_base64(simulation_id):
    """
    Obtiene el gráfico de resultados en base64
    
    Args:
        simulation_id: ID de la simulación
    
    Returns:
        str: Imagen en base64 o None si no existe
    """
    import base64
    
    try:
        plot_path = get_plot_file_path(simulation_id)
        
        if not os.path.exists(plot_path):
            print(f"⚠️ Gráfico no encontrado: {plot_path}")
            return None
        
        with open(plot_path, 'rb') as f:
            image_data = f.read()
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        print(f"✅ Gráfico cargado desde: {plot_path}")
        return image_base64
        
    except Exception as e:
        print(f"❌ Error cargando gráfico: {str(e)}")
        return None


# Mantener compatibilidad con código existente
generate_results_plots = generate_results_plots_octave


if __name__ == '__main__':
    """
    Modo de prueba: verificar instalación de Octave
    """
    print("🔍 Verificando instalación de Octave...")
    installed, version = check_octave_installation()
    
    if installed:
        print(f"✅ Octave instalado: {version}")
    else:
        print(f"❌ Octave no disponible: {version}")
        sys.exit(1)
