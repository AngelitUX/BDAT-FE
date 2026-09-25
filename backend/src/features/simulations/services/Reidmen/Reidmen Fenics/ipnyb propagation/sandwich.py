#!/usr/bin/env python
# coding: utf-8

# ## Simulación Multicapa (Sandwich) con FEniCS
# ## Estructura: Piel Inferior + Núcleo (Hueso Cortical) + Piel Superior

from dolfin import *
import scipy.io as sio
import numpy as np
from datetime import datetime
import time
import os
import tempfile
from dolfin import Constant # Asegúrate de que Constant esté importado
from ufl import indices, as_tensor

def fmain(n_transmitter, n_receiver, distance, emitter_pitch, receiver_pitch, 
          sensor_edge_margin, typical_mesh_size, core_thickness, skin_thickness, 
          porosity, attenuation, id, mesh_type, xml_file, total_height):
    """
    Función principal de simulación multicapa con capas de piel.
    
    Args:
        core_thickness: Grosor del núcleo (hueso cortical) [mm]
        skin_thickness: Grosor de cada capa de piel [mm]
        total_height: Altura total del dominio (retornado por create_sandwich_mesh_gradual)
    """
    
    print('=== SIMULACIÓN MULTICAPA (SANDWICH) ===')
    print(f'Parámetros: n_tx={n_transmitter}, n_rx={n_receiver}, dist={distance}')
    print(f'Geometría: core={core_thickness}mm, skin={skin_thickness}mm, total_height={total_height}mm')
    print(f'Mesh: {mesh_type}, xml_file={xml_file}')
    
    # Función para verificar señal de aborto
    def check_abort_signal():
        signal_dir = '/app/temp_signals' if os.path.exists('/app') else tempfile.gettempdir()
        abort_signal_file = os.path.join(signal_dir, f'abort_sim_{id}.signal')
        if os.path.exists(abort_signal_file):
            print(f"⚠️  ABORT SIGNAL DETECTED for simulation {id}")
            try:
                os.remove(abort_signal_file)
                print(f"✅ Abort signal file removed")
            except Exception as e:
                print(f"❌ Could not remove abort signal file: {e}")
            return True
        return False
    
    # Desbloquear todos los núcleos de CPU para OpenMP y BLAS
    for _env_th in ['OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS']:
        if os.environ.get(_env_th) in ('0', '1'):
            try:
                del os.environ[_env_th]
            except Exception:
                pass
    Hora_inicio = datetime.now()
    tiempo_inicio = time.time()
    
    # Calcular dimensiones del dominio
    zlim = (2*sensor_edge_margin) + ((n_transmitter-1)*emitter_pitch) + distance + ((n_receiver-1)*receiver_pitch)
    
    # --- PROPIEDADES DE MATERIALES ---
    
    # 1. Material de Piel (Tejido blando - Aluminio como aproximación)
    E_skin = 0.3  # [GPa] - Módulo de Young del tejido blando
    nu_skin = 0.48  # Coeficiente de Poisson (casi incompresible)
    rho_skin = 0.0011  # [g/mm^3] = 1.1 g/cm^3
    
    # Conversión a unidades consistentes [GPa * 1e-3]
    mu_skin = E_skin / (2 * (1 + nu_skin)) * 1E-3
    lmbda_skin = (E_skin * nu_skin) / ((1 + nu_skin) * (1 - 2 * nu_skin)) * 1E-3
    
    # Matriz de Voigt para material isotrópico (piel)
    C_voigt_skin = np.array([
        [lmbda_skin + 2*mu_skin, lmbda_skin, 0],
        [lmbda_skin, lmbda_skin + 2*mu_skin, 0],
        [0, 0, mu_skin]
    ])
    
    print(f"📊 Propiedades de Piel: E={E_skin} GPa, ν={nu_skin}, ρ={rho_skin} g/mm³")
    
    # 2. Material del Núcleo (Hueso Cortical - Datos de Mathilde)
    C_mathilde = sio.loadmat(r"src/features/simulations/services/Reidmen/Reidmen Fenics/ipnyb propagation/Files_mat/C_values_mathilde.mat")
    
    C11 = np.reshape(C_mathilde['C11'], (30,))*1E-3
    C12 = np.reshape(C_mathilde['C12'], (30,))*1E-3
    C13 = np.reshape(C_mathilde['C13'], (30,))*1E-3
    C33 = np.reshape(C_mathilde['C33'], (30,))*1E-3
    C55 = np.reshape(C_mathilde['C55'], (30,))*1E-3
    C66 = np.reshape(C_mathilde['C66'], (30,))*1E-3
    d = np.reshape(C_mathilde['d'], (30,))*1E-3
    
    por = int(porosity) - 1
    rho_core = d[por]
    
    # Matriz de Voigt para material transverso isotrópico (hueso)
    C_voigt_core = np.array([
        [C33[por], C13[por], 0],
        [C13[por], C11[por], 0],
        [0, 0, C55[por]]
    ])
    
    print(f"📊 Propiedades de Núcleo (Hueso): Porosidad={porosity}%, ρ={rho_core} g/mm³")
    
    # --- CARGAR MALLA Y DEFINIR ESPACIOS ---
    
    print(f"\n🔍 DEBUG: Cargando mesh desde: {xml_file}")
    mesh = Mesh(xml_file)
    print(f"✅ Mesh cargado: {mesh.num_cells()} celdas, {mesh.num_vertices()} vértices")
    print(f"   hmin={mesh.hmin():.4f} mm, hmax={mesh.hmax():.4f} mm")
    print(f"🔍 DEBUG: Dimensión geométrica del mesh: {mesh.geometry().dim()}")
    print(f"🔍 DEBUG: Dimensión topológica del mesh: {mesh.topology().dim()}")
    
    # Espacios de funciones
    pdim = 1
    print(f"🔍 DEBUG: Creando VectorFunctionSpace con pdim={pdim}")
    V = VectorFunctionSpace(mesh, 'CG', pdim)
    print(f"🔍 DEBUG: VectorFunctionSpace creado, dim={V.dim()}")
    print(f"🔍 DEBUG: Dimensión del valor de V: {V.ufl_element().value_size()}")
    u = TrialFunction(V)
    w = TestFunction(V)
    
    # Cargar subdominios de materiales (Physical Groups de gmsh)
    materials_file = xml_file.replace(".xml", "_physical_region.xml")
    if not os.path.exists(materials_file):
        print(f"⚠️  Advertencia: No se encontró archivo de materiales: {materials_file}")
        print(f"   Asumiendo material homogéneo (núcleo)")
        materials = MeshFunction("size_t", mesh, mesh.topology().dim())
        materials.set_all(2)  # Todo es núcleo
    else:
        materials = MeshFunction("size_t", mesh, materials_file)
        print(f"✅ Materiales cargados desde: {materials_file}")
    
    dx = Measure('dx', domain=mesh, subdomain_data=materials)
    
    # --- FUNCIONES DE TENSOR DE RIGIDEZ ---
    

    def VoigtToTensor(A_voigt):
        """
        Convierte matriz Voigt 3x3 a tensor 4to orden para FEniCS 2D.
        Retorna directamente la matriz de Voigt para usar con contracción manual.
        """
        # Simplemente retornar la matriz de Voigt como constantes
        # La usaremos directamente en las funciones sigma
        return {
            'C11': Constant(float(A_voigt[0,0])),
            'C13': Constant(float(A_voigt[0,1])),
            'C33': Constant(float(A_voigt[1,1])),
            'C55': Constant(float(A_voigt[2,2]))
        }
    
    def epsilon(u):
        """Tensor de deformación simétrico"""
        i, j = indices(2)
        return as_tensor(0.5*(u[i].dx(j) + u[j].dx(i)), (i, j))
    
    # Constantes de rigidez
    C_core = VoigtToTensor(C_voigt_core)
    C_skin = VoigtToTensor(C_voigt_skin)
    
    def sigma_core(u):
        """Tensor de esfuerzos para el núcleo (transverso isotrópico)"""
        eps = epsilon(u)
        # sigma_zz = C11*eps_zz + C13*eps_yy
        # sigma_yy = C13*eps_zz + C33*eps_yy  
        # sigma_zy = 2*C55*eps_zy
        return as_matrix([
            [C_core['C11']*eps[0,0] + C_core['C13']*eps[1,1], C_core['C55']*eps[0,1]],
            [C_core['C55']*eps[1,0], C_core['C13']*eps[0,0] + C_core['C33']*eps[1,1]]
        ])
    
    def sigma_skin(u):
        """Tensor de esfuerzos para la piel (isotrópico)"""
        eps = epsilon(u)
        # Para isotrópico: C11=C33, C13=lambda, C55=mu
        return as_matrix([
            [C_skin['C11']*eps[0,0] + C_skin['C13']*eps[1,1], C_skin['C55']*eps[0,1]],
            [C_skin['C55']*eps[1,0], C_skin['C13']*eps[0,0] + C_skin['C33']*eps[1,1]]
        ])
    
    # --- FUNCIÓN DE DENSIDAD ESPACIALMENTE VARIABLE ---
    
    class Density(UserExpression):
        def __init__(self, materials, rho_s, rho_c, **kwargs):
            super().__init__(**kwargs)
            self.materials = materials
            self.rho_s = rho_s
            self.rho_c = rho_c
        
        def eval_cell(self, values, x, cell):
            mat_id = self.materials[cell.index]
            # ID 2 = Núcleo, ID 1 y 3 = Piel
            values[0] = self.rho_c if mat_id == 2 else self.rho_s
        
        def value_shape(self):
            return ()
    
    V0 = FunctionSpace(mesh, 'DG', 0)
    rho_expr = Density(materials, rho_skin, rho_core, degree=0)
    rho_func = interpolate(rho_expr, V0)
    
    print(f"✅ Función de densidad creada (piel={rho_skin}, núcleo={rho_core})")
    
    # --- DEFINICIÓN DE FORMAS VARIACIONALES ---
    
    beta, gamma = 0.36, 0.7
    times = np.arange(0, 51.2, step=1./20)
    dt = times[1] - times[0]
    ntimes = times.shape[0]
    
    def o_block(u, w, dt):
        """Bloque de masa con densidad variable"""
        factor_1 = rho_func/(beta*dt*dt)
        return inner(factor_1*u, w)*dx
    
    def A_block(u, w):
        """Bloque de rigidez multicapa"""
        # Integración por subdominio
        term_skin = inner(sigma_skin(u), grad(w))*dx(1) + inner(sigma_skin(u), grad(w))*dx(3)
        term_core = inner(sigma_core(u), grad(w))*dx(2)
        return term_skin + term_core
    
    def b_block(u, u_n, v_n, a_n, w, beta, gamma, dt):
        """Bloque RHS (Newmark)"""
        factor_1 = rho_func/(beta*dt*dt)
        factor_2 = rho_func/(beta*dt)
        factor_3 = rho_func*(1.0-2.0*beta)/(2.0*beta)
        return factor_1*inner(u_n, w)*dx + factor_2*inner(v_n, w)*dx + factor_3*inner(a_n, w)*dx
    
    # --- FUNCIÓN DE ACTUALIZACIÓN (NEWMARK) ---
    
    def update(u, u_n, v_n, a_n, beta, gamma, dt):
        u_vec, u_nvec = u.vector(), u_n.vector()
        v_nvec, a_nvec = v_n.vector(), a_n.vector()
        
        a_vec = (1.0/(beta*pow(dt,2)))*(u_vec-u_nvec-dt*v_nvec) - ((1-2*beta)/(2*beta))*a_nvec
        v_vec = v_nvec + dt*((1-gamma)*a_nvec+gamma*a_vec)
        
        v_n.vector()[:] = v_vec
        a_n.vector()[:] = a_vec
        u_n.vector()[:] = u.vector()
    
    # --- POSICIONES DE SENSORES Y FUENTES ---
    
    nsous = n_transmitter
    zsous = np.linspace(sensor_edge_margin, sensor_edge_margin + ((n_transmitter-1) * emitter_pitch), num=n_transmitter)
    ysous = nsous * [total_height,]  # En la superficie superior
    
    nsens = n_receiver
    zsens = np.linspace(
        sensor_edge_margin + (n_transmitter-1)*emitter_pitch + distance,
        sensor_edge_margin + (n_transmitter-1)*emitter_pitch + distance + (n_receiver-1)*receiver_pitch,
        num=nsens
    )
    # IMPORTANTE: evaluar ligeramente por debajo del borde superior para evitar NaN.
    # FEniCS devuelve NaN cuando el punto de evaluación cae exactamente sobre
    # el borde de la malla o fuera del dominio. Con mesh_size pequeño (ej: 0.1),
    # eps del 1% (0.001) puede ser menor que la celda mínima real.
    # Solución: usar mesh.hmin() como referencia.
    hmin = mesh.hmin()
    eps_boundary = max(typical_mesh_size * 0.1, hmin * 0.5)
    ysens = nsens * [total_height - eps_boundary,]  # Ligeramente dentro del dominio
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
            zs = max(x_min_mesh + eps_boundary, min(x_max_mesh - eps_boundary, zs))
            ys = max(y_min_mesh + eps_boundary, min(y_max_mesh - eps_boundary, ys))
            zsens[k] = zs
            ysens[k] = ys
            print(f"            Corregido a ({zs:.4f}, {ys:.4f})")
    
    print(f"📍 Posiciones de sensores:")
    print(f"   Transmisores: {zsous}")
    print(f"   Receptores: primer={zsens[0]:.2f}, último={zsens[-1]:.2f}")
    
    # --- CONDICIONES DE BORDE ---
    
    boundaries = MeshFunction("size_t", mesh, mesh.topology().dim()-1)
    boundaries.set_all(0)
    
    # Marcar fuentes dinámicamente
    eps = DOLFIN_EPS
    width = 0.9 * emitter_pitch
    
    class DynamicSource(SubDomain):
        def __init__(self, z_pos, y_pos, width, eps):
            super().__init__()
            self.z = z_pos
            self.y = y_pos
            self.w = width
            self.e = eps
        
        def inside(self, x, on_boundary):
            return (on_boundary and
                    abs(x[0] - self.z) < self.w + self.e and
                    abs(x[1] - self.y) < self.w + self.e)
    
    # Marcar cada fuente
    for i in range(nsous):
        source_dom = DynamicSource(zsous[i], ysous[i], width/2, eps)
        source_dom.mark(boundaries, 21+i)
    
    ds = Measure('ds', domain=mesh, subdomain_data=boundaries)
    
    # Dirichlet BC en borde izquierdo
    print(f"\n🔍 DEBUG: Creando condición de borde Dirichlet")
    print(f"🔍 DEBUG: V.ufl_element().value_size() = {V.ufl_element().value_size()}")
    print(f"🔍 DEBUG: mesh.geometry().dim() = {mesh.geometry().dim()}")
    left_jit = "on_boundary && near(x[0], 0.)"
    bc_value = Constant((0.,0.))
    print(f"🔍 DEBUG: bc_value creado con dimensión 2")
    print(f"🔍 DEBUG: Intentando crear DirichletBC...")
    bc_domain = DirichletBC(V, bc_value, left_jit)
    print(f"✅ DirichletBC creado exitosamente")
    bcs = [bc_domain]

    # --- EXPRESIÓN DE FUENTE ---

    class Source(UserExpression):
        def __init__(self, time, t_0, sig_time, degree=1, **kwargs):
            super().__init__(**kwargs)
            self.time = time
            self.t_0 = t_0
            self.sig_time = sig_time
        
        def eval(self, values, x):
            factor = 1/(2*pow(self.sig_time,2))
            dif_time = self.time - self.t_0
            f0 = 1  # Frecuencia [MHz]
            num = exp(-factor*pow(dif_time,2))*cos(2*pi*dif_time*f0)
            
            values[0] = 0.0   # Dirección horizontal (Z)
            values[1] = -num  # Dirección vertical (Y)
        
        def value_shape(self):
            return (2,)
    
    # --- OPTIMIZACIÓN DE COMPILADOR ---
    
    parameters["form_compiler"]["optimize"] = True
    parameters["form_compiler"]["cpp_optimize"] = True
    parameters["form_compiler"]["representation"] = "uflacs"
    parameters["form_compiler"]["quadrature_degree"] = 2
    
    # --- INICIALIZACIÓN DE ARRAYS DE RESULTADOS ---
    
    sol_sensors_y = np.zeros((nsens, ntimes, nsous))
    sol_sensors_z = np.zeros((nsens, ntimes, nsous))
    
    print(f"\n🚀 [Optimizador] Preparando simulación acelerada (ntimes={ntimes}, nsous={nsous})...")
    t_opt_init = time.time()
    
    # 1. Ensamblar A una sola vez y aplicar condiciones de contorno
    A_lhs = o_block(u, w, dt) + A_block(u, w)
    A = assemble(A_lhs)
    for bc in bcs:
        bc.apply(A)

    # 2. Inicializar solver LU con factorización persistente
    print("⚡ [Optimizador] Factorizando matriz global A (se reutilizará en todos los pasos y fuentes)...")
    _lu_solver = None
    try:
        _lu_solver = LUSolver(A)
        _dummy_b = Vector()
        A.init_vector(_dummy_b, 0)
        _dummy_x = Function(V).vector()
        _lu_solver.solve(_dummy_x, _dummy_b)
        print("   ✅ Solver LU factorizado exitosamente")
    except Exception as _e_lu:
        print(f"   ⚠️ LUSolver fallback: {_e_lu}")
        _lu_solver = None

    # 3. Pre-ensamblar matrices del lado derecho para Newmark
    factor_1 = rho_func/(beta*dt*dt)
    factor_2 = rho_func/(beta*dt)
    factor_3 = rho_func*(1.0-2.0*beta)/(2.0*beta)
    M_u = assemble(factor_1 * inner(u, w) * dx)
    M_v = assemble(factor_2 * inner(u, w) * dx)
    M_a = assemble(factor_3 * inner(u, w) * dx)

    # 4. Pre-ensamblar vectores espaciales de fuentes y señal temporal
    B_spatial_list = [assemble(dot(Constant((0.0, -1.0)), w)*ds(int(21 + s))) for s in range(nsous)]
    t_0 = 5.0
    sig_time = 0.7
    f0 = 1.0
    factor_gauss = 1.0 / (2.0 * (sig_time**2))
    dif_times = times - t_0
    source_temporal = np.exp(-factor_gauss * (dif_times**2)) * np.cos(2.0 * np.pi * dif_times * f0)

    # Pre-crear puntos de sensores
    sensor_points = [Point(float(zsens[k]), float(ysens[k])) for k in range(nsens)]

    # Vectores temporales
    b = Vector()
    A.init_vector(b, 0)
    b_tmp = Vector()
    A.init_vector(b_tmp, 0)
    total_steps_all = ntimes * nsous

    print(f"✅ [Optimizador] Preparación completada en {time.time() - t_opt_init:.2f}s. Iniciando bucle temporal...")

    # --- BUCLE PRINCIPAL DE SIMULACIÓN ---
    for sous_j in range(nsous):
        print(f"\n  📡 Fuente {sous_j+1}/{nsous} en posición z={zsous[sous_j]:.2f} mm")
        b_spatial_s = B_spatial_list[sous_j]
        
        # Inicializar campos
        u_sol = Function(V)
        u_n = Function(V)
        v_n = Function(V)
        a_n = Function(V)
        
        for time_i in range(ntimes):
            # Verificar señal de aborto cada 50 pasos
            if time_i % 50 == 0:
                if check_abort_signal():
                    print(f"\n⚠️  Simulación abortada en tiempo {times[time_i]:.2f} µs")
                    return None, None
                
                progress = (sous_j * ntimes + time_i) / total_steps_all * 100
                print(f"    Progreso: {progress:.1f}% (tiempo={times[time_i]:.2f} µs)", end='\r')
                completed_steps = sous_j * ntimes + time_i
                _emit_simulation_progress(id, completed_steps, total_steps_all, sous_j + 1, nsous)

            # Construir RHS con multiplicación matriz-vector
            M_u.mult(u_n.vector(), b)
            M_v.mult(v_n.vector(), b_tmp)
            b.axpy(1.0, b_tmp)
            M_a.mult(a_n.vector(), b_tmp)
            b.axpy(1.0, b_tmp)

            # Sumar fuente escalada
            s_t = float(source_temporal[time_i])
            if abs(s_t) > 1e-15:
                b.axpy(s_t, b_spatial_s)

            # Aplicar BCs al vector b
            for bc in bcs:
                bc.apply(b)

            # Resolver sistema con factores LU reutilizados
            if _lu_solver is not None:
                _lu_solver.solve(u_sol.vector(), b)
            else:
                solve(A, u_sol.vector(), b)

            # Actualizar campos (Newmark)
            update(u_sol, u_n, v_n, a_n, beta, gamma, dt)

            # Evaluar en sensores
            for sens_i in range(nsens):
                try:
                    u_eval = u_sol(sensor_points[sens_i])
                    sol_sensors_z[sens_i, time_i, sous_j] = u_eval[0]
                    sol_sensors_y[sens_i, time_i, sous_j] = u_eval[1]
                except Exception as e:
                    if time_i == 0:
                        print(f"\n⚠️  Error evaluando sensor {sens_i}: {e}")
                    sol_sensors_z[sens_i, time_i, sous_j] = 0.0
                    sol_sensors_y[sens_i, time_i, sous_j] = 0.0
        
        print(f"\n  ✅ Fuente {sous_j+1} completada")
    
    # --- GUARDAR RESULTADOS ---
    
    tiempo_ejecucion = time.time() - tiempo_inicio
    Hora_fin = datetime.now()
    
    print(f"\n✅ Simulación completada en {tiempo_ejecucion:.2f} segundos")
    print(f"   Inicio: {Hora_inicio}")
    print(f"   Fin: {Hora_fin}")
    
    # Crear nombre de archivo
    filename = f"SandwichSimP{int(porosity)}TransIsoW{float(core_thickness)}S{float(skin_thickness)}M{float(typical_mesh_size)}_{id}"
    
    # Guardar archivo .mat en Files_mat/
    files_mat_dir = os.path.join(os.path.dirname(__file__), "Files_mat")
    if not os.path.exists(files_mat_dir):
        os.makedirs(files_mat_dir, exist_ok=True)
    
    mat_filename = os.path.join(files_mat_dir, f"{filename}.mat")
    
    # Guardar archivo .mat
    results_dict = {
        'sol_sensors_y': sol_sensors_y,
        'sol_sensors_z': sol_sensors_z,
        'times': times,
        'zsens': zsens,
        'ysens': ysens,
        'zsous': zsous,
        'ysous': ysous,
        'nsens': nsens,
        'nsous': nsous,
        'ntimes': ntimes,
        'zlim': zlim,
        'ylim': [0, total_height],
        'core_thickness': float(core_thickness),
        'skin_thickness': float(skin_thickness),
        'total_height': float(total_height),
        'porosity': int(porosity),
        'rho_core': float(rho_core),
        'rho_skin': float(rho_skin),
        'tiempo_ejecucion': float(tiempo_ejecucion)
    }
    
    sio.savemat(mat_filename, results_dict)
    print(f"💾 Resultados guardados en: {mat_filename}")
    
    return filename, tiempo_ejecucion