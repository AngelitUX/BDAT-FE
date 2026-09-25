#!/usr/bin/env python
# coding: utf-8
##DOMINIO DE TEMPORAL, atenuacion = NO
# ## Case of 8 sources and 50 receptors, with left boundary of Dirichlet type.
from dolfin import *
import gmsh
from mshr import *

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
    
    import scipy.io as sio
    import numpy as np
    from datetime import datetime
    import time
    import tempfile
    import os
    from ufl import Identity, indices, as_tensor
    # Desbloquear todos los núcleos de CPU para OpenMP y BLAS
    for _env_th in ['OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS']:
        if os.environ.get(_env_th) in ('0', '1'):
            try:
                del os.environ[_env_th]
            except Exception:
                pass

    print('Parametros: ', n_transmitter, n_receiver, distance, emitter_pitch, receiver_pitch, sensor_edge_margin, typical_mesh_size, plate_thickness, porosity, attenuation, id, mesh_type, xml_file)
    
    # Función para verificar señal de aborto
    def check_abort_signal():
        # Usar directorio compartido entre contenedores
        signal_dir = '/app/temp_signals' if os.path.exists('/app') else tempfile.gettempdir()
        abort_signal_file = os.path.join(signal_dir, f'abort_sim_{id}.signal')
        if os.path.exists(abort_signal_file):
            print(f" ABORT SIGNAL DETECTED for simulation {id}")
            print(f" Signal file location: {abort_signal_file}")
            try:
                os.remove(abort_signal_file)
                print(f" Abort signal file removed")
            except Exception as e:
                print(f" Could not remove abort signal file: {e}")
            return True
        return False
    
    Hora_inicio = datetime.now()
    print(Hora_inicio)
    #tiempo_inicio_1 = time.time()
    tiempo_inicio = time.time()
    zlim=(2*sensor_edge_margin) + ((n_transmitter-1)*emitter_pitch) + distance + ((n_receiver-1)*receiver_pitch)
    ylim = plate_thickness
    dxt = typical_mesh_size
    size = round(zlim/dxt) # Dato importante para compatibilidad

    #zlim = 2*margen + (NE-1)*pE + D + (NR-1)*pR
    #pE pitch emitter
    #Nr number of receivers
    #pR pitch receiver
    #D distance between emitter and receiver

    # Porosity level from Mathilde data
    # this data starts from 1% porosity values!
    #por = 11 # the porosity level is por+1
    # Define domain size

    # Calcular dimensiones del dominio
    # zlim = (2*sensor_edge_margin) + (n_transmitter*emitter_pitch) + distance + (n_receiver*receiver_pitch)
    # ylim = plate_thickness

    # Generar mesh usando el método especificado
    # if mesh_type == "mshr":
    #     print(" Generando mesh con mshr...")
    #     domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
    #     mesh = generate_mesh(domain, size)
    # elif mesh_type == "gmsh":
    #     print(" Generando mesh gradual con gmsh...")
    #     filename = f"gmsh_gradual_{id}"
    #     xml_file = create_rectangle_mesh_gradual(zlim, ylim, dxt, filename)
    #     mesh = Mesh(xml_file)
    # else:
        # Fallback a mesh_file si está disponible
        # if mesh_file:
        #     print(" Cargando mesh desde archivo...")
        #     mesh = Mesh(mesh_file)
        # else:
        #     print("  Usando mshr como fallback...")
        #     domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
        #     mesh = generate_mesh(domain, size)
    
    if mesh_type == "gmsh":
        print(" Cargando mesh desde archivo XML (generado con gmsh)...")
        _mesh_in = Mesh(xml_file)
        _mesh_in.init()
        _coords = _mesh_in.coordinates()
        _cells = _mesh_in.cells()
        _p0 = _coords[_cells[:, 0]]
        _p1 = _coords[_cells[:, 1]]
        _p2 = _coords[_cells[:, 2]]
        # |det| = 2 * área del triángulo (2D)
        _det = (_p1[:, 0] - _p0[:, 0]) * (_p2[:, 1] - _p0[:, 1]) \
            - (_p2[:, 0] - _p0[:, 0]) * (_p1[:, 1] - _p0[:, 1])
        _n_negative = int(np.sum(_det < 0))
        _span = max(float(np.ptp(_coords[:, 0])), float(np.ptp(_coords[:, 1])), 1e-12)
        # Umbral: elimina solo triángulos colapsados / área numérica nula; no toca malla sana en mm.
        _det_cut = max(1e-30, float(np.finfo(float).eps) * (_span ** 2) * 500.0)
        _keep = np.abs(_det) > _det_cut
        _n_drop = int(np.sum(~_keep))
        if _n_negative > 0:
            print(f"   ⚠️  {_n_negative}/{_cells.shape[0]} celdas con orientación negativa detectadas")
        if _n_drop > 0:
            print(f"   ⚠️  {_n_drop} triángulo(s) degenerado(s) (|det|≤{_det_cut:.2e}) — se excluyen del mesh")
        _n_in = int(_cells.shape[0])
        _n_keep = int(np.sum(_keep))
        if _n_keep == 0:
            raise RuntimeError(
                "Malla gmsh inválida: todas las celdas son degeneradas. Regenerar la malla en Gmsh."
            )
        if _n_drop > max(500, int(0.15 * _n_in)):
            raise RuntimeError(
                f"Malla gmsh: demasiados triángulos degenerados ({_n_drop}/{_n_in}). "
                "Regenerar u optimizar en Gmsh en lugar de depender del saneado automático."
            )
        # Sin cambios: reutilizar mesh cargado
        if _n_negative == 0 and _n_drop == 0:
            mesh = _mesh_in
            print("   ✅ Orientación y área de celdas correctas (sin reconstrucción)")
        else:
            _cells_use = []
            for _ci in range(_n_in):
                if not _keep[_ci]:
                    continue
                _v0, _v1, _v2 = int(_cells[_ci, 0]), int(_cells[_ci, 1]), int(_cells[_ci, 2])
                if _det[_ci] < 0:
                    _v1, _v2 = _v2, _v1
                _cells_use.append((_v0, _v1, _v2))
            _editor = MeshEditor()
            new_mesh = Mesh()
            _editor.open(new_mesh, "triangle", 2, 2)
            _editor.init_vertices(_coords.shape[0])
            _editor.init_cells(len(_cells_use))
            for _vi in range(_coords.shape[0]):
                _editor.add_vertex(_vi, _coords[_vi])
            for _ji, (_v0, _v1, _v2) in enumerate(_cells_use):
                _editor.add_cell(_ji, [_v0, _v1, _v2])
            _editor.close()
            new_mesh.init()
            mesh = new_mesh
            print(f"   ✅ Mesh saneado: {len(_cells_use)} triángulos válidos (reorientados donde hacía falta)")
        # Verificar calidad mínima del mesh (vectorizado)
        _mq_c = mesh.coordinates()
        _mq_cl = mesh.cells()
        _mq_p0 = _mq_c[_mq_cl[:, 0]]
        _mq_p1 = _mq_c[_mq_cl[:, 1]]
        _mq_p2 = _mq_c[_mq_cl[:, 2]]
        _mq_det = (_mq_p1[:, 0] - _mq_p0[:, 0]) * (_mq_p2[:, 1] - _mq_p0[:, 1]) \
            - (_mq_p2[:, 0] - _mq_p0[:, 0]) * (_mq_p1[:, 1] - _mq_p0[:, 1])
        _min_abs_area = float(0.5 * np.min(np.abs(_mq_det)))
        _h0_mesh = float(mesh.hmin())
        _area_tol = max(1e-30, (_h0_mesh ** 2) * 1e-14)
        print(f"   Área mín. de triángulo (|J|/2): {_min_abs_area:.2e}  (tol heurística: {_area_tol:.2e})")
        if _min_abs_area <= 0.0 or not np.isfinite(_min_abs_area):
            raise RuntimeError(
                "Tras el saneado siguen triángulos con área nula. Regenerar la malla en Gmsh."
            )
        if _min_abs_area < _area_tol:
            raise RuntimeError(
                f"Malla gmsh de muy mala calidad: área mínima {_min_abs_area:.2e} < {_area_tol:.2e}. "
                "Refinar con calidad mínima en Gmsh."
            )
    elif mesh_type == "mshr":
        print(" Generando mesh con mshr...")
        domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
        mesh = generate_mesh(domain, size)
    else:
        print("  Tipo de mesh no reconocido. Usando mshr como fallback...")
        domain = Rectangle(Point(0., 0.), Point(zlim, ylim))
        mesh = generate_mesh(domain, size)
    
    # Compute the minimum height diameter
    print("Minimum height of element [mm]: ", mesh.hmin())
    #File("Domains/2DMesh.pvd") << mesh

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

    # Define source locations
    # Using notation consistent with the 3D-case
    nsous = n_transmitter#1 #Cantidad de emisores

    #zsous = [n for n in range(10, 25, 2)] version anterior
    zsous = np.linspace(sensor_edge_margin, sensor_edge_margin + ((n_transmitter-1) * emitter_pitch), num=n_transmitter)
    #cambios : zsous = [n for n in range(edge margin,edge margin + (n_transmitter-1)*Emitter pitch, Emitter pitch)] 
    #[n for n in range(margen, margen+(NE-1)*pE, pE)]

    ysous =  nsous*[ylim*1,]
    #TODO: 1 parametrizable a futuro
    eps = DOLFIN_EPS
    width = 0.9 * emitter_pitch #antes era 0.5 sens_width

    # Define domain for each source

    # class DomSource_n(SubDomain,):
    #     def inside(self, x, on_boundary,i):
    #         return (abs(x[0] - zsous[i-1]) < width + eps and
    #                 abs(x[1] - ysous[i-1]) < width + eps and
    #                 on_boundary)

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
        def __init__(self, time, t_0,
                    sig_time, degree=1, **kwargs):
            super().__init__(**kwargs)
            # initialize atributes
            self.time, self.t_0 = time, t_0
            self.sig_time = sig_time

        def eval(self, values, x):
            factor = 1/(2*pow(self.sig_time,2))
            dif_time = self.time - self.t_0
            # Obtaining left side and right sides
            f0=1
            num = exp(-factor*pow(dif_time,2))*cos(2*pi*dif_time*f0)
            # Define values for the vector
            values[0] = 0.0 # the horizontal direction
            values[1] = -num # vertical direction
            # DEBUG CASE!
            #values[1] = -cos(2*pi*dif_time)

        def value_shape(self):
            return (2,)

    """
    from IPython.display import HTML
    HTML(X3DOM().html(mesh))
    """
    print("Number of Cells; {0}, of Vertice: {1}".format(mesh.num_cells(), mesh.num_vertices()))

    # Define update procedure
    def update(u, u_n, v_n, a_n, beta, gamma, dt):
        """
        Update procedure for the acceleration using the
        beta-Newmark scheme.
        """
        # Obtain vector representation of fields
        u_vec, u_nvec = u.vector(), u_n.vector()
        v_nvec, a_nvec = v_n.vector(), a_n.vector()
        # update using the beta-gamma scheme
        a_vec = (1.0/(beta*pow(dt,2)))*(u_vec-u_nvec-dt*v_nvec) - ((1-2*beta)/(2*beta))*a_nvec
        # update velocity
        v_vec = v_nvec + dt*((1-gamma)*a_nvec+gamma*a_vec)
        # update fields
        v_n.vector()[:], a_n.vector()[:] = v_vec, a_vec
        u_n.vector()[:] = u.vector()


    nsens = n_receiver  # Number of sensors (RECEPTORES)
    
    # Cálculo correcto: debe usar (n_transmitter-1)*emitter_pitch
    zsens = np.linspace(
        sensor_edge_margin + (n_transmitter-1)*emitter_pitch + distance, 
        sensor_edge_margin + (n_transmitter-1)*emitter_pitch + distance + (n_receiver-1)*receiver_pitch, 
        num=nsens
    )
    # IMPORTANTE: evaluar ligeramente por debajo del borde superior para evitar NaN.
    # FEniCS devuelve NaN cuando el punto de evaluacion cae exactamente en el borde
    # o fuera del dominio. Con mesh_size pequeño (ej: 0.1), el eps del 1% (0.001)
    # puede ser menor que la altura mínima de celda real, dejando el punto fuera.
    # Solucion: usar mesh.hmin() (altura mínima real del elemento) como referencia.
    hmin = mesh.hmin()
    eps_boundary = max(typical_mesh_size * 0.1, hmin * 0.5)
    ysens = nsens * [ylim - eps_boundary,]
    print(f"   eps_boundary para sensores: {eps_boundary:.6f} (hmin={hmin:.6f})")

    # Validar que todos los sensores caen dentro del bounding box del dominio
    mesh_coords = mesh.coordinates()
    x_min_mesh, x_max_mesh = mesh_coords[:, 0].min(), mesh_coords[:, 0].max()
    y_min_mesh, y_max_mesh = mesh_coords[:, 1].min(), mesh_coords[:, 1].max()
    print(f"   Bounding box del mesh: X=[{x_min_mesh:.4f}, {x_max_mesh:.4f}], Y=[{y_min_mesh:.4f}, {y_max_mesh:.4f}]")
    for k, (zs, ys) in enumerate(zip(zsens, ysens)):
        if not (x_min_mesh <= zs <= x_max_mesh and y_min_mesh <= ys <= y_max_mesh):
            print(f"   ADVERTENCIA: sensor {k} en ({zs:.4f}, {ys:.4f}) fuera del dominio del mesh!")
            # Clampear posicion dentro del bounding box con holgura
            zs = max(x_min_mesh + eps_boundary, min(x_max_mesh - eps_boundary, zs))
            ys = max(y_min_mesh + eps_boundary, min(y_max_mesh - eps_boundary, ys))
            zsens[k] = zs
            ysens[k] = ys
            print(f"            Corregido a ({zs:.4f}, {ys:.4f})")

    # Verificacion de posiciones para analisis f-k
    print(f"  Posiciones de sensores calculadas:")
    print(f"   Transmisores (zsous): {zsous}")
    print(f"   Receptores (zsens): primer={zsens[0]:.2f}, ultimo={zsens[-1]:.2f}, total={len(zsens)}")
    print(f"   Espaciado receptores: {receiver_pitch:.4f} mm")
    print(f"   Distancia entre arrays: {distance:.2f} mm")

    # Define function spaces and boundary conditions
    pdim = 1 #Antes era 1
    V = VectorFunctionSpace(mesh, 'CG', pdim, dim=2)
    # Define trial and test functions
    u = TrialFunction(V)
    w = TestFunction(V)

    # Mark subdomains with label 0
    #subdomains = MeshFunction("size_t", mesh, mesh.topology().dim())
    #subdomains.set_all(0)
    # Mark boundaries with label 0
    #Identificando cual es el mesh, 
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
    for i in range(nsous):
        name = "DomSource_"+str(i+1)
        func = dom[name]
        func().mark(boundaries, 20+i+1)
    
    # File("boundaries.pvd") << boundaries
    # File("mesh.pvd") << mesh

    # Define new measure for boundaries
    # IMPORTANTE: NO usar global dx/ds. Si se sobrescriben los símbolos globales de UFL,
    # la segunda invocación de fmain (en el mismo worker de Celery) recibe un Measure
    # viejo en vez del símbolo original, produciendo formas variacionales corruptas → NaN.
    from dolfin import dx as _dx_sym, ds as _ds_sym
    dx = _dx_sym(domain=mesh)
    ds = _ds_sym(domain=mesh, subdomain_data=boundaries)

    # Define boundaries over the function space
    # In the variational form are defined the Neumann conditions
    # ROBUSTO: Usar SubDomain con tolerancia explícita en vez de near(x[0], 0.)
    # near() usa DOLFIN_EPS (~1e-14) que puede fallar con meshes gmsh donde
    # los nodos en x=0 tienen error de punto flotante tras conversión meshio→XML.
    _bc_tol = max(DOLFIN_EPS * 1000, mesh.hmin() * 0.01)
    class LeftBoundary(SubDomain):
        def inside(self, x, on_boundary):
            return on_boundary and x[0] < _bc_tol
    bc_domain = DirichletBC(V, Constant((0.,0.)), LeftBoundary())

    # Set FFC parameters to optimize compilation
    parameters["form_compiler"]["optimize"] = True
    parameters["form_compiler"]["cpp_optimize"] = True
    parameters["form_compiler"]["representation"] = "uflacs"
    parameters["form_compiler"]["quadrature_degree"] = 2

    # Load material properties from Mathilde data
    C_mathilde = sio.loadmat(r"src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/Files_mat/C_values_mathilde.mat")
    
    # Define the constants
    # The stiffness constants in [GPa] --> [g/mm(\mu sec)^2]
    # are given by the mathilde .mat file of 5%
    C11 = np.reshape(C_mathilde['C11'], (30,))*1E-3
    C12 = np.reshape(C_mathilde['C12'], (30,))*1E-3
    C13 = np.reshape(C_mathilde['C13'], (30,))*1E-3
    C33 = np.reshape(C_mathilde['C33'], (30,))*1E-3
    C55 = np.reshape(C_mathilde['C55'], (30,))*1E-3
    C66 = np.reshape(C_mathilde['C66'], (30,))*1E-3
    d = np.reshape(C_mathilde['d'], (30,))*1E-3
    
    # Asegurar que porosity sea entero para indexar arrays
    porosity = int(porosity)
    por = porosity - 1  # Porosity level (starts from 1% in data)
    
    print(f""" At {por+1}% of porosity, density of {d[por]:2.4f},
    C11 = {C11[por]:2.4f}, C33 = {C33[por]:2.4f}, C55 = {C55[por]:2.4f}
    C66 = {C66[por]:2.4f}, C12 = {C12[por]:2.4f}, C13 = {C13[por]:2.4f}
    """)

    # Define kronecker delta in 2D and indices
    delta = Identity(2)
    i,j,k,l = indices(4)

    # Define strain tensor
    def epsilon(u):
        return as_tensor(0.5*(u[i].dx(j)+u[j].dx(i)),(i,j))

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

        return as_tensor([[[ [A11, A15], [A15, A13]], [ [A51, A55], [A55, A53]]],[[ [A51, A55], [A55, A53]] ,[ [A31, A35], [A35, A33]]]])

    # We take the standard density
    rho = d[por] # [g/cm^3] --> [g/(mm)^3]
    # Define the Voigt matrix representing the tensor
    # Here, the 3-axis is the z-axis, and
    # 1-axis in the y-axis or x-axis by the simmetry
    C_voigt = np.array([[C33[por], C13[por], 0], [C13[por], C11[por], 0], [0, 0, C55[por]]])
    # Obtain the stiffness tensor
    C = VoigtToTensor(C_voigt)
    # Define stress tensor
    def sigma(u):
        return as_tensor(C[i,j,k,l]*epsilon(u)[k,l], (i,j))

    # ================================================================
    # SPONGE LAYER: Absorb waves in the edge margin zones to prevent
    # reflections from the Dirichlet boundary (x=0) and the free
    # boundary (x=zlim). Without this, reflected waves corrupt the
    # signal when edge_margin < ~40mm.
    #
    # σ(x) = σ_max * (d/L)^2  where d = distance into the sponge zone
    # σ_max is computed so that waves are attenuated by ~60dB in
    # a round trip through the margin.
    # ================================================================
    # Estimate wave speed from material properties: c ≈ sqrt(C33/rho)
    c_wave = float(np.sqrt(C33[por] / rho))  # [mm/μs]
    sponge_L = float(sensor_edge_margin)  # thickness of sponge zone [mm]
    # σ_max from PML theory: σ_max = -(p+1)*c*ln(R) / (2*L)
    # R = target reflection coeff, p = polynomial order
    R_target = 1e-3  # 60 dB attenuation
    p_order = 2
    # Paso temporal fijo del experimento (debe coincidir con `times` más abajo)
    dt_sim = 1.0 / 20.0
    h_mesh = float(mesh.hmin())
    dxt_f = float(typical_mesh_size)
    # Con margen pequeño, σ ∝ 1/L dispara amortiguación + mal condicionamiento
    # del bloque de masa Newmark; acotamos L en la fórmula sin cambiar la
    # geometría del esponjado (sigue siendo sponge_L en x).
    L_sigma_ref = max(
        sponge_L,
        5.0,
        h_mesh * 15.0,
        dxt_f * 20.0,
        c_wave * dt_sim * 4.0,
    )
    if sponge_L > 0:
        sigma_max = -(p_order + 1) * c_wave * np.log(R_target) / (2.0 * L_sigma_ref)
    else:
        sigma_max = 0.0
    print(f"=== SPONGE LAYER ===")
    print(f"   c_wave={c_wave:.2f} mm/μs, margin={sponge_L:.1f} mm, σ_max={sigma_max:.4f}")
    print(f"   L_ref(σ)={L_sigma_ref:.2f} mm (evita σ excesivo si el margen es pequeño; hmin={h_mesh:.4f})")

    # Spatially-varying damping coefficient
    P_space = FunctionSpace(mesh, 'DG', 0)

    class SpongeCoeff(UserExpression):
        def __init__(self, zlim, margin, sigma_max, **kwargs):
            super().__init__(**kwargs)
            self._zlim = zlim
            self._margin = margin
            self._smax = sigma_max

        def eval(self, values, x):
            if self._margin <= 0:
                values[0] = 0.0
            elif x[0] < self._margin:
                # Left sponge: quadratic ramp
                d_norm = (self._margin - x[0]) / self._margin
                values[0] = self._smax * d_norm * d_norm
            elif x[0] > self._zlim - self._margin:
                # Right sponge: quadratic ramp
                d_norm = (x[0] - (self._zlim - self._margin)) / self._margin
                values[0] = self._smax * d_norm * d_norm
            else:
                values[0] = 0.0

        def value_shape(self):
            return ()

    sponge_expr = SpongeCoeff(zlim, sponge_L, sigma_max, degree=0)
    sponge_func = interpolate(sponge_expr, P_space)

    # Define the three main blocks in variational forms
    # NOTE: The sponge damping adds a viscous term: C·v ≈ σ·ρ·v
    # In Newmark, this modifies LHS and RHS.
    def o_block(u, w, dt):
        # Mass + sponge damping (Newmark-discretized velocity damping)
        factor_mass = rho/(beta*dt*dt)
        factor_damp = sponge_func * rho * gamma / (beta * dt)
        return (factor_mass + factor_damp)*inner(u, w)*dx

    def A_block(u, w):
        return inner(sigma(u), grad(w))*dx

    def b_block(u, u_n, v_n, a_n, w, beta_, gamma_, dt):
        # Standard Newmark RHS + sponge damping contributions
        factor_1 = rho/(beta_*dt*dt)
        factor_2 = rho/(beta_*dt)
        factor_3 = rho*(1.0-2.0*beta_)/(2.0*beta_)
        # Sponge damping RHS factors
        damp_f1 = sponge_func * rho * gamma_ / (beta_ * dt)       # multiplies u_n
        damp_f2 = sponge_func * rho * (gamma_ / beta_ - 1.0)      # multiplies v_n
        damp_f3 = sponge_func * rho * dt * (gamma_ / (2.0*beta_) - 1.0)  # multiplies a_n
        value_wtf = (factor_1 + damp_f1)*inner(u_n, w)*dx \
                  + (factor_2 + damp_f2)*inner(v_n, w)*dx \
                  + (factor_3 + damp_f3)*inner(a_n, w)*dx
        return value_wtf

    def bdry_block(source, w, bdry_id):
        # rhs part containing the force applied at the boundary
        return dot(source, w)*ds(bdry_id)

    # Time array to consider
    # samplign step 1/20, ntimes = 1024
    times = np.arange(0, 51.2, step = 1./20)# experiment ~ 48[\mu sec]
    # Define number of times from array
    ntimes = times.shape[0]
    total_steps_all = ntimes * nsous  # total steps across all sources
    # Define sensors arrays
    sol_sensors_z = np.zeros((nsens, ntimes, nsous))
    sol_sensors_y = np.zeros((nsens, ntimes, nsous))

    d = u.geometric_dimension()
    u_shape = grad(u).ufl_shape
    print("Geometric dimension of u: {0}".format(d))
    print("UFL shape of grad(u): {0}".format(u_shape))
    """
    # Check the points where the force is applied
    mesh_points = SubsetIterator(boundaries, 21)
    print("Midpoints where the force is applied")

    for data in mesh_points:
        print("Points at boundary 21, ({0},{1}) ".format(
            data.midpoint().x(), data.midpoint().y()))

    """
    # === DIAGNÓSTICO: verificar marcado de facetas para cada fuente ===
    print("=== FACETAS MARCADAS POR FUENTE ===")
    for ii in range(nsous):
        idx = int(ii + 21)
        count = sum(1 for _ in SubsetIterator(boundaries, idx))
        print(f"   Fuente {ii} (tag {idx}): {count} facetas marcadas")
        if count == 0:
            print(f"   ⚠️  ADVERTENCIA: Fuente {ii} NO tiene facetas marcadas! La fuerza será 0.")

    # Check if the points a the left have been taken.
    n_bc = len(bc_domain.get_boundary_values())
    print(f"   Dirichlet BC (left): {n_bc} DOFs constrained")
    if n_bc == 0:
        print(f"   ⚠️  ADVERTENCIA: Dirichlet BC NO aplicada! No hay DOFs en x=0.")

    # tiempo_final_8 = time.time()
    # tiempo_ejecucion_8 = tiempo_final_8 -tiempo_inicio_8
    # print("Tiempo ejecución 8:", tiempo_ejecucion_8)

    #Cambios debido a RecursionError: maximum recursion depth exceeded
    #tiempo_inicio_9 =time.time()
    # list all boundaries
    bcs = [bc_domain]
    # Define name solutions for saving with File
    filename = "SimP"+str(por+1)+"TransIso"+str(ylim)+ "M"+str(size)+".pvd"
    # filepvd ="Results/"+filename
    # vtk_u = File(filepvd)
    # Define file to save data at experiment with sous 2
    #filename_sol = "SimSous6P"+str(por+1)+"TransIso"+str(ylim)+ \
    #               "M"+str(size)+".pvd"
    #filepvd_sol ="Results/"+filename_sol
    #vtk_u_sol = File(filepvd_sol)
    # Parameters for the Newmark scheme
    beta, gamma = 0.36, 0.7

    # output the dt time
    dt = times[1]-times[0]
    print("Considering dt: ", dt)
    
    # ============================================================
    # OPTIMIZACIONES DE RENDIMIENTO (Fases 1 a 4):
    # 1. Paralelismo Multi-hilo (OpenMP y BLAS)
    # 2. Factorización LU Reutilizable (factorizada 1 vez para toda la simulación)
    # 3. Compartir Matriz A y Solver entre todos los Emisores
    # 4. Pre-cálculo Espacial de la Fuente (Separación x,t) y Operadores Newmark
    # ============================================================
    t_opt_init = time.time()
    print("⚡ [Optimizador] Pre-ensamblando matriz global del sistema A...")
    A_lhs = o_block(u, w, dt) + A_block(u, w)
    A = assemble(A_lhs)
    
    # Aplicar condiciones de contorno tipo Dirichlet a la matriz A una sola vez
    for bc in bcs:
        bc.apply(A)

    # Diagnóstico de la matriz A
    try:
        _n_dofs = A.size(0)
        _diag_vals = np.array([A.getrow(i)[1][np.searchsorted(A.getrow(i)[0], i)] if i in A.getrow(i)[0] else 0.0 for i in range(min(_n_dofs, 100))])
        _n_zero_sample = np.sum(np.abs(_diag_vals) < 1e-30)
        print(f"=== DIAGNÓSTICO MATRIZ A ===")
        print(f"   DOFs totales: {_n_dofs}")
        print(f"   Diagonal (primeras 100): min={np.min(np.abs(_diag_vals)):.2e}, max={np.max(np.abs(_diag_vals)):.2e}")
        print(f"   Ceros en diagonal (muestra): {_n_zero_sample}/100")
        if _n_zero_sample > 0:
            print(f"   🚨 Ceros en diagonal detectados → posible matriz singular")
    except Exception as _diag_err:
        print(f"   ⚠️  Diagnóstico de matriz falló: {_diag_err}")

    # Configuración e inicialización del solver directo con factorización persistente
    print("⚡ [Optimizador] Inicializando solver LU persistente...")
    _lu_solver = None
    _ksp_solver = None
    if A.size(0) <= 250000:
        try:
            _lu_solver = LUSolver(A)
            # Factorización anticipada mediante vector temporal
            _test_b = Vector()
            A.init_vector(_test_b, 0)
            _test_x = Function(V).vector()
            _lu_solver.solve(_test_x, _test_b)
            print("   ✅ LUSolver (directo) inicializado y factorizado exitosamente")
        except Exception as _e_lu:
            print(f"   ⚠️  LUSolver falló en inicialización: {_e_lu}. Usando solver alternativo.")
            _lu_solver = None

    if _lu_solver is None:
        try:
            _ksp_solver = PETScKrylovSolver("preonly", "lu")
            _ksp_solver.set_operator(A)
            print("   ✅ PETSc preonly+lu configurado")
        except Exception as _e_ksp:
            print(f"   ⚠️  PETSc preonly falló: {_e_ksp}")

    # Pre-ensamblar operadores lineales del lado derecho para Newmark
    print("⚡ [Optimizador] Pre-ensamblando operadores lineales Newmark...")
    factor_1 = rho/(beta*dt*dt)
    factor_2 = rho/(beta*dt)
    factor_3 = rho*(1.0-2.0*beta)/(2.0*beta)
    damp_f1 = sponge_func * rho * gamma / (beta * dt)
    damp_f2 = sponge_func * rho * (gamma / beta - 1.0)
    damp_f3 = sponge_func * rho * dt * (gamma / (2.0*beta) - 1.0)

    M_u = assemble((factor_1 + damp_f1)*inner(u, w)*dx)
    M_v = assemble((factor_2 + damp_f2)*inner(u, w)*dx)
    M_a = assemble((factor_3 + damp_f3)*inner(u, w)*dx)

    # Pre-ensamblar perfiles espaciales de los emisores
    print(f"⚡ [Optimizador] Pre-ensamblando perfiles espaciales de {nsous} emisores...")
    B_spatial_list = [assemble(dot(Constant((0.0, -1.0)), w)*ds(int(21 + s))) for s in range(nsous)]

    # Pre-calcular serie temporal de excitación acústica
    t_0 = 5.0
    sig_time = 0.7
    f0 = 1.0
    factor_gauss = 1.0 / (2.0 * (sig_time**2))
    dif_times = times - t_0
    source_temporal = np.exp(-factor_gauss * (dif_times**2)) * np.cos(2.0 * np.pi * dif_times * f0)

    # Pre-crear objetos Point de receptores
    sensor_points = [Point(float(zsens[k]), float(ysens[k])) for k in range(nsens)]

    # Vectores reutilizables para el bucle temporal (evita asignaciones repetitivas de memoria)
    b = Vector()
    A.init_vector(b, 0)
    b_tmp = Vector()
    A.init_vector(b_tmp, 0)

    print(f"✅ [Optimizador] Preparación completada en {time.time() - t_opt_init:.2f}s. Iniciando bucle temporal acelerado...")

    def _vec_finite(vec):
        arr = vec.get_local()
        return arr.size == 0 or np.all(np.isfinite(arr))

    # Iteration over each source secuentially
    for sous_j in range(nsous):
        # Obtain boundary layer and spatial force
        bdry_id = int(21 + sous_j)
        b_spatial_s = B_spatial_list[sous_j]
        
        # Create functions for variational form definition
        # initialized all as 0.0
        u_sol = Function(V)
        # previous time solutions
        u_n, v_n, a_n = Function(V), Function(V), Function(V)

        # Iterate the experiment over time
        for time_i in range(ntimes):
            # Verificar señal de aborto cada 10 iteraciones
            if time_i % 10 == 0 and check_abort_signal():
                print(f" Simulation {id} ABORTED by user at time step {time_i}/{ntimes}")
                raise RuntimeError(f"Simulation {id} aborted by user")
            
            # Emitir progreso cada 10 pasos
            if time_i % 10 == 0:
                completed_steps = sous_j * ntimes + time_i
                _emit_simulation_progress(id, completed_steps, total_steps_all, sous_j + 1, nsous)

            # Construir RHS mediante multiplicación matriz-vector pre-ensamblada (ultrarrápido)
            M_u.mult(u_n.vector(), b)
            M_v.mult(v_n.vector(), b_tmp)
            b.axpy(1.0, b_tmp)
            M_a.mult(a_n.vector(), b_tmp)
            b.axpy(1.0, b_tmp)

            # Sumar la fuerza de la fuente escalada por la señal temporal
            s_t = float(source_temporal[time_i])
            if abs(s_t) > 1e-15:
                b.axpy(s_t, b_spatial_s)

            # Aplicar condiciones de contorno tipo Dirichlet al RHS
            for bc in bcs:
                bc.apply(b)

            # Resolver sistema lineal con la factorización LU pre-calculada
            if _lu_solver is not None:
                _lu_solver.solve(u_sol.vector(), b)
            elif _ksp_solver is not None:
                _ksp_solver.solve(u_sol.vector(), b)
            else:
                solve(A, u_sol.vector(), b)

            # Verificación de estabilidad numérica
            if time_i % 50 == 0:
                if not _vec_finite(u_sol.vector()):
                    raise RuntimeError(
                        f"Sistema lineal sin solución finita (time_i={time_i}, time={times[time_i]:.6f}, source={sous_j})."
                    )

            # Update fields u, v, a
            update(u_sol, u_n, v_n, a_n, beta, gamma, dt)

            # Compute data at the sensors and save it as array
            for sens_k in range(nsens):
                u_val = u_sol(sensor_points[sens_k])
                sol_sensors_z[sens_k, time_i, sous_j] = u_val[0]
                sol_sensors_y[sens_k, time_i, sous_j] = u_val[1]

            if sous_j == 0 and time_i % 20 == 0:
                time_curr = float(times[time_i])
                print("Value at sensor: {0}, with Time: {1} ".format(
                    sol_sensors_y[-1, time_i, 0], time_curr))

    #tiempo_final_9 = time()
    #tiempo_ejecucion_9 = tiempo_final_9 - tiempo_inicio_9
    #print("Tiempo ejecución 9:", tiempo_ejecucion_9)

    #tiempo_inicio_10 = time()
    # create dictionary with variables to save
    savedic = {
        # Datos de simulación (originales)
        'zlim': zlim, 'ylim': ylim, 'nsous': nsous,
        'zsous': zsous, 'ysous': ysous, 'nsens': nsens,
        'zsens': zsens, 'ysens': ysens, 'ntimes': ntimes,
        'times': times,
        'sol_sensors_z': sol_sensors_z, 'sol_sensors_y': sol_sensors_y,
        
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
        'simulation_type': 'time_domain',
        'timestamp': str(Hora_inicio)
    }
    filename1 = 'src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/Files_mat/TimeSimP'+str(por+1)+'TransIsoW'+ str(ylim)+'M'+str(size) + id + '.mat'
    filename = 'TimeSimP'+str(por+1)+'TransIsoW'+ str(ylim)+'M'+str(size) + id + '.mat'
    sio.savemat(filename1, savedic, appendmat=True)
    ## Zona de Pruebas de tiempo ##
    Hora_final = datetime.now()
    print(Hora_final)
    tiempo_ejecucion = Hora_final - Hora_inicio
    #tiempo_ejecucion.strftime('%H:%M %p')
    print("Simulacion finalizada: Tiempo de ejecución", tiempo_ejecucion)
    #Save file into database
    return filename, tiempo_ejecucion
