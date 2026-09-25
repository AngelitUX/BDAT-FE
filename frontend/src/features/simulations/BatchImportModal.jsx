import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    X, Upload, FileText, CheckCircle, AlertTriangle,
    ChevronDown, ChevronUp, Info, Download, Eye, EyeOff, Layers
} from 'lucide-react';
import simulationService from './simulationService';


// ─── Constantes ────────────────────────────────────────────────────────────────

const DEFAULTS = {
    n_transmitter: 8,
    n_receiver: 8,
    emitters_pitch: 1.5,
    receivers_pitch: 1.5,
    sensor_distance: 10,
    sensor_edge_margin: 5,
    typical_mesh_size: 1.5,
    plate_thickness: 10,
    porosity: 0,
    attenuation: 'No',
    mesh_type: 'gmsh',
    skin_layer_config: 'none',
    skin_thickness_top: 1.3,
    skin_thickness_bottom: 1.3,
    mesh_angle: 0,
    mesh_angle_direction: 'none',
    roughness: 0.2,
};

const REQUIRED_FIELDS = ['sim_name'];

const NUMERIC_FIELDS = [
    'n_transmitter', 'n_receiver', 'emitters_pitch', 'receivers_pitch',
    'sensor_distance', 'sensor_edge_margin', 'typical_mesh_size',
    'plate_thickness', 'porosity', 'mesh_angle', 'roughness',
    'skin_thickness_top', 'skin_thickness_bottom',
];

const STRING_FIELDS = ['attenuation', 'mesh_type', 'skin_layer_config', 'mesh_angle_direction'];

const EXAMPLE_CONTENT = `# Formato: campo=valor, campo=valor  (una simulación por línea)
# Los campos no especificados usarán valores por defecto
# Líneas que comiencen con # son ignoradas (comentarios)

sim_name=Bone_Test_A, n_transmitter=8, n_receiver=8, emitters_pitch=1.5, receivers_pitch=1.5, sensor_distance=10, sensor_edge_margin=5, typical_mesh_size=1.5, plate_thickness=10, porosity=0, attenuation=No, mesh_type=gmsh, mesh_angle=0, mesh_angle_direction=none, roughness=0.2
sim_name=Bone_Test_B, n_transmitter=16, n_receiver=16, emitters_pitch=1.0, receivers_pitch=1.0, sensor_distance=15, sensor_edge_margin=3, typical_mesh_size=1.0, plate_thickness=8, porosity=5, attenuation=Yes, mesh_type=gmsh, skin_layer_config=none
sim_name=Skin_Test_C, n_transmitter=8, n_receiver=8, emitters_pitch=2.0, receivers_pitch=2.0, sensor_distance=12, sensor_edge_margin=4, typical_mesh_size=2.0, plate_thickness=12, porosity=10, attenuation=No, mesh_type=gmsh, skin_layer_config=both, skin_thickness_top=1.5, skin_thickness_bottom=1.5, mesh_angle=5, mesh_angle_direction=left`;

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseLine(line, lineNumber) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    const sim = { ...DEFAULTS };
    const errors = [];
    const warnings = [];

    const pairs = trimmed.split(',').map(p => p.trim()).filter(Boolean);

    for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) {
            warnings.push(`Pair ignored (no "="): "${pair}"`);
            continue;
        }
        const key = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();

        if (NUMERIC_FIELDS.includes(key)) {
            const num = Number(val);
            if (isNaN(num)) {
                errors.push(`"${key}" must be numeric (got "${val}")`);
            } else {
                sim[key] = num;
            }
        } else if (STRING_FIELDS.includes(key) || key === 'sim_name') {
            sim[key] = val;
        } else {
            warnings.push(`Unknown field ignored: "${key}"`);
        }
    }

    for (const f of REQUIRED_FIELDS) {
        if (!sim[f] || String(sim[f]).trim() === '') {
            errors.push(`Required field missing: "${f}"`);
        }
    }

    if (sim.n_transmitter < 1) errors.push('n_transmitter must be >= 1');
    if (sim.n_receiver < 1) errors.push('n_receiver must be >= 1');
    if (sim.emitters_pitch <= 0) errors.push('emitters_pitch must be > 0');
    if (sim.receivers_pitch <= 0) errors.push('receivers_pitch must be > 0');
    if (sim.sensor_distance <= 0) errors.push('sensor_distance must be > 0');
    if (sim.sensor_edge_margin < 0) errors.push('sensor_edge_margin must be >= 0');
    if (sim.typical_mesh_size <= 0) errors.push('typical_mesh_size must be > 0');
    if (sim.plate_thickness <= 0) errors.push('plate_thickness must be > 0');
    if (sim.porosity < 0 || sim.porosity > 100) errors.push('porosity must be 0–100');
    if (sim.roughness < 0) errors.push('roughness must be >= 0');

    return {
        lineNumber,
        raw: trimmed,
        data: sim,
        errors,
        warnings,
        isValid: errors.length === 0,
    };
}

