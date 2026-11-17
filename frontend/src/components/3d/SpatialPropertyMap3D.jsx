import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  MapPin, Compass, Navigation, Eye, Layers, ShieldCheck, 
  ZoomIn, ZoomOut, RotateCw, ExternalLink, Box, Sparkles, X
} from 'lucide-react';

export default function SpatialPropertyMap3D({
  properties = [],
  userLocation,
  maxRadiusKm = 100,
  onSelectProperty,
  onLaunch3DTour,
  isMobile = false
}) {
  const mountRef = useRef(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [screenPins, setScreenPins] = useState([]);
  const [viewAngle, setViewAngle] = useState('iso'); // 'iso' | 'top'

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const targetCamPosRef = useRef(new THREE.Vector3(0, 35, 45));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const isTransitioningRef = useRef(false);
  const buildingMeshesRef = useRef([]);

  const formatPrice = (price) => {
    if (!price) return '₹0';
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
    return `₹${price.toLocaleString('en-IN')}`;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0D1E17');
    scene.fog = new THREE.FogExp2('#0D1E17', 0.012);
    sceneRef.current = scene;

    const aspect = width / height;
    const initialFov = aspect < 1 ? 55 : 45;
    const camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.5, 1000);
    if (aspect < 1) {
      camera.position.set(0, 45, 55);
      targetCamPosRef.current.set(0, 45, 55);
    } else {
      camera.position.set(0, 35, 45);
      targetCamPosRef.current.set(0, 35, 45);
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 10;
    controls.maxDistance = 120;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Halt programmatic lerping when user orbits manually
    controls.addEventListener('start', () => {
      isTransitioningRef.current = false;
    });

    // Ambient and directional lighting
    const ambientLight = new THREE.HemisphereLight('#FFFFFF', '#14382A', 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#E0F2FE', 1.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // ==========================================
    // 3D CITY TERRAIN & SPATIAL GRID
    // ==========================================
    const terrainGroup = new THREE.Group();

    // Dark emerald ground plane
    const groundGeo = new THREE.PlaneGeometry(160, 160, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x0A1612, 
      roughness: 0.9, 
      metalness: 0.1 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    terrainGroup.add(ground);

    // Glowing spatial grid
    const gridHelper = new THREE.GridHelper(160, 32, 0x176B4D, 0x123A2B);
    gridHelper.position.y = 0.02;
    terrainGroup.add(gridHelper);

    // Center Beacon: User Location
    const userBeaconGroup = new THREE.Group();
    const beaconPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 4, 16),
      new THREE.MeshBasicMaterial({ color: 0x34D399 })
    );
    beaconPillar.position.y = 2;
    userBeaconGroup.add(beaconPillar);

    const beaconSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x34D399 })
    );
    beaconSphere.position.y = 4.2;
    userBeaconGroup.add(beaconSphere);

    // Radius Geofence Ring
    const radiusScale = Math.min(Math.max((maxRadiusKm || 10) * 0.4, 8), 65);
    const geofenceRing = new THREE.RingGeometry(radiusScale - 0.2, radiusScale, 64);
    const geofenceMat = new THREE.MeshBasicMaterial({ color: 0x10B981, side: THREE.DoubleSide });
    const geofenceMesh = new THREE.Mesh(geofenceRing, geofenceMat);
    geofenceMesh.rotation.x = -Math.PI / 2;
    geofenceMesh.position.y = 0.05;
    userBeaconGroup.add(geofenceMesh);

    terrainGroup.add(userBeaconGroup);

    // ==========================================
    // PLACE REAL PROPERTIES IN 3D SPATIAL COORDINATES
    // ==========================================
    const centerLat = userLocation?.latitude || 12.9784;
    const centerLng = userLocation?.longitude || 77.6412;

    const buildingMeshes = [];

    properties.forEach((prop, idx) => {
      let x = 0;
      let z = 0;

      if (prop.location?.point?.coordinates && prop.location.point.coordinates.length >= 2) {
        const [pLng, pLat] = prop.location.point.coordinates;
        // 1 deg lat ~= 111km, 1 deg lng ~= 108km
        const dLatKm = (pLat - centerLat) * 111;
        const dLngKm = (pLng - centerLng) * 108;
        // Scale factor: 1 km = 0.8 units in 3D
        x = dLngKm * 0.8;
        z = -dLatKm * 0.8;
      } else {
        // Fallback procedural spread around center
        const angle = (idx / Math.max(properties.length, 1)) * Math.PI * 2;
        const dist = 8 + (idx % 4) * 6;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
      }

      // Restrict within grid view
      x = Math.max(-70, Math.min(70, x));
      z = Math.max(-70, Math.min(70, z));

      const propGroup = new THREE.Group();
      propGroup.position.set(x, 0, z);

      // Building geometry
      const isApartment = prop.propertyType === 'flat' || prop.propertyType === 'apartment';
      const bHeight = isApartment ? 8 + (idx % 3) * 4 : 4.5;
      const bWidth = isApartment ? 3.5 : 4.5;
      const bDepth = isApartment ? 3.5 : 4.0;

      const bGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const bMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0xE8F3EE : 0xCBD5CE,
        roughness: 0.3,
        metalness: 0.2
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.y = bHeight / 2;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      propGroup.add(bMesh);

      // Glowing top beacon
      const topBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x10B981 })
      );
      topBeacon.position.y = bHeight + 0.6;
      propGroup.add(topBeacon);

      terrainGroup.add(propGroup);

      buildingMeshes.push({
        property: prop,
        mesh: propGroup,
        pos: new THREE.Vector3(x, bHeight + 1.2, z)
      });
    });

    buildingMeshesRef.current = buildingMeshes;
    scene.add(terrainGroup);

    // Animation Loop
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (isTransitioningRef.current) {
        camera.position.lerp(targetCamPosRef.current, 0.05);
        controls.target.lerp(targetLookAtRef.current, 0.05);
        if (camera.position.distanceTo(targetCamPosRef.current) < 0.2 &&
            controls.target.distanceTo(targetLookAtRef.current) < 0.2) {
          camera.position.copy(targetCamPosRef.current);
          controls.target.copy(targetLookAtRef.current);
          isTransitioningRef.current = false;
        }
      }

      controls.update();

      // Screen projection of property pins
      const projected = buildingMeshes.map(item => {
        tempVec.copy(item.pos);
        tempVec.project(camera);

        const isBehind = tempVec.z > 1;
        const px = (tempVec.x * 0.5 + 0.5) * container.clientWidth;
        const py = (-(tempVec.y * 0.5) + 0.5) * container.clientHeight;

        return {
          property: item.property,
          x: px,
          y: py,
          visible: !isBehind && px > 20 && px < container.clientWidth - 20 && py > 20 && py < container.clientHeight - 20
        };
      });

      setScreenPins(projected);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.fov = newAspect < 1 ? 55 : 45;
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
  }, [properties, userLocation, maxRadiusKm, isMobile]);

  const handleSelectBuilding = (prop) => {
    setSelectedProp(prop);
    const found = buildingMeshesRef.current.find(b => (b.property._id || b.property.id) === (prop._id || prop.id));
    if (found) {
      targetLookAtRef.current.copy(found.pos);
      targetCamPosRef.current.set(found.pos.x + 12, found.pos.y + 10, found.pos.z + 14);
      isTransitioningRef.current = true;
    }
  };

  const handleResetCenter = () => {
    targetLookAtRef.current.set(0, 0, 0);
    targetCamPosRef.current.set(0, 35, 45);
    isTransitioningRef.current = true;
    setSelectedProp(null);
  };

  const toggleViewAngle = () => {
    isTransitioningRef.current = true;
    if (viewAngle === 'iso') {
      setViewAngle('top');
      targetCamPosRef.current.set(0, 75, 0.1);
      targetLookAtRef.current.set(0, 0, 0);
    } else {
      setViewAngle('iso');
      targetCamPosRef.current.set(0, 35, 45);
      targetLookAtRef.current.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-3xl overflow-hidden border border-emerald-950/30 bg-slate-950 shadow-2xl">
      {/* 3D WebGL Canvas */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />

      {/* 3D Floating Property Price Pins Projected on Canvas */}
      {screenPins.map(pin => {
        if (!pin.visible) return null;
        const isSelected = (selectedProp?._id || selectedProp?.id) === (pin.property._id || pin.property.id);

        return (
          <div
            key={pin.property._id || pin.property.id}
            style={{
              position: 'absolute',
              left: `${pin.x}px`,
              top: `${pin.y}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 30
            }}
          >
            <button
              onClick={() => handleSelectBuilding(pin.property)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 ${
                isSelected
                  ? 'bg-emerald-400 text-slate-950 ring-2 ring-white scale-110'
                  : 'bg-slate-950/90 text-white hover:bg-emerald-800 border border-emerald-500/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-display">{formatPrice(pin.property.price)}</span>
            </button>
          </div>
        );
      })}

      {/* Top Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/30 text-white text-xs font-bold shadow-lg">
          <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Center: {userLocation?.name || 'Bangalore Core'}</span>
          <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
            {properties.length} mapped
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
          <button
            onClick={toggleViewAngle}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              viewAngle === 'top' ? 'bg-[#176B4D] text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
            title="Toggle Top-Down / Isometric 3D View"
          >
            {viewAngle === 'top' ? 'Top-Down 2D' : 'Isometric 3D'}
          </button>

          <button
            onClick={handleResetCenter}
            className="p-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            title="Reset to center"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selected Property Preview Drawer (Bottom Left) */}
      {selectedProp && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-md bg-slate-950/95 backdrop-blur-xl p-4 rounded-3xl border border-emerald-500/40 text-white shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                {selectedProp.category} • {selectedProp.propertyType}
              </span>
              <h4 className="text-sm font-extrabold font-display text-white mt-1">
                {selectedProp.title}
              </h4>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{selectedProp.location?.address || selectedProp.location?.locality}</span>
              </p>
            </div>

            <button
              onClick={() => setSelectedProp(null)}
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-y border-white/10 my-2">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Direct Owner Price</div>
              <div className="text-base font-extrabold text-white font-display">
                {formatPrice(selectedProp.price)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Area</div>
              <div className="text-xs font-extrabold text-emerald-400">
                {selectedProp.area?.value || '3,450'} sq.ft
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onLaunch3DTour && onLaunch3DTour(selectedProp)}
              className="flex-1 bg-[#176B4D] hover:bg-[#12553D] text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Explore 3D Tour</span>
            </button>

            <button
              onClick={() => onSelectProperty && onSelectProperty(selectedProp)}
              className="bg-white/10 hover:bg-white/20 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all"
            >
              Full Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
