# BDAT - Bone Guided Wave Simulation Platform

                    ╔═══════════════════════════════════════════════════════════════╗
                    ║                                                               ║
                    ║        ██████╗ ██████╗  █████╗ ████████╗                    ║
                    ║        ██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝                    ║
                    ║        ██████╔╝██║  ██║███████║   ██║                       ║
                    ║        ██╔══██╗██║  ██║██╔══██║   ██║                       ║
                    ║        ██████╔╝██████╔╝██║  ██║   ██║                       ║
                    ║        ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝                       ║
                    ║                                                               ║
                    ║              🦴 Bone Guided Wave Analysis Tool 🦴             ║
                    ║                                                               ║
                    ╚═══════════════════════════════════════════════════════════════╝

                                    ┌─────────────────────────┐
                                    │                         │
                                    │    ████████████████     │
                                    │   ██              ██    │
                                    │  ██                ██   │
                                    │ ██                  ██  │
                                    │██                    ██ │
                                    │██      🦴 BONE 🦴     ██ │
                                    │██                    ██ │
                                    │ ██                  ██  │
                                    │  ██                ██   │
                                    │   ██              ██    │
                                    │    ████████████████     │
                                    │                         │
                                    └─────────────────────────┘
                              Cortical Bone Wave Propagation Simulator
```

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/your-username/BDAT/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/your-username/BDAT/ci.yml?branch=master)](https://github.com/your-username/BDAT/actions)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://www.docker.com/)

## 📋 Descripción

**BDAT (Bone Guided Wave Analysis Tool)** es una aplicación web científica que permite ejecutar y visualizar simulaciones de propagación de ondas guiadas en hueso cortical. Esta herramienta está diseñada para facilitar el uso de códigos de simulación científicos mediante una interfaz web intuitiva y accesible.

### 🎯 Características Principales

- **🔬 Simulaciones Científicas**: Análisis de propagación de ondas guiadas en estructuras óseas
- **🌐 Interfaz Web Moderna**: React.js con comunicación en tiempo real
- **⚡ Procesamiento Asíncrono**: Manejo eficiente de simulaciones de larga duración
- **📊 Visualización Interactiva**: Gráficos y tablas dinámicas para análisis de resultados
- **🔄 Tiempo Real**: Actualizaciones de estado vía WebSockets
- **🧪 Testing Completo**: Suite de tests automatizados con CI/CD
- **🐳 Containerización**: Deployment completo con Docker

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│    FRONTEND     │◄──►│     BACKEND     │◄──►│    DATABASE     │
│                 │    │                 │    │                 │
│   React 19.1    │    │   Flask + API   │    │   MySQL 8.0     │
│   Socket.IO     │    │   Socket.IO     │    │   Persistent    │
│   Modern UI     │    │   Scientific    │    │   Storage       │
│                 │    │   Computing     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────────┐
                    │                 │
                    │   SIMULATION    │
                    │    ENGINE       │
                    │                 │
                    │  FEniCS/Reidmen │
                    │   Scientific    │
                    │   Computing     │
                    └─────────────────┘
```

### 🛠️ Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| **Frontend** | React | 19.1.0 | Interfaz de usuario moderna |
| | Socket.IO Client | 4.8.1 | Comunicación en tiempo real |
| | React Router | 7.6.2 | Navegación SPA |
| | Lucide React | 0.523.0 | Iconografía |
| **Backend** | Python | 3.11+ | Lógica de negocio |
| | Flask | Latest | Framework web |
| | Flask-SocketIO | Latest | WebSockets |
| | Flask-MySQLdb | Latest | Conexión base de datos |
| | Flask-CORS | Latest | Cross-origin requests |
| **Base de Datos** | MySQL | 8.0.42 | Almacenamiento persistente |
| **Containerización** | Docker | Latest | Containerización |
| | Docker Compose | Latest | Orquestación multi-container |
| **Testing** | Pytest | Latest | Tests backend |
| | Jest | Latest | Tests frontend |
| | React Testing Library | 16.3.0 | Tests componentes React |
| **CI/CD** | GitHub Actions | Latest | Integración continua |
| **Científico** | FEniCS | Latest | Simulación numérica |
| | NumPy/SciPy | Latest | Computación científica |

---

## 📦 Versionado

