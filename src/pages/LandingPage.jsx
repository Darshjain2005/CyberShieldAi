import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Search, Zap, Eye, FileText, Terminal, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

// Floating particle
const Particle = ({ style }) => (
  <motion.div
    className="absolute w-1 h-1 bg-cyber-neonCyan rounded-full opacity-30"
    style={style}
    animate={{
      x: [0, Math.random() * 60 - 30, Math.random() * 40 - 20, 0],
      y: [0, Math.random() * 60 - 30, Math.random() * 40 - 20, 0],
    }}
    transition={{
      duration: Math.random() * 6 + 8,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);
// Animated grid line
const GridLine = ({ horizontal, position }) => (
  <motion.div
    className={`absolute ${horizontal ? 'w-full h-px' : 'h-full w-px'} bg-cyber-neonCyan/10`}
    style={horizontal ? { top: position } : { left: position }}
    animate={{ opacity: [0.05, 0.2, 0.05] }}
    transition={{ duration: Math.random() * 4 + 2, repeat: Infinity, delay: Math.random() * 2 }}
  />
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [activeFeature, setActiveFeature] = useState(null);
  const fullText = 'INITIALIZING CYBERSHIELD AI SYSTEMS...';

  // Typing animation
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Cursor blink
  useEffect(() => {
    const timer = setInterval(() => setShowCursor(p => !p), 500);
    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: AlertTriangle,
      title: 'AI Malware Detection',
      desc: 'Real-time polymorphic malware scanning powered by VirusTotal and AI heuristics.',
      color: 'neonRed',
      path: '/malware',
      tag: 'ACTIVE'
    },
    {
      icon: Eye,
      title: 'Phishing & Deepfake',
      desc: 'Detect AI-generated deepfakes and spear-phishing across text, images and video.',
      color: 'neonCyan',
      path: '/phishing',
      tag: 'ACTIVE'
    },
    {
      icon: Search,
      title: 'CVE Prioritization',
      desc: 'Intelligent vulnerability triage using live NVD data and Groq AI analysis.',
      color: 'neonGreen',
      path: '/vulnerabilities',
      tag: 'ACTIVE'
    },
    {
      icon: FileText,
      title: 'Policy Intelligence',
      desc: 'Upload any security policy PDF and query it in natural language instantly.',
      color: 'neonPurple',
      path: '/policy',
      tag: 'ACTIVE'
    },
    {
      icon: Terminal,
      title: 'Honeypot Simulator',
      desc: 'Generative deceptive network responses to confuse and track attackers.',
      color: 'neonCyan',
      path: '/honeypot',
      tag: 'ACTIVE'
    },
    {
      icon: Zap,
      title: 'NEXUS AI Copilot',
      desc: 'Elite security chatbot for incident response, CVE analysis and hardening.',
      color: 'neonGreen',
      path: '/chatbot',
      tag: 'ACTIVE'
    },
  ];

  const colorMap = {
    neonCyan: {
      text: 'text-cyber-neonCyan',
      border: 'border-cyber-neonCyan',
      bg: 'bg-cyber-neonCyan/10',
      glow: 'shadow-[0_0_25px_rgba(0,243,255,0.3)]',
      borderFaint: 'border-cyber-neonCyan/20',
    },
    neonRed: {
      text: 'text-cyber-neonRed',
      border: 'border-cyber-neonRed',
      bg: 'bg-cyber-neonRed/10',
      glow: 'shadow-[0_0_25px_rgba(255,0,60,0.3)]',
      borderFaint: 'border-cyber-neonRed/20',
    },
    neonGreen: {
      text: 'text-cyber-neonGreen',
      border: 'border-cyber-neonGreen',
      bg: 'bg-cyber-neonGreen/10',
      glow: 'shadow-[0_0_25px_rgba(57,255,20,0.3)]',
      borderFaint: 'border-cyber-neonGreen/20',
    },
    neonPurple: {
      text: 'text-cyber-neonPurple',
      border: 'border-cyber-neonPurple',
      bg: 'bg-cyber-neonPurple/10',
      glow: 'shadow-[0_0_25px_rgba(176,0,255,0.3)]',
      borderFaint: 'border-cyber-neonPurple/20',
    },
  };

  const particles = Array.from({ length: 25 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
  }));

  return (
    <div className="min-h-screen bg-cyber-black overflow-x-hidden">
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.4; }
          94% { opacity: 1; }
          96% { opacity: 0.6; }
          97% { opacity: 1; }
        }
        @keyframes datascroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes cornerPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .scan-line {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, rgba(0,243,255,0.4) 50%, transparent 100%);
          animation: scanline 10s linear infinite;
          pointer-events: none;
          z-index: 999;
        }
        .flicker { animation: flicker 8s infinite; }
        .data-scroll {
          animation: datascroll 20s linear infinite;
        }
        .corner-tl::before, .corner-tl::after,
        .corner-br::before, .corner-br::after {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          animation: cornerPulse 2s ease-in-out infinite;
        }
        .corner-tl::before { top: 0; left: 0; border-top: 2px solid #00f3ff; border-left: 2px solid #00f3ff; }
        .corner-tl::after { top: 0; right: 0; border-top: 2px solid #00f3ff; border-right: 2px solid #00f3ff; }
        .corner-br::before { bottom: 0; left: 0; border-bottom: 2px solid #00f3ff; border-left: 2px solid #00f3ff; }
        .corner-br::after { bottom: 0; right: 0; border-bottom: 2px solid #00f3ff; border-right: 2px solid #00f3ff; }
      `}</style>

      {/* Scanline */}
      <div className="scan-line" />

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">

        {/* Animated grid background */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,243,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,243,255,0.03) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Dynamic grid lines */}
        {[10, 25, 50, 75, 90].map(p => (
          <GridLine key={`h${p}`} horizontal position={`${p}%`} />
        ))}
        {[15, 35, 65, 85].map(p => (
          <GridLine key={`v${p}`} position={`${p}%`} />
        ))}

        {/* Particles */}
        {particles.map((style, i) => <Particle key={i} style={style} />)}

        {/* Rotating rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[600, 450, 300, 180].map((size, i) => (
            <motion.div
              key={size}
              className="absolute rounded-full border border-cyber-neonCyan/10"
              style={{ width: size, height: size }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 20 + i * 15, repeat: Infinity, ease: 'linear' }}
            />
          ))}
          {/* Glow orb */}
          <motion.div
            className="absolute w-64 h-64 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(0,243,255,0.08) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>

        {/* Scrolling data on left */}
        <div className="absolute left-4 top-0 bottom-0 w-24 overflow-hidden opacity-10 pointer-events-none hidden lg:block">
          <div className="data-scroll font-mono text-[9px] text-cyber-neonCyan leading-5">
            {Array.from({ length: 60 }, (_, i) => (
              <div key={i}>{Math.random().toString(16).slice(2, 10).toUpperCase()}</div>
            ))}
            {Array.from({ length: 60 }, (_, i) => (
              <div key={i + 60}>{Math.random().toString(16).slice(2, 10).toUpperCase()}</div>
            ))}
          </div>
        </div>

        {/* Scrolling data on right */}
        <div className="absolute right-4 top-0 bottom-0 w-24 overflow-hidden opacity-10 pointer-events-none hidden lg:block">
          <div className="data-scroll font-mono text-[9px] text-cyber-neonGreen leading-5" style={{ animationDirection: 'reverse' }}>
            {Array.from({ length: 60 }, (_, i) => (
              <div key={i}>{Math.random().toString(16).slice(2, 10).toUpperCase()}</div>
            ))}
            {Array.from({ length: 60 }, (_, i) => (
              <div key={i + 60}>{Math.random().toString(16).slice(2, 10).toUpperCase()}</div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">

          {/* Boot text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-mono text-cyber-neonGreen text-xs mb-8 tracking-widest h-5"
          >
            <span className="text-gray-600">{'> '}</span>
            {typedText}
            {showCursor && <span className="text-cyber-neonGreen">█</span>}
          </motion.div>

          {/* Shield */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 1, delay: 0.5 }}
            className="mb-6 relative inline-block"
          >
            <motion.div
              animate={{
                filter: [
                  'drop-shadow(0 0 10px rgba(0,243,255,0.4))',
                  'drop-shadow(0 0 35px rgba(0,243,255,1))',
                  'drop-shadow(0 0 10px rgba(0,243,255,0.4))',
                ]
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <Shield className="w-16 h-16 text-cyber-neonCyan mx-auto" />
            </motion.div>
            {/* Orbiting dot */}
            <motion.div
              className="absolute w-2 h-2 bg-cyber-neonCyan rounded-full"
              style={{ top: '50%', left: '50%', marginTop: -32 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(40px)`}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-black font-display tracking-wider mb-3 flicker">
              <span className="text-white">CYBER</span>
              <motion.span
                className="text-cyber-neonCyan"
                animate={{ textShadow: ['0 0 10px rgba(0,243,255,0.5)', '0 0 30px rgba(0,243,255,1)', '0 0 10px rgba(0,243,255,0.5)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                SHIELD
              </motion.span>
              <span className="block text-base md:text-lg text-cyber-neonGreen font-mono tracking-[0.4em] mt-2 drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]">
                AI SECURITY PLATFORM
              </span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-gray-400 font-mono text-xs md:text-sm max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Next-generation AI-powered cybersecurity platform for real-time threat detection,
            vulnerability prioritization, and intelligent policy interpretation.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="flex gap-4 justify-center flex-wrap"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/dashboard')}
              className="relative px-8 py-3 bg-cyber-neonCyan text-black font-display font-bold tracking-widest text-sm rounded overflow-hidden group"
            >
              <span className="relative z-10 flex items-center gap-2">
                LAUNCH PLATFORM <ChevronRight className="w-4 h-4" />
              </span>
              <motion.div
                className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20"
                transition={{ duration: 0.2 }}
              />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(0,243,255,0.3)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/chatbot')}
              className="px-8 py-3 border border-cyber-neonCyan/50 text-cyber-neonCyan font-display font-bold tracking-widest text-sm rounded hover:bg-cyber-neonCyan/10 transition-all"
            >
              TRY NEXUS AI
            </motion.button>
          </motion.div>

          {/* Live status badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="flex gap-4 justify-center mt-8 flex-wrap"
          >
            {[
              { label: 'THREAT DETECTION', color: 'text-cyber-neonGreen' },
              { label: 'CVE MONITORING', color: 'text-cyber-neonCyan' },
              { label: 'AI ANALYSIS', color: 'text-cyber-neonPurple' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2">
                <motion.div
                  className={`w-1.5 h-1.5 rounded-full ${badge.color.replace('text-', 'bg-')}`}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                />
                <span className={`font-mono text-[10px] tracking-widest ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        >
          <div className="w-5 h-8 border border-cyber-neonCyan/30 rounded-full flex items-start justify-center p-1">
            <motion.div
              className="w-1 h-1.5 bg-cyber-neonCyan rounded-full"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="py-20 px-6 relative overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,243,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,243,255,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        {/* Section glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-cyber-neonCyan/50 to-transparent" />

        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <motion.p
              className="text-cyber-neonCyan font-mono text-xs tracking-widest mb-3"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              // PLATFORM CAPABILITIES
            </motion.p>
            <h2 className="text-3xl md:text-4xl font-black font-display text-white">
              EVERY THREAT.{' '}
              <motion.span
                className="text-cyber-neonCyan"
                animate={{ textShadow: ['0 0 5px rgba(0,243,255,0.3)', '0 0 20px rgba(0,243,255,0.8)', '0 0 5px rgba(0,243,255,0.3)'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                NEUTRALIZED.
              </motion.span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              const c = colorMap[feature.color];
              const isActive = activeFeature === idx;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  onHoverStart={() => setActiveFeature(idx)}
                  onHoverEnd={() => setActiveFeature(null)}
                  onClick={() => navigate(feature.path)}
                  className={`relative glass-panel p-5 border cursor-pointer transition-all duration-300 overflow-hidden
                    ${isActive ? `${c.border} ${c.glow}` : c.borderFaint}
                  `}
                >
                  {/* Corner decorations */}
                  <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l ${isActive ? c.border : 'border-gray-700'} transition-colors duration-300`} />
                  <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${isActive ? c.border : 'border-gray-700'} transition-colors duration-300`} />
                  <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l ${isActive ? c.border : 'border-gray-700'} transition-colors duration-300`} />
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r ${isActive ? c.border : 'border-gray-700'} transition-colors duration-300`} />

                  {/* Background glow on hover */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`absolute inset-0 ${c.bg} pointer-events-none`}
                      />
                    )}
                  </AnimatePresence>

                  {/* Tag */}
                  <div className={`absolute top-3 right-3 text-[9px] font-mono px-1.5 py-0.5 border ${c.borderFaint} ${c.text} rounded`}>
                    {feature.tag}
                  </div>

                  <div className="relative z-10">
                    <motion.div
                      animate={isActive ? { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      <Icon className={`w-8 h-8 mb-3 ${c.text}`} />
                    </motion.div>
                    <h3 className="text-sm font-bold font-display text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-500 text-xs font-mono leading-relaxed">
                      {feature.desc}
                    </p>
                    <motion.div
                      className={`mt-3 text-[10px] font-mono flex items-center gap-1 ${c.text}`}
                      animate={isActive ? { x: [0, 4, 0] } : {}}
                      transition={{ duration: 0.6, repeat: isActive ? Infinity : 0 }}
                    >
                      EXPLORE <ChevronRight className="w-3 h-3" />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 px-6 bg-black/60 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber-neonCyan/20 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-cyber-neonCyan font-mono text-xs tracking-widest mb-3">
              // HOW IT WORKS
            </p>
            <h2 className="text-3xl font-black font-display text-white">
              3 STEPS TO{' '}
              <span className="text-cyber-neonGreen drop-shadow-[0_0_10px_rgba(57,255,20,0.6)]">
                FULL PROTECTION
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connection lines */}
            <div className="hidden md:block absolute top-14 left-[33%] right-[33%] h-px">
              <motion.div
                className="h-full bg-gradient-to-r from-cyber-neonCyan/20 via-cyber-neonCyan/60 to-cyber-neonCyan/20"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.5 }}
              />
              {/* Moving dot on line */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-cyber-neonCyan rounded-full"
                animate={{ left: ['0%', '100%', '0%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {[
              { step: '01', title: 'UPLOAD & SCAN', desc: 'Upload files, paste emails, or input CVE IDs. Our AI begins analysis instantly.', icon: '📤', color: 'cyber-neonCyan' },
              { step: '02', title: 'AI ANALYSIS', desc: 'Groq LLaMA 3.3 70B and VirusTotal engines analyze threats in milliseconds.', icon: '🧠', color: 'cyber-neonGreen' },
              { step: '03', title: 'ACT ON RESULTS', desc: 'Get prioritized recommendations and exact remediation steps immediately.', icon: '🛡️', color: 'cyber-neonPurple' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                whileHover={{ y: -5 }}
                className="text-center relative"
              >
                <motion.div
                  className={`w-24 h-24 mx-auto mb-4 rounded-full border border-${step.color}/30 flex items-center justify-center bg-cyber-panel text-3xl relative overflow-hidden`}
                  whileHover={{ borderColor: 'rgba(0,243,255,0.8)' }}
                >
                  <motion.div
                    className={`absolute inset-0 bg-${step.color}/5`}
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                  />
                  {step.icon}
                </motion.div>
                <motion.div
                  className="text-cyber-neonCyan font-mono text-xs tracking-widest mb-2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                >
                  STEP {step.step}
                </motion.div>
                <h3 className="text-white font-display font-bold text-sm mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-400 font-mono text-xs leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      <section className="py-28 px-6 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(0,243,255,0.05) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        {/* Corner decorations */}
        <motion.div
          className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-cyber-neonCyan/30"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-cyber-neonCyan/30"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        <motion.div
          className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-cyber-neonCyan/30"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
        <motion.div
          className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-cyber-neonCyan/30"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center relative z-10"
        >
          <motion.div
            className="text-cyber-neonCyan font-mono text-xs tracking-widest mb-4"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            // READY TO DEPLOY?
          </motion.div>

          <h2 className="text-3xl md:text-4xl font-black font-display text-white mb-4">
            BECOME THE
            <motion.span
              className="block text-cyber-neonCyan"
              animate={{
                textShadow: [
                  '0 0 10px rgba(0,243,255,0.3)',
                  '0 0 30px rgba(0,243,255,1)',
                  '0 0 10px rgba(0,243,255,0.3)',
                ]
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              DIGITAL SHIELD
            </motion.span>
          </h2>

          <p className="text-gray-400 font-mono text-xs mb-10 max-w-md mx-auto leading-relaxed">
            Detect threats before they strike. Powered by real AI, real data, real protection.
          </p>

          <motion.button
            whileHover={{
              scale: 1.05,
              boxShadow: '0 0 40px rgba(0,243,255,0.6)',
            }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/dashboard')}
            className="relative px-10 py-4 bg-cyber-neonCyan text-black font-display font-black text-sm tracking-widest rounded overflow-hidden group"
          >
            <span className="relative z-10">INITIATE UPLINK →</span>
            <motion.div
              className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10"
              transition={{ duration: 0.2 }}
            />
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-cyber-neonCyan/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-cyber-neonCyan" />
            <span className="font-display text-sm text-gray-400">CYBERSHIELD AI</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-cyber-neonGreen"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-cyber-neonGreen font-mono text-xs">ALL SYSTEMS OPERATIONAL</span>
          </div>
          <p className="text-gray-600 font-mono text-xs">
            BUILT FOR THE DIGITAL BATTLEFIELD
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;