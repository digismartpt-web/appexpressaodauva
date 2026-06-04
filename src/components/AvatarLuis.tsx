import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three-stdlib';

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

interface JawProfile {
  timings: number[];
  values: number[];
}

// ============================================================
// TEXT-BASED PHONEME PROFILE
// Maps each character to a jaw value based on Portuguese phonemes.
// Vowels = open mouth, consonants = closed mouth.
// Values are in the 0-0.3 range (direct morph target range).
// Weights control timing (vowels held longer).
// ============================================================
function generateJawProfile(text: string): JawProfile {
  const timings: number[] = [];
  const values: number[] = [];

  const chars = text.toLowerCase().split('');

  // Portuguese phoneme groups
  const wideVowels = new Set(['a', 'á', 'à', 'â', 'ã', 'e', 'é', 'ê', 'o', 'ó', 'ô', 'õ']);
  const midVowels = new Set(['i', 'í', 'u', 'ú']);
  const consonants = new Set([
    'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n',
    'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z',
  ]);

  // First pass: assign weight and jaw value per character
  // Values are chosen to work in 0.01-0.30 range (morph target range)
  const records: { weight: number; value: number }[] = [];
  let totalWeight = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const nextCh = i < chars.length - 1 ? chars[i + 1] : '';

    // Portuguese nasal diphthongs - wide open mouth
    if ((ch === 'a' && nextCh === 'o') || (ch === 'ã' && nextCh === 'o')) {
      records.push({ weight: 4.0, value: 0.40 });
      totalWeight += 4.0;
      i++;
      continue;
    }
    if ((ch === 'ã' && nextCh === 'e') || (ch === 'a' && nextCh === 'e')) {
      records.push({ weight: 3.5, value: 0.35 });
      totalWeight += 3.5;
      i++;
      continue;
    }
    if (ch === 'õ' && nextCh === 'e') {
      records.push({ weight: 3.5, value: 0.32 });
      totalWeight += 3.5;
      i++;
      continue;
    }

    if (wideVowels.has(ch)) {
      // 'a' sounds are the most open
      const val = ch === 'a' || ch === 'á' || ch === 'à' || ch === 'â' || ch === 'ã' ? 0.30 : 0.22;
      records.push({ weight: 3.0, value: clamp(val, 0.01, 0.50) });
    } else if (midVowels.has(ch)) {
      // 'i', 'u' - medium open
      records.push({ weight: 2.0, value: 0.14 });
    } else if (consonants.has(ch)) {
      // Labial consonants (m,b,p,f,v) - mouth almost closed
      // Other consonants - mouth closed
      const val = ['f', 'v', 'm', 'b', 'p'].includes(ch) ? 0.05 : 0.02;
      records.push({ weight: 0.6, value: clamp(val, 0.01, 0.50) });
    } else if (ch === ' ' || ch === '\n' || ch === '\t') {
      records.push({ weight: 0.3, value: 0.01 });
    } else if ('.!,?;:'.includes(ch)) {
      records.push({ weight: 0.8, value: 0.01 });
    } else {
      records.push({ weight: 1.0, value: 0.03 });
    }
    totalWeight += records[records.length - 1].weight;
  }

  // Second pass: compute normalized cumulative timings (0–1)
  let cumulativeWeight = 0;
  for (const rec of records) {
    cumulativeWeight += rec.weight;
    timings.push(totalWeight > 0 ? cumulativeWeight / totalWeight : 1);
    values.push(rec.value);
  }

  return { timings, values };
}

