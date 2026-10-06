import React, { useState, useRef } from 'react';
import { X, Upload, Grid3x3, CheckCircle2, AlertCircle, Loader2, Settings2, FileCode, Sliders } from 'lucide-react';
import simulationService from '../simulationService';
import { useToast } from '../../../hooks/useToast';

const ImportMeshModal = ({ isOpen, onClose, onSuccess }) => {
    const toast = useToast();
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [simName, setSimName] = useState('');
    const [porosity, setPorosity] = useState(10);
    const [attenuation, setAttenuation] = useState(0);
    const [roughness, setRoughness] = useState(0.2);
    const [meshAngle, setMeshAngle] = useState(0.0);
    const [meshAngleDirection, setMeshAngleDirection] = useState('none');
    const [skinLayerConfig, setSkinLayerConfig] = useState('none');
    const [skinThicknessTop, setSkinThicknessTop] = useState(1.3);
    const [skinThicknessBottom, setSkinThicknessBottom] = useState(1.3);
    const [nTransmitter, setNTransmitter] = useState(5);
    const [nReceiver, setNReceiver] = useState(24);
    const [emittersPitch, setEmittersPitch] = useState(1.0);
    const [receiversPitch, setReceiversPitch] = useState(0.4);
    const [sensorDistance, setSensorDistance] = useState(20.0);
    const [sensorEdgeMargin, setSensorEdgeMargin] = useState(10.0);
    const [typicalMeshSize, setTypicalMeshSize] = useState(0.1);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (selectedFile) => {
        if (!selectedFile) return;
        const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
        if (ext !== '.msh' && ext !== '.xml') {
            setErrorMsg('Formato no soportado. Por favor selecciona un archivo .msh (Gmsh) o .xml (FEniCS).');
            return;
        }
        setErrorMsg('');
        setFile(selectedFile);
        if (!simName) {
            const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
            setSimName(`Sim_Malla_${baseName}`);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setErrorMsg('Debes seleccionar un archivo de malla (.msh o .xml)');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sim_name', simName || `Sim_Malla_${file.name}`);
            formData.append('porosity', porosity);
            formData.append('attenuation', attenuation);
            formData.append('roughness', roughness);
            formData.append('mesh_angle', meshAngle);
            formData.append('mesh_angle_direction', Number(meshAngle) === 0 ? 'none' : meshAngleDirection);
            formData.append('skin_layer_config', skinLayerConfig);
            formData.append('skin_thickness_top', skinThicknessTop);
            formData.append('skin_thickness_bottom', skinThicknessBottom);
            formData.append('n_transmitter', nTransmitter);
            formData.append('n_receiver', nReceiver);
            formData.append('emitters_pitch', emittersPitch);
            formData.append('receivers_pitch', receiversPitch);
            formData.append('sensor_distance', sensorDistance);
            formData.append('sensor_edge_margin', sensorEdgeMargin);
            formData.append('typical_mesh_size', typicalMeshSize);

            const result = await simulationService.importMesh(formData);
            toast.success(`Malla importada correctamente: ${simName || file.name}`);
            if (onSuccess) onSuccess(result.simulation);
            onClose();
        } catch (err) {
            console.error('Error importing mesh:', err);
            setErrorMsg(err.message || 'Error al importar la malla');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                            <Grid3x3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Importar Malla de Simulación</h2>
                            <p className="text-xs text-gray-500">Cargar archivo .msh o .xml para simular con geometría fija</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Error Banner */}
                    {errorMsg && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Drag and Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                            isDragging
                                ? 'border-blue-500 bg-blue-50/50'
                                : file
                                ? 'border-emerald-400 bg-emerald-50/20'
                                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50/50'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".msh,.xml"
                            className="hidden"
                            onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                        />

                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                <FileCode className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                        {file.name}
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB · Haz clic para cambiar archivo
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Upload className="w-8 h-8 mx-auto text-blue-500 mb-1" />
                                <div className="text-sm font-semibold text-gray-700">
                                    Haz clic para buscar o arrastra tu archivo aquí
                                </div>
                                <div className="text-xs text-gray-400">
                                    Formatos compatibles: .msh (Gmsh) o .xml (FEniCS)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Simulation Name */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Nombre de la Simulación
                        </label>
                        <input
                            type="text"
                            value={simName}
                            onChange={(e) => setSimName(e.target.value)}
                            placeholder="Ej. Sim_Malla_Fija_01"
                            required
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* Main Physical & Geometric Parameters */}
                    <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 space-y-3">
                        <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                            Parámetros Físicos y de Geometría
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                    Porosidad (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={porosity}
                                    onChange={(e) => setPorosity(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                    Atenuación
                                </label>
                                <select
                                    value={attenuation}
                                    onChange={(e) => setAttenuation(Number(e.target.value))}
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                                >
                                    <option value={0}>No (Dominio Temporal)</option>
                                    <option value={1}>Sí (Dominio Frecuencial)</option>
                                </select>
                            </div>
                        </div>

                        {/* Roughness and Angle */}
                        <div className="grid grid-cols-3 gap-2.5 pt-1">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                    Rugosidad (mm)
                                </label>
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    value={roughness}
                                    onChange={(e) => setRoughness(Number(e.target.value))}
                                    placeholder="0.0"
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                    Ángulo Inclinación (°)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={meshAngle}
                                    onChange={(e) => setMeshAngle(Number(e.target.value))}
                                    placeholder="0.0"
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                    Dirección Ángulo
                                </label>
                                <select
                                    value={meshAngleDirection}
                                    onChange={(e) => setMeshAngleDirection(e.target.value)}
                                    disabled={Number(meshAngle) === 0}
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                    <option value="none">Ninguna</option>
                                    <option value="left">Izquierda</option>
                                    <option value="right">Derecha</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Parameters Toggle */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                            {showAdvanced ? 'Ocultar Parámetros de Sensores y Piel' : 'Configurar Parámetros de Sensores y Piel (Opcional)'}
                        </button>

                        {showAdvanced && (
                            <div className="mt-3 p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3 text-xs animate-fadeIn">
                                {/* Skin Layer Config */}
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Capa de Piel (Skin Layer)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <select
                                                value={skinLayerConfig}
                                                onChange={(e) => setSkinLayerConfig(e.target.value)}
                                                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                            >
                                                <option value="none">Sin Piel (none)</option>
                                                <option value="top">Superior (top)</option>
                                                <option value="bottom">Inferior (bottom)</option>
                                                <option value="both">Ambas (both)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                value={skinThicknessTop}
                                                onChange={(e) => setSkinThicknessTop(Number(e.target.value))}
                                                disabled={skinLayerConfig !== 'top' && skinLayerConfig !== 'both'}
                                                placeholder="Piel Sup (mm)"
                                                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                value={skinThicknessBottom}
                                                onChange={(e) => setSkinThicknessBottom(Number(e.target.value))}
                                                disabled={skinLayerConfig !== 'bottom' && skinLayerConfig !== 'both'}
                                                placeholder="Piel Inf (mm)"
                                                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Sensor Parameters */}
                                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-200/70">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Nº Transmisores</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={nTransmitter}
                                            onChange={(e) => setNTransmitter(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Nº Receptores</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={nReceiver}
                                            onChange={(e) => setNReceiver(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Pitch Emisor (mm)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={emittersPitch}
                                            onChange={(e) => setEmittersPitch(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Pitch Receptor (mm)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={receiversPitch}
                                            onChange={(e) => setReceiversPitch(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Distancia Sensores (mm)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={sensorDistance}
                                            onChange={(e) => setSensorDistance(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Margen de Borde (mm)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={sensorEdgeMargin}
                                            onChange={(e) => setSensorEdgeMargin(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Tamaño Malla (mm)</label>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={typicalMeshSize}
                                            onChange={(e) => setTypicalMeshSize(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Scientific Note */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                        <span className="font-bold">💡 Nota de Control Riguroso (RMSD):</span> Al importar esta malla, la discretización y coordenadas nodales quedan <strong>fijas e inalterables</strong>. Los parámetros configurados (rugosidad, ángulo, etc.) registran fielmente las propiedades del ensayo para análisis espectral y trazabilidad.
                    </div>
                </form>

                {/* Footer Buttons */}
                <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200/60 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!file || isSubmitting}
                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...
                            </>
                        ) : (
                            <>
                                <Grid3x3 className="w-3.5 h-3.5" /> Importar y Crear Simulación
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportMeshModal;
