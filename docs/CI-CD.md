# 🚀 CI/CD Pipeline Documentation

Este documento describe la configuración de CI/CD (Integración Continua y Despliegue Continuo) para el proyecto BDAT.

## 📋 Resumen

El pipeline de CI/CD está implementado usando **GitHub Actions** y proporciona:

- ✅ **Integración Continua (CI)**: Tests automatizados, linting, y verificación de builds
- 🚀 **Despliegue Continuo (CD)**: Build y push de imágenes Docker, deployment automático

## Arquitectura del Pipeline

### CI Pipeline (`.github/workflows/ci.yml`)

Se ejecuta en pushes y pull requests a `master` y `develop`:

1. **Backend Tests (Dockerized)**
   - Ejecuta tests DENTRO del contenedor Docker del backend
   - Configuración de entorno de testing con `.env.test`
   - Build de imágenes Docker (MySQL + Backend con FEniCS)
   - Inicio de servicios con `docker-compose`
   - Espera a que MySQL esté listo antes de ejecutar tests
   - Ejecución de tests con pytest dentro del contenedor backend
   - Generación de reportes de cobertura desde el contenedor
   - Logs detallados en caso de fallo

2. **Frontend Tests**
   - Configuración de Node.js 18
   - Instalación de dependencias con npm
   - Ejecución de tests con Jest/React Testing Library
   - Generación de reportes de cobertura

3. **Docker Build Validation**
   - Validación de sintaxis de docker-compose.yml
   - Build paralelo de todas las imágenes Docker
   - Verificación de que las imágenes se construyen correctamente

4. **Integration Tests**
   - Inicio completo de servicios con Docker Compose
   - Tests de conectividad entre servicios
   - Verificación de health checks (`/health`, `/fenics-status`)
   - Tests de endpoints API

5. **Code Quality**
   - Linting con flake8 (Python)
   - Formateo con black (Python)
   - Verificación de imports con isort (Python)
   - ESLint para frontend

### CD Pipeline (`.github/workflows/cd.yml`)

Se ejecuta en pushes a `master` y tags `v*`:

1. **Build and Push**
   - Build de imágenes Docker (Backend con FEniCS + Database)
   - Push a GitHub Container Registry (ghcr.io)
   - Tagging automático basado en branch/tag
   - Cache optimizado para builds rápidos
   - Metadatos y labels automáticos

2. **Deploy to Staging**
   - Deployment automático a staging en pushes a `master`
   - Configuración de environment `staging`
   - Uso de imágenes dockerizadas construidas en el step anterior

3. **Deploy to Production**
   - Deployment a producción solo con tags `v*`
   - Configuración de environment `production`
   - Requiere aprobación manual (GitHub Environments)
   - Uso de imágenes dockerizadas versionadas

4. **Notifications**
   - Notificaciones de éxito/fallo
   - Integrable con Slack, Discord, etc.

## Configuración

### Variables de Entorno

Configura estos secrets en GitHub (Settings > Secrets and variables > Actions):

```bash
# Para deployment (opcional)
DEPLOY_HOST=your-server.com
DEPLOY_USER=deploy-user
DEPLOY_KEY=<ssh-private-key>

# Para notificaciones (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Archivos de Configuración

- **`.env.test`**: Variables de entorno para tests
- **`pyproject.toml`**: Configuración de herramientas Python (black, isort, pytest)
- **`.flake8`**: Configuración de linting Python
- **`scripts/test-local.sh`**: Script para ejecutar tests localmente
- **`scripts/deploy.sh`**: Script de deployment manual

## Tests Locales

Antes de hacer push, ejecuta los tests localmente:

```bash
# Hacer el script ejecutable
chmod +x scripts/test-local.sh

# Ejecutar tests
./scripts/test-local.sh
```

Este script:
- Verifica que Docker esté ejecutándose
- Construye las imágenes
- Ejecuta tests del backend y frontend
- Verifica que los servicios se inicien correctamente
- Limpia recursos al finalizar

## Configuración Local

### Desarrollo
```bash
# Todos los servicios (Backend + MySQL)
cd backend
./dev-docker.sh  # Usa docker-compose internamente

# Frontend (separado)
cd frontend
npm start
```

### Testing
```bash
# Backend tests (dentro de Docker)
docker-compose up -d mysql
docker-compose exec backend python -m pytest test/ -v

# Frontend tests
cd frontend
npm test

# Tests completos (como en CI)
docker-compose up -d mysql backend
docker-compose exec -T backend python -m pytest test/ -v --cov=src
```

## Deployment

### Deployment Automático

- **Staging**: Se despliega automáticamente en cada push a `master`
- **Production**: Se despliega automáticamente al crear un tag `v*`

```bash
# Crear un release tag
git tag v1.0.0
git push origin v1.0.0
```

### Deployment Manual

```bash
# Hacer el script ejecutable
chmod +x scripts/deploy.sh

# Deployar versión específica
./scripts/deploy.sh v1.0.0

# Deployar latest
./scripts/deploy.sh
```

## Monitoreo

### Health Checks

El backend incluye un endpoint `/health` que verifica:
- Estado de la aplicación
- Conectividad con la base de datos
- Estado de servicios críticos

```bash
curl http://localhost:5000/health
```

Respuesta exitosa:
```json
{
  "status": "healthy",
  "database": "connected",
  "message": "All systems operational"
}
```

### Cobertura de Código

Los reportes de cobertura se suben automáticamente a Codecov:
- Backend: Pytest con coverage
- Frontend: Jest con coverage

## Troubleshooting

### Tests Fallan Localmente

1. **Verificar Docker**: `docker --version`
2. **Limpiar contenedores**: `docker-compose down -v`
3. **Reconstruir imágenes**: `docker-compose build --no-cache`
4. **Verificar variables de entorno**: Revisar `.env` y `.env.test`

### Pipeline Falla en GitHub

1. **Revisar logs**: Ve a Actions tab en GitHub
2. **Verificar secrets**: Settings > Secrets and variables
3. **Verificar permisos**: Asegurar que GITHUB_TOKEN tenga permisos necesarios

### Deployment Falla

1. **Verificar imágenes**: Comprobar que las imágenes se construyeron correctamente
2. **Verificar conectividad**: SSH al servidor de deployment
3. **Revisar logs**: `docker-compose logs`

## 📈 Métricas y Optimización

### Performance del Pipeline

- **Tiempo promedio CI**: ~8-12 minutos
- **Tiempo promedio CD**: ~5-8 minutos
- **Cache hit rate**: >80% (Docker layers)

### Optimizaciones Implementadas

- Cache de dependencias (pip, npm)
- Cache de Docker layers
- Ejecución paralela de jobs independientes
- Uso de GitHub Container Registry para imágenes

## 🔄 Workflow Branches

```
master ──────────────────► Production Deployment
  ↑
develop ──────────────────► Staging Deployment
  ↑
feature/* ────────────────► CI Tests Only
hotfix/* ─────────────────► CI Tests Only
release/* ────────────────► CI Tests Only
```

## 📚 Recursos Adicionales

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**Nota**: Este pipeline está diseñado para ser escalable y mantenible. Puedes extenderlo según las necesidades específicas de tu proyecto.
