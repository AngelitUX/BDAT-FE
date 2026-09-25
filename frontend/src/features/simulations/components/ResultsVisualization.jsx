import React, { useState, useEffect } from 'react';

const ResultsVisualization = ({ simulationId, results }) => {
  const [loading, setLoading] = useState(true);
  const [visualizationData, setVisualizationData] = useState(null);
  const [error, setError] = useState(null);

  // Fetch visualization data from backend
  useEffect(() => {
    if (simulationId) {
      setLoading(true);
      fetch(`http://localhost:5000/simulations/${simulationId}/visualization`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Error fetching visualization data');
          }
          return response.json();
        })
        .then(data => {
          setVisualizationData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching visualization:', err);
          setError('Failed to load visualization data');
          setLoading(false);
        });
    }
  }, [simulationId]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-800"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-red-500">
          {error}
        </div>
      ) : visualizationData?.combinedImage ? (
        <div className="flex justify-center">
          <img 
            src={`data:image/png;base64,${visualizationData.combinedImage}`} 
            alt="Simulation Results - All Plots" 
            className="max-w-full h-auto rounded-lg"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No visualization data available
        </div>
      )}
    </div>
  );
};

export default ResultsVisualization;
