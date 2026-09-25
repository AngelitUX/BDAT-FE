import React, { useState } from 'react';

const MeshControls = ({ 
  onMeshTypeChange, 
  onMeshSizeChange, 
  onGenerateMesh,
  meshType = 'gmsh',
  meshSize = 0.1,
  isGenerating = false 
}) => {
  const [localMeshType, setLocalMeshType] = useState(meshType);
  const [localMeshSize, setLocalMeshSize] = useState(meshSize);

  const handleMeshTypeChange = (type) => {
    setLocalMeshType(type);
    onMeshTypeChange(type);
  };

  const handleMeshSizeChange = (size) => {
    setLocalMeshSize(size);
    onMeshSizeChange(size);
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Controles de Malla</h3>
      
      <div className="space-y-4">
        {/* Mesh Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Malla
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="meshType"
                value="gmsh"
                checked={localMeshType === 'gmsh'}
                onChange={(e) => handleMeshTypeChange(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">GMSH</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="meshType"
                value="mshr"
                checked={localMeshType === 'mshr'}
                onChange={(e) => handleMeshTypeChange(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">MSHR</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {localMeshType === 'gmsh' 
              ? 'Malla generada con GMSH (más control, mejor calidad)'
              : 'Malla generada con MSHR (más simple, integrado en FEniCS)'
            }
          </p>
        </div>

        {/* Mesh Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamaño de Elemento (mm)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0.01"
              max="1.0"
              step="0.01"
              value={localMeshSize}
              onChange={(e) => handleMeshSizeChange(parseFloat(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min="0.01"
              max="1.0"
              step="0.01"
              value={localMeshSize}
              onChange={(e) => handleMeshSizeChange(parseFloat(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Mallas más finas (valores pequeños) dan mejor precisión pero requieren más tiempo
          </p>
        </div>

        {/* Preset Mesh Sizes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamaños Predefinidos
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Muy Fino', value: 0.02 },
              { label: 'Fino', value: 0.05 },
              { label: 'Medio', value: 0.1 },
              { label: 'Grueso', value: 0.2 },
              { label: 'Muy Grueso', value: 0.5 }
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => handleMeshSizeChange(preset.value)}
                className={`px-3 py-1 text-xs rounded border ${
                  Math.abs(localMeshSize - preset.value) < 0.01
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mesh Statistics */}
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Información de Malla</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Tipo: <span className="font-mono">{localMeshType.toUpperCase()}</span></div>
            <div>Tamaño elemento: <span className="font-mono">{localMeshSize} mm</span></div>
            <div className="text-gray-500">
              {localMeshSize <= 0.05 && 'Alta resolución - Simulación lenta'}
              {localMeshSize > 0.05 && localMeshSize <= 0.1 && 'Buena resolución - Tiempo moderado'}
              {localMeshSize > 0.1 && localMeshSize <= 0.2 && 'Resolución media - Simulación rápida'}
              {localMeshSize > 0.2 && 'Baja resolución - Simulación muy rápida'}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerateMesh}
          disabled={isGenerating}
          className={`w-full py-2 px-4 rounded font-medium ${
            isGenerating
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generando Malla...
            </div>
          ) : (
            'Generar Nueva Malla'
          )}
        </button>
      </div>
    </div>
  );
};

export default MeshControls;
