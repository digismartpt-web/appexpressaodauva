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

function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

// ===== Fix FBX materials: ensure visibility and proper rendering =====
function fixFBXMaterials(object: THREE.Group): void {
  let meshCount = 0;
  object.traverse((child: THREE.Object3D): void => {
    if (!(child as THREE.Mesh).isMesh) return;
    meshCount++;
    const mesh = child as THREE.Mesh;
    const isSkinned = child.type === 'SkinnedMesh' || child instanceof THREE.SkinnedMesh;
    const hasMorphs = !!(mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0);

    mesh.visible = true;
    mesh.frustumCulled = false;

    console.log(`[AvatarLuis] Mesh "${mesh.name}" skinned=${isSkinned} morphs=${hasMorphs}`);

    const mats: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const newMats: THREE.Material[] = mats.map((mat: THREE.Material, idx: number) => {
      const isStandard = mat.type === 'MeshStandardMaterial';
      const isPhong = mat.type === 'MeshPhongMaterial';
      const isLambert = mat.type === 'MeshLambertMaterial';
      const isBasic = mat.type === 'MeshBasicMaterial';

      if (isStandard || isPhong || isLambert) {
        const m = mat as THREE.MeshStandardMaterial;

        // Ensure color is not pure black (invisible)
        if (m.color) {
          const brightness = m.color.r + m.color.g + m.color.b;
          if (brightness < 0.1) {
            console.log(`[AvatarLuis] Material ${idx} on "${mesh.name}" too dark, brightening`);
            m.color.setRGB(
              Math.max(m.color.r, 0.15),
              Math.max(m.color.g, 0.12),
              Math.max(m.color.b, 0.1)
            );
          }
        }

        // Disable AO maps that can cause dark patches
        if ((m as any).aoMap) (m as any).aoMap = null;
        if ((m as any).lightMap) (m as any).lightMapIntensity = 0;

        m.side = THREE.DoubleSide;
        m.depthWrite = true;
        m.depthTest = true;
        m.needsUpdate = true;

        if (isSkinned) (m as any).skinning = true;
        if (hasMorphs) {
          m.morphTargets = true;
          m.morphNormals = true;
        }

        return m;
      }

      if (isBasic) {
        // Convert MeshBasicMaterial to MeshStandardMaterial for lighting
        const basic = mat as THREE.MeshBasicMaterial;
        const replacement = new THREE.MeshStandardMaterial({
          color: basic.color || 0xddbb88,
          map: basic.map,
          roughness: 0.7,
          metalness: 0.0,
          side: THREE.DoubleSide,
        });
        if (isSkinned) (replacement as any).skinning = true;
        if (hasMorphs) {
          replacement.morphTargets = true;
          replacement.morphNormals = true;
        }
        return replacement;
      }

      // Fallback: create visible material
      console.log(`[AvatarLuis] Unknown material type "${mat.type}" on "${mesh.name}", replacing`);
      const replacement = new THREE.MeshStandardMaterial({
        color: 0xddbb88,
        roughness: 0.7,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      if (isSkinned) (replacement as any).skinning = true;
      if (hasMorphs) {
        replacement.morphTargets = true;
        replacement.morphNormals = true;
      }
      return replacement;
    });

    mesh.material = mats.length > 1 ? newMats : newMats[0];
  });
  console.log(`[AvatarLuis] Fixed materials on ${meshCount} meshes`);
}

// ===== Detect morph targets by exact name =====
interface MorphData {
  meshes: THREE.SkinnedMesh[];
  jawOpenIndices: number[];
  blinkLeftIndices: number[];
  blinkRightIndices: number[];
}

function findMorphTargets(object: THREE.Group): MorphData {
  const result: MorphData = {
    meshes: [],
    jawOpenIndices: [],
    blinkLeftIndices: [],
    blinkRightIndices: [],
  };

  object.traverse((child: THREE.Object3D): void => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.morphTargetDictionary) return;

    result.meshes.push(mesh as THREE.SkinnedMesh);
    const dict: Record<string, number> = mesh.morphTargetDictionary;

    for (const [name, index] of Object.entries(dict)) {
      const idx = index as number;
      if (name === 'jawOpen' || name === 'jaw_open' || name === 'JawOpen') {
        result.jawOpenIndices.push(idx);
        console.log(`[AvatarLuis] jawOpen on "${mesh.name}" idx ${idx}`);
      }
      if (name === 'eyeBlinkLeft' || name === 'eye_blink_left' || name === 'EyeBlinkLeft') {
        result.blinkLeftIndices.push(idx);
        console.log(`[AvatarLuis] eyeBlinkLeft on "${mesh.name}" idx ${idx}`);
      }
      if (name === 'eyeBlinkRight' || name === 'eye_blink_right' || name === 'EyeBlinkRight') {
        result.blinkRightIndices.push(idx);
        console.log(`[AvatarLuis] eyeBlinkRight on "${mesh.name}" idx ${idx}`);
      }
    }
  });

  return result;
}

