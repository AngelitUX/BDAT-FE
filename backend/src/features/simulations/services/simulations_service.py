from flask import jsonify, send_file, current_app
from io import BytesIO
from decimal import Decimal
from datetime import datetime, date, timedelta
import meshio
import os
import sys
import math
from mshr import *
import gmsh
import threading
import zipfile
from .file_manager import get_simulation_dir


def write_meshfunction_xml(file_path, cell_dim, tags):
    """Escribe un archivo XML de dolfin con los tags por celda."""
    with open(file_path, 'w', encoding='utf-8') as xml_file:
        xml_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        xml_file.write('<dolfin xmlns:dolfin="http://fenicsproject.org">\n')
        xml_file.write(
            f'  <meshfunction cell_dim="{cell_dim}" size="{len(tags)}" name="f" type="uint">\n'
        )
        for idx, value in enumerate(tags):
            xml_file.write(f'    <entity index="{idx}" value="{int(value)}" />\n')
        xml_file.write('  </meshfunction>\n')
        xml_file.write('</dolfin>\n')

from ..models.simulation_model import (
    insert_simulation, delete_simulation, delete_all_simulations, get_simulation_file,
    update_simulation_status, get_simulation_count_running
)
from .file_manager import get_mesh_file_path, ensure_simulation_dirs, get_mesh_dir
from .mesh_service import create_rectangle_mesh
# Verificar disponibilidad de FEniCS directamente
try:
    import dolfin
    FENICS_AVAILABLE = True
    print("✅ FEniCS (dolfin) cargado correctamente")
    print(f"   Versión: {dolfin.__version__}")
except ImportError as e:
    FENICS_AVAILABLE = False
    print("❌ Error importando FEniCS (dolfin):", e)
    print("   Nota: FEniCS puede requerir instalación del sistema")

# Mantener compatibilidad con código legacy (intentar importar scripts directamente)
DOCKER_ROUTE = "src/features/simulations/services/Reidmen/"
FENICS_PATH = DOCKER_ROUTE + "Reidmen Fenics/ipnyb propagation"
if FENICS_PATH not in sys.path:
    sys.path.append(FENICS_PATH)
try:
    Reidmen = __import__("TimeSimTransIsoMatCij2D_test")
    ReidmenFreq = __import__("SimFreqDomain2D")
    Sandwich = __import__("sandwich")
    LEGACY_FENICS_AVAILABLE = True
    print("✅ Scripts de simulación cargados correctamente")
except Exception as e:
    Reidmen = None
    ReidmenFreq = None
    Sandwich = None
    LEGACY_FENICS_AVAILABLE = False
    print("Error importando scripts de simulación:", e)

# Nota: Tracking legacy con threads fue retirado; ahora usamos Celery para gestionar el ciclo de vida


def create_rectangle_mesh_gradual_attenuation_0(
    zlim, ylim, dxt, filename="mesh", sim_id=None,
    n_transmitter=1, n_receiver=1,
    emitter_pitch=1.0, receiver_pitch=0.4,
    sensor_distance=20.0, sensor_edge_margin=10.0,
    mesh_angle=0.0, mesh_angle_direction='none',
    porosity=0.0
):
    """
    Genera malla 2D rectangular con refinamiento gradual (attenuation=0).
    La zona de refinamiento fino cubre exactamente donde están los sensores.
    Soporta ángulo de inclinación en el borde inferior.
    """
    gmsh.initialize()
    gmsh.model.add("vertical_rectangular_gradual_mesh")
    import random

    # Geometría: rectángulo con posible inclinación en borde inferior
    Xmin_total, Xmax_total = 0.0, zlim
    Ymin_total, Ymax_total = 0.0, ylim

    # Calcular puntos con inclinación si es necesario
    angle_rad = 0.0
    y_displacement = 0.0
    if mesh_angle_direction != 'none' and mesh_angle > 0:
        angle_rad = math.radians(mesh_angle)
        # Calcular desplazamiento horizontal para el ángulo
        # CORRECCION: Usar el ancho (Xmax) para calcular la pendiente, no la altura
        y_displacement = Xmax_total * math.tan(angle_rad)
    
    # --- Generación del borde inferior con porosidad (rugosidad) ---
    points_bottom = []
    
    # Definir puntos extremos del borde inferior según la inclinación
    if mesh_angle_direction == 'right':
        # Izquierda: 0, Derecha: +y_displacement
        y_start = 0.0
        y_end = y_displacement
    elif mesh_angle_direction == 'left':
        # Izquierda: +y_displacement, Derecha: 0
        y_start = y_displacement
        y_end = 0.0
    else:
        # Plano
        y_start = 0.0
        y_end = 0.0

    # Crear puntos intermedios para la rugosidad
    num_segments_bottom = int(zlim / (dxt * 2))  # Ajustar densidad de puntos según mesh size
    if num_segments_bottom < 2: 
        num_segments_bottom = 2
        
    dx = zlim / num_segments_bottom
    
    # Primer punto (fijo)
    p_previous = gmsh.model.geo.addPoint(Xmin_total, y_start, 0)
    first_point_bottom = p_previous
    points_bottom_tags = [p_previous]
    
    # Puntos intermedios
    for i in range(1, num_segments_bottom):
        x = Xmin_total + i * dx
        # Interpolación lineal de la altura base (inclinación)
        base_y = y_start + (y_end - y_start) * (i / num_segments_bottom)
        
        # Añadir ruido (porosidad)
        # Porosity actúa como amplitud máxima del ruido
        noise = random.uniform(-porosity, porosity)
        y = base_y + noise
        
        p = gmsh.model.geo.addPoint(x, y, 0)
        points_bottom_tags.append(p)
        
    # Último punto (fijo)
    p_last = gmsh.model.geo.addPoint(Xmax_total, y_end, 0)
    last_point_bottom = p_last
    points_bottom_tags.append(p_last)
    
    # Crear líneas conectando los puntos del fondo
    lines_bottom = []
    for i in range(len(points_bottom_tags) - 1):
        l = gmsh.model.geo.addLine(points_bottom_tags[i], points_bottom_tags[i+1])
        lines_bottom.append(l)

    # --- Generación del resto del rectángulo ---
    # Puntos superiores (se mantienen rectos - Top plano)
    # Independientemente de la dirección, el tope es plano en Ymax_total
    p3 = gmsh.model.geo.addPoint(Xmax_total, Ymax_total, 0)
    p4 = gmsh.model.geo.addPoint(Xmin_total, Ymax_total, 0)

    # Borde derecho
    l2 = gmsh.model.geo.addLine(last_point_bottom, p3)
    # Borde superior
    l3 = gmsh.model.geo.addLine(p3, p4)
    # Borde izquierdo
    l4 = gmsh.model.geo.addLine(p4, first_point_bottom)

    # Crear Loop
    # lines_bottom son una lista de líneas, las unimos con el resto
    curve_loop_list = lines_bottom + [l2, l3, l4]
    
    cl = gmsh.model.geo.addCurveLoop(curve_loop_list)
    s = gmsh.model.geo.addPlaneSurface([cl])
    gmsh.model.geo.synchronize()

    # --- Calcular posiciones de sensores para definir zona de refinamiento ---
    # Transmisores
    z_transmitter_start = sensor_edge_margin
    z_transmitter_end = sensor_edge_margin + ((n_transmitter - 1) * emitter_pitch)
    
    # Receptores
    # CORRECCION: Usar el final de los transmisores para alinear correctamente
    z_receiver_start = z_transmitter_end + sensor_distance
    z_receiver_end = z_receiver_start + ((n_receiver - 1) * receiver_pitch)
    
    # Zona de refinamiento: desde el primer transmisor hasta el último receptor + margen
    margin_buffer = max(dxt * 2, 1.0)  # Margen adicional para capturar bien la propagación
    zone_start = max(0.0, z_transmitter_start - margin_buffer)
    zone_end = min(zlim, z_receiver_end + margin_buffer)
    
    fine_size = dxt
    coarse_size = dxt * 5
    
    box = gmsh.model.mesh.field.add("Box")
    gmsh.model.mesh.field.setNumber(box, "VIn", fine_size)  # tamaño fino dentro del rectángulo
    gmsh.model.mesh.field.setNumber(box, "VOut", coarse_size) # tamaño grueso fuera del rectángulo

    # Definir zona de refinamiento (región central de interés)
    gmsh.model.mesh.field.setNumber(box, "XMin", zone_start) # inicio de zona fina
    gmsh.model.mesh.field.setNumber(box, "XMax", zone_end) # fin de zona fina
    gmsh.model.mesh.field.setNumber(box, "YMin", Ymin_total) # altura completa
    gmsh.model.mesh.field.setNumber(box, "YMax", Ymax_total) # altura completa
    gmsh.model.mesh.field.setNumber(box, "Thickness", 0.1 * zlim) # transición suave
    gmsh.model.mesh.field.setAsBackgroundMesh(box)

    gmsh.option.setNumber("Mesh.Algorithm", 6)
    gmsh.option.setNumber("Mesh.RecombineAll", 0)

    # Generar y optimizar malla
    gmsh.model.mesh.generate(2)
    gmsh.model.mesh.optimize("Netgen")

    # Guardar en carpeta organizada por ID de simulación
    if sim_id is not None:
        # Usar carpeta organizada
        from .file_manager import get_mesh_dir
        meshes_dir = get_mesh_dir(sim_id)
        unique_filename = f"mesh_{sim_id}"
    else:
        # Fallback a carpeta meshes/ si no hay ID
        meshes_dir = "meshes"
        if not os.path.exists(meshes_dir):
            os.makedirs(meshes_dir)
        unique_filename = filename
    
    msh_file = os.path.join(meshes_dir, unique_filename + ".msh")
    xml_file = os.path.join(meshes_dir, unique_filename + ".xml")
    
    # Escribir archivo MSH
    gmsh.write(msh_file)
    gmsh.finalize()

    # Convertir a XML (FEniCS)
    mesh_from_file = meshio.read(msh_file)

    if 'triangle' in mesh_from_file.cells_dict:
        triangles = mesh_from_file.cells_dict['triangle']
        
        # ── CRÍTICO: Eliminar nodos huérfanos ──────────────────────────
        # meshio incluye TODOS los nodos del .msh (líneas, puntos)
        # pero solo escribimos triángulos. Nodos huérfanos crean DOFs
        # con filas vacías en FEniCS → matriz singular → NaN.
        import numpy as np
        all_points = mesh_from_file.points
        if all_points.shape[1] == 3:
            all_points = all_points[:, :2]
        used_indices = np.unique(triangles.flatten())
        index_map = np.full(all_points.shape[0], -1, dtype=np.intp)
        index_map[used_indices] = np.arange(len(used_indices), dtype=np.intp)
        filtered_points = all_points[used_indices]
        remapped_triangles = index_map[triangles]
        n_orphan = all_points.shape[0] - len(used_indices)
        if n_orphan > 0:
            print(f"   🔧 Eliminados {n_orphan} nodos huérfanos ({all_points.shape[0]} → {len(used_indices)} vértices)")
        mesh_from_file.points = filtered_points
        mesh_from_file.cells = [meshio.CellBlock("triangle", remapped_triangles)]
    else:
        # Asegurar que los puntos son 2D
        if mesh_from_file.points.shape[1] == 3:
            mesh_from_file.points = mesh_from_file.points[:, :2]

    # Escribir archivo XML
    meshio.write(xml_file, mesh_from_file)

    return xml_file, msh_file


def create_rectangle_mesh_mshr(
    zlim, ylim, dxt, filename="mesh", sim_id=None
):
    if not FENICS_AVAILABLE:
        raise RuntimeError("FEniCS (dolfin) is not available; cannot generate mshr mesh")

    meshes_dir = None
    unique_filename = filename
    if sim_id is not None:
        from .file_manager import get_mesh_dir
        meshes_dir = get_mesh_dir(sim_id)
        unique_filename = f"mesh_{sim_id}"
    else:
        meshes_dir = "meshes"
        if not os.path.exists(meshes_dir):
            os.makedirs(meshes_dir)

    xml_file = os.path.join(meshes_dir, unique_filename + ".xml")

    try:
        resolution = int(max(8, round(float(zlim) / max(float(dxt), 1e-6))))
    except Exception:
        resolution = 32

    mesh = dolfin.RectangleMesh(
        dolfin.Point(0.0, 0.0),
        dolfin.Point(float(zlim), float(ylim)),
        resolution,
        max(1, int(max(8, round(float(ylim) / max(float(dxt), 1e-6)))))
    )
    dolfin.File(xml_file) << mesh
    return xml_file, None

