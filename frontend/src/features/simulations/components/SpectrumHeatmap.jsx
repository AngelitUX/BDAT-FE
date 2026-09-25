import React, { useEffect, useRef } from 'react';

/**
 * Componente para visualizar el espectro de ondas guiadas como heatmap
 * Similar al imagesc de MATLAB
 */
const SpectrumHeatmap = ({ 
  data, 
  xAxis, 
  yAxis, 
  colormap = 'viridis',
  referenceLines = null,
  width = 800,
  height = 400 
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Configurar dimensiones
    canvas.width = width;
    canvas.height = height;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Calcular dimensiones de cada celda
    const cellWidth = width / data[0].length;
    const cellHeight = height / data.length;

    // Encontrar min/max para normalización
    let min = Infinity, max = -Infinity;
    data.forEach(row => {
      row.forEach(val => {
        if (val < min) min = val;
        if (val > max) max = val;
      });
    });

    // Dibujar heatmap
    data.forEach((row, i) => {
      row.forEach((value, j) => {
        // Normalizar valor entre 0 y 1
        const normalized = (value - min) / (max - min);
        
        // Obtener color según colormap
        const color = getColor(normalized, colormap);
        
        ctx.fillStyle = color;
        ctx.fillRect(
          j * cellWidth,
          (data.length - 1 - i) * cellHeight, // Invertir Y para que coincida con imagesc
          cellWidth,
          cellHeight
        );
      });
    });

    // Dibujar líneas de referencia si existen
    if (referenceLines && referenceLines.length > 0) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      referenceLines.forEach((point, idx) => {
        const x = (point.x / xAxis.max) * width;
        const y = height - (point.y / yAxis.max) * height;
        
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

  }, [data, xAxis, yAxis, colormap, referenceLines, width, height]);

  return (
    <div className="relative">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full rounded-lg"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Ejes */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 py-2 text-xs text-white bg-black/50">
        <span>0</span>
        <span className="font-medium">{xAxis?.label || 'f (MHz)'}</span>
        <span>{xAxis?.max || 2}</span>
      </div>
      
      <div className="absolute top-0 bottom-0 left-0 flex flex-col justify-between py-4 px-2 text-xs text-white bg-black/50">
        <span>{yAxis?.max || 7}</span>
        <span className="font-medium -rotate-90">{yAxis?.label || 'k (rad/mm)'}</span>
        <span>0</span>
      </div>

      {/* Colorbar */}
      <div className="absolute top-4 right-4 w-8 h-48 rounded overflow-hidden border-2 border-white shadow-lg">
        <canvas 
          ref={ref => {
            if (!ref) return;
            const ctx = ref.getContext('2d');
            ref.width = 30;
            ref.height = 200;
            
            for (let i = 0; i < 200; i++) {
              const normalized = i / 200;
              ctx.fillStyle = getColor(normalized, colormap);
              ctx.fillRect(0, 200 - i, 30, 1);
            }
          }}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

/**
 * Función para obtener color según el colormap y valor normalizado
 */
function getColor(value, colormap) {
  // Asegurar que value esté entre 0 y 1
  value = Math.max(0, Math.min(1, value));

  switch (colormap) {
    case 'viridis':
      return viridisColormap(value);
    case 'jet':
      return jetColormap(value);
    case 'hot':
      return hotColormap(value);
    default:
      return viridisColormap(value);
  }
}

/**
 * Colormap Viridis (similar a MATLAB)
 */
function viridisColormap(t) {
  const r = Math.round(255 * (0.267 + 0.005 * t + 0.323 * t * t - 0.595 * t * t * t));
  const g = Math.round(255 * (0.005 + 0.503 * t + 0.492 * t * t - 0.000 * t * t * t));
  const b = Math.round(255 * (0.333 + 1.183 * t - 1.516 * t * t + 0.000 * t * t * t));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Colormap Jet (similar a MATLAB)
 */
function jetColormap(t) {
  let r, g, b;
  
  if (t < 0.125) {
    r = 0;
    g = 0;
    b = 0.5 + 0.5 * (t / 0.125);
  } else if (t < 0.375) {
    r = 0;
    g = (t - 0.125) / 0.25;
    b = 1;
  } else if (t < 0.625) {
    r = (t - 0.375) / 0.25;
    g = 1;
    b = 1 - (t - 0.375) / 0.25;
  } else if (t < 0.875) {
    r = 1;
    g = 1 - (t - 0.625) / 0.25;
    b = 0;
  } else {
    r = 1 - 0.5 * (t - 0.875) / 0.125;
    g = 0;
    b = 0;
  }
  
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

/**
 * Colormap Hot (similar a MATLAB)
 */
function hotColormap(t) {
  let r, g, b;
  
  if (t < 0.375) {
    r = t / 0.375;
    g = 0;
    b = 0;
  } else if (t < 0.75) {
    r = 1;
    g = (t - 0.375) / 0.375;
    b = 0;
  } else {
    r = 1;
    g = 1;
    b = (t - 0.75) / 0.25;
  }
  
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export default SpectrumHeatmap;