// ===== Web Audio API: Real-time audio energy detection =====
interface AudioEnergyState {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  mediaStream: MediaStream | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  isCapturing: boolean;
  energy: number;
  smoothEnergy: number;
  captureAttempted: boolean;
}

function createAudioEnergyDetector(): AudioEnergyState {
  return {
    context: null,
    analyser: null,
    mediaStream: null,
    sourceNode: null,
    isCapturing: false,
    energy: 0,
    smoothEnergy: 0,
    captureAttempted: false,
  };
}

async function initAudioCapture(state: AudioEnergyState): Promise<void> {
  if (state.captureAttempted) return;
  state.captureAttempted = true;

  try {
    // Try to create AudioContext
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      console.log('[AvatarLuis] AudioContext not available');
      return;
    }

    const ctx = new AudioCtx();
    state.context = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    state.analyser = analyser;

    // Attempt to capture tab audio (which includes SpeechSynthesis output)
    // Using getDisplayMedia with audio:true captures the tab's audio output
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: false,
        audio: true,
      });

      state.mediaStream = stream;
      const source = ctx.createMediaStreamSource(stream);
      state.sourceNode = source;
      source.connect(analyser);
      // Don't connect to destination to avoid feedback
      state.isCapturing = true;
      console.log('[AvatarLuis] Audio capture started via getDisplayMedia');
    } catch (displayErr) {
      // getDisplayMedia failed or was denied — will fall back to text-based lip sync
      console.log('[AvatarLuis] getDisplayMedia not available/denied, using text-based lip sync');
      // Still create a working AudioContext for future use
      // Connect a silent oscillator to the analyser so it has data
      try {
        const osc = ctx.createOscillator();
        osc.frequency.value = 200;
        const gain = ctx.createGain();
        gain.gain.value = 0; // silent
        osc.connect(gain);
        gain.connect(analyser);
        osc.start();
        // Periodic small noise bursts to give the analyser something to read
        setInterval(() => {
          if (!state.isCapturing) {
            gain.gain.value = 0;
          }
        }, 100);
      } catch {
        // Ignore
      }
    }
  } catch (err) {
    console.log('[AvatarLuis] AudioContext init error:', err);
  }
}

function readAudioEnergy(state: AudioEnergyState): number {
  if (!state.analyser || !state.isCapturing) return 0;

  const dataArray = new Uint8Array(state.analyser.frequencyBinCount);
  state.analyser.getByteFrequencyData(dataArray);

  // Calculate RMS energy from frequency data
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(sum / dataArray.length);

  // Normalize to 0-1 range (byte data is 0-255)
  state.energy = clamp(rms / 128, 0, 1);

  return state.energy;
}

function stopAudioCapture(state: AudioEnergyState): void {
  if (state.sourceNode) {
    try { state.sourceNode.disconnect(); } catch {}
    state.sourceNode = null;
  }
  if (state.mediaStream) {
    try {
      state.mediaStream.getTracks().forEach(t => t.stop());
    } catch {}
    state.mediaStream = null;
  }
  if (state.context) {
    try { state.context.close(); } catch {}
    state.context = null;
  }
  state.analyser = null;
  state.isCapturing = false;
  state.energy = 0;
  state.smoothEnergy = 0;
}

// ===== Syllable-aware lip-sync for Portuguese =====
interface PhonemeProfile {
  timings: number[];   // normalized times [0..1]
  values: number[];    // jawOpen values at each timing
}

