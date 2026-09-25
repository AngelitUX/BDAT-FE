
import gmsh
import math
import random
import os

def create_rectangle_mesh_gradual_attenuation_0_test(
    zlim, ylim, dxt, filename="mesh_test", sim_id=None,
    n_transmitter=1, n_receiver=1,
    emitter_pitch=1.0, receiver_pitch=0.4,
    sensor_distance=20.0, sensor_edge_margin=10.0,
    mesh_angle=0.0, mesh_angle_direction='none',
    porosity=0.0
):
    """
    Copy of the function from simulations_service.py for testing purposes.
    """
    try:
        gmsh.initialize()
    except:
        pass # Already initialized
        
    gmsh.model.add("vertical_rectangular_gradual_mesh_test")

    # Geometría: rectángulo con posible inclinación en borde inferior
    Xmin_total, Xmax_total = 0.0, zlim
    Ymin_total, Ymax_total = 0.0, ylim

    # Calcular puntos con inclinación si es necesario
    angle_rad = 0.0
    y_displacement = 0.0
    if mesh_angle_direction != 'none' and mesh_angle > 0:
        angle_rad = math.radians(mesh_angle)
        # Calcular desplazamiento horizontal para el ángulo
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
    # Puntos superiores (se mantienen rectos)
    if mesh_angle_direction == 'right':
         p3 = gmsh.model.geo.addPoint(Xmax_total, Ymax_total + y_displacement, 0)
         p4 = gmsh.model.geo.addPoint(Xmin_total, Ymax_total, 0)
    elif mesh_angle_direction == 'left':
         p3 = gmsh.model.geo.addPoint(Xmax_total, Ymax_total, 0)
         p4 = gmsh.model.geo.addPoint(Xmin_total, Ymax_total + y_displacement, 0)
    else:
         p3 = gmsh.model.geo.addPoint(Xmax_total, Ymax_total, 0)
         p4 = gmsh.model.geo.addPoint(Xmin_total, Ymax_total, 0)

    # Borde derecho
    l2 = gmsh.model.geo.addLine(last_point_bottom, p3)
    # Borde superior
    l3 = gmsh.model.geo.addLine(p3, p4)
    # Borde izquierdo
    l4 = gmsh.model.geo.addLine(p4, first_point_bottom)

    # Crear Loop
    curve_loop_list = lines_bottom + [l2, l3, l4]
    
    cl = gmsh.model.geo.addCurveLoop(curve_loop_list)
    s = gmsh.model.geo.addPlaneSurface([cl])
    gmsh.model.geo.synchronize()

    # --- Calcular posiciones de sensores para definir zona de refinamiento ---
    # Transmisores
    z_transmitter_start = sensor_edge_margin
    z_transmitter_end = sensor_edge_margin + ((n_transmitter - 1) * emitter_pitch)
    
    # Receptores
    z_receiver_start = sensor_edge_margin + n_transmitter * emitter_pitch + sensor_distance
    z_receiver_end = z_receiver_start + ((n_receiver - 1) * receiver_pitch)
    
    # Zona de refinamiento
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

    gmsh.option.setNumber("Mesh.Algorithm", 6)
    gmsh.option.setNumber("Mesh.RecombineAll", 0)

    # Generar y optimizar malla
    gmsh.model.mesh.generate(2)
    
    msh_file = filename + ".msh"
    gmsh.write(msh_file)
    gmsh.finalize()
    return msh_file

if __name__ == "__main__":
    # print("Running mesh verification...")
    # # Test case 1: Flat with porosity
    # print("Test 1: Flat with porosity 0.5")
    # create_rectangle_mesh_gradual_attenuation_0_test(
    #     zlim=100, ylim=20, dxt=1.0, filename="test_mesh_porosity",
    #     porosity=0.5
    # )
    # print("Test 1 completed.")

    # Test case 2: Inclined with porosity
    print("Test 2: Inclined (3 degrees, right) with porosity 0.2")
    create_rectangle_mesh_gradual_attenuation_0_test(
        zlim=100, ylim=20, dxt=1.0, filename="test_mesh_inclined",
        mesh_angle=5.0, mesh_angle_direction='right', porosity=0.2
    )
    print("Test 2 completed.")
    
    if os.path.exists("test_mesh_porosity.msh") and os.path.exists("test_mesh_inclined.msh"):
        print("SUCCESS: Mesh files generated.")
    else:
        print("FAILURE: Mesh files not found.")
