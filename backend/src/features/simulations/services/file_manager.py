"""
Gestor de archivos para simulaciones
Organiza archivos .mat, mesh y gráficos en carpetas por ID de simulación
"""

import os


# Directorio base para todos los resultados de simulaciones
SIMULATIONS_BASE_DIR = "simulation_results"


def get_simulation_dir(simulation_id):
    """
    Obtiene el directorio para una simulación específica
    
    Args:
        simulation_id: ID de la simulación
    
    Returns:
        str: Ruta al directorio de la simulación
    """
    return os.path.join(SIMULATIONS_BASE_DIR, f"sim_{simulation_id}")


def get_mat_file_path(simulation_id, filename):
    """
    Obtiene la ruta donde guardar el archivo .mat
    
    Args:
        simulation_id: ID de la simulación
        filename: Nombre del archivo .mat
    
    Returns:
        str: Ruta completa al archivo .mat
    """
    sim_dir = get_simulation_dir(simulation_id)
    mat_dir = os.path.join(sim_dir, "mat_files")
    os.makedirs(mat_dir, exist_ok=True)
    return os.path.join(mat_dir, filename)


def get_mesh_dir(simulation_id):
    """
    Obtiene el directorio donde guardar archivos de mesh
    
    Args:
        simulation_id: ID de la simulación
    
    Returns:
        str: Ruta al directorio de mesh
    """
    sim_dir = get_simulation_dir(simulation_id)
    mesh_dir = os.path.join(sim_dir, "mesh")
    os.makedirs(mesh_dir, exist_ok=True)
    return mesh_dir


def get_mesh_file_path(simulation_id, filename):
    """
    Obtiene la ruta completa para un archivo de mesh
    
    Args:
        simulation_id: ID de la simulación
        filename: Nombre del archivo de mesh (xml o msh)
    
    Returns:
        str: Ruta completa al archivo de mesh
    """
    mesh_dir = get_mesh_dir(simulation_id)
    return os.path.join(mesh_dir, filename)


def get_plots_dir(simulation_id):
    """
    Obtiene el directorio donde guardar gráficos
    
    Args:
        simulation_id: ID de la simulación
    
    Returns:
        str: Ruta al directorio de gráficos
    """
    sim_dir = get_simulation_dir(simulation_id)
    plots_dir = os.path.join(sim_dir, "plots")
    os.makedirs(plots_dir, exist_ok=True)
    return plots_dir


def get_plot_file_path(simulation_id, filename="results_plot.png"):
    """
    Obtiene la ruta completa para el archivo de gráfico
    
    Args:
        simulation_id: ID de la simulación
        filename: Nombre del archivo de gráfico
    
    Returns:
        str: Ruta completa al archivo de gráfico
    """
    plots_dir = get_plots_dir(simulation_id)
    return os.path.join(plots_dir, filename)


def ensure_simulation_dirs(simulation_id):
    """
    Crea todas las carpetas necesarias para una simulación
    
    Args:
        simulation_id: ID de la simulación
    
    Returns:
        dict: Diccionario con las rutas creadas
    """
    sim_dir = get_simulation_dir(simulation_id)
    mat_dir = os.path.join(sim_dir, "mat_files")
    mesh_dir = os.path.join(sim_dir, "mesh")
    plots_dir = os.path.join(sim_dir, "plots")
    
    os.makedirs(mat_dir, exist_ok=True)
    os.makedirs(mesh_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)
    
    return {
        'base': sim_dir,
        'mat': mat_dir,
        'mesh': mesh_dir,
        'plots': plots_dir
    }


def get_simulation_structure():
    """
    Retorna la estructura de carpetas para documentación
    
    Returns:
        str: Descripción de la estructura
    """
    return """
    simulation_results/
    ├── sim_1/
    │   ├── mat_files/
    │   │   └── TimeSimP10TransIsoW1.0M0.2_1.mat
    │   ├── mesh/
    │   │   ├── mesh_1.xml
    │   │   └── mesh_1.msh
    │   └── plots/
    │       └── results_plot.png
    ├── sim_2/
    │   ├── mat_files/
    │   ├── mesh/
    │   └── plots/
    └── sim_N/
        ├── mat_files/
        ├── mesh/
        └── plots/
    """
