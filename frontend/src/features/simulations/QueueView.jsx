import React, { useState, useEffect } from 'react';
import { X, GripVertical, Trash2, Clock, ArrowUp, ArrowDown, RefreshCw, Hash, Layers } from 'lucide-react';
import { io } from 'socket.io-client';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';

const API = "http://localhost:5000/";

const QueueView = ({ isOpen, onClose }) => {
    const toast = useToast();
    const { confirm } = useConfirm();
    const [queuedSimulations, setQueuedSimulations] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverItem, setDragOverItem] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchQueuedSimulations = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}simulations`);
            const data = await res.json();
            const queued = data
                .filter(sim => sim.p_status === 'Queued')
                .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));
            setQueuedSimulations(queued);
        } catch (error) {
            console.error('Error fetching queued simulations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchQueuedSimulations();
        const socket = io(API);
        socket.on('estado_simulacion', (data) => {
            const simId = Number(data.id);
            const updateData = data.update_data || {};
            if (data.estado === 'Queued' || updateData.p_status === 'Queued') {
                setQueuedSimulations(prev => {
                    const exists = prev.find(sim => sim.id === simId);
                    if (exists) {
                        return prev.map(sim =>
                            sim.id === simId
                                ? { ...sim, ...updateData, queue_position: updateData.queue_position }
                                : sim
                        ).sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));
                    } else {
                        fetchQueuedSimulations();
                        return prev;
                    }
                });
            } else if (data.estado === 'Running' || data.estado === 'Not started') {
                setQueuedSimulations(prev => prev.filter(sim => sim.id !== simId));
            }
        });
        return () => socket.disconnect();
    }, [isOpen]);

    const handleDequeue = async (simId) => {
        const confirmed = await confirm({
            title: 'Remove from Queue',
            message: `Remove simulation ${simId} from queue?`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            type: 'warning'
        });
        if (!confirmed) return;
        try {
            const res = await fetch(`${API}simulations/${simId}/dequeue`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.message) {
                fetchQueuedSimulations();
                toast.success('Simulation removed from queue');
            } else {
                toast.error('Error: ' + (data.error || data.message || 'Unknown error'));
            }
        } catch (error) {
            toast.error('Error removing from queue: ' + error.message);
        }
    };

    const handleMoveUp = async (index) => {
        if (index === 0) return;
        const newQueue = [...queuedSimulations];
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
        setQueuedSimulations(newQueue);
        await saveQueueOrder(newQueue);
    };

    const handleMoveDown = async (index) => {
        if (index === queuedSimulations.length - 1) return;
        const newQueue = [...queuedSimulations];
        [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
        setQueuedSimulations(newQueue);
        await saveQueueOrder(newQueue);
    };

    const saveQueueOrder = async (queue) => {
        const ordered_ids = queue.map(sim => sim.id);
        try {
            const res = await fetch(`${API}simulations/queue/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordered_ids })
            });
            const data = await res.json();
            if (data.status !== 'success') {
                fetchQueuedSimulations();
            }
        } catch (error) {
            fetchQueuedSimulations();
        }
    };

    const handleDragStart = (e, index) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        setDragOverItem(index);
        if (draggedItem === null || draggedItem === index) return;
        const newQueue = [...queuedSimulations];
        const draggedSim = newQueue[draggedItem];
        newQueue.splice(draggedItem, 1);
        newQueue.splice(index, 0, draggedSim);
        setQueuedSimulations(newQueue);
        setDraggedItem(index);
    };

    const handleDragEnd = async () => {
        setDraggedItem(null);
        setDragOverItem(null);
        const ordered_ids = queuedSimulations.map(sim => sim.id);
        try {
            const res = await fetch(`${API}simulations/queue/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordered_ids })
            });
            const data = await res.json();
            if (data.status !== 'success') fetchQueuedSimulations();
        } catch (error) {
            fetchQueuedSimulations();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-scale-in border border-gray-100">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 leading-tight">Queue Manager</h2>
                            <p className="text-[11px] text-gray-400">
                                {queuedSimulations.length} simulation{queuedSimulations.length !== 1 ? 's' : ''} waiting
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={fetchQueuedSimulations}
                            disabled={loading}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* ── Column headers ── */}
                {queuedSimulations.length > 0 && (
                    <div className="grid px-3 py-1.5 border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                        style={{ gridTemplateColumns: '28px 36px 1fr 52px 52px 52px 52px 52px 56px 72px' }}>
                        <div /> {/* grip */}
                        <div className="text-center">#</div>
                        <div>Name / ID</div>
                        <div className="text-center">Tx</div>
                        <div className="text-center">Rx</div>
                        <div className="text-center">Dist.</div>
                        <div className="text-center">Thick.</div>
                        <div className="text-center">Poro.</div>
                        <div className="text-center">Mesh</div>
                        <div className="text-center">Actions</div>
                    </div>
                )}

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto">
                    {queuedSimulations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                            <Clock className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm font-medium text-gray-400">No simulations in queue</p>
                            <p className="text-xs text-gray-300 mt-0.5">Simulations appear here when queued</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {queuedSimulations.map((sim, index) => (
                                <div
                                    key={sim.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`
                                        grid items-center transition-all duration-150 px-3 py-1.5
                                        ${draggedItem === index
                                            ? 'bg-gray-100 opacity-60 border-l-2 border-gray-400'
                                            : 'bg-white hover:bg-gray-50 border-l-2 border-transparent'
                                        }
                                        cursor-move group
                                    `}
                                    style={{ gridTemplateColumns: '28px 36px 1fr 52px 52px 52px 52px 52px 56px 72px' }}
                                >
                                    {/* Drag Handle */}
                                    <div className="flex items-center justify-center">
                                        <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
                                    </div>

                                    {/* Position */}
                                    <div className="flex items-center justify-center">
                                        <span className="text-[11px] font-bold text-gray-500 w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                                            {sim.queue_position || (index + 1)}
                                        </span>
                                    </div>

                                    {/* Name + ID */}
                                    <div className="min-w-0 pr-2">
                                        <div className="font-semibold text-xs text-gray-800 truncate leading-tight" title={sim.sim_name}>
                                            {sim.sim_name || `Simulation ${sim.id}`}
                                        </div>
                                        <div className="text-[10px] text-gray-400 leading-tight">
                                            ID {sim.id}
                                        </div>
                                    </div>

                                    {/* Tx */}
                                    <div className="text-center text-xs text-gray-600 font-medium">{sim.n_transmitter}</div>

                                    {/* Rx */}
                                    <div className="text-center text-xs text-gray-600 font-medium">{sim.n_receiver}</div>

                                    {/* Distance */}
                                    <div className="text-center text-xs text-gray-500">{sim.sensor_distance}</div>

                                    {/* Thickness */}
                                    <div className="text-center text-xs text-gray-500">{sim.plate_thickness}</div>

                                    {/* Porosity */}
                                    <div className="text-center text-xs text-gray-500">{sim.porosity}%</div>

                                    {/* Mesh size */}
                                    <div className="text-center text-xs text-gray-500">{sim.typical_mesh_size}</div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-center gap-0.5">
                                        <button
                                            onClick={() => handleMoveUp(index)}
                                            disabled={index === 0}
                                            className={`p-1 rounded transition-colors ${index === 0
                                                ? 'text-gray-200 cursor-not-allowed'
                                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                                                }`}
                                            title="Move up"
                                        >
                                            <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(index)}
                                            disabled={index === queuedSimulations.length - 1}
                                            className={`p-1 rounded transition-colors ${index === queuedSimulations.length - 1
                                                ? 'text-gray-200 cursor-not-allowed'
                                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                                                }`}
                                            title="Move down"
                                        >
                                            <ArrowDown className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDequeue(sim.id)}
                                            className="p-1 rounded text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                            title="Remove from queue"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">
                            <GripVertical className="w-3 h-3" /> Drag to reorder
                        </span>
                        <span className="flex items-center gap-1">
                            <ArrowUp className="w-3 h-3" />
                            <ArrowDown className="w-3 h-3" /> Move
                        </span>
                        <span className="flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Dequeue
                        </span>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                        {queuedSimulations.length} in queue
                    </span>
                </div>
            </div>
        </div>
    );
};

export default QueueView;
