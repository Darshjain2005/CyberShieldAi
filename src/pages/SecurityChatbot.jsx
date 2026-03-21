import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Paperclip, Send } from 'lucide-react';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const SYSTEM_PROMPT = `You are NEXUS, an elite AI security copilot embedded in CyberShield — 
an advanced cybersecurity operations platform. You specialize in:
- Network security, firewall policies, and intrusion detection
- Malware analysis, ransomware response, and threat hunting
- CVE triage, patch management, and vulnerability remediation
- Incident response playbooks and forensic analysis
- Zero-trust architecture and compliance (ISO 27001, NIST, SOC2)

Respond in a concise, technical, no-nonsense style befitting a security operations center. 
Use terminal-style formatting where appropriate. Keep responses focused and actionable.`;

const SecurityChatbot = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'INTELLIGENCE UPLINK SECURED. State your query regarding network policy or incident response.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const endOfMessagesRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setError(null);

    try {
      // Build history for Groq (exclude the initial assistant greeting from API call)
      const history = [...messages, userMessage]
        .filter((_, i) => i !== 0) // skip the greeting
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Groq API error');
      }

      const data = await response.json();
      const aiContent = data.choices[0].message.content;

      setMessages((prev) => [...prev, { role: 'assistant', content: aiContent }]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `[ERROR] UPLINK FAILED: ${err.message}. Check your VITE_GROQ_API_KEY in .env`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-6rem)] flex gap-6 max-w-6xl mx-auto"
    >
      {/* Sidebar / Knowledge Base */}
      <div className="w-1/3 glass-panel hidden md:flex flex-col p-4">
        <h3 className="font-display text-lg text-cyber-neonCyan border-b border-cyber-neonCyan/30 pb-2 mb-4 flex items-center gap-2">
          <Paperclip className="w-4 h-4" /> KNOWLEDGE BASE
        </h3>
        <div className="flex-1 space-y-2 overflow-y-auto">
          <DocItem name="ISO_27001_Compliance.pdf" size="2.4MB" />
          <DocItem name="Incident_Response_Playbook.md" size="45KB" />
          <DocItem name="Firewall_Ruleset_v3.json" size="12KB" />
          <DocItem name="ZeroTrust_Architecture.docx" size="1.1MB" />
        </div>
        <div className="mt-4 p-3 bg-black/40 border border-cyber-neonCyan/20 rounded text-xs font-mono text-gray-500 space-y-1">
          <div className="text-cyber-neonGreen">▸ MODEL: llama-3.3-70b-versatile</div>
          <div>▸ PROVIDER: Groq (free tier)</div>
          <div>▸ CONTEXT: 128k tokens</div>
        </div>
        <button className="w-full neon-button text-sm py-2 mt-3">+ INGEST DOCUMENT</button>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 glass-panel flex flex-col p-0 overflow-hidden relative border-t-4 border-t-cyber-neonCyan shadow-[0_0_20px_rgba(0,243,255,0.15)]">

        {/* Chat Header */}
        <div className="bg-black/60 p-4 border-b border-cyber-neonCyan/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-cyber-neonCyan flex items-center justify-center bg-cyber-neonCyan/20 shadow-[0_0_10px_#00f3ff]">
              <MessageSquare className="text-cyber-neonCyan w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white tracking-widest text-lg">NEXUS COPILOT</h2>
              <p className="text-xs font-mono text-cyber-neonGreen">
                {isTyping ? 'PROCESSING...' : 'ONLINE — Groq / Llama 3.3 70B'}
              </p>
            </div>
          </div>
          {/* Clear chat button */}
          <button
            onClick={() =>
              setMessages([
                { role: 'assistant', content: 'INTELLIGENCE UPLINK SECURED. State your query.' },
              ])
            }
            className="text-xs font-mono text-gray-500 hover:text-cyber-neonRed transition-colors border border-gray-700 hover:border-cyber-neonRed px-3 py-1 rounded"
          >
            CLEAR SESSION
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-transparent to-black/40">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] p-4 rounded-lg font-mono text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-cyber-neonCyan/20 text-cyber-neonCyan border border-cyber-neonCyan/50 rounded-br-none'
                    : 'bg-black/60 text-gray-300 border border-gray-600 rounded-bl-none shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]'
                }`}
              >
                {msg.role === 'assistant' && (
                  <span className="text-cyber-neonCyan font-bold mb-1 block">{'[NEXUS] >'}</span>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-black/60 border border-gray-600 p-4 rounded-lg rounded-bl-none">
                <span className="text-cyber-neonCyan font-mono">
                  <span className="animate-pulse">Computing correlation</span>
                  <span className="animate-bounce inline-block ml-1">...</span>
                </span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-black/60 border-t border-cyber-neonCyan/20">
          {error && (
            <p className="text-cyber-neonRed font-mono text-xs mb-2">
              ⚠ {error}
            </p>
          )}
          <div className="relative flex items-center">
            <span className="absolute left-4 text-cyber-neonCyan font-bold">{'>'}</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Query security parameters..."
              disabled={isTyping}
              className="w-full bg-cyber-dark border border-gray-700 rounded-full py-3 pl-10 pr-12 text-white font-mono focus:outline-none focus:border-cyber-neonCyan focus:shadow-[0_0_10px_rgba(0,243,255,0.3)] transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="absolute right-2 p-2 text-cyber-neonCyan hover:text-white transition-colors disabled:opacity-40"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const DocItem = ({ name, size }) => (
  <div className="p-3 bg-black/40 border border-gray-800 rounded flex justify-between items-center hover:border-cyber-neonCyan/50 transition-colors cursor-pointer group">
    <div className="truncate pr-2 font-mono text-sm text-gray-300 group-hover:text-white">{name}</div>
    <div className="text-xs text-cyber-neonCyan whitespace-nowrap">{size}</div>
  </div>
);

export default SecurityChatbot;