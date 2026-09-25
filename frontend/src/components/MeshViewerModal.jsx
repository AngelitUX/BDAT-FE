import React from 'react';
import { X, Maximize2 } from 'lucide-react';
import MeshViewerCanvas from './MeshViewerCanvas';

const MeshViewerModal = ({ isOpen, onClose, meshData, title = 'Mesh Visualization' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-6xl mx-4 bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200">

        {/* Subtle top accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] rounded-full bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
              <Maximize2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 leading-tight">Mesh Viewer</h2>
              {title && title !== 'Mesh Visualization' && (
                <p className="text-[11px] text-gray-400 truncate max-w-xs">{title}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full p-1.5 transition-all border border-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas */}
        <div className="relative bg-gray-50" style={{ height: '72vh' }}>
          {meshData ? (
            <MeshViewerCanvas meshData={meshData} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Maximize2 className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">No mesh data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeshViewerModal;
