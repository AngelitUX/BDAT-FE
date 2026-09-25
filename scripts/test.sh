#!/bin/bash
"""
BDAT Backend - Tests Dockerizados
Ejecuta todos los tests dentro del contenedor Docker del backend
"""

echo "🧪 BDAT Backend - Tests Dockerizados"
echo "===================================="

# Verificar que Docker esté disponible
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado o no está en el PATH"
    exit 1
fi

# Verificar que Docker Compose esté disponible
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose no está disponible"
    exit 1
fi

# Cambiar al directorio raíz del proyecto
cd "$(dirname "$0")/.." || {
    echo "❌ Error: No se puede acceder al directorio del proyecto"
    exit 1
}

# Usar docker compose (nuevo) o docker-compose (legacy)
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo ""
echo "🔧 Preparando entorno de test..."

# Construir imágenes si es necesario
$COMPOSE_CMD build mysql backend

echo ""
echo "🐳 Iniciando servicios para tests..."

# Iniciar MySQL primero
$COMPOSE_CMD up -d mysql
echo "Esperando a que MySQL esté listo..."
for i in {1..30}; do
    if $COMPOSE_CMD exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo "✅ MySQL está listo"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Error: MySQL no se inició correctamente después de 60 segundos"
        $COMPOSE_CMD logs mysql
        exit 1
    fi
    echo "Esperando MySQL... ($i/30)"
    sleep 2
done

# Iniciar backend
$COMPOSE_CMD up -d backend
echo "Esperando a que backend esté listo..."
for i in {1..30}; do
    if curl -f http://localhost:5000/health 2>/dev/null; then
        echo "✅ Backend está listo"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Error: Backend no se inició correctamente después de 60 segundos"
        $COMPOSE_CMD logs backend
        exit 1
    fi
    echo "Esperando backend... ($i/30)"
    sleep 2
done

echo ""
echo "✅ Servicios listos. Ejecutando tests..."
echo ""

# Ejecutar tests desde la raíz del proyecto (dentro del contenedor backend)
if [ "$1" = "--coverage" ] || [ "$1" = "-c" ]; then
    echo "📊 Ejecutando tests con cobertura..."
    $COMPOSE_CMD exec -T backend python3 -m pytest /app/../test/ -v --cov=backend/src --cov-report=term-missing --cov-report=xml
elif [ "$1" = "--specific" ] && [ -n "$2" ]; then
    echo "🎯 Ejecutando test específico: $2"
    $COMPOSE_CMD exec -T backend python3 -m pytest "/app/../test/$2" -v -s
else
    echo "🧪 Ejecutando todos los tests..."
    $COMPOSE_CMD exec -T backend python3 -m pytest /app/../test/ -v -s
fi

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Todos los tests pasaron correctamente!"
else
    echo "❌ Algunos tests fallaron. Revisa los logs arriba."
    echo ""
    echo "📋 Logs de servicios:"
    echo "=== MySQL ==="
    $COMPOSE_CMD logs --tail=20 mysql
    echo ""
    echo "=== Backend ==="
    $COMPOSE_CMD logs --tail=20 backend
fi

echo ""
echo "🧹 Limpiando servicios..."
$COMPOSE_CMD down

echo ""
echo "🏁 Tests completados."
exit $TEST_EXIT_CODE
