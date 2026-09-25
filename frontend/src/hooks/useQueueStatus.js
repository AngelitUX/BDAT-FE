import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import simulationService from '../features/simulations/simulationService';

const useQueueStatus = (autoRefresh = true, refreshInterval = 5000) => {
    const [queueStatus, setQueueStatus] = useState({
        queue: [],
        running: [],
        paused: [],
        queue_size: 0,
        running_count: 0,
        paused_count: 0,
        max_concurrent: 2,
        can_start_new: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [socket, setSocket] = useState(null);

    // Fetch queue status from API
    const fetchQueueStatus = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const status = await simulationService.getQueueStatus();
            setQueueStatus(status);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching queue status:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initialize WebSocket connection
    useEffect(() => {
        const socketConnection = io("http://localhost:5000", {
            transports: ["websocket"],
        });

        socketConnection.on("connect", () => {
            setSocket(socketConnection);
        });

        socketConnection.on("disconnect", () => {
            setSocket(null);
        });

        // Listen for queue updates
        socketConnection.on('simulation_queue_update', (data) => {
            fetchQueueStatus(); // Refresh queue status
        });

        // Listen for status updates that might affect queue
        socketConnection.on('simulation_status_update', (data) => {
            // Only refresh if it's a status that affects queue
            const queueAffectingStatuses = ['Queued', 'Running', 'Paused', 'Finished', 'Aborted', 'Error'];
            if (queueAffectingStatuses.includes(data.state)) {
                fetchQueueStatus();
            }
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [fetchQueueStatus]);

    // Auto-refresh functionality
    useEffect(() => {
        if (!autoRefresh) return;

        // Initial fetch
        fetchQueueStatus();

        // Set up interval for periodic refresh
        const interval = setInterval(fetchQueueStatus, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchQueueStatus]);

    // Queue management functions
    const queueSimulation = useCallback(async (simulationId, priority = 'NORMAL', estimatedDuration = null) => {
        try {
            const result = await simulationService.queueSimulation(simulationId, priority, estimatedDuration);
            if (result.success) {
                await fetchQueueStatus(); // Refresh immediately
                return { success: true, data: result.data };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [fetchQueueStatus]);

    const pauseSimulation = useCallback(async (simulationId) => {
        try {
            const result = await simulationService.pauseSimulation(simulationId);
            if (result.success) {
                await fetchQueueStatus();
                return { success: true, data: result.data };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [fetchQueueStatus]);

    const resumeSimulation = useCallback(async (simulationId) => {
        try {
            const result = await simulationService.resumeSimulation(simulationId);
            if (result.success) {
                await fetchQueueStatus();
                return { success: true, data: result.data };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [fetchQueueStatus]);

    const changePriority = useCallback(async (simulationId, newPriority) => {
        try {
            const result = await simulationService.changePriority(simulationId, newPriority);
            if (result.success) {
                await fetchQueueStatus();
                return { success: true, data: result.data };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [fetchQueueStatus]);

    const removeFromQueue = useCallback(async (simulationId) => {
        try {
            const result = await simulationService.removeFromQueue(simulationId);
            if (result.success) {
                await fetchQueueStatus();
                return { success: true, data: result.data };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [fetchQueueStatus]);

    // Utility functions
    const getQueuePosition = useCallback((simulationId) => {
        const position = queueStatus.queue.findIndex(sim => sim.id === simulationId);
        return position >= 0 ? position + 1 : null;
    }, [queueStatus.queue]);

    const isSimulationInQueue = useCallback((simulationId) => {
        return queueStatus.queue.some(sim => sim.id === simulationId);
    }, [queueStatus.queue]);

    const isSimulationRunning = useCallback((simulationId) => {
        return queueStatus.running.some(sim => sim.id === simulationId);
    }, [queueStatus.running]);

    const isSimulationPaused = useCallback((simulationId) => {
        return queueStatus.paused.some(sim => sim.id === simulationId);
    }, [queueStatus.paused]);

    const getEstimatedWaitTime = useCallback((simulationId) => {
        const position = getQueuePosition(simulationId);
        if (!position) return null;

        // Simple estimation based on average simulation time and queue position
        const averageSimulationTime = 300; // 5 minutes in seconds
        const estimatedSeconds = (position - 1) * averageSimulationTime;
        
        if (estimatedSeconds < 60) {
            return `${estimatedSeconds}s`;
        } else if (estimatedSeconds < 3600) {
            return `${Math.round(estimatedSeconds / 60)}m`;
        } else {
            return `${Math.round(estimatedSeconds / 3600)}h`;
        }
    }, [getQueuePosition]);

    return {
        // State
        queueStatus,
        loading,
        error,
        socket,

        // Actions
        fetchQueueStatus,
        queueSimulation,
        pauseSimulation,
        resumeSimulation,
        changePriority,
        removeFromQueue,

        // Utilities
        getQueuePosition,
        isSimulationInQueue,
        isSimulationRunning,
        isSimulationPaused,
        getEstimatedWaitTime,
    };
};

export default useQueueStatus;
