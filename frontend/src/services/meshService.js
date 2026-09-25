const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class MeshService {
  async getMeshInfo(simulationId) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/${simulationId}/mesh`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching mesh info:', error);
      throw error;
    }
  }

  async downloadMeshFile(simulationId, filename) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/${simulationId}/mesh/${filename}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Error downloading mesh file:', error);
      throw error;
    }
  }

  async parseVTKFile(vtkBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const meshData = this.parseVTKText(text);
          resolve(meshData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read VTK file'));
      reader.readAsText(vtkBlob);
    });
  }

  parseVTKText(vtkText) {
    const lines = vtkText.split('\n');
    let vertices = [];
    let faces = [];
    let currentSection = null;
    let pointCount = 0;
    let cellCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('POINTS')) {
        currentSection = 'points';
        const parts = line.split(' ');
        pointCount = parseInt(parts[1]);
        continue;
      }
      
      if (line.startsWith('CELLS')) {
        currentSection = 'cells';
        const parts = line.split(' ');
        cellCount = parseInt(parts[1]);
        continue;
      }
      
      if (line.startsWith('CELL_TYPES')) {
        currentSection = 'cell_types';
        continue;
      }
      
      if (currentSection === 'points' && line && !isNaN(parseFloat(line.split(' ')[0]))) {
        const coords = line.split(' ').map(parseFloat);
        vertices.push([coords[0], coords[1], coords[2] || 0]);
      }
      
      if (currentSection === 'cells' && line && !isNaN(parseFloat(line.split(' ')[0]))) {
        const parts = line.split(' ').map(parseInt);
        const numPoints = parts[0];
        
        // For triangular cells (numPoints = 3)
        if (numPoints === 3) {
          faces.push([parts[1], parts[2], parts[3]]);
        }
        // For quad cells (numPoints = 4), split into two triangles
        else if (numPoints === 4) {
          faces.push([parts[1], parts[2], parts[3]]);
          faces.push([parts[1], parts[3], parts[4]]);
        }
      }
    }

    return {
      vertices,
      faces,
      pointCount,
      cellCount
    };
  }

  async loadMeshForSimulation(simulationId) {
    try {
      // Get mesh data from MSH/XML file via new endpoint
      const response = await fetch(`${API_BASE_URL}/simulations/${simulationId}/mesh-data`);
      
      if (!response.ok) {
        throw new Error(`Failed to load mesh: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.mesh_data) {
        throw new Error('Invalid mesh data received from server');
      }
      
      return data.mesh_data;
      
    } catch (error) {
      console.error('Error loading mesh:', error);
      throw error;
    }
  }

  // Parse MSH file content (if needed for client-side parsing)
  parseMSHFile(mshContent) {
    try {
      
      const lines = mshContent.split('\n');
      let vertices = [];
      let faces = [];
      let inNodes = false;
      let inElements = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Parse nodes section
        if (line === '$Nodes') {
          inNodes = true;
          i++; // Skip node count line
          continue;
        } else if (line === '$EndNodes') {
          inNodes = false;
          continue;
        }
        
        // Parse elements section
        if (line === '$Elements') {
          inElements = true;
          i++; // Skip element count line
          continue;
        } else if (line === '$EndElements') {
          inElements = false;
          continue;
        }
        
        if (inNodes && line) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            vertices.push([x, y, z]);
          }
        }
        
        if (inElements && line) {
          const parts = line.split(/\s+/);
          // Element type 2 = triangle
          if (parts.length >= 8 && parts[1] === '2') {
            // Get the last 3 numbers as vertex indices (1-based, convert to 0-based)
            const v1 = parseInt(parts[parts.length - 3]) - 1;
            const v2 = parseInt(parts[parts.length - 2]) - 1;
            const v3 = parseInt(parts[parts.length - 1]) - 1;
            faces.push([v1, v2, v3]);
          }
        }
      }
      
      return {
        vertices,
        faces,
        pointCount: vertices.length,
        cellCount: faces.length
      };
      
    } catch (error) {
      console.error('Error parsing MSH file:', error);
      throw error;
    }
  }

  // Test mesh endpoint connectivity
  async testMeshEndpoint() {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/mesh/test`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error testing mesh endpoint:', error);
      throw error;
    }
  }

  // Get debug information for a simulation
  async getSimulationDebugInfo(simulationId) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/${simulationId}/debug`);
      
      if (!response.ok) {
        throw new Error(`Failed to get debug info: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data;
      
    } catch (error) {
      console.error('Error getting debug info:', error);
      throw error;
    }
  }

  // Get mesh file information for a simulation
  async getMeshFileInfo(simulationId) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/${simulationId}/mesh-info`);
      
      if (!response.ok) {
        let errorDetails = response.statusText;
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || errorDetails;
        } catch (parseError) {
          // Could not parse error response
        }
        throw new Error(`HTTP error! status: ${response.status} - ${errorDetails}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting mesh file info:', error);
      throw error;
    }
  }

  // Download mesh file for a simulation
  async downloadMeshFile(simulationId) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/${simulationId}/mesh-file`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `simulation_${simulationId}_mesh.msh`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const blob = await response.blob();
      return { blob, filename };
    } catch (error) {
      console.error('Error downloading mesh file:', error);
      throw error;
    }
  }

  // Parse .msh file content for visualization
  async parseMshFile(mshContent) {
    try {
      // This is a simplified parser for gmsh .msh format version 2.2
      // For production, you might want to use a more robust parser
      const lines = mshContent.split('\n');
      let vertices = [];
      let faces = [];
      let inNodes = false;
      let inElements = false;
      let nodeCount = 0;
      let elementCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '$Nodes') {
          inNodes = true;
          nodeCount = parseInt(lines[i + 1]);
          i++; // Skip node count line
          continue;
        }
        
        if (line === '$EndNodes') {
          inNodes = false;
          continue;
        }
        
        if (line === '$Elements') {
          inElements = true;
          elementCount = parseInt(lines[i + 1]);
          i++; // Skip element count line
          continue;
        }
        
        if (line === '$EndElements') {
          inElements = false;
          continue;
        }
        
        if (inNodes && line) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            vertices.push([x, y, z]);
          }
        }
        
        if (inElements && line) {
          const parts = line.split(/\s+/);
          if (parts.length >= 6) {
            const elementType = parseInt(parts[1]);
            // Type 2 = triangle, Type 4 = tetrahedron
            if (elementType === 2) { // Triangle
              const numTags = parseInt(parts[2]);
              const startIdx = 3 + numTags;
              if (parts.length >= startIdx + 3) {
                const v1 = parseInt(parts[startIdx]) - 1; // gmsh uses 1-based indexing
                const v2 = parseInt(parts[startIdx + 1]) - 1;
                const v3 = parseInt(parts[startIdx + 2]) - 1;
                faces.push([v1, v2, v3]);
              }
            }
          }
        }
      }
      
      return {
        vertices,
        faces,
        metadata: {
          num_vertices: vertices.length,
          num_faces: faces.length,
          source: 'msh_file'
        }
      };
      
    } catch (error) {
      console.error('Error parsing .msh file:', error);
      throw error;
    }
  }

  // Generate mesh preview based on simulation parameters
  async generateMeshPreview(simulationParams) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulations/mesh/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(simulationParams)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.mesh_data;
    } catch (error) {
      console.error('Error generating mesh preview:', error);
      throw error;
    }
  }

  // Generate demo mesh data for testing
  generateDemoMesh() {
    const vertices = [];
    const faces = [];
    
    // Create a simple rectangular mesh
    const width = 10;
    const height = 2;
    const divisions = 20;
    
    // Generate vertices
    for (let i = 0; i <= divisions; i++) {
      for (let j = 0; j <= divisions; j++) {
        const x = (i / divisions) * width;
        const y = (j / divisions) * height;
        vertices.push([x, y, 0]);
      }
    }
    
    // Generate faces (triangles)
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        const a = i * (divisions + 1) + j;
        const b = a + 1;
        const c = a + (divisions + 1);
        const d = c + 1;
        
        // Two triangles per quad
        faces.push([a, b, c]);
        faces.push([b, d, c]);
      }
    }
    
    return {
      vertices,
      faces,
      pointCount: vertices.length,
      cellCount: faces.length
    };
  }
}

export default new MeshService();
