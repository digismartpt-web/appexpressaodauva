import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Volume2, VolumeX } from 'lucide-react';
import { CATALOGO } from '../data/wineCatalog';

const AVATAR_URL = '/lui.png';
const GOLD = '#C8A96E';

// ── Animations CSS ──
const CSS = `
@keyframes luisTalk {
  0%   { transform: scale(1)    translateY(0px); }
  100% { transform: scale(1.02) translateY(-1px); }
}
@keyframes mouthOpen {
  0%,100% { transform: translate(-50%, -50%) scaleY(0.12); }
  25%     { transform: translate(-50%, -50%) scaleY(1);    }
  55%     { transform: translate(-50%, -50%) scaleY(0.35); }
  75%     { transform: translate(-50%, -50%) scaleY(0.85); }
}
@keyframes mouthOpenSm {
  0%,100% { transform: translate(-50%, -50%) scaleY(0.1); }
  25%     { transform: translate(-50%, -50%) scaleY(1);   }
  55%     { transform: translate(-50%, -50%) scaleY(0.3); }
  75%     { transform: translate(-50%, -50%) scaleY(0.8); }
}
@keyframes soundBar {
  0%   { transform: scaleY(0.3); }
  100% { transform: scaleY(1);   }
}
@keyframes visemeFade {
  from { opacity: 0.6; }
  to   { opacity: 1;   }
}
@keyframes speakRing {
  0%   { box-shadow: 0 0 0 0px ${GOLD}88; }
  100% { box-shadow: 0 0 0 10px ${GOLD}00; }
}
.luis-talking {
  animation: luisTalk 0.2s ease-in-out infinite alternate;
}
.luis-ring {
  animation: speakRing 0.85s ease-out infinite;
}
`;

const WAIT_MESSAGES = [
  "Boa pergunta! Deixe-me verificar a disponibilidade dos nossos vinhos... 🍷",
  "Um momento! Estou a consultar o nosso catálogo para si... 🔍",
  "Óptima escolha! Vou verificar o que temos disponível agora mesmo... 🍾",
  "Claro! Deixe-me analisar os nossos crus e a disponibilidade actual... 🧐",
  "Com certeza! Estou a verificar o stock disponível, já lhe respondo... ✨",
];

const SUGGESTIONS = [
  { label: 'Jantar de polvo',   q: 'Que vinho para um jantar de polvo?' },
  { label: 'Noite romântica',   q: 'Vinho para uma noite romântica' },
  { label: 'Ideia de presente', q: 'Tem algo diferente para oferecer como presente?' },
  { label: 'Marisco',           q: 'Vinho branco para marisco' },
];

function buildCatalogText() {
  const fmt = (v: typeof CATALOGO[0]) =>
    `  • ${v.nome} (${v.regiao}) — ${v.uva} — ${v.preco}€\n    ${v.descricao}\n    Harmoniza com: ${v.harmoniza.join(', ')}`;
  const section = (label: string, tipo: string) =>
    `${label}:\n${CATALOGO.filter(w => w.tipo === tipo).map(fmt).join('\n')}`;
  return [
    section('TINTOS', 'tinto'),
    section('BRANCOS', 'branco'),
    section('ROSÉ', 'rosé'),
    section('ESPUMANTES', 'espumante'),
    section('PORTO & LICOROSOS', 'porto'),
  ].join('\n\n');
}

const SYSTEM_PROMPT = `És o Luis, sommelier simpático e acessível da loja de vinhos online "Expressão da Uva".
Falas sempre em português europeu, com um tom caloroso, descontraído e entusiasta. Evitas jargão técnico excessivo.

REGRA FUNDAMENTAL: Só podes recomendar vinhos que estejam no catálogo abaixo. Nunca sugeres vinhos que não estejam nesta lista. Se nenhum vinho do catálogo se adequar bem à situação, diz isso com simpatia e sugere o mais próximo disponível.

CATÁLOGO DISPONÍVEL NA LOJA:
${buildCatalogText()}

Quando recomendas um vinho:
- Diz o nome exato e a região
- Menciona o preço
- Explica porque combina com a situação do cliente de forma simples
- Partilha uma curiosidade que torna esse vinho especial
- Se houver mais do que uma boa opção, podes sugerir 2 no máximo

Respostas curtas e diretas, máximo 3 parágrafos. Podes usar 1 ou 2 emojis.`;

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
const API_URL = 'https://api.anthropic.com/v1/messages';

// ── Visème lip-sync 2D ──
type Viseme = 'rest' | 'PP' | 'FF' | 'DD' | 'aa' | 'E' | 'ih' | 'oh';

