import React, { useState, useEffect } from 'react';
import simulationService from './simulationService';

const QueueManager = () => {
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

  // Fetch queue status
  const fetchQueueStatus = async () => {
    try {
      setLoading(true);
      const status = await simulationService.getQueueStatus();
      setQueueStatus(status);
      setError(null);
    } catch (err) {
      setError('Error fetching queue status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Queue simulation with priority
  const handleQueueSimulation = async (simulationId, priority = 'NORMAL') => {
    try {
      const result = await simulationService.queueSimulation(simulationId, priority);
      if (result.success) {
        fetchQueueStatus(); // Refresh queue status
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error queuing simulation: ' + err.message);
    }
  };

  // Pause simulation
  const handlePauseSimulation = async (simulationId) => {
    try {
      const result = await simulationService.pauseSimulation(simulationId);
      if (result.success) {
        fetchQueueStatus();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error pausing simulation: ' + err.message);
    }
  };

  // Resume simulation
  const handleResumeSimulation = async (simulationId) => {
    try {
      const result = await simulationService.resumeSimulation(simulationId);
      if (result.success) {
        fetchQueueStatus();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error resuming simulation: ' + err.message);
    }
  };

  // Change priority
  const handleChangePriority = async (simulationId, newPriority) => {
    try {
      const result = await simulationService.changePriority(simulationId, newPriority);
      if (result.success) {
        fetchQueueStatus();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error changing priority: ' + err.message);
    }
  };

  // Remove from queue
  const handleRemoveFromQueue = async (simulationId) => {
    try {
      const result = await simulationService.removeFromQueue(simulationId);
      if (result.success) {
        fetchQueueStatus();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error removing from queue: ' + err.message);
    }
  };

  const getPriorityDotColor = (priority) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-400';
      case 'HIGH': return 'bg-orange-400';
      case 'NORMAL': return 'bg-blue-400';
      case 'LOW': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'Running': return 'bg-teal-300';
      case 'Paused': return 'bg-yellow-400';
      case 'Resuming': return 'bg-blue-400';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Queue Manager</h2>
          <button
            onClick={fetchQueueStatus}
            disabled={loading}
            className="px-4 py-2 bg-white border border-zinc-200 shadow-sm text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Queue Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{queueStatus.queue_size}</div>
            <div className="text-sm text-gray-600">In Queue</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{queueStatus.running_count}</div>
            <div className="text-sm text-gray-600">Running</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{queueStatus.paused_count}</div>
            <div className="text-sm text-gray-600">Paused</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{queueStatus.max_concurrent}</div>
            <div className="text-sm text-gray-600">Max Concurrent</div>
          </div>
        </div>

        {/* Queue Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Queue ({queueStatus.queue_size})</h3>
          {queueStatus.queue.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No simulations in queue</div>
          ) : (
            <div className="space-y-2">
              {queueStatus.queue.map((sim, index) => (
                <div key={sim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-gray-600">#{index + 1}</div>
                    <div>
                      <div className="font-medium">Simulation {sim.id}</div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(sim.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getPriorityDotColor(sim.priority)}`} />
                      <span className="text-sm font-medium text-gray-700">{sim.priority}</span>
                    </div>
                    <select
                      value={sim.priority}
                      onChange={(e) => handleChangePriority(sim.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <button
                      onClick={() => handleRemoveFromQueue(sim.id)}
                      className="px-2 py-1 bg-white border border-zinc-200 shadow-sm text-gray-700 text-xs rounded hover:bg-gray-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Running Simulations */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Running ({queueStatus.running_count})</h3>
          {queueStatus.running.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No simulations running</div>
          ) : (
            <div className="space-y-2">
              {queueStatus.running.map((sim) => (
                <div key={sim.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="font-medium">Simulation {sim.id}</div>
                      <div className="text-sm text-gray-500">
                        Started: {new Date(sim.start_time).toLocaleString()}
                      </div>
                      {sim.current_step && (
                        <div className="text-sm text-blue-600">Step: {sim.current_step}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusDotColor(sim.state)}`} />
                      <span className="text-sm font-medium text-gray-700">{sim.state}</span>
                    </div>
                    {sim.progress !== undefined && (
                      <div className="text-sm text-gray-600">{Math.round(sim.progress * 100)}%</div>
                    )}
                    <button
                      onClick={() => handlePauseSimulation(sim.id)}
                      className="px-2 py-1 bg-white border border-zinc-200 shadow-sm text-gray-700 text-xs rounded hover:bg-gray-100 transition-colors"
                    >
                      Pause
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paused Simulations */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Paused ({queueStatus.paused_count})</h3>
          {queueStatus.paused.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No paused simulations</div>
          ) : (
            <div className="space-y-2">
              {queueStatus.paused.map((sim) => (
                <div key={sim.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="font-medium">Simulation {sim.id}</div>
                      <div className="text-sm text-gray-500">
                        Started: {new Date(sim.start_time).toLocaleString()}
                      </div>
                      {sim.current_step && (
                        <div className="text-sm text-blue-600">Step: {sim.current_step}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusDotColor(sim.state)}`} />
                      <span className="text-sm font-medium text-gray-700">{sim.state}</span>
                    </div>
                    {sim.progress !== undefined && (
                      <div className="text-sm text-gray-600">{Math.round(sim.progress * 100)}%</div>
                    )}
                    <button
                      onClick={() => handleResumeSimulation(sim.id)}
                      className="px-2 py-1 bg-white border border-zinc-200 shadow-sm text-gray-700 text-xs rounded hover:bg-gray-100 transition-colors"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              const simId = prompt('Enter simulation ID to queue:');
              if (simId) handleQueueSimulation(parseInt(simId), 'NORMAL');
            }}
            className="px-4 py-2 bg-white border border-zinc-200 shadow-sm text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            Queue Simulation
          </button>
          <button
            onClick={() => {
              const simId = prompt('Enter simulation ID to queue with HIGH priority:');
              if (simId) handleQueueSimulation(parseInt(simId), 'HIGH');
            }}
            className="px-4 py-2 bg-white border border-zinc-200 shadow-sm text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            Queue High Priority
          </button>
          <button
            onClick={() => {
              const simId = prompt('Enter simulation ID to pause:');
              if (simId) handlePauseSimulation(parseInt(simId));
            }}
            className="px-4 py-2 bg-white border border-zinc-200 shadow-sm text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            Pause Simulation
          </button>
          <button
            onClick={() => {
              const simId = prompt('Enter simulation ID to resume:');
              if (simId) handleResumeSimulation(parseInt(simId));
            }}
            className="px-4 py-2 bg-white border border-zinc-200 shadow-sm text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            Resume Simulation
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueueManager;
