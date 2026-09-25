import React, { useState } from 'react';
import { Clock, Pause, SkipForward, Trash2, Loader, ChevronDown } from 'lucide-react';
import simulationService from './simulationService';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';

const QueueControls = ({ simulation, onStatusUpdate }) => {
    const toast = useToast();
    const { confirm } = useConfirm();
    const [isQueuing, setIsQueuing] = useState(false);
    const [isPausing, setIsPausing] = useState(false);
    const [isResuming, setIsResuming] = useState(false);
    const [isRemovingFromQueue, setIsRemovingFromQueue] = useState(false);
    const [isChangingPriority, setIsChangingPriority] = useState(false);
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);

    if (!simulation) return null;

    // Queue management functions
    const handleQueueSimulation = async (priority = 'NORMAL') => {
        setIsQueuing(true);
        try {
            const result = await simulationService.queueSimulation(simulation.id, priority);
            if (result.success) {
                console.log('✅ Simulation queued successfully');
                if (onStatusUpdate) onStatusUpdate();
            } else {
                alert(`Error queuing simulation: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error queuing simulation:', error);
            alert('Error queuing simulation. Please try again.');
        } finally {
            setIsQueuing(false);
        }
    };

    const handlePauseSimulation = async () => {
        setIsPausing(true);
        try {
            const result = await simulationService.pauseSimulation(simulation.id);
            if (result.success) {
                console.log('✅ Simulation paused successfully');
                if (onStatusUpdate) onStatusUpdate();
            } else {
                alert(`Error pausing simulation: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error pausing simulation:', error);
            alert('Error pausing simulation. Please try again.');
        } finally {
            setIsPausing(false);
        }
    };

    const handleResumeSimulation = async () => {
        setIsResuming(true);
        try {
            const result = await simulationService.resumeSimulation(simulation.id);
            if (result.success) {
                console.log('✅ Simulation resumed successfully');
                if (onStatusUpdate) onStatusUpdate();
            } else {
                alert(`Error resuming simulation: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error resuming simulation:', error);
            alert('Error resuming simulation. Please try again.');
        } finally {
            setIsResuming(false);
        }
    };

    const handleChangePriority = async (newPriority) => {
        setIsChangingPriority(true);
        try {
            const result = await simulationService.changePriority(simulation.id, newPriority);
            if (result.success) {
                console.log('✅ Priority changed successfully');
                if (onStatusUpdate) onStatusUpdate();
            } else {
                alert(`Error changing priority: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error changing priority:', error);
            alert('Error changing priority. Please try again.');
        } finally {
            setIsChangingPriority(false);
            setShowPriorityMenu(false);
        }
    };

    const handleRemoveFromQueue = async () => {
        const confirmed = await confirm({
            title: 'Remove from Queue',
            message: 'Are you sure you want to remove this simulation from the queue?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            type: 'warning'
        });

        if (!confirmed) return;

        setIsRemovingFromQueue(true);
        try {
            const result = await simulationService.removeFromQueue(simulation.id);
            if (result.success) {
                console.log('✅ Simulation removed from queue successfully');
                if (onStatusUpdate) onStatusUpdate();
            } else {
                alert(`Error removing from queue: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error removing from queue:', error);
            alert('Error removing from queue. Please try again.');
        } finally {
            setIsRemovingFromQueue(false);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'URGENT': return 'bg-red-500 hover:bg-red-600';
            case 'HIGH': return 'bg-orange-500 hover:bg-orange-600';
            case 'NORMAL': return 'bg-blue-500 hover:bg-blue-600';
            case 'LOW': return 'bg-gray-500 hover:bg-gray-600';
            default: return 'bg-blue-500 hover:bg-blue-600';
        }
    };

    // Determine which buttons to show based on simulation status
    const status = simulation.p_status;
    const showQueueButtons = status === 'Not started' || status === '0' || status === 0;
    const showPauseButton = status === 'Running' || status === '1' || status === 1;
    const showResumeButton = status === 'Paused';
    const showQueuedButtons = status === 'Queued';

    return (
        <div className="flex flex-col gap-2">
            {/* Queue buttons for Not started simulations */}
            {showQueueButtons && (
                <div className="flex flex-col gap-2">
                    <div className="text-xs text-gray-600 font-medium">Queue Options:</div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => handleQueueSimulation('NORMAL')}
                            disabled={isQueuing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isQueuing ? <Loader className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                            Queue Normal
                        </button>
                        <button
                            onClick={() => handleQueueSimulation('HIGH')}
                            disabled={isQueuing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isQueuing ? <Loader className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                            Queue High
                        </button>
                        <button
                            onClick={() => handleQueueSimulation('URGENT')}
                            disabled={isQueuing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isQueuing ? <Loader className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                            Queue Urgent
                        </button>
                    </div>
                </div>
            )}

            {/* Pause button for Running simulations */}
            {showPauseButton && (
                <button
                    onClick={handlePauseSimulation}
                    disabled={isPausing}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPausing ? <Loader className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                    {isPausing ? 'Pausing...' : 'Pause Simulation'}
                </button>
            )}

            {/* Resume button for Paused simulations */}
            {showResumeButton && (
                <button
                    onClick={handleResumeSimulation}
                    disabled={isResuming}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isResuming ? <Loader className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                    {isResuming ? 'Resuming...' : 'Resume Simulation'}
                </button>
            )}

            {/* Queue management buttons for Queued simulations */}
            {showQueuedButtons && (
                <div className="flex flex-col gap-2">
                    <div className="text-xs text-gray-600 font-medium">Queue Management:</div>
                    <div className="flex gap-2 flex-wrap">
                        {/* Priority change dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                                disabled={isChangingPriority}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isChangingPriority ? <Loader className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                                Change Priority
                            </button>
                            
                            {showPriorityMenu && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
                                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => (
                                        <button
                                            key={priority}
                                            onClick={() => handleChangePriority(priority)}
                                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                                        >
                                            {priority}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleRemoveFromQueue}
                            disabled={isRemovingFromQueue}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRemovingFromQueue ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Remove from Queue
                        </button>
                    </div>
                </div>
            )}

            {/* Status indicators */}
            {status === 'Queued' && (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    📋 In queue - waiting for execution
                </div>
            )}
            {status === 'Paused' && (
                <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                    ⏸️ Simulation paused
                </div>
            )}
        </div>
    );
};

export default QueueControls;
