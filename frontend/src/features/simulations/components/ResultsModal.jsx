import React, { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';
import ResultsVisualization from './ResultsVisualization';

/**
 * Modal para visualizar resultados de simulación
 * Similar a las gráficas de MATLAB
 */
const ResultsModal = ({ isOpen, onClose, simulation }) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && simulation) {
      loadResults();
    }
  }, [isOpen, simulation]);

  const loadResults = async () => {
    setLoading(true);
    try {
      // Cargar resultados reales desde el backend
      const response = await fetch(`http://localhost:5000/simulations/${simulation.id}/results`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error loading results');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error loading results:', error);
      // Si falla, aún podemos mostrar la visualización que se carga directamente en ResultsVisualization
      setResults({});
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Simulation Results
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {simulation?.sim_name || `Simulation #${simulation?.id}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {/* Exportar resultados */}}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 shadow-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-800"></div>
            </div>
          ) : results ? (
            <ResultsVisualization 
              simulationId={simulation.id}
              results={results}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No results available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Funciones para generar datos de ejemplo (reemplazar con datos reales del backend)
function generateMockSpatioTemporal() {
  const data = [];
  for (let t = 0; t < 100; t++) {
    const point = { time: t * 0.5 };
    for (let r = 1; r <= 30; r++) {
      point[`receiver${r}`] = Math.sin(t * 0.1 + r * 0.2) * Math.exp(-t * 0.01) + r;
    }
    data.push(point);
  }
  return data;
}

function generateMockSingularValues() {
  const data = [];
  for (let f = 0; f <= 2; f += 0.01) {
    data.push({
      frequency: f,
      sv1: 50 * Math.exp(-((f - 0.5) ** 2) / 0.1),
      sv2: 40 * Math.exp(-((f - 0.8) ** 2) / 0.1),
      sv3: 30 * Math.exp(-((f - 1.2) ** 2) / 0.1),
      sv4: 20 * Math.exp(-((f - 1.5) ** 2) / 0.1),
      sv5: 10 * Math.exp(-((f - 1.8) ** 2) / 0.1)
    });
  }
  return data;
}

function generateMockSpectrum() {
  return {
    description: 'Guided wave spectrum in f-k domain',
    colormap: 'viridis',
    clim: [0, 1]
  };
}

function generateMockSpectrumMatrix() {
  const rows = 100; // k
  const cols = 200; // f
  const matrix = [];
  
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      const k = (i / rows) * 7;
      const f = (j / cols) * 2;
      // Simular modos de ondas guiadas
      const value = Math.exp(-((k - 2 * f) ** 2) / 0.5) + 
                   0.5 * Math.exp(-((k - 3 * f) ** 2) / 0.3);
      row.push(value);
    }
    matrix.push(row);
  }
  
  return matrix;
}

function generateMockReferenceLines() {
  const points = [];
  for (let f = 0; f <= 2; f += 0.05) {
    points.push({
      x: f,
      y: 2 * f + 0.5 // Línea de referencia del modelo
    });
  }
  return points;
}

export default ResultsModal;
