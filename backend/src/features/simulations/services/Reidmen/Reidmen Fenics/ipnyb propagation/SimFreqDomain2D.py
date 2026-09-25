from dolfin import *
from mshr import *
import scipy.io as sio
import numpy as np
from datetime import datetime
import time
import pandas as pd
from ufl import Identity, indices, as_tensor, imag, real
import math
import gmsh
import meshio
#DOMINIO FRECUNCIA = atenuation = Si

# def create_rectangle_mesh(zlim, ylim, size, filename="mesh", n_transmitter=1, n_receiver=1, 
#                          emitter_pitch=1.0, receiver_pitch=0.4, sensor_distance=20.0, 
#                          sensor_edge_margin=10.0, sensor_width=0.9, sim_id=None):
#     gmsh.initialize()
#     gmsh.model.add("rectangle")

#     # Crear un rectángulo en gmsh
#     p1 = gmsh.model.geo.addPoint(0, 0, 0, size)
#     p2 = gmsh.model.geo.addPoint(zlim, 0, 0, size)
#     p3 = gmsh.model.geo.addPoint(zlim, ylim, 0, size)
#     p4 = gmsh.model.geo.addPoint(0, ylim, 0, size)

#     l1 = gmsh.model.geo.addLine(p1, p2)
#     l2 = gmsh.model.geo.addLine(p2, p3)
#     l3 = gmsh.model.geo.addLine(p3, p4)
#     l4 = gmsh.model.geo.addLine(p4, p1)

#     cl = gmsh.model.geo.addCurveLoop([l1, l2, l3, l4])
#     surface = gmsh.model.geo.addPlaneSurface([cl])

#     # Marcar el borde superior (donde están los sensores y fuentes)
#     gmsh.model.geo.addPhysicalGroup(1, [l2], 1)  # Borde superior
    
#     # Calcular posiciones de fuentes y sensores
#     zsous = np.linspace(sensor_edge_margin, sensor_edge_margin + ((n_transmitter-1) * emitter_pitch), num=n_transmitter)
#     zsens = np.linspace(sensor_edge_margin + n_transmitter * emitter_pitch + sensor_distance, 
#                        sensor_edge_margin + n_transmitter * emitter_pitch + sensor_distance + (n_receiver-1) * receiver_pitch, 
#                        num=n_receiver)
    
#     # Crear puntos para fuentes y sensores
#     source_points = []
#     sensor_points = []
    
#     for i, z in enumerate(zsous):
#         p = gmsh.model.geo.addPoint(z, ylim, 0, size/10)  # Puntos más finos en las fuentes
#         source_points.append(p)
    
#     for i, z in enumerate(zsens):
#         p = gmsh.model.geo.addPoint(z, ylim, 0, size/10)  # Puntos más finos en los sensores
#         sensor_points.append(p)
    
#     gmsh.model.geo.synchronize()
    
#     # Configurar opciones de malla para generar mallas más similares a MSHR
#     gmsh.option.setNumber("Mesh.Algorithm", 6)  # Frontal-Delaunay
#     gmsh.option.setNumber("Mesh.ElementOrder", 1)  # Elementos lineales
#     gmsh.option.setNumber("Mesh.SaveElementTagType", 1)  # Guardar tipos de elementos
#     gmsh.option.setNumber("Mesh.SaveAll", 1)  # Guardar todos los elementos
    
#     # Configuraciones adicionales para mallas más regulares
#     gmsh.option.setNumber("Mesh.MeshSizeMin", size * 0.5)  # Tamaño mínimo de elemento
#     gmsh.option.setNumber("Mesh.MeshSizeMax", size * 2.0)  # Tamaño máximo de elemento
#     gmsh.option.setNumber("Mesh.MeshSizeExtendFromBoundary", 0)  # No extender desde fronteras
#     gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 0)  # No ajustar por curvatura
#     gmsh.option.setNumber("Mesh.MeshSizeFromPoints", 0)  # No ajustar por puntos
#     gmsh.option.setNumber("Mesh.MeshSizeFromParametricPoints", 0)  # No ajustar por puntos paramétricos
    
#     gmsh.model.mesh.generate(2)

#     # Crear nombre único con ID de simulación
#     if sim_id is not None:
#         unique_filename = f"{sim_id}_{filename}"
#     else:
#         unique_filename = filename
    
#     # Guardar en directorio meshes/
#     import os
#     meshes_dir = "meshes"
#     if not os.path.exists(meshes_dir):
#         os.makedirs(meshes_dir)
    
#     msh_file = os.path.join(meshes_dir, unique_filename + ".msh")
#     xml_file = os.path.join(meshes_dir, unique_filename + ".xml")
    
#     gmsh.write(msh_file)
#     gmsh.finalize()

#     # Convertir a formato .xml (compatible con FEniCS 2019.1.0)
#     try:
#         mesh_from_file = meshio.read(msh_file)
        
#         # Verificar que tenemos una malla 2D válida
#         print(f"Puntos en la malla: {mesh_from_file.points.shape}")
#         print(f"Celdas en la malla: {len(mesh_from_file.cells)}")
        
#         # Ensure we only keep 2D cells and points for XML format
#         if mesh_from_file.points.shape[1] == 3:
#             mesh_from_file.points = mesh_from_file.points[:, :2]  # Keep only x,y coordinates
        
