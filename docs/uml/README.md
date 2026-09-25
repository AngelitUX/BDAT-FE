# 📊 Diagramas UML - Sistema BDAT

Este directorio contiene los diagramas UML 2.0 del sistema BDAT en formato PlantUML.

---

## 📁 Archivos Disponibles

| Archivo | Descripción | Tipo UML |
|---------|-------------|----------|
| `01_casos_uso_general.puml` | Diagrama completo de casos de uso del sistema | Use Case Diagram |
| `02_secuencia_crear_ejecutar.puml` | Secuencia: Crear y ejecutar simulación | Sequence Diagram (DSS) |
| `03_estados_simulacion.puml` | Máquina de estados del ciclo de vida | State Diagram |
| `04_modelo_conceptual.puml` | Clases del dominio con asociaciones | Class Diagram |
| `05_componentes.puml` | Arquitectura en capas del sistema | Component Diagram |
| `06_despliegue.puml` | Despliegue Docker con 3 contenedores | Deployment Diagram |
| `07_secuencia_resultados.puml` | Secuencia: Visualizar resultados | Sequence Diagram (DSS) |
| `08_contexto_sistema.puml` | **Vista general del sistema y actores** | **Context Diagram** |
| `09_arquitectura_sistema.puml` | **Arquitectura en capas detallada** | **Architecture Diagram** |
| `10_paquetes.puml` | **Organización en paquetes y módulos** | **Package Diagram** |

---

## 🚀 Cómo Generar las Imágenes

### Opción 1: Visual Studio Code (Recomendado)

#### 1. Instalar Extensión
```bash
# Buscar en VS Code Marketplace:
"PlantUML" por jebbs
```

#### 2. Instalar Dependencias

**Windows (con Chocolatey):**
```bash
choco install graphviz
choco install plantuml
```

**Linux/macOS:**
```bash
# Ubuntu/Debian
sudo apt-get install graphviz plantuml

# macOS (Homebrew)
brew install graphviz plantuml
```

#### 3. Generar Imágenes en VS Code
1. Abrir cualquier archivo `.puml`
2. Presionar `Alt + D` para preview
3. Click derecho → "Export Current Diagram"
4. Seleccionar formato: **PNG** (para informes), **SVG** (vectorial), o **PDF**

---

### Opción 2: Línea de Comandos

#### Generar todas las imágenes PNG
```bash
cd docs/uml/plantuml

# Generar PNG (resolución alta)
plantuml -tpng -DPLANTUML_LIMIT_SIZE=8192 *.puml

# Generar SVG (vectorial)
plantuml -tsvg *.puml

# Generar PDF
plantuml -tpdf *.puml
```

#### Generar imagen individual
```bash
plantuml -tpng 01_casos_uso_general.puml
```

---

### Opción 3: Online (Sin Instalación)

1. Ir a: https://www.plantuml.com/plantuml/uml/
2. Copiar y pegar el contenido del archivo `.puml`
3. Click "Submit"
4. Descargar la imagen generada (PNG/SVG)

---

## 📐 Configuración de Calidad

Para imágenes de **alta resolución** para tu informe:

```bash
# PNG de alta calidad (300 DPI)
plantuml -tpng -DPLANTUML_LIMIT_SIZE=16384 -charset UTF-8 *.puml

# SVG (escalable sin pérdida)
plantuml -tsvg -charset UTF-8 *.puml
```

---

## 📄 Uso en Informe

### Para Microsoft Word/LibreOffice
1. Generar imágenes PNG o SVG
2. Insertar → Imagen
3. Ajustar tamaño manteniendo proporciones

### Para LaTeX
```latex
\begin{figure}[h]
\centering
\includegraphics[width=0.9\textwidth]{uml/plantuml/01_casos_uso_general.png}
\caption{Diagrama de Casos de Uso - Sistema BDAT}
\label{fig:casos_uso}
\end{figure}
```

### Para Markdown/GitHub
```markdown
![Casos de Uso](./plantuml/01_casos_uso_general.png)
```

---

## 🎨 Personalización

### Cambiar Tema
Editar en cada archivo `.puml`:
```plantuml
!theme plain         # Minimalista (actual)
!theme cerulean      # Azul profesional
!theme sketchy-outline # Estilo sketch
```

### Cambiar Colores
```plantuml
skinparam backgroundColor #FEFEFE
skinparam actorBackgroundColor #E8F5E9
skinparam usecaseBackgroundColor #BBDEFB
```

---

## ✅ Checklist para el Informe

- [ ] `08_contexto_sistema.puml` → **Sección: Introducción/Vista General** ⭐ PRIMERO
- [ ] `09_arquitectura_sistema.puml` → **Sección: Arquitectura del Sistema** ⭐
- [ ] `10_paquetes.puml` → **Sección: Organización de Módulos** ⭐
- [ ] `01_casos_uso_general.puml` → **Sección: Casos de Uso**
- [ ] `02_secuencia_crear_ejecutar.puml` → **Sección: Diagramas de Secuencia (DSS)**
- [ ] `07_secuencia_resultados.puml` → **Sección: Diagramas de Secuencia (DSS)**
- [ ] `03_estados_simulacion.puml` → **Sección: Diagramas de Estado**
- [ ] `04_modelo_conceptual.puml` → **Sección: Modelo Conceptual**
- [ ] `05_componentes.puml` → **Sección: Arquitectura/Componentes (Detallada)**
- [ ] `06_despliegue.puml` → **Sección: Despliegue/Infraestructura**

---

## 🔧 Troubleshooting

### Error: "Cannot find Graphviz"
```bash
# Verificar instalación
dot -V

# Si no está instalado:
# Windows: choco install graphviz
# Linux: sudo apt-get install graphviz
# macOS: brew install graphviz
```

### Error: "Syntax error in diagram"
- Verificar que todos los corchetes `[]` y paréntesis `()` estén balanceados
- Verificar que las flechas tengan espacios correctos: `A --> B`

### Imagen cortada
```bash
# Aumentar límite de tamaño
plantuml -DPLANTUML_LIMIT_SIZE=16384 archivo.puml
```

---

## 📚 Referencias

- **PlantUML Oficial:** https://plantuml.com/
- **Sintaxis Use Case:** https://plantuml.com/use-case-diagram
- **Sintaxis Sequence:** https://plantuml.com/sequence-diagram
- **Sintaxis State:** https://plantuml.com/state-diagram
- **Sintaxis Class:** https://plantuml.com/class-diagram
- **Sintaxis Component:** https://plantuml.com/component-diagram
- **Sintaxis Deployment:** https://plantuml.com/deployment-diagram

---

## 💡 Tips para el Informe

1. **Orden recomendado de diagramas:**
   - Casos de Uso (visión general)
   - Secuencias (interacciones)
   - Estados (comportamiento)
   - Clases (estructura)
   - Componentes (arquitectura)
   - Despliegue (infraestructura)

2. **Formato de imágenes:**
   - **PNG:** Para imprimir (300 DPI)
   - **SVG:** Para versión digital
   - **PDF:** Para anexos

3. **Nomenclatura en informe:**
   - "Figura X: Diagrama de..."
   - Incluir siempre leyenda explicativa
   - Referenciar en el texto

---

**Autor:** Sistema BDAT - Análisis y Diseño UML 2.0  
**Versión:** 1.1.0  
**Última actualización:** Enero 2025
