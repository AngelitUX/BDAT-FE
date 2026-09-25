#!/bin/bash

# Script de configuración para pruebas de Cypress
# Este script configura el entorno para ejecutar las pruebas de sistema

echo "🚀 Configurando entorno para pruebas de Cypress..."

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js primero."
    exit 1
fi

# Verificar que npm esté instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado. Por favor instala npm primero."
    exit 1
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Verificar que Cypress se instaló correctamente
if [ ! -d "node_modules/cypress" ]; then
    echo "❌ Error al instalar Cypress. Intentando reinstalar..."
    npm install cypress --save-dev
fi

# Crear directorios necesarios
echo "📁 Creando directorios de Cypress..."
mkdir -p cypress/e2e
mkdir -p cypress/support
mkdir -p cypress/fixtures
mkdir -p cypress/videos
mkdir -p cypress/screenshots

# Verificar que el backend esté funcionando
echo "🔍 Verificando que el backend esté funcionando..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend está funcionando en http://localhost:5000"
else
    echo "⚠️  Backend no está funcionando. Asegúrate de que esté ejecutándose en http://localhost:5000"
    echo "   Puedes iniciarlo con: docker-compose up backend"
fi

# Verificar que el frontend esté funcionando
echo "🔍 Verificando que el frontend esté funcionando..."
if curl -f http://localhost:3002 > /dev/null 2>&1; then
    echo "✅ Frontend está funcionando en http://localhost:3002"
else
    echo "⚠️  Frontend no está funcionando. Asegúrate de que esté ejecutándose en http://localhost:3002"
    echo "   Puedes iniciarlo con: docker-compose up frontend"
fi

echo "✅ Configuración completada!"
echo ""
echo "📋 Comandos disponibles:"
echo "  npm run cypress:open     - Abrir Cypress en modo interactivo"
echo "  npm run cypress:run      - Ejecutar todas las pruebas"
echo "  npm run cypress:run:headed - Ejecutar pruebas con interfaz gráfica"
echo "  npm run test:e2e         - Ejecutar pruebas end-to-end"
echo ""
echo "🧪 Pruebas disponibles:"
echo "  - gmsh-simulation.cy.js  - Pruebas específicas de GMSH"
echo "  - ui-simulation-flow.cy.js - Flujo de interfaz de usuario"
echo "  - integration-tests.cy.js - Pruebas de integración"
echo ""
echo "💡 Consejos:"
echo "  - Asegúrate de que tanto el backend como el frontend estén funcionando"
echo "  - Las simulaciones pueden tomar varios minutos en completarse"
echo "  - Revisa los logs del backend para ver el progreso de las simulaciones"


