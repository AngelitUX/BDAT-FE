import { Play, Clock } from 'lucide-react';
import { useElapsedTime } from '../hooks/useElapsedTime';

/**
 * Componente para mostrar estadísticas de simulaciones en ejecución con tiempo
 */
export default function RunningStatsCard({ runningSimulations }) {
  const count = runningSimulations.length;
  
  // Obtener la simulación que lleva más tiempo ejecutándose
  const longestRunning = runningSimulations.reduce((longest, sim) => {
    if (!longest || !sim.start_datetime) return longest;
    if (!longest.start_datetime) return sim;
    
    const simStart = new Date(sim.start_datetime);
    const longestStart = new Date(longest.start_datetime);
    
    return simStart < longestStart ? sim : longest;
  }, null);

  // Tiempo transcurrido de la simulación más antigua
  const longestElapsedTime = useElapsedTime(
    longestRunning?.start_datetime, 
    longestRunning?.p_status === 'Running'
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-500 font-medium">Running</span>
        <span className="text-yellow-500">
          <Play className="w-5 h-5" />
        </span>
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{count}</span>
        
        {count > 0 && longestRunning && longestElapsedTime !== '00:00:00m' && (
          <div className="flex items-center gap-1 text-yellow-600">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-mono opacity-75">
              {longestElapsedTime}
            </span>
          </div>
        )}
      </div>
      
      {count > 0 && longestRunning && (
        <div className="text-xs text-gray-400 truncate">
          Longest: {longestRunning.sim_name}
        </div>
      )}
    </div>
  );
}
