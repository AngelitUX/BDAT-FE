# 📘 Guía de Implementación para el Simulador Antiguo: Importación de Mallas Fijas (.msh / .xml)

> **Instrucción para la Inteligencia Artificial / Desarrollador:**  
> Este documento contiene las instrucciones precisas para implementar la función de **"Importar Malla Externa"** en el repositorio del **Simulador Antiguo (Legacy)**.  
> ⚠️ **REGLA FUNDAMENTAL:** **NO modifiques los solvers numéricos, ni las rutinas de resolución temporal/frecuencial, ni los tiempos de cómputo originales del simulador antiguo.** El simulador antiguo debe seguir funcionando exactamente como siempre funcionó (con sus algoritmos originales, tiempos de 2h a 9h, etc.). La única novedad es que ahora se le podrá suministrar una malla externa precalculada para correr pruebas sobre la misma geometría que el simulador nuevo y comparar ambos resultados con la métrica **RMSD**.

---

## 🎯 Objetivo
Permitir que el simulador antiguo pueda recibir un archivo de malla preexistente (`.msh` de Gmsh o `.xml` de DOLFIN/FEniCS) descargado desde una simulación, registrar una nueva simulación asociada a esa malla fija con sus parámetros físicos (porosidad, rugosidad, ángulo de inclinación, sensores), y ejecutar el solver original **directamente sobre dicha malla sin invocar a Gmsh**.

---

## 🛠️ Paso 1: Backend - Endpoint y Servicio de Importación de Malla

### 1.1. Modificar Validación de Datos (`backend/src/features/simulations/services/simulations_service.py`)
En la función `ValidData`, añade `"imported"` como un valor permitido para `mesh_type`:

```python
# Buscar:
elif(mesh_type not in ["gmsh", "mshr"]):
    return False, "mesh_type", f"invalid value: {mesh_type} (must be 'gmsh' or 'mshr')"

# Reemplazar por:
elif(mesh_type not in ["gmsh", "mshr", "imported"]):
    return False, "mesh_type", f"invalid value: {mesh_type} (must be 'gmsh', 'mshr', or 'imported')"
```

---

### 1.2. Proteger la Malla Importada y Permitir Renombrar Simulaciones Finalizadas (`update_simulation_service`)
En `update_simulation_service`:
1. **Verificación de edición:** Si la simulación está `Finished`, o si el cliente solo envió el nombre (sin parámetros como `n_transmitter`), **solo se debe actualizar el nombre** sin intentar convertir campos nulos ni reiniciar el estado a `"Not started"`.
2. **Conservar malla importada:** Si es una edición completa de una simulación `Not started` con `mesh_type == 'imported'`, no poner `xml_file = NULL`.

```python
# En update_simulation_service:
sim_name = data.get('sim_name')
if not sim_name:
    cur.execute("SELECT sim_name FROM simulation WHERE id = %s", (sim_id,))
    _row = cur.fetchone()
    sim_name = _row[0] if _row else "Simulacion"

# Solo permitir edición completa si NO está finalizada y se enviaron parámetros numéricos:
can_edit_all = (
    current_status in {'Not started', 'Draft', 'Error', 'Aborted'}
    and data.get('n_transmitter') is not None
)

if can_edit_all:
    # Bloque de edición completa...
    if mesh_type == 'imported':
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
                roughness = %s
            WHERE id = %s
        """
        # ...
    else:
        # Update original que pone xml_file = NULL, msh_file = NULL
        # ...
else:
    # Solo actualizar nombre (para Finished u otras)
    update_query = "UPDATE simulation SET sim_name = %s WHERE id = %s"
    cur.execute(update_query, (sim_name, sim_id))
```

---

### 1.3. Omitir Regeneración en `generate_mesh_and_save`
En `simulations_service.py`, al inicio de `generate_mesh_and_save`:

```python
mesh_type = row_dict.get('mesh_type', 'gmsh')

if mesh_type == 'imported':
    xml_file = row_dict.get('xml_file')
    msh_file = row_dict.get('msh_file')
    if xml_file and os.path.exists(xml_file):
        print(f"✅ [generate_mesh_and_save] Simulación {sim_id} usa malla fija importada: {xml_file}")
        return xml_file, msh_file
```

---

### 1.4. Crear la Función del Servicio: `import_mesh_simulation_service`
Agrega la siguiente función en `simulations_service.py`:

