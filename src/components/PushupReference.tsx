import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle2, Info, FastForward, Target, Activity } from 'lucide-react';

export default function PushupReference() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showMistakes, setShowMistakes] = useState(false);
  const [phase, setPhase] = useState<'start' | 'lowering' | 'bottom' | 'pushing'>('start');
  const [key, setKey] = useState(0);

  // Animation timing
  const T_DOWN = 2000;
  const T_HOLD = 1000;
  const T_UP = 2000;
  const T_PAUSE = 500;

  useEffect(() => {
    if (!isPlaying) return;

    let timeout: NodeJS.Timeout;

    const runSequence = () => {
      setPhase('lowering');
      timeout = setTimeout(() => {
        setPhase('bottom');
        timeout = setTimeout(() => {
          setPhase('pushing');
          timeout = setTimeout(() => {
            setPhase('start');
            timeout = setTimeout(runSequence, T_PAUSE / playbackSpeed);
          }, T_UP / playbackSpeed);
        }, T_HOLD / playbackSpeed);
      }, T_DOWN / playbackSpeed);
    };

    // Start sequence after a brief pause
    timeout = setTimeout(runSequence, T_PAUSE / playbackSpeed);

    return () => clearTimeout(timeout);
  }, [isPlaying, playbackSpeed, key]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleReplay = () => {
    setKey(prev => prev + 1);
    setIsPlaying(true);
    setPhase('start');
  };
  const toggleSpeed = () => setPlaybackSpeed(prev => prev === 1 ? 0.5 : 1);

  // Colors
  const bodyColor = "#94a3b8"; // slate-400
  const activeColor = "#34d399"; // emerald-400
  const mistakeColor = "#ef4444"; // red-500
  const glowColor = "rgba(52, 211, 153, 0.5)";
  const mistakeGlowColor = "rgba(239, 68, 68, 0.5)";

  // Paths
  const getPaths = () => {
    if (showMistakes) {
      return {
        leg: {
          start: "M 50 230 L 150 150",
          lowering: "M 50 230 L 150 220", // Sagging hips
          bottom: "M 50 230 L 150 220",
          pushing: "M 50 230 L 150 150",
        },
        torso: {
          start: "M 150 150 L 230 90",
          lowering: "M 150 220 L 230 170",
          bottom: "M 150 220 L 230 170",
          pushing: "M 150 150 L 230 90",
        },
        arm: {
          start: "M 230 90 L 230 160 L 230 230",
          lowering: "M 230 170 L 180 170 L 230 230",
          bottom: "M 230 170 L 180 170 L 230 230",
          pushing: "M 230 90 L 230 160 L 230 230",
        },
        head: {
          start: { cx: 265, cy: 65 },
          lowering: { cx: 265, cy: 155 },
          bottom: { cx: 265, cy: 155 },
          pushing: { cx: 265, cy: 65 },
        }
      };
    }

    return {
      leg: {
        start: "M 50 230 L 150 150",
        lowering: "M 50 230 L 150 195",
        bottom: "M 50 230 L 150 195",
        pushing: "M 50 230 L 150 150",
      },
      torso: {
        start: "M 150 150 L 230 90",
        lowering: "M 150 195 L 230 170",
        bottom: "M 150 195 L 230 170",
        pushing: "M 150 150 L 230 90",
      },
      arm: {
        start: "M 230 90 L 230 160 L 230 230",
        lowering: "M 230 170 L 180 170 L 230 230",
        bottom: "M 230 170 L 180 170 L 230 230",
        pushing: "M 230 90 L 230 160 L 230 230",
      },
      head: {
        start: { cx: 265, cy: 65 },
        lowering: { cx: 265, cy: 155 },
        bottom: { cx: 265, cy: 155 },
        pushing: { cx: 265, cy: 65 },
      }
    };
  };

  const paths = getPaths();
  const currentColor = showMistakes && (phase === 'lowering' || phase === 'bottom') ? mistakeColor : activeColor;
  const currentGlow = showMistakes && (phase === 'lowering' || phase === 'bottom') ? "url(#mistakeGlow)" : "url(#activeGlow)";

  const getPhaseText = () => {
    if (showMistakes) {
      if (phase === 'lowering' || phase === 'bottom') return "❌ Hips Sagging (Incorrect)";
      return "Start Position";
    }
    switch (phase) {
      case 'start': return "Start: Body Straight";
      case 'lowering': return "Lower Slowly (2s)";
      case 'bottom': return "Hold: Chest Near Floor";
      case 'pushing': return "Push Up Powerfully";
    }
  };

  const getPhaseInstruction = () => {
    if (showMistakes) {
      if (phase === 'lowering' || phase === 'bottom') return "Do not let your hips drop. Keep your core tight.";
      return "Maintain a straight line from head to heels.";
    }
    switch (phase) {
      case 'start': return "Hands under shoulders. Core engaged.";
      case 'lowering': return "Keep elbows tucked. Body moves as one unit.";
      case 'bottom': return "Go low enough to activate chest fully.";
      case 'pushing': return "Exhale and press back to start.";
    }
  };

  const transitionConfig = {
    duration: phase === 'lowering' ? T_DOWN / 1000 / playbackSpeed : 
              phase === 'pushing' ? T_UP / 1000 / playbackSpeed : 
              0.3 / playbackSpeed,
    ease: "easeInOut" as const
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 overflow-hidden relative font-sans">
      {/* Premium Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900"></div>
      
      {/* Top Status Bar */}
      <div className="absolute top-4 left-0 right-0 z-20 flex justify-between items-start px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-full shadow-xl">
            <motion.div 
              className={`w-2.5 h-2.5 rounded-full ${showMistakes ? 'bg-red-500' : 'bg-emerald-500'}`}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-slate-200 text-sm font-bold tracking-wide">{getPhaseText()}</span>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={phase + (showMistakes ? 'm' : 'c')}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 px-4 py-2 rounded-lg max-w-xs shadow-lg"
            >
              <p className="text-slate-300 text-xs leading-relaxed">
                {getPhaseInstruction()}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 items-end">
          <button
            onClick={() => setShowMistakes(!showMistakes)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              showMistakes 
                ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle size={14} />
            {showMistakes ? "Showing Mistakes" : "Show Mistakes"}
          </button>
          
          <button
            onClick={toggleSpeed}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              playbackSpeed === 0.5 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <FastForward size={14} />
            {playbackSpeed === 0.5 ? "Slow Motion" : "Normal Speed"}
          </button>
        </div>
      </div>

      {/* Main Animation Area */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 320 300" className="w-full h-full max-h-full z-10 drop-shadow-2xl">
          <defs>
            <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="mistakeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrowDown" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={currentColor} opacity="0.8" />
            </marker>
            <marker id="arrowUp" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={currentColor} opacity="0.8" />
            </marker>
            
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            
            <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={showMistakes ? "#f87171" : "#6ee7b7"} />
              <stop offset="100%" stopColor={showMistakes ? "#ef4444" : "#34d399"} />
            </linearGradient>
          </defs>

          <g>
            {/* Floor */}
            <line x1="20" y1="240" x2="300" y2="240" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="160" cy="240" rx="120" ry="6" fill="#1e293b" opacity="0.6" />
            
            {/* Target Depth Line */}
            <g opacity={phase === 'bottom' || phase === 'lowering' ? 1 : 0.3} className="transition-opacity duration-500">
              <line x1="200" y1="180" x2="280" y2="180" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
              <text x="285" y="184" fill="#3b82f6" fontSize="10" fontWeight="bold">TARGET DEPTH</text>
            </g>

            {/* Alignment Line (Shoulder to Ankle) */}
            <motion.line
              x1="50" y1="230"
              animate={{
                x2: paths.torso[phase].split(' ')[4],
                y2: paths.torso[phase].split(' ')[5]
              }}
              transition={transitionConfig}
              stroke={currentColor}
              strokeWidth="2"
              strokeDasharray="6 6"
              opacity={0.4}
            />

            {/* Motion Arrows */}
            <AnimatePresence>
              {phase === 'lowering' && (
                <motion.path
                  initial={{ opacity: 0, pathLength: 0 }}
                  animate={{ opacity: 0.6, pathLength: 1 }}
                  exit={{ opacity: 0 }}
                  d="M 150 100 L 150 160"
                  fill="none"
                  stroke={currentColor}
                  strokeWidth="3"
                  markerEnd="url(#arrowDown)"
                />
              )}
              {phase === 'pushing' && (
                <motion.path
                  initial={{ opacity: 0, pathLength: 0 }}
                  animate={{ opacity: 0.6, pathLength: 1 }}
                  exit={{ opacity: 0 }}
                  d="M 150 160 L 150 100"
                  fill="none"
                  stroke={currentColor}
                  strokeWidth="3"
                  markerEnd="url(#arrowUp)"
                />
              )}
            </AnimatePresence>

            {/* Character Body */}
            <motion.g>
              {/* Legs */}
              <motion.path
                animate={{ d: paths.leg[phase] }}
                transition={transitionConfig}
                stroke="url(#bodyGradient)"
                strokeWidth="18"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              
              {/* Torso (Core) - Highlighted to show engagement */}
              <motion.path
                animate={{ d: paths.torso[phase] }}
                transition={transitionConfig}
                stroke={phase !== 'start' ? "url(#activeGradient)" : "url(#bodyGradient)"}
                strokeWidth="22"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter={phase !== 'start' ? currentGlow : ""}
              />
              
              {/* Arms - Highlighted */}
              <motion.path
                animate={{ d: paths.arm[phase] }}
                transition={transitionConfig}
                stroke="url(#activeGradient)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter={currentGlow}
              />
              
              {/* Head */}
              <motion.circle
                animate={{ 
                  cx: paths.head[phase].cx, 
                  cy: paths.head[phase].cy 
                }}
                transition={transitionConfig}
                r="16"
                fill="url(#bodyGradient)"
              />

              {/* Joint Highlights */}
              <motion.circle
                animate={{
                  cx: paths.arm[phase].split(' ')[4],
                  cy: paths.arm[phase].split(' ')[5]
                }}
                transition={transitionConfig}
                r="6"
                fill="#ffffff"
                opacity="0.8"
              />
              <motion.circle
                animate={{
                  cx: paths.torso[phase].split(' ')[4],
                  cy: paths.torso[phase].split(' ')[5]
                }}
                transition={transitionConfig}
                r="6"
                fill="#ffffff"
                opacity="0.8"
              />
            </motion.g>
          </g>
        </svg>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-800/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-2xl z-20">
        <button 
          onClick={handleReplay}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
          title="Replay"
        >
          <RotateCcw size={20} />
        </button>
        <div className="w-px h-6 bg-slate-700" />
        <button 
          onClick={togglePlay}
          className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-full transition-colors shadow-lg shadow-emerald-500/20"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </button>
      </div>
    </div>
  );
}