def create_sandwich_mesh_gradual(
    zlim, core_thickness, skin_thickness, dxt, filename="mesh_sandwich", sim_id=None,
    n_transmitter=1, n_receiver=1,
    emitter_pitch=1.0, receiver_pitch=0.4,
    sensor_distance=20.0, sensor_edge_margin=10.0
):
    """
    Genera malla 2D con 3 capas (Sandwich) y refinamiento gradual.
    Asigna IDs de grupo físico: 1=Piel Inferior, 2=Núcleo, 3=Piel Superior.
    """
    import gmsh
    import meshio
    import os
    import numpy as np

    gmsh.initialize()
    gmsh.model.add("sandwich_mesh")

    # --- Definición de alturas Y ---
    y0 = 0.0
    y1 = skin_thickness                    # Fin piel inferior / Inicio núcleo
    y2 = skin_thickness + core_thickness   # Fin núcleo / Inicio piel superior
    y3 = y2 + skin_thickness               # Altura total (Superficie de sensores)
    
    # Directorio para guardar archivos
    meshes_dir = os.path.join(os.getcwd(), f"meshes_{sim_id}")
    if not os.path.exists(meshes_dir):
        os.makedirs(meshes_dir)
        
    # --- Geometría (Puntos y Líneas) ---
    p = {}
    for i, y in enumerate([y0, y1, y2, y3]):
        p[f'L{i+1}'] = gmsh.model.geo.addPoint(0, y, 0)
        p[f'R{i+1}'] = gmsh.model.geo.addPoint(zlim, y, 0)

    l = {}
    v = {}
    
    # Líneas Horizontales
    l['h1'] = gmsh.model.geo.addLine(p['L1'], p['R1']) # Fondo
    l['h2'] = gmsh.model.geo.addLine(p['L2'], p['R2']) # Interfaz 1 (Continua)
    l['h3'] = gmsh.model.geo.addLine(p['L3'], p['R3']) # Interfaz 2 (Continua)
    l['h4'] = gmsh.model.geo.addLine(p['L4'], p['R4']) # Tope (Sensores)

    # Líneas Verticales Izquierda y Derecha
    for i in range(1, 4):
        v[f'L{i}'] = gmsh.model.geo.addLine(p[f'L{i}'], p[f'L{i+1}'])
        v[f'R{i}'] = gmsh.model.geo.addLine(p[f'R{i}'], p[f'R{i+1}'])

    # --- Superficies (Dominios Físicos) ---
    s = {}
    # Piel Inferior (Tag 1)
    s[1] = gmsh.model.geo.addPlaneSurface([gmsh.model.geo.addCurveLoop([l['h1'], v['R1'], -l['h2'], -v['L1']])])
    # Núcleo (Tag 2)
    s[2] = gmsh.model.geo.addPlaneSurface([gmsh.model.geo.addCurveLoop([l['h2'], v['R2'], -l['h3'], -v['L2']])])
    # Piel Superior (Tag 3)
    s[3] = gmsh.model.geo.addPlaneSurface([gmsh.model.geo.addCurveLoop([l['h3'], v['R3'], -l['h4'], -v['L3']])])

    gmsh.model.geo.synchronize()

    # --- Grupos Físicos (Para FEniCS) ---
    gmsh.model.addPhysicalGroup(2, [s[1]], 1) # Piel Inferior
    gmsh.model.addPhysicalGroup(2, [s[2]], 2) # Núcleo
    gmsh.model.addPhysicalGroup(2, [s[3]], 3) # Piel Superior

    # Fronteras (Lineas)
    gmsh.model.addPhysicalGroup(1, [l['h4']], 20) # Borde Superior (Sensores/Fuentes)
    gmsh.model.addPhysicalGroup(1, [v['L1'], v['L2'], v['L3']], 10) # Borde Izquierdo (Dirichlet)

    # --- Refinamiento (Box Field) ---
    z_transmitter_start = sensor_edge_margin
    z_receiver_end = sensor_edge_margin + n_transmitter * emitter_pitch + sensor_distance + (n_receiver * receiver_pitch)
    
    # Se refina la zona de propagación
    box = gmsh.model.mesh.field.add("Box")
    gmsh.model.mesh.field.setNumber(box, "VIn", dxt) 
    gmsh.model.mesh.field.setNumber(box, "VOut", dxt * 4) 
    gmsh.model.mesh.field.setNumber(box, "XMin", max(0, z_transmitter_start - 5))
    gmsh.model.mesh.field.setNumber(box, "XMax", min(zlim, z_receiver_end + 5))
    gmsh.model.mesh.field.setNumber(box, "YMin", y1) # Desde la primera interfaz
    gmsh.model.mesh.field.setNumber(box, "YMax", y3) 
    gmsh.model.mesh.field.setNumber(box, "Thickness", skin_thickness / 2) 
    gmsh.model.mesh.field.setAsBackgroundMesh(box)

    gmsh.option.setNumber("Mesh.Algorithm", 6)
    gmsh.model.mesh.generate(2)
    gmsh.model.mesh.optimize("Netgen")

    msh_file = os.path.join(meshes_dir, f"{filename}_{sim_id}.msh")
    xml_file = os.path.join(meshes_dir, f"{filename}_{sim_id}.xml")
    
    gmsh.write(msh_file)
    gmsh.finalize()

    # Convertir a XML (asumiendo que los Physical Groups se guardan como cell tags)
    mesh_from_file = meshio.read(msh_file)
    
    print(f"🔍 DEBUG: mesh_from_file.points.shape ANTES = {mesh_from_file.points.shape}")
    
    # IMPORTANTE: Asegurar que los puntos son 2D para FEniCS
    if mesh_from_file.points.shape[1] == 3:
        print(f"🔍 DEBUG: Convirtiendo puntos de 3D a 2D...")
        mesh_from_file.points = mesh_from_file.points[:, :2]
        print(f"🔍 DEBUG: mesh_from_file.points.shape DESPUÉS = {mesh_from_file.points.shape}")
    else:
        print(f"🔍 DEBUG: Los puntos ya son 2D, no se requiere conversión")
    
    # Filtrar solo elementos triangulares
    if "triangle" in mesh_from_file.cells_dict:
        cells = [("triangle", mesh_from_file.cells_dict["triangle"])]
        
        # Extraer cell_data para los triángulos
        cell_data_dict = {}
        if "gmsh:physical" in mesh_from_file.cell_data_dict:
            physical_tags = mesh_from_file.cell_data_dict["gmsh:physical"].get("triangle")
            if physical_tags is not None:
                cell_data_dict["gmsh:physical"] = [physical_tags]
        
        mesh_to_write = meshio.Mesh(
            points=mesh_from_file.points,
            cells=cells,
            cell_data=cell_data_dict
        )
    else:
        mesh_to_write = mesh_from_file

    # Convertir a formato XML de FEniCS Legacy
    meshio.write(xml_file, mesh_to_write, file_format="dolfin-xml")
    
    # Escribir archivos XML adicionales para cell_data (physical regions)
    if "gmsh:physical" in mesh_to_write.cell_data:
        physical_regions_file = xml_file.replace(".xml", "_physical_region.xml")
        tags = mesh_to_write.cell_data["gmsh:physical"][0]
        write_meshfunction_xml(physical_regions_file, 2, tags)
        print(f" Archivo de regiones físicas guardado: {physical_regions_file}")

    # Retornar en el mismo formato que las otras funciones (xml_file, msh_file)
    return xml_file, msh_file

def create_multilayer_mesh_with_skin(
    zlim, ylim_bone, dxt, filename="mesh", sim_id=None,
    n_transmitter=1, n_receiver=1,
    emitter_pitch=1.0, receiver_pitch=0.4,
    sensor_distance=20.0, sensor_edge_margin=10.0,
    skin_layer_config='both',
    skin_thickness_top=1.3,
    skin_thickness_bottom=1.3
):
    """
    Genera malla 2D multicapa con capas de piel configurables.
    
    Args:
        skin_layer_config: 'none', 'top', 'bottom', 'both'
        skin_thickness_top: Grosor de piel superior en mm
        skin_thickness_bottom: Grosor de piel inferior en mm
    
    Estructura según configuración:
    - 'none': Solo hueso cortical
    - 'top': Hueso + piel superior
    - 'bottom': Piel inferior + hueso
    - 'both': Piel inferior + hueso + piel superior
    """
    gmsh.initialize()
    gmsh.model.add("multilayer_mesh_with_skin")
    
    Xmin_total, Xmax_total = 0.0, zlim
    
    # Calcular dimensiones según configuración
    has_bottom = skin_layer_config in ['bottom', 'both']
    has_top = skin_layer_config in ['top', 'both']
    
    Ymin_total = -skin_thickness_bottom if has_bottom else 0.0
    Ymax_total = ylim_bone + (skin_thickness_top if has_top else 0.0)
    
    print(f"🔧 Generando mesh multicapa (config: {skin_layer_config}):")
    if has_bottom:
        print(f"   - Piel inferior: Y=[{Ymin_total:.2f}, 0.0] mm (grosor: {skin_thickness_bottom}mm)")
    print(f"   - Hueso cortical: Y=[0.0, {ylim_bone:.2f}] mm")
    if has_top:
        print(f"   - Piel superior: Y=[{ylim_bone:.2f}, {Ymax_total:.2f}] mm (grosor: {skin_thickness_top}mm)")
    print(f"   - Dimensiones totales: X=[0, {zlim:.2f}], Y=[{Ymin_total:.2f}, {Ymax_total:.2f}]")
    
    # -----------------------------
    # GEOMETRÍA CONTINUA CON NODOS COMPARTIDOS EN INTERFACES
    # -----------------------------
    # Definir todas las coordenadas Y de las interfaces
    y_coords = [Ymin_total]  # Inicio del dominio
    
    if has_bottom:
        y_coords.append(0.0)  # Interfaz piel inferior - hueso
    
    y_coords.append(ylim_bone)  # Interfaz hueso - piel superior (o tope del dominio)
    
    if has_top:
        y_coords.append(Ymax_total)  # Tope del dominio con piel superior
    
    print(f"   📍 Coordenadas Y de interfaces: {y_coords}")
    
    # Crear puntos en las esquinas de cada capa (compartidos en interfaces)
    points = []
    for y in y_coords:
        p_left = gmsh.model.geo.addPoint(Xmin_total, y, 0)
        p_right = gmsh.model.geo.addPoint(Xmax_total, y, 0)
        points.append((p_left, p_right))
    
    # Variables para almacenar superficies
    surfaces = []
    surface_names = []
    
    # Crear capas de abajo hacia arriba con nodos compartidos
    layer_idx = 0
    
    # Capa inferior de piel (si está habilitada)
    if has_bottom:
        p_bl, p_br = points[layer_idx]      # Bottom layer
        p_tl, p_tr = points[layer_idx + 1]  # Top of bottom layer (interface)
        
        l1 = gmsh.model.geo.addLine(p_bl, p_br)
        l2 = gmsh.model.geo.addLine(p_br, p_tr)
        l3 = gmsh.model.geo.addLine(p_tr, p_tl)
        l4 = gmsh.model.geo.addLine(p_tl, p_bl)
        
        loop = gmsh.model.geo.addCurveLoop([l1, l2, l3, l4])
        surface = gmsh.model.geo.addPlaneSurface([loop])
        surfaces.append(surface)
        surface_names.append("SkinBottom")
        print(f"   ✅ Capa piel inferior: Y=[{y_coords[layer_idx]:.2f}, {y_coords[layer_idx+1]:.2f}]")
        layer_idx += 1
    
    # Capa de hueso cortical (siempre presente)
    p_bl, p_br = points[layer_idx]      # Bottom of bone
    p_tl, p_tr = points[layer_idx + 1]  # Top of bone
    
    l1 = gmsh.model.geo.addLine(p_bl, p_br)
    l2 = gmsh.model.geo.addLine(p_br, p_tr)
    l3 = gmsh.model.geo.addLine(p_tr, p_tl)
    l4 = gmsh.model.geo.addLine(p_tl, p_bl)
    
    loop = gmsh.model.geo.addCurveLoop([l1, l2, l3, l4])
    surface = gmsh.model.geo.addPlaneSurface([loop])
    surfaces.append(surface)
    surface_names.append("CorticalBone")
    print(f"   ✅ Capa hueso cortical: Y=[{y_coords[layer_idx]:.2f}, {y_coords[layer_idx+1]:.2f}]")
    layer_idx += 1
    
    # Capa superior de piel (si está habilitada)
    if has_top:
        p_bl, p_br = points[layer_idx]      # Bottom of top layer (interface)
        p_tl, p_tr = points[layer_idx + 1]  # Top of top layer
        
        l1 = gmsh.model.geo.addLine(p_bl, p_br)
        l2 = gmsh.model.geo.addLine(p_br, p_tr)
        l3 = gmsh.model.geo.addLine(p_tr, p_tl)
        l4 = gmsh.model.geo.addLine(p_tl, p_bl)
        
        loop = gmsh.model.geo.addCurveLoop([l1, l2, l3, l4])
        surface = gmsh.model.geo.addPlaneSurface([loop])
        surfaces.append(surface)
        surface_names.append("SkinTop")
        print(f"   ✅ Capa piel superior: Y=[{y_coords[layer_idx]:.2f}, {y_coords[layer_idx+1]:.2f}]")
    
    print(f"   🔗 Nodos compartidos en interfaces para continuidad física")
    
    # -----------------------------
    # Sincronizar geometría
    # -----------------------------
    gmsh.model.geo.synchronize()
    
    # --- Etiquetar superficies con Physical Groups ---
    # Cada capa recibe un tag único que identifica el material
    print(f"\n   🏷️  Etiquetando elementos por material:")
    for idx, (surface, name) in enumerate(zip(surfaces, surface_names), start=1):
        gmsh.model.addPhysicalGroup(2, [surface], idx)
        gmsh.model.setPhysicalName(2, idx, name)
        print(f"      Tag {idx}: {name}")
    
    # -------------------------------------------------------------
    # Campo de refinamiento gradual centrado en sensores
    # -------------------------------------------------------------
    z_transmitter_start = sensor_edge_margin
    z_transmitter_end = sensor_edge_margin + ((n_transmitter - 1) * emitter_pitch)
    
    z_receiver_start = sensor_edge_margin + n_transmitter * emitter_pitch + sensor_distance
    z_receiver_end = z_receiver_start + ((n_receiver - 1) * receiver_pitch)
    
    margin_buffer = max(dxt * 2, 1.0)
    zone_start = max(0.0, z_transmitter_start - margin_buffer)
    zone_end = min(zlim, z_receiver_end + margin_buffer)
    
    fine_size = dxt
    coarse_size = dxt * 5
    
    box = gmsh.model.mesh.field.add("Box")
    gmsh.model.mesh.field.setNumber(box, "VIn", fine_size)
    gmsh.model.mesh.field.setNumber(box, "VOut", coarse_size)
    gmsh.model.mesh.field.setNumber(box, "XMin", zone_start)
    gmsh.model.mesh.field.setNumber(box, "XMax", zone_end)
    gmsh.model.mesh.field.setNumber(box, "YMin", Ymin_total)
    gmsh.model.mesh.field.setNumber(box, "YMax", Ymax_total)
    gmsh.model.mesh.field.setNumber(box, "Thickness", 0.1 * zlim)
    gmsh.model.mesh.field.setAsBackgroundMesh(box)
    
    # Opciones de malla
    gmsh.option.setNumber("Mesh.Algorithm", 6)
    gmsh.option.setNumber("Mesh.RecombineAll", 0)
    gmsh.option.setNumber("Mesh.CharacteristicLengthExtendFromBoundary", 0)
    
    # Generar y optimizar malla
    gmsh.model.mesh.generate(2)
    gmsh.model.mesh.optimize("Netgen")
    
    # --- Guardar archivos ---
    # Guardar en carpeta organizada por ID de simulación
    if sim_id is not None:
        # Usar carpeta organizada
        from .file_manager import get_mesh_dir
        meshes_dir = get_mesh_dir(sim_id)
        unique_filename = f"mesh_{sim_id}"
    else:
        # Fallback a carpeta meshes/ si no hay ID
        meshes_dir = "meshes"
        if not os.path.exists(meshes_dir):
            os.makedirs(meshes_dir)
        unique_filename = filename
    
    msh_file = os.path.join(meshes_dir, unique_filename + ".msh")
    xml_file = os.path.join(meshes_dir, unique_filename + ".xml")
    
    gmsh.write(msh_file)
    
    # Obtener información de la malla antes de finalizar
    num_nodes = len(gmsh.model.mesh.getNodes()[0])
    num_elements = len(gmsh.model.mesh.getElements()[2][0])
    
    gmsh.finalize()
    
    print(f"✅ Mesh multicapa generado: {num_nodes} nodos, {num_elements} elementos")
    
    # Convertir a XML (FEniCS) manteniendo las etiquetas de materiales
    mesh_from_file = meshio.read(msh_file)
    
    # Extraer triángulos y sus etiquetas de material
    if 'triangle' in mesh_from_file.cells_dict:
        triangles = mesh_from_file.cells_dict['triangle']
        
        # Buscar las etiquetas de material (cell_data)
        material_tags = None
        if 'gmsh:physical' in mesh_from_file.cell_data_dict:
            if 'triangle' in mesh_from_file.cell_data_dict['gmsh:physical']:
                material_tags = mesh_from_file.cell_data_dict['gmsh:physical']['triangle']
        
        # Crear estructura para FEniCS
        mesh_from_file.cells = [meshio.CellBlock("triangle", triangles)]
        
        # Preservar etiquetas de material si existen
        if material_tags is not None:
            mesh_from_file.cell_data = {"material": [material_tags]}
    
    # Asegurar que los puntos son 2D
    if mesh_from_file.points.shape[1] == 3:
        mesh_from_file.points = mesh_from_file.points[:, :2]
    
    # Escribir archivo XML con información de materiales
    meshio.write(xml_file, mesh_from_file)
    
    return xml_file, msh_file


