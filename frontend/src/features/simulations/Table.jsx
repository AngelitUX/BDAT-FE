import { useState, useRef, useEffect } from 'react';
import { Ellipsis, Eye, Trash2, Clock, AlertTriangle, Loader, Edit2, Download } from 'lucide-react';
import StatusWithTime from './components/StatusWithTime';
import ContextMenu from './components/ContextMenu';

const columns = [
  { label: 'Name', key: 'sim_name' },
  { label: 'N. Tx', key: 'n_transmitter' },
  { label: 'N. Rx', key: 'n_receiver' },
  { label: 'Tx P.', key: 'emitters_pitch' },
  { label: 'Rx P.', key: 'receivers_pitch' },
  { label: 'Dist.', key: 'sensor_distance' },
  { label: 'Marg.', key: 'sensor_edge_margin' },
  { label: 'Mesh Sz', key: 'typical_mesh_size' },
  { label: 'Thick.', key: 'plate_thickness' },
  { label: 'Len.', key: 'plate_length' },
  { label: 'Poro.', key: 'porosity' },
  { label: 'Angle/Dir', key: 'angle' },
  { label: 'Rough.', key: 'roughness' },
  { label: 'Atten.', key: 'attenuation' },
  { label: 'Mesh tech.', key: 'mesh_type' },
  { label: 'Status', key: 'p_status' },
  { label: 'Progress', key: 'progress' },
];

