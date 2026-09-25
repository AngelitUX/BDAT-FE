import { useEffect, useRef } from 'react';
import { Copy, Eye, Trash2, Play, RotateCcw, Archive } from 'lucide-react';

export default function ContextMenu({
  x,
  y,
  onClose,
  simulation,
  onView,
  onDuplicate,
  onDelete,
  onExecute,
  onRerun,
  onDownloadZip
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Execute: sims Not started con malla lista (el backend valida la malla; si falta, mostrará error y revertirá)
  const canExecute = simulation.p_status === 'Not started';
  // Re-run: sims terminales que pueden volver a ejecutarse
  const canRerun = simulation.p_status === 'Finished' || simulation.p_status === 'Error' || simulation.p_status === 'Aborted';
  // Bloqueado: sims en curso no se pueden eliminar ni re-ejecutar
  const isRunning = simulation.p_status === 'Running' || simulation.p_status === 'Queued' || simulation.p_status === 'Aborting';

  const menuItems = [
    {
      icon: Eye,
      label: 'View Details',
      onClick: () => {
        onView(simulation);
        onClose();
      },
      show: true,
      className: 'text-gray-700 hover:bg-gray-100'
    },
    {
      icon: Copy,
      label: 'Duplicate',
      onClick: () => {
        onDuplicate(simulation);
        onClose();
      },
      show: true,
      className: 'text-blue-700 hover:bg-blue-50'
    },
    {
      icon: Play,
      label: 'Execute',
      onClick: () => {
        // handleExecuteSimulation(simulationId, simulationData)
        onExecute(simulation.id, simulation);
        onClose();
      },
      show: canExecute,
      className: 'text-green-700 hover:bg-green-50'
    },
    {
      icon: RotateCcw,
      label: 'Re-run',
      onClick: () => {
        onRerun(simulation);
        onClose();
      },
      show: canRerun,
      className: 'text-orange-700 hover:bg-orange-50'
    },
    {
      icon: Archive,
      label: 'Download (ZIP)',
      onClick: () => {
        onDownloadZip(simulation.id);
        onClose();
      },
      show: true,
      className: 'text-indigo-700 hover:bg-indigo-50'
    },
    {
      icon: Trash2,
      label: 'Delete',
      onClick: () => {
        onDelete(simulation);
        onClose();
      },
      show: !isRunning,
      className: 'text-red-700 hover:bg-red-50'
    }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {menuItems.filter(item => item.show).map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={item.onClick}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors ${item.className}`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
