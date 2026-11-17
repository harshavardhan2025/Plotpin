import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  X, Compass, Eye, Sun, Moon, Sunset, RotateCw, Layers, ShieldCheck, 
  MapPin, CheckCircle2, Calendar, MessageCircle, Phone, Sparkles, 
  Box, Home, Grid, Image as ImageIcon, ChevronRight, Info, Check, ImageOff
} from 'lucide-react';

export default function PropertyViewer3DModal({
  property,
  onClose,
  onBookVisit,
  onOpenChat,
  onRequestCall,
  isMobile = false
}) {
  if (!property) return null;

  const mountRef = useRef(null);
  const [viewMode, setViewMode] = useState('3d'); // '3d' 
  // | 'photos'
  const [activeFloor, setActiveFloor] = useState('all'); // 'all' | 'ground' | 'first' | 'terrace'
  const [isWireframe, setIsWireframe] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState('day'); // 'day' | 'golden' | 'night'
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [screenHotspots, setScreenHotspots] = useState([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Three.js internal refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const lightsRef = useRef({});
  const floorGroupsRef = useRef({ ground: null, first: null, terrace: null });
  const materialsRef = useRef([]);
  const targetCamPosRef = useRef(new THREE.Vector3(16, 12, 18));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 3, 0));
  const isTransitioningRef = useRef(false);

  const formatPrice = (price) => {
    if (!price) return '₹0';
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)} Lakh`;
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const hasRealPhotos = property.images && Array.isArray(property.images) && property.images.length > 0 && !!property.images[0]?.storageKey;
  const images = hasRealPhotos ? property.images : [];

  // Room Hotspots in the 3D space
  const roomHotspots = [
    {
      id: 'living',
      name: 'Double-Height Living & Dining',
      dimensions: '26 ft × 18 ft (468 sq.ft)',
      description: 'Italian marble flooring, floor-to-ceiling double-glazed windows, Vastu-aligned North-East foyer',
      pos: new THREE.Vector3(0, 1.8, 3),
      camPos: new THREE.Vector3(2, 4, 9),
      lookAt: new THREE.Vector3(0, 2, 2),
      icon: '🛋️'
    },
    {
      id: 'master',
      name: 'Master Bedroom Suite & Balcony',
      dimensions: '22 ft × 16 ft (352 sq.ft)',
      description: 'Hardwood oak flooring, walk-in dressing wardrobe, private panoramic glass balcony',
      pos: new THREE.Vector3(2, 4.8, 3.5),
      camPos: new THREE.Vector3(4, 7, 9),
      lookAt: new THREE.Vector3(2, 5, 3),
      icon: '🛏️'
    },
    {
      id: 'kitchen',
      name: 'Designer Island Kitchen',
      dimensions: '16 ft × 12 ft (192 sq.ft)',
      description: 'German soft-close modular cabinetry, quartz island, concealed utility dry-balcony',
      pos: new THREE.Vector3(-3.5, 1.8, -1),
      camPos: new THREE.Vector3(-2, 4, 5),
      lookAt: new THREE.Vector3(-3, 2, 0),
      icon: '🍳'
    },
    {
      id: 'rooftop',
      name: 'Sky Lounge & Pergola Deck',
      dimensions: '34 ft × 24 ft (816 sq.ft)',
      description: '360° skyline vistas, outdoor BBQ pavilion, waterproof artificial turf and ambient night LEDs',
      pos: new THREE.Vector3(1, 7.5, 0),
      camPos: new THREE.Vector3(4, 11, 7),
      lookAt: new THREE.Vector3(1, 7, 0),
      icon: '🌿'
    }
  ];

  // 3D Scene Initialization
  useEffect(() => {
    if (viewMode !== '3d' || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const aspect = width / height;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EAF3EE');
    scene.fog = new THREE.FogExp2('#EAF3EE', 0.018);
    sceneRef.current = scene;

    const initialFov = aspect < 1 ? 52 : 42;
    const camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 1000);
    if (aspect < 1) {
      camera.position.set(20, 15, 22);
      targetCamPosRef.current.set(20, 15, 22);
    } else {
      camera.position.set(16, 12, 18);
      targetCamPosRef.current.set(16, 12, 18);
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 6;
    controls.maxDistance = 45;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    // Halt programmatic lerping when user orbits manually
    controls.addEventListener('start', () => {
      isTransitioningRef.current = false;
    });

    // Lighting
    const ambientLight = new THREE.HemisphereLight('#FFFFFF', '#365345', 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#FFF3DB', 2.0);
    sunLight.position.set(24, 38, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const warmInterior = new THREE.PointLight('#FFA743', 2.5, 20);
    warmInterior.position.set(0, 3.5, 1);
    scene.add(warmInterior);

    lightsRef.current = { ambient: ambientLight, sun: sunLight, interior: warmInterior };

    // ==========================================
    // BUILD 3D MODEL ACCORDING TO PROPERTY CATEGORY
    // ==========================================
    const modelGroup = new THREE.Group();
    materialsRef.current = [];

    const regMat = (mat) => {
      materialsRef.current.push(mat);
      return mat;
    };

    const concreteMat = regMat(new THREE.MeshStandardMaterial({ color: 0xF5F7F6, roughness: 0.45 }));
    const darkWoodMat = regMat(new THREE.MeshStandardMaterial({ color: 0x8C5638, roughness: 0.65 }));
    const darkMetalMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1E2923, roughness: 0.2, metalness: 0.8 }));
    const glassMat = regMat(new THREE.MeshPhysicalMaterial({
      color: 0xBAE6FD,
      transmission: 0.85,
      opacity: 0.35,
      transparent: true,
      roughness: 0.05,
      ior: 1.5
    }));
    const lawnMat = regMat(new THREE.MeshStandardMaterial({ color: 0x224833, roughness: 0.9 }));
    const terraceTileMat = regMat(new THREE.MeshStandardMaterial({ color: 0xDDD3C7, roughness: 0.5 }));

    // Ground Base
    const groundBase = new THREE.Mesh(new THREE.CylinderGeometry(18, 19, 0.4, 32), lawnMat);
    groundBase.position.y = -0.2;
    groundBase.receiveShadow = true;
    modelGroup.add(groundBase);

    // Decorative Cadastral Plot Boundary Ring
    const ringGeo = new THREE.RingGeometry(18.2, 18.6, 48);
    const ringMat = regMat(new THREE.MeshBasicMaterial({ color: 0x176B4D, side: THREE.DoubleSide }));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    modelGroup.add(ring);

    // Floor Groups
    const groundFloorGroup = new THREE.Group();
    const firstFloorGroup = new THREE.Group();
    const terraceGroup = new THREE.Group();

    const cat = property.category || property.propertyType || 'house';

    if (cat === 'plot' || cat === 'land' || cat === 'agricultural') {
      // 3D Plotted Land Cadastral Survey
      const plotPlinth = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 20), terraceTileMat);
      plotPlinth.position.set(0, 0.125, 0);
      plotPlinth.receiveShadow = true;
      groundFloorGroup.add(plotPlinth);

      // Boundary Fencing & Corner Marker Stones
      const cornerPositions = [[-7.8, 0.5, -9.8], [7.8, 0.5, -9.8], [-7.8, 0.5, 9.8], [7.8, 0.5, 9.8]];
      cornerPositions.forEach(([cx, cy, cz]) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), darkMetalMat);
        pillar.position.set(cx, cy, cz);
        pillar.castShadow = true;
        groundFloorGroup.add(pillar);
      });

      // Front Access Road
      const road = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 5), darkMetalMat);
      road.position.set(0, 0.05, 13);
      groundFloorGroup.add(road);

    } else if (cat === 'flat' || cat === 'apartment') {
      // High-Rise Luxury Residential Tower Model
      // Ground / Lobby
      const lobby = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 12), concreteMat);
      lobby.position.set(0, 1.6, 0);
      lobby.castShadow = true;
      lobby.receiveShadow = true;
      groundFloorGroup.add(lobby);

      // Lobby glass
      const lobbyGlass = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), glassMat);
      lobbyGlass.position.set(0, 1.5, 6.02);
      groundFloorGroup.add(lobbyGlass);

      // Middle Levels (First Floor & Higher Floors)
      for (let i = 0; i < 3; i++) {
        const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(11, 2.4, 11), concreteMat);
        floorMesh.position.set(0, 4.4 + i * 2.6, 0);
        floorMesh.castShadow = true;
        floorMesh.receiveShadow = true;

        // Balcony projection
        const balc = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 1.8), concreteMat);
        balc.position.set(0, 3.2 + i * 2.6, 6.4);
        firstFloorGroup.add(balc);

        const balcGlass = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 0.05), glassMat);
        balcGlass.position.set(0, 3.7 + i * 2.6, 7.2);
        firstFloorGroup.add(balcGlass);

        firstFloorGroup.add(floorMesh);
      }

      // Penthouse Terrace
      const ph = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 8), darkWoodMat);
      ph.position.set(0, 12.1, 0);
      ph.castShadow = true;
      terraceGroup.add(ph);

      const phDeck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.2, 11), terraceTileMat);
      phDeck.position.set(0, 11.0, 0);
      terraceGroup.add(phDeck);

    } else {
      // Modern Luxury Architectural Villa (Default)
      // Ground Floor
      const gf = new THREE.Mesh(new THREE.BoxGeometry(13, 3.4, 11), concreteMat);
      gf.position.set(0, 1.7, 0);
      gf.castShadow = true;
      gf.receiveShadow = true;
      groundFloorGroup.add(gf);

      // GF Glass facade
      const gfGlass = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.8), glassMat);
      gfGlass.position.set(0, 1.6, 5.52);
      groundFloorGroup.add(gfGlass);

      // Swimming Pool
      const pool = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 4.5), regMat(new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.1 })));
      pool.position.set(6, 0.1, 4);
      groundFloorGroup.add(pool);

      // First Floor (Cantilevered)
      const ff = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 12), concreteMat);
      ff.position.set(1.5, 4.9, 0.5);
      ff.castShadow = true;
      ff.receiveShadow = true;
      firstFloorGroup.add(ff);

      // FF Wood Accent
      const ffWood = new THREE.Mesh(new THREE.BoxGeometry(4, 3.0, 0.15), darkWoodMat);
      ffWood.position.set(-2.5, 4.9, 6.52);
      firstFloorGroup.add(ffWood);

      // FF Balcony
      const ffBalc = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.15, 2.2), concreteMat);
      ffBalc.position.set(3, 3.35, 6.8);
      firstFloorGroup.add(ffBalc);

      const ffGlassRail = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.9, 0.05), glassMat);
      ffGlassRail.position.set(3, 3.9, 7.8);
      firstFloorGroup.add(ffGlassRail);

      // Rooftop Terrace & Pergola
      const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.2, 10), terraceTileMat);
      roofDeck.position.set(1.5, 6.6, 0.5);
      terraceGroup.add(roofDeck);

      const pergola = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 4), darkMetalMat);
      pergola.position.set(3, 8.2, 1);
      terraceGroup.add(pergola);

      // Pergola Legs
      [[0.6, 7.4, -0.9], [5.4, 7.4, -0.9], [0.6, 7.4, 2.9], [5.4, 7.4, 2.9]].forEach(([px, py, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6), darkMetalMat);
        post.position.set(px, py, pz);
        terraceGroup.add(post);
      });
    }

    modelGroup.add(groundFloorGroup);
    modelGroup.add(firstFloorGroup);
    modelGroup.add(terraceGroup);
    scene.add(modelGroup);

    floorGroupsRef.current = {
      ground: groundFloorGroup,
      first: firstFloorGroup,
      terrace: terraceGroup
    };

    // Animation Loop
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (isTransitioningRef.current) {
        camera.position.lerp(targetCamPosRef.current, 0.05);
        controls.target.lerp(targetLookAtRef.current, 0.05);
        if (camera.position.distanceTo(targetCamPosRef.current) < 0.15 &&
            controls.target.distanceTo(targetLookAtRef.current) < 0.15) {
          camera.position.copy(targetCamPosRef.current);
          controls.target.copy(targetLookAtRef.current);
          isTransitioningRef.current = false;
        }
      }

      controls.update();

      // Project room hotspots
      const projected = roomHotspots.map(spot => {
        tempVec.copy(spot.pos);
        tempVec.project(camera);
        const isBehind = tempVec.z > 1;
        const x = (tempVec.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-(tempVec.y * 0.5) + 0.5) * container.clientHeight;

        return {
          ...spot,
          x,
          y,
          visible: !isBehind && x > 20 && x < container.clientWidth - 20 && y > 20 && y < container.clientHeight - 20
        };
      });

      setScreenHotspots(projected);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.fov = newAspect < 1 ? 52 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
    };
  }, [viewMode, property, isMobile]);

  // Handle Floor Separation
  useEffect(() => {
    const { ground, first, terrace } = floorGroupsRef.current;
    if (!ground || !first || !terrace) return;

    if (activeFloor === 'all') {
      ground.visible = true;
      first.visible = true;
      terrace.visible = true;
      ground.position.y = 0;
      first.position.y = 0;
      terrace.position.y = 0;
    } else if (activeFloor === 'ground') {
      ground.visible = true;
      first.visible = false;
      terrace.visible = false;
      ground.position.y = 0;
    } else if (activeFloor === 'first') {
      ground.visible = false;
      first.visible = true;
      terrace.visible = false;
      first.position.y = -3.2; // Bring down to eye level
    } else if (activeFloor === 'terrace') {
      ground.visible = false;
      first.visible = false;
      terrace.visible = true;
      terrace.position.y = -5.8; // Bring down to eye level
    }
  }, [activeFloor]);

  // Handle Wireframe Toggle
  useEffect(() => {
    materialsRef.current.forEach(mat => {
      if (mat) mat.wireframe = isWireframe;
    });
  }, [isWireframe]);

  // Handle Auto-Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 1.0;
    }
  }, [autoRotate]);

  // Handle Time of Day
  useEffect(() => {
    if (!sceneRef.current || !lightsRef.current.sun) return;
    const scene = sceneRef.current;
    const { ambient, sun, interior } = lightsRef.current;

    if (timeOfDay === 'day') {
      scene.background.set('#EAF3EE');
      ambient.color.set('#FFFFFF');
      ambient.intensity = 0.9;
      sun.color.set('#FFF3DB');
      sun.intensity = 2.0;
      sun.position.set(24, 38, 18);
      interior.intensity = 1.0;
    } else if (timeOfDay === 'golden') {
      scene.background.set('#FBE9D0');
      ambient.color.set('#FED7AA');
      ambient.intensity = 0.65;
      sun.color.set('#FF8C38');
      sun.intensity = 2.4;
      sun.position.set(30, 14, -25);
      interior.intensity = 2.8;
    } else if (timeOfDay === 'night') {
      scene.background.set('#0B1B15');
      ambient.color.set('#162C22');
      ambient.intensity = 0.3;
      sun.color.set('#60A5FA');
      sun.intensity = 0.4;
      sun.position.set(-15, 25, -15);
      interior.intensity = 4.5;
    }
  }, [timeOfDay]);

  const handleSelectHotspot = (spot) => {
    setActiveHotspot(spot);
    targetCamPosRef.current.copy(spot.camPos);
    targetLookAtRef.current.copy(spot.lookAt);
    isTransitioningRef.current = true;
  };

  const resetCamera = () => {
    targetCamPosRef.current.set(16, 12, 18);
    targetLookAtRef.current.set(0, 3, 0);
    isTransitioningRef.current = true;
    setActiveHotspot(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className={`relative w-full ${isMobile ? 'max-w-md h-[95vh]' : 'max-w-6xl h-[88vh]'} bg-slate-900 rounded-3xl border border-emerald-950/40 shadow-2xl flex flex-col overflow-hidden`}>
        
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-white/10 shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-extrabold font-display truncate">
              {property.title} — 3D Architectural Model
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              <Info className="w-3 h-3 text-amber-400" />
              Illustrative 3D Architectural Model
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher: 3D Model vs High-Res Photo Gallery */}
            <div className="flex items-center bg-white/10 rounded-xl p-0.5 mr-2">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === '3d' ? 'bg-[#176B4D] text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Twin</span>
              </button>
              <button
                onClick={() => setViewMode('photos')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'photos' ? 'bg-[#176B4D] text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Photos ({images.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area: 3D Canvas or Photo Gallery */}
        <div className="relative flex-1 min-h-0 bg-slate-950 flex flex-col md:flex-row">
          
          {viewMode === '3d' ? (
            <div className="relative flex-1 h-full min-h-[360px] overflow-hidden">
              {/* WebGL Canvas */}
              <div 
                ref={mountRef} 
                className="w-full h-full cursor-grab active:cursor-grabbing select-none"
              />

              {/* Projected 3D Hotspot Pins */}
              {screenHotspots.map(spot => {
                if (!spot.visible) return null;
                const isSelected = activeHotspot?.id === spot.id;

                return (
                  <div
                    key={spot.id}
                    style={{
                      position: 'absolute',
                      left: `${spot.x}px`,
                      top: `${spot.y}px`,
                      transform: 'translate(-50%, -100%)',
                      zIndex: 35
                    }}
                  >
                    <button
                      onClick={() => handleSelectHotspot(spot)}
                      className={`flex items-center gap-1 rounded-full backdrop-blur-md shadow-xl transition-all hover:scale-105 active:scale-95 whitespace-nowrap ${
                        isMobile 
                          ? 'px-2 py-1 text-[10px] font-black' 
                          : 'px-2.5 py-1 text-xs font-black'
                      } ${
                        isSelected 
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-white scale-105' 
                          : 'bg-slate-950/85 text-white hover:bg-emerald-900 border border-emerald-400/50'
                      }`}
                    >
                      <span className="shrink-0">{spot.icon}</span>
                      <span className="font-display">
                        {isMobile ? spot.name.split(' ')[0] : spot.name}
                      </span>
                    </button>
                  </div>
                );
              })}

              {/* 3D Top Control Bar */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
                {/* Floor Switcher */}
                <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Level:</span>
                  {[
                    { id: 'all', label: 'Full Villa' },
                    { id: 'ground', label: 'Ground' },
                    { id: 'first', label: '1st Floor' },
                    { id: 'terrace', label: 'Terrace' }
                  ].map(floor => (
                    <button
                      key={floor.id}
                      onClick={() => setActiveFloor(floor.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                        activeFloor === floor.id 
                          ? 'bg-[#176B4D] text-white shadow' 
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {floor.label}
                    </button>
                  ))}
                </div>

                {/* Lighting & Inspection Mode Switchers */}
                <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
                  {/* Sun / Sunset / Night */}
                  <div className="flex items-center bg-white/10 rounded-xl p-0.5">
                    <button
                      onClick={() => setTimeOfDay('day')}
                      className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'day' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}
                      title="Daylight"
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTimeOfDay('golden')}
                      className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'golden' ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-white'}`}
                      title="Golden Hour"
                    >
                      <Sunset className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTimeOfDay('night')}
                      className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'night' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                      title="Night Interior Lights"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Wireframe / Blueprint mode */}
                  <button
                    onClick={() => setIsWireframe(!isWireframe)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      isWireframe ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                    title="Toggle Architectural Wireframe Blueprint"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Blueprint</span>
                  </button>

                  {/* Auto Rotate */}
                  <button
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`p-1.5 rounded-xl text-xs transition-all ${autoRotate ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
                    title="Toggle Auto Tour"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                  </button>

                  {/* Reset Camera */}
                  <button
                    onClick={resetCamera}
                    className="p-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                    title="Reset Camera View"
                  >
                    <Compass className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Hotspot Info Overlay Banner */}
              {activeHotspot && (
                <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-md bg-slate-950/95 backdrop-blur-xl p-4 rounded-2xl border border-emerald-500/40 text-white shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-400">
                      <span>{activeHotspot.icon}</span>
                      <span>{activeHotspot.name}</span>
                    </div>
                    <button 
                      onClick={() => setActiveHotspot(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 mb-1">
                    Dimensions: <span className="text-white font-mono">{activeHotspot.dimensions}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">
                    {activeHotspot.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* High-Res Photo Gallery Mode */
            <div className="flex-1 flex flex-col p-4 space-y-3 overflow-y-auto">
              {images.length === 0 ? (
                <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-8 bg-slate-950 rounded-2xl border border-white/10 text-center space-y-2">
                  <ImageOff className="w-10 h-10 text-slate-500 mb-1" />
                  <div className="text-sm font-bold text-slate-300">No photos uploaded yet</div>
                  <p className="text-xs text-slate-500 max-w-sm">
                    This is a verified listing. Real photos will appear once uploaded by the owner.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative flex-1 min-h-[300px] rounded-2xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center">
                    <img 
                      src={images[activePhotoIdx]?.storageKey} 
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-xl font-bold">
                      {images[activePhotoIdx]?.caption || 'Property Photograph'} ({activePhotoIdx + 1}/{images.length})
                    </div>
                  </div>

                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`relative w-24 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                            activePhotoIdx === idx ? 'border-emerald-500 scale-105' : 'border-white/10 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={img.storageKey} alt="thumb" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Right / Bottom HUD Specs & Action Panel */}
          <div className={`${isMobile ? 'w-full border-t' : 'w-80 md:w-96 border-l'} border-white/10 bg-slate-900/90 p-5 flex flex-col justify-between shrink-0 overflow-y-auto`}>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                  {property.category} • {property.propertyType}
                </span>
                <h3 className="text-lg font-extrabold text-white mt-1 font-display leading-snug">
                  {property.title}
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{property.location?.address || property.location?.locality}, Bengaluru</span>
                </p>
              </div>

              {/* Price Callout */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Direct Owner Price</div>
                  <div className="text-xl font-extrabold text-white font-display mt-0.5">
                    {formatPrice(property.price)}
                    {property.purpose === 'rent' && <span className="text-xs text-slate-400">/mo</span>}
                  </div>
                </div>
                <div className="bg-emerald-500/20 text-emerald-300 text-xs font-black px-2.5 py-1 rounded-xl border border-emerald-500/40">
                  0% BROKERAGE
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Area</div>
                  <div className="text-sm font-extrabold text-white mt-0.5">{property.area?.value || '3,450'} sq.ft</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Beds</div>
                  <div className="text-sm font-extrabold text-white mt-0.5">{property.bedrooms ? `${property.bedrooms} BHK` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Facing</div>
                  <div className="text-sm font-extrabold text-emerald-400 mt-0.5">East Facing</div>
                </div>
              </div>

              {/* Verified Title Guarantees */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Title &amp; Encumbrance Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Boundary &amp; Survey Map Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct Owner Listing</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t border-white/10 mt-4">
              <button
                onClick={() => { onClose(); onBookVisit && onBookVisit(); }}
                className="w-full bg-[#176B4D] hover:bg-[#12553D] text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Calendar className="w-4 h-4" />
                <span>Schedule Visit</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => { onClose(); onRequestCall && onRequestCall(); }}
                  className="w-full bg-blue-600/80 hover:bg-blue-600 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5 text-white" />
                  <span>Call</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

