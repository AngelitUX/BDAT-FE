import React, { useEffect, useMemo, useRef, useState } from 'react';
import Table from './Table';
import SimulationModal from './SimulationModal';
import QueueView from './QueueView';
import BatchImportModal from './BatchImportModal';
import ImportMeshModal from './components/ImportMeshModal';
import SimulationControlBar from './components/SimulationControlBar';
import DownloadTypeModal from './components/DownloadTypeModal';
import { Plus, Clock, Upload, ArrowRight, Loader2, XCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import simulationService from './simulationService';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';

const API = "http://localhost:5000/";
const ROW_HEIGHT = 56;

// 🔔 Función para reproducir sonido de notificación
const playNotificationSound = () => {
    try {
        // Crear un contexto de audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Crear un oscilador para generar el tono
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Conectar oscilador -> ganancia -> salida
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Configurar el sonido (tono agradable de notificación)
        oscillator.type = 'sine'; // Onda sinusoidal suave
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frecuencia inicial (800 Hz)
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1); // Bajar a 600 Hz

        // Configurar volumen con fade out
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Volumen inicial
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); // Fade out

        // Reproducir sonido
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3); // Duración de 300ms
    } catch (error) {
        // Error al reproducir sonido
    }
};






const Simulations = () => {
    const location = useLocation();
    const toast = useToast();
    const { confirm } = useConfirm();
    const [selectedSimulation, setSelectedSimulation] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('view');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(7);
    const [simulations, setSimulations] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [isQueueViewOpen, setIsQueueViewOpen] = useState(false);
    const [searchFilters, setSearchFilters] = useState(null);
    const [editingSimulationId, setEditingSimulationId] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportMeshModalOpen, setIsImportMeshModalOpen] = useState(false);
    const [isBatchCreating, setIsBatchCreating] = useState(false);
    // Ref kept in sync with isBatchCreating so the WebSocket handler (created
    // once on mount) can read current running state without a stale closure.
    const isBatchCreatingRef = useRef(false);
    // Backend-driven import status: { active, total, current_index, current_name }
    const [importStatusFromBackend, setImportStatusFromBackend] = useState(null);
    // Control bar state
    const [isRunningBatch, setIsRunningBatch] = useState(false);
    const [quickStatusFilter, setQuickStatusFilter] = useState(null);
    const [isRunningAll, setIsRunningAll] = useState(false);
    const [isStoppingAll, setIsStoppingAll] = useState(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
    const [isAbortingIndividual, setIsAbortingIndividual] = useState(false);
    const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);
    const [showPageTransition, setShowPageTransition] = useState(() => Boolean(location.state?.showTransition));

    // Progress tracking: { [simId]: { percentage, current_step, total_steps, current_source, total_sources } }
    const [simulationProgress, setSimulationProgress] = useState({});

    // Download modal state
    const [downloadModalState, setDownloadModalState] = useState({ isOpen: false, type: null, ids: [] });

    const tableContainerRef = useRef(null);
    const batchImportAbortRef = useRef(null);
    const meshWaitersRef = useRef(new Map());
    // True when we detected a stale import session on page load.
    // Note: Since batch imports now run entirely in a Celery worker, 
    // a page reload does NOT interrupt the import.
    const [importWasInterrupted, setImportWasInterrupted] = useState(false);

    // Responsive pageSize calculation
    useEffect(() => {
        const calculatePageSize = () => {
            if (tableContainerRef.current) {
                const containerHeight = tableContainerRef.current.clientHeight;
                // Header (48px) + Padding Bottom (24px)
                const availableHeight = containerHeight - 48 - 24;
                // Approx 50px per row
                const newPageSize = Math.max(3, Math.floor(availableHeight / 50));
                setPageSize(newPageSize);
            }
        };

        const timer = setTimeout(calculatePageSize, 100);
        window.addEventListener('resize', calculatePageSize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calculatePageSize);
        };
    }, []);

    // Keep isBatchCreatingRef in sync with state
    useEffect(() => { isBatchCreatingRef.current = isBatchCreating; }, [isBatchCreating]);

    // ─── On mount: query backend for current import status ─────────────────
    useEffect(() => {
        simulationService.getImportStatus().then(status => {
            if (status && status.active) {
                // The import loop now runs in a backend Celery task.
                // If we arrive here after a reload, the worker is still actively 
                // generating simulations. Just resume the UI state.
                setIsBatchCreating(true);
                setIsImportModalOpen(true);
                setImportStatusFromBackend(status);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchSimulations = async () => {
        try {
            const res = await fetch(`${API}simulations`);
            if (!res.ok) {
                throw new Error(`Failed to fetch simulations (HTTP ${res.status})`);
            }
            const data = await res.json();
            setSimulations(data);
        } catch (err) {
            toast.error('No se pudieron cargar las simulaciones');
        } finally {
            setHasFetchedInitialData(true);
        }
    };

    useEffect(() => {
        fetchSimulations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sincronización pasiva de seguridad: si hay simulaciones activas (Running o Queued),
    // consultar cada 5s como salvaguarda ante pérdidas de WebSocket o reconexiones de pestaña.
    useEffect(() => {
        const hasActive = simulations.some(s => s.p_status === 'Running' || s.p_status === 'Queued');
        if (!hasActive) return;

        const interval = setInterval(() => {
            fetchSimulations();
        }, 5000);

        return () => clearInterval(interval);
    }, [simulations]);

    useEffect(() => {
        if (!showPageTransition || !hasFetchedInitialData) return;
        const timer = setTimeout(() => setShowPageTransition(false), 900);
        return () => clearTimeout(timer);
    }, [showPageTransition, hasFetchedInitialData]);


    useEffect(() => {
        // Default transports (polling → websocket upgrade).
        // Using ['websocket'] only would skip polling fallback and silently fail
        // in Docker/proxy environments where the WS upgrade handshake requires
        // the initial HTTP connection first.
        const socket = io(API);

        // 🔄 Actualización de estado de simulación
        socket.on('estado_simulacion', (data) => {
            const simId = Number(data.id);
            const updateData = data.update_data || { p_status: data.estado };

            // 🔔 Reproducir sonido cuando una simulación finaliza
            if (data.estado === 'Finished') {
                playNotificationSound();
            }

            // Clear progress tracking when simulation leaves Running state
            const terminalStates = ['Finished', 'Error', 'Aborted', 'Not started', 'Aborting'];
            if (terminalStates.includes(data.estado)) {
                setSimulationProgress(prev => {
                    const next = { ...prev };
                    delete next[simId];
                    return next;
                });
            }

            setSimulations(prev =>
                prev.map(sim =>
                    sim.id === simId
                        ? { ...sim, ...updateData }
                        : sim
                )
            );

            setSelectedSimulation(prev =>
                prev && prev.id === simId
                    ? { ...prev, ...updateData }
                    : prev
            );

            setEditingSimulationId(prev => prev === simId ? null : prev);
        });

        // Nuevas simulaciones
        socket.on('nueva_simulacion', (newSim) => {
            setSimulations(prev => prev.some(s => s.id === newSim.id) ? prev : [newSim, ...prev]);
        });

        // Mesh listo
        socket.on('mesh_ready', (data) => {
            console.log('✅ Mesh ready event received:', data);
            const waiter = meshWaitersRef.current.get(data.id);
            if (waiter) {
                meshWaitersRef.current.delete(data.id);
                waiter.resolve(data);
            }
            const updatedData = data.simulation || { xml_file: data.xml_file, msh_file: data.msh_file, p_status: data.p_status };
            setSimulations(prev => prev.map(sim =>
                sim.id === data.id ? { ...sim, ...updatedData } : sim
            ));
            setSelectedSimulation(prev =>
                prev && prev.id === data.id ? { ...prev, ...updatedData } : prev
            );
        });

        // Error de mesh
        socket.on('mesh_error', (data) => {
            console.error('❌ Error generando mesh:', data);
            const waiter = meshWaitersRef.current.get(data.id);
            if (waiter) {
                meshWaitersRef.current.delete(data.id);
                waiter.reject(data);
            }
            setSimulations(prev => prev.map(sim =>
                sim.id === data.id ? { ...sim, p_status: 'Mesh generation failed' } : sim
            ));
            setSelectedSimulation(prev =>
                prev && prev.id === data.id ? { ...prev, p_status: 'Mesh generation failed' } : prev
            );
        });

        // 📦 Import status driven by backend
        socket.on('import_status', (data) => {
            console.log('📦 import_status event:', data);
            setImportStatusFromBackend(data);
            if (data.active) {
                // Import is running — keep overlay open
                setIsBatchCreating(true);
                setIsImportModalOpen(true);
            } else {
                // Import finished or was cancelled — tear everything down
                const wasRunning = isBatchCreatingRef.current;
                setIsBatchCreating(false);
                // We keep the modal open so it can show the "Done" or "Cancelled" state.
                // The modal has its own auto-close timer and Close button.
                setImportWasInterrupted(false);
                // We intentionally keep importStatusFromBackend so the final overlay can read data.processed
                isBatchCreatingRef.current = false;

                if (wasRunning) {
                    const count = data.processed ?? data.current_index ?? 0;
                    const total = data.total ?? 0;
                    if (count > 0) {
                        toast.success(`Batch import completed: ${count} of ${total} simulations created`);
                    } else {
                        toast.info('Batch import stopped');
                    }
                }
            }
        });

        // 📊 Simulation progress tracking
        socket.on('simulation_progress', (data) => {
            const simId = Number(data.id);
            setSimulationProgress(prev => ({
                ...prev,
                [simId]: {
                    percentage: data.percentage,
                    current_step: data.current_step,
                    total_steps: data.total_steps,
                    current_source: data.current_source,
                    total_sources: data.total_sources,
                }
            }));
        });

        return () => socket.disconnect();
    }, []);



    const waitForMesh = (simId, timeoutMs = 10 * 60 * 1000) => {
        if (!simId) return Promise.reject(new Error('Missing simId'));
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                meshWaitersRef.current.delete(simId);
                reject(new Error('Mesh generation timeout'));
            }, timeoutMs);

            meshWaitersRef.current.set(simId, {
                resolve: (data) => {
                    clearTimeout(timeoutId);
                    resolve(data);
                },
                reject: (err) => {
                    clearTimeout(timeoutId);
                    reject(err);
                },
            });
        });
    };

    const deleteSimulationById = async (simId) => {
        if (!simId) return;
        await simulationService.deleteSimulation(simId);
    };


    // 🔹 Ajuste dinámico del tamaño de página
    useEffect(() => {
        function updatePageSize() {
            if (tableContainerRef.current) {
                const height = tableContainerRef.current.offsetHeight;
                const headerHeight = 48;
                const available = height - headerHeight;
                const rows = Math.max(1, Math.floor(available / ROW_HEIGHT));
                setPageSize(rows);
            }
        }
        updatePageSize();
        window.addEventListener('resize', updatePageSize);
        return () => window.removeEventListener('resize', updatePageSize);
    }, []);

    // 🔹 Helper function to check if any filters are active
    const hasActiveFilters = () => {
        if (!searchFilters) return false;
        return searchFilters?.searchTerm ||
            searchFilters?.status !== 'all' ||
            searchFilters?.attenuation !== 'all' ||
            searchFilters?.meshType !== 'all' ||
            searchFilters?.porosityMin ||
            searchFilters?.porosityMax ||
            searchFilters?.dateFrom ||
            searchFilters?.dateTo ||
            searchFilters?.skinConfig !== 'all';
    };

    // 🔹 Filter simulations based on search criteria + quick status filter
    const filteredSimulations = useMemo(() => {
        let base = simulations;

        // Quick filter from SimulationControlBar
        if (quickStatusFilter) {
            base = base.filter(sim => sim.p_status === quickStatusFilter);
        }

        if (!searchFilters) return base;

        return base.filter(sim => {
            // Search term filter
            if (searchFilters?.searchTerm) {
                const term = searchFilters.searchTerm.toLowerCase();
                const matchesName = sim.sim_name?.toLowerCase().includes(term);
                const matchesId = sim.id?.toString().includes(term);
                const matchesCode = sim.code?.toLowerCase().includes(term);
                if (!matchesName && !matchesId && !matchesCode) return false;
            }

            // Status filter
            if (searchFilters?.status !== 'all' && sim.p_status !== searchFilters?.status) {
                return false;
            }

            // Attenuation filter
            if (searchFilters?.attenuation !== 'all') {
                const simAttenuation = sim.attenuation?.toString();
                if (simAttenuation !== searchFilters?.attenuation) return false;
            }

            // Mesh type filter
            if (searchFilters?.meshType !== 'all' && sim.mesh_type !== searchFilters?.meshType) {
                return false;
            }

            // Skin configuration filter
            if (searchFilters?.skinConfig !== 'all' && sim.skin_layer_config !== searchFilters?.skinConfig) {
                return false;
            }

            // Porosity range filter
            if (searchFilters?.porosityMin && sim.porosity < Number(searchFilters.porosityMin)) {
                return false;
            }
            if (searchFilters?.porosityMax && sim.porosity > Number(searchFilters.porosityMax)) {
                return false;
            }

            // Date range filter
            if (searchFilters?.dateFrom || searchFilters?.dateTo) {
                const simDate = sim.start_datetime ? new Date(sim.start_datetime) : null;
                if (simDate) {
                    if (searchFilters?.dateFrom && simDate < new Date(searchFilters.dateFrom)) {
                        return false;
                    }
                    if (searchFilters?.dateTo && simDate > new Date(searchFilters.dateTo + 'T23:59:59')) {
                        return false;
                    }
                }
            }

            return true;
        });
    }, [simulations, searchFilters, quickStatusFilter]);

    // 🔹 Recalcular automáticamente los elementos visibles cuando cambian dependencias
    const totalPages = Math.max(1, Math.ceil(filteredSimulations.length / pageSize));
    const paginatedSimulations = useMemo(() => {
        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        return filteredSimulations.slice(startIdx, endIdx);
    }, [filteredSimulations, currentPage, pageSize]);


    // 🔹 Detectar simulaciones activas (Running) - SIEMPRE busca en TODAS las simulaciones
    // 'Processing' es un estado optimista local; no se muestra en la tarjeta de "Running now"
    const activeSimulations = useMemo(() => {
        return simulations
            .map((sim, index) => ({
                ...sim,
                globalIndex: index,
                page: Math.floor(filteredSimulations.findIndex(s => s.id === sim.id) / pageSize) + 1
            }))
            .filter(sim => sim.p_status === 'Running');
    }, [simulations, filteredSimulations, pageSize]);

    // 🔹 Detectar simulaciones en cola
    const queuedSimulations = useMemo(() => {
        return simulations.filter(sim => sim.p_status === 'Queued');
    }, [simulations]);

    // 🔹 Verificar si hay simulaciones activas en la página actual
    const activeSimsInCurrentPage = activeSimulations.filter(sim => sim.page === currentPage);
    const activeSimsInOtherPages = activeSimulations.filter(sim => sim.page !== currentPage);

    // 🔹 Función para ir a la página de una simulación activa
    const goToActivePage = (page) => {
        setCurrentPage(page);
    };

    // 🔹 Handlers
    const handleView = (simulation) => {
        setSelectedSimulation(simulation);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleNewSimulation = () => {
        setSelectedSimulation(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSimulation(null);
        // NO limpiar editingSimulationId aquí - dejar que se limpie cuando termine de guardar
    };

    const handleCreateSimulation = async (newSimData) => {
        try {
            const result = await simulationService.createSimulation(newSimData);
        } catch (error) {
            toast.error('No se pudo crear la simulación');
        }
    };

    const handleBatchImport = async (simData) => {
        // Lanza excepción si falla (el modal captura el error)
        if (!batchImportAbortRef.current) {
            batchImportAbortRef.current = new AbortController();
        }
        const result = await simulationService.createSimulation(simData, {
            signal: batchImportAbortRef.current.signal,
        });
        return result;
    };

    const handleCancelBatchImportRequest = () => {
        try {
            batchImportAbortRef.current?.abort();
        } catch (e) {
        }
        batchImportAbortRef.current = new AbortController();
    };

    const handleExecuteSimulation = async (simulationId, simulationData) => {
        if (isBatchCreating) {
            toast.error('No puedes ejecutar simulaciones mientras el batch import está en progreso');
            return;
        }
        // Actualización optimista: mostrar 'Processing' mientras se contacta el backend
        setSimulations(prev =>
            prev.map(sim =>
                sim.id === simulationId ? { ...sim, p_status: 'Processing' } : sim
            )
        );
        setSelectedSimulation(prev =>
            prev && prev.id === simulationId
                ? { ...prev, p_status: 'Processing' }
                : prev
        );

        try {
            // executeSimulation ahora lanza excepción si el backend responde con error
            await simulationService.executeSimulation(simulationId, simulationData);
            // Si llegó aquí: el backend aceptó la solicitud (202). El estado real
            // llegará vía WebSocket (Running → Finished/Error/Aborted).
        } catch (error) {
            // Revertir el estado optimista si el backend rechazó la solicitud
            console.error('❌ Error al ejecutar simulación:', error.message);
            toast.error(`Error al ejecutar simulación: ${error.message}`);
            setSimulations(prev =>
                prev.map(sim =>
                    sim.id === simulationId ? { ...sim, p_status: simulationData.p_status || 'Not started' } : sim
                )
            );
            setSelectedSimulation(prev =>
                prev && prev.id === simulationId
                    ? { ...prev, p_status: simulationData.p_status || 'Not started' }
                    : prev
            );
        }
    };

    const handlePrevPage = () => setCurrentPage(p => Math.max(p - 1, 1));
    const handleNextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages));

    const handleSearch = (filters) => {
        setSearchFilters(filters);
        setQuickStatusFilter(null); // clear quick filter when advanced search is used
        setCurrentPage(1);
    };

    const handleClearSearch = () => {
        setSearchFilters(null);
        setCurrentPage(1);
    };

    const handleDeleteSimulation = async (simulation) => {
        const confirmed = await confirm({
            title: 'Delete Simulation',
            message: `Are you sure you want to delete "${simulation.sim_name}"?\n\nThis action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            await fetch(`${API}simulations/${simulation.id}`, { method: 'DELETE' });
            setSimulations(prev => prev.filter(s => s.id !== simulation.id));
            if (isModalOpen) handleCloseModal();
            toast.success(`Simulation "${simulation.sim_name}" deleted`);
        } catch (error) {
            toast.error('Error deleting simulation.');
        }
    };

    const handleDeleteAllSimulations = async () => {
        const eligibleToDelete = simulations.filter(s => s.p_status !== 'Running');
        if (eligibleToDelete.length === 0) {
            toast.info('No hay simulaciones elegibles para eliminar (las activas están protegidas)');
            return;
        }

        const isPreserving = simulations.length !== eligibleToDelete.length;

        const confirmed = await confirm({
            title: 'Delete All Simulations',
            message: isPreserving
                ? `Se eliminarán ${eligibleToDelete.length} simulaciones. Las simulaciones en ejecución (${simulations.length - eligibleToDelete.length}) se conservarán.\n\n¿Estás seguro? Esta acción es irreversible.`
                : `Se eliminarán las ${eligibleToDelete.length} simulaciones existentes.\n\n¿Estás seguro? Esta acción es irreversible.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            type: 'danger',
        });
        if (!confirmed) return;

        try {
            // hitting specific backend endpoint that we will also modify
            const res = await fetch(`${API}simulations/all`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('All eligible simulations deleted');
                fetchSimulations();
                setSelectedIds([]);
            } else {
                toast.error('Error deleting simulations');
            }
        } catch (error) {
            toast.error('Error deleting: ' + error.message);
        }
    };

    // Funciones de selección múltiple
    const handleToggleSelect = (id, nativeEvent) => {
        if (nativeEvent && nativeEvent.shiftKey && lastSelectedId !== null) {
            const visibleIds = paginatedSimulations.map(s => s.id);
            const start = visibleIds.indexOf(lastSelectedId);
            const end = visibleIds.indexOf(id);

            if (start !== -1 && end !== -1) {
                const min = Math.min(start, end);
                const max = Math.max(start, end);
                const idsInRange = visibleIds.slice(min, max + 1);

                setSelectedIds(prev => {
                    const newSet = new Set(prev);
                    idsInRange.forEach(i => newSet.add(i));
                    return Array.from(newSet);
                });
                return;
            }
        }

        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(simId => simId !== id) : [...prev, id]
        );
        setLastSelectedId(id);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === paginatedSimulations.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paginatedSimulations.map(sim => sim.id));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) {
            toast.warning('No simulations selected');
            return;
        }

        const confirmed = await confirm({
            title: 'Delete Selected Simulations',
            message: `Are you sure you want to delete ${selectedIds.length} selected simulation(s)?\n\nThis action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const deletePromises = selectedIds.map(id =>
                fetch(`${API}simulations/${id}`, { method: 'DELETE' })
            );

            await Promise.all(deletePromises);

            setSimulations(prev => prev.filter(sim => !selectedIds.includes(sim.id)));
            setSelectedIds([]);
            toast.success(`${selectedIds.length} simulation(s) deleted successfully`);
        } catch (error) {
            toast.error('Error deleting simulations: ' + error);
        }
    };

    // Statuses that are eligible to be run / re-run via batch
    const BATCH_ELIGIBLE_STATUSES = new Set(['Not started', 'Error', 'Finished', 'Aborted']);

    const handleRunSelected = async () => {
        if (isBatchCreating) {
            toast.error('No puedes ejecutar simulaciones mientras el batch import está en progreso');
            return;
        }
        if (selectedIds.length === 0) {
            toast.warning('No simulations selected');
            return;
        }

        // Only include simulations in an eligible status
        const eligibleIds = selectedIds.filter(id => {
            const sim = simulations.find(s => s.id === id);
            return sim && BATCH_ELIGIBLE_STATUSES.has(sim.p_status);
        });

        if (eligibleIds.length === 0) {
            toast.warning('None of the selected simulations can be run right now (check their statuses)');
            return;
        }

        setIsRunningBatch(true);
        try {
            const result = await simulationService.batchRunSimulations(eligibleIds);

            if (!result.success) {
                toast.error(`Batch run failed: ${result.error}`);
                return;
            }

            const { started = 0, queued = 0, skipped = 0 } = result.summary || {};
            const parts = [];
            if (started > 0) parts.push(`${started} started`);
            if (queued > 0) parts.push(`${queued} queued`);
            if (skipped > 0) parts.push(`${skipped} skipped / ineligible`);

            if (started > 0 || queued > 0) {
                toast.success(`Batch run: ${parts.join(', ')}`);
            } else {
                toast.warning(`No simulations were run. ${parts.join(', ')}`);
            }

            setSelectedIds([]);
        } catch (error) {
            toast.error('Error during batch run: ' + error.message);
        } finally {
            setIsRunningBatch(false);
        }
    };

    const handleAbortSimulationManual = async (simulation) => {
        if (simulation.p_status === 'Aborting') return;

        const confirmed = await confirm({
            title: 'Abort Simulation',
            message: `Are you sure you want to abort "${simulation.sim_name}"?`,
            confirmText: 'Abort',
            cancelText: 'Cancel',
            type: 'danger'
        });

        if (!confirmed) return;

        setIsAbortingIndividual(true);
        try {
            const result = await simulationService.abortSimulation(simulation.id);
            if (result.success) {
                toast.success(`Aborting simulation "${simulation.sim_name}"...`);
            } else {
                toast.error(result.error || 'Error aborting simulation');
            }
        } catch (error) {
            toast.error('Error: ' + error.message);
        } finally {
            setIsAbortingIndividual(false);
        }
    };

    const handleDuplicateSimulation = async (simulation) => {
        try {
            const result = await simulationService.duplicateSimulation(simulation.id);

            if (result.success) {
                toast.success(`Simulation duplicated as "${result.data.simulation.sim_name}"`);
                // La nueva simulación se agregará automáticamente via WebSocket
                // pero podemos agregarla manualmente también
                setSimulations(prev => [result.data.simulation, ...prev]);
            } else {
                toast.error(result.error || 'Error duplicating simulation');
            }
        } catch (error) {
            toast.error('Error duplicating simulation: ' + error.message);
        }
    };

    const handleDownloadAllZip = () => {
        const finishedSims = simulations.filter(s => s.p_status === 'Finished');
        if (finishedSims.length === 0) {
            toast.error('No hay simulaciones finalizadas para descargar');
            return;
        }
        setDownloadModalState({ isOpen: true, type: 'all', ids: finishedSims.map(s => s.id) });
    };

    const handleDownloadSelected = () => {
        const finishedSelected = simulations.filter(s => selectedIds.includes(s.id) && s.p_status === 'Finished');
        if (finishedSelected.length === 0) {
            toast.error('No hay simulaciones finalizadas seleccionadas');
            return;
        }
        setDownloadModalState({ isOpen: true, type: 'selected', ids: finishedSelected.map(s => s.id) });
    };

    const handleDownloadIndividual = (simId) => {
        setDownloadModalState({ isOpen: true, type: 'individual', ids: [simId] });
    };

    const processDownload = async (contentType) => {
        const { type, ids } = downloadModalState;
        if (ids.length === 0) return;

        if (type === 'all') setIsDownloadingAll(true);
        if (type === 'selected') setIsDownloadingSelected(true);

        // Fallback default filename if the browser blocks the header
        let defaultFilename = null;
        if (ids.length === 1) {
            const sim = simulations.find(s => s.id === ids[0]);
            if (sim && sim.sim_name) {
                const cleanName = sim.sim_name.replace(/[\s/\\]/g, '_');
                defaultFilename = `${cleanName}_${contentType}.zip`;
            }
        }

        try {
            if (contentType === 'all') {
                await simulationService.downloadSimulationsZip(ids, type === 'all', contentType, defaultFilename);
                toast.success('Descarga iniciada...');
            } else if (contentType === 'mat') {
                toast.success(`Iniciando descarga de ${ids.length} simulación(es)...`);
                for (const id of ids) {
                    await simulationService.downloadSimulationMat(id).catch(e => {
                        toast.error(`Error al descargar ${id}: ` + e.message);
                    });
                }
            } else if (contentType === 'graphics') {
                toast.success(`Iniciando descarga de gráficos...`);
                for (const id of ids) {
                    await simulationService.downloadSimulationGraphics(id).catch(e => {
                        toast.error(`Gráficos para ${id} no encontrados o error en descarga`);
                    });
                }
            }
            if (type === 'selected') setSelectedIds([]);
        } catch (error) {
            toast.error('Error al descargar: ' + error.message);
        } finally {
            if (type === 'all') setIsDownloadingAll(false);
            if (type === 'selected') setIsDownloadingSelected(false);
        }
    };

    const handleRerunSimulation = async (simulation) => {
        if (isBatchCreating) {
            toast.error('No puedes ejecutar simulaciones mientras el batch import está en progreso');
            return;
        }
        try {
            const result = await simulationService.rerunSimulation(simulation.id);

            if (result.success) {
                const isQueued = result.data?.status === 'Queued' || result.data?.queued === true;
                toast.success(
                    isQueued
                        ? `Simulation "${simulation.sim_name}" added to the queue`
                        : `Simulation "${simulation.sim_name}" restarted successfully`
                );
            } else {
                toast.error(result.error || 'Error re-running simulation');
            }
        } catch (error) {
            toast.error('Error re-running simulation: ' + error.message);
        }
    };

    // ── Control Bar: Run All ──────────────────────────────────────────
    const handleRunAll = async (mode = 'not-started') => {
        if (isBatchCreating) {
            toast.error('No puedes ejecutar simulaciones mientras el batch import está en progreso');
            return;
        }
        const STATUS_MAP = {
            'all': null,
            'not-started': ['Not started'],
            'failed': ['Error', 'Aborted'],
            'finished': ['Finished'],
        };
        const statusFilter = STATUS_MAP[mode] ?? ['Not started'];

        const modeLabels = {
            'all': 'all eligible',
            'not-started': 'not-started',
            'failed': 'failed/aborted',
            'finished': 'finished',
        };

        const confirmed = await confirm({
            title: `Run New Simulations`,
            message: `This will run all 'Not started' simulations, ordered from highest to lowest ID.\n\nThe first simulation will start immediately; the rest will be queued.`,
            confirmText: 'Run All',
            cancelText: 'Cancel',
            type: 'info',
        });
        if (!confirmed) return;

        setIsRunningAll(true);
        try {
            const result = await simulationService.runAllSimulations(statusFilter);
            if (result.success) {
                const { started, queued, skipped } = result.summary;
                const total = started + queued;
                if (total === 0) {
                    toast.info(result.message || 'No eligible simulations found');
                } else {
                    toast.success(
                        `${total} simulation(s) triggered — ${started} started, ${queued} queued` +
                        (skipped > 0 ? `, ${skipped} skipped (no mesh)` : '')
                    );
                }
            } else {
                toast.error(result.error || 'Error running simulations');
            }
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setIsRunningAll(false);
        }
    };

    // ── Control Bar: Stop All ─────────────────────────────────────────
    const handleStopAll = async () => {
        const running = simulations.filter(s => s.p_status === 'Running').length;
        const queued = simulations.filter(s => s.p_status === 'Queued').length;

        if (running === 0 && queued === 0) {
            toast.info('No active or queued simulations to stop');
            return;
        }

        const confirmed = await confirm({
            title: 'Stop All Simulations',
            message: `This will abort ${running} running simulation(s) and dequeue ${queued} queued simulation(s).\n\nAll affected simulations will be marked as Aborted.`,
            confirmText: 'Stop All',
            cancelText: 'Cancel',
            type: 'danger',
        });
        if (!confirmed) return;

        setIsStoppingAll(true);
        try {
            const result = await simulationService.abortAllSimulations();
            if (result.success) {
                const { aborted, dequeued } = result.summary;
                toast.success(
                    `All stopped — ${aborted} aborted, ${dequeued} dequeued`
                );
            } else {
                toast.error(result.error || 'Error stopping all simulations');
            }
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setIsStoppingAll(false);
        }
    };

    // ── Control Bar: Quick Filter ─────────────────────────────────────
    const handleQuickFilter = (statusValue) => {
        // Toggle off if same filter clicked
        setQuickStatusFilter(prev => prev === statusValue ? null : statusValue);
        setCurrentPage(1);
    };
    return (


        <div className="relative h-screen w-full flex bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
            <div className={`flex flex-col w-full transition-all duration-500 ${showPageTransition ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'}`}>

                {/* ═══ IMPORTING INDICATOR ═════════════════════════════════════════ */}
                {isBatchCreating && (
                    <div className="px-6 mb-2">
                        <div className="bg-gray-800 text-white px-4 py-2 rounded-xl flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm font-bold tracking-wide uppercase">Batch import in progress</span>
                                {importStatusFromBackend?.current_name && (
                                    <span className="text-xs text-gray-300 font-mono truncate max-w-[200px]" title={importStatusFromBackend.current_name}>
                                        → {importStatusFromBackend.current_name}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg font-semibold flex-shrink-0">
                                {importStatusFromBackend
                                    ? `${importStatusFromBackend.current_index}/${importStatusFromBackend.total}`
                                    : 'Creating records...'}
                            </span>
                        </div>
                    </div>
                )}




                {/* ═══ UNIFIED CONTROL BAR & TABLE ════════════════════════════════════════ */}
                <div className="flex-1 min-h-0 px-6 pb-6 pt-6 flex flex-col">
                    <div className="bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col w-full h-full overflow-hidden">
                        <div className="flex-shrink-0">
                            <SimulationControlBar
                                simulations={simulations}
                                onRunAll={handleRunAll}
                                onStopAll={handleStopAll}
                                onDownloadAll={handleDownloadAllZip}
                                onDownloadSelected={handleDownloadSelected}
                                isRunningAll={isRunningAll}
                                isStoppingAll={isStoppingAll}
                                isDownloadingAll={isDownloadingAll}
                                isDownloadingSelected={isDownloadingSelected}
                                activeFilter={quickStatusFilter}
                                onQuickFilter={handleQuickFilter}
                                onSearch={handleSearch}
                                onClearSearch={handleClearSearch}
                                onDeleteAll={handleDeleteAllSimulations}
                                onRunSelected={handleRunSelected}
                                onDeleteSelected={handleDeleteSelected}
                                selectedIds={selectedIds}
                                isRunningBatch={isRunningBatch}
                                searchFilters={searchFilters}
                                hasActiveFilters={hasActiveFilters}
                                filteredCount={filteredSimulations.length}
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPrevPage={handlePrevPage}
                                onNextPage={handleNextPage}
                                onNewSimulation={handleNewSimulation}
                                onImport={() => setIsImportModalOpen(true)}
                                onImportMesh={() => setIsImportMeshModalOpen(true)}
                                onOpenQueue={() => setIsQueueViewOpen(true)}
                                isBatchCreating={isBatchCreating}
                                activeSimulations={activeSimulations}
                                onGoToPage={goToActivePage}
                                onAbort={handleAbortSimulationManual}
                                isAborting={isAbortingIndividual}
                            />
                        </div>

                        {/* 🔹 Tabla */}
                        <div className="flex-1 overflow-hidden" ref={tableContainerRef}>
                            <Table
                                simulations={paginatedSimulations}
                                onView={handleView}
                                onDelete={handleDeleteSimulation}
                                onDuplicate={handleDuplicateSimulation}
                                onExecute={handleExecuteSimulation}
                                onRerun={handleRerunSimulation}
                                onDownloadZip={handleDownloadIndividual}
                                selectedIds={selectedIds}
                                onToggleSelect={handleToggleSelect}
                                onSelectAll={handleSelectAll}
                                editingSimulationId={editingSimulationId}
                                isBatchCreating={isBatchCreating}
                                simulationProgress={simulationProgress}
                            />
                        </div>
                    </div>
                </div>

                    <SimulationModal
                        isOpen={isModalOpen}
                        onClose={handleCloseModal}
                        onSubmit={handleCreateSimulation}
                        simulation={selectedSimulation}
                        mode={modalMode}
                        setSimulations={setSimulations}
                        executeSimulation={handleExecuteSimulation}
                        onDelete={handleDeleteSimulation}
                        onDownloadZip={handleDownloadIndividual}
                        onEditModeChange={(isEditing, simId) => {
                            setEditingSimulationId(isEditing ? simId : null);
                        }}
                        isSimulationBeingSaved={selectedSimulation && editingSimulationId === selectedSimulation.id}
                        simulationProgress={selectedSimulation ? (simulationProgress[selectedSimulation.id] || null) : null}
                    />

                    <QueueView
                        isOpen={isQueueViewOpen}
                        onClose={() => setIsQueueViewOpen(false)}
                    />

                    <DownloadTypeModal
                        isOpen={downloadModalState.isOpen}
                        onClose={() => setDownloadModalState({ isOpen: false, type: null, ids: [] })}
                        onConfirm={processDownload}
                        isBatch={downloadModalState.type !== 'individual'}
                    />

                    <ImportMeshModal
                        isOpen={isImportMeshModalOpen}
                        onClose={() => setIsImportMeshModalOpen(false)}
                        onSuccess={(newSim) => {
                            if (newSim) {
                                setSimulations(prev => {
                                    if (prev.some(s => s.id === newSim.id)) return prev;
                                    return [newSim, ...prev];
                                });
                            }
                        }}
                    />

                    <BatchImportModal
                        isOpen={isImportModalOpen}
                        onClose={() => {
                            setIsImportModalOpen(false);
                            setImportWasInterrupted(false);
                        }}
                        onImport={handleBatchImport}
                        onImportStart={() => setIsBatchCreating(true)}
                        onImportEnd={() => {
                            setIsBatchCreating(false);
                            setImportWasInterrupted(false);
                        }}
                        externalImportInProgress={isBatchCreating}
                        onCancelImportRequest={handleCancelBatchImportRequest}
                        onWaitForMesh={waitForMesh}
                        onDeleteSimulation={deleteSimulationById}
                        importStatusFromBackend={importStatusFromBackend}
                        importWasInterrupted={importWasInterrupted}
                    />
            </div>
            <div
                className={`absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity duration-500 ${showPageTransition ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-full border-4 border-slate-200" />
                        <Loader2 className="w-14 h-14 text-slate-700 animate-spin absolute inset-0" />
                    </div>
                    <p className="text-sm tracking-wide text-slate-600 font-medium">Loading simulations...</p>
                </div>
            </div>
        </div>
    );
};

export default Simulations;
