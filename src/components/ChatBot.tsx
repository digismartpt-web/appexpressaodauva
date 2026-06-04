import { useState, useRef, useEffect } from 'react';
import { CATALOGO, catalogoParaTexto } from '../data/wineCatalog';
import AvatarLuis from './AvatarLuis';

const FCC_HOST = import.meta.env.VITE_FCC_HOST || window.location.hostname;
const FCC_URL = `http://${FCC_HOST}:8643/v1/chat/completions`;

const MENSAGENS_ESPERA = [
  "Boa pergunta! Deixe-me verificar... 🍷",
  "Um momento! Estou a consultar para si... 🔍",
  "Óptima escolha! Vou verificar o que temos disponível... ✨",
  "Claro! Já lhe respondo... 🧐",
  "Com certeza! Um instante... ✨",
];

interface Mensagem { role: 'user' | 'assistant'; text: string }

function respondFallback(): string {
 return "Desculpe, ainda não tenho resposta para essa pergunta. O meu catálogo está em constante atualização — em breve trarei novidades! 🍷";
}

interface ChatBotProps { isOpen: boolean; onClose: () => void }

export default function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [messages, setMessages] = useState<Mensagem[]>([
    { role: 'assistant', text: 'Olá! Sou o Luis, o seu assistente pessoal da Expressão da Uva. Como posso ajudar hoje?' }
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
        'Olá! Sou o Luis, o seu assistente pessoal da Expressão da Uva. Como posso ajudar hoje?'
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
    const systemPrompt = `És o Luis, assistente da loja "Expressão da Uva". Falas sempre em português europeu, com tom caloroso e simpático.

REGRAS ABSOLUTAS:
1. REGRA DE OURO — NUNCA uses conhecimento geral sobre vinhos. NUNCA inventes produtos, castas, regiões, preços, harmonizações ou qualquer informação que não esteja explicitamente no catálogo abaixo.
2. Se o catálogo estiver vazio, a tua ÚNICA resposta é informar que estamos a preparar novidades em breve. NÃO sugeres, inventas ou descreves nenhum vinho, casta, região ou harmonização.
3. Se a pergunta não for sobre os vinhos do catálogo (ou sobre a loja), responde educadamente que só podes ajudar com os vinhos disponíveis na loja e redireciona para o catálogo.
4. NÃO respondes a perguntas sobre outros assuntos — tecnologia, clima, conversa casual, cultura geral, conselhos pessoais. Redirecionas sempre para o catálogo.
5. Se o utilizador pedir um vinho ou característica que não existe no catálogo, dizes que não está disponível e redirecionas para o que realmente existe.

CATÁLOGO:\n${catalogoParaTexto()}

Respostas curtas e diretas, máximo 3 parágrafos.`;

    const res = await fetch(FCC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'fcc-proxy',
        messages: [
          { role: 'system', content: systemPrompt },
          ...histRef.current,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Desculpe, não consegui responder.';
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
        return [...filtered, { role: 'assistant', text: respondFallback() }];
      });
      setAvatarText(respondFallback());
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
              <div className="text-white text-sm font-semibold">Luis · Assistente</div>
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
            <AvatarLuis text={avatarText} autoSpeak={true} />
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
