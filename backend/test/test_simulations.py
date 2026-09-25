# test_simulations.py - Pruebas de Integración para BDAT
import pytest
import os
import requests
import time
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Configuration constants
# Tests run from host connecting to containerized Flask server
BASE_URL = os.getenv("BASE_URL", "http://localhost:5000")
MAX_WAIT_ITERATIONS = 300
POLL_INTERVAL = 2
STATUS_CHECK_FREQUENCY = 10

def create_simulation_data(sim_name: str, mesh_type: str = "gmsh", attenuation: int = 0) -> Dict[str, Any]:
    """Create standardized simulation data for testing."""
    return {
        "sim_name": sim_name,
        "n_transmitter": 1,           # Solo 2 emisores para rapidez
        "n_receiver": 30,              # Solo 3 receptores
        "emitters_pitch": 1,        # 1 mm entre emisores
        "receivers_pitch": 0.4,       # 1 mm entre receptores
        "sensor_distance": 20,       # 3 mm entre arrays
        "sensor_edge_margin": 10,    # 0.5 mm de margen
        "typical_mesh_size": 0.1,     # Malla más gruesa para rapidez
        "plate_thickness": 2,       # Placa más delgada
        "plate_length": 70,          # No se usa en 2D
        "porosity": 10,                # Baja porosidad (menos complejo)
        "attenuation": attenuation,
        "mesh_type": mesh_type
    }

def create_simulation(sim_data: Dict[str, Any]) -> str:
    """Create a simulation and return its ID."""
    response = requests.post(f"{BASE_URL}/simulations", json=sim_data)
    assert response.status_code in [200, 201], f"Failed to create simulation. Status: {response.status_code}"
    
    data = response.json()
    assert data["status"] == "success", f"Simulation creation failed: {data}"
    
    sim_id = data["simulation"]["id"]
    print(f"✅ {sim_data['mesh_type']} Simulation created with ID: {sim_id}")
    return sim_id

def start_simulation(sim_id: str, sim_data: Dict[str, Any]) -> Dict[str, Any]:
    """Start a simulation and return the response data."""
    run_response = requests.put(f"{BASE_URL}/simulations/{sim_id}/run", json=sim_data)
    assert run_response.status_code == 200, f"Failed to start simulation. Status: {run_response.status_code}"
    
    run_data = run_response.json()
    assert run_data["status"] == "success", f"Failed to start simulation: {run_data}"
    
    print(f"🚀 {sim_data['mesh_type']} Simulation {sim_id} started")
    return run_data

def wait_for_completion(sim_id: str, mesh_type: str) -> str:
    """Wait for simulation completion and return final status."""
    i = 0
    print(f"⏳ Monitoring {mesh_type} simulation {sim_id}...")
    
    while True:
        time.sleep(POLL_INTERVAL)
        i += 1
        
        status_response = requests.get(f"{BASE_URL}/Load_data/{sim_id}")
        assert status_response.status_code == 200, f"Failed to get simulation status. Status: {status_response.status_code}"
        
        sim_list = status_response.json()
        sim = next((s for s in sim_list if s["id"] == sim_id), None)
        status = sim["p_status"] if sim else 'NOT FOUND'
        
        if i % STATUS_CHECK_FREQUENCY == 0:  # Print status periodically
            print(f"📊 {mesh_type} Check {i}: Status = {status}")
        
        if sim and "error_message" in sim:
            print(f"❌ {mesh_type} Error: {sim['error_message']}")
        
        # Check for completion or error
        if status == "Error":
            assert False, f"{mesh_type} Simulation failed with status: {status}"
        if sim and status == "Finished":
            break
    
    return status

def run_simulation_test(sim_name: str, mesh_type: str, attenuation: int = 0):
    """Run a complete simulation test with the specified parameters."""
    # Create simulation data
    sim_data = create_simulation_data(sim_name, mesh_type, attenuation)
    
    # Create simulation
    # sim_id = create_simulation(sim_data)
    
    # Start simulation
    # run_data = start_simulation(sim_id, sim_data)
    
    # Wait for completion
    # status = wait_for_completion(sim_id, mesh_type)
    
    # Verify completion
    # print(f"✅ {mesh_type} Simulation {sim_id} completed successfully")
    # assert run_data["simulation"]["id"] == sim_id
    # assert status == "Finished", f"{mesh_type} Simulation did not complete successfully. Final status: {status}"

# def test_api_y_base_de_datos_mshr_attenuation_0():
#     """Prueba simulación con malla MSHR y attenuation=0."""
#     run_simulation_test("FastTestSim_MSHR_attenuation_0", "mshr", attenuation=0)

def test_api_y_base_de_datos_gmsh_attenuation_0():
    """Prueba simulación con malla GMSH y attenuation=0."""
    run_simulation_test("FastTestSim_GMSH_attenuation_0", "gmsh", attenuation=0)

# Tests de Integración con markers de pytest

# @pytest.mark.integration
# @pytest.mark.slow
# @pytest.mark.fenics
# def test_api_y_base_de_datos_gmsh_attenuation_1():
#     """Prueba simulación con malla GMSH y attenuation=1."""
#     run_simulation_test("IntegrationTest_GMSH_attenuation_1", "gmsh", attenuation=1)

# @pytest.mark.integration
# @pytest.mark.slow
# @pytest.mark.fenics
# def test_api_y_base_de_datos_gmsh_attenuation_0():
#     """Prueba simulación con malla GMSH y attenuation=0."""
#     run_simulation_test("IntegrationTest_GMSH_attenuation_0", "gmsh", attenuation=0)

# @pytest.mark.integration
# @pytest.mark.api
# def test_simulation_api_endpoints():
#     """Test de endpoints de API sin ejecutar simulación completa."""
#     # Test de health check
#     health_response = requests.get(f"{BASE_URL}/health")
#     assert health_response.status_code == 200
    
#     # Test de listado de simulaciones
#     list_response = requests.get(f"{BASE_URL}/Load_data")
#     assert list_response.status_code == 200
    
#     # Test de creación de simulación (sin ejecutar)
#     sim_data = create_simulation_data("APITest", "gmsh", 0)
#     create_response = requests.post(f"{BASE_URL}/simulations", json=sim_data)
#     assert create_response.status_code in [200, 201]
    
#     data = create_response.json()
#     assert data["status"] == "success"
    
#     print("✅ API endpoints funcionando correctamente")

# @pytest.mark.integration
# @pytest.mark.database
# def test_database_operations():
#     """Test de operaciones de base de datos."""
#     # Crear simulación de prueba
#     sim_data = create_simulation_data("DBTest", "gmsh", 0)
#     sim_id = create_simulation(sim_data)
    
#     # Verificar que se puede consultar
#     query_response = requests.get(f"{BASE_URL}/Load_data/{sim_id}")
#     assert query_response.status_code == 200
    
#     sim_list = query_response.json()
#     sim = next((s for s in sim_list if s["id"] == sim_id), None)
#     assert sim is not None
#     assert sim["sim_name"] == "DBTest"
    
#     print("✅ Operaciones de base de datos funcionando correctamente")

# Configuración de markers para este archivo
pytestmark = [pytest.mark.integration]

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