def generate_mesh_and_save(app, sim_id, skin_thickness=1.3):
    """
    Generate mesh in background and update simulation when ready
    
    Args:
        app: Flask app context
        sim_id: ID de la simulación
        skin_thickness: Grosor de las capas de piel en mm (default 1.3mm)
    
    Note: use_multilayer is now read from the database field 'use_skin_layers'
    """
    with app.app_context():
        try:
            # Obtener datos de la simulación
            cur = app.mysql.connection.cursor()
            cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
            columns = [col[0] for col in cur.description]
            row = cur.fetchone()
            cur.close()
            
            if not row:
                print(f"❌ Simulación {sim_id} no encontrada")
                return
            
            row_dict = dict(zip(columns, row))
            
            # Crear estructura de carpetas organizada para esta simulación
            dirs = ensure_simulation_dirs(sim_id)
            print(f"📁 Estructura de carpetas creada para simulación {sim_id}: {dirs}")

            # Determinar qué función usar
            attenuation = row_dict['attenuation']
            skin_layer_config = row_dict.get('skin_layer_config', 'none')
            use_multilayer = skin_layer_config != 'none'
            mesh_type = row_dict.get('mesh_type', 'gmsh')
            
            if use_multilayer:
                if mesh_type == 'mshr':
                    raise RuntimeError("mshr mesh type is not supported with Skin Layers enabled")
                # NUEVO: Generar mesh multicapa con capas de piel configurables
                skin_thickness_top = float(row_dict.get('skin_thickness_top', 1.3))
                skin_thickness_bottom = float(row_dict.get('skin_thickness_bottom', 1.3))
                print(f"🔧 Generando mesh MULTICAPA (config: {skin_layer_config})...")
                
                # Calcular parámetros para sandwich mesh
                core_thickness = row_dict['plate_thickness']  # El grosor del hueso
                skin_thickness = skin_thickness_top  # Asumiendo simétrico por ahora
                
                xml_file, msh_file = create_sandwich_mesh_gradual(
                    zlim=row_dict['plate_length'], 
                    core_thickness=core_thickness,
                    skin_thickness=skin_thickness,
                    dxt=row_dict['typical_mesh_size'], 
                    sim_id=sim_id,
                    n_transmitter=row_dict['n_transmitter'],
                    n_receiver=row_dict['n_receiver'],
                    emitter_pitch=float(row_dict['emitters_pitch']), 
                    receiver_pitch=float(row_dict['receivers_pitch']),
                    sensor_distance=float(row_dict['sensor_distance']), 
                    sensor_edge_margin=float(row_dict['sensor_edge_margin'])
                )
            else:
                # Calcular ruta base para archivo
                meshes_dir = get_mesh_dir(sim_id)
                unique_filename_base = os.path.join(meshes_dir, f"mesh_{sim_id}") 
                
                # Generar ambos archivos (XML y MSH) usando el nuevo servicio
                print(f"🔧 Generando mesh rectangular con:")
                print(f"   Angle: {row_dict.get('mesh_angle')} ({row_dict.get('mesh_angle_direction')})")
                print(f"   Porosity: {row_dict.get('porosity')}")

                if mesh_type == 'mshr':
                    xml_file, msh_file = create_rectangle_mesh_mshr(
                        zlim=row_dict['plate_length'],
                        ylim=row_dict['plate_thickness'],
                        dxt=row_dict['typical_mesh_size'],
                        filename=unique_filename_base,
                        sim_id=sim_id
                    )
                else:
                    xml_file, msh_file = create_rectangle_mesh(
                        zlim=row_dict['plate_length'], 
                        ylim=row_dict['plate_thickness'], 
                        dxt=row_dict['typical_mesh_size'], 
                        filename=unique_filename_base,
                        n_transmitter=row_dict['n_transmitter'],
                        n_receiver=row_dict['n_receiver'],
                        emitter_pitch=float(row_dict['emitters_pitch']),
                        receiver_pitch=float(row_dict['receivers_pitch']),
                        sensor_distance=float(row_dict['sensor_distance']),
                        sensor_edge_margin=float(row_dict['sensor_edge_margin']),
                        mesh_angle=float(row_dict.get('mesh_angle', 0.0)),
                        mesh_angle_direction=row_dict.get('mesh_angle_direction', 'none'),
                        porosity=int(row_dict.get('porosity', 0)),
                        roughness=float(row_dict.get('roughness', 0.2)),
                        use_porosity=(float(row_dict.get('roughness', 0)) > 0)
                    )
            # Actualizar simulación con ambos paths y cambiar estado a "Not started" solo si estaba en "Generating mesh"
            cur = app.mysql.connection.cursor()
            cur.execute("""
                UPDATE simulation 
                SET xml_file = %s, msh_file = %s, 
                    p_status = CASE WHEN p_status = 'Generating mesh' THEN 'Not started' ELSE p_status END 
                WHERE id = %s
            """, (xml_file, msh_file, sim_id))
            app.mysql.connection.commit()
            cur.close()
            
            # Obtener simulación actualizada
            cur = app.mysql.connection.cursor()
            cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
            columns = [col[0] for col in cur.description]
            row = cur.fetchone()
            cur.close()
            updated_sim = dict(zip(columns, row))
            
            # Convertir tipos no serializables a JSON
            from decimal import Decimal
            from datetime import datetime, date
            for key, value in updated_sim.items():
                if isinstance(value, Decimal):
                    updated_sim[key] = float(value)
                elif isinstance(value, (datetime, date)):
                    updated_sim[key] = value.isoformat() if value else None

            # Emitir evento de actualización (solo si no estaba ya Running o Queued)
            if updated_sim.get('p_status') in ('Not started', 'Generating mesh'):
                notificar_estado_simulacion(sim_id, "Not started")
            app.socketio.emit('mesh_ready', {
                'id': sim_id,
                'xml_file': xml_file,
                'msh_file': msh_file,
                'p_status': updated_sim.get('p_status', 'Not started'),
                'simulation': updated_sim
            })

        except Exception as e:
            import traceback
            
            # Actualizar estado a error
            try:
                cur = app.mysql.connection.cursor()
                cur.execute("""
                    UPDATE simulation 
                    SET p_status = %s 
                    WHERE id = %s
                """, ("Mesh generation failed", sim_id))
                app.mysql.connection.commit()
                cur.close()
                
                app.socketio.emit('mesh_error', {
                    'id': sim_id,
                    'error': str(e)
                })
            except Exception as update_error:
                pass




# ─── Batch Import Session ─── DB-backed ──────────────────────────────────────
# State is stored in the `import_session` table (single row, id=1).
# Both the Flask process and the Celery worker read/write the same row.

def _db_get_import_session(mysql):
    """Read the current import session from the DB."""
    try:
        cur = mysql.connection.cursor()
        cur.execute("INSERT IGNORE INTO import_session (id, active) VALUES (1, 0)")
        mysql.connection.commit()
        cur.execute(
            "SELECT active, total, current_index, current_name, task_id "
            "FROM import_session WHERE id = 1"
        )
        row = cur.fetchone()
        cur.close()
        if row:
            return {
                'active': bool(row[0]),
                'total': int(row[1]),
                'current_index': int(row[2]),
                'current_name': row[3] or '',
                'task_id': row[4],
            }
    except Exception as e:
        print(f"\u26a0\ufe0f  [import_session] DB read error: {e}")
    return {'active': False, 'total': 0, 'current_index': 0, 'current_name': '', 'task_id': None}


def _db_set_import_session(mysql, active, total=0, current_index=0,
                            current_name='', task_id=None):
    """Write (upsert) the import session state to the DB."""
    try:
        cur = mysql.connection.cursor()
        cur.execute(
            """INSERT INTO import_session
                 (id, active, total, current_index, current_name, task_id, started_at)
               VALUES (1, %s, %s, %s, %s, %s, IF(%s, NOW(), NULL))
               ON DUPLICATE KEY UPDATE
                 active        = VALUES(active),
                 total         = VALUES(total),
                 current_index = VALUES(current_index),
                 current_name  = VALUES(current_name),
                 task_id       = VALUES(task_id),
                 started_at    = IF(VALUES(active) = 1 AND started_at IS NULL, NOW(), started_at)
            """,
            (int(active), total, current_index, current_name, task_id, int(active))
        )
        mysql.connection.commit()
        cur.close()
    except Exception as e:
        print(f"\u26a0\ufe0f  [import_session] DB write error: {e}")


def _emit_import_status():
    """Read DB state and emit import_status to all connected WS clients."""
    try:
        session = _db_get_import_session(current_app.mysql)
        
        import redis
        import os
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
        try:
            r = redis.from_url(redis_url)
            is_cancelling = bool(r.get('batch_import_cancel'))
        except:
            is_cancelling = False

        payload = {
            'active': session['active'],
            'total': session['total'],
            'current_index': session['current_index'],
            'current_name': session['current_name'],
            'is_cancelling': is_cancelling
        }
        current_app.socketio.emit('import_status', payload, namespace='/')
        print(f"[batch_import] import_status (DB): {payload}")
    except Exception as e:
        print(f"\u274c Error emitiendo import_status: {e}")