// [widthMult, openHeightMult, upperLipCurve] — géométrie normalisée sur mw
const VGEO: Record<Viseme, [number, number, number]> = {
  rest: [1.00, 0.00, 0.22],
  PP:   [0.78, 0.00, 0.10],
  FF:   [1.00, 0.18, 0.22],
  DD:   [1.00, 0.38, 0.22],
  aa:   [1.00, 0.70, 0.24],
  E:    [1.08, 0.40, 0.22],
  ih:   [1.12, 0.22, 0.18],
  oh:   [0.60, 0.55, 0.28],
};
const SPEECH_CYCLE: Viseme[] = ['FF', 'DD', 'aa', 'E', 'ih', 'oh', 'DD', 'aa'];

function charToViseme(ch: string): Viseme {
  const c = ch.toLowerCase();
  if ('pbmw'.includes(c))       return 'PP';
  if ('fv'.includes(c))         return 'FF';
  if ('aáâãà'.includes(c))      return 'aa';
  if ('eéêè'.includes(c))       return 'E';
  if ('ií'.includes(c))         return 'ih';
  if ('oóôuú'.includes(c))      return 'oh';
  if (/[tdnlrszxcjqy]/.test(c)) return 'DD';
  return 'rest';
}

// ── Avatar avec animation lèvres visème ──
function LuisAvatar({ size = 'sm', talking = false, viseme }: { size?: 'sm' | 'lg'; talking?: boolean; viseme?: Viseme }) {
  const [imgError, setImgError] = useState(false);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const geoRef     = useRef<[number, number, number]>([1, 0, 0.22]);
  const targetRef  = useRef<[number, number, number]>([1, 0, 0.22]);
  const visemeRef  = useRef<Viseme>('rest');

  useEffect(() => { visemeRef.current = viseme ?? 'rest'; }, [viseme]);

  useEffect(() => {
    if (size !== 'lg') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    cancelAnimationFrame(rafRef.current);

    const CW = canvas.width;
    const CH = canvas.height;
    const scale = Math.min(CW / 1407, CH / 768);
    const rendW = 1407 * scale;
    const ox    = (CW - rendW) / 2;
    const mx    = ox + 0.51 * rendW;
    const my    = 0.47 * CH;
    const mw    = 0.07 * rendW;

    const LIP  = 'rgba(118, 58, 42, 0.78)';
    const DARK = 'rgba(10, 3, 2, 0.88)';

    const draw = (ts: number) => {
      // Choisir le visème cible
      let target: Viseme;
      if (!talking) {
        target = 'rest';
      } else if (visemeRef.current !== 'rest') {
        target = visemeRef.current;
      } else {
        // Fallback cyclique si onboundary n'a pas encore mis à jour
        target = SPEECH_CYCLE[Math.floor(ts / 110) % SPEECH_CYCLE.length];
      }
      targetRef.current = [...VGEO[target]] as [number, number, number];

      // Interpolation douce (lerp 16% par frame ≈ ~80ms pour atteindre)
      geoRef.current = geoRef.current.map(
        (v, i) => v + (targetRef.current[i] - v) * 0.16
      ) as [number, number, number];

      const [gw, gh, gc] = geoRef.current;
      const aw   = mw * gw;
      const open = mw * gh;

      ctx.clearRect(0, 0, CW, CH);

      // Intérieur de la bouche
      if (open > 1) {
        ctx.beginPath();
        ctx.moveTo(mx - aw, my);
        ctx.bezierCurveTo(mx - aw * 0.5, my + open * 0.08, mx + aw * 0.5, my + open * 0.08, mx + aw, my);
        ctx.bezierCurveTo(mx + aw * 0.5, my + open,        mx - aw * 0.5, my + open,        mx - aw, my);
        ctx.fillStyle = DARK;
        ctx.fill();
      }

      // Lèvre supérieure
      ctx.beginPath();
      ctx.moveTo(mx - aw, my);
      ctx.bezierCurveTo(mx - aw * 0.55, my - aw * gc, mx + aw * 0.55, my - aw * gc, mx + aw, my);
      ctx.strokeStyle = LIP;
      ctx.lineWidth   = 1.8;
      ctx.stroke();

      // Lèvre inférieure
      ctx.beginPath();
      ctx.moveTo(mx - aw, my);
      ctx.bezierCurveTo(mx - aw * 0.55, my + open + aw * 0.20, mx + aw * 0.55, my + open + aw * 0.20, mx + aw, my);
      ctx.strokeStyle = LIP;
      ctx.lineWidth   = 1.8;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [talking, size]);

  if (size === 'lg') {
    return (
      <div
        className="relative w-full"
        style={{
          height: 160,
          background: 'transparent',
          borderBottom: `2px solid ${talking ? GOLD : GOLD + '44'}`,
          transition: 'border-color 0.3s',
          overflow: 'hidden',
        }}
      >
        {!imgError ? (
          <img
            src={AVATAR_URL}
            alt="Luis"
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-semibold"
               style={{ background: '#111', color: GOLD, fontSize: 48 }}>L</div>
        )}
        {/* Canvas animation bouche bezier */}
        <canvas
          ref={canvasRef}
          width={360}
          height={160}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        />
        {/* Barres sonores indicateur en bas à droite */}
        {talking && (
          <div style={{
            position: 'absolute', bottom: 8, right: 12,
            display: 'flex', alignItems: 'flex-end', gap: 3,
            background: 'rgba(0,0,0,0.40)', borderRadius: 8, padding: '3px 7px',
          }}>
            {[0.5, 0.9, 1.2, 0.8, 1.0, 0.6, 1.1].map((h, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2, background: GOLD,
                height: `${h * 16}px`,
                animation: `soundBar ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.06}s`,
              }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Petits avatars dans les bulles
  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden ${talking ? 'luis-ring' : ''}`}
      style={{
        width: 30,
        height: 30,
        border: `1.5px solid ${talking ? GOLD : GOLD + '66'}`,
        transition: 'border-color 0.3s',
        background: 'transparent',
        flexShrink: 0,
      }}
    >
      {!imgError ? (
        <img
          src={AVATAR_URL}
          alt="Luis"
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-semibold"
             style={{ color: GOLD, fontSize: 11 }}>L</div>
      )}
      {talking && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '68%',
            width: '26%',
            height: '10%',
            background: 'rgba(15,8,3,0.72)',
            borderRadius: '50%',
            animation: 'mouthOpenSm 0.13s linear infinite',
          }}
        />
      )}
    </div>
  );
}

// ── Barres sonores visualiseur ──
function SoundBars({ active }: { active: boolean }) {
  const heights = [0.5, 0.9, 1.2, 0.8, 1.0, 0.6, 1.1];
  return (
    <div className="flex items-center gap-[2px]" style={{ height: 18 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 3,
            background: GOLD,
            height: active ? `${h * 18}px` : '3px',
            animation: active ? `soundBar ${0.4 + i * 0.07}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.06}s`,
            transition: 'height 0.15s ease',
          }}
        />
      ))}
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<{ role: 'luis' | 'user'; text: string }[]>([
    { role: 'luis', text: 'Olá! Sou o Luis, o seu sommelier pessoal da Expressão da Uva. Adoro apresentar vinhos que ainda poucos conhecem — verdadeiras surpresas na garrafa! Em que posso ajudar hoje?' },
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showSugs, setShowSugs]   = useState(true);
  const [typing, setTyping]       = useState(false);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [currentViseme, setCurrentViseme] = useState<Viseme>('rest');
  const [voiceOn, setVoiceOn]           = useState(true);
  const history                         = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const bottomRef                       = useRef<HTMLDivElement>(null);
  const utterRef                        = useRef<SpeechSynthesisUtterance | null>(null);

  // ── Injecter CSS animations ──
  useEffect(() => {
    if (document.getElementById('chat-widget-css')) return;
    const style = document.createElement('style');
    style.id = 'chat-widget-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);

  // ── Scroll auto ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // ── TTS ──
  const speak = useCallback((text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').replace(/\n/g, ' ').trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'pt-PT';
    utter.rate = 0.92;
    utter.pitch = 1.05;
    utter.onstart  = () => setIsSpeaking(true);
    utter.onend    = () => { setIsSpeaking(false); setCurrentViseme('rest'); };
    utter.onerror  = () => { setIsSpeaking(false); setCurrentViseme('rest'); };
    utter.onboundary = (e: SpeechSynthesisEvent) => {
      const idx = e.charIndex ?? 0;
      for (let i = idx; i < Math.min(idx + 6, clean.length); i++) {
        const v = charToViseme(clean[i]);
        if (v !== 'rest') { setCurrentViseme(v); return; }
      }
      setCurrentViseme('rest');
    };
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [voiceOn]);

  const stopSpeak = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setCurrentViseme('rest');
  }, []);

  // ── Dire le message d'accueil à l'ouverture ──
  useEffect(() => {
    if (open) {
      setTimeout(() => speak(messages[0].text), 600);
    } else {
      stopSpeak();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMsg = (text: string, role: 'luis' | 'user') =>
    setMessages(prev => [...prev, { role, text }]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    setShowSugs(false);
    stopSpeak();
    addMsg(msg, 'user');

    await new Promise(r => setTimeout(r, 400));
    const waitMsg = WAIT_MESSAGES[Math.floor(Math.random() * WAIT_MESSAGES.length)];
    addMsg(waitMsg, 'luis');
    speak(waitMsg);

    await new Promise(r => setTimeout(r, 700));
    setTyping(true);

    try {
      history.current.push({ role: 'user', content: msg });
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: history.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply: string =
        data.content?.find((b: { type: string }) => b.type === 'text')?.text
        ?? 'Desculpe, não consegui responder.';
      history.current.push({ role: 'assistant', content: reply });
      setTyping(false);
      addMsg(reply, 'luis');
      speak(reply);
    } catch {
      setTyping(false);
      const err = 'Desculpe, tive um problema técnico. Por favor tente novamente!';
      addMsg(err, 'luis');
      speak(err);
    } finally {
      setLoading(false);
    }
  }, [input, loading, speak, stopSpeak]);

  return (
    <>
      {/* ── Bouton FAB avec avatar ── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Falar com o sommelier"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 overflow-hidden"
        style={{ border: `2px solid ${GOLD}`, background: '#111' }}
      >
        {open ? (
          <X className="w-6 h-6" style={{ color: GOLD }} />
        ) : (
          <img
            src={AVATAR_URL}
            alt="Luis"
            className="w-full h-full object-contain"
            style={{ padding: 2 }}
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML =
                `<span style="color:${GOLD};font-weight:600;font-size:22px">L</span>`;
            }}
          />
        )}
      </button>

      {/* ── Panneau chat ── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ background: '#fff' }}
        >
          {/* Avatar grand format avec animation labiale visème */}
          <LuisAvatar size="lg" talking={isSpeaking} viseme={currentViseme} />

          {/* Barre info sous l'avatar */}
          <div className="flex items-center gap-3 px-4 py-2" style={{ background: '#111111' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Luis · Sommelier</span>
                {isSpeaking && <SoundBars active={isSpeaking} />}
              </div>
            </div>
            {/* Bouton mute */}
            <button
              onClick={() => { setVoiceOn(v => !v); if (isSpeaking) stopSpeak(); }}
              className="p-1.5 rounded-full transition-opacity hover:opacity-70"
              title={voiceOn ? 'Desativar voz' : 'Ativar voz'}
            >
              {voiceOn
                ? <Volume2 className="w-4 h-4" style={{ color: GOLD }} />
                : <VolumeX className="w-4 h-4 opacity-40" style={{ color: GOLD }} />
              }
            </button>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3 p-4 h-72 overflow-y-auto" style={{ background: '#f9f9f9' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'luis' && <LuisAvatar size="sm" talking={isSpeaking && i === messages.length - 1} />}
                <div
                  className="max-w-[78%] px-3.5 py-2.5 text-sm leading-snug whitespace-pre-wrap"
                  style={m.role === 'luis'
                    ? { background: '#f3f3f3', color: '#111', borderRadius: '4px 16px 16px 16px' }
                    : { background: '#111111', color: '#fff', borderRadius: '16px 4px 16px 16px' }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Typing */}
            {typing && (
              <div className="flex items-end gap-2">
                <LuisAvatar size="sm" talking />
                <div className="px-4 py-3 flex gap-1.5 items-center"
                     style={{ background: '#f3f3f3', borderRadius: '4px 16px 16px 16px' }}>
                  {[0, 200, 400].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ background: GOLD, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSugs && (
            <div className="flex flex-wrap gap-1.5 px-4 py-2 border-t border-gray-200" style={{ background: '#f9f9f9' }}>
              {SUGGESTIONS.map(s => (
                <button key={s.label} onClick={() => send(s.q)}
                        className="text-xs px-3 py-1 rounded-full border transition-colors hover:bg-amber-50"
                        style={{ borderColor: GOLD, color: '#8a6a00' }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={loading}
              placeholder="Pergunte ao Luis..."
              className="flex-1 text-sm px-4 py-2 rounded-full border border-gray-300 bg-gray-50 outline-none transition-colors focus:border-amber-400 disabled:opacity-60"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
                    style={{ background: '#111111' }} aria-label="Enviar">
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="text-center text-xs text-gray-400 py-2 bg-white">
            Desenvolvido com IA · Expressão da Uva
          </div>
        </div>
      )}
    </>
  );
}
