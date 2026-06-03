import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader, OrbitControls } from 'three-stdlib';

interface TalkingHeadProps {
  text: string;
  lang?: string;
  autoSpeak?: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default function TalkingHead3D({
  text,
  lang = 'pt-PT',
  autoSpeak = false,
  onSpeakingChange,
}: TalkingHeadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string>('Carregar modelo...');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fbxRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef(0);

  // Morph target refs
  const meshesWithMorphs = useRef<THREE.SkinnedMesh[]>([]);
  const morphMap = useRef<{
    jawOpen: { mesh: THREE.SkinnedMesh; index: number } | null;
    eyeBlinkLeft: { mesh: THREE.SkinnedMesh; index: number } | null;
    eyeBlinkRight: { mesh: THREE.SkinnedMesh; index: number } | null;
  }>({ jawOpen: null, eyeBlinkLeft: null, eyeBlinkRight: null });

  // Lip sync state
  const isSpeakingRef = useRef(false);
  const speechIntensity = useRef(0);
  const lipPhase = useRef(0);
  const lastBoundaryTime = useRef(0);
  const simulatedSpeaking = useRef(false);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blink
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const blinkProgress = useRef(0);
  const currentBlinkL = useRef(0);
  const currentBlinkR = useRef(0);

  // Idle
  const idleTime = useRef(0);
  const fbxBaseY = useRef(0);

  // Current smooth jaw
  const currentJaw = useRef(0);

  const setIsSpeakingState = useRef(setIsSpeaking);
  setIsSpeakingState.current = setIsSpeaking;
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;

  const speak = useCallback(() => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.05;

    u.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeakingState.current(true);
      onSpeakingChangeRef.current?.(true);
      speechIntensity.current = 0.65;
      lipPhase.current = 0;
      console.log('[TalkingHead3D] Speech started, intensity=0.65');
    };

    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name === 'word') {
        speechIntensity.current = 0.75 + Math.random() * 0.25;
        lipPhase.current += 0.5 + Math.random() * 0.5;
        lastBoundaryTime.current = performance.now();
      }
    };

    u.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeakingState.current(false);
      onSpeakingChangeRef.current?.(false);
      speechIntensity.current = 0;
    };

    u.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeakingState.current(false);
      onSpeakingChangeRef.current?.(false);
      speechIntensity.current = 0;
    };

    window.speechSynthesis.speak(u);
  }, [text, lang]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeakingState.current(false);
    onSpeakingChangeRef.current?.(false);
    speechIntensity.current = 0;
    simulatedSpeaking.current = false;
  }, []);

  const handleSpeakToggle = useCallback(() => {
    if (isSpeakingRef.current || simulatedSpeaking.current) {
      stop();
    } else {
      speak();
    }
  }, [speak, stop]);

  // Auto-speak when text changes
  useEffect(() => {
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    if (simEndTimeoutRef.current) clearTimeout(simEndTimeoutRef.current);
    if (!text || !autoSpeak || loadStatus !== 'ready') return;

    // Simulated speaking fallback (in case TTS fails silently)
    simulatedSpeaking.current = true;
    speechIntensity.current = 0.5;
    setIsSpeakingState.current(true);
    onSpeakingChangeRef.current?.(true);

    simEndTimeoutRef.current = setTimeout(() => {
      simulatedSpeaking.current = false;
      if (!isSpeakingRef.current) {
        setIsSpeakingState.current(false);
        onSpeakingChangeRef.current?.(false);
      }
    }, 3500);

    speakTimeoutRef.current = setTimeout(() => {
      speak();
    }, 200);

    return () => {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      if (simEndTimeoutRef.current) clearTimeout(simEndTimeoutRef.current);
      if (!isSpeakingRef.current) simulatedSpeaking.current = false;
    };
  }, [text, autoSpeak, speak, loadStatus, onSpeakingChange]);

  // Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1a0e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 100);
    camera.position.set(0, 0.5, 3.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    canvasRef.current = renderer.domElement;
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.5, 0);
    controls.minDistance = 0.3;
    controls.maxDistance = 10;
    controls.update();
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0xffccaa, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x443322, 0.4);
    scene.add(hemiLight);

    // Fallback sphere (immediate visual feedback)
    const sphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff4400,
      emissiveIntensity: 0.5,
    });
    const fallbackSphere = new THREE.Mesh(sphereGeom, sphereMat);
    fallbackSphere.position.set(0, 0.5, 0);
    scene.add(fallbackSphere);

    // Load FBX
    const loader = new FBXLoader();
    console.log('[TalkingHead3D] Loading FBX...');

    // @ts-ignore - FBXLoader types incomplete for progress/error callbacks
    loader.load(
    '/model.fbx',
    // @ts-ignore
    (fbx: any) => {
    console.log('[TalkingHead3D] FBX loaded, traversing children...');

    // Force all materials to be visible - FBX material import often fails
    fbx.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const origMat = mesh.material;
        const mats = Array.isArray(origMat) ? origMat : [origMat];
        const newMats = mats.map((mat: THREE.Material) => {
          // If it's StandardMaterial with no map, just make it visible
          if (mat.type === 'MeshStandardMaterial' || mat.type === 'MeshPhongMaterial') {
            const m = mat as THREE.MeshStandardMaterial;
            console.log('[TalkingHead3D] Mesh', mesh.name, 'material type:', mat.type, 'color:', m.color?.getHexString(), 'map:', !!m.map, 'alphaMap:', !!m.alphaMap);
            // If color is black or very dark, override
            if (!m.map) {
              if (m.color && m.color.getHex() <= 0x222222) {
                console.log('[TalkingHead3D] Overriding dark material on', mesh.name);
                m.color.setHex(0xcc9966);
              }
            }
            m.needsUpdate = true;
            m.side = THREE.DoubleSide;
            return m;
          }
          // Unknown material type - replace with visible one
          console.log('[TalkingHead3D] Unknown material type on', mesh.name, ':', mat.type);
          const newMat = new THREE.MeshStandardMaterial({
            color: 0xcc9966,
            roughness: 0.5,
            metalness: 0.0,
            side: THREE.DoubleSide,
          });
          return newMat;
        });
        mesh.material = mats.length > 1 ? newMats as THREE.Material[] : newMats[0] as THREE.Material;
        mesh.frustumCulled = false;
        console.log('[TalkingHead3D] Processed mesh:', mesh.name, 'geometry:', mesh.geometry?.type);
      }
    });

    // Remove fallback sphere
    scene.remove(fallbackSphere);
    sphereGeom.dispose();
    sphereMat.dispose();

    // Auto-scale
    fbx.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fbx);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = maxDim > 0 ? 1.8 / maxDim : 0.01;
    console.log('[TalkingHead3D] FBX size:', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3), 'scale:', scaleFactor);

    fbx.scale.setScalar(scaleFactor);
    fbx.updateMatrixWorld(true);

    // Center after scaling - put the head at camera center
    const newBox = new THREE.Box3().setFromObject(fbx);
    const center = newBox.getCenter(new THREE.Vector3());
    const scaledSize = newBox.getSize(new THREE.Vector3());
    const headOffset = scaledSize.y * 0.60;
    fbx.position.set(-center.x, -center.y + headOffset, -center.z);
    fbx.updateMatrixWorld(true);

    console.log('[TalkingHead3D] After center - pos:', fbx.position.x.toFixed(3), fbx.position.y.toFixed(3), fbx.position.z.toFixed(3), 'headOffset:', headOffset.toFixed(3));
    console.log('[TalkingHead3D] Scaled size:', scaledSize.x.toFixed(3), scaledSize.y.toFixed(3), scaledSize.z.toFixed(3));

    // Recompute bounding box AFTER position offset
    fbx.updateMatrixWorld(true);
    const finalBox = new THREE.Box3().setFromObject(fbx);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    const finalSize = finalBox.getSize(new THREE.Vector3());
    const headY = finalCenter.y + finalSize.y * 0.30;
    console.log('[TalkingHead3D] Final center:', finalCenter.y.toFixed(3), 'size:', finalSize.y.toFixed(3), 'headY:', headY.toFixed(3));

    // Face zoom
    camera.position.set(0, headY, 1.3);
    controls.target.set(0, headY + 0.02, 0);
    controls.minDistance = 0.3;
    controls.maxDistance = 4;
    controls.update();

        // Detect morph targets
        const found: THREE.SkinnedMesh[] = [];
        fbx.traverse((child: THREE.Object3D) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh && (child as THREE.SkinnedMesh).morphTargetDictionary) {
            const mesh = child as THREE.SkinnedMesh;
            const morphNames = Object.keys(mesh.morphTargetDictionary);
            const morphInfluences = mesh.morphTargetInfluences;
            console.log('[TalkingHead3D] ===== SkinnedMesh:', mesh.name, '=====');
            console.log('[TalkingHead3D]   morph count:', morphNames.length);
            console.log('[TalkingHead3D]   influences array length:', morphInfluences ? morphInfluences.length : 'null');
            morphNames.forEach((n, i) => {
              console.log('[TalkingHead3D]   morph[' + i + '] =', n);
            });
            found.push(mesh);

            for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
              const kl = (name as string).toLowerCase();
              if (/jaw|mouth/.test(kl)) {
                // If we already have a jawOpen from a previous mesh, keep the first
                // or if we want to aggregate, we'll handle multiple
                if (morphMap.current.jawOpen && morphMap.current.jawOpen.mesh !== mesh) {
                  // Multiple meshes have jaw morphs -- log all
                  console.log('[TalkingHead3D] Additional jaw morph on mesh', mesh.name, ':', name, 'index', idx);
                }
                morphMap.current.jawOpen = { mesh, index: idx as number };
                console.log('[TalkingHead3D] jawOpen SET:', name, 'index', idx, 'on mesh', mesh.name);
              }
              if (/blink/.test(kl) && /left/.test(kl)) {
                morphMap.current.eyeBlinkLeft = { mesh, index: idx as number };
                console.log('[TalkingHead3D] eyeBlinkLeft SET:', name, 'index', idx, 'on mesh', mesh.name);
              }
              if (/blink/.test(kl) && /right/.test(kl)) {
                morphMap.current.eyeBlinkRight = { mesh, index: idx as number };
                console.log('[TalkingHead3D] eyeBlinkRight SET:', name, 'index', idx, 'on mesh', mesh.name);
              }
            }

            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((mat: THREE.Material) => {
                if ('needsUpdate' in mat) mat.needsUpdate = true;
              });
            }

            mesh.frustumCulled = false;
          }
        });

        meshesWithMorphs.current = found;
        console.log('[TalkingHead3D] Total morph meshes:', found.length);

        scene.add(fbx);
        fbxRef.current = fbx;
        fbxBaseY.current = fbx.position.y;

        setStatus('Pronto');
        setLoadStatus('ready');
        console.log('[TalkingHead3D] Ready');
      },
      (progress: any) => {
        if (progress.total > 0) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          setStatus(`Carregar modelo... ${pct}%`);
        }
      },
      (error: any) => {
        console.error('[TalkingHead3D] FBX error:', error);
        setStatus('Erro ao carregar modelo');
        setLoadStatus('error');
      }
    );

    // Animation loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      idleTime.current += 0.016;

      const speaking = isSpeakingRef.current || simulatedSpeaking.current;

      // Lip sync - direct jawOpen morph animation with speech event response
      if (speaking) {
        // Decay intensity naturally between word boundaries
        speechIntensity.current *= 0.97;
        const intensity = Math.max(0.05, speechIntensity.current);

        // Update phase for subtle modulation (not sine wave oscillation)
        lipPhase.current += 0.03 + intensity * 0.06;

        // On word boundaries, intensity spikes to 0.7-1.0 (set in onboundary)
        // Base open mouth during speech: 0.3
        // Add intensity-driven opening: intensity * 0.5
        // Add subtle pseudo-noise modulation instead of raw sine
        const noiseMod = Math.sin(lipPhase.current * 4.7) * 0.08 + Math.sin(lipPhase.current * 7.3) * 0.05;
        const target = clamp(0.30 + intensity * 0.50 + noiseMod, 0, 1);

        // Fast attack (0.35) for responsiveness, slower decay (0.25) handled by intensity fade
        currentJaw.current += (target - currentJaw.current) * 0.35;

        if (morphMap.current.jawOpen) {
          const { mesh, index } = morphMap.current.jawOpen;
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences[index] = currentJaw.current;
            // Log morph influence periodically for debugging
            if (Math.random() < 0.02) {
              console.log('[TalkingHead3D] jawOpen influence:', currentJaw.current.toFixed(3), 'intensity:', intensity.toFixed(3));
            }
          }
        }
      } else {
        // Smoothly close mouth when not speaking
        if (currentJaw.current > 0.001) {
          currentJaw.current += (0 - currentJaw.current) * 0.12;
        } else {
          currentJaw.current = 0;
        }
        if (morphMap.current.jawOpen) {
          const { mesh, index } = morphMap.current.jawOpen;
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences[index] = currentJaw.current;
          }
        }
      }

      // Idle breathing
      if (fbxRef.current) {
        const breathY = Math.sin(idleTime.current * 1.5) * 0.001;
        const breathRot = Math.sin(idleTime.current * 0.7) * 0.003;
        fbxRef.current.position.y = fbxBaseY.current + breathY;
        fbxRef.current.rotation.x += breathRot - fbxRef.current.rotation.x * 0.05;
      }

      // Blink
      blinkTimer.current += 1;
      if (!isBlinking.current && blinkTimer.current > 180 + Math.random() * 120) {
        isBlinking.current = true;
        blinkTimer.current = 0;
        blinkProgress.current = 0;
      }

      if (isBlinking.current) {
        blinkProgress.current += 0.12;
        const bv = blinkProgress.current < 0.5
          ? blinkProgress.current * 2
          : 2 - blinkProgress.current * 2;
        const smoothB = clamp(bv, 0, 1);

        if (morphMap.current.eyeBlinkLeft) {
          const { mesh, index } = morphMap.current.eyeBlinkLeft;
          if (mesh.morphTargetInfluences) {
            currentBlinkL.current += (smoothB - currentBlinkL.current) * 0.4;
            mesh.morphTargetInfluences[index] = currentBlinkL.current;
          }
        }
        if (morphMap.current.eyeBlinkRight) {
          const { mesh, index } = morphMap.current.eyeBlinkRight;
          if (mesh.morphTargetInfluences) {
            currentBlinkR.current += (smoothB - currentBlinkR.current) * 0.4;
            mesh.morphTargetInfluences[index] = currentBlinkR.current;
          }
        }

        if (blinkProgress.current >= 1) {
          isBlinking.current = false;
          if (morphMap.current.eyeBlinkLeft) {
            const { mesh, index } = morphMap.current.eyeBlinkLeft;
            if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 0;
          }
          if (morphMap.current.eyeBlinkRight) {
            const { mesh, index } = morphMap.current.eyeBlinkRight;
            if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 0;
          }
          currentBlinkL.current = 0;
          currentBlinkR.current = 0;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    // Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.speechSynthesis.cancel();
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl bg-[#2a1a0e]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {loadStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#2a1a0e]">
          <div className="w-10 h-10 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-[#C8A96E]/70 text-xs">{status}</span>
        </div>
      )}

      {loadStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#2a1a0e]">
          <span className="text-red-400/80 text-xs">{status}</span>
          <button onClick={() => window.location.reload()} className="mt-3 text-[#C8A96E] text-xs underline">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Status badge */}
      {loadStatus === 'ready' && (
        <div className="absolute top-3 left-3 z-20 bg-black/50 text-white/80 rounded-full text-[10px] px-2 py-0.5">
          {status}
        </div>
      )}

      {/* Speak / Stop button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={handleSpeakToggle}
          className="px-4 py-2 text-xs font-semibold rounded-full bg-white/10 text-white hover:bg-white/20 transition shadow-lg backdrop-blur-sm"
        >
          {isSpeakingRef.current || simulatedSpeaking.current ? 'Parar' : 'Ouvir Luis'}
        </button>
      </div>
    </div>
  );
}
