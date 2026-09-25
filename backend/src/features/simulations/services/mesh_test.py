import os
from mesh_service import create_rectangle_mesh  # ajusta el nombre si tu archivo es distinto


def run_single_test(zlim, ylim, dxt, mesh_angle, mesh_angle_direction, porosity, roughness, n_transmitter, n_receiver, emitter_pitch, receiver_pitch, sensor_distance, sensor_edge_margin, filename, use_porosity):
    """
    Ejecuta una simulación simple para verificar que todo funciona.
    """
    print("Running single mesh test...")
    L_calculated = (
        2 * sensor_edge_margin
        + (n_transmitter - 1) * emitter_pitch
        + (n_receiver - 1) * receiver_pitch
        + sensor_distance
    )
    output_xml, output_msh = create_rectangle_mesh(
        zlim=L_calculated,
        ylim=ylim,
        dxt=dxt,
        mesh_angle=mesh_angle,
        mesh_angle_direction=mesh_angle_direction,
        porosity=porosity,
        roughness=roughness,
        n_transmitter=n_transmitter,
        n_receiver=n_receiver,
        emitter_pitch=emitter_pitch,
        receiver_pitch=receiver_pitch,
        sensor_distance=sensor_distance,
        sensor_edge_margin=sensor_edge_margin,
        filename="test_mesh",
        use_porosity=True
    )

    print("Generated files:")
    print("XML:", output_xml)
    print("MSH:", output_msh)


def run_batch_tests():
    """
    Ejecuta múltiples configuraciones (útil para validar robustez).
    """
    print("Running batch tests...")

    base_folder = "meshes"
    os.makedirs(base_folder, exist_ok=True)

    count = 0

    for i in range(5):
        filename = os.path.join(base_folder, f"mesh_{i}")

        output_xml, output_msh = create_rectangle_mesh(
            zlim=100 + i * 10,
            ylim=20,
            dxt=0.5,
            mesh_angle=i * 2,
            mesh_angle_direction='right' if i % 2 == 0 else 'left',
            porosity=1,
            roughness=0.2 + 0.05 * i,
            n_transmitter=1,
            n_receiver=20,
            emitter_pitch=1.0,
            receiver_pitch=0.5,
            sensor_distance=10 + i,
            sensor_edge_margin=10,
            filename=filename,
            use_porosity=True
        )

        print(f"[{i}] -> XML: {output_xml}, MSH: {output_msh}")
        count += 1

    print(f"Batch completed: {count} meshes generated")


if __name__ == "__main__":
    # Puedes elegir cuál correr
    run_single_test(
        zlim=100,
        ylim=3,
        dxt=0.9,
        mesh_angle=0,
        mesh_angle_direction='right',
        porosity=10,
        roughness=0,
        n_transmitter=1,
        n_receiver=30,
        emitter_pitch=1.0,
        receiver_pitch=0.8,
        sensor_distance=20,
        sensor_edge_margin=10,
        filename="test_mesh",
        use_porosity=True
    )
    # run_batch_tests()