```python
def import_mesh_simulation_service(request):
    """
    Importa un archivo de malla (.msh o .xml), crea el registro en MySQL
    con mesh_type='imported' y guarda los archivos físicos en disco.
    """
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': 'No se subió ningún archivo de malla'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'No se seleccionó ningún archivo'}), 400

        filename = file.filename
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ('.msh', '.xml'):
            return jsonify({'status': 'error', 'message': 'Formato no soportado. Debe ser .msh o .xml'}), 400

        form_data = request.form

        raw_name = form_data.get('sim_name', '').strip()
        sim_name = raw_name if raw_name else f"Sim_Malla_{os.path.splitext(filename)[0]}"
        n_transmitter = int(form_data.get('n_transmitter', 5))
        n_receiver = int(form_data.get('n_receiver', 24))
        emitters_pitch = float(form_data.get('emitters_pitch', 1.0))
        receivers_pitch = float(form_data.get('receivers_pitch', 0.4))
        sensor_distance = float(form_data.get('sensor_distance', 20.0))
        sensor_edge_margin = float(form_data.get('sensor_edge_margin', 10.0))
        typical_mesh_size = float(form_data.get('typical_mesh_size', 0.1))
        porosity = int(float(form_data.get('porosity', 10)))
        attenuation = int(form_data.get('attenuation', 0))
        roughness = float(form_data.get('roughness', 0.0))
        mesh_angle = float(form_data.get('mesh_angle', 0.0))
        mesh_angle_direction = str(form_data.get('mesh_angle_direction', 'none'))
        if mesh_angle == 0:
            mesh_angle_direction = 'none'
        skin_layer_config = str(form_data.get('skin_layer_config', 'none'))
        skin_thickness_top = float(form_data.get('skin_thickness_top', 1.3))
        skin_thickness_bottom = float(form_data.get('skin_thickness_bottom', 1.3))

        import tempfile
        import shutil
        import meshio
        import numpy as np

        temp_dir = tempfile.mkdtemp()
        temp_input_path = os.path.join(temp_dir, filename)
        file.save(temp_input_path)

        temp_xml_path = os.path.join(temp_dir, "temp_mesh.xml")
        temp_msh_path = os.path.join(temp_dir, "temp_mesh.msh")
        mesh_obj = None

        if ext == '.msh':
            mesh_obj = meshio.read(temp_input_path)
            # Limpieza crítica: eliminar nodos huérfanos de contorno que causan matrices singulares
            if 'triangle' in mesh_obj.cells_dict:
                triangles = mesh_obj.cells_dict['triangle']
                all_points = mesh_obj.points
                if all_points.shape[1] == 3:
                    all_points = all_points[:, :2]
                used_indices = np.unique(triangles.flatten())
                index_map = np.full(all_points.shape[0], -1, dtype=np.intp)
                index_map[used_indices] = np.arange(len(used_indices), dtype=np.intp)
                filtered_points = all_points[used_indices]
                remapped_triangles = index_map[triangles]
                mesh_obj.points = filtered_points
                mesh_obj.cells = [meshio.CellBlock("triangle", remapped_triangles)]
            elif mesh_obj.points.shape[1] == 3:
                mesh_obj.points = mesh_obj.points[:, :2]

            meshio.write(temp_xml_path, mesh_obj, file_format="dolfin-xml")
            shutil.copy2(temp_input_path, temp_msh_path)

        elif ext == '.xml':
            shutil.copy2(temp_input_path, temp_xml_path)
            try:
                mesh_obj = meshio.read(temp_input_path)
                meshio.write(temp_msh_path, mesh_obj, file_format="gmsh22")
            except Exception as e:
                print(f"Aviso: no se pudo convertir XML a MSH para visor 3D: {e}")
                mesh_obj = None

        # Obtener dimensiones físicas de la placa desde los nodos
        try:
            if mesh_obj is not None and hasattr(mesh_obj, 'points') and len(mesh_obj.points) > 0:
                pts = mesh_obj.points
                plate_length = round(float(np.ptp(pts[:, 0])), 3)
                plate_thickness = round(float(np.ptp(pts[:, 1])), 3)
            else:
                plate_length = sensor_edge_margin * 2 + max(0, (n_transmitter - 1) * emitters_pitch) + sensor_distance + max(0, (n_receiver - 1) * receivers_pitch)
                plate_thickness = float(form_data.get('plate_thickness', 4.0))
        except Exception:
            plate_length = sensor_edge_margin * 2 + max(0, (n_transmitter - 1) * emitters_pitch) + sensor_distance + max(0, (n_receiver - 1) * receivers_pitch)
            plate_thickness = float(form_data.get('plate_thickness', 4.0))

        if form_data.get('plate_length') and float(form_data.get('plate_length')) > 0:
            plate_length = float(form_data.get('plate_length'))
        if form_data.get('plate_thickness') and float(form_data.get('plate_thickness')) > 0:
            plate_thickness = float(form_data.get('plate_thickness'))

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
            'porosity': porosity,
            'attenuation': attenuation,
            'p_status': "Not started",
            'mesh_type': 'imported',
            'skin_layer_config': skin_layer_config,
            'skin_thickness_top': skin_thickness_top,
            'skin_thickness_bottom': skin_thickness_bottom,
            'mesh_angle': mesh_angle,
            'mesh_angle_direction': mesh_angle_direction,
            'roughness': roughness,
            'xml_file': None,
            'msh_file': None
        }

        doc = insert_simulation(current_app.mysql, sim_data)
        sim_id = doc[0]

        # Guardar archivos finales en la carpeta de la simulación
        sim_mesh_dir = get_mesh_dir(sim_id)
        final_xml_path = os.path.abspath(os.path.join(sim_mesh_dir, f"mesh_{sim_id}.xml"))
        final_msh_path = os.path.abspath(os.path.join(sim_mesh_dir, f"mesh_{sim_id}.msh"))

        shutil.copy2(temp_xml_path, final_xml_path)
        if os.path.exists(temp_msh_path):
            shutil.copy2(temp_msh_path, final_msh_path)
            saved_msh = final_msh_path
        else:
            saved_msh = None

        shutil.rmtree(temp_dir, ignore_errors=True)

        cur = current_app.mysql.connection.cursor()
        cur.execute("""
            UPDATE simulation 
            SET xml_file = %s, msh_file = %s 
            WHERE id = %s
        """, (final_xml_path, saved_msh, sim_id))
        current_app.mysql.connection.commit()

        cur.execute("SELECT * FROM simulation WHERE id = %s", (sim_id,))
        columns = [col[0] for col in cur.description]
        row = cur.fetchone()
        cur.close()

        from decimal import Decimal
        from datetime import datetime, date, timedelta
        row_dict = dict(zip(columns, row))
        for key, value in row_dict.items():
            if isinstance(value, Decimal):
                row_dict[key] = float(value)
            elif isinstance(value, (datetime, date)):
                row_dict[key] = value.isoformat() if value else None
            elif isinstance(value, timedelta):
                row_dict[key] = value.total_seconds() if value else None
            elif isinstance(value, bytes):
                row_dict[key] = None

        current_app.socketio.emit('nueva_simulacion', row_dict)
        notificar_estado_simulacion(sim_id, "Not started")

        return jsonify({
            'status': 'success',
            'message': f'Malla importada correctamente para simulación {sim_id}',
            'simulation': row_dict
        }), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500
```

