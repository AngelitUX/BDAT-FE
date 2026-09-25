import { useEffect, useRef, useState } from 'react';

/**
 * Canvas-based mesh viewer — white/light premium theme
 */
export function MeshViewerCanvas({ meshData }) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ x: 0.3, y: 0.4 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [showNodes, setShowNodes] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderMesh(ctx, canvas.width, canvas.height);
  }, [meshData, rotation, zoom, showNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const renderMesh = (ctx, width, height) => {
    // Light background gradient
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#f8fafc');
    bg.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle dot grid pattern
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    const gridSize = 28;
    for (let x = gridSize; x < width; x += gridSize) {
      for (let y = gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!meshData || !meshData.nodes || !meshData.elements) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No mesh data available', width / 2, height / 2);
      return;
    }

    const { bounds } = meshData;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;

    const rangeX = bounds.maxX - bounds.minX || 1;
    const rangeY = bounds.maxY - bounds.minY || 1;
    const rangeZ = bounds.maxZ - bounds.minZ || 1;
    const maxRange = Math.max(rangeX, rangeY, rangeZ);
    const scale = (Math.min(width, height) * 0.42 * zoom) / maxRange;

    const project = (x, y, z) => {
      const nx = x - centerX, ny = y - centerY, nz = z - centerZ;
      const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
      const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);
      const y1 = ny * cosX - nz * sinX;
      const z1 = ny * sinX + nz * cosX;
      const x2 = nx * cosY + z1 * sinY;
      const z2 = -nx * sinY + z1 * cosY;
      return { x: width / 2 + x2 * scale, y: height / 2 - y1 * scale, depth: z2 };
    };

    const elementsWithDepth = meshData.elements.map(element => {
      const nodeCoords = element.nodes.map(nodeId => {
        const node = meshData.nodes.get(nodeId);
        return node ? project(node.x, node.y, node.z) : null;
      }).filter(n => n !== null);
      const avgDepth = nodeCoords.reduce((s, n) => s + (n?.depth || 0), 0) / (nodeCoords.length || 1);
      return { element, nodeCoords, avgDepth };
    });

    elementsWithDepth.sort((a, b) => a.avgDepth - b.avgDepth);

    // Single uniform color for all mesh lines
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.65)'; // indigo-500
    ctx.lineWidth = 0.9;

    elementsWithDepth.forEach(({ element, nodeCoords }) => {
      if (nodeCoords.length < 2) return;

      const drawPolygon = (coords) => {
        if (coords.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
        ctx.closePath();
        ctx.stroke();
      };

      if (element.type === 1 && nodeCoords.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(nodeCoords[0].x, nodeCoords[0].y);
        ctx.lineTo(nodeCoords[1].x, nodeCoords[1].y);
        ctx.stroke();
      } else if (element.type === 4 && nodeCoords.length >= 4) {
        [[0, 1, 2], [0, 1, 3], [1, 2, 3], [0, 2, 3]].forEach(face => drawPolygon(face.map(i => nodeCoords[i])));
      } else {
        drawPolygon(nodeCoords);
      }
    });

    // Nodes
    if (showNodes) {
      meshData.nodes.forEach(node => {
        const p = project(node.x, node.y, node.z);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
        ctx.fill();
      });
    }

    // Subtle vignette
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.85);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(148,163,184,0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  };

  const handleMouseDown = (e) => { setIsDragging(true); setLastMousePos({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.x, dy = e.clientY - lastMousePos.y;
    setRotation(prev => ({ x: prev.x + dy * 0.01, y: prev.y + dx * 0.01 }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setIsDragging(false);

  const nodeCount = meshData?.nodes?.size ?? 0;
  const elemCount = meshData?.elements?.length ?? 0;

  return (
    <div className="relative w-full h-full flex flex-col select-none">
      <canvas
        ref={canvasRef}
        width={900}
        height={620}
        className="w-full h-full rounded-b-3xl"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Bottom HUD */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {/* Stats pill */}
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-500 shadow-sm">
          <span><span className="text-indigo-600 font-semibold">{nodeCount.toLocaleString()}</span> nodes</span>
          <span className="text-gray-300">|</span>
          <span><span className="text-indigo-600 font-semibold">{elemCount.toLocaleString()}</span> elements</span>
        </div>

        {/* Nodes toggle */}
        <button
          onClick={() => setShowNodes(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all shadow-sm ${showNodes
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
            : 'bg-white/80 border-gray-200 text-gray-500 hover:text-gray-700'
            }`}
        >
          <span className={`w-2 h-2 rounded-full inline-block ${showNodes ? 'bg-indigo-500' : 'bg-gray-300'}`} />
          Nodes
        </button>

        {/* Reset */}
        <button
          onClick={() => { setRotation({ x: 0.3, y: 0.4 }); setZoom(1); }}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/80 border border-gray-200 text-gray-500 hover:text-gray-700 backdrop-blur-md transition-all shadow-sm"
        >
          Reset
        </button>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1 text-[10px] text-gray-400 pointer-events-none shadow-sm">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}

export default MeshViewerCanvas;
