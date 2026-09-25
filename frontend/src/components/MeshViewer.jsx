import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const MeshViewer = ({ simulationId, meshData, width = 600, height = 400 }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    mountRef.current.appendChild(renderer.domElement);

    // Simple orbit controls (if available)
    if (typeof window !== 'undefined' && window.THREE && window.THREE.OrbitControls) {
      const controls = new window.THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controlsRef.current = controls;
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [width, height]);

  useEffect(() => {
    if (!sceneRef.current || !meshData) return;

    setIsLoading(true);
    setError(null);

    try {
      // Clear existing mesh
      const existingMesh = sceneRef.current.getObjectByName('simulationMesh');
      if (existingMesh) {
        sceneRef.current.remove(existingMesh);
      }

      // Create mesh from data
      const mesh = createMeshFromData(meshData);
      if (mesh) {
        mesh.name = 'simulationMesh';
        sceneRef.current.add(mesh);
        
        // Add sensors if available
        if (meshData.sensors) {
          addSensorsToScene(meshData.sensors);
        }

        // Adjust camera to fit mesh
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = cameraRef.current.fov * (Math.PI / 180);
        const cameraDistance = Math.abs(maxDim / Math.sin(fov / 2));

        cameraRef.current.position.set(
          center.x + cameraDistance * 0.5,
          center.y + cameraDistance * 0.5,
          center.z + cameraDistance * 0.5
        );
        cameraRef.current.lookAt(center);

        if (controlsRef.current) {
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
    } catch (err) {
      setError(`Error loading mesh: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [meshData]);

  const createMeshFromData = (data) => {
    if (!data || !data.vertices || !data.faces) {
      // Create a simple demo mesh if no data provided
      return createDemoMesh();
    }

    // Create geometry from vertices and faces
    const geometry = new THREE.BufferGeometry();
    
    // Set vertices
    const vertices = new Float32Array(data.vertices.flat());
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Set faces (indices)
    if (data.faces && data.faces.length > 0) {
      const indices = new Uint16Array(data.faces.flat());
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    // Compute normals for lighting
    geometry.computeVertexNormals();

    // Create material
    const material = new THREE.MeshLambertMaterial({
      color: 0x2196F3,
      wireframe: false,
      transparent: true,
      opacity: 0.8
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  };

  const createDemoMesh = () => {
    // Create a simple rectangular mesh for demonstration
    const geometry = new THREE.PlaneGeometry(10, 2);
    const material = new THREE.MeshLambertMaterial({
      color: 0x4CAF50,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    return mesh;
  };

  const toggleWireframe = () => {
    const mesh = sceneRef.current?.getObjectByName('simulationMesh');
    if (mesh && mesh.material) {
      mesh.material.wireframe = !mesh.material.wireframe;
    }
  };

  const addSensorsToScene = (sensors) => {
    // Remove existing sensors
    const existingSensors = sceneRef.current.getObjectByName('sensors');
    if (existingSensors) {
      sceneRef.current.remove(existingSensors);
    }

    const sensorsGroup = new THREE.Group();
    sensorsGroup.name = 'sensors';

    // Add transmitters (red spheres)
    if (sensors.transmitters) {
      sensors.transmitters.forEach((transmitter, index) => {
        const geometry = new THREE.SphereGeometry(0.1, 8, 6);
        const material = new THREE.MeshLambertMaterial({ color: 0xff4444 });
        const sphere = new THREE.Mesh(geometry, material);
        
        sphere.position.set(
          transmitter.position[0],
          transmitter.position[1],
          transmitter.position[2]
        );
        
        sensorsGroup.add(sphere);
        
        // Add label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 64, 32);
        context.fillStyle = '#000000';
        context.font = '12px Arial';
        context.fillText(`T${index + 1}`, 8, 20);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(
          transmitter.position[0],
          transmitter.position[1] + 0.3,
          transmitter.position[2]
        );
        sprite.scale.set(0.5, 0.25, 1);
        sensorsGroup.add(sprite);
      });
    }

    // Add receivers (blue spheres)
    if (sensors.receivers) {
      sensors.receivers.forEach((receiver, index) => {
        const geometry = new THREE.SphereGeometry(0.1, 8, 6);
        const material = new THREE.MeshLambertMaterial({ color: 0x4444ff });
        const sphere = new THREE.Mesh(geometry, material);
        
        sphere.position.set(
          receiver.position[0],
          receiver.position[1],
          receiver.position[2]
        );
        
        sensorsGroup.add(sphere);
        
        // Add label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 64, 32);
        context.fillStyle = '#000000';
        context.font = '12px Arial';
        context.fillText(`R${index + 1}`, 8, 20);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(
          receiver.position[0],
          receiver.position[1] + 0.3,
          receiver.position[2]
        );
        sprite.scale.set(0.5, 0.25, 1);
        sensorsGroup.add(sprite);
      });
    }

    sceneRef.current.add(sensorsGroup);
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(10, 10, 10);
      cameraRef.current.lookAt(0, 0, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative border border-gray-300 rounded-lg overflow-hidden">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={toggleWireframe}
          className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
        >
          Wireframe
        </button>
        <button
          onClick={resetCamera}
          className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
        >
          Reset View
        </button>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading mesh...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-20">
          <div className="text-center p-4">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white bg-opacity-75 px-2 py-1 rounded">
        Simulation ID: {simulationId || 'Demo'}
      </div>

      <div ref={mountRef} style={{ width, height }} />
    </div>
  );
};

export default MeshViewer;
