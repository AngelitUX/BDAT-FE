#!/bin/bash
# Script de deployment para producción

set -e

# Configuración
REGISTRY="ghcr.io"
REPO_NAME="DiegoEspinnoza/BDAT"  # Cambiar por tu usuario de GitHub
VERSION=${1:-latest}

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Verificar que estamos en la rama master
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ]; then
    print_warning "No estás en la rama master. Rama actual: $CURRENT_BRANCH"
    read -p "¿Continuar con el deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_info "Iniciando deployment versión: $VERSION"

# Verificar que no hay cambios sin commitear
if ! git diff-index --quiet HEAD --; then
    print_error "Hay cambios sin commitear. Por favor, haz commit de todos los cambios."
    exit 1
fi

print_status "Repositorio limpio"

# Login a GitHub Container Registry
print_info "Haciendo login a GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login $REGISTRY -u $GITHUB_ACTOR --password-stdin

# Build y push de imágenes
print_status "Construyendo y subiendo imagen del backend..."
docker build -t $REGISTRY/$REPO_NAME-backend:$VERSION ./backend
docker push $REGISTRY/$REPO_NAME-backend:$VERSION

print_status "Construyendo y subiendo imagen de la base de datos..."
docker build -t $REGISTRY/$REPO_NAME-database:$VERSION ./database
docker push $REGISTRY/$REPO_NAME-database:$VERSION

# Crear docker-compose para producción
print_status "Generando docker-compose para producción..."
cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  mysql:
    image: $REGISTRY/$REPO_NAME-database:$VERSION
    container_name: mysql_prod
    restart: always
    volumes:
      - dbdata_prod:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: \${MYSQL_DATABASE}
      MYSQL_USER: \${MYSQL_USER}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
    ports:
      - '3306:3306'
    networks:
      - bdat_network

  backend:
    image: $REGISTRY/$REPO_NAME-backend:$VERSION
    container_name: backend_prod
    restart: always
    depends_on:
      - mysql
    ports:
      - '5000:5000'
    environment:
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_USER: \${MYSQL_USER}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
      MYSQL_DB: \${MYSQL_DATABASE}
      FLASK_ENV: production
    networks:
      - bdat_network

volumes:
  dbdata_prod:

networks:
  bdat_network:
    driver: bridge
EOF

print_status "Docker-compose para producción generado"

print_info "Deployment completado exitosamente! 🚀"
print_info "Para deployar en el servidor:"
print_info "1. Copia docker-compose.prod.yml al servidor"
print_info "2. Configura las variables de entorno"
print_info "3. Ejecuta: docker-compose -f docker-compose.prod.yml up -d"

# Limpiar archivo temporal
rm -f docker-compose.prod.yml
