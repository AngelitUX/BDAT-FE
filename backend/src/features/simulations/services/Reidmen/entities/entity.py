from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, DateTime, engine
from sqlalchemy.ext import declarative
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql.expression import update
from sqlalchemy.orm  import sessionmaker

db_url = 'localhost'
# se debe crear la bd antes, create dabase `proyecto-v01`
db_name = 'proyecto-v01'
db_user = 'root'
db_password = 'Manimanito110997'
engine = create_engine(f'mysql+pymysql://{db_user}:{db_password}@{db_url}/{db_name}')
Session = sessionmaker(bind=engine)

Base = declarative_base()

class Entity():
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    last_updated_by = Column(String(16))

    def __init__(self, created_by):
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.last_updated_by = created_by

# Copiar la clase Simulation a models/simulation.py