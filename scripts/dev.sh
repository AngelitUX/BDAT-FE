#!/bin/bash

# Script de desarrollo para BDAT Project
# Inicia los servicios necesarios para desarrollo local
# 
# Uso:
#   ./dev.sh                    # Solo backend y MySQL
#   ./dev.sh --with-frontend    # Backend, MySQL y Frontend
#   ./dev.sh -f                 # Backend, MySQL y Frontend (forma corta)

# Procesar argumentos de línea de comandos
INCLUDE_FRONTEND=false

for arg in "$@"; do
    case $arg in
        --with-frontend|-f)
            INCLUDE_FRONTEND=true
            shift
            ;;
        --help|-h)
            echo "Uso: $0 [opciones]"
            echo ""
            echo "Opciones:"
            echo "  --with-frontend, -f    Incluir el servicio frontend"
            echo "  --help, -h            Mostrar esta ayuda"
            echo ""
            echo "Ejemplos:"
            echo "  $0                    # Solo backend y MySQL"
            echo "  $0 --with-frontend    # Backend, MySQL y Frontend"
            echo "  $0 -f                 # Backend, MySQL y Frontend (forma corta)"
            exit 0
            ;;
        *)
            echo "❌ Argumento desconocido: $arg"
            echo "   Usa --help para ver las opciones disponibles"
            exit 1
            ;;
    esac
done

# Mostrar banner con configuración actual
echo ""
echo "🚀 BDAT Development Environment"
echo "==============================="
if [ "$INCLUDE_FRONTEND" = true ]; then
    echo "📦 Modo: Full Stack (Backend + Frontend + Database)"
    echo "🎯 Servicios: MySQL, FEniCS Backend, React Frontend"
else
    echo "⚡ Modo: Backend Only (Desarrollo Rápido)"
    echo "🎯 Servicios: MySQL, FEniCS Backend"
fi
echo "==============================="

# Verificar que Docker esté disponible
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado o no está en el PATH"
    echo "   Instala Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Verificar que Docker Compose esté disponible
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose no está disponible"
    echo "   Instala Docker Compose o usa Docker Desktop"
    exit 1
fi

# Verificar que Docker esté ejecutándose
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker no está ejecutándose"
    echo "   Inicia Docker Desktop y vuelve a intentar"
    exit 1
fi

echo "✅ Docker disponible: $(docker --version)"

# Cambiar al directorio raíz del proyecto
cd "$(dirname "$0")/.." || {
    echo "❌ Error: No se puede acceder al directorio del proyecto"
    exit 1
}

echo ""
echo "🔧 Construyendo servicios con Docker Compose..."
echo "   - MySQL Database"
echo "   - Backend con FEniCS"
if [ "$INCLUDE_FRONTEND" = true ]; then
    echo "   - Frontend React"
fi

# Usar docker compose (nuevo) o docker-compose (legacy)
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD build || {
    echo "❌ Error construyendo servicios"
    exit 1
}

echo ""
echo "🐳 Iniciando servicios de desarrollo..."
echo "   - MySQL: localhost:3306"
echo "   - API URL: http://localhost:5000"
if [ "$INCLUDE_FRONTEND" = true ]; then
    echo "   - Frontend: http://localhost:3002"
fi
echo "   - Health Check: http://localhost:5000/health"
echo "   - FEniCS Status: http://localhost:5000/fenics-status"
echo "   Presiona Ctrl+C para detener todos los servicios"
echo ""

# Ejecutar servicios en modo desarrollo
if [ "$INCLUDE_FRONTEND" = true ]; then
    echo "🚀 Iniciando: MySQL + Backend + Frontend"
    $COMPOSE_CMD up mysql backend frontend
else
    printf "🚀 Iniciando: MySQL + Backend (sin Frontend)\n"
    $COMPOSE_CMD up mysql backend
fi