export default function Table({ simulations, onView, onDelete, onDuplicate, onExecute, onRerun, onDownloadZip, selectedIds = [], onToggleSelect, onSelectAll, editingSimulationId = null, simulationProgress = {} }) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const allSelected = simulations.length > 0 && selectedIds.length === simulations.length;

  const handleContextMenu = (e, simulation) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      simulation
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div className="w-full h-full overflow-y-auto relative flex flex-col">
      {/* Header sticky */}
      <div
        className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-md shadow-sm border-b border-gray-200 grid"
        style={{
          gridTemplateColumns: '50px 1.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.7fr 0.5fr 0.5fr 0.6fr 0.7fr 1.1fr 0.6fr',
          alignItems: 'center',
        }}
      >
        {/* Checkbox para seleccionar todos */}
        <div className="px-4 py-3 flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
          />
        </div>
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-2 py-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider truncate ${col.key === 'sim_name' || col.key === 'p_status' ? 'text-left' : 'text-center'
              }`}
            title={col.label}
          >
            {col.key === 'progress' ? (
              <div className="flex items-center justify-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                progress
              </div>
            ) : col.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y divide-gray-100">
        {simulations.map((sim) => {
          const isGeneratingMesh = sim.p_status === 'Generating mesh';
          const isMeshFailed = sim.p_status === 'Mesh generation failed';
          const isSaving = editingSimulationId === sim.id;
          const isDisabled = isGeneratingMesh || isMeshFailed;
          const isActive = sim.p_status === 'Running' || sim.p_status === 'Processing';

          const isSelected = selectedIds.includes(sim.id);

          return (
            <div
              key={sim.id}
              className={`
            relative grid items-center transition-all duration-200 rounded-xl border border-transparent
            ${isDisabled
                  ? 'bg-gray-50 border-gray-100'
                  : isActive
                    ? 'bg-gray-100 border-gray-200 cursor-pointer'
                    : isSaving
                      ? 'bg-gray-50 border-gray-200 cursor-pointer hover:bg-gray-100'
                      : isSelected
                        ? 'bg-gray-100 border-gray-200 hover:bg-gray-100'
                        : 'hover:bg-gray-50/80 hover:shadow-sm cursor-pointer'}
          `}
              style={{
                gridTemplateColumns: '50px 1.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 0.7fr 0.5fr 0.5fr 0.6fr 0.7fr 1.1fr 0.6fr',
                alignItems: 'center',
              }}
              onMouseEnter={() => !isDisabled && setHoveredRow(sim.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onContextMenu={(e) => !isSaving && handleContextMenu(e, sim)}
            >
              {/* Checkbox */}
              <div className="px-4 py-2 flex items-center justify-center z-20">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(sim.id, e.nativeEvent);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Overlay logic... (same as before) */}
              {!isDisabled && (
                <div
                  className={`
                absolute inset-0 flex items-center justify-center bg-gray-900/10 z-10 transition-opacity duration-150
                ${hoveredRow === sim.id ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}
                  onClick={() => onView && onView(sim)}
                >
                  <span className="text-xs font-semibold text-gray-800 bg-white/90 px-3 py-1.5 rounded-lg shadow border border-gray-200 hover:bg-gray-100 transition-colors">
                    Click to see details
                  </span>
                </div>
              )}

              {/* Status overlays... */}
              {isGeneratingMesh && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-50/40 z-10 pointer-events-none">
                  <span className="text-xs font-medium text-blue-700 bg-blue-100/80 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-2 shadow-sm">
                    <Clock className="h-3 w-3 animate-spin" />
                    Generating mesh...
                  </span>
                </div>
              )}

              {isMeshFailed && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50/40 z-10 pointer-events-none">
                  <span className="text-xs font-medium text-red-700 bg-red-100/80 px-3 py-1 rounded-full border border-red-200 flex items-center gap-2 shadow-sm">
                    <AlertTriangle className="h-3 w-3" />
                    Mesh generation failed
                  </span>
                </div>
              )}

              {editingSimulationId === sim.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/40 z-10 pointer-events-none">
                  <span className="text-xs font-medium text-gray-600 bg-gray-100/80 px-3 py-1 rounded-full border border-gray-200 flex items-center gap-2 shadow-sm">
                    <Loader className="h-3 w-3 animate-spin" />
                    Saving changes...
                  </span>
                </div>
              )}

              {/* Cells */}
              <div className="px-2 py-2 text-gray-900 font-semibold truncate text-sm" title={sim.sim_name}>{sim.sim_name}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.n_transmitter}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.n_receiver}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.emitters_pitch}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.receivers_pitch}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.sensor_distance}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.sensor_edge_margin}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.typical_mesh_size}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.plate_thickness}</div>
              <div className="px-1 py-1 text-gray-700 text-xs text-center truncate">{sim.plate_length}</div>
              <div className="px-2 py-2 text-gray-700 text-xs text-center">{sim.porosity}</div>

              {/* Angle / Dir Column */}
              <div className="px-2 py-2 text-gray-700 text-xs flex items-center justify-center gap-1.5">
                <span className="text-[10px] w-5 text-right font-medium">{sim.mesh_angle || 0}°</span>
                {sim.mesh_angle > 0 && sim.mesh_angle_direction && sim.mesh_angle_direction !== 'none' && (
                  <div
                    title={`Angle: ${sim.mesh_angle}°, Direction: ${sim.mesh_angle_direction}`}
                    className="flex items-center justify-center"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d={sim.mesh_angle_direction === 'left'
                          ? "M4 6 L20 6 L20 18 L4 10 Z"
                          : "M4 6 L20 6 L20 10 L4 18 Z"
                        }
                        fill="#F3F4F6"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
              {/* Roughness column */}
              <div className="px-2 py-2 text-center text-xs">
                {Number(sim.roughness ?? sim.mesh_amplitude ?? 0) > 0 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                    {Number(sim.roughness ?? sim.mesh_amplitude).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400 font-semibold border border-gray-200">0</span>
                )}
              </div>

              <div className="px-2 py-2 text-center text-xs">
                {(sim.attenuation === 1 || sim.attenuation === '1' || sim.attenuation === 'Yes') ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold border border-gray-200 whitespace-nowrap">
                    Yes
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold border border-gray-200 whitespace-nowrap">
                    No
                  </span>
                )}
              </div>
              <div className="px-2 py-2 flex justify-center text-xs">
                {(sim.mesh_type === 'gmsh' || !sim.mesh_type) ? (
                  <span className="text-[10px] text-gray-700 font-medium flex items-center gap-1 whitespace-nowrap" title="Gmsh">
                    <img src="/images/gmsh.png" alt="gmsh" className="w-3 h-3 object-contain" />
                    <span className="hidden xl:inline">gmsh</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-700 font-medium flex items-center gap-1 whitespace-nowrap" title="Mshr">
                    <img src="/images/mshr.png" alt="mshr" className="w-3 h-3 object-contain" />
                    <span className="hidden xl:inline">mshr</span>
                  </span>
                )}
              </div>
              <div className="px-4 py-2 flex items-center gap-2 group/status relative z-20">
                <StatusWithTime
                  status={sim.p_status}
                  startDateTime={sim.start_datetime}
                  finishDateTime={sim.finish_datetime}
                  queuePosition={sim.queue_position}
                  showIcon={true}
                />
                {sim.p_status === 'Finished' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadZip(sim.id);
                    }}
                    className="p-1 px-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-white transition-all flex items-center gap-1 border border-gray-200 shrink-0"
                    title="Download results (.mat)"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Progress Column */}
              <div className="px-2 py-2 flex items-center justify-center">
                {sim.p_status === 'Running' && simulationProgress[sim.id] ? (() => {
                  const prog = simulationProgress[sim.id];
                  const r = 10;
                  const circ = 2 * Math.PI * r;
                  const offset = circ - (prog.percentage / 100) * circ;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tabular-nums text-amber-600 flex-shrink-0">
                        {prog.percentage.toFixed(0)}%
                      </span>
                      <svg width="28" height="28" viewBox="0 0 28 28" className="flex-shrink-0 -rotate-90">
                        {/* Track */}
                        <circle cx="14" cy="14" r={r} fill="none" stroke="#E5E7EB" strokeWidth="3" />
                        {/* Fill */}
                        <circle
                          cx="14" cy="14" r={r}
                          fill="none"
                          stroke="url(#prog-grad)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={circ}
                          strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                        />
                        <defs>
                          <linearGradient id="prog-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#fbbf24" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  );
                })() : (
                  <span className="text-gray-300 text-xl font-bold">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          simulation={contextMenu.simulation}
          onClose={closeContextMenu}
          onView={onView}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onExecute={onExecute}
          onRerun={onRerun}
          onDownloadZip={onDownloadZip}
        />
      )}
    </div>
  );
}