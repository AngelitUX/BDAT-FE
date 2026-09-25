import React, { useState, useEffect } from 'react';
import { X, Play, Loader, Download, Trash2, Eye, Grid3x3, AudioLines, Clock, RotateCcw, Edit2, Save, XCircle, AlertTriangle, Plus, Database, CheckCircle, FileText, BarChart3, Box, ChevronRight } from 'lucide-react';
import { Field, Input, Label } from '@headlessui/react';
import clsx from 'clsx';
import SimulationDiagram3D from './components/SimulationDiagram3D';
import simulationService from './simulationService';
import MeshViewerModal from '../../components/MeshViewerModal';
import meshService from '../../services/meshService';
import StatusWithTime from './components/StatusWithTime';
import SimulationPreview from './components/SimulationPreview';
import io from 'socket.io-client';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import ResultsModal from './components/ResultsModal';

const API = 'http://localhost:5000';

const SimulationModal = ({
    isOpen,
    onClose,
    onSubmit,
    simulation = null,
    mode = 'view', // 'view' or 'create'
    setSimulations = null,
    executeSimulation,
    onDelete = null,
    allSimulations = [], // Para detectar si hay simulaciones en cola o corriendo
    onEditModeChange = null, // Callback para notificar cambios en modo edicion
    isSimulationBeingSaved = false, // Indica si esta simulación está siendo guardada desde otro lugar
    onDownloadZip = null, // Nuevo prop para descargar con selección de formato
    simulationProgress = null // { percentage, current_step, total_steps, current_source, total_sources }
}) => {
    const toast = useToast();
    const { confirm } = useConfirm();
    const [formData, setFormData] = useState({
        sim_name: '',
        n_transmitter: '',
        n_receiver: '',
        emitters_pitch: '',
        receivers_pitch: '',
        sensor_distance: '',
        sensor_edge_margin: '',
        typical_mesh_size: '',
        plate_thickness: '',
        porosity: '',
        attenuation: 'No',
        mesh_type: 'gmsh',
        skin_layer_config: 'none',  // 'none', 'top', 'bottom', 'both'
        skin_thickness_top: '1.3',
        skin_thickness_bottom: '1.3',
        mesh_angle: '0',  // Nuevo: ángulo de inclinación en grados
        mesh_angle_direction: 'none',  // Nuevo: dirección del ángulo
        roughness: '0.2', // Nuevo: amplitud del ruido de la malla
        p_status: "Not started"
    });
    const [isExecuting, setIsExecuting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isAborting, setIsAborting] = useState(false);
    const [isRerunning, setIsRerunning] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [originalFormData, setOriginalFormData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [createStep, setCreateStep] = useState(1); // 1=Bone, 2=Mesh, 3=Technology

    // Resetear modo edicion y wizard cuando se cierra el modal
    useEffect(() => {
        if (!isOpen) {
            setIsEditMode(false);
            setCreateStep(1);
            if (!isSimulationBeingSaved) {
                setIsSaving(false);
            }
            setHasChanges(false);
        }
    }, [isOpen, isSimulationBeingSaved]);

    // Sincronizar isSaving con el estado del padre
    useEffect(() => {
        if (isOpen && isSimulationBeingSaved) {
            setIsSaving(true);
        } else if (isOpen && !isSimulationBeingSaved) {
            setIsSaving(false);
        }
    }, [isOpen, isSimulationBeingSaved]);

    // Tab state (only used in view/edit mode)
    const [activeTab, setActiveTab] = useState('bone');

    // Statuses that allow full parameter editing (mesh will be regenerated)
    const FULL_EDIT_STATUSES = new Set(['Not started']);
    const canEditAllParams = FULL_EDIT_STATUSES.has(formData.p_status);
    // Mesh visualization state
    const [showMeshModal, setShowMeshModal] = useState(false);
    const [meshModalData, setMeshModalData] = useState(null);
    const [meshModalTitle, setMeshModalTitle] = useState('');
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
    const [isGeneratingMesh, setIsGeneratingMesh] = useState(false);
    // Configuration visualization state
    const [showConfigModal, setShowConfigModal] = useState(false);
    // 3D diagram panel state (create/edit mode)
    const [showDiagram, setShowDiagram] = useState(false);

    const skinConfigLabels = {
        none: 'Disabled',
        top: 'Top only',
        bottom: 'Bottom only',
        both: 'Top & bottom'
    };

    const getSkinConfigLabel = (config) => skinConfigLabels[config] || 'Not available';

    // Initialize form data when simulation is provided (view mode)
    useEffect(() => {
        if (simulation && mode === 'view') {
            const initialData = {
                sim_name: simulation.sim_name || '',
                n_transmitter: simulation.n_transmitter || 1,
                n_receiver: simulation.n_receiver || 1,
                emitters_pitch: simulation.emitters_pitch || 1,
                receivers_pitch: simulation.receivers_pitch || 1,
                sensor_distance: simulation.sensor_distance || 1,
                sensor_edge_margin: simulation.sensor_edge_margin || 1,
                typical_mesh_size: simulation.typical_mesh_size || 1,
                plate_thickness: simulation.plate_thickness || 1,
                porosity: simulation.porosity || 1,
                attenuation: simulation.attenuation === 1 || simulation.attenuation === 'Yes' ? 'Yes' : 'No',
                mesh_type: simulation.mesh_type || "gmsh",
                skin_layer_config: simulation.skin_layer_config || 'none',
                skin_thickness_top: simulation.skin_thickness_top || '1.3',
                skin_thickness_bottom: simulation.skin_thickness_bottom || '1.3',
                mesh_angle: simulation.mesh_angle ?? '0',  // Nuevo 
                mesh_angle_direction: simulation.mesh_angle_direction || 'none',  // Nuevo
                roughness: simulation.roughness ?? '0.2', // Nuevo
                p_status: simulation.p_status || "Not started",
                start_datetime: simulation.start_datetime || null,
                finish_datetime: simulation.finish_datetime || null
            };
            setFormData(initialData);
            setOriginalFormData(initialData);
        }
    }, [simulation, mode]);

    // Actualizar formData cuando cambia el estado de la simulación (especialmente para mesh generation)
    useEffect(() => {
        if (simulation && mode === 'view' && !isEditMode) {
            // Solo actualizar si no estamos en modo edicion para no perder cambios del usuario
            setFormData(prev => ({
                ...prev,
                p_status: simulation.p_status || prev.p_status,
                start_datetime: simulation.start_datetime || prev.start_datetime,
                finish_datetime: simulation.finish_datetime || prev.finish_datetime,
                xml_file: simulation.xml_file || prev.xml_file,
                msh_file: simulation.msh_file || prev.msh_file
            }));
        }
    }, [simulation?.p_status, simulation?.xml_file, simulation?.msh_file, mode, isEditMode]);

    // Limpiar el formulario al abrir en modo 'create'
    useEffect(() => {
        if (isOpen && mode === 'create') {
            setCreateStep(1);
            setFormData({
                sim_name: '',
                n_transmitter: '',
                n_receiver: '',
                emitters_pitch: '',
                receivers_pitch: '',
                sensor_distance: '',
                sensor_edge_margin: '',
                typical_mesh_size: '',
                plate_thickness: '',
                porosity: '',
                attenuation: 'No',
                mesh_type: 'gmsh',
                skin_layer_config: 'none',
                skin_thickness_top: '1.3',
                skin_thickness_bottom: '1.3',
                mesh_angle: '0',
                mesh_angle_direction: 'none',
                roughness: '0.2',
                p_status: "Not started"
            });
        }
    }, [isOpen, mode]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: value
            };

            // Check if there are changes when in edit mode
            if (isEditMode && originalFormData) {
                const changed = Object.keys(newData).some(key => {
                    if (key === 'start_datetime' || key === 'finish_datetime' || key === 'p_status') return false;
                    return newData[key] !== originalFormData[key];
                });
                setHasChanges(changed);
            }

            return newData;
        });
    };

    // --- Dimension consistency validation ---
    // Computes plate_length from current form values and checks that the mesh
    // parameters are physically consistent with the geometry.
    const getDimensionWarnings = () => {
        const warnings = [];  // { level: 'error'|'warning', msg: string }

        const nTx = Number(formData.n_transmitter) || 0;
        const nRx = Number(formData.n_receiver) || 0;
        const tp = Number(formData.emitters_pitch) || 0;
        const rp = Number(formData.receivers_pitch) || 0;
        const dist = Number(formData.sensor_distance) || 0;
        const edge = Number(formData.sensor_edge_margin) || 0;
        const meshSize = Number(formData.typical_mesh_size) || 0;
        const thickness = Number(formData.plate_thickness) || 0;
        const amplitude = Number(formData.roughness) || 0;
        const angle = Number(formData.mesh_angle) || 0;
        const useRoughness = Number(formData.roughness);

        // Calculated plate_length (same formula as backend)
        const emittersSpan = Math.max(0, (nTx - 1) * tp);
        const receiversSpan = Math.max(0, (nRx - 1) * rp);
        const plateLength = edge * 2 + emittersSpan + dist + receiversSpan;

        // 1) Mesh size vs plate thickness
        if (meshSize > 0 && thickness > 0 && meshSize >= thickness) {
            warnings.push({
                level: 'error',
                msg: `Mesh size (${meshSize} mm) must be smaller than plate thickness (${thickness} mm). The mesh cannot discretize the plate.`
            });
        }

        // 2) Mesh size vs plate length
        if (meshSize > 0 && plateLength > 0 && meshSize >= plateLength) {
            warnings.push({
                level: 'error',
                msg: `Mesh size (${meshSize} mm) must be smaller than plate length (${plateLength.toFixed(1)} mm).`
            });
        }

        // 3) Mesh size should be at most half of plate thickness for good resolution
        if (meshSize > 0 && thickness > 0 && meshSize > thickness / 2) {
            warnings.push({
                level: 'warning',
                msg: `Mesh size (${meshSize} mm) is larger than half the plate thickness (${(thickness / 2).toFixed(1)} mm). This may produce a very coarse mesh with poor accuracy.`
            });
        }

        // 4) Roughness amplitude vs plate thickness
        if (useRoughness === 1 && amplitude > 0 && thickness > 0 && amplitude >= thickness) {
            warnings.push({
                level: 'error',
                msg: `Roughness amplitude (${amplitude} mm) must be smaller than plate thickness (${thickness} mm).`
            });
        }

        // 5) Mesh angle: tan(angle) * plate_length / 2 must not exceed plate thickness
        if (angle > 0 && plateLength > 0 && thickness > 0) {
            const maxDeflection = Math.tan(angle * Math.PI / 180) * (plateLength / 2);
            if (maxDeflection >= thickness) {
                warnings.push({
                    level: 'error',
                    msg: `Mesh angle ${angle}° causes the interface to deflect ${maxDeflection.toFixed(1)} mm, which exceeds plate thickness (${thickness} mm). Reduce the angle or increase thickness.`
                });
            } else if (maxDeflection > thickness * 0.5) {
                warnings.push({
                    level: 'warning',
                    msg: `Mesh angle ${angle}° causes ${maxDeflection.toFixed(1)} mm deflection (>${(thickness * 0.5).toFixed(1)} mm). This leaves very little material at the edges.`
                });
            }
        }

        return { warnings, plateLength };
    };

    const { warnings: dimensionWarnings, plateLength: calculatedPlateLength } = getDimensionWarnings();
    const hasDimensionErrors = dimensionWarnings.some(w => w.level === 'error');

    const handleSubmit = (e) => {
        e.preventDefault();

        // Si no estamos en el último paso del wizard de creación, avanzar paso en lugar de enviar
        if (mode === 'create' && createStep < 2) {
            setCreateStep(prev => prev + 1);
            return;
        }

        if (mode === 'create' && onSubmit) {
            // Validación: todos los campos deben estar llenos y ser válidos
            const requiredFields = [
                'sim_name', 'n_transmitter', 'n_receiver', 'emitters_pitch', 'receivers_pitch',
                'sensor_distance', 'sensor_edge_margin', 'typical_mesh_size', 'plate_thickness', 'porosity', 'attenuation', 'mesh_type', 'skin_layer_config',
                'roughness'
            ];
            for (const field of requiredFields) {
                if (
                    formData[field] === '' ||
                    formData[field] === null ||
                    formData[field] === undefined ||
                    (typeof formData[field] === 'string' && formData[field].trim() === '')
                ) {
                    toast.warning('Please complete all fields before continuing.');
                    return;
                }
            }
            // Validaciones numéricas estrictas
            const numericFields = [
                'n_transmitter', 'n_receiver', 'emitters_pitch', 'receivers_pitch',
                'sensor_distance', 'sensor_edge_margin', 'typical_mesh_size', 'plate_thickness', 'porosity', 'roughness'
            ];
            for (const field of numericFields) {
                const value = Number(formData[field]);
                if (isNaN(value)) {
                    toast.warning('Please enter only valid numbers in the numeric fields.');
                    return;
                }
            }
            if (
                Number(formData.n_transmitter) < 1 ||
                Number(formData.n_receiver) < 1 ||
                Number(formData.emitters_pitch) <= 0 ||
                Number(formData.receivers_pitch) <= 0 ||
                Number(formData.sensor_distance) <= 0 ||
                Number(formData.sensor_edge_margin) < 0 ||
                Number(formData.typical_mesh_size) <= 0 ||
                Number(formData.typical_mesh_size) <= 0 ||
                Number(formData.plate_thickness) <= 0 ||
                Number(formData.porosity) < 0 || Number(formData.porosity) > 100 ||
                Number(formData.roughness) < 0
            ) {
                toast.warning('Please enter valid values: Emitters and Receivers must be >= 1, Other numeric fields must be > 0, Porosity must be between 0 and 100%, Amplitude >= 0', 'Validation Error');
                return;
            }
            // Validación de attenuation
            if (formData.attenuation !== 'Yes' && formData.attenuation !== 'No') {
                toast.warning('Please select a valid option for Attenuation.');
                return;
            }
            // Validación de mesh_type
            if (formData.mesh_type !== 'gmsh' && formData.mesh_type !== 'mshr') {
                toast.warning('Please select a valid Mesh Type (gmsh or mshr).');
                return;
            }
            // Dimension consistency check
            if (hasDimensionErrors) {
                toast.error('Please fix the dimension errors before creating the simulation. Check the Mesh step for details.', 'Invalid Dimensions');
                return;
            }
            // Generar la simulación nueva
            const newSimulation = {
                ...formData,
                n_transmitter: Number(formData.n_transmitter),
                n_receiver: Number(formData.n_receiver),
                emitters_pitch: Number(formData.emitters_pitch),
                receivers_pitch: Number(formData.receivers_pitch),
                sensor_distance: Number(formData.sensor_distance),
                sensor_edge_margin: Number(formData.sensor_edge_margin),
                typical_mesh_size: Number(formData.typical_mesh_size),
                plate_thickness: Number(formData.plate_thickness),
                porosity: Number(formData.porosity),
                attenuation: Number(formData.attenuation == "Yes" ? 1 : 0),
                skin_layer_config: formData.skin_layer_config,
                skin_thickness_top: Number(formData.skin_thickness_top),
                skin_thickness_bottom: Number(formData.skin_thickness_bottom),
                mesh_angle: Number(formData.mesh_angle),  // Corregido
                mesh_angle_direction: (Number(formData.mesh_angle) === 0) ? 'none' : formData.mesh_angle_direction,  // Nuevo: forzado si ángulo es 0
                roughness: Number(formData.roughness), // Nuevo
            };
            onSubmit(newSimulation);
        }
        onClose();

        // Reset form for create mode
        if (mode === 'create') {
            setFormData({
                sim_name: '',
                n_transmitter: '',
                n_receiver: '',
                emitters_pitch: '',
                receivers_pitch: '',
                sensor_distance: '',
                sensor_edge_margin: '',
                typical_mesh_size: '',
                plate_thickness: '',
                porosity: '',
                attenuation: 'No',
                mesh_type: 'gmsh',
                skin_layer_config: 'none',
                skin_thickness_top: '1.3',
                skin_thickness_bottom: '1.3',
                mesh_angle: '0',  // Corregido
                mesh_angle_direction: 'none',  // Nuevo
                roughness: '0.2', // Nuevo
                p_status: "Not started"
            });
        }
    };
    // La función downloadSimulation fue removida porque se delega al onDownloadZip del padre

    // Función para cargar mesh de simulación existente
    const handleLoadSimulationMesh = async () => {
        if (!simulation || !simulation.id) return;

        setIsGeneratingMesh(true);
        try {
            // Load mesh data directly
            const meshData = await meshService.loadMeshForSimulation(simulation.id);

            // Convert to Canvas format if needed
            const canvasMeshData = convertToCanvasFormat(meshData);
            setMeshModalData(canvasMeshData);
            setMeshModalTitle(`Mesh - Simulation ${simulation.id}`);
            setShowMeshModal(true);

        } catch (error) {
            // Fallback: generate preview from simulation parameters
            try {
                const meshParams = {
                    n_transmitter: parseInt(simulation.n_transmitter),
                    n_receiver: parseInt(simulation.n_receiver),
                    sensor_distance: parseFloat(simulation.sensor_distance),
                    emitters_pitch: parseFloat(simulation.emitters_pitch),
                    receivers_pitch: parseFloat(simulation.receivers_pitch),
                    sensor_edge_margin: parseFloat(simulation.sensor_edge_margin),
                    typical_mesh_size: parseFloat(simulation.typical_mesh_size),
                    plate_thickness: parseFloat(simulation.plate_thickness),
                    mesh_type: simulation.mesh_type || 'gmsh'
                };

                const meshData = await meshService.generateMeshPreview(meshParams);

                const canvasMeshData = convertToCanvasFormat(meshData);
                setMeshModalData(canvasMeshData);
                setMeshModalTitle(`Mesh Preview - Simulation ${simulation.id}`);
                setShowMeshModal(true);

            } catch (fallbackError) {
                toast.error('No se pudo cargar ni generar el mesh de la simulación. Verifique que el backend esté funcionando correctamente.');
            }
        } finally {
            setIsGeneratingMesh(false);
        }
    };

    // Helper function to convert mesh data to canvas format
    const convertToCanvasFormat = (meshData) => {
        // If already in canvas format, return as-is
        if (meshData.nodes && meshData.elements && meshData.bounds) {
            return meshData;
        }

        // Convert from Three.js format to Canvas format
        const nodes = new Map();
        const elements = [];
        let bounds = {
            minX: Infinity, maxX: -Infinity,
            minY: Infinity, maxY: -Infinity,
            minZ: Infinity, maxZ: -Infinity
        };

        if (meshData.vertices && meshData.faces) {
            // Convert vertices to nodes
            meshData.vertices.forEach((vertex, idx) => {
                const [x, y, z] = vertex;
                nodes.set(idx, { id: idx, x, y, z });

                // Update bounds
                bounds.minX = Math.min(bounds.minX, x);
                bounds.maxX = Math.max(bounds.maxX, x);
                bounds.minY = Math.min(bounds.minY, y);
                bounds.maxY = Math.max(bounds.maxY, y);
                bounds.minZ = Math.min(bounds.minZ, z);
                bounds.maxZ = Math.max(bounds.maxZ, z);
            });

            // Convert faces to elements (triangles)
            meshData.faces.forEach((face, idx) => {
                elements.push({
                    id: idx,
                    type: 2, // triangle
                    nodes: face
                });
            });
        }

        return {
            nodes,
            elements,
            bounds,
            metadata: meshData.metadata || {}
        };
    };


    // Función para descargar archivo de malla (MSH o XML)
    const handleDownloadMeshFile = async (preferredFormat = 'msh') => {
        if (!simulation || !simulation.id) return;

        setIsDownloading(true);
        try {
            // 1️⃣ Obtener la información de los archivos disponibles
            const meshInfo = await meshService.getMeshFileInfo(simulation.id);

            if (!meshInfo || !meshInfo.all_files || meshInfo.all_files.length === 0) {
                throw new Error("No mesh files available");
            }

            // 2️⃣ Buscar el archivo del formato preferido
            let targetFile = meshInfo.all_files.find(file => file.format === preferredFormat);

            // Si no se encuentra el formato preferido, usar el primero disponible
            if (!targetFile) {
                targetFile = meshInfo.all_files[0];
            }

            const filename = targetFile.filename;

            // 3️⃣ Descargar el archivo desde el backend
            const response = await fetch(
                `${API}/simulations/${simulation.id}/mesh/${filename}`
            );

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // 4️⃣ Convertir la respuesta a blob
            const blob = await response.blob();

            // 5️⃣ Crear enlace temporal y descargar
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {

            // Get debug information to help diagnose the issue
            try {
                const debugInfo = await meshService.getSimulationDebugInfo(simulation.id);

                let errorMessage = `No se pudo descargar el archivo de malla ${preferredFormat.toUpperCase()}.\n\n`;
                errorMessage += `Estado de la simulación: ${debugInfo.status}\n`;
                errorMessage += `Archivos XML: ${debugInfo.xml_exists ? '✅ Existe' : '❌ No existe'}\n`;
                errorMessage += `Archivos MSH: ${debugInfo.msh_exists ? '✅ Existe' : '❌ No existe'}\n`;

                if (!debugInfo.xml_exists && !debugInfo.msh_exists) {
                    errorMessage += "\nLos archivos de malla no se han generado aún. ";
                    if (debugInfo.status === 'Generating mesh') {
                        errorMessage += "La malla se está generando, por favor espera.";
                    } else if (debugInfo.status === 'Not started') {
                        errorMessage += "La simulación no ha comenzado aún.";
                    } else {
                        errorMessage += "Puede que haya ocurrido un error durante la generación.";
                    }
                }

                toast.error(errorMessage);
            } catch (debugError) {

                let errorMessage = `No se pudo descargar el archivo de malla ${preferredFormat.toUpperCase()}.`;
                if (error.message.includes("404")) {
                    errorMessage =
                        "Esta simulación no tiene archivos de malla disponibles.";
                } else if (error.message.includes("500")) {
                    errorMessage =
                        "Error del servidor al intentar acceder al archivo de malla. Inténtalo nuevamente más tarde.";
                } else if (error.message.includes("No mesh files available")) {
                    errorMessage =
                        "Esta simulación no tiene archivos de malla guardados (solo se generan para simulaciones completadas).";
                }

                toast.error(errorMessage);
            }
        } finally {
            setIsDownloading(false);
        }
    };


    // Función para abortar simulación
    const handleAbortSimulation = async () => {
        const confirmed = await confirm({
            title: 'Abort Simulation',
            message: 'Are you sure you want to abort this simulation?\n\nThis action cannot be undone.',
            confirmText: 'Abort',
            cancelText: 'Cancel',
            type: 'danger'
        });

        if (!confirmed) return;

        setIsAborting(true);
        // Actualizar estado local inmediatamente para que el botón muestre "Aborting..."
        setFormData(prev => ({ ...prev, p_status: 'Aborting' }));

        try {
            const result = await simulationService.abortSimulation(simulation.id);
            if (result.success) {
                // El WebSocket actualizará el estado final; actualizamos localmente también
                toast.success('Simulation aborted successfully');
                setFormData(prev => ({ ...prev, p_status: 'Aborted' }));
            } else {
                // Revertir el estado si el backend rechazó el abort
                toast.error(`Error aborting simulation: ${result.error}`);
                setFormData(prev => ({ ...prev, p_status: simulation.p_status }));
            }
        } catch (error) {
            toast.error('Error aborting simulation. Please try again.');
            setFormData(prev => ({ ...prev, p_status: simulation.p_status }));
        } finally {
            setIsAborting(false);
        }
    };

    // Función para desencolar simulación
    const handleDequeueSimulation = async () => {
        const confirmed = await confirm({
            title: 'Remove from Queue',
            message: 'Remove this simulation from the queue?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            type: 'warning'
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`${API}/simulations/${simulation.id}/dequeue`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Simulation removed from queue');
            } else {
                toast.error(`Error removing from queue: ${data.error}`);
            }
        } catch (error) {
            toast.error('Error removing simulation from queue. Please try again.');
        }
    };

    // Función para re-ejecutar simulación
    const handleRerunSimulation = async () => {
        const confirmed = await confirm({
            title: 'Re-run Simulation',
            message: 'Are you sure you want to re-run this simulation?',
            confirmText: 'Re-run',
            cancelText: 'Cancel',
            type: 'info'
        });

        if (!confirmed) return;

        setIsRerunning(true);
        try {
            const result = await simulationService.rerunSimulation(simulation.id);
            if (result.success) {
                // No actualizar manualmente el estado - dejar que el WebSocket lo maneje
                // Esto evita inconsistencias entre frontend y backend
                const isQueued = result.queued || result.status === 'Queued';
                const message = isQueued
                    ? 'Simulation queued for re-execution'
                    : 'Simulation re-run started';
                toast.success(message);

                // El estado se actualizará automáticamente vía WebSocket
                console.log(`✅ Rerun iniciado para simulación ${simulation.id}, estado: ${result.status}`);
            } else {
                toast.error(`Error re-running simulation: ${result.error}`);
            }
        } catch (error) {
            toast.error('Error re-running simulation. Please try again.');
        } finally {
            setIsRerunning(false);
        }
    };

    // Función para activar modo edicion
    const handleEnableEdit = () => {
        setIsEditMode(true);
        setOriginalFormData({ ...formData });
        setHasChanges(false);
    };

    // Función para cancelar edicion
    const handleCancelEdit = async () => {
        if (hasChanges) {
            const confirmed = await confirm({
                title: 'Discard Changes',
                message: 'You have unsaved changes. Are you sure you want to discard them?',
                confirmText: 'Discard',
                cancelText: 'Keep Editing',
                type: 'warning'
            });

            if (!confirmed) return;
        }
        setFormData(originalFormData);
        setIsEditMode(false);
        setHasChanges(false);
    };

    // Función para guardar cambios
    const handleSaveEdit = async () => {
        if (!hasChanges) {
            setIsEditMode(false);
            return;
        }

        // Validations
        if (!formData.sim_name || (typeof formData.sim_name === 'string' && formData.sim_name.trim() === '')) {
            toast.warning('Please enter a simulation name.');
            return;
        }

        if (canEditAllParams) {
            // Full validations only when all params are editable (Not started)
            const requiredFields = [
                'sim_name', 'n_transmitter', 'n_receiver', 'emitters_pitch', 'receivers_pitch',
                'sensor_distance', 'sensor_edge_margin', 'typical_mesh_size', 'plate_thickness', 'porosity', 'roughness'
            ];

            for (const field of requiredFields) {
                if (
                    formData[field] === '' ||
                    formData[field] === null ||
                    formData[field] === undefined ||
                    (typeof formData[field] === 'string' && formData[field].trim() === '')
                ) {
                    toast.warning('Please complete all fields before saving.');
                    return;
                }
            }

            const numericFields = [
                'n_transmitter', 'n_receiver', 'emitters_pitch', 'receivers_pitch',
                'sensor_distance', 'sensor_edge_margin', 'typical_mesh_size', 'plate_thickness', 'porosity', 'roughness'
            ];

            for (const field of numericFields) {
                const value = Number(formData[field]);
                if (isNaN(value)) {
                    toast.warning('Please enter only valid numbers in the numeric fields.');
                    return;
                }
            }

            if (
                Number(formData.n_transmitter) < 1 ||
                Number(formData.n_receiver) < 1 ||
                Number(formData.emitters_pitch) <= 0 ||
                Number(formData.receivers_pitch) <= 0 ||
                Number(formData.sensor_distance) <= 0 ||
                Number(formData.sensor_edge_margin) < 0 ||
                Number(formData.typical_mesh_size) <= 0 ||
                Number(formData.plate_thickness) <= 0 ||
                Number(formData.porosity) < 0 || Number(formData.porosity) > 100 ||
                Number(formData.roughness) < 0
            ) {
                toast.warning('Please enter valid values: Emitters and Receivers must be >= 1, Other numeric fields must be > 0, Porosity must be between 0 and 100%, Amplitude >= 0', 'Validation Error');
                return;
            }

            // Dimension consistency check
            if (hasDimensionErrors) {
                toast.error('Please fix the dimension errors before saving. The mesh parameters are inconsistent with the geometry.', 'Invalid Dimensions');
                return;
            }
        }

        setIsSaving(true);
        // Notificar al padre que se inició el guardado
        if (onEditModeChange && simulation) {
            onEditModeChange(true, simulation.id);
        }

        try {
            let updateData;
            if (canEditAllParams) {
                updateData = {
                    sim_name: formData.sim_name,
                    n_transmitter: Number(formData.n_transmitter),
                    n_receiver: Number(formData.n_receiver),
                    emitters_pitch: Number(formData.emitters_pitch),
                    receivers_pitch: Number(formData.receivers_pitch),
                    sensor_distance: Number(formData.sensor_distance),
                    sensor_edge_margin: Number(formData.sensor_edge_margin),
                    typical_mesh_size: Number(formData.typical_mesh_size),
                    plate_thickness: Number(formData.plate_thickness),
                    porosity: Number(formData.porosity),
                    attenuation: formData.attenuation === 'Yes' ? 1 : 0,
                    mesh_type: formData.mesh_type,
                    skin_layer_config: formData.skin_layer_config,
                    skin_thickness_top: Number(formData.skin_thickness_top),
                    skin_thickness_bottom: Number(formData.skin_thickness_bottom),
                    mesh_angle: Number(formData.mesh_angle),
                    mesh_angle_direction: (Number(formData.mesh_angle) === 0) ? 'none' : formData.mesh_angle_direction,
                    roughness: Number(formData.roughness),
                };
            } else {
                // Only name is editable for non-"Not started" simulations
                updateData = {
                    sim_name: formData.sim_name,
                };
            }

            const result = await simulationService.updateSimulation(simulation.id, updateData);

            if (result.success) {
                setOriginalFormData({ ...formData });
                setIsEditMode(false);
                setHasChanges(false);

                // Use server-returned data so status/mesh fields are fresh
                const serverData = result.data?.simulation || result.data || {};
                if (setSimulations) {
                    setSimulations(prev => prev.map(sim =>
                        sim.id === simulation.id
                            ? { ...sim, ...updateData, ...(serverData.p_status ? { p_status: serverData.p_status } : {}) }
                            : sim
                    ));
                }

                const msg = canEditAllParams
                    ? 'Simulation updated successfully! The mesh will be regenerated on next execution.'
                    : 'Simulation name updated successfully.';
                toast.success(msg);
            } else {
                toast.error(`Error updating simulation: ${result.error}`);
            }
        } catch (error) {
            toast.error('Error updating simulation. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const isViewMode = mode === 'view';
    const title = isViewMode ? 'Simulation Details' : 'New Simulation';
    const submitButtonText = isViewMode ? 'Close' : 'Create Simulation';
    const canExecute = isViewMode && simulation && simulation.p_status === 'Not started' && !isExecuting;
    const canDownload = isViewMode && simulation && (simulation.p_status === 2 || simulation.p_status === 'Finished');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm transition-all p-4 animate-fade-in-backdrop">
            <div
                className="bg-white rounded-2xl shadow-2xl p-0 relative animate-scale-in overflow-hidden border border-gray-100 transition-all duration-300 ease-in-out"
                style={{ width: showDiagram ? 'min(96vw, 1340px)' : 'min(90vw, 580px)' }}
            >
                {/* Encabezado */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 bg-white">
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    <div className="flex items-center gap-2">
                        {/* View Configuration Diagram button */}
                        <button
                            type="button"
                            onClick={() => setShowDiagram(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showDiagram
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                            title="Toggle 3D configuration diagram"
                        >
                            <Box className="w-3.5 h-3.5" />
                            {showDiagram ? 'Hide Diagram' : 'View Diagram'}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none rounded-full p-1 transition-colors"
                            aria-label="Cerrar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                {/* Tarjeta de datos clave - compacta con status */}
                {isViewMode && simulation && (
                    <div className="mx-8 mt-3 mb-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-400 text-xs">ID: <span className="font-semibold text-gray-700">{simulation.id}</span></span>
                        <div className="flex items-center gap-1.5">
                            <StatusWithTime
                                status={formData.p_status}
                                startDateTime={formData.start_datetime}
                                finishDateTime={formData.finish_datetime}
                                queuePosition={simulation.queue_position}
                                showIcon={true}
                            />
                        </div>
                        {/* Progress bar — only visible when Running and progress data is available */}
                        {formData.p_status === 'Running' && simulationProgress && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* Percentage badge */}
                                <span className="text-xs font-bold tabular-nums text-amber-600 flex-shrink-0">
                                    {simulationProgress.percentage.toFixed(1)}%
                                </span>
                                {/* Track */}
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-0">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                        style={{
                                            width: `${simulationProgress.percentage}%`,
                                            background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
                                        }}
                                    />
                                </div>
                                {/* Source label */}
                                {simulationProgress.total_sources > 1 && (
                                    <span className="text-[10px] text-gray-400 flex-shrink-0 font-medium">
                                        src {simulationProgress.current_source}/{simulationProgress.total_sources}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {/* ---
                    MODO CREATE: Wizard de 3 pasos
                    La preview es fija abajo; el formulario cambia por paso.
                --- */}
                {!isViewMode && (
                    <div className="flex" style={{ minHeight: 0 }}>
                        {/* Left: form — fixed width so diagram panel doesn't shift */}
                        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 580, minHeight: 0 }}>

                            {/* Saving banner */}
                            {isSimulationBeingSaved && (
                                <div className="mx-6 mt-4 bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                                    <Loader className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0 animate-spin" />
                                    <div className="text-xs text-amber-800">
                                        <p className="font-semibold mb-1">Saving Changes...</p>
                                        <p>Please wait for the process to complete.</p>
                                    </div>
                                </div>
                            )}

                            {/* --- Encabezado: Nombre + Step indicator --- */}
                            <div className="px-6 pt-4 pb-2 space-y-3 border-b border-gray-100">
                                {/* Simulation Name */}
                                <Field>
                                    <Label className="block text-xs text-gray-500 font-medium mb-1">Simulation Name</Label>
                                    <Input
                                        type="text"
                                        name="sim_name"
                                        value={formData.sim_name}
                                        onChange={handleInputChange}
                                        placeholder="Enter simulation name..."
                                        className={clsx(
                                            'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-300',
                                            'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent'
                                        )}
                                    />
                                </Field>

                                {/* Step indicator */}
                                <div className="flex items-center">
                                    {[
                                        { n: 1, label: 'Bone Parameters' },
                                        { n: 2, label: 'Mesh & Tech' },
                                    ].map(({ n, label }, i) => {
                                        const isPast = n < createStep;
                                        const isCurrent = n === createStep;
                                        return (
                                            <React.Fragment key={n}>
                                                {i > 0 && (
                                                    <div className={`h-px flex-1 mx-2 transition-colors ${isPast ? 'bg-blue-400' : 'bg-gray-200'}`} />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateStep(n)}
                                                    className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                                                >
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all
                                                    ${isCurrent ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-300'
                                                            : isPast ? 'bg-blue-100 border-blue-400 text-blue-700'
                                                                : 'bg-gray-100 border-gray-300 text-gray-400 group-hover:border-blue-300 group-hover:text-blue-400'}`}>
                                                        {isPast ? String.fromCharCode(10003) : n}
                                                    </div>
                                                    <span className={`text-xs font-semibold hidden sm:inline transition-colors
                                                    ${isCurrent ? 'text-blue-700' : isPast ? 'text-blue-400' : 'text-gray-400 group-hover:text-blue-500'}`}>
                                                        {label}
                                                    </span>
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Contenido del paso (scrollable) */}
                            <form
                                id="simulation-form"
                                onSubmit={handleSubmit}
                                className="flex-1 overflow-y-auto overflow-x-hidden"
                            >
                                <div className="py-4">
                                    <div className="flex w-[200%] transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${(createStep - 1) * 50}%)` }}>
                                        {/* STEP 1: Bone Parameters */}
                                        <div className="w-1/2 px-6 space-y-4" style={{ minHeight: '340px' }}>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {[
                                                    { label: 'Emitters', name: 'n_transmitter' },
                                                    { label: 'Receivers', name: 'n_receiver' },
                                                    { label: 'Emitters Pitch', name: 'emitters_pitch', unit: 'mm' },
                                                    { label: 'Receivers Pitch', name: 'receivers_pitch', unit: 'mm' },
                                                    { label: 'Distance', name: 'sensor_distance', unit: 'mm' },
                                                    { label: 'Edge Margin', name: 'sensor_edge_margin', unit: 'mm' },
                                                    { label: 'Plate Thickness', name: 'plate_thickness', unit: 'mm' },
                                                    { label: 'Porosity', name: 'porosity', unit: '%' },
                                                ].map((field) => (
                                                    <Field key={field.name}>
                                                        <Label className="block text-xs text-gray-500 font-medium mb-1">
                                                            {field.label} {field.unit && <span className="text-gray-400 text-[10px]">({field.unit})</span>}
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            name={field.name}
                                                            value={formData[field.name]}
                                                            onChange={handleInputChange}
                                                            step="any"
                                                            min="0"
                                                            className={clsx(
                                                                'block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-300',
                                                                'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent'
                                                            )}
                                                        />
                                                    </Field>
                                                ))}
                                            </div>

                                            {/* Bone Porosity (Roughness Amplitude) */}
                                            <div className="grid grid-cols-2 gap-3 pt-1">
                                                <div className="animate-fade-in">
                                                    <label className="block text-xs text-gray-500 font-medium mb-1">
                                                        Roughness Amplitude <span className="text-gray-400 text-[10px]">(mm)</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name="roughness"
                                                        value={formData.roughness}
                                                        onChange={handleInputChange}
                                                        step="any" min="0"
                                                        placeholder="0 for flat"
                                                        className="w-full px-2.5 py-1.5 rounded-lg text-sm text-gray-700 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none bg-white transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* STEP 2: Mesh */}
                                        <div className="w-1/2 px-6 space-y-4" style={{ minHeight: '340px' }}>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field>
                                                    <Label className="block text-xs text-gray-500 font-medium mb-1">
                                                        Mesh Size <span className="text-gray-400 text-[10px]">(mm)</span>
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        name="typical_mesh_size"
                                                        value={formData.typical_mesh_size}
                                                        onChange={handleInputChange}
                                                        step="any" min="0"
                                                        className={clsx(
                                                            'block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-300',
                                                            'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent'
                                                        )}
                                                    />
                                                </Field>
                                            </div>


                                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                    <Grid3x3 className="w-4 h-4 text-blue-500" />
                                                    Mesh Inclination
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field>
                                                        <Label className="block text-xs text-gray-500 font-medium mb-1">
                                                            Angle <span className="text-gray-400 text-[10px]">(degrees)</span>
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            name="mesh_angle"
                                                            value={formData.mesh_angle}
                                                            onChange={handleInputChange}
                                                            step="0.1" min="0" max="2"
                                                            className={clsx(
                                                                'block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-300',
                                                                'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent'
                                                            )}
                                                        />
                                                    </Field>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 font-medium mb-1">Direction</label>
                                                        <select
                                                            name="mesh_angle_direction"
                                                            value={formData.mesh_angle_direction}
                                                            onChange={handleInputChange}
                                                            disabled={Number(formData.mesh_angle) === 0}
                                                            className={`w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors duration-150 border
                                                            ${Number(formData.mesh_angle) === 0
                                                                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-white border-gray-200 text-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none'}`}
                                                        >
                                                            <option value="none">None</option>
                                                            <option value="left">Left → Right</option>
                                                            <option value="right">Right → Left</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Attenuation & Mesh Type */}
                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="block text-xs text-gray-500 font-medium mb-2">
                                                        Attenuation <span className="ml-1 text-[10px] text-gray-400">(Domain)</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <button type="button"
                                                            onClick={() => handleInputChange({ target: { name: 'attenuation', value: 'No' } })}
                                                            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all cursor-pointer
                                                            ${formData.attenuation === 'No' || formData.attenuation === '' || formData.attenuation === 0
                                                                    ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm'
                                                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <div className="text-left flex flex-col justify-center">
                                                                    <div className="font-semibold leading-none mb-0.5 text-[11px]">No</div>
                                                                    <div className="text-[9px] opacity-70 leading-none">Time</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                        <button type="button"
                                                            onClick={() => handleInputChange({ target: { name: 'attenuation', value: 'Yes' } })}
                                                            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all cursor-pointer
                                                            ${formData.attenuation === 'Yes' || formData.attenuation === 1
                                                                    ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm'
                                                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <AudioLines className="w-3.5 h-3.5" />
                                                                <div className="text-left flex flex-col justify-center">
                                                                    <div className="font-semibold leading-none mb-0.5 text-[11px]">Yes</div>
                                                                    <div className="text-[9px] opacity-70 leading-none">Freq</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-gray-500 font-medium mb-2">
                                                        Mesh Type <span className="ml-1 text-[10px] text-gray-400">(Generator)</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <button type="button"
                                                            onClick={() => handleInputChange({ target: { name: 'mesh_type', value: 'gmsh' } })}
                                                            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all cursor-pointer
                                                            ${formData.mesh_type === 'gmsh'
                                                                    ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm'
                                                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <img src="/images/gmsh.png" alt="G" className="w-3.5 h-3.5 object-contain opacity-80" />
                                                                <div className="text-left flex flex-col justify-center">
                                                                    <div className="font-semibold leading-none mb-0.5 text-[11px]">GMSH</div>
                                                                    <div className="text-[9px] opacity-70 leading-none">Opt</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                        <button type="button"
                                                            onClick={() => handleInputChange({ target: { name: 'mesh_type', value: 'mshr' } })}
                                                            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all cursor-pointer
                                                            ${formData.mesh_type === 'mshr'
                                                                    ? 'border-orange-400 bg-orange-50 text-orange-800 shadow-sm'
                                                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <img src="/images/mshr.png" alt="M" className="w-3.5 h-3.5 object-contain opacity-80" />
                                                                <div className="text-left flex flex-col justify-center">
                                                                    <div className="font-semibold leading-none mb-0.5 text-[11px]">MSHR</div>
                                                                    <div className="text-[9px] opacity-70 leading-none text-orange-600">Old</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </form>

                            {/* --- Footer del wizard --- */}
                            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-shrink-0">
                                {createStep === 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreateStep(1);
                                            setFormData({
                                                sim_name: '', n_transmitter: '', n_receiver: '',
                                                emitters_pitch: '', receivers_pitch: '', sensor_distance: '',
                                                sensor_edge_margin: '', typical_mesh_size: '', plate_thickness: '',
                                                porosity: '', attenuation: 'No', mesh_type: 'gmsh',
                                                skin_layer_config: 'none', skin_thickness_top: '1.3',
                                                skin_thickness_bottom: '1.3', mesh_angle: '0',
                                                mesh_angle_direction: 'none', roughness: '0.2',
                                                p_status: 'Not started'
                                            });
                                            toast.info('Form reset');
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 shadow-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Reset Form
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setCreateStep(s => s - 1)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 shadow-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
                                    >
                                        Back
                                    </button>
                                )}

                                {createStep < 2 ? (
                                    <button
                                        type="button"
                                        onClick={() => setCreateStep(s => Math.min(2, s + 1))}
                                        className="flex items-center justify-center gap-2 w-[200px] py-2.5 bg-blue-600 hover:bg-blue-700 transition-all text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200"
                                    >
                                        Next Step <ChevronRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        form="simulation-form"
                                        className="flex items-center justify-center gap-2 w-[200px] py-2.5 bg-zinc-800 hover:bg-zinc-700 transition-all text-white rounded-xl text-sm font-bold shadow-lg shadow-zinc-200"
                                    >
                                        <Plus className="w-4 h-4" /> {submitButtonText}
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Right: 3D Diagram Panel - Fixed width with transform for smooth animation */}
                        <div
                            className={`border-l border-gray-100 bg-slate-50 flex flex-col overflow-hidden ${showDiagram ? 'w-[760px]' : 'w-0'}`}
                        >
                            <div
                                className={`flex-1 p-4 w-[760px] transition-all duration-300 ease-out ${showDiagram ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
                                style={{ minHeight: 420 }}
                            >
                                {showDiagram && <SimulationDiagram3D formData={formData} />}
                            </div>
                        </div>
                    </div>
                )
                }


                {
                    isViewMode && (
                        <div className="flex" style={{ minHeight: 0 }}>
                            {/* Left: Attributes panel — fixed width for consistent transition */}
                            <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 580, minHeight: 0 }}>

                                {/* Saving banner */}
                                {isSimulationBeingSaved && (
                                    <div className="mx-6 mt-3 bg-gray-100 border border-gray-300 rounded-lg p-2.5 flex items-center gap-2">
                                        <Loader className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 animate-spin" />
                                        <p className="text-xs text-gray-700 font-medium">Saving changes, please wait...</p>
                                    </div>
                                )}

                                {/* Banner de modo edicion limitada */}
                                {isEditMode && formData.p_status !== 'Not started' && (
                                    <div className="mx-6 mt-3 bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-gray-600">
                                            <span className="font-semibold">Limited edit - </span>
                                            Simulation is <span className="font-medium">{formData.p_status}</span>. Only the name can be changed.
                                        </p>
                                    </div>
                                )}

                                {/* -- Step indicator + Nombre -- */}
                                <div className="px-6 pt-4 pb-2 space-y-3 border-b border-gray-100">
                                    {/* Simulation Name - siempre editable en edit mode */}
                                    <div className="flex items-center gap-3">
                                        <Field className="flex-1">
                                            <Label className="block text-xs text-gray-500 font-medium mb-1">Simulation Name</Label>
                                            <Input
                                                type="text"
                                                name="sim_name"
                                                value={formData.sim_name}
                                                onChange={handleInputChange}
                                                disabled={!isEditMode}
                                                placeholder="Simulation name..."
                                                className={clsx(
                                                    'block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-150',
                                                    'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent',
                                                    !isEditMode ? 'bg-gray-50 opacity-80 cursor-default' : 'bg-white animate-pulse-once'
                                                )}
                                            />
                                        </Field>
                                        {/* Edit / Save / Cancel inline */}
                                        {!['Running', 'Queued', 'Aborting', 'Generating mesh'].includes(formData.p_status) && !isSaving && !isSimulationBeingSaved && (
                                            <div className="flex items-end pb-0.5 gap-1.5 flex-shrink-0">
                                                {!isEditMode ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleEnableEdit}
                                                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-all border border-gray-200"
                                                        title="Edit simulation"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveEdit}
                                                            disabled={isSaving || !hasChanges}
                                                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isSaving || !hasChanges
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                                                : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
                                                        >
                                                            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelEdit}
                                                            disabled={isSaving}
                                                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-all border border-gray-200"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Step indicator (mismo que create) */}
                                    <div className="flex items-center">
                                        {[
                                            { n: 1, label: 'Bone Parameters' },
                                            { n: 2, label: 'Mesh & Tech' },
                                        ].map(({ n, label }, i) => {
                                            const isPast = n < createStep;
                                            const isCurrent = n === createStep;
                                            return (
                                                <React.Fragment key={n}>
                                                    {i > 0 && (
                                                        <div className={`h-px flex-1 mx-2 transition-colors ${isPast ? 'bg-gray-400' : 'bg-gray-200'}`} />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCreateStep(n)}
                                                        className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                                                    >
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all
                                                    ${isCurrent ? 'bg-gray-800 border-gray-800 text-white shadow-sm'
                                                                : isPast ? 'bg-gray-200 border-gray-400 text-gray-700'
                                                                    : 'bg-gray-100 border-gray-300 text-gray-400 group-hover:border-gray-400 group-hover:text-gray-500'}`}>
                                                            {isPast ? String.fromCharCode(10003) : n}
                                                        </div>
                                                        <span className={`text-xs font-semibold hidden sm:inline transition-colors
                                                    ${isCurrent ? 'text-gray-800' : isPast ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                                                            {label}
                                                        </span>
                                                    </button>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* -- Contenido del paso (scrollable) -- */}
                                <form id="simulation-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                                    <div className="px-6 py-4">

                                        {/* STEP 1: Bone Parameters */}
                                        {createStep === 1 && (
                                            <div className="space-y-4 animate-fade-in" style={{ minHeight: '340px' }}>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {[
                                                        { label: 'Emitters', name: 'n_transmitter' },
                                                        { label: 'Receivers', name: 'n_receiver' },
                                                        { label: 'Emitters Pitch', name: 'emitters_pitch', unit: 'mm' },
                                                        { label: 'Receivers Pitch', name: 'receivers_pitch', unit: 'mm' },
                                                        { label: 'Distance', name: 'sensor_distance', unit: 'mm' },
                                                        { label: 'Edge Margin', name: 'sensor_edge_margin', unit: 'mm' },
                                                        { label: 'Plate Thickness', name: 'plate_thickness', unit: 'mm' },
                                                        { label: 'Porosity', name: 'porosity', unit: '%' },
                                                    ].map((field) => (
                                                        <Field key={field.name}>
                                                            <Label className="block text-xs text-gray-500 font-medium mb-1">
                                                                {field.label} {field.unit && <span className="text-gray-400 text-[10px]">({field.unit})</span>}
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                name={field.name}
                                                                value={formData[field.name]}
                                                                onChange={handleInputChange}
                                                                step="any" min="0"
                                                                disabled={!isEditMode || !canEditAllParams}
                                                                className={clsx(
                                                                    'block w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 shadow-sm transition-colors duration-150',
                                                                    'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent',
                                                                    (!isEditMode || !canEditAllParams) ? 'bg-gray-50 opacity-80 cursor-default' : 'bg-white animate-pulse-once'
                                                                )}
                                                            />
                                                        </Field>
                                                    ))}
                                                </div>

                                                 {/* Bone Porosity (Roughness) */}
                                                <div className="grid grid-cols-2 gap-3 pt-1">
                                                    <div className="animate-fade-in">
                                                        <label className="block text-xs text-gray-500 font-medium mb-1">
                                                            Roughness Amplitude <span className="text-gray-400 text-[10px]">(mm)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            name="roughness"
                                                            value={formData.roughness}
                                                            onChange={handleInputChange}
                                                            step="any" min="0"
                                                            placeholder="0 for flat"
                                                            disabled={!isEditMode || !canEditAllParams}
                                                            className={`w-full px-2.5 py-1.5 rounded-lg text-sm text-gray-700 border transition-all ${!isEditMode || !canEditAllParams
                                                                ? 'bg-gray-50 border-gray-200 cursor-default opacity-70'
                                                                : 'bg-white border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:outline-none animate-pulse-once'}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* STEP 2: Mesh */}
                                        {createStep === 2 && (
                                            <div className="space-y-4 animate-fade-in" style={{ minHeight: '340px' }}>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field>
                                                        <Label className="block text-xs text-gray-500 font-medium mb-1">
                                                            Mesh Size <span className="text-gray-400 text-[10px]">(mm)</span>
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            name="typical_mesh_size"
                                                            value={formData.typical_mesh_size}
                                                            onChange={handleInputChange}
                                                            step="any" min="0"
                                                            disabled={!isEditMode || !canEditAllParams}
                                                            className={clsx(
                                                                'block w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 shadow-sm transition-colors duration-150',
                                                                'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent',
                                                                (!isEditMode || !canEditAllParams) ? 'bg-gray-50 opacity-80 cursor-default' : 'bg-white animate-pulse-once'
                                                            )}
                                                        />
                                                    </Field>
                                                </div>

                                                {/* Mesh Inclination */}
                                                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                        <Grid3x3 className="w-4 h-4 text-gray-500" />
                                                        Mesh Inclination
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field>
                                                            <Label className="block text-xs text-gray-500 font-medium mb-1">
                                                                Angle <span className="text-gray-400 text-[10px]">(degrees)</span>
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                name="mesh_angle"
                                                                value={formData.mesh_angle}
                                                                onChange={handleInputChange}
                                                                step="0.1" min="0" max="90"
                                                                disabled={!isEditMode || !canEditAllParams}
                                                                className={clsx(
                                                                    'block w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 shadow-sm transition-colors duration-150',
                                                                    'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent',
                                                                    (!isEditMode || !canEditAllParams) ? 'bg-gray-50 opacity-80 cursor-default' : 'bg-white animate-pulse-once'
                                                                )}
                                                            />
                                                        </Field>
                                                        <div>
                                                            <label className="block text-xs text-gray-500 font-medium mb-1">Direction</label>
                                                            <select
                                                                name="mesh_angle_direction"
                                                                value={formData.mesh_angle_direction}
                                                                onChange={handleInputChange}
                                                                disabled={!isEditMode || !canEditAllParams || Number(formData.mesh_angle) === 0}
                                                                className={`w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors duration-150 border ${(!isEditMode || !canEditAllParams || Number(formData.mesh_angle) === 0)
                                                                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-default opacity-80'
                                                                    : 'bg-white border-gray-200 text-gray-700 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:outline-none'}`}
                                                            >
                                                                <option value="none">None</option>
                                                                <option value="left">Left to Right</option>
                                                                <option value="right">Right to Left</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Attenuation & Mesh Type */}
                                                <div className="grid grid-cols-2 gap-4 pt-2">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 font-medium mb-2">
                                                            Attenuation <span className="ml-1 text-[10px] text-gray-400">(Domain)</span>
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <button type="button"
                                                                disabled={!isEditMode || !canEditAllParams}
                                                                onClick={() => isEditMode && canEditAllParams && handleInputChange({ target: { name: 'attenuation', value: 'No' } })}
                                                                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all ${!isEditMode || !canEditAllParams ? 'cursor-default' : 'cursor-pointer'}
                                                            ${formData.attenuation === 'No' || formData.attenuation === '' || formData.attenuation === 0
                                                                        ? 'border-gray-800 bg-gray-50 text-gray-800 shadow-sm'
                                                                        : 'border-gray-200 bg-white text-gray-500'}`}
                                                            >
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    <div className="text-left flex flex-col justify-center">
                                                                        <div className="font-semibold leading-none mb-0.5 text-[11px]">No</div>
                                                                        <div className="text-[9px] opacity-70 leading-none">Time</div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            <button type="button"
                                                                disabled={!isEditMode || !canEditAllParams}
                                                                onClick={() => isEditMode && canEditAllParams && handleInputChange({ target: { name: 'attenuation', value: 'Yes' } })}
                                                                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all ${!isEditMode || !canEditAllParams ? 'cursor-default' : 'cursor-pointer'}
                                                            ${formData.attenuation === 'Yes' || formData.attenuation === 1
                                                                        ? 'border-gray-800 bg-gray-50 text-gray-800 shadow-sm'
                                                                        : 'border-gray-200 bg-white text-gray-500'}`}
                                                            >
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <AudioLines className="w-3.5 h-3.5" />
                                                                    <div className="text-left flex flex-col justify-center">
                                                                        <div className="font-semibold leading-none mb-0.5 text-[11px]">Yes</div>
                                                                        <div className="text-[9px] opacity-70 leading-none">Freq</div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-gray-500 font-medium mb-2">
                                                            Mesh Type <span className="ml-1 text-[10px] text-gray-400">(Generator)</span>
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <button type="button"
                                                                disabled={!isEditMode || !canEditAllParams}
                                                                onClick={() => isEditMode && canEditAllParams && handleInputChange({ target: { name: 'mesh_type', value: 'gmsh' } })}
                                                                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all ${!isEditMode || !canEditAllParams ? 'cursor-default' : 'cursor-pointer'}
                                                            ${formData.mesh_type === 'gmsh'
                                                                        ? 'border-gray-800 bg-gray-50 text-gray-800 shadow-sm'
                                                                        : 'border-gray-200 bg-white text-gray-500'}`}
                                                            >
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <img src="/images/gmsh.png" alt="G" className="w-3.5 h-3.5 object-contain opacity-80" />
                                                                    <div className="text-left flex flex-col justify-center">
                                                                        <div className="font-semibold leading-none mb-0.5 text-[11px]">GMSH</div>
                                                                        <div className="text-[9px] opacity-70 leading-none">Opt</div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            <button type="button"
                                                                disabled={!isEditMode || !canEditAllParams}
                                                                onClick={() => isEditMode && canEditAllParams && handleInputChange({ target: { name: 'mesh_type', value: 'mshr' } })}
                                                                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all ${!isEditMode || !canEditAllParams ? 'cursor-default' : 'cursor-pointer'}
                                                            ${formData.mesh_type === 'mshr'
                                                                        ? 'border-orange-400 bg-orange-50 text-orange-800 shadow-sm'
                                                                        : 'border-gray-200 bg-white text-gray-500'}`}
                                                            >
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <img src="/images/mshr.png" alt="M" className="w-3.5 h-3.5 object-contain opacity-80" />
                                                                    <div className="text-left flex flex-col justify-center">
                                                                        <div className="font-semibold leading-none mb-0.5 text-[11px]">MSHR</div>
                                                                        <div className="text-[9px] opacity-70 leading-none text-orange-600">Old</div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </form>

                                {/* -- Footer: nav + acciones -- */}
                                <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl flex-shrink-0">
                                    {/* Navegacion entre pasos */}
                                    <div className="flex justify-between items-center px-6 py-3 border-b border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => setCreateStep(s => Math.max(1, s - 1))}
                                            disabled={createStep === 1}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCreateStep(s => Math.min(2, s + 1))}
                                            disabled={createStep === 2}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>

                                    {/* Botones de accion */}
                                    <div className="flex flex-nowrap items-center gap-1.5 px-6 py-3 overflow-x-auto no-scrollbar">
                                        {simulation && (formData.p_status === 'Not started' || formData.p_status === '0') && (() => {
                                            const hasQueuedOrRunning = allSimulations.some(sim =>
                                                sim.id !== simulation.id && (sim.p_status === 'Queued' || sim.p_status === 'Running')
                                            );
                                            const buttonText = hasQueuedOrRunning ? 'Enqueue' : 'Execute';
                                            const buttonIcon = hasQueuedOrRunning ? <Clock className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />;
                                            return (
                                                <button
                                                    onClick={async () => {
                                                        setIsExecuting(true);
                                                        const now = new Date().toISOString();
                                                        const optimisticStatus = hasQueuedOrRunning ? 'Queued' : 'Running';
                                                        setFormData(prev => ({ ...prev, p_status: optimisticStatus, start_datetime: now }));
                                                        try {
                                                            await executeSimulation(simulation.id, simulation);
                                                        } catch (error) {
                                                            setFormData(prev => ({ ...prev, p_status: 'Not started', start_datetime: null }));
                                                        } finally {
                                                            setIsExecuting(false);
                                                        }
                                                    }}
                                                    disabled={isExecuting}
                                                    type="button"
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${isExecuting ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                                >
                                                    {isExecuting ? <><Loader className="w-3.5 h-3.5 animate-spin" />{buttonText}...</> : <>{buttonIcon}{buttonText}</>}
                                                </button>
                                            );
                                        })()}

                                        {simulation && (formData.p_status === 'Running' || formData.p_status === 'Aborting') && (
                                            <button onClick={handleAbortSimulation} disabled={isAborting || formData.p_status === 'Aborting'} type="button"
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${isAborting || formData.p_status === 'Aborting' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-700 text-white'}`}>
                                                {isAborting || formData.p_status === 'Aborting'
                                                    ? <><Loader className="w-3.5 h-3.5 animate-spin" />Stopping...</>
                                                    : <><XCircle className="w-3.5 h-3.5" />Abort</>}
                                            </button>
                                        )}

                                        {simulation && (formData.p_status === 'Error' || formData.p_status === 'Finished' || formData.p_status === 'Aborted') && (
                                            <button onClick={handleRerunSimulation} disabled={isRerunning} type="button"
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${isRerunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}>
                                                {isRerunning ? <><Loader className="w-3.5 h-3.5 animate-spin" />Rerunning...</> : <><RotateCcw className="w-3.5 h-3.5" />Re-run</>}
                                            </button>
                                        )}

                                        {simulation && formData.p_status === 'Queued' && (
                                            <button onClick={handleDequeueSimulation} type="button"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0">
                                                <X className="w-3.5 h-3.5" /> Dequeue
                                            </button>
                                        )}

                                        {simulation && formData.p_status === 'Finished' && onDownloadZip && (
                                            <button onClick={() => onDownloadZip(simulation.id)} disabled={isDownloading} type="button"
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${isDownloading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                {isDownloading ? <><Loader className="w-3.5 h-3.5 animate-spin" />...</> : <><Download className="w-3.5 h-3.5" />Download</>}
                                            </button>
                                        )}

                                        {simulation && formData.mesh_type !== 'mshr' && (
                                            <button onClick={handleLoadSimulationMesh} disabled={isGeneratingMesh} type="button"
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${isGeneratingMesh ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                {isGeneratingMesh ? <><Loader className="w-3.5 h-3.5 animate-spin" />...</> : <><Grid3x3 className="w-3.5 h-3.5" />View Mesh</>}
                                            </button>
                                        )}

                                        {simulation && formData.mesh_type !== 'mshr' && (
                                            <button onClick={() => handleDownloadMeshFile('msh')} disabled={isDownloading} type="button"
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${isDownloading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                <Download className="w-3.5 h-3.5" /> MSH
                                            </button>
                                        )}

                                        {simulation && formData.p_status === 'Finished' && (
                                            <button onClick={() => setIsResultsModalOpen(true)} type="button"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0">
                                                <BarChart3 className="w-3.5 h-3.5" /> Results
                                            </button>
                                        )}

                                        {simulation && onDelete && (
                                            <button onClick={() => onDelete(simulation)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600 flex-shrink-0">
                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: 3D Diagram Panel (for View Mode) - Fixed width with transform for smooth animation */}
                            <div
                                className={`border-l border-gray-100 bg-slate-50 flex flex-col overflow-hidden ${showDiagram ? 'w-[760px]' : 'w-0'}`}
                            >
                                <div
                                    className={`flex-1 p-4 w-[760px] transition-all duration-300 ease-out ${showDiagram ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
                                    style={{ minHeight: 420 }}
                                >
                                    {showDiagram && <SimulationDiagram3D formData={formData} />}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Mesh Viewer Modal */}
                <MeshViewerModal
                    isOpen={showMeshModal}
                    onClose={() => setShowMeshModal(false)}
                    meshData={meshModalData}
                    title={meshModalTitle}
                />

                {/* Configuration Visualization Modal */}
                {
                    showConfigModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-backdrop">
                            <div className="bg-white rounded-2xl shadow-2xl w-fit max-w-[90vw] relative overflow-hidden animate-scale-in">
                                <div className="flex items-center justify-between px-6 py-4">
                                    <h2 className="text-xl font-bold text-zinc-900">Simulation {simulation?.id} configuration</h2>
                                    <button onClick={() => setShowConfigModal(false)} className="text-zinc-900 hover:text-gray-500 focus:outline-none rounded-full p-1 transition-colors">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="p-6">
                                    <SimulationPreview formData={formData} mode="view" />
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Results Modal */}
                <ResultsModal
                    isOpen={isResultsModalOpen}
                    onClose={() => setIsResultsModalOpen(false)}
                    simulation={simulation}
                />
            </div >
        </div >
    );
};

export default SimulationModal;
