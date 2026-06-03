import { useState, useRef, useEffect } from 'react';
import { CATALOGO, catalogoParaTexto } from '../data/wineCatalog';
import TalkingHead3D from './TalkingHead3D';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || '';
const API_URL = 'https://api.anthropic.com/v1/messages';

const MENSAGENS_ESPERA = [
  "Boa pergunta! Deixe-me verificar a disponibilidade dos nossos vinhos... 🍷",
  "Um momento! Estou a consultar o nosso catálogo para si... 🔍",
  "Óptima escolha de situação! Vou verificar o que temos disponível agora mesmo... 🍾",
  "Claro! Deixe-me analisar os nossos crus e a disponibilidade actual... 🧐",
  "Com certeza! Estou a verificar o stock disponível, já lhe respondo... ✨",
];

const SYSTEM_PROMPT =
  `És o Luis, sommelier simpático e acessível da loja de vinhos online "Expressão da Uva". Falas sempre em português europeu, com um tom caloroso, descontraído e entusiasta. Evitas jargão técnico excessivo.

REGRA FUNDAMENTAL: Só podes recomendar vinhos que estejam no catálogo abaixo. Nunca sugeres vinhos que não estejam nesta lista.

CATÁLOGO DISPONÍVEL NA LOJA:\n${catalogoParaTexto()}

Quando recomendas um vinho:
- Diz o nome exato e a região
- Menciona o preço
- Explica porque combina com a situação
- Partilha uma curiosidade que torna esse vinho especial
- Máximo 2 sugestões

Respostas curtas e diretas, máximo 3 parágrafos.`;

interface Mensagem { role: 'user' | 'assistant'; text: string }

function mockResponse(userMsg: string): string {
  const q = userMsg.toLowerCase();
  if (q.includes('polvo') || q.includes('marisco') || q.includes('peixe'))
    return "Excelente escolha! Para polvo ou marisco, recomendo o **Quinta de Chocapalha Castelão** (14€) — um tinto leve de Lisboa que casa perfeitamente com polvo assado. Se preferir branco, o **Anselmo Mendes Contacto** (16€) é um Alvarinho com textura única que acompanha marisco na perfeição. 🐙🍷";
  if (q.includes('romântica') || q.includes('romantico') || q.includes('jantar'))
    return "Para uma noite romântica, sugiro o **Mencia Dominio do Bibei** (22€) da Galiza — elegante e perfumado, lembra um Pinot Noir ibérico. Se preferir um espumante, o **Murganheira Blanc de Blancs** (24€) é um método clássico português que traz logo um ar de celebração! 🕯️🥂";
  if (q.includes('presente') || q.includes('oferecer'))
    return "Que bela ideia! Para oferecer, recomendo o **Envínate Palo Blanco** (28€) de Tenerife — um branco vulcânico surpreendente. Ou o **Niepoort Colheita 2015** (38€), um Porto envelhecido em cascos, perfeito para quem gosta de algo doce e complexo. 🎁";
  if (q.includes('branco'))
    return "Temos brancos fantásticos! O **Quinta do Ameal Loureiro** (13€) é super floral e fresco. O **Filipa Pato Nossa Calcário** (17€) é uma Bical da Bairrada, mineral e elegante. 🍋🥂";
  if (q.includes('tinto'))
    return "Nos tintos temos verdadeiras pérolas! O **Niepoort Nat'Cool** (12€) é um tinto leve que se serve fresco. O **Herdade do Rocim Amphora** (18€) é fermentado em ânfora, muito mineral. 🍇🍷";
  return "Que boa pergunta! Deixe-me pensar nos vinhos que melhor se encaixam... Temos opções fantásticas no nosso catálogo. Gostaria de saber mais sobre tintos, brancos, ou tem alguma ocasião especial em mente? 🍷";
}

interface ChatBotProps { isOpen: boolean; onClose: () => void }

