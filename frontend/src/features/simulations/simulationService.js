// src/services/simulationService.js
const API_BASE_URL = 'http://localhost:5000';

class SimulationService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // ===== CONFIGURACIÓN DE ENDPOINTS =====
  get endpoints() {
    return {
      GET_SIMULATIONS: `${this.baseURL}/simulations`,
      CREATE_SIMULATION: `${this.baseURL}/simulations`,
      UPDATE_SIMULATION: (id) => `${this.baseURL}/simulations/${id}`,
      DUPLICATE_SIMULATION: (id) => `${this.baseURL}/simulations/${id}/duplicate`,
      EXECUTE_SIMULATION: (id) => `${this.baseURL}/simulations/${id}/run`,
      RERUN_SIMULATION: (id) => `${this.baseURL}/simulations/${id}/rerun`,
      ABORT_SIMULATION: (id) => `${this.baseURL}/simulations/${id}/abort`,
      DELETE_SIMULATION: (id) => `${this.baseURL}/simulations/${id}`,
      DOWNLOAD_SIMULATION: (id) => `${this.baseURL}/Load_data/download/${id}`,
      BATCH_RUN_SIMULATIONS: `${this.baseURL}/simulations/batch/run`,
      RUN_ALL_SIMULATIONS: `${this.baseURL}/simulations/run-all`,
      ABORT_ALL_SIMULATIONS: `${this.baseURL}/simulations/abort-all`,
      DOWNLOAD_BATCH_ZIP: `${this.baseURL}/simulations/batch/download-zip`,
      IMPORT_START: `${this.baseURL}/simulations/import/start`,
      IMPORT_UPDATE: `${this.baseURL}/simulations/import/update`,
      IMPORT_END: `${this.baseURL}/simulations/import/end`,
      IMPORT_STATUS: `${this.baseURL}/simulations/import/status`,
      IMPORT_RUN: `${this.baseURL}/simulations/import/run`,
      IMPORT_CANCEL: `${this.baseURL}/simulations/import/cancel`,
      IMPORT_RESET: `${this.baseURL}/simulations/import/reset`,
    };
  }

  async importStart(total) {
    try {
      await fetch(this.endpoints.IMPORT_START, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total }),
      });
    } catch (e) {
      console.warn('importStart failed:', e);
    }
  }

  async importUpdate(currentIndex, currentName) {
    try {
      await fetch(this.endpoints.IMPORT_UPDATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_index: currentIndex, current_name: currentName }),
      });
    } catch (e) {
      console.warn('importUpdate failed:', e);
    }
  }

  async importEnd() {
    try {
      await fetch(this.endpoints.IMPORT_END, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('importEnd failed:', e);
    }
  }

  async getImportStatus() {
    try {
      const res = await fetch(this.endpoints.IMPORT_STATUS);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Send the full list of simulations to the backend and start a Celery
   * batch import task. The import survives page reloads.
   * @param {Array} simulations - list of simulation data objects
   * @returns {Promise<{status, task_id, total}|null>}
   */
  async importRun(simulations) {
    try {
      const res = await fetch(this.endpoints.IMPORT_RUN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulations }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      console.error('importRun failed:', e);
      throw e;
    }
  }

  /**
   * Request cancellation of the currently running batch import (sets a Redis flag).
   */
  async importCancel() {
    try {
      await fetch(this.endpoints.IMPORT_CANCEL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('importCancel failed:', e);
    }
  }

  /**
   * Force reset any stuck import session in the backend.
   */
  async importReset() {
    try {
      const res = await fetch(this.endpoints.IMPORT_RESET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      console.error('importReset failed:', e);
      throw e;
    }
  }

  // ===== FUNCIONES DE CREACIÓN =====

  async createSimulation(simulationData, options = {}) {
    try {

      if (!simulationData.sim_name || simulationData.sim_name.trim() === '') {
        throw new Error('El nombre de la simulación es requerido');
      }

      const cleanData = {
        sim_name: simulationData.sim_name.trim(),
        n_transmitter: parseInt(simulationData.n_transmitter),
        n_receiver: parseInt(simulationData.n_receiver),
        emitters_pitch: parseFloat(simulationData.emitters_pitch),
        receivers_pitch: parseFloat(simulationData.receivers_pitch),
        sensor_distance: parseFloat(simulationData.sensor_distance),
        sensor_edge_margin: parseFloat(simulationData.sensor_edge_margin),
        typical_mesh_size: parseFloat(simulationData.typical_mesh_size),
        plate_thickness: parseInt(simulationData.plate_thickness),
        porosity: parseInt(simulationData.porosity),
        attenuation: (simulationData.attenuation),
        mesh_type: simulationData.mesh_type || "gmsh",
        skin_layer_config: simulationData.skin_layer_config || 'none',
        skin_thickness_top: parseFloat(simulationData.skin_thickness_top) || 1.3,
        skin_thickness_bottom: parseFloat(simulationData.skin_thickness_bottom) || 1.3,
        mesh_angle: parseFloat(simulationData.mesh_angle) || 0.0,
        mesh_angle_direction: simulationData.mesh_angle_direction || 'none',
        roughness: parseFloat(simulationData.roughness) || 0,
      };

      const response = await fetch(this.endpoints.CREATE_SIMULATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanData),
        signal: options?.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        const msg = result.message || `Error del servidor: ${response.status}`;
        throw new Error(msg);
      }

      return result.simulation || result;
    } catch (error) {
      throw error;
    }
  }

  // ===== FUNCIONES DE LECTURA =====

  async getSimulations() {
    try {
      const response = await fetch(this.endpoints.GET_SIMULATIONS);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  // ===== FUNCIONES DE ACTUALIZACIÓN =====

  async updateSimulation(simulationId, simulationData) {
    try {
      const cleanData = {
        sim_name: simulationData.sim_name.trim(),
        n_transmitter: parseInt(simulationData.n_transmitter),
        n_receiver: parseInt(simulationData.n_receiver),
        emitters_pitch: parseFloat(simulationData.emitters_pitch),
        receivers_pitch: parseFloat(simulationData.receivers_pitch),
        sensor_distance: parseFloat(simulationData.sensor_distance),
        sensor_edge_margin: parseFloat(simulationData.sensor_edge_margin),
        typical_mesh_size: parseFloat(simulationData.typical_mesh_size),
        plate_thickness: parseFloat(simulationData.plate_thickness),
        porosity: parseInt(simulationData.porosity),
        attenuation: simulationData.attenuation,
        mesh_type: simulationData.mesh_type || "gmsh",
        skin_layer_config: simulationData.skin_layer_config || 'none',
        skin_thickness_top: parseFloat(simulationData.skin_thickness_top) || 1.3,
        skin_thickness_bottom: parseFloat(simulationData.skin_thickness_bottom) || 1.3,
        mesh_angle: parseFloat(simulationData.mesh_angle) || 0.0,
        mesh_angle_direction: simulationData.mesh_angle_direction || 'none',
        roughness: parseFloat(simulationData.roughness) || 0,
      };

      const response = await fetch(this.endpoints.UPDATE_SIMULATION(simulationId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanData),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || result.error || 'Error al actualizar simulación');
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error al actualizar simulación:', error);
      return { success: false, error: error.message };
    }
  }

  async executeSimulation(simulationId, simulationData) {
    try {
      const response = await fetch(this.endpoints.EXECUTE_SIMULATION(simulationId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(simulationData),
      });

      if (!response.ok) {
        throw new Error(`Error al ejecutar simulación: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error al ejecutar simulación:', error);
      throw error;
    }
  }

  async downloadSimulationsZip(ids = [], isAll = false, contentType = 'all', defaultFilename = null) {
    try {
      const response = await fetch(this.endpoints.DOWNLOAD_BATCH_ZIP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: ids,
          all: isAll,
          content_type: contentType
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error downloading ZIP');
      }

      // Handle binary response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = isAll ? 'all_simulations.zip' : (defaultFilename || 'simulations_export.zip');
      if (contentDisposition) {
        // Soporta formatos filename=nombre.zip y filename="nombre.zip"
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, ''); // Quita las comillas si vienen
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    } catch (error) {
      console.error('❌ Error downloading simulations ZIP:', error);
      throw error;
    }
  }

  async downloadSimulationMat(id) {
    try {
      const response = await fetch(this.endpoints.DOWNLOAD_SIMULATION(id), {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Error downloading .mat file');
      }

      // Handle binary response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `simulation_${id}.mat`;
      if (contentDisposition) {
        // Soporta formatos filename=nombre.mat y filename="nombre.mat"
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, ''); // Quita las comillas si vienen
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    } catch (error) {
      console.error('❌ Error downloading simulation .mat:', error);
      throw error;
    }
  }

  async downloadSimulationGraphics(id) {
    try {
      const response = await fetch(`${this.endpoints.SIMULATIONS}/${id}/download/graphics`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Error downloading graphics');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `simulation_${id}_graphics.png`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    } catch (error) {
      console.error('❌ Error downloading simulation graphics:', error);
      throw error;
    }
  }


  // ===== FUNCIONES DE CONTROL =====

  /**
   * Run (or queue) multiple simulations at once.
   * @param {number[]} ids - Array of simulation IDs to run
   * @returns {Promise<{success, summary, results}>}
   */
  async batchRunSimulations(ids) {
    try {
      const response = await fetch(this.endpoints.BATCH_RUN_SIMULATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error ${response.status}`);
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('❌ Error in batchRunSimulations:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run ALL eligible simulations ordered by ID DESC (highest first).
   * @param {string[]|null} statusFilter - Optional filter e.g. ['Not started']
   */
  async runAllSimulations(statusFilter = null) {
    try {
      const body = statusFilter ? { status_filter: statusFilter } : {};
      const response = await fetch(this.endpoints.RUN_ALL_SIMULATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error ${response.status}`);
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('❌ Error in runAllSimulations:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Abort all running simulations and dequeue all queued ones.
   */
  async abortAllSimulations() {
    try {
      const response = await fetch(this.endpoints.ABORT_ALL_SIMULATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error ${response.status}`);
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('❌ Error in abortAllSimulations:', error);
      return { success: false, error: error.message };
    }
  }


  async duplicateSimulation(simulationId, newName = null) {
    try {
      const response = await fetch(this.endpoints.DUPLICATE_SIMULATION(simulationId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sim_name: newName
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Error al duplicar simulación');
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error al duplicar simulación:', error);
      return { success: false, error: error.message };
    }
  }

  async rerunSimulation(simulationId) {
    try {
      const response = await fetch(this.endpoints.RERUN_SIMULATION(simulationId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al re-ejecutar simulación');
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error al re-ejecutar simulación:', error);
      return { success: false, error: error.message };
    }
  }

  async abortSimulation(simulationId) {
    try {
      const response = await fetch(this.endpoints.ABORT_SIMULATION(simulationId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Error al abortar simulación');
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error al abortar simulación:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== FUNCIONES DE ELIMINACIÓN =====

  async deleteSimulation(simulationId) {
    try {
      const response = await fetch(this.endpoints.DELETE_SIMULATION(simulationId), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Error al eliminar simulación:', error);
      throw error;
    }
  }

  // ===== FUNCIONES ADICIONALES =====

  async downloadSimulation(simulationId, filename = null) {
    try {
      const response = await fetch(this.endpoints.DOWNLOAD_SIMULATION(simulationId));

      if (!response.ok) {
        throw new Error('No se pudo descargar el archivo');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const element = document.createElement('a');
      element.href = url;
      element.download = filename || `simulacion_${simulationId}.mat`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      throw error;
    }
  }


  // ===== FUNCIONES DE VALIDACIÓN =====

  validateSimulationData(simulationData) {
    const errors = [];

    if (!simulationData.sim_name || simulationData.sim_name.trim() === '') {
      errors.push('El nombre de la simulación es requerido');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== FUNCIONES DE UTILIDAD =====

  mapStatus(status) {
    switch (status) {
      case 0:
        return 'Not started';
      case 1:
        return 'Running';
      case 2:
        return 'Finished';
      case 3:
        return 'Error';
      case 'Not started':
        return 'Not started';
      case 'Queued':
        return 'Queued';
      case 'Running':
        return 'Running';
      case 'Paused':
        return 'Paused';
      case 'Resuming':
        return 'Resuming';
      case 'Aborting':
        return 'Aborting';
      case 'Aborted':
        return 'Aborted';
      case 'Finished':
        return 'Finished';
      case 'Error':
        return 'Error';
      case 'Failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  getProgress(status) {
    switch (status) {
      case 0:
      case 'Not started':
        return 0;
      case 'Queued':
        return 10;
      case 1:
      case 'Running':
        return 50;
      case 'Paused':
        return 40;
      case 'Resuming':
        return 45;
      case 'Aborting':
        return 75;
      case 2:
      case 'Finished':
        return 100;
      case 'Aborted':
      case 'Error':
      case 'Failed':
        return 0;
      default:
        return 0;
    }
  }
}

// Exportar instancia singleton
export default new SimulationService();
