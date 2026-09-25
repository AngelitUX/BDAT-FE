
import gmsh
import math
import random
import os
import meshio
import numpy as np
from scipy.interpolate import interp1d

def create_rectangle_mesh(
    zlim=None, 
    ylim=20, 
    dxt=1.0, 
    mesh_angle=0.0, 
    mesh_angle_direction='none',
    porosity=0,
    roughness=0.2,
    n_transmitter=1, 
    n_receiver=1,
    emitter_pitch=1.0, 
    receiver_pitch=0.4,
    sensor_distance=20.0, 
    sensor_edge_margin=10.0,
    filename="mesh",
    use_porosity=True
):
    """
    Genera una malla rectangular 2D con refinamiento adaptativo y geometría avanzada.
    Adapta la lógica de generación a parámetros físicos de transductores y rugosidad.
    """
    
    # ---------------------------------------------------------
    # 0. Mapeo de Parámetros
    # ---------------------------------------------------------
    # Aliases to match user snippet logic
    n_tx = n_transmitter
    n_rx = n_receiver
    tp = emitter_pitch
    rp = receiver_pitch
    distance = sensor_distance
    edge_margin = sensor_edge_margin
    
    dx = dxt  # Paso de discretización (mesh_fine)
    
    # Parámetros geométricos verticales
    th = ylim
    
    # Parámetros de interfaz
    angle = mesh_angle
    
    # ---------------------------------------------------------
    # 1. Calculo de Dimensiones y Posiciones
    # ---------------------------------------------------------
    L_calculated = (
        2 * edge_margin
        + (n_tx - 1) * tp
        + (n_rx - 1) * rp
        + distance
    )
    # Por defecto usamos L calculado. Si el usuario proveyó zlim y es "similar" (o mayor), 
    # podemos usar zlim
    L = L_calculated
    if zlim and zlim > L:
         L = zlim

    # Si el dominio total es mayor que el largo ocupado por sensores + márgenes,
    # centrar ese bloque para que la región refinada quede en el centro de la figura.
    layout_offset = max(0.0, 0.5 * (L - L_calculated))

    # Sistema de coordenadas: 0 a L para compatibilidad con servicios que esperan Positive Coords
    # Aunque el snippet de matlab usaba -L/2 a L/2, cambiaremos a 0 a L y ajustaremos las formulas.
    
    # Posiciones de Sensores (TX)
    # Empiezan después del margen izquierdo 
    x0 = 0.0
    tx_positions = [
        x0 + layout_offset + edge_margin + i * tp
        for i in range(n_tx)
    ]
    
    # Posiciones de Receptores (RX)
    # Empiezan a 'distance' del último TX
    rx_start_pos = tx_positions[-1] + distance
    rx_positions = [
        rx_start_pos + i * rp
        for i in range(n_rx)
    ]
    
    # Zona Fina: toda la zona interior excepto los márgenes de borde.
    # Los márgenes (edge_margin a cada lado) son coarse; el resto es fino.
    fine_start = layout_offset + edge_margin
    fine_end   = L - layout_offset - edge_margin


    # ---------------------------------------------------------
    # 2. Configuración de Gmsh
    # ---------------------------------------------------------
    gmsh.initialize()
    # Limpiar cualquier modelo previo
    gmsh.clear()
    model_name = os.path.basename(filename)
    gmsh.model.add(model_name)
    
    gmsh.option.setNumber("General.Terminal", 1)

    # ---------------------------------------------------------
    # 3. Generación de Puntos de Interfaz (Geometría)
    # ---------------------------------------------------------
    mesh_fine = dx
    mesh_coarse = dx * 3.0 # Factor menos agresivo que antes

    # Construir x_domain con espaciado diferenciado por zona:
    #   - Bordes  [0, fine_start] y [fine_end, L]: espaciado mesh_coarse → elementos grandes
    #   - Interior [fine_start, fine_end]:           espaciado dx          → elementos pequeños
    # La zona fina cubre TODA la región central (sensores + espacio entre ellos).

    # Margen izquierdo: [0, fine_start] con espaciado coarse
    if fine_start > 0:
        n_left = max(2, int(np.ceil(fine_start / mesh_coarse)) + 1)
        x_left = np.linspace(0, fine_start, n_left)
    else:
        x_left = np.array([0.0])

    # Zona fina: [fine_start, fine_end] con espaciado dx
    n_fine = max(2, int(np.ceil((fine_end - fine_start) / dx)) + 1)
    x_fine = np.linspace(fine_start, fine_end, n_fine)

    # Margen derecho: [fine_end, L] con espaciado coarse
    if fine_end < L:
        n_right = max(2, int(np.ceil((L - fine_end) / mesh_coarse)) + 1)
        x_right = np.linspace(fine_end, L, n_right)
    else:
        x_right = np.array([L])

    # Combinar todas las zonas + posiciones exactas de sensores
    sensor_positions = np.array(tx_positions + rx_positions, dtype=float)
    x_domain = np.unique(np.concatenate((x_left, x_fine, x_right, sensor_positions)))
        
    
    # --- Cálculo de Altura de Interfaz ---
    # Top en y = th (ylim). Bottom en y ~ 0.
    # Pivote de rotación: Centro de la placa.
    pos_ref = L / 2.0
    
    tan_val = 0.0
    if mesh_angle_direction != 'none' and angle != 0:
        sign = 1.0 if mesh_angle_direction == 'right' else -1.0
        tan_val = np.tan(np.deg2rad(angle)) * sign

    interface_y = (tan_val * (x_domain - pos_ref))
    
    # ---------------------------------------------------------
    # Porosidad (Ruido en la interfaz) - Implementación estilo MATLAB
    # ---------------------------------------------------------
    # Según user: 
    # angle = 1; amp = 0.2; res = 2; ...
    # int = (-th+tand(angle)*(x-pos_ref)) + amp*Y;
    
    amp = roughness  #entre [0, 1] mm
    res = 1.0  # mm (resolución espacial del ruido como en el script MATLAB)
    # Simular: Nn = res/dx
    # En el script MATLAB: y = rand(L/res, 1)
    # Esto genera valores aleatorios espaciados cada 'res' mm.

    num_noise_points = int(np.ceil(L / res))
    print(f"Num noise points: {num_noise_points}")
    if num_noise_points < 2: 
        num_noise_points = 2
        
    # Coordenadas X donde se define el ruido (cada 'res' mm)
    noise_x_knots = np.linspace(0, L, num_noise_points)
    
    # Valores de ruido entre 0 y 1 (como rand())
    noise_y_values = np.random.rand(num_noise_points)
    
    # Interpolación lineal para mapear el ruido a la resolución de la malla (dx)
    # Esto corresponde a Y = interp(y, Nn)
    f_interp = interp1d(noise_x_knots, noise_y_values, kind='linear', fill_value="extrapolate")
    
    # Evaluar en el dominio de la malla
    if use_porosity:
        Y = f_interp(x_domain)
        # Corrección de bordes: forzar 0 en los extremos para evitar problemas de geometría
        # Esto no está en el MATLAB pero es CRÍTICO para que Gmsh cierre el loop
        Y[0] = 0.0
        Y[-1] = 0.0
    else:
        Y = np.zeros_like(x_domain)
    
    # Aplicar a la interfaz: int = (...) + amp*Y
    interface_y += amp * Y
    
    # ---------------------------------------------------------
    # 4. Creación de Entidades Gmsh (Puntos y Líneas)
    # ---------------------------------------------------------
    
    top_p_tags = []
    bot_p_tags = []
    
    # Crear puntos del contorno
    # Usamos refinamiento simple basado en posición X
    for i, xi in enumerate(x_domain):
        yi_bot = interface_y[i]
        yi_top = th
        
        # Refinamiento local en puntos del boundary
        if fine_start <= xi <= fine_end:
            lc = mesh_fine
        else:
            lc = mesh_coarse
            
        pt = gmsh.model.geo.addPoint(xi, yi_top, 0, lc)
        top_p_tags.append(pt)
        
        pb = gmsh.model.geo.addPoint(xi, yi_bot, 0, lc)
        bot_p_tags.append(pb)

    # Curvas robustas por tramos lineales (evita fallos de recuperación con ciertos espesores)
    top_lines = []
    bot_lines = []

    for i in range(len(top_p_tags) - 1):
        top_lines.append(gmsh.model.geo.addLine(top_p_tags[i], top_p_tags[i + 1]))

    for i in range(len(bot_p_tags) - 1):
        bot_lines.append(gmsh.model.geo.addLine(bot_p_tags[i], bot_p_tags[i + 1]))
    
    # Líneas Laterales
    right_line = gmsh.model.geo.addLine(top_p_tags[-1], bot_p_tags[-1])
    left_line = gmsh.model.geo.addLine(top_p_tags[0], bot_p_tags[0])
    
    # Loop direction: Top(L->R) -> Right(Top->Bot) -> Bot(R->L, reverse) -> Left(Bot->Top, reverse)
    curve_loop = gmsh.model.geo.addCurveLoop(
        top_lines +
        [right_line] +
        [-line for line in reversed(bot_lines)] +
        [-left_line]
    )
    
    surface = gmsh.model.geo.addPlaneSurface([curve_loop])
    
    # ---------------------------------------------------------
    # 5. Visualización de TX/RX (usar puntos ya existentes en el borde)
    # ---------------------------------------------------------
    # Al haber incluido sensor_positions en x_domain, cada sensor tiene un punto
    # exacto en el borde superior y no necesita embed adicional.
    x_domain_arr = np.asarray(x_domain)

    def _find_top_point_tag(sensor_x):
        idx = int(np.argmin(np.abs(x_domain_arr - sensor_x)))
        if abs(x_domain_arr[idx] - sensor_x) <= 1e-8:
            return top_p_tags[idx]
        return None

    tx_point_tags = []
    rx_point_tags = []
    extra_sensor_tags = []

    for tx_x in tx_positions:
        tag = _find_top_point_tag(tx_x)
        if tag is None:
            tag = gmsh.model.geo.addPoint(tx_x, th, 0, mesh_fine)
            extra_sensor_tags.append(tag)
        tx_point_tags.append(tag)

    for rx_x in rx_positions:
        tag = _find_top_point_tag(rx_x)
        if tag is None:
            tag = gmsh.model.geo.addPoint(rx_x, th, 0, mesh_fine)
            extra_sensor_tags.append(tag)
        rx_point_tags.append(tag)
    
    gmsh.model.geo.synchronize()
    
    if extra_sensor_tags:
        gmsh.model.mesh.embed(0, extra_sensor_tags, 2, surface)

    # ---------------------------------------------------------
    # 6. Campo de Refinamiento — Box uniforme
    # ---------------------------------------------------------
    # Campo Box con transición SUAVE entre zona fina y gruesa.
    # Thickness > 0 crea un gradiente que evita elementos degenerados
    # en la interfaz coarse/fine. Con Thickness=0, los triángulos en
    # la transición pueden tener aspect ratios extremos → Jacobiano
    # negativo tras conversión meshio → FEniCS singular matrix.
    #
    # Si solo se usa edge_margin*0.3, márgenes pequeños (<~40 mm) con
    # mesh_fine 0.1 dan transiciones demasiado cortas frente al salto
    # VIn/VOut → celdas de área ~0 y NaN en el solver elastodinámico.
    _len_jump = max(mesh_coarse * 8.0, mesh_fine * 30.0, th * 2.0)
    _transition_thickness = max(edge_margin * 0.35, _len_jump)
    field_box = gmsh.model.mesh.field.add("Box")
    gmsh.model.mesh.field.setNumber(field_box, "VIn",       mesh_fine)
    gmsh.model.mesh.field.setNumber(field_box, "VOut",      mesh_coarse)
    gmsh.model.mesh.field.setNumber(field_box, "XMin",      fine_start)
    gmsh.model.mesh.field.setNumber(field_box, "XMax",      fine_end)
    gmsh.model.mesh.field.setNumber(field_box, "YMin",      -1000)
    gmsh.model.mesh.field.setNumber(field_box, "YMax",       1000)
    gmsh.model.mesh.field.setNumber(field_box, "Thickness",  _transition_thickness)

    gmsh.model.mesh.field.setAsBackgroundMesh(field_box)

    # ---------------------------------------------------------
    # 7. Generación y Optimización
    # ---------------------------------------------------------
    gmsh.option.setNumber("Mesh.Algorithm", 5)
    gmsh.option.setNumber("Mesh.Smoothing", 100)

    # CRÍTICO: deshabilitar propagación de lc desde boundary y puntos.
    # Con estas opciones en 1, Gmsh propaga los tamaños de los puntos
    # de borde/sensores hacia el interior, creando gradientes no deseados.
    # El campo Box ya define el tamaño en todo el dominio.
    gmsh.option.setNumber("Mesh.CharacteristicLengthExtendFromBoundary", 0)
    gmsh.option.setNumber("Mesh.CharacteristicLengthFromPoints",         0)
    gmsh.option.setNumber("Mesh.CharacteristicLengthFromCurvature",      0)
    
    # Generar con manejo de errores mejorado
    try:
        gmsh.model.mesh.generate(2)
    except Exception as e:
        # Si falla, intentar con el algoritmo MeshAdapt (1) que es el más básico pero robusto
        print(f"Warning: Delaunay failed, trying MeshAdapt algorithm: {e}")
        gmsh.option.setNumber("Mesh.Algorithm", 1)
        gmsh.model.mesh.generate(2)
    
    gmsh.model.mesh.optimize("Netgen")

    # ---------------------------------------------------------
    # 8. Physical Groups
    # ---------------------------------------------------------
    # Domain
    gmsh.model.addPhysicalGroup(2, [surface], 1, "Domain")
    
    # Points
    if tx_point_tags:
        gmsh.model.addPhysicalGroup(0, tx_point_tags, 10, "TX_Points")
    if rx_point_tags:
        gmsh.model.addPhysicalGroup(0, rx_point_tags, 11, "RX_Points")
        
    # Boundaries
    gmsh.model.addPhysicalGroup(1, top_lines, 20, "Top")
    gmsh.model.addPhysicalGroup(1, bot_lines, 21, "Bottom")
    gmsh.model.addPhysicalGroup(1, [left_line], 22, "Left")
    gmsh.model.addPhysicalGroup(1, [right_line], 23, "Right")
    
    # ---------------------------------------------------------
    # 9. Guardar y Convertir
    # ---------------------------------------------------------
    output_msh = f"{filename}.msh"
    output_xml = f"{filename}.xml"
    
    gmsh.write(output_msh)
    gmsh.finalize()
    
    try:
        mesh_from_file = meshio.read(output_msh)
        if 'triangle' in mesh_from_file.cells_dict:
            triangles = mesh_from_file.cells_dict['triangle']
            points = mesh_from_file.points
            if points.shape[1] == 3:
                points = points[:, :2]
            
            # ── CRÍTICO: Eliminar nodos huérfanos ──────────────────────────
            # meshio incluye TODOS los nodos del .msh (de physical groups de
            # líneas y puntos) pero solo escribimos triángulos como celdas.
            # Los nodos huérfanos crean DOFs con filas vacías en FEniCS
            # → matriz singular → NaN en el solver.
            used_indices = np.unique(triangles.flatten())
            index_map = np.full(points.shape[0], -1, dtype=np.intp)
            index_map[used_indices] = np.arange(len(used_indices), dtype=np.intp)
            
            filtered_points = points[used_indices]
            remapped_triangles = index_map[triangles]
            
            n_orphan = points.shape[0] - len(used_indices)
            if n_orphan > 0:
                print(f"   🔧 Eliminados {n_orphan} nodos huérfanos ({points.shape[0]} → {len(used_indices)} vértices)")
            
            # cell_data for physical groups (no cambia, es por celda)
            cell_data = {}
            if 'gmsh:physical' in mesh_from_file.cell_data_dict:
                pd = mesh_from_file.cell_data_dict['gmsh:physical']
                if 'triangle' in pd:
                    cell_data['gmsh:physical'] = [pd['triangle']]

            mesh_2d = meshio.Mesh(
                points=filtered_points,
                cells=[("triangle", remapped_triangles)],
                cell_data=cell_data
            )
            meshio.write(output_xml, mesh_2d)
        else:
            output_xml = None
    except Exception as e:
        print(f"Error converting to XML: {e}")
        output_xml = None
        
    return output_xml, output_msh
