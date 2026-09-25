
import gmsh
import math
import random
import os

from mesh_service import create_rectangle_mesh



if __name__ == "__main__":
    create_rectangle_mesh(
        ylim=2, 
        dxt=0.5,
        mesh_angle=1,        
        mesh_angle_direction='left',
        porosity=10,
        # Parametros de ejemplo para refinamiento
        n_transmitter=1,
        n_receiver=5,
        emitter_pitch=1.0,
        receiver_pitch=2.0,
        sensor_distance=20.0,
        sensor_edge_margin=10.0,
        filename="mesh"
    )