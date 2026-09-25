import { Clock, Grid3x3, PlayCircle, StopCircle, XCircle, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { useElapsedTime, formatElapsedTime } from '../hooks/useElapsedTime';
import TimeTooltip from './TimeTooltip';

const getStatusInfo = (status) => {
  switch (status) {
    case 'Generating mesh':
      return {
        text: 'Generating mesh',
        color: 'text-gray-700',
        dotColor: 'bg-blue-400',
        icon: Grid3x3,
        pulse: true
      };
    case 'Not started':
      return {
        text: 'Not started',
        color: 'text-gray-700',
        dotColor: 'bg-gray-300',
        icon: Clock
      };
    case 'Processing':
      return {
        text: 'Processing',
        color: 'text-gray-700',
        dotColor: 'bg-indigo-400',
        icon: Clock,
        pulse: true
      };
    case 'Queued':
      return {
        text: 'Queued',
        color: 'text-gray-700',
        dotColor: 'bg-yellow-400',
        icon: Clock,
        pulse: false
      };
    case 'Running':
      return {
        text: 'Running',
        color: 'text-gray-700',
        dotColor: 'bg-amber-400',
        icon: PlayCircle,
        pulse: true
      };
    case 'Aborting':
      return {
        text: 'Aborting',
        color: 'text-gray-700',
        dotColor: 'bg-orange-400',
        icon: StopCircle,
        pulse: true
      };
    case 'Aborted':
      return {
        text: 'Aborted',
        color: 'text-gray-700',
        dotColor: 'bg-red-400',
        icon: XCircle
      };
    case 'Finished':
      return {
        text: 'Finished',
        color: 'text-gray-700',
        dotColor: 'bg-teal-300',
        icon: CheckCircle
      };
    case 'Error':
      return {
        text: 'Error',
        color: 'text-gray-700',
        dotColor: 'bg-red-400',
        icon: AlertCircle
      };
    case 'Mesh generation failed':
      return {
        text: 'Mesh failed',
        color: 'text-gray-700',
        dotColor: 'bg-red-400',
        icon: AlertCircle
      };
    default:
      return {
        text: 'Unknown',
        color: 'text-gray-500',
        dotColor: 'bg-gray-300',
        icon: HelpCircle
      };
  }
};

/**
 * Componente que muestra el estado de la simulación con tiempo transcurrido
 * @param {Object} props
 * @param {string} props.status - Estado de la simulación
 * @param {string} props.startDateTime - Fecha de inicio (ISO string)
 * @param {string} props.finishDateTime - Fecha de finalización (ISO string)
 * @param {boolean} props.showIcon - Si mostrar el ícono de reloj
 */
export default function StatusWithTime({
  status,
  startDateTime,
  finishDateTime,
  showIcon = true,
  queuePosition = null
}) {
  const statusInfo = getStatusInfo(status);
  const isRunning = status === 'Running';
  const isProcessing = status === 'Processing';
  const isFinished = status === 'Finished';
  const isError = status === 'Error';

  const isAborted = status === 'Aborted';

  // Para simulaciones en curso, usar tiempo en vivo (actualiza cada segundo)
  const liveElapsedTime = useElapsedTime(startDateTime, isRunning);

  // Para simulaciones terminadas, calcular tiempo total
  const totalTime = (isFinished || isError || isAborted) ? formatElapsedTime(startDateTime, finishDateTime) : null;

  // Determinar qué tiempo mostrar (solo para Running sin "in")
  const displayTime = isRunning ? liveElapsedTime : null;

  const StatusIcon = statusInfo.icon;

  return (
    <TimeTooltip
      startDateTime={startDateTime}
      finishDateTime={finishDateTime}
      status={status}
    >
      <div className="flex items-center gap-2 cursor-help">
        {/* Círculo de estado con animación pulse si aplica */}
        <div className={`
          w-2 h-2 rounded-full ${statusInfo.dotColor}
          ${statusInfo.pulse ? 'animate-pulse' : ''}
        `} />

        {/* Texto del estado */}
        <span className={`text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.text}
        </span>

        {/* Mostrar posición en cola si está encolada */}
        {status === 'Queued' && queuePosition && (
          <span className="text-xs font-medium text-yellow-600">
            #{queuePosition}
          </span>
        )}

        {/* Mostrar tiempo para Running (sin "in") */}
        {displayTime && (
          <span className="text-sm font-mono font-medium text-gray-500">
            {displayTime}
          </span>
        )}

        {/* Mostrar tiempo para Finished/Error/Aborted (con "in") */}
        {(isFinished || isError || isAborted) && totalTime && (
          <div className="flex items-center gap-1 text-gray-500">
            <span className="text-xs font-medium">in</span>
            <span className="text-sm font-mono font-medium">
              {totalTime}
            </span>
          </div>
        )}
      </div>
    </TimeTooltip>
  );
}