---

### 1.5. Registrar la Ruta en el Controlador (`backend/src/features/simulations/controllers/simulations_controller.py`)
Agrega la siguiente ruta:

```python
@simulations_bp.route('/simulations/import-mesh', methods=['POST'])
def import_mesh():
    """Import an existing mesh file (.msh or .xml) and create a simulation with it."""
    from ..services.simulations_service import import_mesh_simulation_service
    return import_mesh_simulation_service(request)
```

---

### 1.6. Carga de Malla en los Solvers de FEniCS
⚠️ **ATENCIÓN CRÍTICA PARA LA IA / DESARROLLADOR:**  
En `TimeSimTransIsoMatCij2D_test.py`, hay un bloque antiguo comentado con `#` cerca de la línea 98. **NO toques las líneas comentadas.**  
Debes ir a la línea activa de código (alrededor de la **línea 113**) donde se evalúa `if mesh_type == "gmsh":`:

```python
# 1. En TimeSimTransIsoMatCij2D_test.py (línea ~113 activa):
# BUSCAR:
    if mesh_type == "gmsh":
        print(" Cargando mesh desde archivo XML (generado con gmsh)...")
        _mesh_in = Mesh(xml_file)

# REEMPLAZAR POR:
    if mesh_type in ("gmsh", "imported"):
        print(" Cargando mesh desde archivo XML (generado con gmsh o importado)...")
        _mesh_in = Mesh(xml_file)
```
*(Si no haces este cambio exacto, el solver no reconocerá `'imported'` y caerá en el bloque `else`, generando una malla con MSHR).*

```python
# 2. En SimFreqDomain2D.py (línea ~250):
# BUSCAR:
    elif mesh_type == "gmsh":
        print("🔧 Cargando mesh desde archivo XML (generado con gmsh)...")
        mesh = Mesh(xml_file)

# REEMPLAZAR POR:
    elif mesh_type in ("gmsh", "imported"):
        print("🔧 Cargando mesh desde archivo XML (generado con gmsh o importado)...")
        mesh = Mesh(xml_file)
```

