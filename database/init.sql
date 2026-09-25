DROP DATABASE IF EXISTS BDAT_FE_simulations;
CREATE DATABASE IF NOT EXISTS BDAT_FE_simulations;
USE BDAT_FE_simulations;

CREATE TABLE IF NOT EXISTS simulation (
  id INT NOT NULL AUTO_INCREMENT,
  sim_name VARCHAR(255) NOT NULL,
  n_transmitter INT NOT NULL,
  n_receiver INT NOT NULL,
  emitters_pitch FLOAT DEFAULT NULL,
  receivers_pitch FLOAT DEFAULT NULL,
  sensor_width FLOAT DEFAULT NULL,
  sensor_distance FLOAT DEFAULT NULL,
  sensor_edge_margin FLOAT DEFAULT NULL,
  typical_mesh_size FLOAT DEFAULT NULL,
  plate_thickness FLOAT DEFAULT NULL,
  plate_length FLOAT DEFAULT NULL,
  porosity DECIMAL(10,0) NOT NULL, 
  attenuation FLOAT DEFAULT NULL, 
  result_step_01 TEXT NULL,
  p_status TEXT NULL,
  task_id VARCHAR(255) NULL COMMENT 'ID de la tarea de Celery asociada a esta simulación',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  start_datetime DATETIME DEFAULT NULL,
  finish_datetime DATETIME DEFAULT NULL,
  time TIME DEFAULT NULL,
  image LONGBLOB NULL,
  mesh_type VARCHAR(255) DEFAULT NULL,
  xml_file VARCHAR(255) DEFAULT NULL,
  msh_file VARCHAR(255) DEFAULT NULL,
  result_file VARCHAR(255) DEFAULT NULL,
  execution_time FLOAT DEFAULT NULL,
  queue_order INT DEFAULT NULL,
  skin_layer_config VARCHAR(20) DEFAULT 'none' COMMENT 'Skin layer configuration: none, top, bottom, or both',
  skin_thickness_top DECIMAL(5,2) DEFAULT 1.30 COMMENT 'Thickness of top skin layer in mm',
  skin_thickness_bottom DECIMAL(5,2) DEFAULT 1.30 COMMENT 'Thickness of bottom skin layer in mm',
  mesh_angle DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Angle of mesh inclination in degrees (0-90)',
  mesh_angle_direction VARCHAR(10) DEFAULT 'none' COMMENT 'Direction of angle: left, right, or none',
  file_data LONGBLOB NULL,
  roughness DECIMAL(5,2) DEFAULT 0.2 COMMENT 'Amplitude of mesh porosity in mm',
  PRIMARY KEY (id)
);    

CREATE INDEX idx_queue_order ON simulation(queue_order);
CREATE INDEX idx_task_id ON simulation(task_id);

-- Actualizar root user a caching_sha2_password
ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'BDATpassword';
ALTER USER 'root'@'%' IDENTIFIED WITH caching_sha2_password BY 'BDATpassword';

-- Crear usuario moderno
DROP USER IF EXISTS 'UserBDAT'@'%';
CREATE USER 'UserBDAT'@'%' IDENTIFIED WITH caching_sha2_password BY 'BDATpassword';
GRANT ALL PRIVILEGES ON BDAT_FE_simulations.* TO 'UserBDAT'@'%';
FLUSH PRIVILEGES;

-- ─── Batch Import Session ───────────────────────────────────────────────────
-- Single-row table (id=1) used as the source of truth for the current
-- batch import session. Survives page reloads and server restarts.
CREATE TABLE IF NOT EXISTS import_session (
  id          INT         NOT NULL DEFAULT 1,
  active      TINYINT(1)  NOT NULL DEFAULT 0,
  total       INT         NOT NULL DEFAULT 0,
  current_index INT       NOT NULL DEFAULT 0,
  current_name  VARCHAR(512) NOT NULL DEFAULT '',
  task_id     VARCHAR(255) NULL COMMENT 'Celery task ID for the running batch import',
  started_at  DATETIME    DEFAULT NULL,
  updated_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Seed with an inactive session row so UPDATE always finds a row
INSERT IGNORE INTO import_session (id, active) VALUES (1, 0);
