# Análisis y Diseño UML 2.0 - Sistema BDAT (Parte 1/3)
## Bone Guided Wave Simulation Platform

**Versión:** 1.1.0  
**Fecha:** Enero 2025  
**Notación:** UML 2.0

---

## Tabla de Contenidos

**PARTE 1:**
1. [Requisitos Funcionales](#1-requisitos-funcionales)
2. [Requisitos No Funcionales](#2-requisitos-no-funcionales)
3. [Descripción de Funcionalidades](#3-descripción-de-funcionalidades)

**PARTE 2:**
4. Diagramas de Casos de Uso
5. Especificación Detallada de Casos de Uso

**PARTE 3:**
6. Diagramas de Secuencia del Sistema (DSS)
7. Diagramas de Estado
8. Modelo Conceptual

---

## 1. Requisitos Funcionales

### RF-01: Gestión de Simulaciones
- **RF-01.1:** El sistema debe permitir crear nuevas simulaciones con parámetros configurables
- **RF-01.2:** El sistema debe permitir visualizar simulaciones existentes
- **RF-01.3:** El sistema debe permitir editar parámetros de simulaciones no iniciadas
- **RF-01.4:** El sistema debe permitir duplicar simulaciones existentes
- **RF-01.5:** El sistema debe permitir eliminar simulaciones individuales
- **RF-01.6:** El sistema debe permitir eliminar todas las simulaciones
- **RF-01.7:** El sistema debe permitir eliminar múltiples simulaciones seleccionadas

### RF-02: Ejecución de Simulaciones
- **RF-02.1:** El sistema debe ejecutar simulaciones con el motor FEniCS
- **RF-02.2:** El sistema debe permitir re-ejecutar simulaciones finalizadas o con error
- **RF-02.3:** El sistema debe permitir abortar simulaciones en ejecución
- **RF-02.4:** El sistema debe generar archivos de resultados en formato MATLAB (.mat)

### RF-03: Sistema de Cola de Simulaciones
- **RF-03.1:** El sistema debe encolar automáticamente simulaciones cuando se ejecutan
- **RF-03.2:** El sistema debe permitir reordenar simulaciones en cola manualmente
- **RF-03.3:** El sistema debe permitir desencolar simulaciones
- **RF-03.4:** El sistema debe mostrar el estado de la cola en tiempo real
- **RF-03.5:** El sistema debe procesar simulaciones en cola secuencialmente

### RF-04: Generación y Visualización de Mallas
- **RF-04.1:** El sistema debe generar mallas computacionales con GMSH
- **RF-04.2:** El sistema debe soportar mallas monocapa (solo hueso cortical)
- **RF-04.3:** El sistema debe soportar mallas multicapa (piel + hueso + piel)
- **RF-04.4:** El sistema debe almacenar archivos de malla (XML y MSH)
- **RF-04.5:** El sistema debe visualizar mallas en 3D interactivo
- **RF-04.6:** El sistema debe mostrar posiciones de sensores en la visualización

### RF-05: Procesamiento de Resultados
- **RF-05.1:** El sistema debe procesar archivos .mat con datos de simulación
- **RF-05.2:** El sistema debe calcular señales espacio-temporales
- **RF-05.3:** El sistema debe calcular valores singulares (SVD)
- **RF-05.4:** El sistema debe calcular espectro de ondas guiadas (dominio f-k)
- **RF-05.5:** El sistema debe generar visualizaciones interactivas de resultados

### RF-06: Descarga de Archivos
- **RF-06.1:** El sistema debe permitir descargar archivos de resultados (.mat)
- **RF-06.2:** El sistema debe permitir descargar archivos de malla (XML/MSH)
- **RF-06.3:** Los archivos descargados deben usar el nombre de la simulación

### RF-07: Búsqueda y Filtrado
- **RF-07.1:** El sistema debe permitir búsqueda por nombre, ID o código
- **RF-07.2:** El sistema debe filtrar por estado (Not started, Running, Finished, Error)
- **RF-07.3:** El sistema debe filtrar por tipo de atenuación (0 o 1)
- **RF-07.4:** El sistema debe filtrar por tipo de malla (GMSH)
- **RF-07.5:** El sistema debe filtrar por configuración de tejido (simple/multilayer)
- **RF-07.6:** El sistema debe filtrar por rango de porosidad (1-30%)
- **RF-07.7:** El sistema debe filtrar por rango de fechas

### RF-08: Comunicación en Tiempo Real
- **RF-08.1:** El sistema debe notificar cambios de estado de simulaciones
- **RF-08.2:** El sistema debe notificar nuevas simulaciones creadas
- **RF-08.3:** El sistema debe notificar cuando las mallas están listas
- **RF-08.4:** El sistema debe notificar errores en generación de mallas
- **RF-08.5:** El sistema debe emitir notificaciones sonoras al finalizar simulaciones

### RF-09: Estadísticas y Monitoreo
- **RF-09.1:** El sistema debe mostrar total de simulaciones
- **RF-09.2:** El sistema debe mostrar simulaciones finalizadas
- **RF-09.3:** El sistema debe mostrar simulaciones no iniciadas
- **RF-09.4:** El sistema debe mostrar simulaciones en ejecución
- **RF-09.5:** El sistema debe mostrar simulaciones en cola
- **RF-09.6:** El sistema debe destacar simulaciones activas

### RF-10: Validación de Datos
- **RF-10.1:** El sistema debe validar parámetros numéricos de simulación
- **RF-10.2:** El sistema debe validar rangos permitidos (porosidad 1-30%)
- **RF-10.3:** El sistema debe validar campos requeridos
- **RF-10.4:** El sistema debe calcular automáticamente plate_length

**Total Requisitos Funcionales:** 54

---

## 2. Requisitos No Funcionales

### RNF-01: Rendimiento
- **RNF-01.1:** El sistema debe cargar la lista de simulaciones en menos de 2 segundos
- **RNF-01.2:** Las actualizaciones en tiempo real deben tener latencia menor a 500ms
- **RNF-01.3:** La visualización de mallas debe renderizar en menos de 3 segundos
- **RNF-01.4:** El procesamiento de resultados debe completarse en menos de 10 segundos
- **RNF-01.5:** El sistema debe soportar al menos 100 simulaciones concurrentes en la base de datos
- **RNF-01.6:** El sistema debe permitir paginación dinámica para manejo eficiente de grandes conjuntos de datos
- **RNF-01.7:** Las consultas a la base de datos deben ejecutarse en menos de 1 segundo

### RNF-02: Escalabilidad
- **RNF-02.1:** El sistema debe escalar horizontalmente mediante contenedores Docker
- **RNF-02.2:** El sistema debe soportar múltiples workers para procesamiento paralelo
- **RNF-02.3:** La base de datos debe soportar al menos 10,000 simulaciones históricas
- **RNF-02.4:** El sistema debe manejar al menos 50 usuarios simultáneos

### RNF-03: Disponibilidad
- **RNF-03.1:** El sistema debe tener disponibilidad del 99% (downtime máximo 7.2 horas/mes)
- **RNF-03.2:** El sistema debe implementar health checks automáticos
- **RNF-03.3:** El sistema debe recuperarse automáticamente de fallos de conexión
- **RNF-03.4:** El sistema debe reintentar operaciones fallidas hasta 3 veces
- **RNF-03.5:** El sistema debe mantener persistencia de datos en caso de reinicio

### RNF-04: Confiabilidad
- **RNF-04.1:** El sistema debe garantizar integridad de datos en transacciones
- **RNF-04.2:** El sistema debe mantener consistencia entre frontend y backend
- **RNF-04.3:** Los archivos de resultados no deben corromperse durante almacenamiento
- **RNF-04.4:** Las simulaciones abortadas no deben dejar datos inconsistentes
- **RNF-04.5:** El sistema debe validar datos antes de procesamiento científico

### RNF-05: Usabilidad
- **RNF-05.1:** La interfaz debe ser intuitiva para usuarios sin experiencia técnica
- **RNF-05.2:** Todas las acciones críticas deben requerir confirmación
- **RNF-05.3:** El sistema debe proporcionar feedback visual inmediato
- **RNF-05.4:** Los mensajes de error deben ser claros y accionables
- **RNF-05.5:** El sistema debe seguir principios de diseño Material Design
- **RNF-05.6:** La navegación debe requerir máximo 3 clics para cualquier funcionalidad
- **RNF-05.7:** El sistema debe ser responsive para diferentes tamaños de pantalla

### RNF-06: Seguridad
- **RNF-06.1:** Las comunicaciones deben usar HTTPS en producción
- **RNF-06.2:** Las conexiones WebSocket deben estar autenticadas
- **RNF-06.3:** Los datos sensibles no deben exponerse en logs
- **RNF-06.4:** El sistema debe prevenir inyecciones SQL mediante queries parametrizadas
- **RNF-06.5:** Los archivos subidos deben validarse antes de procesamiento
- **RNF-06.6:** Las credenciales de base de datos deben almacenarse en variables de entorno

### RNF-07: Mantenibilidad
- **RNF-07.1:** El código debe seguir convenciones PEP 8 (Python) y ESLint (JavaScript)
- **RNF-07.2:** Todas las funciones públicas deben estar documentadas
- **RNF-07.3:** El sistema debe mantener cobertura de tests mayor al 70%
- **RNF-07.4:** Los componentes deben seguir principios SOLID
- **RNF-07.5:** El sistema debe usar control de versiones Git con GitFlow
- **RNF-07.6:** Los commits deben seguir Conventional Commits
- **RNF-07.7:** El código debe estar modularizado en capas (controller, service, model)

### RNF-08: Portabilidad
- **RNF-08.1:** El sistema debe ejecutarse en Linux, Windows (WSL2) y macOS
- **RNF-08.2:** El sistema debe containerizarse completamente con Docker
- **RNF-08.3:** El sistema debe ser independiente de la infraestructura del host
- **RNF-08.4:** El sistema debe configurarse mediante variables de entorno
- **RNF-08.5:** El sistema debe incluir docker-compose para orquestación

### RNF-09: Interoperabilidad
- **RNF-09.1:** El sistema debe exponer API REST con JSON
- **RNF-09.2:** El sistema debe usar estándares de comunicación HTTP/WebSocket
- **RNF-09.3:** Los archivos de resultados deben ser compatibles con MATLAB/Octave
- **RNF-09.4:** Las mallas deben exportarse en formato estándar XML/MSH
- **RNF-09.5:** El sistema debe permitir integración con herramientas externas

### RNF-10: Observabilidad
- **RNF-10.1:** El sistema debe registrar eventos importantes en logs estructurados
- **RNF-10.2:** Los logs deben incluir timestamps y niveles (INFO, WARNING, ERROR)
- **RNF-10.3:** El sistema debe exponer métricas de salud del servidor
- **RNF-10.4:** El sistema debe monitorear uso de memoria y CPU
- **RNF-10.5:** El sistema debe alertar sobre condiciones anómalas

### RNF-11: Capacidad de Prueba
- **RNF-11.1:** Todos los servicios deben tener tests unitarios
- **RNF-11.2:** El sistema debe incluir tests de integración
- **RNF-11.3:** El sistema debe incluir tests end-to-end con Cypress
- **RNF-11.4:** Los tests deben ejecutarse automáticamente en CI/CD
- **RNF-11.5:** El sistema debe proporcionar datos de prueba reproducibles

### RNF-12: Documentación
- **RNF-12.1:** El sistema debe incluir README completo
- **RNF-12.2:** El sistema debe documentar la API REST
- **RNF-12.3:** El sistema debe incluir guías de instalación y desarrollo
- **RNF-12.4:** El código debe incluir comentarios explicativos en secciones complejas
- **RNF-12.5:** El sistema debe incluir diagramas de arquitectura

**Total Requisitos No Funcionales:** 64 (118% de los funcionales) ✅

---

## 3. Descripción de Funcionalidades

### 3.1 Gestión de Simulaciones

#### Creación de Simulaciones
Los usuarios pueden crear simulaciones especificando:
- **Parámetros Geométricos:** plate_thickness, typical_mesh_size, sensor_edge_margin
- **Configuración de Sensores:** n_transmitter, n_receiver, emitters_pitch, receivers_pitch, sensor_distance
- **Propiedades del Material:** porosity (1-30%), attenuation (0=tiempo, 1=frecuencia)
- **Configuración de Tejidos:** mesh_type (GMSH), skin_layer_config (simple/multilayer/none)

#### Visualización
Tabla interactiva con ID, nombre, estado, fecha/hora, parámetros y acciones disponibles.

#### Edición
- **Not started:** Editar TODOS los parámetros (regenera malla)
- **Finalizadas:** Solo editar nombre

#### Duplicación
Crea copias exactas con nuevo nombre para experimentación.

### 3.2 Ejecución de Simulaciones

Motor FEniCS resuelve ecuaciones elastodinámicas en 2D:
1. Validación de parámetros
2. Generación de malla GMSH
3. Posicionamiento de sensores
4. Resolución numérica (Newmark β-γ)
5. Post-procesamiento
6. Almacenamiento (.mat)

**Re-ejecución:** Para corregir errores o regenerar resultados  
**Abortar:** Interrumpir simulaciones en progreso con limpieza de recursos

### 3.3 Sistema de Cola

- **Encolado automático** al ejecutar
- **Procesamiento secuencial** (una a la vez)
- **Gestión manual:** Reordenar, desencolar, monitorear
- **Vista especializada:** Orden, posición, tiempo estimado

### 3.4 Mallas

#### Generación GMSH
- **Monocapa:** Solo hueso cortical
- **Multicapa:** Piel (0-5mm) + Hueso (5 a 5+thickness) + Piel (5+thickness a 10+thickness)

#### Almacenamiento
- XML (FEniCS/DOLFIN)
- MSH (GMSH nativo)
- Metadatos JSON

#### Visualización 3D
Three.js con emisores (rojo) y receptores (azul). Controles: rotar, zoom, pan.

### 3.5 Resultados

Datos .mat procesados:
- **Señales espacio-temporales** normalizadas
- **SVD:** Valores singulares en dB (0-2 MHz)
- **Espectro f-k:** Heatmap con curvas de dispersión

### 3.6 Descarga

Archivos .mat y mallas (XML/MSH) con nombre personalizado.

### 3.7 Búsqueda y Filtrado

Filtros múltiples: texto, estado, attenuation, mesh type, tejido, porosidad, fechas.

### 3.8 Tiempo Real

WebSocket (Socket.IO): estado_simulacion, nueva_simulacion, mesh_ready, mesh_error.  
**Notificación sonora** al finalizar.

### 3.9 Estadísticas

Panel con total, finished, not started, running. Tarjeta de simulación activa destacada.

### 3.10 Validación

Frontend (React) y Backend (ValidData) validan tipos, rangos, campos requeridos.

---

**FIN PARTE 1/3**

Ver ANALISIS_DISENO_UML_PARTE_2.md para Diagramas de Casos de Uso y Especificaciones.