Este proyecto sigue [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible con versiones anteriores
- **PATCH**: Correcciones de bugs compatibles

### 📈 Historial de Versiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| **v1.1.0** | 2025-01-08 | ✨ Tests automatizados + CI/CD pipeline |
| **v1.0.0** | 2024-12-XX | 🚀 Versión inicial con funcionalidad completa |

---

## 🚀 Instalación y Configuración

### 📋 Requisitos Previos

Asegúrate de tener instalado:

| Herramienta | Versión Mínima | Propósito |
|-------------|----------------|-----------|
| **Docker** | 20.10+ | Containerización |
| **Docker Compose** | 2.0+ | Orquestación |
| **Git** | 2.30+ | Control de versiones |
| **Sistema Operativo** | Linux / WSL2 / macOS | Compatibilidad completa |

#### 🐧 Para Windows:
- **WSL2** (Windows Subsystem for Linux) es **OBLIGATORIO**
- Docker Desktop con integración WSL2 habilitada

#### ✅ Verificación de Requisitos:
```bash
# Verificar Docker
docker --version
docker-compose --version

# Verificar Git
git --version

# Verificar WSL (Windows)
wsl --version
```

### 📥 Instalación

#### 🐳 Opción 1: Desarrollo con Docker (Recomendado para principiantes)

##### 1️⃣ Clonar el Repositorio
```bash
git clone https://github.com/your-username/BDAT.git
cd BDAT
```

##### 2️⃣ Configurar Variables de Entorno
```bash
# Copiar archivo de configuración
cp .env.example .env

# Editar configuración (opcional)
nano .env
```

##### 3️⃣ Iniciar Entorno de Desarrollo
```bash
# Hacer el script ejecutable
chmod +x scripts/dev.sh

# Iniciar desarrollo
./scripts/dev.sh
```

El script `dev.sh` automáticamente:
- 🏗️ Construye todas las imágenes Docker
- 🚀 Inicia todos los servicios
- 📊 Configura la base de datos
- 🌐 Expone los servicios en los puertos correctos

#### 🐍 Opción 2: Desarrollo Local con Pipenv (Recomendado para desarrolladores)

Esta opción te permite ejecutar el backend nativamente con Python y Pipenv, manteniendo solo la base de datos en Docker.

##### 📋 Requisitos Adicionales
- **Python 3.11+**
- **Pipenv** (`pip install pipenv`)
- **Node.js 18+** (para frontend)

##### 1️⃣ Clonar y Configurar
```bash
git clone https://github.com/your-username/BDAT.git
cd BDAT

# Configurar entorno automáticamente
chmod +x scripts/dev-local.sh
./scripts/dev-local.sh
```

##### 2️⃣ Iniciar Backend (Desarrollo Local)
```bash
cd backend

# Activar entorno virtual de Pipenv
pipenv shell

# Instalar dependencias (primera vez)
pipenv install
pipenv install --dev

# Iniciar servidor de desarrollo
python3 main.py
```

##### 3️⃣ Iniciar Frontend (Terminal separada)
```bash
cd frontend

# Instalar dependencias (primera vez)
npm install

# Iniciar servidor de desarrollo
npm start
```

##### 🛠️ Comandos Útiles con Pipenv
```bash
# En el directorio backend/
pipenv run start          # Iniciar servidor
pipenv run test           # Ejecutar tests
pipenv run test-cov       # Tests con cobertura
pipenv run lint           # Linting
pipenv run format         # Formatear código
pipenv run format-check   # Verificar formato
```

### 🌐 Acceso a la Aplicación

Una vez iniciado, accede a:

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:3002 | Interfaz web principal |
| **Backend API** | http://localhost:5000 | API REST |
| **Health Check** | http://localhost:5000/health | Estado del sistema |
| **Base de Datos** | localhost:3306 | MySQL (interno) |

---

## 🧪 Testing y Calidad

### 🔬 Ejecutar Tests Locales
```bash
# Tests completos (backend + frontend + integración)
./scripts/test-local.sh

# Solo tests backend
cd backend && python -m pytest test/ -v

# Solo tests frontend
cd frontend && npm test
```

### 📊 Cobertura de Código
```bash
# Backend con cobertura
cd backend && python -m pytest test/ --cov=src --cov-report=html

# Frontend con cobertura
cd frontend && npm test -- --coverage
```

### 🔍 Linting y Formateo
```bash
# Python (backend)
cd backend
black .
isort .
flake8 .

# JavaScript (frontend)
cd frontend
npm run lint
```

---

## 🔄 GitFlow y CI/CD

Este proyecto utiliza **GitFlow** con CI/CD automatizado:

### 🌊 Flujo de Ramas
```
master ──────────────────► Production (v1.0.0, v1.1.0...)
  ↑
develop ─────────────────► Staging Environment
  ↑
feature/* ───────────────► Development & Testing
release/* ───────────────► Release Preparation
hotfix/* ────────────────► Critical Fixes
```

### 🤖 Automatización
```bash
# Helper para GitFlow
chmod +x scripts/gitflow-helper.sh

# Crear nueva feature
./scripts/gitflow-helper.sh feature nueva-funcionalidad

# Finalizar feature
./scripts/gitflow-helper.sh finish-feature

# Crear release
./scripts/gitflow-helper.sh release 1.2.0
```

### 🚀 Pipeline CI/CD
- ✅ **CI**: Tests automáticos en cada push/PR
- 🚀 **CD**: Deploy automático a staging (develop) y producción (tags)
- 📊 **Quality**: Linting, cobertura, y análisis de código
- 🐳 **Docker**: Build y push automático de imágenes

---

## 🛠️ Desarrollo

### 📁 Estructura del Proyecto
```
BDAT/
├── 📂 backend/              # API Flask + lógica científica
│   ├── 📂 src/             # Código fuente
│   ├── 📂 test/            # Tests unitarios
│   └── 📄 requirements.txt # Dependencias Python
├── 📂 frontend/            # Aplicación React
│   ├── 📂 src/             # Componentes React
│   ├── 📂 public/          # Assets estáticos
│   └── 📄 package.json     # Dependencias Node.js
├── 📂 database/            # Configuración MySQL
├── 📂 scripts/             # Scripts de automatización
│   ├── 🔧 dev.sh           # Entorno desarrollo
│   ├── 🧪 test-local.sh    # Tests locales
│   └── 🚀 deploy.sh        # Deployment
├── 📂 docs/                # Documentación
├── 📂 .github/             # CI/CD workflows
└── 🐳 docker-compose.yml   # Orquestación Docker
```

### 🔧 Comandos Útiles
```bash
# Ver logs de servicios
docker-compose logs -f backend
docker-compose logs -f mysql

# Acceder a contenedor
docker-compose exec backend bash
docker-compose exec mysql mysql -u root -p

# Reiniciar servicios
docker-compose restart backend
docker-compose restart mysql

# Limpiar y reconstruir
docker-compose down -v
docker-compose up --build
```

---

## 📚 Documentación Adicional

- 📖 [**Guía de CI/CD**](docs/CI-CD.md) - Pipeline completo y deployment
- 🧪 [**Testing Guide**](docs/testing.md) - Estrategias de testing
- 🔬 [**Scientific Computing**](docs/scientific.md) - Algoritmos y simulaciones
- 🐳 [**Docker Guide**](docs/docker.md) - Containerización avanzada

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch: `./scripts/gitflow-helper.sh feature mi-feature`
3. Commit cambios: `git commit -m 'feat: add amazing feature'`
4. Push branch: `git push origin feature/mi-feature`
5. Crear Pull Request

### 📝 Convenciones
- **Commits**: [Conventional Commits](https://conventionalcommits.org/)
- **Branches**: GitFlow (feature/, release/, hotfix/)
- **Code Style**: Black (Python) + ESLint (JavaScript)

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

## 👥 Autores

- **Tu Nombre** - *Desarrollo Principal* - [@tu-usuario](https://github.com/tu-usuario)

---

## 🙏 Agradecimientos

- Comunidad científica por los algoritmos de simulación
- Contribuidores del proyecto FEniCS
- Equipo de desarrollo de React y Flask

---

<div align="center">

**🦴 BDAT - Advancing Bone Analysis Through Technology 🦴**

[![GitHub stars](https://img.shields.io/github/stars/your-username/BDAT?style=social)](https://github.com/your-username/BDAT/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/your-username/BDAT?style=social)](https://github.com/your-username/BDAT/network)

</div>