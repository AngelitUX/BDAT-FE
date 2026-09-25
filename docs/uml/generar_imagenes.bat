@echo off
REM ========================================================================
REM Script para generar imagenes PNG/SVG de diagramas PlantUML
REM Sistema BDAT - Analisis y Diseno UML 2.0
REM ========================================================================

echo.
echo ========================================
echo   Generador de Diagramas UML - BDAT
echo ========================================
echo.

cd /d "%~dp0plantuml"

REM Verificar si PlantUML esta instalado
where plantuml >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PlantUML no esta instalado.
    echo.
    echo Por favor instala PlantUML:
    echo   - Opcion 1: choco install plantuml
    echo   - Opcion 2: Descarga manual desde https://plantuml.com/download
    echo.
    pause
    exit /b 1
)

echo [OK] PlantUML encontrado.
echo.

REM Crear carpeta de salida
if not exist "output" mkdir output
if not exist "output\png" mkdir output\png
if not exist "output\svg" mkdir output\svg

echo Generando imagenes PNG...
echo.
plantuml -tpng -DPLANTUML_LIMIT_SIZE=16384 -charset UTF-8 -o "output/png" *.puml

if %ERRORLEVEL% EQU 0 (
    echo [OK] Imagenes PNG generadas en: output\png\
) else (
    echo [ERROR] Fallo al generar imagenes PNG
)

echo.
echo Generando imagenes SVG (vectoriales)...
echo.
plantuml -tsvg -charset UTF-8 -o "output/svg" *.puml

if %ERRORLEVEL% EQU 0 (
    echo [OK] Imagenes SVG generadas en: output\svg\
) else (
    echo [ERROR] Fallo al generar imagenes SVG
)

echo.
echo ========================================
echo   Generacion completada
echo ========================================
echo.
echo Archivos generados:
dir /b output\png\*.png 2>nul
echo.
echo Archivos SVG:
dir /b output\svg\*.svg 2>nul
echo.
echo Presiona cualquier tecla para abrir la carpeta de salida...
pause >nul

start output\png

echo.
echo [FIN] Script completado exitosamente.
echo.
