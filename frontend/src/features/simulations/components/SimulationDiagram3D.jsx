import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * 3D Simulation Representation Layer using Additive-Blending Particles & Wireframe
 */
export default function SimulationDiagram3D({ formData }) {
    const mountRef = useRef(null);

    // ── Parse params (Mapping form data to graphic configuration) ──
    const params = useMemo(() => {
        const plateThickness = Math.max(parseFloat(formData?.plate_thickness) || 2, 0.5);
        const sensorDist = Math.max(parseFloat(formData?.sensor_distance) || 5, 0.1);
        const edgeMargin = Math.max(parseFloat(formData?.sensor_edge_margin) || 1, 0);
        const realNTrans = parseInt(formData?.n_transmitter) || 0;
        const realNRec = parseInt(formData?.n_receiver) || 0;
        const nTrans = realNTrans;
        const nRec = realNRec;
        const emitPitch = Math.max(parseFloat(formData?.emitters_pitch) || 1, 0.1);
        const recPitch = Math.max(parseFloat(formData?.receivers_pitch) || 1, 0.1);
        const porosity = Math.min(parseFloat(formData?.porosity) || 0, 100);
        const meshAmplitude = parseFloat(formData?.roughness) || 0;
        const meshAngle = parseFloat(formData?.mesh_angle) || 0;
        const meshAngleDir = formData?.mesh_angle_direction || 'none';

        const transWidth = realNTrans > 1 ? (realNTrans - 1) * emitPitch : 0;
        const recWidth = realNRec > 1 ? (realNRec - 1) * recPitch : 0;

        // True mathematical sizes for UI summary matching the backend explicitly
        const plateLength = transWidth + recWidth + sensorDist + (2 * edgeMargin);

        const plateDepth = 0.001; // Following user's 2D representation

        // Calculate mapped angle
        let computedAngle = meshAngle;
        if (meshAngleDir === 'right') computedAngle = -meshAngle;
        else if (meshAngleDir === 'left') computedAngle = meshAngle;
        else computedAngle = 0;

        return {
            plateThickness, sensorDist, edgeMargin, nTrans, nRec, emitPitch, recPitch,
            porosity, meshAmplitude, computedAngle, plateLength, plateDepth,
            realNTrans, realNRec
        };
    }, [formData]);

    // ── Summary Header ──
    const { plateThickness, realNTrans, realNRec, plateLength } = params;
    const summary = [
        { label: 'Length', value: `${plateLength.toFixed(1)} mm` },
        { label: 'Thickness', value: `${plateThickness.toFixed(1)} mm` },
        { label: 'Tx', value: realNTrans, color: 'text-emerald-500 font-bold' },
        { label: 'Rx', value: realNRec, color: 'text-red-500 font-bold' }
    ];

    // ── Three.js Scene Setup ──
    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;

        // The container is now much wider (~760px). Provide a solid fallback
        const W = el.clientWidth || 740;
        const H = el.clientHeight || 420;

        // Fix exactly to the perfect visual initial boundaries the user requested (10 wide, 5 high)
        const config = {
            rectWidth: 10,
            rectHeight: 5,
            rectDepth: 0.001,
        };

        const scaleX = config.rectWidth / params.plateLength;

        const angle = params.computedAngle;
        const roughness = params.meshAmplitude;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf6f7f9);

        // Find the maximum dimension to keep everything visible
        const maxDim = Math.max(config.rectWidth, config.rectHeight);

        // Responsive camera positioning depending on plate size
        // Lower FOV (45 instead of 60) reduces perspective distortion on small objects
        const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
        // Position camera to fit the bounding box but exactly tight
        camera.position.set(0, maxDim * 0.1, maxDim * 1.05);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        el.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        // Restrict massive zoom outs/ins based on dynamic size
        controls.minDistance = maxDim * 0.2;
        controls.maxDistance = maxDim * 3.0;

        scene.add(new THREE.AmbientLight(0xffffff, 0.9));

        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(maxDim, maxDim, maxDim);
        scene.add(light);

        // Calculate dynamic grid divisions based on final dimensions so it stays proportional
        let divisionsX = Math.round(config.rectWidth * 3);
        let divisionsY = Math.round(config.rectHeight * 3);

        // Keep divisions within safe limits to avoid killing performance if numbers get high
        divisionsX = Math.max(10, Math.min(divisionsX, 150));
        divisionsY = Math.max(10, Math.min(divisionsY, 150));

        // Create base box geometry
        const geometry = new THREE.BoxGeometry(
            config.rectWidth,
            config.rectHeight,
            config.rectDepth,
            divisionsX,
            divisionsY,
            1
        );

        const pos = geometry.attributes.position;
        const angleRad = THREE.MathUtils.degToRad(angle);

        // Apply roughness mathematically and bottom face inclination
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);

            // Calculate inclination shift
            // Top (y = +2.5) has 0 shift. Bottom (y = -2.5) has maximum shift.
            const depthFactor = (config.rectHeight / 2 - y) / config.rectHeight;
            const inclineOffset = Math.tan(angleRad) * x * depthFactor;

            let newY = y + inclineOffset;

            // Apply offset on bottom boundary for roughness
            if (y < -config.rectHeight / 2 + 0.05) {
                // Stable pseudo-random based on vertex index so the shape never flickers
                const r = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
                const stableRandom = r - Math.floor(r);
                const roughOffset = (stableRandom - 0.5) * roughness;
                newY += roughOffset;
            }

            pos.setY(i, newY);
        }
        pos.needsUpdate = true;

        // Proportional Space Allocation mapped into the 10-unit width
        const transStartX = (-params.plateLength / 2 + params.edgeMargin) * scaleX;
        const scaledEmitPitch = params.emitPitch * scaleX;
        const firstEmitter = transStartX;

        const recStartX = (-params.plateLength / 2 + params.edgeMargin + params.sensorDist) * scaleX;
        const scaledRecPitch = params.recPitch * scaleX;
        const lastReceiver = recStartX + (params.nRec > 1 ? (params.nRec - 1) * scaledRecPitch : 0);

        const filtered = [];

        // Apply dense distribution within sensor zone, fade outside
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);

            let densityFactor;
            if (x > firstEmitter && x < lastReceiver) {
                densityFactor = 1;
            } else {
                const dist = Math.min(
                    Math.abs(x - firstEmitter),
                    Math.abs(x - lastReceiver)
                );
                const maxDist = config.rectWidth / 2;
                densityFactor = 1 - Math.min(dist / maxDist, 1);
                densityFactor *= densityFactor;
            }

            // Influence of general porosity parameter
            if (params.porosity > 0) {
                densityFactor *= (1 - (params.porosity / 250)); // mild reduction based on porosity
            }

            // Stable pseudo-random based on vertex index
            const r = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
            const stableRandom = r - Math.floor(r);

            if (stableRandom < densityFactor) {
                filtered.push(x, y, z);
            }
        }

        const filteredGeometry = new THREE.BufferGeometry();
        filteredGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(filtered, 3)
        );

        // Generate glowing point texture synthetically
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(0.3, "rgba(255,255,255,0.9)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);

        // Calculate dynamic particle size
        const baseParticleSize = maxDim * 0.025; // made thicker so they are more noticeable

        const pointsMaterial = new THREE.PointsMaterial({
            map: texture,
            color: 0x444444,
            size: baseParticleSize,
            transparent: true,
            depthWrite: false, // ensures additive blending works without depth clipping
            blending: THREE.AdditiveBlending
        });

        const pointMesh = new THREE.Points(filteredGeometry, pointsMaterial);
        scene.add(pointMesh);

        // Add matching wireframe
        const wire = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            new THREE.LineBasicMaterial({
                color: 0x999999,
                transparent: true,
                opacity: 0.25
            })
        );
        scene.add(wire);

        // Rectangular box geometries dynamically sized for sensors. Make sure they NEVER exceed their own pitch
        // to prevent overlapping "solid color bars".
        const maxEmitWidthForPitch = scaledEmitPitch * 0.8;
        const maxRecWidthForPitch = scaledRecPitch * 0.8;
        const emitSensorWidth = Math.min(config.rectWidth * 0.02, maxEmitWidthForPitch);
        const recSensorWidth = Math.min(config.rectWidth * 0.02, maxRecWidthForPitch);
        
        const emitSensorGeo = new THREE.BoxGeometry(emitSensorWidth, emitSensorWidth * 0.8, emitSensorWidth * 0.8);
        const recSensorGeo = new THREE.BoxGeometry(recSensorWidth, recSensorWidth * 0.8, recSensorWidth * 0.8);

        const emitterMat = new THREE.MeshStandardMaterial({
            color: 0x2ecc71,
            emissive: 0x2ecc71,
            emissiveIntensity: 0.4
        });
        const receiverMat = new THREE.MeshStandardMaterial({
            color: 0xe74c3c,
            emissive: 0xe74c3c,
            emissiveIntensity: 0.4
        });

        const yPos = config.rectHeight / 2;
        const sensorGroup = new THREE.Group();

        // Position Emitters (Green)
        for (let i = 0; i < params.nTrans; i++) {
            const emitter = new THREE.Mesh(emitSensorGeo, emitterMat);
            emitter.position.set(transStartX + i * scaledEmitPitch, yPos + emitSensorWidth * 0.8 / 2, 0.1);
            sensorGroup.add(emitter);
        }

        // Position Receivers (Red)
        for (let i = 0; i < params.nRec; i++) {
            const receiver = new THREE.Mesh(recSensorGeo, receiverMat);
            receiver.position.set(recStartX + i * scaledRecPitch, yPos + recSensorWidth * 0.8 / 2, 0.1);
            sensorGroup.add(receiver);
        }

        scene.add(sensorGroup);

        // Animation setup
        let time = 0;
        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            time += 0.03;
            // Pulsing particle sizes dynamically based on original base particle size
            pointsMaterial.size = baseParticleSize + Math.sin(time) * (baseParticleSize * 0.15);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Responsive Resizing safely via timeout
        let resizeTid;
        const ro = new ResizeObserver((entries) => {
            if (!entries.length || !el) return;
            clearTimeout(resizeTid);
            resizeTid = setTimeout(() => {
                if (!el) return;
                const nW = el.clientWidth;
                const nH = el.clientHeight;
                if (nW === 0 || nH === 0) return;

                camera.aspect = nW / nH;
                camera.updateProjectionMatrix();
                renderer.setSize(nW, nH);
            }, 10);
        });
        ro.observe(el);

        // Cleanup
        return () => {
            if (animId) window.cancelAnimationFrame(animId);
            clearTimeout(resizeTid);
            ro.disconnect();
            controls.dispose();
            renderer.dispose();
            scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
    }, [params]);

    return (
        <div className="w-full h-full flex flex-col gap-0 min-h-0 bg-[#f6f7f9] rounded-xl overflow-hidden shadow-inner">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
                {summary.map(({ label, value, color = 'text-gray-700' }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">{label}</span>
                        <span className={`text-xs ${color}`}>{value}</span>
                    </div>
                ))}
            </div>

            <div
                ref={mountRef}
                className="flex-1 min-h-0 w-full"
                style={{ minHeight: 320 }}
            />
        </div>
    );
}
