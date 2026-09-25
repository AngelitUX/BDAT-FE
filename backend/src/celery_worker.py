#!/usr/bin/env python
"""
Celery Worker para ejecutar tareas de simulación en background
"""
from celery import Celery
import os

# Crear instancia de Celery con la misma configuración que el backend
celery = Celery(
    'app',
    broker=os.getenv('CELERY_BROKER_URL', 'redis://host.docker.internal:6379/0'),
    backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://host.docker.internal:6379/0')
)

# Configuración de Celery
celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Argentina/Buenos_Aires',
    enable_utc=True,
    task_track_started=True,
    task_send_sent_event=True,
    worker_send_task_events=True,
    result_expires=86400,
    broker_transport_options={
        'visibility_timeout': 1209600,  # 14 días: evita que Redis reencole tareas largas
    },
    worker_prefetch_multiplier=1,
    task_acks_late=False,
)

# Registrar tareas
from features.simulations.tasks.simulation_tasks import run_simulation_task, batch_import_task

# Decorar la función como tarea de Celery
@celery.task(name='simulations.run_simulation', bind=True)
def run_simulation_celery_task(self, sim_id, simulation_params):
    """
    Tarea de Celery para ejecutar simulación
    """
    return run_simulation_task(sim_id, simulation_params)


@celery.task(name='simulations.batch_import', bind=True)
def batch_import_celery_task(self, simulations_data):
    """
    Tarea de Celery para importar batch de simulaciones en el servidor.
    Sobrevive recargas de página: el worker sigue corriendo aunque el browser se cierre.
    """
    return batch_import_task(simulations_data)


if __name__ == '__main__':
    celery.start()