```python
# 3. En la tarea de Celery (backend/src/features/simulations/tasks/simulation_tasks.py, línea ~96):
# BUSCAR:
            if not xml_exists:
                print(f"⚡ [Celery Worker] Malla no encontrada...")

# REEMPLAZAR POR:
            if not xml_exists:
                if mesh_type == 'imported':
                    raise FileNotFoundError(f"Archivo de malla XML no encontrado para simulación con malla fija {sim_id}: {xml_file}")
                print(f"⚡ [Celery Worker] Malla no encontrada...")
```

---

## 💻 Paso 2: Frontend - Servicio, Modal y Corrección de Visualización

### 2.1. Añadir Endpoint en `frontend/src/features/simulations/simulationService.js`
En `endpoints`:
```javascript
IMPORT_MESH: `${this.baseURL}/simulations/import-mesh`,
```
Y el método correspondiente:
```javascript
async importMesh(formData) {
  try {
    const response = await fetch(this.endpoints.IMPORT_MESH, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('❌ Error al importar malla:', error);
    throw error;
  }
}
```

---

### 2.2. Corrección Visual en la Tabla (`frontend/src/features/simulations/Table.jsx`)
⚠️ **Evitar que las mallas importadas muestren falsamente el logo `mshr`:**  
En `Table.jsx`, buscar la columna de tecnología de malla y agregar la condición explícita para `'imported'`:

```jsx
// Importar Grid3x3 de 'lucide-react'
import { ..., Grid3x3 } from 'lucide-react';

// En la columna de MESH TEC:
<div className="px-2 py-2 flex justify-center text-xs">
  {sim.mesh_type === 'imported' ? (
    <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-1 whitespace-nowrap bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200" title="Malla fija importada (.msh / .xml)">
      <Grid3x3 className="w-3 h-3 text-blue-600" />
      <span className="hidden xl:inline">imported</span>
    </span>
  ) : (sim.mesh_type === 'gmsh' || !sim.mesh_type) ? (
    <span className="text-[10px] text-gray-700 font-medium flex items-center gap-1 whitespace-nowrap" title="Gmsh">
      <img src="/images/gmsh.png" alt="gmsh" className="w-3 h-3 object-contain" />
      <span className="hidden xl:inline">gmsh</span>
    </span>
  ) : (
    <span className="text-[10px] text-gray-700 font-medium flex items-center gap-1 whitespace-nowrap" title="Mshr">
      <img src="/images/mshr.png" alt="mshr" className="w-3 h-3 object-contain" />
      <span className="hidden xl:inline">mshr</span>
    </span>
  )}
</div>
```

---

### 2.3. Corrección en el Modal de Edición (`frontend/src/features/simulations/SimulationModal.jsx`)
1. **Validación:** Permitir `imported`:
```javascript
if (formData.mesh_type !== 'gmsh' && formData.mesh_type !== 'mshr' && formData.mesh_type !== 'imported') {
    toast.warning('Please select a valid Mesh Type (gmsh, mshr, or imported).');
    return;
}
```
2. **Selector de Malla:** Si `formData.mesh_type === 'imported'`, mostrar la insignia azul de malla fija en lugar de botones de Gmsh/Mshr:
```jsx
{formData.mesh_type === 'imported' ? (
    <div className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 border-blue-400 bg-blue-50 text-blue-800 shadow-sm flex items-center justify-center gap-2">
        <Grid3x3 className="w-4 h-4 text-blue-600" />
        <div className="text-left flex flex-col justify-center">
            <div className="font-semibold leading-none mb-0.5 text-[11px]">IMPORTED</div>
            <div className="text-[9px] opacity-70 leading-none text-blue-600">Fixed Mesh (.msh / .xml)</div>
        </div>
    </div>
) : (
    // Botones normales de GMSH y MSHR
)}
```

---

### 2.4. Componente `frontend/src/features/simulations/components/ImportMeshModal.jsx`
Copiar `ImportMeshModal.jsx` directamente del nuevo simulador (este archivo contiene la interfaz con drag & drop y los campos de rugosidad, ángulo de inclinación, porosidad, etc.).

---

### 2.5. Conectar en `SimulationControlBar.jsx` y `Simulations.jsx`
1. Agregar botón "Import Mesh" en `SimulationControlBar.jsx`.
2. Conectar el estado del modal en `Simulations.jsx`.