export default function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [messages, setMessages] = useState<Mensagem[]>([
    { role: 'assistant', text: 'Olá! Sou o Luis, o seu sommelier pessoal da Expressão da Uva. Adoro apresentar vinhos que ainda poucos conhecem — verdadeiras surpresas na garrafa! Em que posso ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarText, setAvatarText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const histRef = useRef<Array<{ role: string; content: string }>>([]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      document.body.style.overflow = 'hidden';
      // Auto-speak welcome after a moment
      setTimeout(() => setAvatarText(
        'Olá! Sou o Luis, o seu sommelier pessoal da Expressão da Uva. Adoro apresentar vinhos que ainda poucos conhecem — verdadeiras surpresas na garrafa! Em que posso ajudar hoje?'
      ), 500);
    } else {
      document.body.style.overflow = '';
      setAvatarText('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  async function callAPI(userMsg: string): Promise<string> {
    histRef.current.push({ role: 'user', content: userMsg });
    if (!API_KEY) {
      await new Promise(r => setTimeout(r, 1200));
      const reply = mockResponse(userMsg);
      histRef.current.push({ role: 'assistant', content: reply });
      return reply;
    }
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: SYSTEM_PROMPT, messages: histRef.current }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const reply = data.content?.find((b: any) => b.type === 'text')?.text || 'Desculpe, não consegui responder.';
    histRef.current.push({ role: 'assistant', content: reply });
    return reply;
  }

  async function send() {
    const txt = input.trim();
    if (!txt || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: txt }]);
    setLoading(true);

    const espera = MENSAGENS_ESPERA[Math.floor(Math.random() * MENSAGENS_ESPERA.length)];
    await new Promise(r => setTimeout(r, 500));
    setMessages(prev => [...prev, { role: 'assistant', text: espera }]);
    setAvatarText(espera);
    setLoading(false);
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));

    try {
      const reply = await callAPI(txt);
      setMessages(prev => {
        const filtered = prev.slice(0, -1);
        return [...filtered, { role: 'assistant', text: reply }];
      });
      // Avatar speaks the real response
      setAvatarText(reply.replace(/\*\*/g, ''));
    } catch {
      setMessages(prev => {
        const filtered = prev.slice(0, -1);
        return [...filtered, { role: 'assistant', text: 'Desculpe, tive um problema técnico. Por favor tente novamente!' }];
      });
      setAvatarText('Desculpe, tive um problema técnico.');
    } finally {
      setLoading(false);
    }
  }

  function askQuick(q: string) { setInput(q); setTimeout(() => send(), 100); }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:w-[380px] mx-0 sm:mx-4 animate-slideUp z-10 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl bg-white flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* ===== HEADER with 3D Avatar ===== */}
        <div className="bg-[#111111]">
          <div className="flex items-center px-3 py-2">
            <button onClick={onClose} className="text-white/50 hover:text-white mr-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 min-w-0 ml-1">
              <div className="text-white text-sm font-semibold">Luis · Sommelier</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5DCAA5] inline-block" />
                <span className="text-[#C8A96E] text-xs">Expressão da Uva</span>
              </div>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white ml-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="relative w-full h-[340px] sm:h-[380px]">
            <TalkingHead3D text={avatarText} autoSpeak={true} />
          </div>
        </div>

        {/* ===== MESSAGES ===== */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#f9f9f9]" style={{ minHeight: 220, maxHeight: 360 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 items-end ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-[#f3f3f3] text-[#111] rounded-br-xl rounded-tr-xl rounded-bl-lg'
                  : 'bg-[#111] text-white rounded-tl-xl rounded-bl-xl rounded-br-lg'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-end">
              <div className="bg-[#f3f3f3] rounded-br-xl rounded-tr-xl rounded-bl-lg px-4 py-3 flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ===== SUGGESTIONS ===== */}
        {messages.length <= 2 && !loading && (
          <div className="px-4 py-2 bg-[#f9f9f9] border-t border-[#e0e0e0] flex flex-wrap gap-1.5">
            {[
              ['Jantar de polvo', 'Que vinho para um jantar de polvo?'],
              ['Noite romântica', 'Vinho para uma noite romântica'],
              ['Ideia de presente', 'Tem algo diferente para oferecer como presente?'],
              ['Marisco', 'Vinho branco para marisco'],
            ].map(([label, q]) => (
              <button key={label} onClick={() => askQuick(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#C8A96E] text-[#8a6a00] hover:bg-[#f5efc0] transition-colors">
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ===== INPUT ===== */}
        <div className="flex gap-2 px-4 py-3 border-t border-[#e0e0e0] bg-white">
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()} placeholder="Pergunte ao Luis..."
            disabled={loading}
            className="flex-1 border border-[#ddd] rounded-full px-4 py-2 text-sm outline-none bg-[#f9f9f9] text-[#111] focus:border-[#C8A96E] disabled:opacity-50" />
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#333] disabled:opacity-40 text-lg">
            &#10148;
          </button>
        </div>

        <div className="text-center text-[10px] text-[#aaa] pb-2.5 bg-white">
          Desenvolvido com IA · Expressão da Uva
        </div>
      </div>

      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}.animate-slideUp{animation:slideUp 0.3s ease-out}`}</style>
    </div>
  );
}
