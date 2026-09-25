import React from 'react';

/**
 * Componente que genera una visualización SVG de la configuración de la simulación
 * Muestra el hueso, transmisores y receptores con sus posiciones
 * @param {Object} formData - Datos del formulario de simulación
 * @param {string} mode - Modo de visualización: 'create' o 'view'
 */
export default function SimulationPreview({ formData, mode = 'create' }) {
  // Extraer parámetros
  const {
    sim_name = '',
    n_transmitter = 0,
    n_receiver = 0,
    emitters_pitch = 0,
    receivers_pitch = 0,
    sensor_distance = 0,
    sensor_edge_margin = 0,
    plate_thickness = 0,
    typical_mesh_size = 0,
    porosity = 0,
    attenuation = 'No',
    skin_layer_config = 'none',
    skin_thickness_top = 1.3,
    skin_thickness_bottom = 1.3
  } = formData;

  // Dimensiones del SVG - Ajustadas según el modo
  // En modo 'create' se usa un tamaño más compacto
  const svgWidth = mode === 'create' ? 800 : 1200;
  const svgHeight = mode === 'create' ? 130 : 450;
  const padding = mode === 'create' ? 35 : 40;

  // Calcular dimensiones del hueso (placa)
  const plateThickness = parseFloat(plate_thickness) || 2;
  const sensorDist = parseFloat(sensor_distance) || 5;
  const edgeMargin = parseFloat(sensor_edge_margin) || 1;

  // Capas de piel
  const hasTopSkin = skin_layer_config === 'top' || skin_layer_config === 'both';
  const hasBottomSkin = skin_layer_config === 'bottom' || skin_layer_config === 'both';
  const topSkinThickness = parseFloat(skin_thickness_top) || 1.3;
  const bottomSkinThickness = parseFloat(skin_thickness_bottom) || 1.3;

  // Altura total incluyendo capas de piel (valores reales para mostrar en texto)
  const totalThickness = plateThickness +
    (hasTopSkin ? topSkinThickness : 0) +
    (hasBottomSkin ? bottomSkinThickness : 0);

  // Grosor visual para cálculo de escala (las pieles siempre tienen tamaño fijo)
  const VISUAL_SKIN_FIXED_THICKNESS = 2.0; // mm (valor fijo para no afectar la escala)
  const visualThickness = plateThickness +
    (hasTopSkin ? VISUAL_SKIN_FIXED_THICKNESS : 0) +
    (hasBottomSkin ? VISUAL_SKIN_FIXED_THICKNESS : 0);

  // Calcular longitud de la placa basada en sensores
  const nTrans = parseInt(n_transmitter) || 0;
  const nRec = parseInt(n_receiver) || 0;
  const emitPitch = parseFloat(emitters_pitch) || 1;
  const recPitch = parseFloat(receivers_pitch) || 1;

  // Calcular ancho total necesario para los sensores
  const transWidth = nTrans > 1 ? (nTrans - 1) * emitPitch : 0;
  const recWidth = nRec > 1 ? (nRec - 1) * recPitch : 0;
  const maxSensorWidth = Math.max(transWidth, recWidth);
  const plateLength = maxSensorWidth + 2 * edgeMargin + sensorDist;

  // Escala para ajustar al SVG - Usa la mayor parte del ancho
  // IMPORTANTE: usar visualThickness para que el tamaño no cambie con grosor real de pieles
  const availableWidth = svgWidth - 2 * padding;
  const availableHeight = svgHeight * 0.55; // 55% del alto para el hueso
  const scaleX = availableWidth / Math.max(plateLength, 10);
  const scaleY = availableHeight / Math.max(visualThickness + 4, 6);
  const scale = Math.min(scaleX, scaleY);

  // Posición del rectángulo del hueso - Centrado horizontalmente
  const rectWidth = plateLength * scale;
  const rectHeight = plateThickness * scale;

  // Alturas visuales constantes para las pieles (tamaño fijo para visualización)
  const VISUAL_SKIN_HEIGHT = 20; // Altura fija en píxeles
  const topSkinHeight = VISUAL_SKIN_HEIGHT;
  const bottomSkinHeight = VISUAL_SKIN_HEIGHT;

  // Dejar más espacio a la izquierda para la etiqueta de thickness
  const leftMargin = mode === 'create' ? 80 : 100;
  const rectX = leftMargin + (svgWidth - rectWidth - leftMargin - padding) / 2;

  // Posición Y del hueso (ajustada si hay piel superior)
  const boneY = svgHeight * 0.45 + (hasTopSkin ? topSkinHeight : 0);
  const rectY = boneY;

  // Calcular posiciones de transmisores (parte superior del hueso, distribuidos en X)
  const transmitters = [];
  const transStartX = rectX + edgeMargin * scale;
  // Ajustar posición Y si hay piel superior
  const transmitterOffsetY = hasTopSkin ? -(topSkinHeight + 30) : -30;
  for (let i = 0; i < nTrans; i++) {
    transmitters.push({
      x: transStartX + i * emitPitch * scale,
      y: rectY + transmitterOffsetY, // Arriba del hueso/piella (más separado)
      id: i
    });
  }

  // Calcular posiciones de receptores (parte superior del hueso, distribuidos en X)
  const receivers = [];
  const recStartX = rectX + edgeMargin * scale + sensorDist * scale;
  for (let i = 0; i < nRec; i++) {
    receivers.push({
      x: recStartX + i * recPitch * scale,
      y: rectY + transmitterOffsetY, // Arriba del hueso/piella (más separado)
      id: i
    });
  }

  // Calcular coordenadas reales en el dominio físico
  const calculateRealCoordinates = () => {
    const transmittersReal = [];
    const receiversReal = [];

    // Transmisores en la parte superior del hueso (y=plateThickness)
    const transStartXReal = edgeMargin;
    for (let i = 0; i < nTrans; i++) {
      transmittersReal.push({
        id: i,
        x: (transStartXReal + i * emitPitch).toFixed(3),
        y: plateThickness.toFixed(3),
        z: 0
      });
    }

    // Receptores en la parte superior del hueso (y=plateThickness)
    const recStartXReal = edgeMargin + sensorDist;
    for (let i = 0; i < nRec; i++) {
      receiversReal.push({
        id: i,
        x: (recStartXReal + i * recPitch).toFixed(3),
        y: plateThickness.toFixed(3),
        z: 0
      });
    }

    return { transmittersReal, receiversReal };
  };

  const { transmittersReal, receiversReal } = calculateRealCoordinates();

  return (
    <div className="w-full space-y-6">
      {/* Parámetros de configuración - Solo en modo view */}
      {mode === 'view' && (
        <div className="bg-white rounded-xl shadow-md border border-zinc-300/50 p-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
            {/* Geometry Parameters */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Length</span>
              <span className="text-sm font-medium text-zinc-900">{plateLength.toFixed(2)} mm</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Thickness</span>
              <span className="text-sm font-medium text-zinc-900">{plateThickness.toFixed(2)} mm</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Distance</span>
              <span className="text-sm font-medium text-zinc-900">{sensorDist.toFixed(2)} mm</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Edge Margin</span>
              <span className="text-sm font-medium text-zinc-900">{edgeMargin.toFixed(2)} mm</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Mesh Size</span>
              <span className="text-sm font-medium text-zinc-900">{typical_mesh_size}</span>
            </div>

            {/* Sensor Parameters */}
            <div className="flex items-center justify-between text-[#ef4444]">
              <span className="text-sm">Transmitters</span>
              <span className="text-sm font-semibold">{nTrans}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Tx Pitch</span>
              <span className="text-sm font-medium text-zinc-900">{emitPitch.toFixed(2)} mm</span>
            </div>
            <div className="flex items-center justify-between text-[#447dfd]">
              <span className="text-sm">Receivers</span>
              <span className="text-sm font-semibold">{nRec}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Rx Pitch</span>
              <span className="text-sm font-medium text-zinc-900">{recPitch.toFixed(2)} mm</span>
            </div>

            {/* Material Parameters */}
            <div className="flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-1">
              <span className="text-sm text-zinc-600">Porosity</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-900 w-12 text-right">{porosity}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Attenuation</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-zinc-900">{attenuation === 'Yes' || attenuation === 1 ? "Yes" : "No"}</span>
              </div>
            </div>

            {/* Skin Layer Configuration */}
            {/* Skin Layer Configuration - Currently disabled
            {skin_layer_config !== 'none' && (
              <>
                <div className="flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-3 border-t border-gray-200 pt-3 mt-2">
                  <span className="text-sm font-semibold text-teal-700">Skin Layers Configuration</span>
                  <span className="text-xs font-medium text-teal-600 uppercase">{skin_layer_config}</span>
                </div>
                {hasBottomSkin && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">Bottom Skin</span>
                    <span className="text-sm font-medium text-zinc-900">{bottomSkinThickness.toFixed(2)} mm</span>
                  </div>
                )}
                {hasTopSkin && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">Top Skin</span>
                    <span className="text-sm font-medium text-zinc-900">{topSkinThickness.toFixed(2)} mm</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">Total Thickness</span>
                  <span className="text-sm font-semibold text-zinc-900">{totalThickness.toFixed(2)} mm</span>
                </div>
              </>
            )}
            */}
          </div>
        </div>
      )}

      {/* Visualización SVG */}
      <div className={`bg-white rounded-xl shadow-md border border-zinc-300/50 ${mode === 'create' ? 'p-3' : 'p-8'}`}>
        <svg width={svgWidth} height={svgHeight} className="w-full h-auto rounded-xl">
          {/* Definir gradientes y patrones */}
          <defs>
            {/* Clip path para bordes redondeados */}
            <clipPath id="boneClip">
              <rect
                x={rectX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                rx="8"
              />
            </clipPath>

            {/* Gradiente para ondas del transmisor */}
            <radialGradient id="waveGradient">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>

            {/* Filtro de sombra 3D para el hueso */}
            <filter id="bone3DShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
              <feOffset dx="3" dy="5" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Rectángulo del hueso (placa) con efectos 3D */}
          <g filter="url(#bone3DShadow)">
            {/* Imagen de fondo del hueso - cubre todo el rectángulo */}
            <image
              href="/images/bone.png"
              x={rectX}
              y={rectY}
              width={rectWidth}
              height={rectHeight}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#boneClip)"
              opacity="0.85"
            />

            {/* Overlay semi-transparente para ajustar tono */}
            <rect
              x={rectX}
              y={rectY}
              width={rectWidth}
              height={rectHeight}
              fill="rgba(245, 230, 211, 0.3)"
              rx="8"
            />

            {/* Borde del hueso */}
            <rect
              x={rectX}
              y={rectY}
              width={rectWidth}
              height={rectHeight}
              fill="none"
              stroke="#b8a890"
              strokeWidth="3"
              rx="8"
            />

            {/* Borde superior más claro */}
            <rect
              x={rectX}
              y={rectY}
              width={rectWidth}
              height={rectHeight * 0.15}
              fill="rgba(255,255,255,0.3)"
              rx="8"
            />

            {/* Borde inferior más oscuro */}
            <rect
              x={rectX}
              y={rectY + rectHeight * 0.85}
              width={rectWidth}
              height={rectHeight * 0.15}
              fill="rgba(0,0,0,0.1)"
              rx="8"
            />
          </g>

          {/* Capa de piel superior (si está habilitada) - Currently disabled
          {hasTopSkin && (
            <g>
              <rect
                x={rectX}
                y={rectY - topSkinHeight}
                width={rectWidth}
                height={topSkinHeight}
                fill="rgba(255, 228, 196, 0.8)"
                stroke="#c08457"
                strokeWidth="3"
                rx="6"
              />
              <text
                x={rectX + rectWidth / 2}
                y={rectY - topSkinHeight / 2}
                fontSize="12"
                fill="#6b4423"
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="800"
                opacity="1"
              >
                TOP: {topSkinThickness.toFixed(2)} mm
              </text>
            </g>
          )}

          {/* Capa de piel inferior (si está habilitada) - Currently disabled
          {hasBottomSkin && (
            <g>
              <rect
                x={rectX}
                y={rectY + rectHeight}
                width={rectWidth}
                height={bottomSkinHeight}
                fill="rgba(255, 218, 185, 0.8)"
                stroke="#c08457"
                strokeWidth="3"
                rx="6"
              />
              <text
                x={rectX + rectWidth / 2}
                y={rectY + rectHeight + bottomSkinHeight / 2}
                fontSize="12"
                fill="#6b4423"
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="800"
                opacity="1"
              >
                BOTTOM: {bottomSkinThickness.toFixed(2)} mm
              </text>
            </g>
          )}
          */}

          {/* Líneas de onda desde transmisores hacia el hueso */}
          {transmitters.map((trans) => (
            <g key={`wave-${trans.id}`}>
              <line
                x1={trans.x}
                y1={trans.y + 10}
                x2={trans.x}
                y2={hasTopSkin ? rectY - topSkinHeight : rectY}
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            </g>
          ))}

          {/* Líneas de recepción desde el hueso hacia receptores */}
          {receivers.map((rec) => (
            <g key={`wave-rec-${rec.id}`}>
              <line
                x1={rec.x}
                y1={hasTopSkin ? rectY - topSkinHeight : rectY}
                x2={rec.x}
                y2={rec.y + 10}
                stroke="#447dfd"
                strokeWidth="2.5"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            </g>
          ))}

          <svg width="100%" height="100%">
            <defs>
              {/* 🔹 Definición del filtro de sombra */}
              <filter id="transmitterShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="3"
                  floodColor="black"
                  floodOpacity="0.4"
                />
              </filter>
            </defs>

            {/* Transmisores (emisores) con sombra */}
            {transmitters.map((trans) => (
              <g key={`trans-${trans.id}`}>
                {/* Círculo principal con sombra */}
                <circle
                  cx={trans.x}
                  cy={trans.y}
                  r="14"
                  fill="#e74241"
                  stroke="white"
                  strokeWidth="2"
                  filter="url(#transmitterShadow)" // 👈 aplica la sombra aquí
                />

                {/* Etiqueta del transmisor */}
                <text
                  x={trans.x}
                  y={trans.y - 25}
                  fontSize="12"
                  fill="#e74241"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  T{trans.id}
                </text>
              </g>
            ))}
          </svg>


          {/* Receptores (sensores) - solo puntos sin etiquetas */}
          {receivers.map((rec, idx) => (
            <g key={`rec-${rec.id}`}>
              {/* Círculo principal con gradiente celeste */}
              <circle
                cx={rec.x}
                cy={rec.y}
                r="11"
                fill='#447dfd'
                stroke="white"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Etiquetas de dimensiones */}
          {/* Longitud de la placa */}
          <g>
            <line
              x1={rectX}
              y1={rectY + rectHeight + 20}
              x2={rectX + rectWidth}
              y2={rectY + rectHeight + 20}
              stroke="#666"
              strokeWidth="1"
              markerEnd="url(#arrowhead)"
            />
            <line
              x1={rectX}
              y1={rectY + rectHeight + 15}
              x2={rectX}
              y2={rectY + rectHeight + 25}
              stroke="#666"
              strokeWidth="1"
            />
            <line
              x1={rectX + rectWidth}
              y1={rectY + rectHeight + 15}
              x2={rectX + rectWidth}
              y2={rectY + rectHeight + 25}
              stroke="#666"
              strokeWidth="1"
            />
            <text
              x={rectX + rectWidth / 2}
              y={rectY + rectHeight + 35}
              fontSize="8"
              fill="#444"
              textAnchor="middle"
              fontWeight="600"
            >
              Length: {plateLength.toFixed(2)} mm
            </text>
          </g>

          {/* Grosor total (incluyendo capas de piel si existen) */}
          <g>
            {/* Línea principal de medición */}
            <line
              x1={leftMargin - 30}
              y1={hasTopSkin ? rectY - topSkinHeight : rectY}
              x2={leftMargin - 30}
              y2={hasBottomSkin ? rectY + rectHeight + bottomSkinHeight : rectY + rectHeight}
              stroke="#666"
              strokeWidth="1"
            />
            {/* Marca superior */}
            <line
              x1={leftMargin - 35}
              y1={hasTopSkin ? rectY - topSkinHeight : rectY}
              x2={leftMargin - 25}
              y2={hasTopSkin ? rectY - topSkinHeight : rectY}
              stroke="#666"
              strokeWidth="1"
            />
            {/* Marca inferior */}
            <line
              x1={leftMargin - 35}
              y1={hasBottomSkin ? rectY + rectHeight + bottomSkinHeight : rectY + rectHeight}
              x2={leftMargin - 25}
              y2={hasBottomSkin ? rectY + rectHeight + bottomSkinHeight : rectY + rectHeight}
              stroke="#666"
              strokeWidth="1"
            />
            {/* Etiqueta de grosor total */}
            <text
              x={leftMargin - 45}
              y={(hasTopSkin ? rectY - topSkinHeight : rectY) +
                ((hasBottomSkin ? rectY + rectHeight + bottomSkinHeight : rectY + rectHeight) -
                  (hasTopSkin ? rectY - topSkinHeight : rectY)) / 2}
              fontSize={mode === 'create' ? "7" : "8"}
              fill="#444"
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="600"
              transform={`rotate(-90, ${leftMargin - 45}, ${(hasTopSkin ? rectY - topSkinHeight : rectY) +
                ((hasBottomSkin ? rectY + rectHeight + bottomSkinHeight : rectY + rectHeight) -
                  (hasTopSkin ? rectY - topSkinHeight : rectY)) / 2})`}
            >
              {skin_layer_config !== 'none'
                ? `Total: ${totalThickness.toFixed(1)} mm`
                : `Thickness: ${plateThickness.toFixed(1)} mm`}
            </text>
          </g>

          {/* Título del hueso - estilo mejorado */}
          <text
            x={rectX + rectWidth / 2}
            y={rectY + rectHeight / 2}
            fontSize="18"
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight="800"
            opacity="0.6"
            letterSpacing="2"
          >
            CORTICAL BONE
          </text>

        </svg>
      </div>
    </div>
  );
}