def import_start_service(request):
    """Start a batch import session."""
    try:
        data = request.json or {}
        total = int(data.get('total', 0))
        _db_set_import_session(current_app.mysql, active=True, total=total,
                               current_index=0, current_name='')
        _emit_import_status()
        return jsonify({'status': 'ok', 'message': 'Import session started', 'total': total}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


def import_update_service(request):
    """Update the current simulation being imported."""
    try:
        data = request.json or {}
        session = _db_get_import_session(current_app.mysql)
        current_index = int(data.get('current_index', session['current_index']))
        current_name  = str(data.get('current_name', session['current_name']))
        _db_set_import_session(current_app.mysql,
                               active=True,
                               total=session['total'],
                               current_index=current_index,
                               current_name=current_name,
                               task_id=session.get('task_id'))
        _emit_import_status()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


def import_end_service():
    """End the batch import session (completed or cancelled)."""
    try:
        _db_set_import_session(current_app.mysql, active=False,
                               total=0, current_index=0, current_name='', task_id=None)
        _emit_import_status()
        return jsonify({'status': 'ok', 'message': 'Import session ended'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


def import_status_service():
    """Return the import session state from the DB (source of truth)."""
    try:
        session = _db_get_import_session(current_app.mysql)
        
        import redis
        import os
        from flask import current_app
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
        try:
            r = redis.from_url(redis_url)
            is_cancelling = bool(r.exists('batch_import_cancel'))
        except:
            is_cancelling = False

        return jsonify({
            'active': session['active'],
            'total': session['total'],
            'current_index': session['current_index'],
            'current_name': session['current_name'],
            'is_cancelling': is_cancelling
        }), 200
    except Exception as e:
        return jsonify({'active': False, 'total': 0, 'current_index': 0, 'current_name': '', 'is_cancelling': False}), 200


def import_reset_service():
    """
    Force-reset any stuck import session in DB, clear Redis cancel flag, and broadcast status.
    Guarantees recovery if an import was killed, interrupted, or cancelled abruptly.
    """
    try:
        from flask import current_app
        # Revoke Celery task if present
        session = _db_get_import_session(current_app.mysql)
        task_id = session.get('task_id')
        if task_id:
            try:
                current_app.celery.control.revoke(task_id, terminate=True)
                print(f"[batch_import] Revoked celery task: {task_id}")
            except Exception as rev_err:
                print(f"⚠️ [batch_import] Could not revoke task {task_id}: {rev_err}")

        # Reset DB
        _db_set_import_session(current_app.mysql, active=False, total=0, current_index=0, current_name='', task_id=None)

        # Clear Redis
        import redis
        import os
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
        try:
            r = redis.from_url(redis_url)
            r.delete('batch_import_cancel')
        except Exception:
            pass

        _emit_import_status()
        return jsonify({'status': 'ok', 'message': 'Import session reset successfully'}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500


def import_run_service(request):
    """
    Receive the full list of simulations and dispatch a Celery batch_import_task.
    The import runs entirely on the server and survives page reloads.
    """
    try:
        data = request.json or {}
        simulations_data = data.get('simulations', [])
        force = data.get('force', False)
        if not simulations_data:
            return jsonify({'status': 'error', 'message': 'No simulations provided'}), 400

        # Guard: check if an import is already marked active in DB
        current_session = _db_get_import_session(current_app.mysql)
        if current_session.get('active'):
            task_id = current_session.get('task_id')
            is_stale = False
            
            if not task_id:
                is_stale = True
            else:
                try:
                    res = current_app.celery.AsyncResult(task_id)
                    if res.state in ('SUCCESS', 'FAILURE', 'REVOKED'):
                        is_stale = True
                except Exception:
                    pass

            if is_stale or force:
                print(f"[batch_import] Previous session was stale (task_id={task_id}), auto-resetting.")
                _db_set_import_session(current_app.mysql, active=False, total=0, current_index=0, current_name='', task_id=None)
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'An import is already running. If it was interrupted, you can reset it.',
                    'can_reset': True
                }), 409

        # Clear Redis cancel flag before starting
        import redis
        import os
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
        try:
            r = redis.from_url(redis_url)
            r.delete('batch_import_cancel')
        except Exception:
            pass

        # Write to DB immediately so status endpoint shows it right away
        _db_set_import_session(current_app.mysql,
                               active=True,
                               total=len(simulations_data),
                               current_index=0,
                               current_name='')
        _emit_import_status()

        # Dispatch to Celery
        task = current_app.celery.send_task(
            'simulations.batch_import',
            args=[simulations_data],
        )

        # Persist task_id
        _db_set_import_session(current_app.mysql,
                               active=True,
                               total=len(simulations_data),
                               current_index=0,
                               current_name='',
                               task_id=task.id)

        print(f"[batch_import] Celery task dispatched: {task.id}")
        return jsonify({'status': 'ok', 'task_id': task.id, 'total': len(simulations_data)}), 202

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500


def import_cancel_service():
    """
    Set a Redis cancel flag. The Celery task checks it before each simulation.
    Also revokes the Celery task if running or queued.
    """
    try:
        import redis
        from flask import current_app
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
        try:
            r = redis.from_url(redis_url)
            r.set('batch_import_cancel', '1', ex=3600)
            print("[batch_import] Cancel flag set in Redis")
        except Exception as e_red:
            print(f"⚠️ Redis cancel flag error: {e_red}")

        # Revoke the task in Celery
        session = _db_get_import_session(current_app.mysql)
        task_id = session.get('task_id')
        if task_id:
            try:
                current_app.celery.control.revoke(task_id, terminate=True)
                print(f"[batch_import] Revoked task {task_id}")
            except Exception as rev_err:
                print(f"⚠️ Could not revoke celery task {task_id}: {rev_err}")

        # Failsafe WS emit to unstuck the UI into cancelling state
        try:
            from flask_socketio import SocketIO
            sio = SocketIO(message_queue=redis_url)
            payload = {
                'active': session['active'],
                'total': session['total'],
                'current_index': session['current_index'],
                'current_name': session['current_name'],
                'is_cancelling': True
            }
            sio.emit('import_status', payload, namespace='/')
            print("[batch_import] Emitted status with is_cancelling=True")
        except Exception as e:
            print(f"⚠️ Failed to emit cancelling WS: {e}")

        return jsonify({'status': 'ok', 'message': 'Cancellation requested'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


def input_data_service(request):

    try:
        data = request.json
        sim_name = data['sim_name']
        n_transmitter = data['n_transmitter']
        n_receiver = data['n_receiver']
        sensor_distance = data['sensor_distance']
        emitters_pitch = data['emitters_pitch']
        receivers_pitch = data['receivers_pitch']
        sensor_edge_margin = data['sensor_edge_margin']
        typical_mesh_size = data['typical_mesh_size']
        plate_thickness = data['plate_thickness']
        porosity = data['porosity']
        attenuation = data['attenuation']
        mesh_type = data['mesh_type']
        
        # Extraer parámetros de piel (con valores por defecto)
        skin_layer_config = data.get('skin_layer_config', 'none')
        skin_thickness_top = data.get('skin_thickness_top', 1.3)
        skin_thickness_bottom = data.get('skin_thickness_bottom', 1.3)
        roughness = data.get('roughness', 0.2)

        # Validación de datos
        isValid, parameter, typeReceived = ValidData(
            n_transmitter, n_receiver, emitters_pitch,
            receivers_pitch, sensor_edge_margin,
            sensor_distance, typical_mesh_size, plate_thickness, porosity, mesh_type, roughness
        )

        if not isValid:
            return jsonify({"status": "error", "message": f"Error in data type: {parameter} <{typeReceived}>"}), 400

        # Calcular longitud total
        # CORRECCION: Ajustar para que sea simetrico y centrado
        # n_receivers ocupan (n-1) espacios, igual para transmisores
        # Longitud = Margen_Izq + (NT-1)*Pt + Distancia + (NR-1)*Pr + Margen_Der
        # Asumiendo Margen_Izq = Margen_Der = sensor_edge_margin
        emitters_span = max(0, (n_transmitter - 1) * emitters_pitch)
        receivers_span = max(0, (n_receiver - 1) * receivers_pitch)
        
        plate_length = sensor_edge_margin * 2 + emitters_span + sensor_distance + receivers_span

        # Insertar simulación INMEDIATAMENTE con estado "Generating mesh"
        sim_data = {
            'sim_name': sim_name,
            'n_transmitter': n_transmitter,
            'n_receiver': n_receiver,
            'emitters_pitch': emitters_pitch,
            'receivers_pitch': receivers_pitch,
            'sensor_distance': sensor_distance,
            'sensor_edge_margin': sensor_edge_margin,
            'typical_mesh_size': typical_mesh_size,
            'plate_thickness': plate_thickness,
            'plate_length': plate_length,
            'porosity': int(porosity),
            'attenuation': attenuation,
            'p_status': "Not started",
            'mesh_type': mesh_type,
            'skin_layer_config': skin_layer_config,
            'skin_thickness_top': float(skin_thickness_top),
            'skin_thickness_bottom': float(skin_thickness_bottom),
            'mesh_angle': float(data.get('mesh_angle', 0.0)),
            'mesh_angle_direction': data.get('mesh_angle_direction', 'none'),
            'roughness': float(roughness),
            'xml_file': None,   # Se asignará cuando el XML esté listo
            'msh_file': None    # Se asignará cuando el MSH esté listo
        }
        
        print(f"📥 Creating simulation '{sim_name}' with:")
        print(f"   Porosity: {porosity} (Material)")
        print(f"   Angle: {sim_data['mesh_angle']} ({sim_data['mesh_angle_direction']})")
        print(f"   Config: {skin_layer_config}")
        doc = insert_simulation(current_app.mysql, sim_data)
        sim_id = doc[0]
        # Obtener registro insertado para enviar al frontend
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
        columns = [col[0] for col in cur.description]
        row = cur.fetchone()
        cur.close()
        row_dict = dict(zip(columns, row))
        
        # Convertir tipos no serializables a JSON
        from decimal import Decimal
        from datetime import datetime, date
        for key, value in row_dict.items():
            if isinstance(value, Decimal):
                row_dict[key] = float(value)
            elif isinstance(value, (datetime, date)):
                row_dict[key] = value.isoformat() if value else None

        # Emitir evento inmediato al frontend (malla bajo demanda)
        current_app.socketio.emit('nueva_simulacion', row_dict)
        notificar_estado_simulacion(sim_id, "Not started")
        print(f"✅ Simulación {sim_id} creada instantáneamente (malla bajo demanda).")
        
        return jsonify({
            "status": "success", 
            "message": "Simulation created successfully",
            "simulation": row_dict
        })

    except Exception as e:
        import traceback
        print(f"❌ Error en input_data_service: {e}")
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


def update_simulation_service(id, request):
    """Actualizar parámetros de una simulación existente"""
    try:
        sim_id = int(id)
        data = request.json
        
        # Obtener simulación actual
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
        result = cur.fetchone()
        
        if not result:
            cur.close()
            return jsonify({"status": "error", "message": "Simulation not found"}), 404
        
        current_status = result[0]
        
        # No permitir edición si está corriendo o en cola
        if current_status in ['Running', 'Queued', 'Aborting', '1', 'Processing']:
            cur.close()
            return jsonify({
                "status": "error", 
                "message": "Cannot edit simulation while it is running or queued"
            }), 400
        
        # Determinar qué se puede editar según el estado
        # 'Not started', 'Error', 'Aborted', 'Finished' → edición completa + regeneración de mesh
        FULL_EDIT_STATUSES = {'Not started', 'Error', 'Aborted', 'Finished'}
        can_edit_all = current_status in FULL_EDIT_STATUSES
        
        # Extraer nombre (siempre editable)
        sim_name = data.get('sim_name')
        
        if can_edit_all:
            # Simulaciones "Not started": editar todos los parámetros
            try:
                n_transmitter = int(data.get('n_transmitter'))
                n_receiver = int(data.get('n_receiver'))
                sensor_distance = float(data.get('sensor_distance'))
                emitters_pitch = float(data.get('emitters_pitch'))
                receivers_pitch = float(data.get('receivers_pitch'))
                sensor_edge_margin = float(data.get('sensor_edge_margin'))
                typical_mesh_size = float(data.get('typical_mesh_size'))
                typical_mesh_size = float(data.get('typical_mesh_size'))
                plate_thickness = float(data.get('plate_thickness'))
                porosity = float(data.get('porosity'))
                attenuation = int(data.get('attenuation'))
                mesh_type = data.get('mesh_type', 'gmsh')
                
                # Nuevos parámetros
                skin_layer_config = data.get('skin_layer_config', 'none')
                skin_thickness_top = float(data.get('skin_thickness_top', 1.3))
                skin_thickness_bottom = float(data.get('skin_thickness_bottom', 1.3))
                mesh_angle = float(data.get('mesh_angle', 0.0))
                mesh_angle_direction = data.get('mesh_angle_direction', 'none')
                roughness = float(data.get('roughness', 0.2))
            except (ValueError, TypeError) as e:
                cur.close()
                return jsonify({
                    "status": "error",
                    "message": f"Invalid data format: {str(e)}"
                }), 400
            
            # Validación de datos
            isValid, parameter, typeReceived = ValidData(
                n_transmitter, n_receiver, emitters_pitch,
                receivers_pitch, sensor_edge_margin,
                sensor_distance, typical_mesh_size, plate_thickness, porosity, mesh_type, roughness
            )
            
            if not isValid:
                cur.close()
                return jsonify({
                    "status": "error", 
                    "message": f"Error in data type: {parameter} <{typeReceived}>"
                }), 400
            
            # Calcular nueva longitud total
            plate_length = sensor_edge_margin * 2 + max(0, (n_transmitter - 1) * emitters_pitch) + sensor_distance + max(0, (n_receiver - 1) * receivers_pitch)
            
            # Actualizar todos los parámetros y limpiar mesh
            update_query = """
                UPDATE simulation 
                SET sim_name = %s,
                    n_transmitter = %s,
                    n_receiver = %s,
                    emitters_pitch = %s,
                    receivers_pitch = %s,
                    sensor_distance = %s,
                    sensor_edge_margin = %s,
                    typical_mesh_size = %s,
                    plate_thickness = %s,
                    plate_length = %s,
                    porosity = %s,
                    attenuation = %s,
                    mesh_type = %s,
                    skin_layer_config = %s,
                    skin_thickness_top = %s,
                    skin_thickness_bottom = %s,
                    mesh_angle = %s,
                    mesh_angle_direction = %s,
                    roughness = %s,
                    xml_file = NULL,
                    msh_file = NULL
                WHERE id = %s
            """
            
            cur.execute(update_query, (
                sim_name, n_transmitter, n_receiver, emitters_pitch, receivers_pitch,
                sensor_distance, sensor_edge_margin, typical_mesh_size, plate_thickness,
                plate_length, int(porosity), attenuation, mesh_type,
                skin_layer_config, skin_thickness_top, skin_thickness_bottom,
                mesh_angle, mesh_angle_direction, roughness,
                sim_id
            ))
            current_app.mysql.connection.commit()
            
            # Dejar estado en "Not started" (la malla se generará bajo demanda al ejecutar o visualizar)
            cur.execute("UPDATE simulation SET p_status = %s WHERE id = %s", ("Not started", sim_id))
            current_app.mysql.connection.commit()
            
            print(f"✅ Simulación {sim_id} actualizada instantáneamente (malla bajo demanda).")
            
            # Obtener datos actualizados para WebSocket
            cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
            columns = [col[0] for col in cur.description]
            row = cur.fetchone()
            updated_sim_data = dict(zip(columns, row)) if row else {}
            
            # Convertir tipos no serializables
            from decimal import Decimal
            from datetime import datetime, date, timedelta
            if 'file_data' in updated_sim_data:
                del updated_sim_data['file_data']
            for key, value in updated_sim_data.items():
                if isinstance(value, Decimal):
                    updated_sim_data[key] = float(value)
                elif isinstance(value, (datetime, date)):
                    updated_sim_data[key] = value.isoformat() if value else None
                elif isinstance(value, timedelta):
                    updated_sim_data[key] = value.total_seconds() if value else None
                elif isinstance(value, bytes):
                    updated_sim_data[key] = None
            
            # Notificar actualización de datos vía WebSocket
            current_app.socketio.emit('estado_simulacion', {
                'id': sim_id,
                'estado': 'Not started',
                'update_data': updated_sim_data
            })
        else:
            # Simulaciones finalizadas/otras: solo editar nombre
            update_query = """
                UPDATE simulation 
                SET sim_name = %s
                WHERE id = %s
            """
            
            cur.execute(update_query, (sim_name, sim_id))
            print(f"✅ Simulación {sim_id}: solo nombre actualizado (estado: {current_status}).")
        current_app.mysql.connection.commit()
        
        # Obtener simulación actualizada
        cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
        columns = [col[0] for col in cur.description]
        row = cur.fetchone()
        cur.close()
        
        if not row:
            return jsonify({"status": "error", "message": "Error retrieving updated simulation"}), 500
        
        row_dict = dict(zip(columns, row))
        
        # Convertir tipos no serializables y excluir campos binarios
        from decimal import Decimal
        from datetime import datetime, date, timedelta
        
        # Excluir campos binarios que no son serializables a JSON
        if 'file_data' in row_dict:
            del row_dict['file_data']
        
        for key, value in row_dict.items():
            if isinstance(value, Decimal):
                row_dict[key] = float(value)
            elif isinstance(value, (datetime, date)):
                row_dict[key] = value.isoformat() if value else None
            elif isinstance(value, timedelta):
                # Convertir timedelta a segundos totales
                row_dict[key] = value.total_seconds() if value else None
            elif isinstance(value, bytes):
                # Convertir bytes a None para evitar errores de serialización
                row_dict[key] = None
        
        # Mensaje según el tipo de actualización
        if can_edit_all:
            message = "Simulation updated successfully. Mesh generation started in background."
            # El WebSocket ya fue emitido con estado "Generating mesh" en la línea 547
        else:
            message = f"Only simulation name updated (status: {current_status}). Parameters cannot be changed for finished simulations."
            # Emitir evento de actualización via WebSocket solo para edición de nombre
            current_app.socketio.emit('estado_simulacion', {
                'id': sim_id,
                'estado': current_status,
                'update_data': row_dict
            })
        
        return jsonify({
            "status": "success",
            "message": message,
            "simulation": row_dict,
            "full_edit": can_edit_all
        })
        
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid simulation ID"}), 400
    except Exception as e:
        import traceback
        print(f"❌ Error updating simulation {id}: {e}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


def duplicate_simulation_service(id, request):
    """Duplicar una simulación existente con un nuevo nombre"""
    try:
        sim_id = int(id)
        data = request.json
        new_name = data.get('sim_name', None)
        
        # Obtener simulación original
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
        columns = [col[0] for col in cur.description]
        original = cur.fetchone()
        
        if not original:
            cur.close()
            return jsonify({"status": "error", "message": "Simulation not found"}), 404
        
        # Convertir a diccionario
        original_dict = dict(zip(columns, original))
        
        # Generar nombre para la copia
        if not new_name:
            original_name = original_dict.get('sim_name', 'Simulation')
            new_name = f"{original_name} (Copy)"
        
        print(f"📋 Duplicando simulación {sim_id}: '{original_dict.get('sim_name')}' → '{new_name}'")
        
        # Copiar archivos de mesh si existen (solo xml_file y msh_file están en la tabla)
        xml_file = original_dict.get('xml_file')
        msh_file = original_dict.get('msh_file')
        
        # Insertar nueva simulación con los mismos parámetros Y mesh heredado
        insert_query = """
            INSERT INTO simulation (
                sim_name, n_transmitter, n_receiver, emitters_pitch, receivers_pitch,
                sensor_distance, sensor_edge_margin, typical_mesh_size, plate_thickness,
                plate_length, porosity, attenuation, mesh_type, p_status,
                skin_layer_config, skin_thickness_top, skin_thickness_bottom,
                mesh_angle, mesh_angle_direction, roughness,
                xml_file, msh_file
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        
        cur.execute(insert_query, (
            new_name,
            original_dict['n_transmitter'],
            original_dict['n_receiver'],
            original_dict['emitters_pitch'],
            original_dict['receivers_pitch'],
            original_dict['sensor_distance'],
            original_dict['sensor_edge_margin'],
            original_dict['typical_mesh_size'],
            original_dict['plate_thickness'],
            original_dict['plate_length'],
            original_dict['porosity'],
            original_dict['attenuation'],
            original_dict.get('mesh_type', 'gmsh'),
            'Not started',  # Nueva simulación siempre empieza como "Not started"
            original_dict.get('skin_layer_config', 'none'),
            original_dict.get('skin_thickness_top', 1.3),
            original_dict.get('skin_thickness_bottom', 1.3),
            original_dict.get('mesh_angle', 0.0),
            original_dict.get('mesh_angle_direction', 'none'),
            original_dict.get('roughness', 0.2),
            xml_file,  # Copiar xml_file de la original
            msh_file   # Copiar msh_file de la original
        ))
        
        new_id = cur.lastrowid
        current_app.mysql.connection.commit()
        
        # Copiar archivos físicos de mesh si existen
        if xml_file or msh_file:
            try:
                import shutil
                
                # Copiar archivo XML si existe
                if xml_file:
                    original_xml_path = get_mesh_file_path(sim_id, xml_file)
                    new_xml_path = get_mesh_file_path(new_id, xml_file)
                    
                    if os.path.exists(original_xml_path):
                        os.makedirs(os.path.dirname(new_xml_path), exist_ok=True)
                        shutil.copy2(original_xml_path, new_xml_path)
                        print(f"📄 Archivo XML copiado: {xml_file}")
                
                # Copiar archivo MSH si existe
                if msh_file:
                    original_msh_path = get_mesh_file_path(sim_id, msh_file)
                    new_msh_path = get_mesh_file_path(new_id, msh_file)
                    
                    if os.path.exists(original_msh_path):
                        os.makedirs(os.path.dirname(new_msh_path), exist_ok=True)
                        shutil.copy2(original_msh_path, new_msh_path)
                        print(f"📄 Archivo MSH copiado: {msh_file}")
                        
                print(f"✅ Mesh heredado de simulación {sim_id}")
            except Exception as mesh_error:
                print(f"⚠️ Error copiando archivos de mesh: {mesh_error}")
                # Continuar aunque falle la copia de archivos físicos
        
        # Obtener la simulación recién creada
        cur.execute("SELECT * FROM simulation WHERE id = %s", (new_id,))
        new_sim = cur.fetchone()
        new_sim_dict = dict(zip(columns, new_sim))
        cur.close()
        
        print(f"✅ Simulación duplicada exitosamente: ID {new_id}")
        
        # Convertir tipos no serializables
        for key, value in new_sim_dict.items():
            if isinstance(value, Decimal):
                new_sim_dict[key] = float(value)
            elif isinstance(value, (datetime, date)):
                new_sim_dict[key] = value.isoformat() if value else None
            elif isinstance(value, timedelta):
                new_sim_dict[key] = value.total_seconds() if value else None
            elif isinstance(value, bytes):
                new_sim_dict[key] = None
        
        # Emitir evento WebSocket para notificar la nueva simulación
        current_app.socketio.emit('simulation_created', {
            'simulation': new_sim_dict
        })
        
        return jsonify({
            "status": "success",
            "message": f"Simulation duplicated successfully as '{new_name}'",
            "simulation": new_sim_dict,
            "original_id": sim_id,
            "new_id": new_id
        })
        
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid simulation ID"}), 400
    except Exception as e:
        import traceback
        print(f"❌ Error duplicating simulation {id}: {e}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


def load_data_service():
    cur = current_app.mysql.connection.cursor()
    cur.execute('SELECT * FROM simulation ORDER BY id DESC')
    columns = [col[0] for col in cur.description]
    data = cur.fetchall()
    
    # Obtener simulaciones en cola ordenadas por ID (orden de llegada)
    cur.execute("SELECT id FROM simulation WHERE p_status = 'Queued' ORDER BY id ASC")
    queued_sims = [row[0] for row in cur.fetchall()]
    
    data_t = []
    for row in data:
        row_dict = dict(zip(columns, row))
        
        # Usar queue_order de la base de datos como queue_position
        queue_position = row_dict.get('queue_order')
        if queue_position is not None:
            queue_position = int(queue_position)
        
        data_t.append({
            'id': row_dict['id'],
            'sim_name': row_dict['sim_name'],
            'n_transmitter': row_dict['n_transmitter'],
            'n_receiver': row_dict['n_receiver'],
            'emitters_pitch': row_dict['emitters_pitch'],
            'receivers_pitch': row_dict['receivers_pitch'],
            'sensor_distance': row_dict['sensor_distance'],
            'sensor_edge_margin': float(row_dict['sensor_edge_margin']) if row_dict['sensor_edge_margin'] is not None else None,
            'typical_mesh_size': row_dict['typical_mesh_size'],
            'plate_thickness': row_dict['plate_thickness'],
            'plate_length': row_dict['plate_length'],
            'porosity': float(row_dict['porosity']) if row_dict['porosity'] is not None else None,
            'attenuation': row_dict['attenuation'],
            'mesh_type': row_dict['mesh_type'],
            'skin_layer_config': row_dict.get('skin_layer_config', 'none'),
            'skin_thickness_top': float(row_dict['skin_thickness_top']) if row_dict.get('skin_thickness_top') is not None else 1.3,
            'skin_thickness_bottom': float(row_dict['skin_thickness_bottom']) if row_dict.get('skin_thickness_bottom') is not None else 1.3,
            'p_status': row_dict['p_status'],
            'queue_position': queue_position,  # Nuevo campo
            'start_datetime': row_dict['start_datetime'],
            'finish_datetime': row_dict['finish_datetime'],
            'xml_file': row_dict.get('xml_file'),
            'msh_file': row_dict.get('msh_file'),
            'result_file': row_dict.get('result_file'),
            'execution_time': row_dict.get('execution_time'),
            'mesh_angle': row_dict.get('mesh_angle'),
            'mesh_angle_direction': row_dict.get('mesh_angle_direction'),
            'roughness': row_dict.get('roughness') if row_dict.get('roughness') is not None else row_dict.get('mesh_amplitude', 0),
            
        })
    cur.close()
    return jsonify(data_t)

def delete_sim_service(id):
    try:
        # Validate that id is numeric
        sim_id = int(id)
        delete_simulation(current_app.mysql, sim_id)
        return jsonify({"status": "success", "message": f"Simulation {sim_id} deleted"})
    except ValueError:
        return jsonify({"status": "error", "message": f"Invalid simulation ID: {id}"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def delete_all_sims_service():
    try:
        affected_rows = delete_all_simulations(current_app.mysql)
        return jsonify({"status": "success", "message": f"Deleted {affected_rows} simulations"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def load_data_id_service(id):
    # Usar un cursor que devuelva dicts para evitar depender de índices
    cur = current_app.mysql.connection.cursor()
    cur.execute("SELECT * FROM simulation WHERE id = %s", (id,))
    columns = [col[0] for col in cur.description]
    data = cur.fetchall()
    data_t = []
    for row in data:
        row_dict = dict(zip(columns, row))
        # Devolver solo los campos relevantes
        data_t.append({
            'id': row_dict['id'],
            'sim_name': row_dict['sim_name'],
            'n_transmitter': row_dict['n_transmitter'],
            'n_receiver': row_dict['n_receiver'],
            'emitters_pitch': row_dict['emitters_pitch'],
            'receivers_pitch': row_dict['receivers_pitch'],
            'sensor_distance': row_dict['sensor_distance'],
            'sensor_edge_margin': float(row_dict['sensor_edge_margin']) if row_dict['sensor_edge_margin'] is not None else None,
            'typical_mesh_size': row_dict['typical_mesh_size'],
            'plate_thickness': row_dict['plate_thickness'],
            'plate_length': row_dict['plate_length'],
            'porosity': float(row_dict['porosity']) if row_dict['porosity'] is not None else None,
            'attenuation': row_dict['attenuation'],
            'mesh_type': row_dict['mesh_type'],
            'skin_layer_config': row_dict.get('skin_layer_config', 'none'),
            'skin_thickness_top': float(row_dict['skin_thickness_top']) if row_dict.get('skin_thickness_top') is not None else 1.3,
            'skin_thickness_bottom': float(row_dict['skin_thickness_bottom']) if row_dict.get('skin_thickness_bottom') is not None else 1.3,
            'mesh_angle': float(row_dict['mesh_angle']) if row_dict.get('mesh_angle') is not None else 0.0,
            'mesh_angle_direction': row_dict.get('mesh_angle_direction', 'none'),
            'roughness': float(row_dict['roughness']) if row_dict.get('roughness') is not None else float(row_dict.get('mesh_amplitude', 0)),
            'p_status': row_dict['p_status'],
            'start_datetime': row_dict['start_datetime'],
            'finish_datetime': row_dict['finish_datetime'],
        })
    cur.close()
    return jsonify(data_t)

def load_data_porosity_service(v):
    cur = current_app.mysql.connection.cursor()
    cur.execute("SELECT * FROM simulation WHERE porosity = %s", (v,))
    columns = [col[0] for col in cur.description]
    data = cur.fetchall()
    data_t = []
    for row in data:
        row_dict = dict(zip(columns, row))
        data_t.append({
            'id': row_dict['id'],
            'sim_name': row_dict['sim_name'],
            'n_transmitter': row_dict['n_transmitter'],
            'n_receiver': row_dict['n_receiver'],
            'emitters_pitch': row_dict['emitters_pitch'],
            'receivers_pitch': row_dict['receivers_pitch'],
            'sensor_distance': row_dict['sensor_distance'],
            'sensor_edge_margin': float(row_dict['sensor_edge_margin']) if row_dict['sensor_edge_margin'] is not None else None,
            'typical_mesh_size': row_dict['typical_mesh_size'],
            'plate_thickness': row_dict['plate_thickness'],
            'plate_length': row_dict['plate_length'],
            'porosity': float(row_dict['porosity']) if row_dict['porosity'] is not None else None,
            'attenuation': row_dict['attenuation'],
            'mesh_type': row_dict['mesh_type'],
            'skin_layer_config': row_dict.get('skin_layer_config', 'none'),
            'skin_thickness_top': float(row_dict['skin_thickness_top']) if row_dict.get('skin_thickness_top') is not None else 1.3,
            'skin_thickness_bottom': float(row_dict['skin_thickness_bottom']) if row_dict.get('skin_thickness_bottom') is not None else 1.3,
            'roughness': float(row_dict['roughness']) if row_dict.get('roughness') is not None else 0.2,
            'p_status': row_dict['p_status']
        })
    cur.close()
    return jsonify(data_t)

def load_data_distance_service(v):
    cur = current_app.mysql.connection.cursor()
    cur.execute("SELECT * FROM simulation WHERE sensor_distance like %s", (f"%{v}%",))
    columns = [col[0] for col in cur.description]
    data = cur.fetchall()
    data_t = []
    for row in data:
        row_dict = dict(zip(columns, row))
        data_t.append({
            'id': row_dict['id'],
            'sim_name': row_dict['sim_name'],
            'n_transmitter': row_dict['n_transmitter'],
            'n_receiver': row_dict['n_receiver'],
            'emitters_pitch': row_dict['emitters_pitch'],
            'receivers_pitch': row_dict['receivers_pitch'],
            'sensor_distance': row_dict['sensor_distance'],
            'sensor_edge_margin': float(row_dict['sensor_edge_margin']) if row_dict['sensor_edge_margin'] is not None else None,
            'typical_mesh_size': row_dict['typical_mesh_size'],
            'plate_thickness': row_dict['plate_thickness'],
            'plate_length': row_dict['plate_length'],
            'porosity': float(row_dict['porosity']) if row_dict['porosity'] is not None else None,
            'attenuation': row_dict['attenuation'],
            'mesh_type': row_dict['mesh_type'],
            'skin_layer_config': row_dict.get('skin_layer_config', 'none'),
            'skin_thickness_top': float(row_dict['skin_thickness_top']) if row_dict.get('skin_thickness_top') is not None else 1.3,
            'skin_thickness_bottom': float(row_dict['skin_thickness_bottom']) if row_dict.get('skin_thickness_bottom') is not None else 1.3,
            'mesh_angle': float(row_dict['mesh_angle']) if row_dict.get('mesh_angle') is not None else 0.0,
            'mesh_angle_direction': row_dict.get('mesh_angle_direction', 'none'),
            'roughness': float(row_dict['roughness']) if row_dict.get('roughness') is not None else 0.2,
            'p_status': row_dict['p_status']
        })
    cur.close()
    return jsonify(data_t)

def load_data_download_service(v):
    cur = current_app.mysql.connection.cursor()
    # Initial attempt: Try to fetch all columns
    # If file_data doesn't exist, this might fail with OperationalError
    
    filedata = None
    result_filename = None
    sim_name = "simulation"
    
    try:
        cur.execute("SELECT file_data, result_step_01, sim_name FROM simulation WHERE id = %s", (v,))
        row = cur.fetchone()
        if row:
            filedata = row[0]
            result_filename = row[1]
            sim_name = row[2]
            
    except Exception as e:
        # Fallback if file_data column missing or other error
        print(f"⚠️ Error fetching file_data from DB: {e}")
        # Try fetching just filename and sim_name
        try:
            # Re-create cursor if previous query failed it might be unusable? Usually okay with new execute?
            # Safer to ensure cursor clean state is not needed but let's try.
            # MySQLdb cursor might need reset or just new query. 
            # If cursor is invalid, we might need a new one, but let's try simple query.
            pass
        except:
            pass
            
    # Retry getting filename if we failed
    if result_filename is None:
        try:
            # Clean slate: close old cursor, open new one
            cur.close()
            cur = current_app.mysql.connection.cursor()
            cur.execute("SELECT result_step_01, sim_name FROM simulation WHERE id = %s", (v,))
            row = cur.fetchone()
            if row:
                result_filename = row[0]
                sim_name = row[1]
        except Exception as e2:
            print(f"❌ Error fetching simulation info: {e2}")
            cur.close()
            return jsonify({'error': 'Simulation not found'}), 404
            
    cur.close()
    
    # Clean the simulation name to be file-system safe
    clean_sim_name = str(sim_name).replace(' ', '_').replace('/', '-').replace('\\', '-') if sim_name else f"simulation_{v}"
    
    # Force the downloaded filename to be the simulation name
    filename = f"{clean_sim_name}.mat"
    
    # Strategy 1: Use filedata from DB if available
    if filedata:
        return send_file(
            BytesIO(filedata), 
            as_attachment=True, 
            download_name=filename, 
            mimetype='application/x-matlab-data'
        )
        
    # Strategy 2: Look for file on disk
    from .file_manager import get_mat_file_path
    
    # Try with exact filename from result_step_01
    if result_filename:
        file_path = get_mat_file_path(v, result_filename)
        if os.path.exists(file_path):
            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename,
                mimetype='application/x-matlab-data'
            )
            
    # Try looking in the directory for any .mat file if specific one failed
    # or if we only have sim_name
    from .file_manager import get_simulation_dir
    sim_dir = get_simulation_dir(v)
    mat_dir = os.path.join(sim_dir, "mat_files")
    
    if os.path.exists(mat_dir):
        files = [f for f in os.listdir(mat_dir) if f.endswith('.mat')]
        if files:
            # Pick the most recent or matching one?
            # If result_filename exists but wasn't found, maybe name mismatch
            # Let's take the first one or the one matching sim_name
            target_file = files[0]
            # If we were looking for a specific file and it's there (case diff?), pick it
            if result_filename:
                 for f in files:
                     if f == result_filename:
                         target_file = f
                         break
            
            file_path = os.path.join(mat_dir, target_file)
            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename, # keep original requested name
                mimetype='application/x-matlab-data'
            )
            
    return jsonify({'error': 'Result file not found in database or disk'}), 404

def download_graphics_service(v):
    from .file_manager import get_plots_dir
    import os
    cur = current_app.mysql.connection.cursor()
    cur.execute("SELECT sim_name FROM simulation WHERE id = %s", (v,))
    row = cur.fetchone()
    cur.close()
    
    if not row:
        return jsonify({'error': 'Simulation not found'}), 404
        
    sim_name = row[0]
    clean_sim_name = str(sim_name).replace(' ', '_').replace('/', '-').replace('\\', '-') if sim_name else f"simulation_{v}"
    
    plots_dir = get_plots_dir(v)
    if os.path.exists(plots_dir):
        files = [f for f in os.listdir(plots_dir) if f.endswith(('.png', '.jpg'))]
        if files:
            file_path = os.path.join(plots_dir, files[0])
            ext = os.path.splitext(files[0])[1]
            filename = f"{clean_sim_name}_graphics{ext}"
            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename
            )
            
    return jsonify({'error': 'Graphics file not found on disk'}), 404

def batch_run_simulations_service(request):
    """
    Ejecutar (o encolar) múltiples simulaciones a la vez.
    Body: { "ids": [1, 2, 3] }
    
    Cada simulación se ejecuta si no hay otra corriendo, o se encola.
    Solo las simulaciones en estado elegible son procesadas:
    - "Not started": primera ejecución
    - "Error" / "Finished" / "Aborted": re-ejecución
    """
    try:
        data = request.get_json()
        if not data or 'ids' not in data:
            return jsonify({'error': 'Se requiere campo "ids" con la lista de IDs'}), 400

        ids = data['ids']
        if not isinstance(ids, list) or len(ids) == 0:
            return jsonify({'error': '"ids" debe ser una lista no vacía de IDs'}), 400

        # Statuses que permiten ejecutar normalmente (primera vez)
        RUN_STATUSES = {'Not started'}
        # Statuses que permiten re-ejecutar
        RERUN_STATUSES = {'Error', 'Finished', 'Aborted'}
        ELIGIBLE_STATUSES = RUN_STATUSES | RERUN_STATUSES
        BLOCKED_STATUSES = {'Running', 'Aborting', 'Queued', 'Generating mesh', 'Mesh generation failed'}

        from .queue_service import should_queue_simulation, queue_simulation
        from ..models.simulation_model import update_simulation_status
        from app import celery
        from datetime import datetime
        import time as _time

        results = []
        queued_count = 0
        started_count = 0
        skipped_count = 0

        for sim_id in ids:
            try:
                # Obtener datos actuales de la simulación
                cur = current_app.mysql.connection.cursor()
                cur.execute("""
                    SELECT p_status, xml_file,
                           n_transmitter, n_receiver, emitters_pitch, receivers_pitch,
                           sensor_edge_margin, typical_mesh_size, sensor_distance, plate_thickness,
                           porosity, plate_length, attenuation, mesh_type,
                           skin_layer_config, skin_thickness_top, skin_thickness_bottom, roughness
                    FROM simulation WHERE id = %s
                """, (sim_id,))
                row = cur.fetchone()
                cur.close()

                if not row:
                    results.append({'id': sim_id, 'status': 'error', 'message': f'Simulation {sim_id} not found'})
                    skipped_count += 1
                    continue

                current_status = row[0]
                xml_path = row[1]

                # Verificar elegibilidad
                if current_status in BLOCKED_STATUSES:
                    results.append({
                        'id': sim_id,
                        'status': 'skipped',
                        'message': f'Simulation is {current_status}, cannot run now'
                    })
                    skipped_count += 1
                    continue

                if current_status not in ELIGIBLE_STATUSES:
                    results.append({
                        'id': sim_id,
                        'status': 'skipped',
                        'message': f'Simulation status "{current_status}" is not eligible for batch run'
                    })
                    skipped_count += 1
                    continue

                # Archivo de malla (si no existe aún, Celery lo generará bajo demanda)
                if xml_path and not os.path.isabs(xml_path):
                    xml_path = os.path.abspath(xml_path)
                if xml_path and not os.path.exists(xml_path):
                    xml_path = None

                simulation_params = {
                    'n_transmitter':       row[2],
                    'n_receiver':          row[3],
                    'emitters_pitch':      row[4],
                    'receivers_pitch':     row[5],
                    'sensor_edge_margin':  row[6],
                    'typical_mesh_size':   row[7],
                    'sensor_distance':     row[8],
                    'plate_thickness':     row[9],
                    'porosity':            row[10],
                    'plate_length':        row[11],
                    'attenuation':         row[12],
                    'mesh_type':           row[13],
                    'xml_file':            xml_path,
                    'skin_layer_config':   row[14] if row[14] is not None else 'none',
                    'skin_thickness_top':  float(row[15]) if row[15] is not None else 1.3,
                    'skin_thickness_bottom': float(row[16]) if row[16] is not None else 1.3,
                    'roughness':      float(row[17]) if row[17] is not None else 0.2,
                }

                # Para re-ejecuciones limpiar campos de resultado previos
                if current_status in RERUN_STATUSES:
                    cur = current_app.mysql.connection.cursor()
                    cur.execute("""
                        UPDATE simulation
                        SET finish_datetime = NULL,
                            execution_time  = NULL,
                            image           = NULL,
                            result_step_01  = NULL,
                            result_file     = NULL
                        WHERE id = %s
                    """, (sim_id,))
                    current_app.mysql.connection.commit()
                    cur.close()

                # Decidir: encolar o ejecutar directamente
                if should_queue_simulation():
                    queue_simulation(sim_id)
                    results.append({'id': sim_id, 'status': 'queued', 'message': 'Queued'})
                    queued_count += 1
                else:
                    # Ejecutar directamente en Celery
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                    task_id = f'simulation_{sim_id}_{timestamp}'

                    update_simulation_status(
                        current_app.mysql, sim_id, "Running",
                        update_time_field='start_datetime',
                        task_id=task_id
                    )
                    current_app.mysql.connection.commit()

                    # Pequeña pausa para que los commits de status no colisionen en la cola
                    _time.sleep(0.05)

                    notificar_estado_simulacion(sim_id, 'Running')

                    task = celery.send_task(
                        'simulations.run_simulation',
                        args=[sim_id, simulation_params],
                        task_id=task_id
                    )

                    results.append({'id': sim_id, 'status': 'started', 'task_id': task.id})
                    started_count += 1

            except Exception as sim_error:
                print(f"❌ Error batch-running simulation {sim_id}: {sim_error}")
                import traceback
                traceback.print_exc()
                results.append({'id': sim_id, 'status': 'error', 'message': str(sim_error)})
                skipped_count += 1

        return jsonify({
            'success': True,
            'summary': {
                'total': len(ids),
                'started': started_count,
                'queued': queued_count,
                'skipped': skipped_count,
            },
            'results': results
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Error in batch_run_simulations_service: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def rerun_simulation_service(id):
    """Re-ejecutar una simulación existente (Error, Finished, Aborted)"""
    try:
        # Obtener datos de la simulación existente
        cur = current_app.mysql.connection.cursor()
        cur.execute("""
            SELECT p_status, n_transmitter, n_receiver, emitters_pitch, receivers_pitch, 
                   sensor_edge_margin, typical_mesh_size, sensor_distance, plate_thickness, 
                   porosity, plate_length, attenuation, mesh_type, xml_file,
                   skin_layer_config, skin_thickness_top, skin_thickness_bottom,
                   roughness
            FROM simulation WHERE id = %s
        """, (id,))
        
        row = cur.fetchone()
        cur.close()
        
        if not row:
            return jsonify({'error': f'Simulation {id} not found'}), 404
        
        current_status = row[0]
        allowed_statuses = {"Error", "Finished", "Aborted"}
        
        if current_status not in allowed_statuses:
            return jsonify({
                'error': f'Cannot re-run simulation with status "{current_status}". Only Error, Finished, or Aborted simulations can be re-executed.'
            }), 400
        
        # Preparar parámetros desde la base de datos
        simulation_params = {
            'n_transmitter': row[1],
            'n_receiver': row[2],
            'emitters_pitch': row[3],
            'receivers_pitch': row[4],
            'sensor_edge_margin': row[5],
            'typical_mesh_size': row[6],
            'sensor_distance': row[7],
            'plate_thickness': row[8],
            'porosity': row[9],
            'plate_length': row[10],
            'attenuation': row[11],
            'mesh_type': row[12],
            'xml_file': row[13],
            'skin_layer_config': row[14] if len(row) > 14 and row[14] is not None else 'none',
            'skin_thickness_top': float(row[15]) if len(row) > 15 and row[15] is not None else 1.3,
            'skin_thickness_bottom': float(row[16]) if len(row) > 16 and row[16] is not None else 1.3,
            'roughness': float(row[17]) if len(row) > 17 and row[17] is not None else 0.2,
        }
        
        # Archivo de malla (si no existe aún, Celery lo generará bajo demanda)
        xml_path = simulation_params.get('xml_file')
        if xml_path and not os.path.isabs(xml_path):
            xml_path = os.path.abspath(xml_path)
        if xml_path and not os.path.exists(xml_path):
            xml_path = None
        simulation_params['xml_file'] = xml_path
        
        # Resetear campos de tiempo y resultado
        cur = current_app.mysql.connection.cursor()
        cur.execute("""
            UPDATE simulation 
            SET finish_datetime = NULL, 
                execution_time = NULL,
                image = NULL,
                result_step_01 = NULL,
                result_file = NULL
            WHERE id = %s
        """, (id,))
        current_app.mysql.connection.commit()
        cur.close()
        
        # ===== SISTEMA DE COLA =====
        from .queue_service import should_queue_simulation, queue_simulation
        
        if should_queue_simulation():
            queue_simulation(id)
            return jsonify({
                'message': 'Simulación encolada para re-ejecución',
                'simulation_id': id,
                'status': 'Queued',  # Capitalizado para consistencia
                'queued': True,
                'success': True
            }), 202
        else:
            from ..models.simulation_model import update_simulation_status
            
            print(f"🔄 Re-ejecutando simulación {id}...")
            print(f"📋 Parámetros: {simulation_params}")
            
            from app import celery
            from datetime import datetime
            
            # Generar un task_id único para evitar conflictos con tareas revocadas
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            task_id = f'simulation_{id}_{timestamp}'
            
            # Actualizar estado a Running Y almacenar task_id
            status, start_time = update_simulation_status(
                current_app.mysql, id, "Running", 
                update_time_field='start_datetime',
                task_id=task_id
            )
            current_app.mysql.connection.commit()
            print(f"✅ Estado actualizado a Running para simulación {id}")
            print(f"🆔 Task ID almacenado en DB: {task_id}")

            import time
            time.sleep(0.1)
            
            notificar_estado_simulacion(id, 'Running')
            print(f"📡 WebSocket emitido: Running para simulación {id}")
            
            print(f"🔧 Enviando tarea a Celery para simulación {id}...")
            task = celery.send_task(
                'simulations.run_simulation',
                args=[id, simulation_params],
                task_id=task_id
            )
            
            print(f"✅ Tarea enviada a Celery. Simulation ID: {id}, Task ID: {task.id}")
            print(f"📊 Estado de la tarea: {task.state}")
            
            return jsonify({
                'message': 'Simulación re-ejecutada exitosamente',
                'simulation_id': id,
                'task_id': task.id,
                'status': 'Running',
                'success': True
            }), 200
            
    except Exception as e:
        print(f"❌ Error al re-ejecutar simulación {id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def run_simulation_service(id, request):
    try:
        data = request.json or {}

        # ===== Cargar datos desde la BD (fuente de verdad) =====
        cur = current_app.mysql.connection.cursor()
        cur.execute("""
            SELECT p_status, n_transmitter, n_receiver, emitters_pitch, receivers_pitch,
                   sensor_edge_margin, typical_mesh_size, sensor_distance, plate_thickness,
                   porosity, plate_length, attenuation, mesh_type, xml_file,
                   skin_layer_config, skin_thickness_top, skin_thickness_bottom, roughness
            FROM simulation WHERE id = %s
        """, (id,))
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({'error': f'Simulation {id} not found'}), 404

        current_status = row[0]
        blocked_statuses = {"Running", "Aborting", "Queued"}

        if current_status in blocked_statuses:
            return jsonify({'error': f'Simulation {id} is already {current_status}'}), 400

        # Construir parámetros desde la BD, permitiendo override desde el body
        simulation_params = {
            'n_transmitter':        data.get('n_transmitter',       row[1]),
            'n_receiver':           data.get('n_receiver',          row[2]),
            'emitters_pitch':       data.get('emitters_pitch',      row[3]),
            'receivers_pitch':      data.get('receivers_pitch',     row[4]),
            'sensor_edge_margin':   data.get('sensor_edge_margin',  row[5]),
            'typical_mesh_size':    data.get('typical_mesh_size',   row[6]),
            'sensor_distance':      data.get('sensor_distance',     row[7]),
            'plate_thickness':      data.get('plate_thickness',     row[8]),
            'porosity':             data.get('porosity',            row[9]),
            'plate_length':         data.get('plate_length',        row[10]),
            'attenuation':          data.get('attenuation',         row[11]),
            'mesh_type':            data.get('mesh_type',           row[12]) or 'gmsh',
            # xml_file: preferir la ruta de la BD (la que realmente existe en disco)
            'xml_file':             row[13] or data.get('xml_file'),
            'skin_layer_config':    data.get('skin_layer_config',   row[14] if row[14] is not None else 'none'),
            'skin_thickness_top':   float(data.get('skin_thickness_top',   row[15] if row[15] is not None else 1.3)),
            'skin_thickness_bottom': float(data.get('skin_thickness_bottom', row[16] if row[16] is not None else 1.3)),
            'roughness':       float(data.get('roughness', row[17] if row[17] is not None else 0.2)),
        }

        # Archivo de malla (si no existe aún, Celery lo generará bajo demanda)
        xml_path = simulation_params.get('xml_file')
        if xml_path and not os.path.isabs(xml_path):
            xml_path = os.path.abspath(xml_path)
        if xml_path and not os.path.exists(xml_path):
            xml_path = None
        simulation_params['xml_file'] = xml_path

        # ===== SISTEMA DE COLA =====
        from .queue_service import should_queue_simulation, queue_simulation

        if should_queue_simulation():
            queue_simulation(id)
            return jsonify({
                'message': 'Simulación encolada. Se ejecutará cuando termine la simulación actual',
                'simulation_id': id,
                'status': 'Queued',
                'queued': True
            }), 202
        else:
            from ..models.simulation_model import update_simulation_status
            from app import celery
            from datetime import datetime

            # Generar un task_id único para evitar conflictos con tareas revocadas
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            task_id = f'simulation_{id}_{timestamp}'

            # Actualizar estado a Running Y almacenar task_id
            status, start_time = update_simulation_status(
                current_app.mysql, id, "Running",
                update_time_field='start_datetime',
                task_id=task_id
            )
            current_app.mysql.connection.commit()
            print(f"✅ Estado actualizado a Running para simulación {id}")
            print(f"🆔 Task ID almacenado en DB: {task_id}")

            import time
            time.sleep(0.1)

            notificar_estado_simulacion(id, 'Running') #websocket

            task = celery.send_task(
                'simulations.run_simulation',
                args=[id, simulation_params],
                task_id=task_id
            )

            print(f"✅ Simulación {id} enviada a Celery. Task ID: {task.id}")

            return jsonify({
                'message': 'Simulación iniciada',
                'simulation_id': id,
                'task_id': task.id,
                'status': status,
                'queued': False,
                'start_datetime': start_time.isoformat() + 'Z' if start_time else None
            }), 202

    except Exception as e:
        import traceback
        error_msg = f"Error inesperado al procesar simulación {id}: {str(e)}"
        print(f"❌ {error_msg}")
        print(traceback.format_exc())
        # Sólo marcar Error si la sim estaba en un estado processable (no en 400/404 donde
        # ya se retornó antes de cambiar el estado)
        try:
            cur_chk = current_app.mysql.connection.cursor()
            cur_chk.execute("SELECT p_status FROM simulation WHERE id = %s", (id,))
            chk_row = cur_chk.fetchone()
            cur_chk.close()
            chk_status = chk_row[0] if chk_row else None
            # Solo marcar Error si la sim quedó en Running (ya la cambiamos antes de enviar a Celery)
            if chk_status == 'Running':
                from ..models.simulation_model import update_simulation_status
                update_simulation_status(current_app.mysql, id, "Error", update_time_field='finish_datetime')
                notificar_estado_simulacion(id, "Error")
        except Exception:
            pass
        return jsonify({'error': error_msg}), 500



def load_data_id_test_service(id):
    cur = current_app.mysql.connection.cursor()
    cur.execute("SELECT * FROM simulation WHERE id = %s", (id,))
    columns = [col[0] for col in cur.description]
    data = cur.fetchall()
    data_t = []
    for row in data:
        row_dict = dict(zip(columns, row))
        data_t.append({
            'id': row_dict['id'],
            'sim_name': row_dict['sim_name'],
            'n_transmitter': row_dict['n_transmitter'],
            'n_receiver': row_dict['n_receiver'],
            'emitters_pitch': row_dict['emitters_pitch'],
            'receivers_pitch': row_dict['receivers_pitch'],
            'sensor_distance': row_dict['sensor_distance'],
            'sensor_edge_margin': float(row_dict['sensor_edge_margin']) if row_dict['sensor_edge_margin'] is not None else None,
            'typical_mesh_size': row_dict['typical_mesh_size'],
            'plate_thickness': row_dict['plate_thickness'],
            'plate_length': row_dict['plate_length'],
            'porosity': float(row_dict['porosity']) if row_dict['porosity'] is not None else None,
            'attenuation': row_dict['attenuation'],
            'mesh_type': row_dict['mesh_type'],
            'roughness': float(row_dict['roughness']) if row_dict.get('roughness') is not None else 0.2,
            'p_status': row_dict['p_status']
        })
    cur.close()
    return jsonify(data_t)

def active_sims_service():
    data = get_simulation_count_running(current_app.mysql)
    data_t = {"count" : data[0]}
    return jsonify(data_t)

def ValidData(n_transmitter, n_receiver, emitters_pitch, recivers_pitch, sensor_edge, distance, typical_mesh_size, plate_thickness, porosity, mesh_type, roughness=0.2):
    if(type(n_transmitter) is not int):
        return False, "n_transmitter", str(type(n_transmitter))
    elif(type(n_receiver) is not int):
        return False, "n_receiver", str(type(n_receiver))
    elif(n_transmitter < 1):
        return False, "n_transmitter", f"invalid value: {n_transmitter} (must be >= 1)"
    elif(n_receiver < 1):
        return False, "n_receiver", f"invalid value: {n_receiver} (must be >= 1)"
    elif(type(emitters_pitch) is not int and type(emitters_pitch) is not float):
        return False, "emitters_pitch", str(type(emitters_pitch))
    elif(emitters_pitch <= 0):
        return False, "emitters_pitch", f"invalid value: {emitters_pitch} (must be > 0)"
    elif(type(recivers_pitch) is not int and type(recivers_pitch) is not float):
        return False, "recivers_pitch", str(type(recivers_pitch))
    elif(recivers_pitch <= 0):
        return False, "recivers_pitch", f"invalid value: {recivers_pitch} (must be > 0)"
    elif(type(sensor_edge) is not int and type(sensor_edge) is not float):
        return False, "sensor_edge", str(type(sensor_edge))
    elif(sensor_edge < 0):
        return False, "sensor_edge", f"invalid value: {sensor_edge} (must be >= 0)"
    elif(type(distance) is not int and type(distance) is not float):
        return False, "distance", str(type(distance))
    elif(distance <= 0):
        return False, "distance", f"invalid value: {distance} (must be > 0)"
    elif(type(typical_mesh_size) is not int and type(typical_mesh_size) is not float):
        return False, "typical_mesh_size", str(type(typical_mesh_size))
    elif(typical_mesh_size <= 0):
        return False, "typical_mesh_size", f"invalid value: {typical_mesh_size} (must be > 0)"
    elif(type(plate_thickness) is not int and type(plate_thickness) is not float):
        return False, "plate_thinckenss", str(type(plate_thickness))
    elif(plate_thickness <= 0):
        return False, "plate_thickness", f"invalid value: {plate_thickness} (must be > 0)"
    elif(type(porosity) is not int and type(porosity) is not float):
        return False, "porosity", str(type(porosity))
    elif(porosity < 0 or porosity > 30):
        return False, "porosity", f"invalid range: {porosity} (must be between 0 and 30)"
    elif(type(mesh_type) is not str):
        return False, "mesh_type", str(type(mesh_type))
    elif(mesh_type not in ["gmsh", "mshr"]):
        return False, "mesh_type", f"invalid value: {mesh_type} (must be 'gmsh' or 'mshr')"
    elif(type(roughness) is not int and type(roughness) is not float):
        return False, "roughness", str(type(roughness))
    elif(roughness < 0):
        return False, "roughness", f"invalid value: {roughness} (must be >= 0)"
    else:
        return True, "", ""

def notificar_estado_simulacion(id, estado, queue_position=None):
    """Notificar cambio de estado con solo los campos relevantes según el estado"""
    try:
        # Obtener solo los campos necesarios según el estado
        cur = current_app.mysql.connection.cursor()
        cur.execute("""
            SELECT id, p_status, start_datetime, finish_datetime
            FROM simulation 
            WHERE id = %s
        """, (id,))
        
        result = cur.fetchone()
        cur.close()
        
        if result:
            # Construir datos según el estado
            update_data = {
                'id': result[0],
                'p_status': estado,
            }
            
            # Agregar campos específicos según el estado
            if estado == 'Running':
                # Para Running: enviar start_datetime
                if result[2]:  # start_datetime
                    update_data['start_datetime'] = result[2].isoformat() + 'Z'
                    
            elif estado == 'Finished':
                # Para Finished: enviar finish_datetime
                if result[3]:  # finish_datetime
                    update_data['finish_datetime'] = result[3].isoformat() + 'Z'
                    
            elif estado == 'Error':
                # Para Error: enviar finish_datetime
                if result[3]:  # finish_datetime
                    update_data['finish_datetime'] = result[3].isoformat() + 'Z'
                    
            elif estado == 'Queued':
                # Para Queued: enviar queue_position
                if queue_position is not None:
                    update_data['queue_position'] = queue_position
            
            # Construir payload del WebSocket
            payload = {
                'id': int(id),  # Asegurar que sea entero
                'estado': estado,
                'update_data': update_data
            }
            
            print(f"📡 Enviando WebSocket: sim {id} -> {estado}")
            print(f"📦 Payload completo: {payload}")
            print(f"🔢 Tipo de id: {type(payload['id'])}")
            
            # Emitir evento con datos relevantes (sin broadcast, flask-socketio emite a todos por defecto)
            current_app.socketio.emit('estado_simulacion', payload, namespace='/')
            
            print(f"✅ WebSocket emitido exitosamente con campos: {list(update_data.keys())}")
        else:
            # Fallback: solo emitir estado si no se encuentran los datos
            print(f"⚠️ Simulación {id} no encontrada en DB")
            current_app.socketio.emit('estado_simulacion', {'id': int(id), 'estado': estado}, namespace='/')
            
    except Exception as e:
        print(f"❌ Error emitiendo WebSocket: {e}")
        import traceback
        print(traceback.format_exc())
        # Fallback: emitir solo el estado básico
        try:
            current_app.socketio.emit('estado_simulacion', {'id': int(id), 'estado': estado}, namespace='/')
            print(f"⚠️ Fallback: WebSocket básico emitido")
        except Exception as fallback_error:
            print(f"❌ Error en fallback: {fallback_error}")


def abort_simulation_service(id):
    """Abort a queued or running Celery simulation task"""
    try:
        sim_id = int(id)

        # Obtener estado actual y task_id de la DB
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT p_status, task_id FROM simulation WHERE id = %s", (sim_id,))
        result = cur.fetchone()
        cur.close()

        if not result:
            return jsonify({"status": "error", "message": f"Simulation {sim_id} not found"}), 404

        db_status = result[0]
        task_id = result[1]

        print(f"Abort request for simulation {sim_id}: status='{db_status}', task_id='{task_id}'")

        # Estados terminales - no se pueden abortar
        terminal_states = {'Finished', 'Aborted', 'Error', 'Failed', 'Mesh generation failed'}
        if db_status in terminal_states:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} cannot be aborted (already in terminal state: {db_status})"
            }), 400

        if db_status in ('Not started', 'Generating mesh'):
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} has not started yet (status: {db_status}). Nothing to abort."
            }), 400

        if db_status == 'Aborting':
            # Ya en proceso de aborto - idempotente
            print(f"Simulation {sim_id} is already aborting")
            return jsonify({"status": "success", "message": f"Simulation {sim_id} is already being aborted"})

        # Estados abortables: Running y Queued
        if db_status not in ('Running', 'Queued'):
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} has unexpected status '{db_status}'. Cannot abort."
            }), 400

        from app import celery

        # Si la simulación está Queued (no se inició en Celery), basta con cambiar estado directamente
        if db_status == 'Queued':
            print(f"Simulation {sim_id} is Queued (never started), resetting to Not started")
            # Limpiar queue_order, tiempos y marcar como Not started
            cur_abort = current_app.mysql.connection.cursor()
            cur_abort.execute("""
                UPDATE simulation
                SET p_status = 'Not started', 
                    queue_order = NULL, 
                    start_datetime = NULL,
                    finish_datetime = NULL,
                    execution_time = NULL,
                    task_id = NULL
                WHERE id = %s
            """, (sim_id,))
            current_app.mysql.connection.commit()
            cur_abort.close()
            notificar_estado_simulacion(sim_id, "Not started")
            print(f"Simulation {sim_id} (Queued) reset to Not started")

            # Generar espacio de cola y procesar siguiente (si aplica)
            try:
                from .queue_service import process_next_in_queue, compact_queue
                compact_queue()
                process_next_in_queue()
            except Exception as queue_err:
                print(f"Error processing queue after abort: {queue_err}")

            return jsonify({
                "status": "success",
                "message": f"Simulation {sim_id} dequeued and aborted successfully",
                "previous_status": db_status
            })

        # 1. Marcar en DB como "Aborting" PRIMERO para que el worker lo detecte
        update_simulation_status(current_app.mysql, sim_id, "Aborting")
        notificar_estado_simulacion(sim_id, "Aborting")
        print(f"Simulation {sim_id} marked as Aborting in DB")

        # 2. Revocar la tarea de Celery si hay task_id
        if task_id:
            try:
                # SIGTERM primero (graceful) - el worker detectara el estado Aborting en DB
                celery.control.revoke(task_id, terminate=True, signal='SIGTERM')
                print(f"SIGTERM sent to Celery task {task_id}")

                # Esperar brevemente antes de escalar
                import time
                time.sleep(2)

                # Verificar si la task sigue activa y escalar con SIGKILL
                try:
                    from celery.result import AsyncResult
                    res = AsyncResult(task_id, app=celery)
                    if res.state in ('STARTED', 'PENDING', 'RETRY', 'PROGRESS'):
                        print(f"Task {task_id} still active ({res.state}), sending SIGKILL")
                        celery.control.revoke(task_id, terminate=True, signal='SIGKILL')
                    else:
                        print(f"Task {task_id} already stopped (state: {res.state})")
                except Exception as check_err:
                    print(f"Cannot check task state ({check_err}), sending SIGKILL as precaution")
                    celery.control.revoke(task_id, terminate=True, signal='SIGKILL')

            except Exception as revoke_err:
                print(f"Error revoking Celery task {task_id}: {revoke_err}")
        else:
            print(f"No task_id for simulation {sim_id} (status={db_status}) - forcing Aborted state")

        # 3. Crear archivo de senal de aborto como mecanismo adicional para el worker
        try:
            import tempfile
            signal_dir = '/app/temp_signals' if os.environ.get('DOCKER_ENV') else tempfile.gettempdir()
            os.makedirs(signal_dir, exist_ok=True)
            abort_signal_file = os.path.join(signal_dir, f'abort_sim_{sim_id}.signal')
            with open(abort_signal_file, 'w') as f:
                f.write(f'abort:{sim_id}:{task_id or "no_task"}')
            print(f"Abort signal file created: {abort_signal_file}")
        except Exception as sig_err:
            print(f"Could not create abort signal file: {sig_err}")

        # 4. Marcar definitivamente como Not started en DB (limpiando queue_order y tiempos)
        cur_fin = current_app.mysql.connection.cursor()
        cur_fin.execute("""
            UPDATE simulation
            SET p_status = 'Not started', 
                queue_order = NULL, 
                start_datetime = NULL,
                finish_datetime = NULL,
                execution_time = NULL,
                task_id = NULL
            WHERE id = %s
        """, (sim_id,))
        current_app.mysql.connection.commit()
        cur_fin.close()
        notificar_estado_simulacion(sim_id, "Not started")
        print(f"Simulation {sim_id} reset to Not started successfully")

        # 5. Procesar siguiente en cola
        try:
            from .queue_service import process_next_in_queue
            print(f"Checking queue after aborting simulation {sim_id}")
            process_next_in_queue()
        except Exception as queue_err:
            print(f"Error processing queue after abort: {queue_err}")

        return jsonify({
            "status": "success",
            "message": f"Simulation {sim_id} aborted successfully",
            "previous_status": db_status
        })

    except ValueError:
        return jsonify({"status": "error", "message": f"Invalid simulation ID: {id}"}), 400
    except Exception as e:
        import traceback
        print(f"Error aborting simulation {id}: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Error aborting simulation: {str(e)}"}), 500

def list_mesh_files_service():
    """List all available mesh files for download"""
    try:
        mesh_files = []
        
        # Path to mesh exports directory
        mesh_exports_path = os.path.join(FENICS_PATH, "mesh_exports")
        
        if os.path.exists(mesh_exports_path):
            for filename in os.listdir(mesh_exports_path):
                if filename.endswith(('.vtk', '.pvd', '.msh', '.xml', '.xdmf', '.ply', '.stl')):
                    file_path = os.path.join(mesh_exports_path, filename)
                    file_stats = os.stat(file_path)
                    
                    # Determine mesh type based on filename
                    mesh_type = "gmsh" if "_gmsh" in filename else "mshr"
                    is_boundary = "_boundaries_" in filename
                    
                    mesh_files.append({
                        'filename': filename,
                        'size': file_stats.st_size,
                        'modified': file_stats.st_mtime,
                        'type': mesh_type,
                        'is_boundary': is_boundary,
                        'format': filename.split('.')[-1]
                    })
        
        return jsonify({
            'status': 'success',
            'mesh_files': mesh_files,
            'total_files': len(mesh_files),
            'message': f'Found {len(mesh_files)} mesh files'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'message': 'Error listing mesh files'
        }), 500

def download_mesh_file_service(filename):
    """Download a specific mesh file"""
    try:
        # Security check - only allow certain file extensions
        allowed_extensions = {'.vtk', '.pvd', '.msh', '.xml', '.xdmf', '.ply', '.stl'}
        file_ext = os.path.splitext(filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            return jsonify({
                'status': 'error',
                'message': 'File type not allowed'
            }), 400
        
        # Path to mesh exports directory
        mesh_exports_path = os.path.join(FENICS_PATH, "mesh_exports")
        file_path = os.path.join(mesh_exports_path, filename)
        
        # Security check - ensure file is within mesh_exports directory
        if not os.path.abspath(file_path).startswith(os.path.abspath(mesh_exports_path)):
            return jsonify({
                'status': 'error',
                'message': 'Invalid file path'
            }), 400
        
        if not os.path.exists(file_path):
            return jsonify({
                'status': 'error',
                'message': 'File not found'
            }), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'message': 'Error downloading mesh file'
        }), 500

# ===== QUEUE MANAGEMENT SERVICES =====

def queue_simulation_service(id, request):
    """Add a simulation to the queue with priority"""
    try:
        data = request.json
        priority_str = data.get('priority', 'NORMAL').upper()
        estimated_duration = data.get('estimated_duration')
        
        # Validate priority
        try:
            priority = SimulationPriority[priority_str]
        except KeyError:
            return jsonify({
                "status": "error",
                "message": f"Invalid priority: {priority_str}. Must be one of: LOW, NORMAL, HIGH, URGENT"
            }), 400
        
        # Get simulation parameters
        sim_id = int(id)
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
        columns = [col[0] for col in cur.description]
        row = cur.fetchone()
        cur.close()
        
        if not row:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} not found"
            }), 404
        
        row_dict = dict(zip(columns, row))
        
        # Check if simulation can be queued
        current_status = row_dict['p_status']
        if current_status not in ['Not started', 'Error', 'Failed']:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} cannot be queued (current status: {current_status})"
            }), 400
        
        # Prepare simulation parameters
        parameters = {
            'n_transmitter': row_dict['n_transmitter'],
            'n_receiver': row_dict['n_receiver'],
            'emitters_pitch': row_dict['emitters_pitch'],
            'receivers_pitch': row_dict['receivers_pitch'],
            'sensor_edge_margin': float(row_dict['sensor_edge_margin']) if row_dict['sensor_edge_margin'] else None,
            'typical_mesh_size': row_dict['typical_mesh_size'],
            'sensor_distance': row_dict['sensor_distance'],
            'plate_thickness': row_dict['plate_thickness'],
            'porosity': float(row_dict['porosity']) if row_dict['porosity'] else None,
            'plate_length': row_dict['plate_length'],
            'attenuation': row_dict['attenuation'],
            'mesh_type': row_dict['mesh_type'],
            'roughness': float(row_dict['roughness']) if row_dict.get('roughness') is not None else 0.2
        }
        
        # Add to queue
        success = queue_manager.add_to_queue(
            simulation_id=sim_id,
            parameters=parameters,
            priority=priority,
            estimated_duration=estimated_duration
        )
        
        if success:
            # Update database status
            update_simulation_status(current_app.mysql, sim_id, SimulationState.QUEUED.value)
            notificar_estado_simulacion(sim_id, SimulationState.QUEUED.value)
            
            queue_status = queue_manager.get_queue_status()
            position = queue_manager._get_queue_position(sim_id)
            
            return jsonify({
                "status": "success",
                "message": f"Simulation {sim_id} added to queue",
                "queue_position": position,
                "priority": priority_str,
                "queue_size": queue_status['queue_size']
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to add simulation {sim_id} to queue"
            }), 500
            
    except ValueError:
        return jsonify({
            "status": "error",
            "message": f"Invalid simulation ID: {id}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error queuing simulation: {str(e)}"
        }), 500

def pause_simulation_service(id):
    """Pause a running simulation"""
    try:
        sim_id = int(id)
        
        # Check database status
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
        result = cur.fetchone()
        cur.close()
        
        if not result:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} not found"
            }), 404
        
        db_status = result[0]
        if db_status != SimulationState.RUNNING.value:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} is not running (current status: {db_status})"
            }), 400
        
        # Request pause through queue manager
        success = queue_manager.pause_simulation(sim_id)
        
        if success:
            # Update database
            update_simulation_status(current_app.mysql, sim_id, SimulationState.PAUSED.value)
            notificar_estado_simulacion(sim_id, SimulationState.PAUSED.value)
            
            return jsonify({
                "status": "success",
                "message": f"Simulation {sim_id} paused successfully"
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to pause simulation {sim_id}"
            }), 500
            
    except ValueError:
        return jsonify({
            "status": "error",
            "message": f"Invalid simulation ID: {id}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error pausing simulation: {str(e)}"
        }), 500

def resume_simulation_service(id):
    """Resume a paused simulation"""
    try:
        sim_id = int(id)
        
        # Check database status
        cur = current_app.mysql.connection.cursor()
        cur.execute("SELECT p_status FROM simulation WHERE id = %s", (sim_id,))
        result = cur.fetchone()
        cur.close()
        
        if not result:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} not found"
            }), 404
        
        db_status = result[0]
        if db_status != SimulationState.PAUSED.value:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} is not paused (current status: {db_status})"
            }), 400
        
        # Request resume through queue manager
        success = queue_manager.resume_simulation(sim_id)
        
        if success:
            # Update database
            update_simulation_status(current_app.mysql, sim_id, SimulationState.RUNNING.value)
            notificar_estado_simulacion(sim_id, SimulationState.RUNNING.value)
            
            return jsonify({
                "status": "success",
                "message": f"Simulation {sim_id} resumed successfully"
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to resume simulation {sim_id}"
            }), 500
            
    except ValueError:
        return jsonify({
            "status": "error",
            "message": f"Invalid simulation ID: {id}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error resuming simulation: {str(e)}"
        }), 500

def get_queue_status_service():
    """Get current queue status"""
    try:
        queue_status = queue_manager.get_queue_status()
        return jsonify({
            "status": "success",
            "queue_status": queue_status
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error getting queue status: {str(e)}"
        }), 500

def change_simulation_priority_service(id, request):
    """Change priority of a queued simulation"""
    try:
        data = request.json
        new_priority_str = data.get('priority', '').upper()
        
        # Validate priority
        try:
            new_priority = SimulationPriority[new_priority_str]
        except KeyError:
            return jsonify({
                "status": "error",
                "message": f"Invalid priority: {new_priority_str}. Must be one of: LOW, NORMAL, HIGH, URGENT"
            }), 400
        
        sim_id = int(id)
        
        # Check if simulation is in queue
        queue_status = queue_manager.get_queue_status()
        in_queue = any(sim['id'] == sim_id for sim in queue_status['queue'])
        
        if not in_queue:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} is not in queue"
            }), 400
        
        # Change priority
        success = queue_manager.change_priority(sim_id, new_priority)
        
        if success:
            new_position = queue_manager._get_queue_position(sim_id)
            return jsonify({
                "status": "success",
                "message": f"Priority changed for simulation {sim_id}",
                "new_priority": new_priority_str,
                "new_position": new_position
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to change priority for simulation {sim_id}"
            }), 500
            
    except ValueError:
        return jsonify({
            "status": "error",
            "message": f"Invalid simulation ID: {id}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error changing priority: {str(e)}"
        }), 500

def remove_from_queue_service(id):
    """Remove a simulation from the queue"""
    try:
        sim_id = int(id)
        
        # Check if simulation is in queue
        queue_status = queue_manager.get_queue_status()
        in_queue = any(sim['id'] == sim_id for sim in queue_status['queue'])
        
        if not in_queue:
            return jsonify({
                "status": "error",
                "message": f"Simulation {sim_id} is not in queue"
            }), 400
        
        # Remove from queue
        success = queue_manager.remove_from_queue(sim_id)
        
        if success:
            # Update database status back to "Not started"
            update_simulation_status(current_app.mysql, sim_id, "Not started")
            notificar_estado_simulacion(sim_id, "Not started")
            
            return jsonify({
                "status": "success",
                "message": f"Simulation {sim_id} removed from queue"
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to remove simulation {sim_id} from queue"
            }), 500
            
    except ValueError:
        return jsonify({
            "status": "error",
            "message": f"Invalid simulation ID: {id}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error removing from queue: {str(e)}"
        }), 500


# ==============================================================================
#  RUN ALL SIMULATIONS
#  Ejecuta TODAS las sims elegibles ordenadas por ID DESC (mayor → menor).
#  La primera de la lista corre inmediatamente (si no hay nada corriendo),
#  el resto se encola en ese mismo orden.
# ==============================================================================
def run_all_simulations_service(request):
    """
    Corre todas las simulaciones elegibles ordenadas por ID descendente.
    Elegible: Not started | Error | Aborted | Finished.
    La de mayor ID va primero.

    Body (opcional): { "status_filter": ["Not started"] }
    Si no se pasa status_filter se usan todos los estados elegibles.
    """
    try:
        data = request.get_json() or {}
        status_filter = data.get('status_filter', None)

        ELIGIBLE_STATUSES = {'Not started', 'Error', 'Aborted', 'Finished'}
        RERUN_STATUSES    = {'Error', 'Aborted', 'Finished'}

        if status_filter:
            allowed = ELIGIBLE_STATUSES & set(status_filter)
        else:
            allowed = ELIGIBLE_STATUSES

        if not allowed:
            return jsonify({'error': 'No valid statuses in filter'}), 400

        # Obtener todas las sims elegibles ordenadas DESC por id
        placeholders = ','.join(['%s'] * len(allowed))
        cur = current_app.mysql.connection.cursor()
        cur.execute(f"""
            SELECT id, p_status, xml_file,
                   n_transmitter, n_receiver, emitters_pitch, receivers_pitch,
                   sensor_edge_margin, typical_mesh_size, sensor_distance, plate_thickness,
                   porosity, plate_length, attenuation, mesh_type,
                   skin_layer_config, skin_thickness_top, skin_thickness_bottom, roughness
            FROM simulation
            WHERE p_status IN ({placeholders})
            ORDER BY id DESC
        """, tuple(allowed))
        rows = cur.fetchall()
        cur.close()

        if not rows:
            return jsonify({
                'success': True,
                'message': 'No eligible simulations found',
                'summary': {'total': 0, 'started': 0, 'queued': 0, 'skipped': 0},
                'results': []
            }), 200

        from .queue_service import should_queue_simulation, queue_simulation
        from ..models.simulation_model import update_simulation_status
        from app import celery
        from datetime import datetime
        import time as _time

        results      = []
        started_count = 0
        queued_count  = 0
        skipped_count = 0

        for row in rows:
            sim_id       = row[0]
            cur_status   = row[1]
            xml_path     = row[2]

            # Archivo de malla (si no existe aún, Celery lo generará bajo demanda)
            if xml_path and not os.path.isabs(xml_path):
                xml_path = os.path.abspath(xml_path)
            if xml_path and not os.path.exists(xml_path):
                xml_path = None

            simulation_params = {
                'n_transmitter':         row[3],
                'n_receiver':            row[4],
                'emitters_pitch':        row[5],
                'receivers_pitch':       row[6],
                'sensor_edge_margin':    row[7],
                'typical_mesh_size':     row[8],
                'sensor_distance':       row[9],
                'plate_thickness':       row[10],
                'porosity':             row[11],
                'plate_length':          row[12],
                'attenuation':           row[13],
                'mesh_type':             row[14] or 'gmsh',
                'xml_file':              xml_path,
                'skin_layer_config':     row[15] if row[15] is not None else 'none',
                'skin_thickness_top':    float(row[16]) if row[16] is not None else 1.3,
                'skin_thickness_bottom': float(row[17]) if row[17] is not None else 1.3,
                'roughness':        float(row[18]) if row[18] is not None else 0.2,
            }

            # Limpiar resultados previos si es re-ejecución
            if cur_status in RERUN_STATUSES:
                cur_clean = current_app.mysql.connection.cursor()
                cur_clean.execute("""
                    UPDATE simulation
                    SET finish_datetime = NULL, execution_time = NULL,
                        image = NULL, result_step_01 = NULL, result_file = NULL
                    WHERE id = %s
                """, (sim_id,))
                current_app.mysql.connection.commit()
                cur_clean.close()

            # Ejecutar o encolar
            if should_queue_simulation():
                queue_simulation(sim_id)
                results.append({'id': sim_id, 'status': 'queued'})
                queued_count += 1
            else:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                task_id   = f'simulation_{sim_id}_{timestamp}'

                update_simulation_status(
                    current_app.mysql, sim_id, 'Running',
                    update_time_field='start_datetime',
                    task_id=task_id
                )
                current_app.mysql.connection.commit()
                _time.sleep(0.05)

                notificar_estado_simulacion(sim_id, 'Running')

                task = celery.send_task(
                    'simulations.run_simulation',
                    args=[sim_id, simulation_params],
                    task_id=task_id
                )

                results.append({'id': sim_id, 'status': 'started', 'task_id': task.id})
                started_count += 1

        total_triggered = started_count + queued_count
        return jsonify({
            'success': True,
            'message': f'{total_triggered} simulation(s) triggered ({started_count} started, {queued_count} queued, {skipped_count} skipped)',
            'summary': {
                'total':   len(rows),
                'started': started_count,
                'queued':  queued_count,
                'skipped': skipped_count,
            },
            'results': results
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Error in run_all_simulations_service: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==============================================================================
#  ABORT ALL SIMULATIONS
#  Aborta las Running/Aborting y desencola las Queued.
# ==============================================================================
def abort_all_simulations_service():
    """
    Detiene todo:
    - Simulaciones Running → marcadas como Aborting + señal al worker
    - Simulaciones Queued  → marcadas directamente como Aborted + queue_order=NULL
    """
    try:
        from ..models.simulation_model import update_simulation_status

        # Obtener Running y Queued
        cur = current_app.mysql.connection.cursor()
        cur.execute("""
            SELECT id, p_status, task_id
            FROM simulation
            WHERE p_status IN ('Running', 'Aborting', 'Queued')
            ORDER BY id
        """)
        rows = cur.fetchall()
        cur.close()

        if not rows:
            return jsonify({
                'success': True,
                'message': 'Nothing to stop',
                'summary': {'aborted': 0, 'dequeued': 0}
            }), 200

        from app import celery
        import os, tempfile

        aborted_count  = 0
        dequeued_count = 0
        results        = []

        for row in rows:
            sim_id, status, task_id = row[0], row[1], row[2]

            try:
                if status == 'Queued':
                    # Dequeue directo
                    cur_upd = current_app.mysql.connection.cursor()
                    cur_upd.execute("""
                        UPDATE simulation
                        SET p_status = 'Aborted', queue_order = NULL, finish_datetime = NOW()
                        WHERE id = %s
                    """, (sim_id,))
                    current_app.mysql.connection.commit()
                    cur_upd.close()
                    notificar_estado_simulacion(sim_id, 'Aborted')
                    results.append({'id': sim_id, 'action': 'dequeued'})
                    dequeued_count += 1

                elif status in ('Running', 'Aborting'):
                    # 1. Marcar como Aborting en DB
                    update_simulation_status(current_app.mysql, sim_id, 'Aborting')
                    notificar_estado_simulacion(sim_id, 'Aborting')

                    # 2. Revocar tarea Celery
                    if task_id:
                        try:
                            celery.control.revoke(task_id, terminate=True, signal='SIGTERM')
                            print(f"🚫 Revoked Celery task {task_id} for simulation {sim_id}")
                        except Exception as rev_err:
                            print(f"⚠️ Could not revoke task {task_id}: {rev_err}")

                    # 3. Señal de aborto en archivo
                    try:
                        signal_dir = '/app/temp_signals' if os.environ.get('DOCKER_ENV') else tempfile.gettempdir()
                        os.makedirs(signal_dir, exist_ok=True)
                        signal_path = os.path.join(signal_dir, f'abort_sim_{sim_id}.signal')
                        with open(signal_path, 'w') as f:
                            f.write('abort')
                    except Exception:
                        pass

                    # 4. Marcar Aborted
                    cur_fin = current_app.mysql.connection.cursor()
                    cur_fin.execute("""
                        UPDATE simulation
                        SET p_status = 'Aborted', queue_order = NULL, finish_datetime = NOW()
                        WHERE id = %s
                    """, (sim_id,))
                    current_app.mysql.connection.commit()
                    cur_fin.close()
                    notificar_estado_simulacion(sim_id, 'Aborted')
                    results.append({'id': sim_id, 'action': 'aborted'})
                    aborted_count += 1

            except Exception as sim_err:
                print(f"❌ Error stopping simulation {sim_id}: {sim_err}")
                results.append({'id': sim_id, 'action': 'error', 'message': str(sim_err)})

        total_stopped = aborted_count + dequeued_count
        return jsonify({
            'success': True,
            'message': f'{total_stopped} simulation(s) stopped ({aborted_count} aborted, {dequeued_count} dequeued)',
            'summary': {
                'aborted':  aborted_count,
                'dequeued': dequeued_count,
            },
            'results': results
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Error in abort_all_simulations_service: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def download_simulations_batch_zip_service(request):
    """
    Exporta múltiples simulaciones a un archivo ZIP.
    Puede exportar todas o una lista de IDs seleccionados.
    Admite filtrado por content_type: 'mat', 'graphics', 'all'
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        ids = data.get('ids', [])
        is_all = data.get('all', False)
        content_type = data.get('content_type', 'all')
        
        cur = current_app.mysql.connection.cursor()
        
        if is_all:
            cur.execute("SELECT id, sim_name FROM simulation")
        elif ids:
            if not isinstance(ids, list):
                ids = [ids]
            placeholders = ', '.join(['%s'] * len(ids))
            cur.execute(f"SELECT id, sim_name FROM simulation WHERE id IN ({placeholders})", tuple(ids))
        else:
            return jsonify({'error': 'No simulations selected'}), 400
            
        simulations = cur.fetchall()
        cur.close()
        
        if not simulations:
            return jsonify({'error': 'No simulations found to export'}), 404
            
        # Crear ZIP en memoria
        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_STORED) as zf:
            print(f"📦 Starting ZIP generation for {len(simulations)} simulations (Filter: {content_type})...")
            for sim_id, sim_name in simulations:
                sim_dir = get_simulation_dir(sim_id)
                clean_name = str(sim_name).replace(' ', '_').replace('/', '-').replace('\\', '-')
                folder_in_zip = f"sim_{sim_id}_{clean_name}"
                
                added_files = False
                if os.path.exists(sim_dir):
                    for root, dirs, files in os.walk(sim_dir):
                        for file in files:
                            # Filtrado basado en content_type
                            if content_type == 'mat':
                                if not file.endswith('.mat') and 'mat_files' not in root:
                                    continue
                            elif content_type == 'graphics':
                                if 'plots' not in root and not file.endswith('.png') and not file.endswith('.jpg'):
                                    continue
                            elif content_type != 'all':
                                pass
                                
                            file_path = os.path.join(root, file)
                            rel_path = os.path.relpath(file_path, sim_dir)
                            arcname = os.path.join(folder_in_zip, rel_path)
                            zf.write(file_path, arcname)
                            added_files = True
                
                if not added_files:
                    zf.writestr(f"{folder_in_zip}/info.txt", f"ID: {sim_id}\nName: {sim_name}\nStatus: No corresponding physical files found for this filter.")
        
        memory_file.seek(0)
        
        export_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        if is_all:
            filename = f"all_simulations_{content_type}_{export_time}.zip"
        elif len(simulations) == 1:
            clean_name = str(simulations[0][1]).replace(' ', '_').replace('/', '-').replace('\\', '-')
            filename = f"{clean_name}_{content_type}.zip"
        else:
            filename = f"selected_simulations_{content_type}_{export_time}.zip"
            
        response = send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=filename
        )
        response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response
        
    except Exception as e:
        import traceback
        print(f"❌ Error in download_simulations_batch_zip_service: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