// Portuguese vowel openness mapping for natural mouth shapes
// Accepts optional nextChar for diphthong/consonant-cluster detection
function vowelOpenness(ch: string, nextCh?: string): number {
  // Portuguese nasal diphthongs — mouth very wide open
  if (nextCh) {
    const pair = ch.toLowerCase() + nextCh.toLowerCase();
    if (pair === 'ao' || pair === 'õe' || pair === 'ae') return 0.55;
    if (pair === 'lh') return 0.15;
    if (pair === 'nh') return 0.15;
    if (pair === 'rr') return 0.25;
    if (pair === 'ch') return 0.25;
    if (pair === 'ç') return 0.25;
  }

  // Nasal vowels — mouth open + nasal resonance
  if (/[ãõ]/.test(ch)) return 0.50;

  // Open vowels — mouth wide
  if (/[aàáâäæ]/.test(ch)) return 0.45;

  // Mid-open vowels — mouth half-open
  if (/[eèéêëɛœ]/.test(ch)) return 0.35;
  if (/[oòóôöɔ]/.test(ch)) return 0.30;

  // Closed vowels — mouth slightly open
  if (/[iìíîï]/.test(ch)) return 0.30;
  if (/[uùúûü]/.test(ch)) return 0.20;

  // Consonants with specific mouth shapes
  if (/[pbm]/.test(ch)) return 0.15;  // Labial — mouth closes
  if (/[fv]/.test(ch)) return 0.22;   // Labiodental fricative
  if (/[szçjx]/.test(ch)) return 0.25; // Sibilant/fricative
  if (/[tdnlgkrh]/.test(ch)) return 0.12; // Other consonants
  if (/[wy]/.test(ch)) return 0.18;   // Semi-vowels

  return -1; // not a phoneme
}

// Count vowel groups (syllables) in Portuguese text for syllable-timed rhythm
function countPortugueseSyllables(text: string): number {
  let count = 0;
  let inVowelGroup = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = i + 1 < text.length ? text[i + 1] : undefined;
    const isVowel = vowelOpenness(ch, nextCh) >= 0;
    if (isVowel && !inVowelGroup) {
      count++;
      inVowelGroup = true;
    } else if (!isVowel) {
      inVowelGroup = false;
    }
  }
  return Math.max(count, 1);
}

function generatePhonemeProfile(text: string): PhonemeProfile {
  const chars = text.split('');
  const total = chars.length;
  if (total === 0) return { timings: [0, 1], values: [0.02, 0.02] };

  // Build effective character list, merging diphthong pairs into single units
  // so timing reflects Portuguese syllable-timed rhythm
  const effective: { ch: string; nextCh?: string; time: number }[] = [];
  for (let i = 0; i < total; i++) {
    const ch = chars[i];
    const nextCh = i + 1 < total ? chars[i + 1] : undefined;
    // If current char starts a diphthong pair detected by vowelOpenness,
    // consume both chars as one effective unit and skip the next iteration
    const pairVal = nextCh !== undefined ? vowelOpenness(ch, nextCh) : -1;
    const isDiphthong = pairVal >= 0.8 && nextCh !== undefined && vowelOpenness(nextCh) >= 0;
    if (isDiphthong) {
      effective.push({ ch, nextCh, time: effective.length });
      i++; // skip second char of diphthong
    } else {
      effective.push({ ch, nextCh: undefined, time: effective.length });
    }
  }

  const effectiveCount = effective.length;
  if (effectiveCount === 0) return { timings: [0, 1], values: [0.02, 0.02] };

  const events: { time: number; value: number; sustain: number }[] = [];

  for (let i = 0; i < effectiveCount; i++) {
    const { ch, nextCh } = effective[i];
    const v = nextCh !== undefined ? vowelOpenness(ch, nextCh) : vowelOpenness(ch);
    const baseTime = i / effectiveCount; // [0..1]

    // Look ahead for coarticulation
    const nextIdx = i + 1;
    const nextV = nextIdx < effectiveCount
      ? (effective[nextIdx].nextCh !== undefined
          ? vowelOpenness(effective[nextIdx].ch, effective[nextIdx].nextCh)
          : vowelOpenness(effective[nextIdx].ch))
      : -1;

    if (v >= 0) {
      // Vowel — mouth opens; slight overshoot then settle
      events.push({ time: baseTime, value: v, sustain: 0.1 });
      events.push({ time: baseTime + 0.015, value: Math.min(v + 0.06, 1.0), sustain: 0.05 });
    } else if (ch.match(/[pbtk]/)) {
      // Unvoiced plosive — quick burst then close
      events.push({ time: baseTime, value: 0.30, sustain: 0.02 });
      events.push({ time: baseTime + 0.008, value: 0.08, sustain: 0.04 });
    } else if (ch.match(/[dgqc]/)) {
      // Voiced plosive
      events.push({ time: baseTime, value: 0.25, sustain: 0.02 });
      events.push({ time: baseTime + 0.008, value: 0.08, sustain: 0.04 });
    } else if (ch.match(/[fv]/)) {
      // Labiodental fricative
      events.push({ time: baseTime, value: 0.20, sustain: 0.06 });
    } else if (ch.match(/[szçjx]/)) {
      // Sibilant fricative
      events.push({ time: baseTime, value: 0.25, sustain: 0.06 });
    } else if (ch.match(/[mn]/)) {
      // Nasal consonant
      events.push({ time: baseTime, value: 0.10, sustain: 0.05 });
    } else if (ch.match(/[lr]/)) {
      // Liquid consonant
      events.push({ time: baseTime, value: 0.12, sustain: 0.05 });
    } else if (ch.match(/\s/)) {
      // Space — close mouth quickly
      events.push({ time: baseTime, value: 0.02, sustain: 0.02 });
    }
    // Other characters (punctuation, etc.) — no event, mouth continues previous shape

    // COARTICULATION: if current char is a consonant and next is a vowel,
    // anticipate the vowel by starting to open slightly before we get there
    if (v < 0 && nextV >= 0) {
      const anticipateTime = baseTime + (1 / effectiveCount) * 0.55;
      events.push({ time: anticipateTime, value: 0.18, sustain: 0.03 });
    }
  }

  // Ensure start with mouth slightly open, end closed
  events.unshift({ time: 0, value: 0.05, sustain: 0 });
  events.push({ time: 1, value: 0.01, sustain: 0 });

  // Sort by time
  events.sort((a, b) => a.time - b.time);

  const timings: number[] = [];
  const values: number[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    timings.push(e.time);
    values.push(e.value);

    // Add sustain tail — hold the mouth shape briefly
    if (e.sustain > 0 && i < events.length - 1) {
      const nextTime = events[i + 1].time;
      const holdTime = Math.min(e.time + e.sustain, nextTime);
      if (holdTime > e.time + 0.005) {
        timings.push(holdTime);
        values.push(e.value);
      }
    }
  }

  return { timings, values };
}