#         # Filtrar solo elementos triangulares para 2D
#         if 'triangle' in mesh_from_file.cells_dict:
#             # Crear nueva malla solo con triángulos
#             points = mesh_from_file.points
#             cells = [("triangle", mesh_from_file.cells_dict['triangle'])]
#             mesh_from_file = meshio.Mesh(points=points, cells=cells)
        
#         meshio.write(xml_file, mesh_from_file, file_format="dolfin-xml")
        
#         print(f"Malla GMSH convertida exitosamente a: {xml_file}")
#         return xml_file
        
#     except Exception as e:
#         print(f"Error al convertir malla GMSH: {e}")
#         # Fallback: crear malla simple con MSHR
#         print("Usando fallback con MSHR...")
#         domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
#         mesh = generate_mesh(domain, int(size))
#         xml_file_fallback = os.path.join(meshes_dir, unique_filename + "_fallback.xml")
#         File(xml_file_fallback) << mesh
#         return xml_file_fallback

#import multiprocessing


_cached_sio = None

def _emit_simulation_progress(sim_id, current_step, total_steps, current_source, total_sources):
    """Emit simulation progress via Redis-backed SocketIO (works from Celery worker)."""
    global _cached_sio
    try:
        import os
        if _cached_sio is None:
            redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
            from flask_socketio import SocketIO
            _cached_sio = SocketIO(message_queue=redis_url)
        percentage = round((current_step / max(total_steps, 1)) * 100, 1)
        payload = {
            'id': int(sim_id),
            'current_step': current_step,
            'total_steps': total_steps,
            'percentage': percentage,
            'current_source': current_source,
            'total_sources': total_sources,
        }
        _cached_sio.emit('simulation_progress', payload, namespace='/')
    except Exception:
        pass  # Progress is best-effort; never break the simulation