// ============================================================
// AUDIO WAVEFORM ENERGY ENVELOPE
// Pre-computes RMS energy at ~100 points across the audio.
// Used ONLY for micro-variations — not as the primary jaw driver.
// ============================================================
function computeEnergyEnvelope(audioBuffer: AudioBuffer, numWindows: number): JawProfile {
  const timings: number[] = [];
  const values: number[] = [];

  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const windowSize = Math.max(1, Math.floor(totalSamples / numWindows));

  // Compute raw RMS for each window
  const rawValues: number[] = [];
  let maxRms = 0;
  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, totalSamples);
    let sumSq = 0;
    let count = 0;
    for (let s = start; s < end; s++) {
      sumSq += channelData[s] * channelData[s];
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    rawValues.push(rms);
    if (rms > maxRms) maxRms = rms;
  }

  // Normalize to 0-1
  const normalized = rawValues.map((v) => (maxRms > 0 ? v / maxRms : 0));

  // Apply moving average smoothing (window of 5)
  const smoothed: number[] = [];
  const halfWindow = 2;
  for (let i = 0; i < normalized.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < normalized.length) {
        sum += normalized[idx];
        count++;
      }
    }
    smoothed.push(count > 0 ? sum / count : 0);
  }

  // Generate evenly-spaced timings
  for (let i = 0; i < numWindows; i++) {
    timings.push((i + 1) / numWindows);
    values.push(smoothed[i]);
  }

  return { timings, values };
}

