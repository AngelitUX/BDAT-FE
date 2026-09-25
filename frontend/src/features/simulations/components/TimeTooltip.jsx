import { useState } from 'react';
import { formatElapsedTime } from '../hooks/useElapsedTime';

/**
 * Componente tooltip que muestra información detallada de tiempo
 */
export default function TimeTooltip({ 
  children, 
  startDateTime, 
  finishDateTime, 
  status 
}) {
  const [isVisible, setIsVisible] = useState(false);

  const formatDateTime = (dateTime) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const totalTime = formatElapsedTime(startDateTime, finishDateTime);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (startDateTime || finishDateTime) && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg min-w-max">
            <div className="space-y-1">
              {startDateTime && (
                <div>
                  <span className="text-gray-300">Started:</span>
                  <span className="ml-2 font-mono">{formatDateTime(startDateTime)}</span>
                </div>
              )}
              
              {finishDateTime && (
                <div>
                  <span className="text-gray-300">Finished:</span>
                  <span className="ml-2 font-mono">{formatDateTime(finishDateTime)}</span>
                </div>
              )}
              
              {status === 'Finished' && totalTime !== '--:--' && (
                <div className="border-t border-gray-700 pt-1 mt-1">
                  <span className="text-gray-300">Total time:</span>
                  <span className="ml-2 font-mono font-semibold">{totalTime}</span>
                </div>
              )}
            </div>
            
            {/* Flecha del tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
