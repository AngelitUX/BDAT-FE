# app.py
import eventlet
eventlet.monkey_patch()

import os
import sys
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_mysqldb import MySQL
from flask_cors import CORS
from flask_socketio import SocketIO

# -----------------------------
# Configuración básica
# -----------------------------
load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MESH_FOLDER = os.path.join(BASE_DIR, "features", "simulations", "meshes")
os.makedirs(MESH_FOLDER, exist_ok=True)

# Añadir rutas legacy si es necesario
DOCKER_ROUTE = "src/features/simulations/services/Reidmen/"
FENICS_PATH = os.path.join(DOCKER_ROUTE, "Reidmen Fenics/ipnyb propagation")
if FENICS_PATH not in sys.path:
    sys.path.append(FENICS_PATH)

# -----------------------------
# Función para crear aplicación
# -----------------------------
def create_app():
    app = Flask(__name__)
    app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST', 'mysql')
    app.config['MYSQL_USER'] = os.getenv('MYSQL_USER')
    app.config['MYSQL_PORT'] = int(os.getenv('MYSQL_PORT', 3306))
    app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD')
    app.config['MYSQL_DB'] = os.getenv('MYSQL_DB')
    app.config['CORS_HEADERS'] = os.getenv('CORS_HEADERS', 'Content-Type')
    app.config['SQLALCHEMY_POOL_RECYCLE'] = 28800
    app.config['MESH_FOLDER'] = MESH_FOLDER
    app.secret_key = os.getenv('SECRET_KEY', '110997')
    
    # Configuración de Celery
    app.config['CELERY_BROKER_URL'] = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
    app.config['CELERY_RESULT_BACKEND'] = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
    
    # Inicializar extensiones
    mysql = MySQL(app)
    
    # Configurar SocketIO con Redis para comunicación entre procesos (Flask + Celery)
    redis_url = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
    socketio = SocketIO(
        app, 
        cors_allowed_origins="*", 
        async_mode='eventlet',
        message_queue=redis_url,  # ✅ Permite que Celery emita WebSockets
        logger=False,         # Silencia logs de cada frame WS
        engineio_logger=False, # Silencia logs de engine.io (pings, etc.)
        ping_timeout=60,      # Tiempo antes de considerar conexión caída
        ping_interval=25,     # Intervalo de keepalive ping
    )
    CORS(app, expose_headers=["Content-Disposition"])
    
    # Exponer en app para acceso en workers
    app.mysql = mysql
    app.socketio = socketio
    
    return app

# Crear instancia de la aplicación
app = create_app()

# Hacer accesibles globalmente para backward compatibility
mysql = app.mysql
socketio = app.socketio

# Inicializar Celery
from celery_config import make_celery
celery = make_celery(app)
app.celery = celery

# -----------------------------
# Importar y registrar blueprints
# -----------------------------
from features.simulations.controllers.simulations_controller import simulations_bp
app.register_blueprint(simulations_bp)

# -----------------------------
# Endpoints de prueba / status
# -----------------------------
@app.route('/')
def index():
    return '<h1>API is Working</h1>'

@app.route('/health')
def health_check():
    """Check backend basic health"""
    return {'status': 'healthy', 'message': 'Backend service running'}, 200

@app.route('/health/full')
def full_health_check():
    """Check backend + DB connectivity"""
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        return {'status': 'healthy', 'database': 'connected', 'message': 'All systems operational'}, 200
    except Exception as e:
        return {'status': 'unhealthy', 'database': 'disconnected', 'error': str(e)}, 500

@app.route('/fenics-status')
def fenics_status():
    """Check FEniCS availability"""
    try:
        from features.simulations.services.simulations_service import FENICS_AVAILABLE, LEGACY_FENICS_AVAILABLE
        dolfin_available = False
        dolfin_version = None
        try:
            import dolfin
            dolfin_available = True
            dolfin_version = dolfin.__version__
        except ImportError:
            pass

        status = {
            'fenics_available': FENICS_AVAILABLE,
            'dolfin_available': dolfin_available,
            'dolfin_version': dolfin_version,
            'legacy_fenics_available': LEGACY_FENICS_AVAILABLE,
            'python_version': sys.version,
            'recommended_mode': 'local' if dolfin_available else 'docker'
        }
        return jsonify({'status': 'success', 'fenics_status': status})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

# -----------------------------
# Run server
# -----------------------------
if __name__ == '__main__':
    import eventlet
    import eventlet.wsgi
    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)  # opcional

    # FORZAR eventlet
    # use_reloader=False es NECESARIO cuando se usa watchmedo desde docker-compose.
    # Si se deja en True, Flask genera archivos .pyc que watchmedo detecta
    # como cambios, creando un loop infinito de reinicios.
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=False,  # watchmedo maneja el reload externamente
    )
