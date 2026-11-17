import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCw, Compass, ZoomIn, ZoomOut, RefreshCw, Sun, Moon, Sunset, Layers, Box, Info } from 'lucide-react';

export default function Embedded3DViewer({ property, isMobile = false }) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState('day');
  const [cameraView, setCameraView] = useState('perspective');

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const lightsRef = useRef({});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

    // 2. Camera
    const aspect = width / height;
    const initialFov = aspect < 1 ? 52 : 45;
    const camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 1000);
    if (aspect < 1) {
      camera.position.set(18, 14, 20);
    } else {
      camera.position.set(14, 10, 16);
    }
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
    controls.minDistance = 5;
    controls.maxDistance = 45;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.0;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    dirLight.position.set(18, 25, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-15, 12, -10);
    scene.add(fillLight);

    lightsRef.current = { ambient: ambientLight, dir: dirLight, fill: fillLight };

    // 6. Ground & Environment
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x1e293b, 
      roughness: 0.85, 
      metalness: 0.1 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(50, 50, 0x10b981, 0x334155);
    grid.position.y = 0.01;
    scene.add(grid);

    // 7. Property-Specific Architecture Generator
    const propType = (property?.propertyType || property?.category || 'villa').toLowerCase();
    const isLand = propType.includes('plot') || propType.includes('land') || propType.includes('agricultural');
    const isCommercial = propType.includes('commercial') || propType.includes('shop');
    const isPG = propType.includes('pg') || propType.includes('hostel');

    const buildingGroup = new THREE.Group();

    if (isLand) {
      // Plotted Cadastral Layout with boundary boundary stones & survey flags
      const plotGeo = new THREE.BoxGeometry(16, 0.3, 12);
      const plotMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
      const plotMesh = new THREE.Mesh(plotGeo, plotMat);
      plotMesh.position.y = 0.15;
      plotMesh.receiveShadow = true;
      buildingGroup.add(plotMesh);

      // Boundary Fencing Pillars
      const cornerGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8);
      const cornerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      [[-7.8, -5.8], [7.8, -5.8], [-7.8, 5.8], [7.8, 5.8]].forEach(([x, z]) => {
        const pillar = new THREE.Mesh(cornerGeo, cornerMat);
        pillar.position.set(x, 0.9, z);
        pillar.castShadow = true;
        buildingGroup.add(pillar);
      });
    } else if (isCommercial) {
      // Commercial Building with Glass Facade
      const bldgGeo = new THREE.BoxGeometry(10, 8, 8);
      const bldgMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.2, metalness: 0.7 });
      const bldg = new THREE.Mesh(bldgGeo, bldgMat);
      bldg.position.y = 4;
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      buildingGroup.add(bldg);

      // Glass panels
      const glassGeo = new THREE.BoxGeometry(10.1, 7.2, 7.8);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        transmission: 0.8
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = 4;
      buildingGroup.add(glass);
    } else if (isPG) {
      // Multi-room hostel / PG structure
      const pgGeo = new THREE.BoxGeometry(12, 7, 7);
      const pgMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });
      const pgBldg = new THREE.Mesh(pgGeo, pgMat);
      pgBldg.position.y = 3.5;
      pgBldg.castShadow = true;
      buildingGroup.add(pgBldg);

      // Windows grid
      for (let floor = 1; floor <= 2; floor++) {
        for (let col = -4; col <= 4; col += 2) {
          const winGeo = new THREE.BoxGeometry(1.2, 1.4, 0.2);
          const winMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x164e63 });
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(col, floor * 2.3, 3.52);
          buildingGroup.add(win);
        }
      }
    } else {
      // Luxury Contemporary Villa / Apartment
      // Main Ground Floor
      const groundFloorGeo = new THREE.BoxGeometry(9, 3.5, 8);
      const groundFloorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
      const groundFloor = new THREE.Mesh(groundFloorGeo, groundFloorMat);
      groundFloor.position.y = 1.75;
      groundFloor.castShadow = true;
      groundFloor.receiveShadow = true;
      buildingGroup.add(groundFloor);

      // Cantilever Upper Floor
      const upperGeo = new THREE.BoxGeometry(8, 3.2, 7);
      const upperMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 });
      const upperFloor = new THREE.Mesh(upperGeo, upperMat);
      upperFloor.position.set(1, 4.9, 0.5);
      upperFloor.castShadow = true;
      buildingGroup.add(upperFloor);

      // Floor-to-ceiling glass frontage
      const glassGeo = new THREE.BoxGeometry(6.5, 2.5, 0.2);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        transmission: 0.7
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(0.5, 4.9, 4.02);
      buildingGroup.add(glass);

      // Terrace solar pergola
      const pergolaGeo = new THREE.BoxGeometry(6, 0.2, 5);
      const pergolaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
      const pergola = new THREE.Mesh(pergolaGeo, pergolaMat);
      pergola.position.set(1, 6.7, 0.5);
      pergola.castShadow = true;
      buildingGroup.add(pergola);
    }

    scene.add(buildingGroup);

    // 8. Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize listener
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.fov = newAspect < 1 ? 52 : 45;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (controlsRef.current) controlsRef.current.dispose();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement && container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [property]);

  // Handle Controls
  const toggleAutoRotate = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    if (controlsRef.current) controlsRef.current.autoRotate = next;
  };

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(14, 10, 16);
      controlsRef.current.target.set(0, 2, 0);
      controlsRef.current.update();
    }
  };

  const handleZoom = (factor) => {
    if (cameraRef.current && controlsRef.current) {
      const dir = new THREE.Vector3();
      cameraRef.current.getWorldDirection(dir);
      cameraRef.current.position.addScaledVector(dir, factor);
      controlsRef.current.update();
    }
  };

  const handleTimeChange = (mode) => {
    setTimeOfDay(mode);
    const { ambient, dir, fill } = lightsRef.current;
    if (!ambient || !dir) return;

    if (mode === 'day') {
      ambient.color.setHex(0xffffff);
      ambient.intensity = 0.7;
      dir.color.setHex(0xfff7ed);
      dir.intensity = 1.4;
      sceneRef.current.background = new THREE.Color(0x0f172a);
    } else if (mode === 'golden') {
      ambient.color.setHex(0xfef3c7);
      ambient.intensity = 0.6;
      dir.color.setHex(0xf59e0b);
      dir.intensity = 1.8;
      sceneRef.current.background = new THREE.Color(0x1e1b4b);
    } else if (mode === 'night') {
      ambient.color.setHex(0x38bdf8);
      ambient.intensity = 0.25;
      dir.color.setHex(0x60a5fa);
      dir.intensity = 0.4;
      sceneRef.current.background = new THREE.Color(0x020617);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[340px] md:min-h-[420px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col justify-between">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Control Bar */}
      <div className="relative z-10 p-3 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 pointer-events-auto shadow-md">
          <Box className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-black text-white">Interactive 3D Architectural Twin</span>
        </div>

        {/* Orbit Action Controls */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 pointer-events-auto shadow-md">
          <button 
            type="button"
            onClick={toggleAutoRotate}
            title={autoRotate ? "Pause Auto-Rotation" : "Enable Auto-Rotation"}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${autoRotate ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>
          <button 
            type="button"
            onClick={() => handleZoom(2)}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            onClick={() => handleZoom(-2)}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            onClick={handleResetCamera}
            title="Reset Camera View"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Bar: Mandatory Disclaimer & Return Instruction */}
      <div className="relative z-10 p-3 flex flex-col sm:flex-row items-center justify-between gap-2 pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur-md border border-amber-500/40 px-3 py-1.5 rounded-xl pointer-events-auto flex items-center gap-2 text-amber-300 text-[10px] sm:text-[11px] font-semibold shadow-lg">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Illustrative 3D visualisation — not an exact representation of the property.</span>
        </div>

        {/* Lighting Atmosphere Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 pointer-events-auto shadow-md">
          <button 
            type="button"
            onClick={() => handleTimeChange('day')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${timeOfDay === 'day' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            title="Daylight Simulation"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            onClick={() => handleTimeChange('golden')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${timeOfDay === 'golden' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Golden Hour Lighting"
          >
            <Sunset className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            onClick={() => handleTimeChange('night')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${timeOfDay === 'night' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Night Illumination"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
