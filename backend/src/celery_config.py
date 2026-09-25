from celery import Celery
import os

def make_celery(app):
    """
    Crea instancia de Celery configurada con Flask
    """
    celery = Celery(
        app.import_name,
        broker=os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0'),
        backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
    )
    
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
    
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    return celery