def fmain (n_transmitter, n_receiver, distance, emitter_pitch, receiver_pitch, sensor_edge_margin, typical_mesh_size, plate_thickness, porosity, attenuation, id, mesh_type, xml_file):
    import tempfile
    import os
    
    # Función para verificar señal de aborto
    def check_abort_signal():
        # Usar directorio compartido entre contenedores
        signal_dir = '/app/temp_signals' if os.path.exists('/app') else tempfile.gettempdir()
        abort_signal_file = os.path.join(signal_dir, f'abort_sim_{id}.signal')
        if os.path.exists(abort_signal_file):
            print(f"🚩 ABORT SIGNAL DETECTED for simulation {id}")
            print(f"📁 Signal file location: {abort_signal_file}")
            try:
                os.remove(abort_signal_file)
                print(f"🗑️ Abort signal file removed")
            except Exception as e:
                print(f"⚠️ Could not remove abort signal file: {e}")
            return True
        return False
    
    Hora_inicio = datetime.now()
    print('Parametros: ', n_transmitter, n_receiver, distance, emitter_pitch, receiver_pitch, sensor_edge_margin, typical_mesh_size, plate_thickness, porosity, attenuation, id, mesh_type, xml_file)

    # Obtain the experimental data from .mat file
    # Obtain the experimental data from .mat file
    C_mathilde = sio.loadmat(r"src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/Files_mat/C_values_mathilde.mat")

    # Define the constants
    # The stiffness constants in [GPa] --> [g/mm(\mu sec)^2]
    # are given by the mathilde .mat file of 5%
    #print('WITH ATTENUATION')

    """______________________C AND D VALUES FROM ATTENUATION.CSV______________________
    path = 'src/Reidmen Fenics/ipnyb propagation/Files_mat/attenuation'
    M = pd.read_csv(path + '.csv').values
    # First dimension: porosity
    p = np.arange(0.01, 0.48, 0.01)
    d = 2.03 * (1 - p) + p

    # Calculate omega
    frequency = 1e-3 # frequency value
    omega = 2 * np.pi * frequency
    # Second dimensioncl
    C22 = M[:, 0] # %=C11
    C66 = M[:, 1]
    C33 = M[:, 2]
    C23 = M[:, 3] # %=C13
    C55 = M[:, 4] # %=C44
    C12 = M[:, 5]

    D11 = M[:, 6]
    D66 = M[:, 7]
    D33 = M[:, 8]
    D13 = M[:, 9]
    D55 = M[:, 10]
    D12 = M[:, 11] 

    C11 = C22 + D11
    C13 = C23 + D13
    C66 = C66 + D66
    C33 = C33 + D33
    C55 = C55 + D55
    C12 = C12 + D12
    """

    """______________________C VALUES FROM MATHILDE______________________"""
    C11 = np.reshape(C_mathilde['C11'], (30,))*1E-3
    C12 = np.reshape(C_mathilde['C12'], (30,))*1E-3
    C13 = np.reshape(C_mathilde['C13'], (30,))*1E-3
    C33 = np.reshape(C_mathilde['C33'], (30,))*1E-3
    C55 = np.reshape(C_mathilde['C55'], (30,))*1E-3
    C66 = np.reshape(C_mathilde['C66'], (30,))*1E-3

    d = np.reshape(C_mathilde['d'], (30,))*1E-3
    C_mathilde.keys()

    """______________________PARAMS______________________"""
    
    # Rectangle geometry limits
    zlim=(2*sensor_edge_margin) + ((n_transmitter-1)*emitter_pitch) + distance + ((n_receiver-1)*receiver_pitch)
    print("zlim ANCHO DEL RECTANGULO: ", zlim)
    ylim = plate_thickness

    # Porosity level from Mathilde data 
    # this data starts from 1% porosity values!
    # Asegurar que porosity sea entero para indexar arrays
    porosity = int(porosity)
    por = porosity - 1  # the porosity level is por+1
    
    # Define domain size 
    dxt = typical_mesh_size 
    size =  round(zlim/dxt) # Dato importante
    
    # Parameters of Source definition
    width = 0.9 * emitter_pitch #antes era 0.5 sens_width
    
    # Generate mesh using the specified method
    if mesh_type == "mshr":
        print("🔧 Generando mesh con mshr...")
        domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
        mesh = generate_mesh(domain, size)
    elif mesh_type == "gmsh":
        print("🔧 Cargando mesh desde archivo XML (generado con gmsh)...")
        mesh = Mesh(xml_file)
        # ── Reparar mesh gmsh: inicializar topología y corregir orientación ──
        # meshio→XML puede producir celdas con orientación inconsistente
        # (Jacobiano negativo), lo que corrompe la matriz de rigidez → NaN.
        from dolfin import MeshEditor, Cell as DolfinCell
        mesh.init()
        _coords = mesh.coordinates()
        _cells = mesh.cells()
        _n_negative = 0
        for _ci in range(_cells.shape[0]):
            _v0, _v1, _v2 = _cells[_ci]
            _p0, _p1, _p2 = _coords[_v0], _coords[_v1], _coords[_v2]
            _det = (_p1[0]-_p0[0])*(_p2[1]-_p0[1]) - (_p2[0]-_p0[0])*(_p1[1]-_p0[1])
            if _det < 0:
                _n_negative += 1
        if _n_negative > 0:
            print(f"   ⚠️  {_n_negative}/{_cells.shape[0]} celdas con orientación negativa detectadas")
            print(f"   Reordenando celdas para corregir orientación...")
            editor = MeshEditor()
            new_mesh = Mesh()
            editor.open(new_mesh, "triangle", 2, 2)
            editor.init_vertices(_coords.shape[0])
            editor.init_cells(_cells.shape[0])
            for _vi in range(_coords.shape[0]):
                editor.add_vertex(_vi, _coords[_vi])
            for _ci in range(_cells.shape[0]):
                _v0, _v1, _v2 = _cells[_ci]
                _p0, _p1, _p2 = _coords[_v0], _coords[_v1], _coords[_v2]
                _det = (_p1[0]-_p0[0])*(_p2[1]-_p0[1]) - (_p2[0]-_p0[0])*(_p1[1]-_p0[1])
                if _det < 0:
                    editor.add_cell(_ci, [_v0, _v2, _v1])
                else:
                    editor.add_cell(_ci, [_v0, _v1, _v2])
            editor.close()
            new_mesh.init()
            mesh = new_mesh
            print(f"   ✅ Mesh reorientado correctamente")
        else:
            print(f"   ✅ Todas las celdas tienen orientación correcta")
        _min_vol = min(DolfinCell(mesh, i).volume() for i in range(mesh.num_cells()))
        print(f"   Volumen mínimo de celda: {_min_vol:.2e}")
        if _min_vol < 1e-14:
            print(f"   ⚠️  ADVERTENCIA: celdas con volumen casi cero detectadas!")
    else:
        # Fallback to mshr if mesh_type is not recognized
        print("⚠️  Tipo de mesh no reconocido. Usando mshr como fallback...")
        domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
        mesh = generate_mesh(domain, size)

    # Compute the minimum height diameter
    print("Minimum height of element [mm]: ", mesh.hmin())
    print(f"Tipo de malla: {mesh_type}")
    print(f"Número de celdas en la malla: {mesh.num_cells()}")
    print(f"Número de vértices en la malla: {mesh.num_vertices()}")

    # === DIAGNÓSTICO: verificar que el mesh coincide con el dominio esperado ===
    _mc = mesh.coordinates()
    _xmin, _xmax = _mc[:, 0].min(), _mc[:, 0].max()
    _ymin, _ymax = _mc[:, 1].min(), _mc[:, 1].max()
    print(f"=== MESH vs DOMINIO ===")
    print(f"   Mesh real:     X=[{_xmin:.4f}, {_xmax:.4f}], Y=[{_ymin:.4f}, {_ymax:.4f}]")
    print(f"   Dominio esperado: X=[0, {zlim:.4f}], Y=[0, {ylim:.4f}]")
    if abs(_xmax - zlim) > 0.01:
        print(f"   ⚠️  MISMATCH en X: mesh xmax={_xmax:.4f} vs zlim={zlim:.4f}")
    if abs(_ymax - ylim) > 0.01:
        print(f"   ⚠️  MISMATCH en Y: mesh ymax={_ymax:.4f} vs ylim={ylim:.4f}")
    
    # Diagnósticos adicionales para comparar mallas
    if mesh_type == "gmsh":
        print("=== DIAGNÓSTICO DE MALLA GMSH ===")
        print(f"Tamaño de elemento promedio: {mesh.hmax()}")
        print(f"Relación de aspecto promedio: {mesh.hmax() / mesh.hmin()}")
        print("Malla cargada desde archivo XML generado con gmsh")
    else:
        print("=== DIAGNÓSTICO DE MALLA MSHR ===")
        print(f"Tamaño de elemento promedio: {mesh.hmax()}")
        print(f"Relación de aspecto promedio: {mesh.hmax() / mesh.hmin()}")
        print("Malla generada con MSHR (algoritmo estándar)")
    
    # Define source locations
    # Using notation consistent with the 3D-case
    nsous = n_transmitter#1 #Cantidad de emisores
    zsous = np.linspace(sensor_edge_margin, sensor_edge_margin + ((n_transmitter-1) * emitter_pitch), num=n_transmitter)
    ysous =  nsous*[ylim*1,]

    # Position of sensor to obtain the force!
    nsens = n_receiver#1# Number of sensors separated at 0.4081 mm # RECEPTORES
    zsens = np.linspace(sensor_edge_margin + (n_transmitter-1) * emitter_pitch + distance, sensor_edge_margin+ (n_transmitter-1)*emitter_pitch+distance + (n_receiver-1)*receiver_pitch, num=nsens)
    # IMPORTANTE: evaluar ligeramente por debajo del borde superior para evitar NaN.
    # FEniCS devuelve NaN cuando el punto de evaluación cae exactamente en el borde
    # o fuera del dominio. Con mesh_size pequeño (ej: 0.1), el eps del 1% (0.001)
    # puede ser menor que la altura mínima de celda real, dejando el punto fuera.
    # Solución: usar mesh.hmin() (altura mínima real del elemento) como referencia.
    hmin = mesh.hmin()
    eps_boundary = max(typical_mesh_size * 0.1, hmin * 0.5)
    ysens = nsens * [ylim - eps_boundary,]
    print(f"   eps_boundary para sensores: {eps_boundary:.6f} (hmin={hmin:.6f})")

    # Validar que todos los sensores caen dentro del bounding box del dominio
    mesh_coords = mesh.coordinates()
    x_min_mesh, x_max_mesh = mesh_coords[:, 0].min(), mesh_coords[:, 0].max()
    y_min_mesh, y_max_mesh = mesh_coords[:, 1].min(), mesh_coords[:, 1].max()
    print(f"   Bounding box del mesh: X=[{x_min_mesh:.4f}, {x_max_mesh:.4f}], Y=[{y_min_mesh:.4f}, {y_max_mesh:.4f}]")
    for k in range(nsens):
        zs, ys = zsens[k], ysens[k]
        if not (x_min_mesh <= zs <= x_max_mesh and y_min_mesh <= ys <= y_max_mesh):
            print(f"   ADVERTENCIA: sensor {k} en ({zs:.4f}, {ys:.4f}) fuera del dominio del mesh!")
            # Clampear posición dentro del bounding box con holgura
            zs = max(x_min_mesh + eps_boundary, min(x_max_mesh - eps_boundary, zs))
            ys = max(y_min_mesh + eps_boundary, min(y_max_mesh - eps_boundary, ys))
            zsens[k] = zs
            ysens[k] = ys
            print(f"            Corregido a ({zs:.4f}, {ys:.4f})")

    # Verificación de posiciones para diagnóstico
    print(f"  Posiciones de sensores calculadas:")
    print(f"   Transmisores (zsous): {zsous}")
    print(f"   Receptores (zsens): primer={zsens[0]:.2f}, ultimo={zsens[-1]:.2f}, total={len(zsens)}")
    print(f"   Distancia entre arrays: {distance:.2f} mm")

    # Parameters of Source definition
    eps = DOLFIN_EPS
    
    """# Rectangle geometry limits
    zlim, ylim = 70., 2.8
    # Porosity level from Mathilde data 
    # this data starts from 1% porosity values!
    por = porosity - 1# the porosity level is por+1
    # Define domain size 
    size = 400
    # generate f and create mesh
    domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
    mesh = generate_mesh(domain, size)
    # Compute the minimum height diameter
    print("Minimum height of element [mm]: ", mesh.hmin())
    #File("Domains/2DMesh.pvd") << mesh

    # Define source locations
    # Using notation consistent with the 3D-case
    nsous = 8
    zsous, ysous = [n for n in range(10, 25, 2)], nsous*[ylim,]
    # Position of sensor to obtain the force!
    nsens = 50# Number of sensors separated at 0.4081 mm
    zsens, ysens = np.arange(35, 55, step=0.4), nsens*[ylim,]
    # Parameters of Source definition
    eps = DOLFIN_EPS
    width = 0.5
    """
    """______________________DOMAINS______________________"""
    # Define domain for each source
    class DomSource_1(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[0]) < width + eps and
                    abs(x[1] - ysous[0]) < width + eps and
                    on_boundary)

    class DomSource_2(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[1]) < width + eps and
                    abs(x[1] - ysous[1]) < width + eps and
                    on_boundary)

    class DomSource_3(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[2]) < width + eps and
                    abs(x[1] - ysous[2]) < width + eps and
                    on_boundary)

    class DomSource_4(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[3]) < width + eps and
                    abs(x[1] - ysous[3]) < width + eps and
                    on_boundary)

    class DomSource_5(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[4]) < width + eps and
                    abs(x[1] - ysous[4]) < width + eps and
                    on_boundary)

    class DomSource_6(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[5]) < width + eps and
                    abs(x[1] - ysous[5]) < width + eps and
                    on_boundary)

    class DomSource_7(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[6]) < width + eps and
                    abs(x[1] - ysous[6]) < width + eps and
                    on_boundary)

    class DomSource_8(SubDomain):
        def inside(self, x, on_boundary):
            return (abs(x[0] - zsous[7]) < width + eps and
                    abs(x[1] - ysous[7]) < width + eps and
                   on_boundary)
    
    # Define source expression
    class Source(UserExpression):
        def __init__(self, freq, freq_0,
                    sig_freq, osc, 
                    degree=1, **kwargs):
            super().__init__(**kwargs)
            # initialize atributes
            self.freq, self.freq_0 = freq, freq_0
            self.sig_freq = sig_freq
            self.osc = osc
        
        def eval(self, values, x):
            ## Case using Fourier transform with -2*pi on the oscilation
            t_0 = 5.0 # [\mu s]
            sig2 = pow(self.sig_freq,2)
            pi2 = pow(pi,2)
            sum_freq = (self.freq_0 + self.freq)
            dif_freq = (self.freq_0 - self.freq)
            # Type of oscillation to consider
            if self.osc == "cos":
                factor = sqrt(pi*sig2/2)*cos(-2*pi*self.freq*self.freq_0)
            else:
                factor = sqrt(pi*sig2/2)*sin(-2*pi*self.freq*self.freq_0)
            # Obtaining left side and right sides
            num_ls = exp(-2*sig2*pi2*pow(sum_freq,2))
            num_rs = exp(-2*sig2*pi2*pow(dif_freq,2))
            values[0] = 0.0 # the horizontal direction
            values[1] = -factor*(num_ls+num_rs) # vertical direction
                
        def value_shape(self):
            return (2,)

    class Attenuation(UserExpression):
        def __init__(self, epsilon, zlim, ylim, degree=1):
            super().__init__()
            # Define constant factor for epsilon
            self._eps = epsilon
            # Define limits of geometry for damping
            self._ylim = ylim
            self._zlim = zlim
            
        def eval(self, values, x):
            # If we are in the main geometry
            if x[0] > 0.0 or x[0] < self._zlim:
                values[0] = self._eps
            # If we are outside the interest zone
            else:
                if x[0] < 0.0 + DOLFIN_EPS:
                    values[0] = self._eps*(1+np.abs(x[0]))
                else:
                    values[0] = self._eps*(1+np.abs(x[0]-self._zlim))
        def value_shape(self):
            return ()
    
    print("Number of Cells; {0}, of Vertice: {1}".format(mesh.num_cells(),
                                                    mesh.num_vertices()))
    
    # Mark boundaries with label 0
    boundaries = MeshFunction("size_t", mesh, mesh.topology().dim()-1)
    boundaries.set_all(0)

    # Mark boundaries (whenever necessary)
    # Mark domain sources with 2
    dom = {
        'DomSource_1':DomSource_1,
        'DomSource_2':DomSource_2,
        'DomSource_3':DomSource_3,
        'DomSource_4':DomSource_4,
        'DomSource_5':DomSource_5,
        'DomSource_6':DomSource_6,
        'DomSource_7':DomSource_7,
        'DomSource_8':DomSource_8

    }
    
    # Marcar dominios de fuente según el tipo de malla
    if mesh_type != "gmsh":
        # Para MSHR, usar dominios específicos
        for i in range(nsous):
            name = "DomSource_"+str(i+1)
            func = dom[name]
            func().mark(boundaries, 20+i+1)
    else:
        # Para GMSH, marcar dominios específicos alrededor de cada fuente
        # Esto es más preciso que marcar todo el borde superior
        for i in range(nsous):
            class SourceDomain(SubDomain):
                def __init__(self, z_center, y_center, width):
                    super().__init__()
                    self.z_center = z_center
                    self.y_center = y_center
                    self.width = width
                
                def inside(self, x, on_boundary):
                    return (on_boundary and 
                            abs(x[0] - self.z_center) < self.width + eps and
                            abs(x[1] - self.y_center) < self.width + eps)
            
            source_domain = SourceDomain(zsous[i], ysous[i], width)
            source_domain.mark(boundaries, 20+i+1)

    # Define new measure for boundaries
    # IMPORTANTE: NO usar global dx/ds. Si se sobrescriben los símbolos globales de UFL,
    # la segunda invocación de fmain (en el mismo worker de Celery) recibe un Measure
    # viejo en vez del símbolo original, produciendo formas variacionales corruptas → NaN.
    from dolfin import dx as _dx_sym, ds as _ds_sym
    dx = _dx_sym(domain=mesh)
    ds = _ds_sym(domain=mesh, subdomain_data=boundaries)

    # Define mixed function space with boundary conditions
    pdim = 1
    V = VectorElement("CG", mesh.ufl_cell(), pdim)
    V_element = MixedElement([V, V])
    W = FunctionSpace(mesh, V_element)
    # Define a constant function space for parameters
    P = FunctionSpace(mesh, 'DG', 0)

    # Define boundaries over the function space
    # In the variational form are defined the Neumann conditions
    # ROBUSTO: Usar SubDomain con tolerancia explícita en vez de near(x[0], 0.)
    _bc_tol = max(DOLFIN_EPS * 1000, mesh.hmin() * 0.01)
    class LeftBoundary(SubDomain):
        def inside(self, x, on_boundary):
            return on_boundary and x[0] < _bc_tol
    _left_bd = LeftBoundary()
    bc_0 = DirichletBC(W.sub(0), Constant((0.,0.)), _left_bd)
    bc_1 = DirichletBC(W.sub(1), Constant((0.,0.)), _left_bd)


    # Define kronecker delta in 2D and indices
    delta = Identity(2)
    i,j,k,l = indices(4)

    # Define strain tensor
    def strain(u): 
        return as_tensor(0.5*(u[i].dx(j)+u[j].dx(i)),
                    (i,j))

    # Define stiffness tensor C_{i,j,k,l} transverse isotropic
    def VoigtToTensor(A):
        # We use the convention, for long axis 1
        # Upper diagonal part
        A11, A13, A15 = A[0,0], A[0,1], A[0,2]
        A33, A35 = A[1,1], A[1,2]
        A55 = A[2,2]
        # Lower diagonal part (symmetric)
        A31, A51 = A13, A15
        A53 = A35
        
        return as_tensor([\
            [\
                [ [A11, A15], [A15, A13]] ,\
                [ [A51, A55], [A55, A53]] \
            ], \
            [
                [ [A51, A55], [A55, A53]] ,\
                [ [A31, A35], [A35, A33]] \
            ] \
                        ])
    
    """_____________________C VALUES_____________________"""
    # We take the standard density
    rho = d[por] # [g/cm^3] --> [g/(mm)^3]
    # Define the Voigt matrix representing the tensor
    # Here, the 3-axis is the z-axis, and
    # 1-axis in the y-axis or x-axis by the simmetry
    C_voigt = np.array([\
                    [C33[por], C13[por], 0], \
                    [C13[por], C11[por], 0], \
                    [0, 0, C55[por]] 
                    ])
    # Obtain the stiffness tensor
    C = VoigtToTensor(C_voigt)

    """_____________________D VALUES_____________________
    # We take the standard density
    rho = d[por] # [g/cm^3] --> [g/(mm)^3]
    # Define the Voigt matrix representing the tensor
    # Here, the 3-axis is the z-axis, and
    # 1-axis in the y-axis or x-axis by the simmetry
    D_voigt = np.array([\
                    [D33[por], D13[por], 0], \
                    [D13[por], D11[por], 0], \
                    [0, 0, D55[por]] 
                    ])
    # Obtain the stiffness tensor
    D = VoigtToTensor(D_voigt)
    """
    """_____________________FUNCTIONS_____________________"""
    # Define stress tensor
    def sigma(u):
        return as_tensor(C[i,j,k,l]*strain(u)[k,l], (i,j))

    # Define the three main blocks in variational forms
    def o_block(u, v, omega):
        return -rho*pow(omega,2)*inner(u, v)*dx
        #return -rho*pow(omega,2)*inner(grad(imag(u)), grad(imag(v))) * dx

    def eps_block(u, v, f, damping):
        return damping*f*inner(u, v)*dx

    def A_block(u, v):
        return inner(sigma(u), grad(v))*dx

    def b_block(source, v, bdry_id):
        return dot(source, v)*ds(bdry_id)

    """_____________________INFO_____________________"""
    # Print number of point at the boundary
    #print("Total number of points at the boundary", 
    #    len(bc_domain.get_boundary_values()))

    # Check the points where the force is applied
    #mesh_points = SubsetIterator(boundaries, 28)
    # === DIAGNÓSTICO: verificar marcado de facetas para cada fuente ===
    print("=== FACETAS MARCADAS POR FUENTE ===")
    for ii in range(nsous):
        idx = int(ii + 21)
        count = sum(1 for _ in SubsetIterator(boundaries, idx))
        print(f"   Fuente {ii} (tag {idx}): {count} facetas marcadas")
        if count == 0:
            print(f"   ⚠️  ADVERTENCIA: Fuente {ii} NO tiene facetas marcadas! La fuerza será 0.")
    
    # Check if the points a the left have been taken.
    n_bc0 = len(bc_0.get_boundary_values())
    n_bc1 = len(bc_1.get_boundary_values())
    print(f"   Dirichlet BC (left): bc_0={n_bc0} DOFs, bc_1={n_bc1} DOFs")
    if n_bc0 == 0:
        print(f"   ⚠️  ADVERTENCIA: Dirichlet BC NO aplicada! No hay DOFs en x=0.")

    """________________START________________"""
    # Frequency array to consider
    freqs = np.arange(0., 2., step=20/2048)# ~ [MHz], step=20/2048
    omegas = 2*pi*freqs

    # Define number of frequencies
    nfreq = freqs.shape[0]
    total_steps_all = nfreq * nsous  # total steps across all freqs × sources

    ## Iterate of freq. and solution saving for a point sensor
    # Define trial and test functions
    (u_r, u_i) = TrialFunctions(W)
    (v_r, v_i) = TestFunctions(W)

    # list all boundaries
    bcs = [bc_0, bc_1]

    # Define sensors arrays
    # Define sensors arrays for real and imaginary parts
    solR_sensors_z = np.zeros((nsens, nfreq, nsous))
    solR_sensors_y = np.zeros((nsens, nfreq, nsous))
    solI_sensors_z = np.zeros((nsens, nfreq, nsous))
    solI_sensors_y = np.zeros((nsens, nfreq, nsous))
        
    # Define parameter for the imaginary part
    # epsilon = 0.5E-3 # TEST!

    tau0 = 0.02
    B = 0.133;   # = 0.04 / 0.3

    tau = (5/10) * (tau0 + B * (por+1)/100)/100

    # Iteration over each frequency
    for idx_i in range(nfreq):
        # Verificar señal de aborto cada 5 frecuencias
        if idx_i % 5 == 0 and check_abort_signal():
            print(f"❌ Simulation {id} ABORTED by user at frequency {idx_i}/{nfreq}")
            raise RuntimeError(f"Simulation {id} aborted by user")

        # Emitir progreso cada 5 frecuencias
        if idx_i % 5 == 0:
            completed_steps = idx_i * nsous
            _emit_simulation_progress(id, completed_steps, total_steps_all, idx_i + 1, nfreq)

        
        ## Define Neumann boundary condition for source 
        freq, freq_0 = float(freqs[idx_i]), 1 # ~ 0.5 [MHz] ---------------------------------------------------------
        # Define general variance
        epsilon = (tau) * freq * 2 * pi
        sig_freq = 0.6 # sig_time ~ 0.7 [Mhz] 
        exp_R = Source(freq=freq, freq_0=freq_0,
                    sig_freq=sig_freq, osc="cos",
                    degree=1)
        exp_I = Source(freq=freq, freq_0=freq_0,
                    sig_freq=sig_freq, osc="sin",
                    degree=1)
        # Interpolate source over domain
        src_R = interpolate(exp_R, W.sub(0).collapse())
        src_I = interpolate(exp_I, W.sub(1).collapse())
        
        # Define damping and interpolate it
        exp_att = Attenuation(epsilon=epsilon, 
                            zlim=zlim, ylim=ylim,
                            degree=1)
        damping = interpolate(exp_att, P)
        # Variational forms (real and imaginary parts)
        Ar_lhs = o_block(u_r,v_r,omegas[idx_i]) + \
                eps_block(u_i,v_r,omegas[idx_i],damping) + \
                A_block(u_r,v_r)
        Ai_lhs = o_block(u_i,v_i,omegas[idx_i]) - \
                eps_block(u_r,v_i,omegas[idx_i],damping) + \
                A_block(u_i,v_i)             

        A = assemble(Ar_lhs + Ai_lhs)
        # Aplicar condiciones Dirichlet a la matriz A una sola vez por frecuencia
        [bc.apply(A) for bc in bcs]

        # Inicializar solver LU directo (MUMPS factoriza una vez por frecuencia y se reutiliza para todas las fuentes)
        lu_solver = None
        for _lu_method in ['mumps', 'default']:
            try:
                lu_solver = LUSolver(A, _lu_method)
                break
            except Exception:
                continue

        # Apply source sequentially 
        for sous_j in range(nsous):   
            # Verificar señal de aborto en cada paso de fuente
            if check_abort_signal():
                print(f"❌ Simulation {id} ABORTED by user at frequency {idx_i}/{nfreq}, source {sous_j}/{nsous}")
                raise RuntimeError(f"Simulation {id} aborted by user")

            # Emitir progreso continuo en tiempo real
            completed_steps = idx_i * nsous + sous_j
            _emit_simulation_progress(id, completed_steps, total_steps_all, idx_i + 1, nfreq)

            # Define function-solution
            u_sol = Function(W)
            # Usar dominios específicos para ambos tipos de malla
            bdry_id = int(21 + sous_j)
            
            b_rhs = b_block(src_R, v_r, bdry_id) + \
                    b_block(src_I, v_i, bdry_id)
            
            # Assemble of RHS vector
            b = assemble(b_rhs)
            [bc.apply(b) for bc in bcs]
            
            # Resolver sistema: LU directo ultrarrápido con fallback iterativo si fallase
            _solved = False
            if lu_solver is not None:
                try:
                    lu_solver.solve(u_sol.vector(), b)
                    _sol_arr = u_sol.vector().get_local()
                    if not np.any(np.isnan(_sol_arr)):
                        _solved = True
                    else:
                        print(f"   ⚠️  LU produjo NaN en freq {idx_i}, source {sous_j}. Usando fallback iterativo...")
                except Exception as _mumps_err:
                    print(f"   ⚠️  LU solve falló: {_mumps_err}. Usando fallback iterativo...")

            if not _solved:
                for _method, _pc in [('gmres', 'hypre_amg'), ('gmres', 'ilu')]:
                    try:
                        _ksp = PETScKrylovSolver(_method, _pc)
                        _ksp.parameters['maximum_iterations'] = 2000
                        _ksp.parameters['relative_tolerance'] = 1e-10
                        _ksp.parameters['absolute_tolerance'] = 1e-14
                        _ksp.set_operator(A)
                        _ksp.solve(u_sol.vector(), b)
                        _solved = True
                        break
                    except Exception:
                        pass
                if not _solved:
                    solve(A, u_sol.vector(), b)
            
            # === DIAGNÓSTICO NaN ===
            _sol_arr = u_sol.vector().get_local()
            if np.any(np.isnan(_sol_arr)):
                _nan_count = np.sum(np.isnan(_sol_arr))
                _b_arr = b.get_local()
                print(f"🚨 NaN DETECTADO en solución! freq_idx={idx_i}, freq={freq:.4f}, source={sous_j}")
                print(f"   NaN count: {_nan_count}/{len(_sol_arr)} DOFs")
                print(f"   ||b||={np.linalg.norm(_b_arr):.6e}, b has NaN: {np.any(np.isnan(_b_arr))}")
                if np.any(np.isnan(_b_arr)):
                    print(f"   → NaN en RHS. Problema en el ensamblaje de formas.")
                else:
                    print(f"   → RHS válido. NaN se origina en el SOLVER (matriz singular?).")
            
            if sous_j == 0 and (idx_i % 10 == 0 or idx_i == nfreq - 1):
                print(f"Freq {idx_i+1}/{nfreq} ({freq:.3f} MHz), Fuente {sous_j}: Sol norm = {u_sol.vector().norm('l2'):.4e}")
            # Assign real and imaginary parts
            (u_rsol, u_isol)  = u_sol.split(True)
            # Compute data at the sensors and save it as array
            for sens_k in range(nsens):
                # Obtain point value of solution u
                sensor_point = Point(np.array((zsens[sens_k], ysens[sens_k])))
                val_z = u_rsol(sensor_point)[0]
                val_y = u_rsol(sensor_point)[1]
                val_iz = u_isol(sensor_point)[0]
                val_iy = u_isol(sensor_point)[1]
                
                solR_sensors_z[sens_k, idx_i, sous_j] = val_z
                solR_sensors_y[sens_k, idx_i, sous_j] = val_y
                solI_sensors_z[sens_k, idx_i, sous_j] = val_iz
                solI_sensors_y[sens_k, idx_i, sous_j] = val_iy
                
                # Diagnóstico para el primer sensor y primera frecuencia
                if sens_k == 0 and idx_i == 0:
                    print(f"Sensor {sens_k} en punto ({zsens[sens_k]:.3f}, {ysens[sens_k]:.3f}):")
                    print(f"  Valores reales: z={val_z:.6e}, y={val_y:.6e}")
                    print(f"  Valores imaginarios: z={val_iz:.6e}, y={val_iy:.6e}")
                
            if sous_j == 0:
                # Save vtk solution
                #vtk_u << (u_sol, float(freq_i))   
                # Print some info about the solutions
                print("Value at sensor: {0}, with freq: {1:.3f} [MHz]".format(
                    u_sol(sensor_point)[1], freq))
                #print("Value rhs", np.linalg.norm(b, ord=2))

    savedic = {
        # Datos de simulación (originales)
        'zlim': zlim, 'ylim': ylim, 'nsous': nsous,
        'zsous': zsous, 'ysous': ysous, 'nsens': nsens,
        'zsens': zsens, 'ysens': ysens, 'nfreq': nfreq,
        'freqs': freqs, 'omegas': omegas,
        'solR_sensors_z': solR_sensors_z, 'solR_sensors_y': solR_sensors_y,
        'solI_sensors_z': solI_sensors_z, 'solI_sensors_y': solI_sensors_y,
        
        # Configuración completa de la simulación
        'n_transmitter': n_transmitter,
        'n_receiver': n_receiver,
        'distance': distance,
        'emitter_pitch': emitter_pitch,
        'receiver_pitch': receiver_pitch,
        'sensor_edge_margin': sensor_edge_margin,
        'typical_mesh_size': typical_mesh_size,
        'plate_thickness': plate_thickness,
        'porosity': porosity,
        'attenuation': attenuation,
        'simulation_id': id,
        'mesh_type': mesh_type,
        'xml_file': xml_file if xml_file else '',
        
        # Información adicional
        'simulation_type': 'frequency_domain',
        'timestamp': str(Hora_inicio)
    }
    filename1 = 'src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/Files_mat/FreqSimp'+"POR"+str(por+1)+'TransIsoW'+ str(ylim)+'M'+str(size) + str(id) + '.mat'

    filename = 'FreqSimp'+"POR"+str(por+1)+'TransIsoW'+ str(ylim)+'M'+str(size) + str(id) + '.mat'
    sio.savemat(filename1, savedic, appendmat=True)

    print(filename1+"\n"+filename)
    ## Zona de Pruebas de tiempo ##
    Hora_final = datetime.now()
    print(Hora_final)
    tiempo_ejecucion = Hora_final - Hora_inicio
    #tiempo_ejecucion.strftime('%H:%M %p')
    print("Tiempo de ejecución",tiempo_ejecucion)

    #Save file into database
    return filename,tiempo_ejecucion