export default function AvatarLuis({
  text,
  lang = 'pt-PT',
  autoSpeak = false,
  onSpeakingChange,
}: TalkingHeadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const fbxRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef(0);

  // Morph target refs
  const jawOpenIndices = useRef<number[]>([]);
  const blinkLeftIndices = useRef<number[]>([]);
  const blinkRightIndices = useRef<number[]>([]);
  const morphMeshes = useRef<THREE.SkinnedMesh[]>([]);

  // Speech
  const isSpeakingRef = useRef(false);
  const speechDuration = useRef(0);
  const speechStartTime = useRef(0);
  const jawProfileRef = useRef<JawProfile>({ timings: [], values: [] });
  const currentJaw = useRef(0);
  const lastTextRef = useRef('');

  // TTS audio
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Energy envelope for micro-variations
  const energyEnvelopeRef = useRef<JawProfile>({ timings: [], values: [] });
  const isEnergyProfileRef = useRef(false);

  // Blink
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const blinkProgress = useRef(0);

  // Idle
  const idleTime = useRef(0);
  const fbxBaseY = useRef(0);

  // Debugging
  const frameCounter = useRef(0);
  const forceOpenTimer = useRef(0);
  const forceOpenActive = useRef(false);
  const jawEverMoved = useRef(false);

  // TTS proxy base URL — use current hostname so it works from client browser
  const TTS_BASE_URL = `http://${window.location.hostname}:8766`;

  const speak = useCallback(() => {
    console.log(`[DEBUG] speak() called, text length=${text ? text.length : 0}`);
    if (!text) return;

    // Cancel any previous audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    // Reset jaw to closed immediately
    currentJaw.current = 0.01;

    // Build TTS URL
    const encodedText = encodeURIComponent(text);
    const voice = encodeURIComponent('pt-PT-DuarteNeural');
    const audioUrl = `${TTS_BASE_URL}/tts?text=${encodedText}&voice=${voice}`;

    console.log(`[AvatarLuis] speak(): Fetching TTS audio for "${text.substring(0, 40)}..."`);

    // Fetch the audio as ArrayBuffer, analyze waveform, then play
    (async () => {
      try {
        // Step 1: Fetch audio data as ArrayBuffer
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`TTS fetch failed: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Step 2: Decode audio for waveform analysis (AudioContext used ONLY for decodeAudioData)
        const audioContext = new AudioContext();
        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        } finally {
          // Close the AudioContext immediately after decoding
          audioContext.close();
        }

        // Step 3: Compute energy envelope from the waveform
        const energyProfile = computeEnergyEnvelope(audioBuffer, 100);
        energyEnvelopeRef.current = energyProfile;
        // Use TEXT-BASED phoneme profile for mouth shapes
        jawProfileRef.current = generateJawProfile(text);
        {
          const p = jawProfileRef.current;
          const vals = p.values;
          const mn = vals.length > 0 ? Math.min(...vals) : 0;
          const mx = vals.length > 0 ? Math.max(...vals) : 0;
          console.log(`[DEBUG] profile generated: ${p.timings.length} entries, values range: ${mn.toFixed(4)}-${mx.toFixed(4)}`);
        }
        isEnergyProfileRef.current = false;
        console.log(`[AvatarLuis] Hybrid lip-sync: ${jawProfileRef.current.timings.length} phoneme entries`);

        // Step 4: Create a Blob URL from the fetched audio data and play it
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);

        const audio = new Audio();
        audio.src = blobUrl;
        currentAudioRef.current = audio;

        // Set speech state BEFORE play() to avoid race condition
        // Use audioBuffer.duration (accurate) — audio.duration is 0 before metadata loads
        const rawDuration = audioBuffer.duration * 1000;
        speechDuration.current = (rawDuration > 0 && isFinite(rawDuration)) ? rawDuration : Math.max((text.length / 15) * 1000, 500);
        console.log(`[DEBUG] speechDuration=${speechDuration.current} ms (from audioBuffer.duration=${audioBuffer.duration})`);
        speechStartTime.current = performance.now();
        currentJaw.current = 0.01;
        isSpeakingRef.current = true;
        console.log(`[DEBUG] isSpeaking=true (normal path)`);
        setIsSpeaking(true);
        onSpeakingChange?.(true);

        audio.onended = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeakingChange?.(false);
          currentAudioRef.current = null;
          currentJaw.current = 0.01;
          URL.revokeObjectURL(blobUrl);
        };

        audio.onerror = () => {
          console.error('[AvatarLuis] Audio playback error');
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeakingChange?.(false);
          currentAudioRef.current = null;
          currentJaw.current = 0.01;
          URL.revokeObjectURL(blobUrl);
        };

        audio.play().catch((err) => {
          console.error('[AvatarLuis] Audio play() failed:', err);
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeakingChange?.(false);
          currentAudioRef.current = null;
          currentJaw.current = 0.01;
          URL.revokeObjectURL(blobUrl);
        });
      } catch (err) {
        // Fallback: use text-based jaw profile if audio analysis fails
        console.warn('[AvatarLuis] Waveform analysis failed, using text-based profile:', err);
        jawProfileRef.current = generateJawProfile(text);
        {
          const p = jawProfileRef.current;
          const vals = p.values;
          const mn = vals.length > 0 ? Math.min(...vals) : 0;
          const mx = vals.length > 0 ? Math.max(...vals) : 0;
          console.log(`[DEBUG] profile generated (fallback): ${p.timings.length} entries, values range: ${mn.toFixed(4)}-${mx.toFixed(4)}`);
        }
        isEnergyProfileRef.current = false;
        speechDuration.current = Math.max((text.length / 15) * 1000, 500);
        console.log(`[DEBUG] speechDuration=${speechDuration.current} ms (fallback)`);
        speechStartTime.current = performance.now();
        currentJaw.current = 0.01;
        isSpeakingRef.current = true;
        console.log(`[DEBUG] isSpeaking=true (fallback path)`);
        setIsSpeaking(true);
        onSpeakingChange?.(true);
        // Play audio from URL directly as fallback
        const audio = new Audio();
        audio.src = audioUrl;
        currentAudioRef.current = audio;
        audio.onended = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeakingChange?.(false);
          currentAudioRef.current = null;
          currentJaw.current = 0.01;
        };
        audio.onerror = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeakingChange?.(false);
          currentAudioRef.current = null;
          currentJaw.current = 0.01;
        };
        audio.play().catch(() => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onSpeakingChange?.(false);
          currentAudioRef.current = null;
          currentJaw.current = 0.01;
        });
      }
    })();
  }, [text, onSpeakingChange]);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    onSpeakingChange?.(false);
    currentJaw.current = 0.01;
  }, [onSpeakingChange]);

  // Auto-speak
  useEffect(() => {
    if (!text || !autoSpeak || loadStatus !== 'ready') return;
    if (text === lastTextRef.current) return;
    lastTextRef.current = text;
    const t = setTimeout(() => speak(), 300);
    return () => clearTimeout(t);
  }, [text, autoSpeak, speak, loadStatus]);

  // Reset lastTextRef when text is cleared (chat closed)
  useEffect(() => {
    if (!text) lastTextRef.current = '';
  }, [text]);

  // === Three.js scene setup ===
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera — wider view
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0xfff0e0, 2.0));

    const keyLight = new THREE.DirectionalLight(0xffeedd, 3.0);
    keyLight.position.set(0.8, 1.5, 2.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffddbb, 1.5);
    fillLight.position.set(-1.0, 0.5, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffdd, 1.0);
    rimLight.position.set(0, 1.5, -2.0);
    scene.add(rimLight);

    scene.add(new THREE.HemisphereLight(0xffeedd, 0x553322, 1.0));

    // Resize handler
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const cw = container.clientWidth || 400;
      const ch = container.clientHeight || 500;
      cameraRef.current.aspect = cw / ch;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(cw, ch);
    };
    window.addEventListener('resize', handleResize);

    // === LOAD FBX ===
    const loader = new FBXLoader();
    loader.load(
      '/model.fbx',
      (fbx) => {
        console.log('[AvatarLuis] FBX loaded successfully');

        fbx.updateMatrixWorld(true);

        // Log ALL mesh names found in FBX
        const meshNames: string[] = [];
        fbx.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            meshNames.push(child.name);
            const m = child as THREE.Mesh;
            console.log(`[AvatarLuis] Mesh: "${child.name}" type=${child.type} morphTargets=${m.morphTargetDictionary ? Object.keys(m.morphTargetDictionary).length : 0} skinned=${child instanceof THREE.SkinnedMesh}`);
          }
        });
        console.log(`[AvatarLuis] Total meshes: ${meshNames.length}`);

        // Compute bounding box and scale
        const bbox = new THREE.Box3().setFromObject(fbx);
        const size = bbox.getSize(new THREE.Vector3());
        console.log(`[AvatarLuis] Model size: ${size.x.toFixed(4)} x ${size.y.toFixed(4)} x ${size.z.toFixed(4)}`);

        // If size is too small, blow it up—some FBX export at mm scale
        const targetHeight = 1.8; // target height in Three.js units
        const rawScale = size.y > 0.0001 ? targetHeight / size.y : 1;
        console.log(`[AvatarLuis] Raw scale factor: ${rawScale.toFixed(4)}`);

        // Center the model at origin, then position in front of camera
        fbx.position.set(0, 0, 0);
        fbx.scale.set(rawScale, rawScale, rawScale);
        fbx.rotation.set(0, 0, 0);
        fbx.updateMatrixWorld(true);

        // After scaling, compute new bbox
        const bbox2 = new THREE.Box3().setFromObject(fbx);
        const center2 = bbox2.getCenter(new THREE.Vector3());
        const size2 = bbox2.getSize(new THREE.Vector3());
        console.log(`[AvatarLuis] After scale — center: ${center2.x.toFixed(4)}, ${center2.y.toFixed(4)}, ${center2.z.toFixed(4)} size: ${size2.x.toFixed(4)}, ${size2.y.toFixed(4)}, ${size2.z.toFixed(4)}`);

        // Reposition so model is centered at origin
        fbx.position.set(-center2.x, -center2.y, -center2.z);
        fbx.updateMatrixWorld(true);
        fbxBaseY.current = fbx.position.y;
        console.log(`[AvatarLuis] Final position: ${fbx.position.x.toFixed(4)}, ${fbx.position.y.toFixed(4)}, ${fbx.position.z.toFixed(4)}`);

        // Collect morph target info
        fbx.traverse((child: THREE.Object3D) => {
          if (!(child as THREE.Mesh).isMesh) return;
          if (!(child instanceof THREE.SkinnedMesh)) return;
          const mesh = child as THREE.Mesh;
          if (!mesh.morphTargetDictionary) return;

          const sm = child as THREE.SkinnedMesh;
          morphMeshes.current.push(sm);

          for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
            const i = idx as number;
            const nl = name.toLowerCase();
            console.log(`[AvatarLuis] Morph "${name}" idx=${i}`);
            if (nl.includes('jawopen') || nl.includes('jaw_open') || nl === 'jaw') {
              jawOpenIndices.current.push(i);
            }
            if (nl.includes('eyeblinkleft') || nl.includes('eye_blink_left')) {
              blinkLeftIndices.current.push(i);
            }
            if (nl.includes('eyeblinkright') || nl.includes('eye_blink_right')) {
              blinkRightIndices.current.push(i);
            }
          }
        });

        console.log(`[AvatarLuis] Morphs: jaw=${jawOpenIndices.current.length}, blinkL=${blinkLeftIndices.current.length}, blinkR=${blinkRightIndices.current.length}, meshes=${morphMeshes.current.length}`);

        // Initialize morph influences
        morphMeshes.current.forEach((sm) => {
          const dict = sm.morphTargetDictionary;
          if (!dict) return;
          const n = Object.keys(dict).length;
          if (!sm.morphTargetInfluences || sm.morphTargetInfluences.length !== n) {
            sm.morphTargetInfluences = new Array(n).fill(0);
          }
        });

        // Add to scene
        scene.add(fbx);
        fbxRef.current = fbx;

        // Fix missing textures: set visible fallback colors on materials
        // that have no texture loaded (FBX references texture files that
        // don't exist on this server — ARARAT_Color_1K.jpg, etc.)
        fbx.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (!mesh.material) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
              // If no color map, set a visible fallback color
              if (!mat.map || !mat.map.image || mat.map.image.width <= 1) {
                // Skin tone for body/head, white for other parts
                const name = mesh.name.toLowerCase();
                if (name.includes('head') || name.includes('face') || name.includes('body')) {
                  mat.color.setHex(0xe8b88a); // warm skin tone
                } else if (name.includes('eye') || name.includes('iris')) {
                  mat.color.setHex(0xf5f5f5); // white sclera
                } else if (name.includes('teeth') || name.includes('tooth') || name.includes('tongue')) {
                  mat.color.setHex(0xf0ebe0); // tooth/off-white
                } else if (name.includes('hair') || name.includes('eyebrow') || name.includes('eyelash')) {
                  mat.color.setHex(0x3a2a1a); // dark brown hair
                } else if (name.includes('cloth') || name.includes('shirt') || name.includes('jacket') || name.includes('suit') || name.includes('tie')) {
                  mat.color.setHex(0x2c2c2c); // dark clothing
                } else if (name.includes('pant') || name.includes('trouser') || name.includes('shoe') || name.includes('boot')) {
                  mat.color.setHex(0x1a1a1a); // dark pants/shoes
                } else {
                  mat.color.setHex(0xcccccc); // generic light grey
                }
                mat.needsUpdate = true;
                console.log(`[AvatarLuis] Fallback color set on "${mesh.name}": #${mat.color.getHexString()}`);
              }
            }
          });
        });

        // Adjust camera to frame the face/head area
        camera.position.set(0, 0.7, 0.8);
        camera.lookAt(0, 0.7, 0);

        // Brief morph test
        if (jawOpenIndices.current.length > 0) {
          morphMeshes.current.forEach((sm) => {
            jawOpenIndices.current.forEach((idx) => {
              if (sm.morphTargetInfluences && idx >= 0 && idx < sm.morphTargetInfluences.length) {
                sm.morphTargetInfluences[idx] = 0.5;
              }
            });
          });
          console.log('[AvatarLuis] Morph test: jawOpen=0.5');
          setTimeout(() => {
            morphMeshes.current.forEach((sm) => {
              jawOpenIndices.current.forEach((idx) => {
                if (sm.morphTargetInfluences && idx >= 0 && idx < sm.morphTargetInfluences.length) {
                  sm.morphTargetInfluences[idx] = 0;
                }
              });
            });
            console.log('[AvatarLuis] Morph test complete');
          }, 2000);
        }

        setLoadStatus('ready');
      },
      (xhr) => {
        if (xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          if (pct % 25 === 0) console.log(`[AvatarLuis] ${pct}% load`);
        }
      },
      (err) => {
        console.error('[AvatarLuis] FBX load error:', err);
        setLoadStatus('error');
      }
    );

    // === Animation loop ===
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      frameCounter.current++;

      // Log every 30 frames to avoid flooding the console
      if (frameCounter.current % 30 === 0 || frameCounter.current === 1) {
        console.log(`[LIPSYNC] frame=${frameCounter.current} isSpeaking=${isSpeakingRef.current} morphMeshes=${morphMeshes.current.length} jawIndices=${jawOpenIndices.current.length} morphReady=${jawOpenIndices.current.length > 0 && morphMeshes.current.length > 0}`);
      }

      // --- BLINK ---
      blinkTimer.current++;
      if (!isBlinking.current && blinkTimer.current > 180 + Math.floor(Math.random() * 240)) {
        isBlinking.current = true;
        blinkProgress.current = 0;
        blinkTimer.current = 0;
      }

      if (isBlinking.current) {
        blinkProgress.current += 0.08;
        const v = blinkProgress.current < 0.5 ? blinkProgress.current * 2 : 2 - blinkProgress.current * 2;
        const smooth = clamp(v, 0, 1);

        morphMeshes.current.forEach((sm) => {
          const inf = sm.morphTargetInfluences;
          if (!inf) return;
          blinkLeftIndices.current.forEach((idx) => { if (idx >= 0 && idx < inf.length) inf[idx] = smooth; });
          blinkRightIndices.current.forEach((idx) => { if (idx >= 0 && idx < inf.length) inf[idx] = smooth; });
        });

        if (blinkProgress.current >= 1) {
          isBlinking.current = false;
          morphMeshes.current.forEach((sm) => {
            const inf = sm.morphTargetInfluences;
            if (!inf) return;
            blinkLeftIndices.current.forEach((idx) => { if (idx >= 0 && idx < inf.length) inf[idx] = 0; });
            blinkRightIndices.current.forEach((idx) => { if (idx >= 0 && idx < inf.length) inf[idx] = 0; });
          });
        }
      }

      // --- LIP SYNC ---
      if (isSpeakingRef.current) {
        const elapsed = now - speechStartTime.current;
        const duration = speechDuration.current;
        const progress = duration > 0 ? elapsed / duration : 0;
        const clampedProgress = clamp(progress, 0, 1);

        // Frame-by-frame detailed logging (every 10 frames when speaking)
        if (frameCounter.current % 10 === 0 || frameCounter.current <= 20) {
          console.log(`[LIPSYNC-RAW] frame=${frameCounter.current} elapsed=${elapsed.toFixed(0)}ms duration=${duration.toFixed(0)}ms progress=${clampedProgress.toFixed(4)} speechStartTime=${speechStartTime.current.toFixed(0)} refCheck={isSpeaking:${isSpeakingRef.current}, currentJaw:${currentJaw.current.toFixed(4)}, jawEverMoved:${jawEverMoved.current}}`);
        }

        // WARNING if progress is 0 even though isSpeaking is true
        if (clampedProgress === 0 && frameCounter.current % 10 === 0) {
          console.warn(`[LIPSYNC-WARN] progress=0 despite isSpeaking=true! elapsed=${elapsed.toFixed(0)}ms duration=${duration.toFixed(0)}ms. Check if speechStartTime or speechDuration are set correctly.`);
        }

        // --- FORCE-OPEN FALLBACK ---
        // If after 1 second of speaking the jaw hasn't moved above 0.05, force it open
        if (elapsed > 1000 && !jawEverMoved.current && !forceOpenActive.current && currentJaw.current < 0.05) {
          console.warn(`[LIPSYNC-FORCE] Jaw hasn't moved in 1s (currentJaw=${currentJaw.current.toFixed(4)}), FORCE OPENING to 0.2`);
          forceOpenActive.current = true;
          forceOpenTimer.current = 0;
        }
        if (forceOpenActive.current) {
          forceOpenTimer.current += 16; // ~1 frame at 60fps
          if (forceOpenTimer.current < 100) {
            // Ramp up
            const forceVal = 0.01 + (forceOpenTimer.current / 100) * 0.19; // 0.01 -> 0.2
            currentJaw.current = clamp(forceVal, 0.01, 0.2);
            console.log(`[LIPSYNC-FORCE] ramp up: forceOpenTimer=${forceOpenTimer.current}ms currentJaw=${currentJaw.current.toFixed(4)}`);
          } else if (forceOpenTimer.current < 300) {
            // Hold at 0.2 then back to 0.01
            const holdProgress = (forceOpenTimer.current - 100) / 200; // 0->1 over 200ms
            const forceVal = 0.2 - holdProgress * 0.19; // 0.2 -> 0.01
            currentJaw.current = clamp(forceVal, 0.01, 0.2);
            console.log(`[LIPSYNC-FORCE] ramp down: forceOpenTimer=${forceOpenTimer.current}ms currentJaw=${currentJaw.current.toFixed(4)}`);
          } else {
            // Force-open sequence done
            forceOpenActive.current = false;
            currentJaw.current = 0.01;
            jawEverMoved.current = true;
            console.log(`[LIPSYNC-FORCE] sequence complete, jaw reset to 0.01`);
          }
          // Apply forced jaw value
          morphMeshes.current.forEach((sm) => {
            const inf = sm.morphTargetInfluences;
            if (!inf) return;
            jawOpenIndices.current.forEach((idx) => {
              if (idx >= 0 && idx < inf.length) {
                const oldVal = inf[idx];
                inf[idx] = currentJaw.current;
                if (oldVal !== currentJaw.current && (frameCounter.current % 5 === 0)) {
                  console.log(`[LIPSYNC-APPLY] FORCE mesh=${sm.name} jawIdx=${idx} old=${oldVal.toFixed(4)} new=${currentJaw.current.toFixed(4)}`);
                }
              }
            });
          });
          renderer.render(scene, camera);
          return; // Skip all other processing this frame
        }

        if (isEnergyProfileRef.current) {
          // ENERGY-based path (full waveform)
          const profile = jawProfileRef.current;
          let targetJaw = 0.06;
          if (profile.timings.length > 0 && profile.values.length > 0) {
            let lo = 0;
            let hi = profile.timings.length - 1;
            while (lo < hi) {
              const mid = (lo + hi) >>> 1;
              if (profile.timings[mid] <= clampedProgress) {
                lo = mid + 1;
              } else {
                hi = mid;
              }
            }
            const idx = Math.min(lo, profile.timings.length - 1);
            const windowStart = Math.max(0, idx - 2);
            const windowEnd = Math.min(profile.values.length - 1, idx + 2);
            let avg = 0;
            let count = 0;
            for (let wi = windowStart; wi <= windowEnd; wi++) {
              const dist = Math.abs(wi - idx);
              const w = dist <= 1 ? 1.0 : 0.5;
              avg += profile.values[wi] * w;
              count += w;
            }
            const energy = count > 0 ? avg / count : profile.values[idx];
            // Power curve: compress low energy, emphasize medium-high
            const poweredEnergy = Math.pow(energy, 0.5);
            targetJaw = 0.04 + poweredEnergy * 0.26;
          }
          // Smooth interpolation
          const lerpFactor = 0.12;
          console.log(`[DEBUG] energy-path targetJaw=${targetJaw.toFixed(4)}, currentJaw=${currentJaw.current.toFixed(4)}`);
          if (Math.abs(targetJaw - currentJaw.current) > 0.02) {
            currentJaw.current += (targetJaw - currentJaw.current) * lerpFactor;
          }
        } else {
          // TEXT-based path (phoneme profile + energy micro-variations)
          const profile = jawProfileRef.current;
          let targetJaw = 0.01;
          if (profile.timings.length > 0 && profile.values.length > 0) {
            let lo = 0;
            let hi = profile.timings.length - 1;
            while (lo < hi) {
              const mid = (lo + hi) >>> 1;
              if (profile.timings[mid] <= clampedProgress) {
                lo = mid + 1;
              } else {
                hi = mid;
              }
            }
            const idx = Math.min(lo, profile.timings.length - 1);
            // Use DIRECT profile value — no moving window (it dilutes vowels with surrounding consonants)
            targetJaw = profile.values[idx];

            // Values are in 0.01-0.40 direct morph target range (no SCALE or window needed)

            // Add energy-based micro-variations (+-0.02) for natural feel
            if (energyEnvelopeRef.current.values.length > 0) {
              const eLen = energyEnvelopeRef.current.values.length;
              const eIdx = Math.min(
                Math.floor(clampedProgress * eLen),
                eLen - 1
              );
              const energy = energyEnvelopeRef.current.values[eIdx] || 0;
              const microDelta = (energy - 0.5) * 0.04;
              targetJaw += microDelta;
            }
          }
          // Smooth interpolation — always lerp, no dead zone for natural movement
          const lerpFactor = 0.15;
          if (frameCounter.current % 10 === 0) {
            console.log(`[LIPSYNC-TEXT] targetJaw=${targetJaw.toFixed(4)} currentJaw=${currentJaw.current.toFixed(4)} diff=${Math.abs(targetJaw - currentJaw.current).toFixed(4)} lerpFactor=${lerpFactor}`);
          }
          currentJaw.current += (targetJaw - currentJaw.current) * lerpFactor;
        }

        // Track if jaw has ever moved via normal path
        if (currentJaw.current > 0.05) {
          jawEverMoved.current = true;
        }

        // Clamp and apply
        currentJaw.current = clamp(currentJaw.current, 0.01, 0.5);
        morphMeshes.current.forEach((sm) => {
          const inf = sm.morphTargetInfluences;
          if (!inf) return;
          jawOpenIndices.current.forEach((idx) => {
            if (idx >= 0 && idx < inf.length) {
              const oldVal = inf[idx];
              inf[idx] = currentJaw.current;
              // Debug: log first time a specific mesh gets a non-zero value
              if (frameCounter.current <= 20 && oldVal === 0 && currentJaw.current > 0.01) {
                console.log(`[LIPSYNC-FIRST] mesh=${sm.name} jawIdx=${idx} val=${currentJaw.current.toFixed(4)}`);
              }
            }
          });
        });
      } else {
        // Not speaking — close mouth gradually
        if (currentJaw.current > 0.02) {
          if (frameCounter.current % 30 === 0) {
            console.log(`[LIPSYNC-NOT] closing mouth, currentJaw=${currentJaw.current.toFixed(4)}`);
          }
          currentJaw.current += (0.01 - currentJaw.current) * 0.08;
          morphMeshes.current.forEach((sm) => {
            const inf = sm.morphTargetInfluences;
            if (!inf) return;
            jawOpenIndices.current.forEach((idx) => {
              if (idx >= 0 && idx < inf.length) inf[idx] = currentJaw.current;
            });
          });
        } else {
          idleTime.current += 0.02;
          const micro = Math.sin(idleTime.current) * 0.003;
          morphMeshes.current.forEach((sm) => {
            const inf = sm.morphTargetInfluences;
            if (!inf) return;
            jawOpenIndices.current.forEach((idx) => {
              if (idx >= 0 && idx < inf.length && inf[idx] < 0.01) inf[idx] = 0.01 + micro;
            });
          });
        }
      }

      // Idle breathing
      if (fbxRef.current) {
        idleTime.current += 0.008;
        fbxRef.current.position.y = fbxBaseY.current + Math.sin(idleTime.current * 1.5) * 0.001;
        fbxRef.current.rotation.y = Math.sin(idleTime.current * 0.3) * 0.005;
      }

      renderer.render(scene, camera);
    }
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-2xl bg-[#2a1a0e]">
      {loadStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#2a1a0e]">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin" />
            <span className="text-white/80 text-xs font-light tracking-wider">
              A preparar o Luis...
            </span>
          </div>
        </div>
      )}

      {loadStatus !== 'loading' && (
        <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-[10px]">
            {loadStatus === 'ready' ? 'Luis' : 'Erro'}
            {isSpeaking && <span className="ml-1.5 text-[#C8A96E]">A falar...</span>}
          </span>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => {
            if (isSpeakingRef.current) stop();
            else speak();
          }}
          className="px-4 py-2 text-xs font-semibold rounded-full bg-white/10 text-white hover:bg-white/20 transition shadow-lg backdrop-blur-sm"
        >
          {isSpeaking ? 'Parar' : 'Falar'}
        </button>
      </div>
    </div>
  );
}