function parseFileContent(content) {
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        const parsed = parseLine(lines[i], i + 1);
        if (parsed !== null) results.push(parsed);
    }
    return results;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge = ({ isValid, errorCount, warningCount }) => {
    if (!isValid) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                <AlertTriangle className="w-3 h-3" />
                {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
        );
    }
    if (warningCount > 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            <CheckCircle className="w-3 h-3" />
            OK
        </span>
    );
};

const SimPreviewRow = ({ item, index }) => {
    const [expanded, setExpanded] = useState(false);
    const { data, errors, warnings, isValid, lineNumber } = item;

    return (
        <div className={`rounded-xl border ${isValid ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50/40'} overflow-hidden transition-all`}>
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/70 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <span className="text-xs text-gray-400 font-mono w-6 text-right flex-shrink-0">#{lineNumber}</span>
                <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
                    {data.sim_name || <span className="text-red-500 italic">No sim_name</span>}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                        {data.n_transmitter}Tx · {data.n_receiver}Rx · {data.typical_mesh_size}mm mesh
                    </span>
                    <StatusBadge isValid={isValid} errorCount={errors.length} warningCount={warnings.length} />
                    <div className="text-gray-400">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {errors.length > 0 && (
                        <div className="space-y-1">
                            {errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {e}
                                </p>
                            ))}
                        </div>
                    )}
                    {warnings.length > 0 && (
                        <div className="space-y-1">
                            {warnings.map((w, i) => (
                                <p key={i} className="text-xs text-amber-600 flex items-center gap-1.5">
                                    <Info className="w-3 h-3 flex-shrink-0" /> {w}
                                </p>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
                        {Object.entries(data).filter(([k]) => k !== 'sim_name').map(([k, v]) => (
                            <div key={k} className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{k.replace(/_/g, ' ')}</span>
                                <span className="text-xs font-medium text-gray-700 truncate">{String(v)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Importing Overlay Modal ────────────────────────────────────────────────
// Shown when a batch import is running OR when a stale session is detected on reload.

const ImportingOverlayModal = ({ importStatus, onStop, isStopping, isInterrupted, isDone, wasCancelled, onDismiss, onDismissDone }) => {
    const { total = 0, current_index = 0, current_name = '', processed } = importStatus || {};
    const finalCount = processed ?? current_index;
    const progress = total > 0 ? Math.round((current_index / total) * 100) : 0;

    // Countdown ring for auto-close
    const [countdown, setCountdown] = useState(3);
    useEffect(() => {
        if (!isDone) return;
        setCountdown(3);
        const iv = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(iv);
    }, [isDone]);

    const headerBg = isDone
        ? wasCancelled
            ? 'bg-gradient-to-r from-red-50 to-orange-50'
            : 'bg-gradient-to-r from-green-50 to-emerald-50'
        : isInterrupted
            ? 'bg-gradient-to-r from-amber-50 to-orange-50'
            : 'bg-gradient-to-r from-indigo-50 to-blue-50';

    const iconBg = isDone
        ? wasCancelled ? 'bg-red-500' : 'bg-green-500'
        : isInterrupted ? 'bg-amber-500' : 'bg-indigo-600';

    const title = isDone
        ? wasCancelled ? 'Import Stopped' : 'Import Complete!'
        : isInterrupted ? 'Import Interrupted' : 'Batch Import in Progress';

    const subtitle = isDone
        ? wasCancelled
            ? `${finalCount} of ${total} simulations were created`
            : `All ${finalCount} simulation${finalCount !== 1 ? 's' : ''} created successfully`
        : isInterrupted
            ? 'The page was reloaded during the import'
            : 'Do not close the application';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-100 animate-scale-in">

                {/* Header */}
                <div className={`flex items-center gap-3 px-6 py-5 border-b border-gray-100 ${headerBg}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${iconBg}`}>
                        {isDone
                            ? wasCancelled
                                ? <X className="w-5 h-5 text-white" />
                                : <CheckCircle className="w-5 h-5 text-white" />
                            : <Layers className="w-5 h-5 text-white" />
                        }
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                        <p className="text-xs text-gray-500">{subtitle}</p>
                    </div>
                </div>

                <div className="p-6 flex flex-col items-center gap-5">

                    {/* Interrupted warning banner */}
                    {isInterrupted && !isDone && (
                        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-800">Import was interrupted by a page reload</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    Simulations created before the reload are saved in the list.
                                    You can re-import the remaining ones from the upload step.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Visual indicator */}
                    {isDone ? (
                        /* Done state: big icon + countdown ring */
                        <div className="relative flex items-center justify-center">
                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                                <circle cx="48" cy="48" r="42" strokeWidth="6"
                                    className={wasCancelled ? 'stroke-red-100' : 'stroke-green-100'}
                                    fill="none" />
                                <circle cx="48" cy="48" r="42" strokeWidth="6"
                                    className={wasCancelled ? 'stroke-red-400' : 'stroke-green-500'}
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 42}`}
                                    strokeDashoffset={`${2 * Math.PI * 42 * (countdown / 3)}`}
                                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                {wasCancelled
                                    ? <X className="w-10 h-10 text-red-500" />
                                    : <CheckCircle className="w-10 h-10 text-green-500" />
                                }
                            </div>
                        </div>
                    ) : !isInterrupted ? (
                        /* Running state: spinner */
                        <div className="relative">
                            <div className={`w-20 h-20 rounded-full border-4 ${isStopping
                                ? 'border-red-100 border-t-red-500 animate-pulse'
                                : 'border-indigo-100 border-t-indigo-600 animate-spin'
                                }`} />
                            <p className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${isStopping ? 'text-red-600' : 'text-indigo-700'}`}>
                                {progress}%
                            </p>
                        </div>
                    ) : null}

                    {/* Status text */}
                    {!isDone && (
                        <div className="text-center space-y-1">
                            <p className="text-base font-semibold text-gray-800">
                                {isInterrupted
                                    ? `${current_index} of ${total} simulations were created`
                                    : isStopping
                                        ? 'Stopping import…'
                                        : 'Creating simulations…'}
                            </p>
                            {isInterrupted && current_name && (
                                <p className="text-xs text-gray-400 font-mono" title={current_name}>
                                    Last: {current_name}
                                </p>
                            )}
                            {!isInterrupted && !isStopping && current_name && (
                                <div className="space-y-0.5">
                                    <p className="text-sm text-gray-500">
                                        Simulation <span className="font-bold text-indigo-600">{current_index}</span> of <span className="font-bold">{total}</span>
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono truncate max-w-xs" title={current_name}>
                                        {current_name}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Done message */}
                    {isDone && (
                        <div className="text-center space-y-1">
                            <p className="text-base font-semibold text-gray-800">
                                {wasCancelled
                                    ? `Import stopped — ${finalCount} of ${total} simulations created`
                                    : `${finalCount} simulation${finalCount !== 1 ? 's' : ''} created successfully!`
                                }
                            </p>
                            {!wasCancelled && (
                                <p className="text-xs text-gray-400">Closing in {countdown}s…</p>
                            )}
                        </div>
                    )}

                    {/* Progress bar (only while running) */}
                    {!isDone && (
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isInterrupted
                                    ? 'bg-amber-400'
                                    : isStopping
                                        ? 'bg-red-500'
                                        : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                                    }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                    {/* Action button */}
                    {isDone ? (
                        <button
                            onClick={onDismissDone}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${wasCancelled
                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                }`}
                        >
                            <CheckCircle className="w-4 h-4" /> Close
                        </button>
                    ) : isInterrupted ? (
                        <button
                            onClick={onDismiss}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-all shadow-sm"
                        >
                            <X className="w-4 h-4" /> Dismiss
                        </button>
                    ) : (
                        <button
                            onClick={onStop}
                            disabled={isStopping}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${isStopping
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:shadow'
                                }`}
                        >
                            <X className="w-4 h-4" /> Stop Import
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main component ──────────────────────────────────────────────────────────

export default function BatchImportModal({
    isOpen,
    onClose,
    onImport,
    onImportStart,
    onImportEnd,
    externalImportInProgress = false,
    onCancelImportRequest,
    onWaitForMesh,
    onDeleteSimulation,
    importStatusFromBackend = null,
    importWasInterrupted = false,
}) {
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState('');
    const [rawContent, setRawContent] = useState('');
    const [parsedItems, setParsedItems] = useState([]);
    const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'done'
    const [importResults, setImportResults] = useState([]);
    const [showExample, setShowExample] = useState(false);
    const stopRef = useRef(false);
    const [isStopping, setIsStopping] = useState(false);
    const isImportingRef = useRef(false);
    // Local flag: true while we are waiting for backend to start the import
    const [isImportingLocally, setIsImportingLocally] = useState(false);
    // 'idle' | 'running' | 'completed' | 'cancelled'
    const [overlayPhase, setOverlayPhase] = useState('idle');
    const overlayAutoCloseRef = useRef(null);
    const [importError, setImportError] = useState(null);
    const [isResettingSession, setIsResettingSession] = useState(false);

    // Sync backend cancelling state
    useEffect(() => {
        if (importStatusFromBackend?.is_cancelling) {
            setIsStopping(true);
        }
    }, [importStatusFromBackend?.is_cancelling]);

    // Sync overlayPhase with parent's externalImportInProgress
    // When parent drops to false, move from 'running' to 'completed'/'cancelled'
    const prevExternalRef = useRef(false);
    useEffect(() => {
        const wasRunning = prevExternalRef.current;
        prevExternalRef.current = externalImportInProgress;

        if (externalImportInProgress && overlayPhase !== 'running') {
            setOverlayPhase('running');
            setIsImportingLocally(false); // WS is now the source of truth
        } else if (!externalImportInProgress && (wasRunning || isImportingRef.current)) {
            // Import ended — show completion screen
            // Check state ref instead of local state to avoid effect dependency issues
            const wasStopping = importStatusFromBackend?.is_cancelling || isStopping;
            setOverlayPhase(wasStopping ? 'cancelled' : 'completed');
            setIsStopping(false);
            isImportingRef.current = false;
            setIsImportingLocally(false);
            if (onImportEnd) onImportEnd();

            // Auto-close after 3 seconds ONLY if completed successfully
            // If it was cancelled, we stay open until the user manually dismisses it.
            if (!wasStopping) {
                if (overlayAutoCloseRef.current) clearTimeout(overlayAutoCloseRef.current);
                overlayAutoCloseRef.current = setTimeout(() => {
                    handleClose();
                }, 3000);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalImportInProgress]); // intentionally omitted `isStopping` to avoid multiple execution

    // Cleanup timer on unmount
    useEffect(() => () => { if (overlayAutoCloseRef.current) clearTimeout(overlayAutoCloseRef.current); }, []);

    const validItems = parsedItems.filter(p => p.isValid);
    const invalidItems = parsedItems.filter(p => !p.isValid);

    // ── File reading ─────────────────────────────────────────────────────────
    const processFileContent = useCallback((content, name) => {
        setFileName(name);
        setRawContent(content);
        const items = parseFileContent(content);
        setParsedItems(items);

        setStep('preview');
        stopRef.current = false;
        setIsStopping(false);
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => processFileContent(evt.target.result, file.name);
        reader.readAsText(file);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => processFileContent(evt.target.result, file.name);
        reader.readAsText(file);
    }, [processFileContent]);

    // ── Import ───────────────────────────────────────────────────────────────
    // All import logic now runs in the backend (Celery task) so it survives
    // page reloads. The frontend just sends the data and listens for WS events.
    const handleImport = async () => {
        if (validItems.length === 0) return;
        if (isImportingRef.current) return;

        // Coerce parsed string values to the correct types
        const simulations = validItems.map(item => ({
            ...item.data,
            n_transmitter: parseInt(item.data.n_transmitter),
            n_receiver: parseInt(item.data.n_receiver),
            emitters_pitch: parseFloat(item.data.emitters_pitch),
            receivers_pitch: parseFloat(item.data.receivers_pitch),
            sensor_distance: parseFloat(item.data.sensor_distance),
            sensor_edge_margin: parseFloat(item.data.sensor_edge_margin),
            typical_mesh_size: parseFloat(item.data.typical_mesh_size),
            plate_thickness: parseFloat(item.data.plate_thickness),
            porosity: parseFloat(item.data.porosity),
            attenuation: item.data.attenuation === 'Yes' ? 1 : 0,
            mesh_angle: parseFloat(item.data.mesh_angle || 0),
            roughness: parseFloat(item.data.roughness !== undefined && item.data.roughness !== '' ? item.data.roughness : 0.2),
            skin_thickness_top: parseFloat(item.data.skin_thickness_top || 1.3),
            skin_thickness_bottom: parseFloat(item.data.skin_thickness_bottom || 1.3),
        }));

        isImportingRef.current = true;
        setIsImportingLocally(true);
        if (onImportStart) onImportStart();

        setImportError(null);
        try {
            // Dispatch to backend Celery task — returns immediately (HTTP 202)
            await simulationService.importRun(simulations);
            // Fast polling fallback to handle cases where backend finished in <200ms
            const pollCheck = setInterval(async () => {
                try {
                    const st = await simulationService.importStatus();
                    if (!st.active && isImportingRef.current) {
                        clearInterval(pollCheck);
                        isImportingRef.current = false;
                        setIsImportingLocally(false);
                        const wasStopping = st.is_cancelling || isStopping;
                        setOverlayPhase(wasStopping ? 'cancelled' : 'completed');
                        setIsStopping(false);
                        if (onImportEnd) onImportEnd();
                        if (!wasStopping) {
                            if (overlayAutoCloseRef.current) clearTimeout(overlayAutoCloseRef.current);
                            overlayAutoCloseRef.current = setTimeout(() => {
                                handleClose();
                            }, 2500);
                        }
                    }
                } catch (_) {
                    clearInterval(pollCheck);
                }
            }, 400);
            setTimeout(() => clearInterval(pollCheck), 8000);
        } catch (err) {
            isImportingRef.current = false;
            setIsImportingLocally(false);
            setOverlayPhase('idle');
            if (onImportEnd) onImportEnd();
            const errMsg = err.message || '';
            if (errMsg.includes('already running') || errMsg.includes('409')) {
                setImportError('Una sesión de importación previa quedó bloqueada o en ejecución en el servidor. Puedes pulsar "Desbloquear Sesión" para limpiarla.');
            } else {
                setImportError(errMsg || 'Error al iniciar la importación.');
            }
            return;
        }
    };

    const handleStop = async () => {
        setIsStopping(true);
        // Tell the backend to cancel — sets a Redis flag the Celery task checks
        await simulationService.importCancel();
    };

    const handleForceResetSession = async () => {
        setIsResettingSession(true);
        try {
            await simulationService.importReset();
            setImportError(null);
        } catch (e) {
            setImportError(`Error al reiniciar sesión: ${e.message}`);
        } finally {
            setIsResettingSession(false);
        }
    };


    // ── Reset ────────────────────────────────────────────────────────────────
    // Clears ALL import state so a fresh import can start immediately.
    const handleReset = () => {
        setFileName('');
        setRawContent('');
        setParsedItems([]);
        setImportResults([]);
        setStep('upload');
        setImportError(null);
        stopRef.current = false;
        setIsStopping(false);
        setIsImportingLocally(false);
        setOverlayPhase('idle');
        isImportingRef.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        if (externalImportInProgress) return; // Cannot close while importing
        handleReset();
        onClose();
    };

    // ── Download template ────────────────────────────────────────────────────
    const handleDownloadTemplate = () => {
        const blob = new Blob([EXAMPLE_CONTENT], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'simulations_template.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ── Dismiss (interrupted mode) ────────────────────────────────────────────
    // Called when the user dismisses the stale import session after a page reload.
    const handleDismiss = async () => {
        await simulationService.importEnd();
        if (onImportEnd) onImportEnd();
        handleReset();
        onClose();
    };

    // ── Show the importing overlay ────────────────────────────────────────────
    // 'running'  → actively importing (driven by WS)
    // 'completed' / 'cancelled' → brief success/cancel screen before auto-close
    // isImportingLocally → local optimistic flag while waiting for first WS event
    const showOverlay = isImportingLocally
        || overlayPhase === 'running'
        || overlayPhase === 'completed'
        || overlayPhase === 'cancelled'
        || importWasInterrupted;

    if (showOverlay) {
        const isDone = overlayPhase === 'completed' || overlayPhase === 'cancelled';
        const overlayStatus = importStatusFromBackend
            ? importStatusFromBackend
            : { total: validItems.length, current_index: 0, current_name: '' };
        return (
            <ImportingOverlayModal
                importStatus={overlayStatus}
                onStop={handleStop}
                isStopping={isStopping}
                isInterrupted={importWasInterrupted}
                isDone={isDone}
                wasCancelled={overlayPhase === 'cancelled'}
                onDismiss={handleDismiss}
                onDismissDone={handleClose}
            />
        );
    }

    if (!isOpen) return null;

    const successCount = importResults.filter(r => r.success).length;
    const failedCount = importResults.filter(r => !r.success).length;

    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Batch Import Simulations</h2>
                            <p className="text-xs text-gray-500">Upload a text file to create multiple simulations at once</p>
                        </div>
                    </div>
                </div>

                {/* ── Step indicator ── */}
                <div className="flex items-center px-6 py-3 border-b border-gray-100 bg-gray-50/60 gap-3 flex-shrink-0">
                    {['upload', 'preview', 'done'].map((s, i) => {
                        const labels = ['Upload', 'Preview', 'Done'];
                        const currentIdx = ['upload', 'preview', 'done'].indexOf(step);
                        const isPast = i < currentIdx;
                        const isCurrent = s === step;
                        return (
                            <React.Fragment key={s}>
                                {i > 0 && <div className={`h-px flex-1 ${isPast || isCurrent ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
                                <div className={`flex items-center gap-1.5 ${isCurrent ? 'text-indigo-700' : isPast ? 'text-indigo-400' : 'text-gray-400'}`}>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
                                        ${isCurrent ? 'bg-indigo-600 border-indigo-600 text-white' : isPast ? 'bg-indigo-100 border-indigo-300 text-indigo-600' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>
                                        {isPast ? '✓' : i + 1}
                                    </div>
                                    <span className="text-xs font-medium hidden sm:inline">{labels[i]}</span>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto">

                    {/* Banner de error o sesión bloqueada */}
                    {importError && (
                        <div className="mx-6 mt-4 mb-2 flex items-start justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 animate-fade-in">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold">Atención con la sesión de importación</p>
                                    <p className="text-xs text-amber-700 mt-0.5">{importError}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleForceResetSession}
                                disabled={isResettingSession}
                                className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                            >
                                {isResettingSession ? 'Desbloqueando...' : 'Desbloquear Sesión'}
                            </button>
                        </div>
                    )}

                    {/* ── STEP: Upload ──────────────────────────────────── */}
                    {step === 'upload' && (
                        <div className="p-6 space-y-5">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                                    ${dragOver
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30 bg-gray-50'}`}
                            >
                                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
                                <p className="text-sm font-semibold text-gray-700">Drop your file here or click to upload</p>
                                <p className="text-xs text-gray-400 mt-1">Accepts .txt files — one simulation per line</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,text/plain"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                        <Info className="w-4 h-4" /> File format
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowExample(v => !v); }}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                                        >
                                            {showExample ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            {showExample ? 'Hide' : 'Show'} example
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                                        >
                                            <Download className="w-3 h-3" /> Download template
                                        </button>
                                    </div>
                                </div>
                                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                    <li>One simulation per line</li>
                                    <li>Format: <code className="bg-blue-100 px-1 rounded font-mono">field=value, field=value, ...</code></li>
                                    <li>Lines starting with <code className="bg-blue-100 px-1 rounded font-mono">#</code> are comments</li>
                                    <li><strong>Required:</strong> <code className="bg-blue-100 px-1 rounded font-mono">sim_name</code> — all other fields have defaults</li>
                                </ul>
                                {showExample && (
                                    <pre className="mt-3 text-[11px] bg-white border border-blue-200 rounded-lg p-3 overflow-x-auto text-gray-700 font-mono leading-relaxed">
                                        {EXAMPLE_CONTENT}
                                    </pre>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP: Preview ──────────────────────────────────── */}
                    {step === 'preview' && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 font-medium">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    {fileName}
                                </div>
                                <span className="text-xs text-gray-500">{parsedItems.length} row{parsedItems.length !== 1 ? 's' : ''} found</span>
                                {validItems.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold border border-green-200">
                                        <CheckCircle className="w-3 h-3" /> {validItems.length} valid
                                    </span>
                                )}
                                {invalidItems.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold border border-red-200">
                                        <AlertTriangle className="w-3 h-3" /> {invalidItems.length} invalid (will be skipped)
                                    </span>
                                )}
                                <button
                                    onClick={handleReset}
                                    className="ml-auto text-xs text-gray-500 hover:text-indigo-600 font-medium underline"
                                >
                                    Upload different file
                                </button>
                            </div>

                            {parsedItems.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                    <p className="text-sm">No valid rows found in the file.</p>
                                    <p className="text-xs mt-1">Make sure lines follow the format: <code className="font-mono bg-gray-100 px-1 rounded">sim_name=X, field=value, ...</code></p>
                                </div>
                            )}

                            <div className="space-y-2">
                                {parsedItems.map((item, i) => (
                                    <SimPreviewRow key={i} item={item} index={i} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── STEP: Done ───────────────────────────────────────── */}
                    {step === 'done' && (
                        <div className="p-6 space-y-4">
                            <div className={`flex items-center gap-3 p-4 rounded-xl ${failedCount === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                                {failedCount === 0
                                    ? <CheckCircle className="w-7 h-7 text-green-600 flex-shrink-0" />
                                    : <AlertTriangle className="w-7 h-7 text-amber-600 flex-shrink-0" />}
                                <div>
                                    <p className={`font-semibold text-sm ${failedCount === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                                        {failedCount === 0
                                            ? `All ${successCount} simulation${successCount !== 1 ? 's' : ''} created successfully!`
                                            : `${successCount} created, ${failedCount} failed`}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {failedCount === 0
                                            ? 'Your simulations are ready in the list.'
                                            : 'Some simulations could not be created. See details below.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {importResults.map((r, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${r.success
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'}`}
                                    >
                                        {r.success
                                            ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                                        <span className={`font-medium flex-1 ${r.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {r.name}
                                        </span>
                                        {!r.success && (
                                            <span className="text-xs text-red-600 truncate max-w-[200px]" title={r.error}>
                                                {r.error}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex-shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {step === 'done' ? 'Close' : 'Cancel'}
                    </button>

                    <div className="flex gap-3">
                        {step === 'preview' && (
                            <>
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={validItems.length === 0}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all
                                        ${validItems.length === 0
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'}`}
                                >
                                    <Upload className="w-4 h-4" />
                                    Import {validItems.length} simulation{validItems.length !== 1 ? 's' : ''}
                                </button>
                            </>
                        )}

                        {step === 'done' && (
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Import more
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
