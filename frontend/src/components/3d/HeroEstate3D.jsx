import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Compass, Eye, Sun, Moon, Sunset, RotateCw, Layers, MapPin, 
  ArrowRight, Sparkles, X, Check, EyeOff
} from 'lucide-react';

export default function HeroEstate3D({ 
  onExploreClick, 
  onBookVisitClick,
  isMobile = false 
}) {
  const mountRef = useRef(null);
  const [timeOfDay, setTimeOfDay] = useState('day'); // 'day' | 'golden' | 'night'
  const [activePreset, setActivePreset] = useState('overview');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [activePin, setActivePin] = useState(null);
  const [is3DMode, setIs3DMode] = useState(true);
  const [screenPins, setScreenPins] = useState([]);

  // Three.js internal refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const lightsRef = useRef({});
  const animFrameRef = useRef(null);
  const targetCamPosRef = useRef(new THREE.Vector3(22, 15, 24));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 3, 0));
  const isTransitioningRef = useRef(false);
  const isIntersectingRef = useRef(true);

  // 3D Pin points in world coordinates
  const pinData = [
    {
      id: 'pool',
      shortTitle: 'Pool',
      title: 'Private Infinity Pool',
      subtitle: '45ft heated lap pool with ozone filtration & submerged lounge steps',
      pos: new THREE.Vector3(7.5, 0.6, 6),
      camPos: new THREE.Vector3(14, 4, 11),
      lookAt: new THREE.Vector3(6, 1, 4),
      icon: '🏊'
    },
    {
      id: 'villa',
      shortTitle: 'Villa',
      title: 'Cantilever Villa',
      subtitle: '4,850 sq.ft contemporary architecture with floor-to-ceiling Low-E glass & teak louvers',
      pos: new THREE.Vector3(1.5, 5.8, 1.2),
      camPos: new THREE.Vector3(0, 6, 18),
      lookAt: new THREE.Vector3(0, 4, 0),
      icon: '🏡'
    },
    {
      id: 'terrace',
      shortTitle: 'Sky Deck',
      title: 'Sky Lounge & Solar Deck',
      subtitle: 'Private rooftop pavilion with 8kW solar microgrid & pergola dining',
      pos: new THREE.Vector3(2.5, 8.5, 1.5),
      camPos: new THREE.Vector3(8, 13, 11),
      lookAt: new THREE.Vector3(2, 7, 1),
      icon: '☀️'
    },
    {
      id: 'garden',
      shortTitle: 'Courtyard',
      title: 'Vastu Courtyard',
      subtitle: 'Lush landscaped courtyard, zen stepping pavers & warm LED bollard illumination',
      pos: new THREE.Vector3(-7, 0.6, 7),
      camPos: new THREE.Vector3(-14, 6, 14),
      lookAt: new THREE.Vector3(-4, 1, 4),
      icon: '🌿'
    }
  ];

  const presets = {
    overview: { pos: new THREE.Vector3(22, 15, 24), look: new THREE.Vector3(0, 3, 0), label: 'Panoramic' },
    facade: { pos: new THREE.Vector3(0, 5, 20), look: new THREE.Vector3(0, 4, 0), label: 'Facade' },
    pool: { pos: new THREE.Vector3(14, 4, 11), look: new THREE.Vector3(6, 1, 4), label: 'Pool & Lounge' },
    terrace: { pos: new THREE.Vector3(8, 13, 11), look: new THREE.Vector3(2, 7, 1), label: 'Sky Deck' }
  };

  const handleSelectPreset = (key) => {
    setActivePreset(key);
    const target = presets[key];
    if (target) {
      targetCamPosRef.current.copy(target.pos);
      targetLookAtRef.current.copy(target.look);
      isTransitioningRef.current = true;
    }
  };

  const handleSelectPin = (pin) => {
    if (activePin?.id === pin.id) {
      setActivePin(null);
      return;
    }
    setActivePin(pin);
    if (pin.camPos && pin.lookAt) {
      targetCamPosRef.current.copy(pin.camPos);
      targetLookAtRef.current.copy(pin.lookAt);
      isTransitioningRef.current = true;
    }
  };

  useEffect(() => {
    if (!is3DMode || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;
    const aspect = width / height;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EAF3EE');
    scene.fog = new THREE.FogExp2('#EAF3EE', 0.015);
    sceneRef.current = scene;

    // 2. Camera: Use wider vertical FOV on portrait/mobile to avoid claustrophobic zoom
    const initialFov = aspect < 1 ? 52 : 40;
    const camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 1000);
    
    // Position camera with extra breathing room on mobile
    if (aspect < 1) {
      camera.position.set(26, 18, 30);
      targetCamPosRef.current.set(26, 18, 30);
    } else {
      camera.position.set(22, 15, 24);
      targetCamPosRef.current.set(22, 15, 24);
    }
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera going below ground
    controls.minDistance = 7;
    controls.maxDistance = 65;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    // CRITICAL: When user manually interacts, immediately halt programmatic lerping
    controls.addEventListener('start', () => {
      isTransitioningRef.current = false;
    });

    // 5. Lighting Setup
    const ambientLight = new THREE.HemisphereLight('#FFFFFF', '#456050', 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#FFF3DB', 2.0);
    sunLight.position.set(30, 45, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 120;
    const d = 28;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const warmInteriorLight = new THREE.PointLight('#FFA743', 2.5, 25);
    warmInteriorLight.position.set(0, 4, 1);
    scene.add(warmInteriorLight);

    const poolGlowLight = new THREE.PointLight('#38BDF8', 2.2, 18);
    poolGlowLight.position.set(7.5, 0.4, 6);
    scene.add(poolGlowLight);

    lightsRef.current = { ambient: ambientLight, sun: sunLight, interior: warmInteriorLight, pool: poolGlowLight };

    // ==========================================
    // 6. BUILD THE ARCHITECTURAL VILLA ESTATE
    // ==========================================
    const estateGroup = new THREE.Group();

    // Ground Plane (Lush Lawn)
    const groundGeo = new THREE.PlaneGeometry(90, 90);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x224833, 
      roughness: 0.85, 
      metalness: 0.05 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    estateGroup.add(ground);

    // Stone Terrace & Courtyard Base
    const terraceGeo = new THREE.BoxGeometry(30, 0.35, 26);
    const terraceMat = new THREE.MeshStandardMaterial({ 
      color: 0xE8EDE9, 
      roughness: 0.6, 
      metalness: 0.1 
    });
    const terrace = new THREE.Mesh(terraceGeo, terraceMat);
    terrace.position.set(1, 0.175, 1);
    terrace.receiveShadow = true;
    terrace.castShadow = true;
    estateGroup.add(terrace);

    // Entrance Driveway Pavers
    const driveGeo = new THREE.BoxGeometry(7, 0.05, 15);
    const driveMat = new THREE.MeshStandardMaterial({ color: 0x9BA7A0, roughness: 0.7 });
    const drive = new THREE.Mesh(driveGeo, driveMat);
    drive.position.set(-6, 0.2, 12);
    drive.receiveShadow = true;
    estateGroup.add(drive);

    // Stepping stones across garden
    for (let s = 0; s < 5; s++) {
      const stepGeo = new THREE.BoxGeometry(1.6, 0.06, 1.2);
      const stepMat = new THREE.MeshStandardMaterial({ color: 0xD3DCD6, roughness: 0.5 });
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(-1.5 + s * 1.8, 0.22, 11 - s * 0.4);
      step.receiveShadow = true;
      estateGroup.add(step);
    }

    // Infinity Swimming Pool
    const poolSurroundGeo = new THREE.BoxGeometry(11, 0.3, 8);
    const poolSurroundMat = new THREE.MeshStandardMaterial({ color: 0xDCE3DF, roughness: 0.4 });
    const poolSurround = new THREE.Mesh(poolSurroundGeo, poolSurroundMat);
    poolSurround.position.set(7.5, 0.25, 6);
    poolSurround.receiveShadow = true;
    estateGroup.add(poolSurround);

    // Pool Basin (Water)
    const waterGeo = new THREE.PlaneGeometry(9.5, 6.5);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0EA5E9,
      transmission: 0.75,
      opacity: 0.88,
      transparent: true,
      roughness: 0.06,
      ior: 1.333,
      metalness: 0.1
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(7.5, 0.32, 6);
    estateGroup.add(water);

    // Submerged pool entry steps
    for (let st = 0; st < 3; st++) {
      const stepPoolGeo = new THREE.BoxGeometry(2.0, 0.08, 6.0);
      const stepPoolMat = new THREE.MeshStandardMaterial({ color: 0x7DD3FC, roughness: 0.2 });
      const stepMesh = new THREE.Mesh(stepPoolGeo, stepPoolMat);
      stepMesh.position.set(3.8 + st * 0.7, 0.24 - st * 0.06, 6);
      estateGroup.add(stepMesh);
    }

    // Wooden Sundeck around pool
    const deckGeo = new THREE.BoxGeometry(11, 0.1, 4);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8C5638, roughness: 0.65 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(7.5, 0.36, 10.5);
    deck.receiveShadow = true;
    estateGroup.add(deck);

    // Sun loungers with pillows
    for (let i = 0; i < 3; i++) {
      const loungerGeo = new THREE.BoxGeometry(1.2, 0.2, 2.5);
      const loungerMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
      const lounger = new THREE.Mesh(loungerGeo, loungerMat);
      lounger.position.set(5.5 + i * 2, 0.45, 10.4);
      lounger.castShadow = true;
      estateGroup.add(lounger);

      // Pillow
      const pillowGeo = new THREE.BoxGeometry(1.0, 0.1, 0.6);
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0x0D9488 });
      const pillow = new THREE.Mesh(pillowGeo, pillowMat);
      pillow.position.set(5.5 + i * 2, 0.56, 11.2);
      estateGroup.add(pillow);
    }

    // Modern Cantilever Villa Structure
    const concreteWhite = new THREE.MeshStandardMaterial({ color: 0xF8FAF8, roughness: 0.35 });
    const woodPanelMat = new THREE.MeshStandardMaterial({ color: 0xB47543, roughness: 0.6 });
    const darkFrameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.2, metalness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xBAE6FD,
      transmission: 0.85,
      opacity: 0.35,
      transparent: true,
      roughness: 0.05,
      ior: 1.5,
      reflectivity: 0.9
    });

    // --- Ground Floor Main Wing ---
    const gfMainGeo = new THREE.BoxGeometry(14, 3.8, 11);
    const gfMain = new THREE.Mesh(gfMainGeo, concreteWhite);
    gfMain.position.set(-1, 2.05, 0);
    gfMain.castShadow = true;
    gfMain.receiveShadow = true;
    estateGroup.add(gfMain);

    // Floor-to-ceiling glass wall on GF facing pool/garden
    const gfGlassGeo = new THREE.PlaneGeometry(10, 3.2);
    const gfGlass = new THREE.Mesh(gfGlassGeo, glassMat);
    gfGlass.position.set(0, 1.9, 5.52);
    estateGroup.add(gfGlass);

    // Glass frames
    const frameGeo = new THREE.BoxGeometry(10.2, 3.4, 0.15);
    const frameMesh = new THREE.Mesh(frameGeo, darkFrameMat);
    frameMesh.position.set(0, 1.9, 5.48);
    estateGroup.add(frameMesh);

    // --- First Floor Cantilever Modern Box ---
    const ffGeo = new THREE.BoxGeometry(13.5, 3.5, 12);
    const ffBox = new THREE.Mesh(ffGeo, concreteWhite);
    ffBox.position.set(1.5, 5.75, 1.2);
    ffBox.castShadow = true;
    ffBox.receiveShadow = true;
    estateGroup.add(ffBox);

    // Teak accent louvers / vertical slats on cantilever wall
    for (let slat = 0; slat < 12; slat++) {
      const slatGeo = new THREE.BoxGeometry(0.2, 3.3, 0.15);
      const slatMesh = new THREE.Mesh(slatGeo, woodPanelMat);
      slatMesh.position.set(-4.5 + slat * 0.4, 5.75, 7.26);
      slatMesh.castShadow = true;
      estateGroup.add(slatMesh);
    }

    // First Floor Master Bedroom Balcony with Glass Railing
    const balconyGeo = new THREE.BoxGeometry(6.5, 0.25, 2.8);
    const balcony = new THREE.Mesh(balconyGeo, concreteWhite);
    balcony.position.set(3.5, 4.15, 7.6);
    balcony.castShadow = true;
    balcony.receiveShadow = true;
    estateGroup.add(balcony);

    const glassRailingGeo = new THREE.BoxGeometry(6.5, 1.0, 0.08);
    const glassRailing = new THREE.Mesh(glassRailingGeo, glassMat);
    glassRailing.position.set(3.5, 4.75, 8.9);
    estateGroup.add(glassRailing);

    // Top rail cap for balustrade
    const railCapGeo = new THREE.BoxGeometry(6.52, 0.08, 0.12);
    const railCap = new THREE.Mesh(railCapGeo, darkFrameMat);
    railCap.position.set(3.5, 5.25, 8.9);
    estateGroup.add(railCap);

    // FF Panoramic Window
    const ffGlassGeo = new THREE.PlaneGeometry(5.2, 2.4);
    const ffGlass = new THREE.Mesh(ffGlassGeo, glassMat);
    ffGlass.position.set(3.5, 5.6, 7.22);
    estateGroup.add(ffGlass);

    // --- Rooftop Pavilion & Solar Panels ---
    const roofDeckGeo = new THREE.BoxGeometry(10.5, 0.25, 9.5);
    const roofDeck = new THREE.Mesh(roofDeckGeo, terraceMat);
    roofDeck.position.set(1.5, 7.55, 1.2);
    estateGroup.add(roofDeck);

    // Rooftop Louvered Pergola Canopy
    const pergolaGeo = new THREE.BoxGeometry(6.0, 0.15, 5.0);
    const pergola = new THREE.Mesh(pergolaGeo, darkFrameMat);
    pergola.position.set(3, 9.4, 2);
    estateGroup.add(pergola);

    // Louver slats across pergola
    for (let lv = 0; lv < 7; lv++) {
      const lvGeo = new THREE.BoxGeometry(5.8, 0.1, 0.18);
      const lvMesh = new THREE.Mesh(lvGeo, darkFrameMat);
      lvMesh.position.set(3, 9.35, -0.2 + lv * 0.7);
      estateGroup.add(lvMesh);
    }

    // Pergola support pillars
    const pillarPositions = [
      [0.2, 8.4, -0.3], [5.8, 8.4, -0.3],
      [0.2, 8.4, 4.3], [5.8, 8.4, 4.3]
    ];
    pillarPositions.forEach(([px, py, pz]) => {
      const pGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.0);
      const pillar = new THREE.Mesh(pGeo, darkFrameMat);
      pillar.position.set(px, py, pz);
      estateGroup.add(pillar);
    });

    // Rooftop Outdoor Lounge Sofa
    const sofaGeo = new THREE.BoxGeometry(3.2, 0.3, 1.4);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const sofa = new THREE.Mesh(sofaGeo, sofaMat);
    sofa.position.set(3, 7.8, 2);
    estateGroup.add(sofa);

    // Solar panels on roof
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const solarGeo = new THREE.BoxGeometry(1.6, 0.06, 1.1);
        const solarMat = new THREE.MeshStandardMaterial({ 
          color: 0x1E3A8A, 
          metalness: 0.9, 
          roughness: 0.1 
        });
        const solarMesh = new THREE.Mesh(solarGeo, solarMat);
        solarMesh.rotation.x = 0.2;
        solarMesh.position.set(-1.8 + col * 1.8, 7.9, -1.2 + row * 1.5);
        solarMesh.castShadow = true;
        estateGroup.add(solarMesh);
      }
    }

    // --- Landscaping: Architectural Trees & Foliage ---
    const createTree = (tx, tz, scale = 1, type = 'standard') => {
      const treeGroup = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 3 * scale, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A3728, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5 * scale;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const canopyColors = [0x176B4D, 0x1E7B58, 0x12553D];
      for (let i = 0; i < 3; i++) {
        const cGeo = new THREE.SphereGeometry((1.5 - i * 0.25) * scale, 8, 8);
        const cMat = new THREE.MeshStandardMaterial({ 
          color: canopyColors[i % canopyColors.length], 
          roughness: 0.8 
        });
        const canopy = new THREE.Mesh(cGeo, cMat);
        canopy.position.y = (3.2 + i * 0.9) * scale;
        canopy.castShadow = true;
        treeGroup.add(canopy);
      }
      treeGroup.position.set(tx, 0.3, tz);
      return treeGroup;
    };

    const treeCoords = [
      [-12, -5, 1.2], [-13, 4, 1.1], [-10, 10, 0.9],
      [15, -6, 1.3], [16, 2, 1.0], [15, 15, 1.1],
      [-5, -10, 1.4], [5, -11, 1.3]
    ];
    treeCoords.forEach(([tx, tz, s]) => {
      estateGroup.add(createTree(tx, tz, s));
    });

    // Decorative Hedge along boundary
    const hedgeGeo = new THREE.BoxGeometry(28, 0.8, 0.9);
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x195239, roughness: 0.9 });
    const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
    hedge.position.set(1, 0.6, -12);
    hedge.castShadow = true;
    estateGroup.add(hedge);

    // Warm LED Bollard Lights along path
    const bollardGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7);
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x1A2520, metalness: 0.8 });
    const bollardLightMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });

    const bollardPositions = [
      [-2.5, 0.5, 6.5], [-2.5, 0.5, 9.5], [-2.5, 0.5, 12.5],
      [2.5, 0.5, 6.5], [2.5, 0.5, 9.5], [2.5, 0.5, 12.5]
    ];
    bollardPositions.forEach(([bx, by, bz]) => {
      const bPost = new THREE.Mesh(bollardGeo, bollardMat);
      bPost.position.set(bx, by, bz);
      estateGroup.add(bPost);

      const bHead = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15), bollardLightMat);
      bHead.position.set(bx, by + 0.35, bz);
      estateGroup.add(bHead);
    });

    scene.add(estateGroup);

    // ==========================================
    // 7. ANIMATION LOOP & PIN SCREEN TRACKING
    // ==========================================
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (!isIntersectingRef.current) return;

      // Only perform camera lerp when transition is active (e.g. preset or pin clicked)
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

      // Screen projection of interactive pins
      const currentPins = pinData.map(pin => {
        tempVec.copy(pin.pos);
        tempVec.project(camera);

        const isBehind = tempVec.z > 1;
        const x = (tempVec.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-(tempVec.y * 0.5) + 0.5) * container.clientHeight;

        return {
          ...pin,
          x,
          y,
          visible: !isBehind && x > 25 && x < container.clientWidth - 25 && y > 35 && y < container.clientHeight - 35
        };
      });

      setScreenPins(currentPins);

      // Subtle water shimmer
      water.material.roughness = 0.06 + Math.sin(Date.now() * 0.003) * 0.025;

      renderer.render(scene, camera);
    };

    animate();

    // ==========================================
    // 8. OBSERVER & RESIZE HANDLING
    // ==========================================
    const observer = new IntersectionObserver(([entry]) => {
      isIntersectingRef.current = entry.isIntersecting;
    }, { threshold: 0.1 });

    observer.observe(container);

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.fov = newAspect < 1 ? 52 : 40;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
    };
  }, [is3DMode, isMobile]);

  // Handle Time of Day Lighting Modes
  useEffect(() => {
    if (!sceneRef.current || !lightsRef.current.sun) return;
    const scene = sceneRef.current;
    const { ambient, sun, interior, pool } = lightsRef.current;

    if (timeOfDay === 'day') {
      scene.background.set('#EAF3EE');
      scene.fog.color.set('#EAF3EE');
      ambient.color.set('#FFFFFF');
      ambient.intensity = 0.85;
      sun.color.set('#FFF3DB');
      sun.intensity = 2.0;
      sun.position.set(30, 45, 20);
      interior.intensity = 1.0;
      pool.intensity = 1.5;
    } else if (timeOfDay === 'golden') {
      scene.background.set('#FBE9D0');
      scene.fog.color.set('#FBE9D0');
      ambient.color.set('#FED7AA');
      ambient.intensity = 0.65;
      sun.color.set('#FF8C38');
      sun.intensity = 2.4;
      sun.position.set(40, 16, -30);
      interior.intensity = 2.5;
      pool.intensity = 2.2;
    } else if (timeOfDay === 'night') {
      scene.background.set('#0A1A14');
      scene.fog.color.set('#0A1A14');
      ambient.color.set('#1A3326');
      ambient.intensity = 0.25;
      sun.color.set('#60A5FA');
      sun.intensity = 0.4;
      sun.position.set(-20, 30, -20);
      interior.intensity = 4.5;
      pool.intensity = 4.0;
    }
  }, [timeOfDay]);

  // Handle Auto-Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  return (
    <section className="relative w-full rounded-3xl overflow-hidden border border-emerald-950/20 bg-slate-950 shadow-2xl mb-8">
      {is3DMode ? (
        <div 
          ref={mountRef} 
          className={`relative w-full ${isMobile ? 'h-[440px]' : 'h-[580px]'} cursor-grab active:cursor-grabbing select-none`}
        />
      ) : (
        <div className={`relative w-full ${isMobile ? 'h-[380px]' : 'h-[500px]'} overflow-hidden bg-emerald-950 flex items-center justify-center`}>
          <img 
            src="/assets/greenwood_penthouse.jpg" 
            alt="PlotPin Luxury Estate" 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        </div>
      )}

      {/* Floating 3D Interactive Hotspot Markers projected on canvas */}
      {is3DMode && showPins && screenPins.map(pin => {
        if (!pin.visible) return null;
        const isSelected = activePin?.id === pin.id;

        return (
          <div 
            key={pin.id}
            style={{ 
              position: 'absolute', 
              left: `${pin.x}px`, 
              top: `${pin.y}px`, 
              transform: 'translate(-50%, -100%)',
              zIndex: 25 
            }}
            className="pointer-events-auto"
          >
            <button
              onClick={() => handleSelectPin(pin)}
              className={`flex items-center gap-1.5 rounded-full backdrop-blur-md shadow-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                isMobile 
                  ? 'px-2 py-1 text-[10px] font-black' 
                  : 'px-3 py-1.5 text-xs font-extrabold hover:scale-105'
              } ${
                isSelected 
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-white scale-105 shadow-amber-500/50' 
                  : 'bg-slate-950/85 hover:bg-emerald-900 text-white border border-emerald-400/50'
              }`}
            >
              <span className="shrink-0">{pin.icon}</span>
              <span className="font-display">
                {isMobile ? pin.shortTitle : pin.title}
              </span>
            </button>
          </div>
        );
      })}

      {/* Top Overlay Controls Bar (Clean, Non-wrapping, Responsive) */}
      <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 flex items-center justify-between pointer-events-none z-30">
        
        {/* Left Badge: Compact on mobile, detailed on desktop */}
        <div className="pointer-events-auto shrink-0">
          <div className="bg-slate-950/85 backdrop-blur-md text-white border border-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-black tracking-wide uppercase font-display text-emerald-300 whitespace-nowrap">
              {isMobile ? '3D Estate' : 'Interactive 3D Estate'}
            </span>
            {!isMobile && (
              <span className="text-[11px] text-slate-400 border-l border-slate-700 pl-2 whitespace-nowrap">
                Drag to Orbit · Scroll to Zoom
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Daylight/Sunset/Night + Pins + Rotate + 2D/3D */}
        <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg shrink-0">
          {is3DMode && (
            <div className="flex items-center bg-white/10 rounded-xl p-0.5">
              <button
                onClick={() => setTimeOfDay('day')}
                className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'day' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'}`}
                title="Daylight mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTimeOfDay('golden')}
                className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'golden' ? 'bg-orange-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                title="Golden Hour Sunset"
              >
                <Sunset className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTimeOfDay('night')}
                className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'night' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                title="Night Ambient mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {is3DMode && (
            <button
              onClick={() => setShowPins(!showPins)}
              className={`p-1.5 rounded-xl text-xs font-bold transition-all ${showPins ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white bg-white/5'}`}
              title={showPins ? "Hide 3D Hotspot Badges" : "Show 3D Hotspot Badges"}
            >
              {showPins ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {is3DMode && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-1.5 rounded-xl text-xs font-bold transition-all ${autoRotate ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white bg-white/5'}`}
              title="Toggle Auto Rotation"
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </button>
          )}

          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className="px-2 py-1.5 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1"
            title="Toggle between 3D WebGL and 2D mode"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">{is3DMode ? '3D' : '2D'}</span>
          </button>
        </div>
      </div>

      {/* Selected Feature Detail Card */}
      {activePin && (
        <div className={`absolute z-30 animate-in fade-in zoom-in-95 ${
          isMobile 
            ? 'top-14 left-3 right-3' 
            : 'bottom-20 left-4 max-w-sm'
        }`}>
          <div className="bg-slate-950/95 backdrop-blur-xl p-3.5 rounded-2xl border border-emerald-500/40 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-black text-sm text-emerald-400">
                <span>{activePin.icon}</span>
                <span>{activePin.title}</span>
              </div>
              <button 
                onClick={() => setActivePin(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-snug">{activePin.subtitle}</p>
          </div>
        </div>
      )}

      {/* Camera Presets Bar */}
      {is3DMode && (
        <div className={`absolute z-20 pointer-events-auto ${
          isMobile 
            ? 'bottom-14 left-3 right-3 flex items-center justify-center gap-1 overflow-x-auto py-1' 
            : 'bottom-4 right-4 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-xl'
        }`}>
          {!isMobile && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Preset:</span>
          )}
          {Object.entries(presets).map(([key, item]) => (
            <button
              key={key}
              onClick={() => handleSelectPreset(key)}
              className={`rounded-xl font-bold transition-all whitespace-nowrap ${
                isMobile 
                  ? 'px-2.5 py-1 text-[10px] bg-slate-950/80 backdrop-blur-md border border-white/10' 
                  : 'px-3 py-1 text-xs'
              } ${
                activePreset === key 
                  ? 'bg-emerald-600 text-white shadow-md border-emerald-400/50' 
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Bar: Action & Reset */}
      <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Desktop left brand pill / Mobile left indicator */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isMobile ? (
            <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 text-white flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black tracking-wide text-emerald-300">Villa Twin</span>
            </div>
          ) : (
            <div className="bg-slate-950/85 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-emerald-500/30 text-white shadow-2xl flex items-center gap-3">
              <div>
                <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Direct Owner Villa</div>
                <div className="text-xs font-bold text-white">4,850 sq.ft Architectural Twin</div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: Explore & Reset */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={onExploreClick}
            className="bg-[#176B4D] hover:bg-[#12553D] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 flex items-center gap-1.5 transition-all"
          >
            <span>Explore</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleSelectPreset('overview')}
            className="bg-slate-900/85 hover:bg-slate-800 text-white p-1.5 sm:p-2 rounded-xl border border-white/10 shadow active:scale-95 transition-all"
            title="Reset 3D View to Overview"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-300" />
          </button>
        </div>
      </div>
    </section>
  );
}