// ===== Speech boundary based timing =====
const BOUNDARY_SPEECH_MAP = new Map<string, number>();

export default function AvatarLuis({
  text,
  lang = 'pt-PT',
  autoSpeak = false,
  onSpeakingChange,
}: TalkingHeadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fbxRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef(0);

  // Morph targets
  const morphData = useRef<MorphData>({
    meshes: [], jawOpenIndices: [],
    blinkLeftIndices: [], blinkRightIndices: [],
  });

  // Speech state
  const isSpeakingRef = useRef(false);
  const speechIntensity = useRef(0);
  const speechStartTime = useRef(0);
  const speechDuration = useRef(0);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Boundary event tracking for real-time lip-sync
  const lastBoundaryTime = useRef(0);

  // Per-frame jaw tracking with physics
  const currentJaw = useRef(0);
  const currentMouth = useRef(0);
  const jawVelocity = useRef(0);

  // Web Audio energy detection
  const audioEnergy = useRef<AudioEnergyState>(createAudioEnergyDetector());

  // Phoneme profile fallback
  const phonemeProfile = useRef<PhonemeProfile>({ timings: [], values: [] });

  // Blink
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const blinkProgress = useRef(0);

  // Idle
  const idleTime = useRef(0);
  const fbxBaseY = useRef(0);
  const jawIdlePhase = useRef(0);
  const lastTextRef = useRef('');

  // Pre-load speech voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handler = () => {};
    window.speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
  }, []);

  const speak = useCallback(() => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.05;

    // Estimate speech duration based on text length and rate
    const charCount = text.length;
    const estimatedSeconds = (charCount / 15) / u.rate;
    speechDuration.current = Math.max(estimatedSeconds * 1000, 500);

    // Generate phoneme profile from text analysis as fallback
    phonemeProfile.current = generatePhonemeProfile(text);

    // Try to init Web Audio capture for real-time energy detection
    initAudioCapture(audioEnergy.current);

    // Track boundary events for timing
    BOUNDARY_SPEECH_MAP.clear();
    let boundaryCount = 0;

    u.onboundary = (_e) => {
      boundaryCount++;
      // Each boundary event means a sound is being produced
      // We store the timing for smoother animation
      const elapsed = performance.now() - speechStartTime.current;
      BOUNDARY_SPEECH_MAP.set(`b${boundaryCount}`, elapsed);
      lastBoundaryTime.current = performance.now();
    };

    u.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      onSpeakingChange?.(true);
      speechStartTime.current = performance.now();
      currentJaw.current = 0.05;
      currentMouth.current = 0.01;
      jawVelocity.current = 0;

      // Try to start audio capture if not already
      if (!audioEnergy.current.captureAttempted) {
        initAudioCapture(audioEnergy.current);
      }
    };

    u.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onSpeakingChange?.(false);
      speechIntensity.current = 0;
      phonemeProfile.current = { timings: [], values: [] };
      BOUNDARY_SPEECH_MAP.clear();
    };

    u.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onSpeakingChange?.(false);
      speechIntensity.current = 0;
      phonemeProfile.current = { timings: [], values: [] };
      BOUNDARY_SPEECH_MAP.clear();
    };

    lastUtteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [text, lang, onSpeakingChange]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    onSpeakingChange?.(false);
    speechIntensity.current = 0;
    phonemeProfile.current = { timings: [], values: [] };
    BOUNDARY_SPEECH_MAP.clear();

    // Stop audio capture
    if (audioEnergy.current.isCapturing) {
      stopAudioCapture(audioEnergy.current);
    }
  }, [onSpeakingChange]);

  // Auto-speak when text changes
  useEffect(() => {
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    if (!text || !autoSpeak || loadStatus !== 'ready') return;

    if (text === lastTextRef.current) return;
    lastTextRef.current = text;

    // Pre-compute phoneme profile for responsive animation
    const charCount = text.length;
    const estimatedSeconds = Math.max((charCount / 15) / 1.05, 0.5);
    speechDuration.current = estimatedSeconds * 1000;
    phonemeProfile.current = generatePhonemeProfile(text);

    // Start speech state immediately for lip-sync responsiveness
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    onSpeakingChange?.(true);
    speechStartTime.current = performance.now();
    currentJaw.current = 0.05;
    currentMouth.current = 0.02;

    // Try to init audio capture
    if (!audioEnergy.current.captureAttempted) {
      initAudioCapture(audioEnergy.current);
    }

    // Delay actual TTS slightly so lips move before sound
    speakTimeoutRef.current = setTimeout(() => { speak(); }, 200);

    return () => {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    };
  }, [text, autoSpeak, speak, loadStatus, onSpeakingChange]);

  // ===== Three.js scene setup (runs once) =====
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1a0e);
    sceneRef.current = scene;

    // Camera — abaissée pour cadrer le visage sans le couper en haut
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.01, 100);
    camera.position.set(0, 0.08, 0.50);
    camera.lookAt(0, 0.05, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls with damping
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.05, 0);
    controls.minDistance = 0.2;
    controls.maxDistance = 8;
    controls.update();
    controlsRef.current = controls;

    // ===== CLEAN, NATURAL LIGHTING — no overrides, no face-specific hacks =====
    // Strong ambient to evenly illuminate the model
    scene.add(new THREE.AmbientLight(0xfff0e0, 1.2));

    // Key light — front-top, warm
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    keyLight.position.set(0.5, 1.5, 2.5);
    scene.add(keyLight);

    // Fill light — side, soft warm
    const fillLight = new THREE.DirectionalLight(0xffddbb, 0.8);
    fillLight.position.set(-0.8, 0.5, 2.0);
    scene.add(fillLight);

    // Rim light — subtle back light
    const rimLight = new THREE.DirectionalLight(0xffffdd, 0.4);
    rimLight.position.set(0, 1.5, -2);
    scene.add(rimLight);

    // Hemisphere — warm earth tones
    scene.add(new THREE.HemisphereLight(0xffeedd, 0x553322, 0.6));

    // ===== No loading indicator — FBX loads directly =====

    // ===== Resize handler =====
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const cw = container.clientWidth || 400;
      const ch = container.clientHeight || 500;
      cameraRef.current.aspect = cw / ch;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(cw, ch);
    };
    window.addEventListener('resize', handleResize);

    // ===== Load FBX model =====
    const loader = new FBXLoader();
    loader.load(
      '/model.fbx',
      (fbx) => {
        console.log('[AvatarLuis] FBX loaded successfully');

        // 1. Compute initial bounding box BEFORE any transforms
        fbx.updateMatrixWorld(true);
        const bboxRaw = new THREE.Box3().setFromObject(fbx);
        const sizeRaw = bboxRaw.getSize(new THREE.Vector3());
        const centerRaw = bboxRaw.getCenter(new THREE.Vector3());
        console.log('[AvatarLuis] Raw model size:', sizeRaw.x.toFixed(2), sizeRaw.y.toFixed(2), sizeRaw.z.toFixed(2));
        console.log('[AvatarLuis] Raw model center:', centerRaw.x.toFixed(2), centerRaw.y.toFixed(2), centerRaw.z.toFixed(2));

        // 2. Calculate scale to fit model in viewport
        // Target: model should be about 0.6 units tall (head+shoulders visible)
        const targetHeight = 0.6;
        const rawHeight = sizeRaw.y;
        let scaleFactor = 1;
        if (rawHeight > 0) {
          scaleFactor = targetHeight / rawHeight;
        }
        console.log('[AvatarLuis] Scale factor:', scaleFactor.toFixed(6), '(raw height:', rawHeight.toFixed(2), ')');

        // 3. Apply scale
        fbx.scale.set(scaleFactor, scaleFactor, scaleFactor);
        fbx.updateMatrixWorld(true);

        // 4. Recompute bounding box after scale
        const bbox = new THREE.Box3().setFromObject(fbx);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        console.log('[AvatarLuis] Scaled size:', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3));

        // 5. Position model so upper body (head/shoulders) is centered
        // Head is at top ~30% of model, we want that in view
        const headCenterY = bbox.max.y - size.y * 0.15;
        fbx.position.set(-center.x, -headCenterY, -center.z);
        fbx.updateMatrixWorld(true);
        fbxBaseY.current = fbx.position.y;
        console.log('[AvatarLuis] Model positioned at:', fbx.position.x.toFixed(3), fbx.position.y.toFixed(3), fbx.position.z.toFixed(3));

        // 6. Fix materials — enable skinning + morph targets
        fixFBXMaterials(fbx);

        // 7. Detect morph targets
        morphData.current = findMorphTargets(fbx);
        console.log('[AvatarLuis] Morph targets:', {
          jawOpen: morphData.current.jawOpenIndices.length,
          blinkLeft: morphData.current.blinkLeftIndices.length,
          blinkRight: morphData.current.blinkRightIndices.length,
          meshes: morphData.current.meshes.length,
        });

        // 8. Ensure model is visible
        fbx.visible = true;

        // 9. Reset camera to face center — regard droit, zoom fonctionnel
        camera.position.set(0, 0.08, 0.50);
        controls.target.set(0, 0.05, 0);
        controls.update();

        // 10. Initialize morph target influences on all meshes
        morphData.current.meshes.forEach(mesh => {
          const dict = mesh.morphTargetDictionary;
          const numTargets = dict ? Object.keys(dict).length : 0;
          if (numTargets > 0) {
            if (!mesh.morphTargetInfluences || mesh.morphTargetInfluences.length !== numTargets) {
              mesh.morphTargetInfluences = new Array(numTargets).fill(0);
            }
            if ((mesh.type === 'SkinnedMesh' || mesh instanceof THREE.SkinnedMesh) && mesh.geometry) {
              if (!(mesh.geometry as any).morphAttributes) {
                (mesh.geometry as any).morphAttributes = {};
              }
            }
          }
        });

        // 11. Test jawOpen morph with value 1.0 for 2 seconds then reset
        if (morphData.current.jawOpenIndices.length > 0) {
          morphData.current.meshes.forEach(mesh => {
            morphData.current.jawOpenIndices.forEach(idx => {
              if (mesh.morphTargetInfluences && idx >= 0 && idx < mesh.morphTargetInfluences.length) {
                mesh.morphTargetInfluences[idx] = 1.0;
              }
            });
          });
          console.log('[AvatarLuis] Testing jawOpen=1.0 for 2s');
          setTimeout(() => {
            morphData.current.meshes.forEach(mesh => {
              morphData.current.jawOpenIndices.forEach(idx => {
                if (mesh.morphTargetInfluences && idx >= 0 && idx < mesh.morphTargetInfluences.length) {
                  mesh.morphTargetInfluences[idx] = 0;
                }
              });
            });
            console.log('[AvatarLuis] jawOpen reset to 0');
          }, 2000);
        }

        // 12. Remove loading indicator
        const loadingIndicator = scene.getObjectByName('__loading_indicator__');
        if (loadingIndicator) {
          scene.remove(loadingIndicator);
          (loadingIndicator as THREE.Mesh).geometry?.dispose();
          ((loadingIndicator as THREE.Mesh).material as THREE.Material)?.dispose();
        }

        // 13. Add to scene
        scene.add(fbx);
        fbxRef.current = fbx;

        setLoadStatus('ready');
        console.log('[AvatarLuis] Model ready');
      },
      (xhr) => {
        if (xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          if (pct > 0 && pct % 25 === 0) console.log(`[AvatarLuis] Loading... ${pct}%`);
        }
      },
      (err: unknown) => {
        console.error('[AvatarLuis] FBX load error:', err);
        // Fallback: add a simple visible mesh to confirm WebGL works
        const fallbackGeo = new THREE.SphereGeometry(0.15, 32, 32);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xddaa77, roughness: 0.6 });
        const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
        fallbackMesh.position.set(0, 0, 0);
        scene.add(fallbackMesh);
        console.log('[AvatarLuis] Fallback sphere added');
        setLoadStatus('error');
      }
    );

    // ===== Animation loop =====
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);

      // --- Eye blink (random interval 3-7 seconds) ---
      blinkTimer.current++;
      if (!isBlinking.current && blinkTimer.current > 180 + Math.floor(Math.random() * 240)) {
        isBlinking.current = true;
        blinkProgress.current = 0;
        blinkTimer.current = 0;
      }

      if (isBlinking.current) {
        blinkProgress.current += 0.08;
        const blinkV = blinkProgress.current < 0.5
          ? blinkProgress.current * 2
          : 2 - blinkProgress.current * 2;
        const smoothBlink = clamp(blinkV, 0, 1);

        morphData.current.meshes.forEach(mesh => {
          const inf = mesh.morphTargetInfluences;
          if (!inf) return;
          morphData.current.blinkLeftIndices.forEach(idx => {
            if (idx >= 0 && idx < inf.length) inf[idx] = smoothBlink;
          });
          morphData.current.blinkRightIndices.forEach(idx => {
            if (idx >= 0 && idx < inf.length) inf[idx] = smoothBlink;
          });
        });

        if (blinkProgress.current >= 1) {
          isBlinking.current = false;
          morphData.current.meshes.forEach(mesh => {
            const inf = mesh.morphTargetInfluences;
            if (!inf) return;
            morphData.current.blinkLeftIndices.forEach(idx => {
              if (idx >= 0 && idx < inf.length) inf[idx] = 0;
            });
            morphData.current.blinkRightIndices.forEach(idx => {
              if (idx >= 0 && idx < inf.length) inf[idx] = 0;
            });
          });
        }
      }

      // ===== LIP-SYNC: boundary-event-driven with physics-based easing =====
      const now = performance.now();
      const speakingActive = isSpeakingRef.current;

      if (speakingActive) {
        // Primary signal: how recently did a boundary event fire?
        const timeSinceBoundary = now - lastBoundaryTime.current;

        // Compute phoneme-based value for vowel/consonant variation
        let phonemeValue = 0.5;
        const elapsed = now - speechStartTime.current;
        const progress = clamp(elapsed / speechDuration.current, 0, 1);
        if (phonemeProfile.current.timings.length > 0) {
          const timings = phonemeProfile.current.timings;
          const values = phonemeProfile.current.values;
          let found = false;
          for (let i = 1; i < timings.length; i++) {
            if (progress >= timings[i - 1] && progress < timings[i]) {
              const t = (progress - timings[i - 1]) / (timings[i] - timings[i - 1] || 0.001);
              phonemeValue = lerp(values[i - 1], values[i], t);
              found = true;
              break;
            }
          }
          if (!found && progress >= timings[timings.length - 1]) {
            phonemeValue = values[values.length - 1];
          } else if (!found) {
            phonemeValue = values[0] || 0.5;
          }
        }

        let targetJaw: number;
        if (timeSinceBoundary < 400) {
          // Boundary event recently — speech sound is happening
          // Freshness: stronger boost right after a boundary, fades over 400ms
          const freshness = 1 - timeSinceBoundary / 400;
          // Combine phoneme pattern with boundary-driven amplitude
          targetJaw = clamp(phonemeValue * (0.3 + 0.7 * freshness), 0.08, 1.0);
        } else {
          // No recent boundary — decay mouth closed (between words/pauses)
          targetJaw = 0.01;
        }

        // Determine if mouth is opening or closing for physics-based easing
        const isOpening = targetJaw > currentJaw.current;

        // Physics-based lerp: fast attack on opening, slow decay on closing
        let lerpFactor: number;
        if (isOpening) {
          // Fast opening (ease-out): snap open quickly
          // Factor increases when target is far from current (wider difference = faster)
          const diff = targetJaw - currentJaw.current;
          lerpFactor = clamp(0.45 + diff * 0.3, 0.40, 0.70);
        } else if (targetJaw < 0.04) {
          // Closing to silence (between words / pause) — faster decay
          lerpFactor = 0.20;
        } else {
          // Gradual closing (ease-in): slow natural decay
          const diff = currentJaw.current - targetJaw;
          lerpFactor = clamp(0.12 + diff * 0.1, 0.10, 0.22);
        }

        // Subtle random noise (±0.02) for natural variation
        const noise = (Math.random() - 0.5) * 0.03;

        // Apply physics lerp with noise
        currentJaw.current = lerp(currentJaw.current, targetJaw + noise, lerpFactor);
        currentJaw.current = clamp(currentJaw.current, 0.01, 0.55);

        // Subtle overshoot for very open vowels (ao, a, nasal diphthongs)
        if (targetJaw > 0.80 && timeSinceBoundary < 120) {
          currentJaw.current = Math.min(currentJaw.current + 0.015, 1.0);
        }

        // Console debug
        if (timeSinceBoundary < 400) {
          console.log('[AvatarLuis] jawOpen:', currentJaw.current.toFixed(3), 'target:', targetJaw.toFixed(3), 'boundary:', Math.round(timeSinceBoundary), 'ms', 'lerp:', lerpFactor.toFixed(2));
        }

        // Apply jawOpen to all meshes
        morphData.current.meshes.forEach(mesh => {
          const inf = mesh.morphTargetInfluences;
          if (!inf) return;
          morphData.current.jawOpenIndices.forEach(idx => {
            if (idx >= 0 && idx < inf.length) inf[idx] = currentJaw.current;
          });
        });
      } else {
        // Not speaking — gently close mouth with natural decay
        if (currentJaw.current > 0.03) {
          currentJaw.current = lerp(currentJaw.current, 0.01, 0.08);

          morphData.current.meshes.forEach(mesh => {
            const inf = mesh.morphTargetInfluences;
            if (!inf) return;
            morphData.current.jawOpenIndices.forEach(idx => {
              if (idx >= 0 && idx < inf.length) inf[idx] = currentJaw.current;
            });
          });
        } else {
          currentJaw.current = 0.01;
        }

        // Subtle idle mouth movement
        jawIdlePhase.current += 0.02;
        const idleMicro = Math.sin(jawIdlePhase.current) * 0.003;
        morphData.current.meshes.forEach(mesh => {
          const inf = mesh.morphTargetInfluences;
          if (!inf) return;
          morphData.current.jawOpenIndices.forEach(idx => {
            if (idx >= 0 && idx < inf.length) {
              if (inf[idx] < 0.01) inf[idx] = 0.01 + idleMicro;
            }
          });
        });
      }

      // --- Idle breathing ---
      idleTime.current += 0.01;
      if (fbxRef.current) {
        fbxRef.current.position.y = fbxBaseY.current + Math.sin(idleTime.current * 1.5) * 0.001;
        fbxRef.current.rotation.y = Math.sin(idleTime.current * 0.3) * 0.008;
      }

      //
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ===== Cleanup =====
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      stopAudioCapture(audioEnergy.current);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: THREE.Material) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-2xl bg-[#2a1a0e]">
      {/* Loading overlay — shows Luis photo immediately + simplified spinner */}
      {loadStatus === 'loading' && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#2a1a0e]"
        >
          {/* Semi-transparent overlay for readability */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Simplified spinner + text on top */}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin" />
            <span className="text-white/80 text-xs font-light tracking-wider">
              A preparar o Luis...
            </span>
          </div>
        </div>
      )}

      {/* Status badge — hidden during loading, shown after */}
      {loadStatus !== 'loading' && (
        <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-[10px]">
            {loadStatus === 'ready' ? 'Pronto' : 'Erro'}
            {isSpeaking && <span className="ml-1.5 text-[#C8A96E]">A falar...</span>}
          </span>
        </div>
      )}

      {/* Speak/Stop button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => {
            if (isSpeakingRef.current) {
              stop();
            } else {
              speak();
            }
          }}
          className="px-4 py-2 text-xs font-semibold rounded-full bg-white/10 text-white hover:bg-white/20 transition shadow-lg backdrop-blur-sm"
        >
          {isSpeaking ? 'Parar' : 'Ouvir Luis'}
        </button>
      </div>
    </div>
  );
}
