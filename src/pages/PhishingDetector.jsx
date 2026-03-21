import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MailSearch, Wand2, UploadCloud, X, Terminal, ShieldAlert, ShieldCheck, Activity, BrainCircuit, ScanLine, FileText } from 'lucide-react';

const PhishingDetector = () => {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeContent = async () => {
    if (!text.trim() && !file) return;
    
    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('text', text);
      }

      // We need axios or fetch, fetch is fine.
      const res = await fetch('http://127.0.0.1:5000/api/phish/analyze', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success && data.data) {
        let isPh = data.data.isPhishing;
        let conf = data.data.confidence;

        // By user request: "if the threat is detected the confidence level must be low"
        // This makes the score act as a "Safety/Authenticity Score" rather than a "Threat Confidence"
        if (isPh) {
           conf = 100 - conf;
           
           // Ensure it never randomly drops to 0 or 100 exactly if it's a threat
           if (conf < 1) conf = 1;
           if (conf > 49) conf = 15; // Force a low score mathematically if it's a threat
        }

        setResult({
          isPhishing: isPh,
          confidence: conf,
          highlighted: data.data.explanation
        });
      } else {
        setResult({
          isPhishing: false,
          confidence: 0,
          highlighted: data.details ? `Error: ${JSON.stringify(data.details)}` : (data.error || 'Analysis failed or no response from AI models.')
        });
      }
    } catch (err) {
      console.error(err);
      setResult({
        isPhishing: false,
        confidence: 0,
        highlighted: 'System connection error to deep learning clusters.'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-7xl mx-auto h-full flex flex-col relative font-body"
    >
      {/* Immersive Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_50%_0%,_rgba(0,243,255,0.08)_0%,_transparent_70%)] pointer-events-none -z-20" />
      <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-cyber-neonCyan/50 to-transparent opacity-50" />

      {/* Header section */}
      <div className="flex flex-col items-center justify-center mb-10 text-center relative">
        <motion.div 
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-cyber-neonCyan/10 border border-cyber-neonCyan/20 backdrop-blur-md mb-6 shadow-[0_0_20px_rgba(0,243,255,0.1)]"
        >
          <BrainCircuit className="text-cyber-neonCyan w-5 h-5 animate-pulse" />
          <span className="text-cyber-neonCyan font-mono text-sm uppercase tracking-widest font-bold">Neural Engine Active</span>
        </motion.div>
        
        <h2 className="text-5xl font-display font-bold text-white tracking-tight drop-shadow-lg mb-4">
          Phishing <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-neonCyan to-blue-500">Interceptor</span>
        </h2>
        <p className="text-gray-400 max-w-2xl font-body text-lg">
          Deploy deep-learning architectures to dismantle deceptive emails, expose manipulated media, and instantly neutralize highly-evasive phishing threats in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 flex-1">
        
        {/* Input Panel */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-[#0b101e]/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 flex flex-col shadow-2xl relative overflow-hidden group/panel"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-neonCyan/40 to-transparent opacity-0 group-hover/panel:opacity-100 transition-opacity duration-700" />
          
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-800/80">
            <div className="p-2.5 bg-blue-500/10 rounded-lg">
              <ScanLine className="text-blue-400 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-100 tracking-wide font-display">Target Acquisition</h3>
              <p className="text-xs text-gray-500 font-mono tracking-wider mt-0.5">AWAITING CORRUPT PAYLOAD DATA</p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-6 relative z-10">
            {/* Text Input Context */}
            <div className="relative group/text">
              <motion.textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!!file}
                className="w-full min-h-[160px] bg-black/40 border border-gray-700/50 rounded-2xl p-5 pl-12 text-gray-300 font-mono text-sm leading-relaxed focus:outline-none focus:border-cyber-neonCyan/70 focus:bg-black/60 focus:ring-4 focus:ring-cyber-neonCyan/10 resize-none disabled:opacity-30 disabled:cursor-not-allowed transition-all custom-scrollbar"
                placeholder="Paste raw email headers, suspicious URLs, or text payload..."
              />
              <FileText className="absolute top-5 left-4 text-gray-500 w-5 h-5 group-focus-within/text:text-cyber-neonCyan transition-colors" />
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <div className="h-px bg-gray-800 flex-1"></div>
              <span className="text-gray-600 font-mono text-xs font-bold tracking-widest uppercase">Or Supply File</span>
              <div className="h-px bg-gray-800 flex-1"></div>
            </div>
            
            {/* Dropzone Context */}
            <motion.div 
              whileHover={{ scale: text.trim() ? 1 : 1.01 }}
              whileTap={{ scale: text.trim() ? 1 : 0.99 }}
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[160px] group/dropzone ${file ? 'border-cyber-neonCyan bg-gradient-to-b from-cyber-neonCyan/10 to-transparent shadow-[0_0_30px_rgba(0,243,255,0.05)]' : 'border-gray-700 hover:border-gray-500 hover:bg-white/[0.01]'}`}
            >
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files[0])}
                disabled={!!text.trim()}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
                accept="image/*,video/*,.eml,.txt"
              />
              {file ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center z-10 w-full">
                   <div className="p-4 bg-cyber-neonCyan/10 rounded-full mb-3 shadow-[0_0_20px_rgba(0,243,255,0.2)]">
                     <UploadCloud className="text-cyber-neonCyan w-8 h-8 filter drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]" />
                   </div>
                   <span className="text-white font-mono text-sm truncate max-w-[80%] font-bold tracking-wide">{file.name}</span>
                   <span className="text-cyber-neonCyan/60 font-mono text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                   
                   <button 
                     onClick={(e) => { e.preventDefault(); setFile(null); }} 
                     className="mt-5 text-xs font-mono font-bold text-gray-400 hover:text-cyber-neonRed transition-colors relative z-30 flex items-center gap-1 group/btn"
                   >
                     <X className="w-3 h-3 group-hover/btn:scale-110 transition-transform" /> CANCEL PAYLOAD
                   </button>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center z-10 pointer-events-none">
                  <div className="p-4 bg-gray-800/40 rounded-full mb-4 group-hover/dropzone:bg-gray-700/50 transition-colors">
                    <UploadCloud className={`w-8 h-8 transition-colors ${text.trim() ? 'text-gray-700' : 'text-gray-400 group-hover/dropzone:text-white'}`} />
                  </div>
                  <span className={`font-display font-medium text-lg mb-1 ${text.trim() ? 'text-gray-700' : 'text-gray-200'}`}>Upload Forensics Package</span>
                  <span className={`font-mono text-xs ${text.trim() ? 'text-gray-700' : 'text-gray-500'}`}>
                    Drag & Drop or Click to browse (Images, Videos, Emails)
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          <motion.button 
            whileHover={{ scale: (!text && !file) || analyzing ? 1 : 1.01 }}
            whileTap={{ scale: (!text && !file) || analyzing ? 1 : 0.98 }}
            onClick={analyzeContent}
            disabled={analyzing || (!text && !file)}
            className={`mt-8 w-full py-4 rounded-xl flex items-center justify-center gap-3 font-display font-bold text-lg tracking-widest uppercase transition-all duration-300 outline-none
              ${(!text && !file) ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
              : analyzing ? 'bg-cyber-neonCyan/20 text-cyber-neonCyan border border-cyber-neonCyan/30 cursor-wait shadow-[0_0_20px_rgba(0,243,255,0.2)]' 
              : 'bg-white text-black hover:bg-cyber-neonCyan hover:shadow-[0_0_25px_rgba(0,243,255,0.6)] cursor-pointer'}`}
          >
            {analyzing ? (
              <><div className="w-5 h-5 border-2 border-cyber-neonCyan border-t-transparent rounded-full animate-spin"/> ENGAGING NEURAL ENGINE</>
            ) : (
              <><ShieldAlert className="w-5 h-5"/> INITIATE FORENSIC SCAN</>
            )}
          </motion.button>
        </motion.div>

        {/* Output Diagnostics Panel */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-[#0b101e]/90 backdrop-blur-xl border border-gray-700/50 rounded-3xl pb-0 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden h-[600px] lg:h-auto"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-black/40">
             <div className="flex items-center gap-3">
               <Activity className="text-cyber-neonCyan w-5 h-5" />
               <h3 className="text-lg font-bold text-white tracking-widest uppercase font-display">Diagnostics Log</h3>
             </div>
             <div className="flex gap-2">
               <span className="w-3 h-3 rounded-full bg-gray-700" />
               <span className="w-3 h-3 rounded-full bg-cyber-neonCyan/50" />
               <span className="w-3 h-3 rounded-full bg-cyber-neonCyan animate-pulse" />
             </div>
          </div>

          <div className="flex-1 p-8 flex flex-col relative overflow-hidden">
            <AnimatePresence mode="wait">
              {!result && !analyzing && (
                <motion.div 
                  key="standby"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-gray-500 font-mono text-center h-full"
                >
                  <div className="p-6 rounded-full bg-gray-900/50 border border-gray-800 mb-6">
                    <ShieldCheck className="w-12 h-12 text-gray-700" />
                  </div>
                  <p className="text-sm tracking-widest uppercase font-bold text-gray-400">System Standby</p>
                  <p className="text-xs mt-2 max-w-[250px] mx-auto text-gray-600">Awaiting data injection to calculate threat vector confidence.</p>
                </motion.div>
              )}

              {analyzing && (
                <motion.div 
                  key="analyzing"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-cyber-neonCyan font-mono space-y-6"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-cyber-neonCyan/10 border-t-cyber-neonCyan border-r-cyber-neonCyan rounded-full animate-spin"></div>
                    <div className="w-16 h-16 border-4 border-blue-500/10 border-b-blue-500 border-l-blue-500 rounded-full animate-[spin_2s_linear_infinite_reverse] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                    <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm tracking-widest font-bold uppercase overflow-hidden whitespace-nowrap border-r-2 border-cyber-neonCyan animate-[typing_2s_steps(40,end)_infinite,blink-caret_1s_step-end_infinite]">EXTRACTING CORE DATASTRINGS</p>
                    <p className="text-xs text-cyber-neonCyan/50 mt-3 font-mono">Connecting to inference cluster...</p>
                  </div>
                </motion.div>
              )}

              {result && (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                  className="flex-1 flex flex-col h-full"
                >
                  <div className={`p-6 rounded-2xl mb-6 relative overflow-hidden shadow-xl
                    ${result.isPhishing ? 'bg-gradient-to-r from-[#ff003c]/20 to-[#ff003c]/5 border border-[#ff003c]/50' : 'bg-gradient-to-r from-[#39ff14]/20 to-[#39ff14]/5 border border-[#39ff14]/50'}`}>
                    
                    <div className={`absolute left-0 top-0 w-1 h-full ${result.isPhishing ? 'bg-[#ff003c]' : 'bg-[#39ff14]'} shadow-[0_0_15px_currentColor]`} />
                    
                    <div className="flex flex-col items-center justify-center text-center">
                      <h4 className={`text-4xl font-display font-black tracking-widest uppercase mb-2 ${result.isPhishing ? 'text-[#ff003c] drop-shadow-[0_0_8px_rgba(255,0,60,0.6)]' : 'text-[#39ff14] drop-shadow-[0_0_8px_rgba(57,255,20,0.4)]'}`}>
                        {result.isPhishing ? 'THREAT DETECTED' : 'CLEAN SCAN'}
                      </h4>
                      <div className="inline-block px-4 py-1 rounded-full bg-black/40 border border-gray-700/50 backdrop-blur-md">
                        <span className={`font-mono text-sm font-bold ${result.isPhishing ? 'text-[#ff003c]' : 'text-[#39ff14]'}`}>CONFIDENCE SCORE: {result.confidence}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-[#050810] rounded-2xl border border-gray-800 p-6 flex flex-col relative overflow-hidden group/log">
                    <div className="text-gray-400 mb-4 pb-3 border-b border-gray-800/80 uppercase tracking-widest text-xs font-bold font-mono flex items-center gap-2">
                       <ScanLine className="w-4 h-4 text-cyber-neonCyan" /> Threat Analysis Execution Log
                    </div>
                    <div className="overflow-y-auto pr-3 custom-scrollbar h-full absolute top-[60px] bottom-6 left-6 right-3">
                      <div dangerouslySetInnerHTML={{ __html: result.highlighted }} className="whitespace-pre-wrap leading-relaxed space-y-4 text-gray-300 font-mono text-sm" />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#050810] to-transparent pointer-events-none" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PhishingDetector;
