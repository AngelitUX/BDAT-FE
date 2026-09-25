#!/bin/bash
################################################################################
# Script para generar imagenes PNG/SVG de diagramas PlantUML
# Sistema BDAT - Analisis y Diseno UML 2.0
################################################################################

echo ""
echo "========================================"
echo "  Generador de Diagramas UML - BDAT"
echo "========================================"
echo ""

# Ir al directorio de PlantUML
cd "$(dirname "$0")/plantuml" || exit 1

# Verificar si PlantUML esta instalado
if ! command -v plantuml &> /dev/null; then
    echo "[ERROR] PlantUML no esta instalado."
    echo ""
    echo "Por favor instala PlantUML:"
    echo "  - Ubuntu/Debian: sudo apt-get install plantuml"
    echo "  - macOS: brew install plantuml"
    echo "  - Manual: https://plantuml.com/download"
    echo ""
    exit 1
fi

echo "[OK] PlantUML encontrado: $(plantuml -version | head -n1)"
echo ""

# Crear carpetas de salida
mkdir -p output/png
mkdir -p output/svg

# Generar imagenes PNG
echo "Generando imagenes PNG..."
echo ""
plantuml -tpng -DPLANTUML_LIMIT_SIZE=16384 -charset UTF-8 -o "output/png" ./*.puml

if [ $? -eq 0 ]; then
    echo "[OK] Imagenes PNG generadas en: output/png/"
else
    echo "[ERROR] Fallo al generar imagenes PNG"
fi

echo ""

# Generar imagenes SVG
echo "Generando imagenes SVG (vectoriales)..."
echo ""
plantuml -tsvg -charset UTF-8 -o "output/svg" ./*.puml

if [ $? -eq 0 ]; then
    echo "[OK] Imagenes SVG generadas en: output/svg/"
else
    echo "[ERROR] Fallo al generar imagenes SVG"
fi

echo ""
echo "========================================"
echo "  Generacion completada"
echo "========================================"
echo ""

# Listar archivos generados
echo "Archivos PNG generados:"
ls -1 output/png/*.png 2>/dev/null || echo "  (ninguno)"
echo ""

echo "Archivos SVG generados:"
ls -1 output/svg/*.svg 2>/dev/null || echo "  (ninguno)"
echo ""

echo "[FIN] Script completado exitosamente."
echo ""

# Abrir carpeta (solo en macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open output/png
fi
