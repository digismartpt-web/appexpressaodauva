import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

interface TalkingHeadProps {
  text: string;
  lang?: string;
  autoSpeak?: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
}

export default function TalkingHead3D({ text, lang='pt-PT', autoSpeak=false, onSpeakingChange }: TalkingHeadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('A preparar...');
  const [mode, setMode] = useState<'idle'|'talking'>('idle');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fbxGroupRef = useRef<THREE.Group | null>(null);
  const animRef = useRef(0);

  const morphNames = useRef<Record<string, number>>({});
  const speechIntensity = useRef(0);
  const lipPhase = useRef(0);
  const isSpeakingRef = useRef(false);
  const blinkCounter = useRef(0);
  const isBlinking = useRef(false);
  const animTime = useRef(0);

  const speak = useCallback(() => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 1.05;
    u.onstart = () => {
      isSpeakingRef.current = true;
      setMode('talking');
      onSpeakingChange?.(true);
      speechIntensity.current = 0.5;
      lipPhase.current = 0;
    };
    u.onboundary = (_e: SpeechSynthesisEvent) => {
      if (_e.name === 'word') {
        speechIntensity.current = 0.7 + Math.random() * 0.3;
        lipPhase.current += 0.5 + Math.random();
      }
    };
    u.onend = () => {
      isSpeakingRef.current = false;
      speechIntensity.current = 0;
      setMode('idle');
      onSpeakingChange?.(false);
    };
    u.onerror = () => { isSpeakingRef.current = false; setMode('idle'); };
    window.speechSynthesis.speak(u);
  }, [text, lang, onSpeakingChange]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setMode('idle');
    onSpeakingChange?.(false);
  }, [onSpeakingChange]);

  useEffect(() => {
    if (!text || !autoSpeak) return;
    const t = setTimeout(() => speak(), 400);
    return () => clearTimeout(t);
  }, [text, autoSpeak, speak]);

  function createFallbackHead(scene: THREE.Scene) {
    const group = new THREE.Group();
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 32), headMat);
    head.position.y = 1.7;
    group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.25, 1.85, -0.8);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.25, 1.85, -0.8);
    group.add(eyeR);

    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 8),
      new THREE.MeshStandardMaterial({ color: 0xcc4444 })
    );
    mouth.position.set(0, 1.55, -0.85);
    mouth.scale.y = 0.3;
    mouth.name = 'mouth';
    group.add(mouth);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 1.0, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 })
    );
    body.position.y = 0.5;
    group.add(body);

    scene.add(group);
    setStatus('Modo alternativo');
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const w = el.clientWidth || 340;
    const h = el.clientHeight || 380;

    setStatus('Iniciando 3D...');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1a0e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(30, w/h, 0.01, 100);
    camera.position.set(0, 1.8, 4.0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus('WebGL indisponivel');
      return;
    }
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    ctrl.minDistance = 1.5;
    ctrl.maxDistance = 8;
    ctrl.target.set(0, 1.8, 0);
    controlsRef.current = ctrl;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffeedd, 3.0); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8888ff, 1.5); fill.position.set(-3, 2, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 2.0); rim.position.set(0, 2, -6); scene.add(rim);
    const top = new THREE.DirectionalLight(0xffffff, 1.0); top.position.set(0, 6, 0); scene.add(top);

    // Load FBX
    const loader = new FBXLoader();
    let fallbackUsed = false;

    loader.load(
      '/model.fbx',
      (fbx: THREE.Group) => {
        console.log('[TalkingHead3D] FBX loaded');
        setStatus('A processar...');

        const box = new THREE.Box3().setFromObject(fbx);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        console.log(`[TalkingHead3D] Size: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
        console.log(`[TalkingHead3D] Center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);

        // Scale so model is ~1.8 units tall (head + shoulders)
        const targetHeight = 1.8;
        const scale = maxDim > 0.001 ? targetHeight / maxDim : 1;
        fbx.scale.setScalar(scale);
        fbx.updateMatrixWorld(true);

        const box2 = new THREE.Box3().setFromObject(fbx);
        const ctr2 = box2.getCenter(new THREE.Vector3());
        const sz2 = box2.getSize(new THREE.Vector3());

        console.log(`[TalkingHead3D] Scaled size: ${sz2.y.toFixed(3)}, center y: ${ctr2.y.toFixed(3)}`);

        // Center horizontally, position vertically so model sits at y≈1.8
        fbx.position.set(-ctr2.x, -ctr2.y + 1.8, -ctr2.z);
        fbx.updateMatrixWorld(true);

        scene.add(fbx);
        fbxGroupRef.current = fbx;

        // Detect morph targets
        const morphMap: Record<string, number> = {};
        fbx.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          const g = mesh.geometry;
          if (!g.morphAttributes?.position) return;
          for (let i = 0; i < g.morphAttributes.position.length; i++) {
            const name = (g.morphTargets?.[i]?.name || `t${i}`).toLowerCase();
            morphMap[name] = i;
          }
        });

        console.log('[TalkingHead3D] Morphs:', Object.keys(morphMap).join(', '));

        const mt = morphNames.current;
        for (const [name, idx] of Object.entries(morphMap)) {
          if (name.includes('jaw') || name.includes('open') || name.includes('mouth')) {
            mt.jawOpen = idx;
          } else if (name.includes('blink') || name.includes('eye')) {
            if (name.includes('l') && !name.includes('r')) mt.eyeBlinkL = idx;
            else if (name.includes('r') && !name.includes('l')) mt.eyeBlinkR = idx;
            else { mt.eyeBlinkL ??= idx; mt.eyeBlinkR ??= idx; }
          }
        }

        // Fallback: assign by index order
        if (mt.jawOpen === undefined && Object.keys(morphMap).length > 0) {
          const sorted = Object.entries(morphMap).sort((a, b) => a[1] - b[1]);
          mt.jawOpen = sorted[0][1];
          if (sorted.length > 1) mt.eyeBlinkL = sorted[1][1];
          if (sorted.length > 2) mt.eyeBlinkR = sorted[2][1];
        }

        console.log('[TalkingHead3D] Mapping:', mt);

        // Init morph arrays
        fbx.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry?.morphAttributes?.position) return;
          mesh.morphTargetInfluences = new Array(mesh.geometry.morphAttributes.position.length).fill(0);
        });

        setStatus('Luis pronto');
      },
      (xhr: { loaded: number; total: number }) => {
        if (xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          if (pct % 25 === 0) setStatus(`Carregando ${pct}%`);
        }
      },
      (_err: unknown) => {
        console.error('[TalkingHead3D] FBX error:', _err);
        setStatus('Erro FBX');
        fallbackUsed = true;
        createFallbackHead(scene);
      }
    );

    function animate() {
      animRef.current = requestAnimationFrame(animate);

      // Blink
      blinkCounter.current++;
      if (!isBlinking.current && blinkCounter.current > 180 + Math.random() * 120) {
        isBlinking.current = true;
        blinkCounter.current = 0;
      }
      if (isBlinking.current && blinkCounter.current > 4) {
        isBlinking.current = false;
      }

      const fb = fbxGroupRef.current;
      if (fb && !fallbackUsed) {
        fb.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry?.morphAttributes?.position) return;
          const inf = mesh.morphTargetInfluences || [];
          const mt = morphNames.current;

          if (mt.eyeBlinkL !== undefined) inf[mt.eyeBlinkL] = isBlinking.current ? 1 : 0;
          if (mt.eyeBlinkR !== undefined) inf[mt.eyeBlinkR] = isBlinking.current ? 1 : 0;

          if (mt.jawOpen !== undefined) {
            speechIntensity.current *= 0.985;
            const intensity = Math.max(0, Math.min(1, speechIntensity.current));
            const active = isSpeakingRef.current;
            lipPhase.current += 0.03 + intensity * 0.03;
            let jawVal = 0.02;
            if (active) {
              const osc = Math.sin(lipPhase.current * 8) * 0.25;
              jawVal = 0.1 + intensity * 0.6 + osc * 0.25;
            }
            inf[mt.jawOpen] = Math.min(jawVal, 1.0);
          }

          mesh.morphTargetInfluences = inf;
        });

        // Breathing
        animTime.current += 0.01;
        fb.position.y += Math.sin(animTime.current * 1.5) * 0.0005;
      } else if (fallbackUsed) {
        scene.traverse((child: THREE.Object3D) => {
          if (child.name === 'mouth') {
            const active = isSpeakingRef.current;
            const target = active ? 0.5 + Math.sin(Date.now() * 0.01) * 0.3 : 0.3;
            child.scale.y += (target - child.scale.y) * 0.1;
          }
        });
      }

      ctrl.update();
      renderer.render(scene, camera);
    }
    animRef.current = requestAnimationFrame(animate);

    const resize = () => {
      const cw = el.clientWidth || 340;
      const ch = el.clientHeight || 380;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      el.innerHTML = '';
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl bg-[#2a1a0e]">
      <div ref={containerRef} className="w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing relative" />
      <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
        <span className="text-white/70 text-[10px]">{status}</span>
      </div>
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-20">
        {mode === 'idle' ? (
          <button onClick={speak} disabled={!text}
            className="flex items-center gap-2 px-5 py-2 bg-[#111] text-white rounded-full hover:bg-[#333] active:scale-95 transition-all text-sm font-medium shadow-lg border border-[#C8A96E]/20 disabled:opacity-40">
            Ouvir Luis
          </button>
        ) : (
          <button onClick={stop}
            className="flex items-center gap-2 px-5 py-2 bg-[#8B5E3C] text-white rounded-full hover:bg-[#6f4d2e] active:scale-95 transition-all text-sm font-medium shadow-lg">
            Parar
          </button>
        )}
      </div>
    </div>
  );
}
