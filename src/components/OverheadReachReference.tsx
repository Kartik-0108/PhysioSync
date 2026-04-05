import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export default function OverheadReachReference() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  const DURATION = 6; // Total loop duration (1s down, 2s up, 1s hold, 2s down)

  const animate = (timeNow: number) => {
    if (previousTimeRef.current != undefined && isPlaying) {
      const deltaTime = (timeNow - previousTimeRef.current) / 1000;
      setTime((prevTime) => {
        let newTime = prevTime + deltaTime;
        if (newTime >= DURATION) newTime = 0;
        return newTime;
      });
    }
    previousTimeRef.current = timeNow;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = performance.now();
    }
  }, [isPlaying]);

  // Calculate positions and text based on time
  let armAngle = 0; // 0 is down, 180 is overhead
  let text = "";
  let state: 'down' | 'raising' | 'top_position' | 'lowering' = 'down';

  if (time < 1) {
    // Down (0 to 1s)
    armAngle = 0;
    text = "Starting Position";
    state = 'down';
  } else if (time < 3) {
    // Raising (1 to 3s)
    const p = (time - 1) / 2;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    armAngle = ease * 180;
    text = "Raise arms slowly";
    state = 'raising';
  } else if (time < 4) {
    // Top Position (3 to 4s)
    armAngle = 180;
    text = "Reach & Hold";
    state = 'top_position';
  } else {
    // Lowering (4 to 6s)
    const p = (time - 4) / 2;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    armAngle = 180 - (ease * 180);
    text = "Lower arms slowly";
    state = 'lowering';
  }

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleReplay = () => {
    setTime(0);
    setIsPlaying(true);
  };

  // Helper to calculate coordinates
  const getArmCoords = (shoulderX: number, shoulderY: number, angleDeg: number, length: number) => {
    // angleDeg 0 is down, 180 is up
    const rad = (angleDeg + 90) * (Math.PI / 180);
    const x = shoulderX + Math.cos(rad) * length;
    const y = shoulderY + Math.sin(rad) * length;
    return { x, y };
  };

  const armLength = 70;
  const rightArm = getArmCoords(80, 80, -armAngle, armLength);
  const leftArm = getArmCoords(120, 80, armAngle, armLength);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-4 overflow-hidden relative group">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900"></div>
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-full shadow-xl">
          <motion.div 
            className={`w-2 h-2 rounded-full ${state === 'top_position' ? 'bg-emerald-500' : 'bg-blue-500'}`}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-slate-300 text-xs font-medium uppercase tracking-wider">Reference Motion</span>
        </div>
        <div className={`bg-slate-800/90 backdrop-blur-md border ${state === 'top_position' ? 'border-emerald-500/50' : 'border-blue-500/30'} px-6 py-3 rounded-2xl shadow-2xl mt-2 text-center min-w-[280px] transition-colors duration-300`}>
          <p className={`${state === 'top_position' ? 'text-emerald-400' : 'text-blue-400'} font-black text-lg uppercase tracking-tight`}>{text}</p>
          <div className="flex justify-center gap-1 mt-1">
            {['down', 'raising', 'top_position', 'lowering'].map((s) => (
              <div 
                key={s} 
                className={`h-1 w-8 rounded-full transition-all duration-300 ${state === s ? (s === 'top_position' ? 'bg-emerald-500 w-12' : 'bg-blue-500 w-12') : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md aspect-square z-10 flex items-center justify-center mt-12">
        <svg viewBox="0 0 200 250" className="w-full h-full drop-shadow-2xl overflow-visible">
          <defs>
            <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>

            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Floor Shadow */}
          <ellipse cx="100" cy="230" rx="70" ry="10" fill="#000" opacity="0.3" filter="url(#shadow)" />

          {/* Motion Paths (Arcs) */}
          <path 
            d="M 40 150 A 70 70 0 0 1 40 10" 
            fill="none" 
            stroke="#334155" 
            strokeWidth="2" 
            strokeDasharray="4 4" 
            opacity="0.3"
          />
          <path 
            d="M 160 150 A 70 70 0 0 0 160 10" 
            fill="none" 
            stroke="#334155" 
            strokeWidth="2" 
            strokeDasharray="4 4" 
            opacity="0.3"
          />

          {/* Body */}
          <g>
            {/* Head */}
            <circle cx="100" cy="40" r="18" fill="url(#bodyGradient)" />
            {/* Torso */}
            <rect x="85" y="60" width="30" height="70" rx="8" fill="url(#bodyGradient)" />
            
            {/* Legs */}
            <path d="M 90 130 L 85 220 M 110 130 L 115 220" stroke="url(#bodyGradient)" strokeWidth="12" strokeLinecap="round" />

            {/* Right Arm */}
            <g>
              <line 
                x1="85" y1="80" 
                x2={rightArm.x} y2={rightArm.y} 
                stroke={state === 'top_position' ? "#10b981" : "#60a5fa"} 
                strokeWidth="14" 
                strokeLinecap="round" 
                filter="url(#activeGlow)"
                className="transition-colors duration-300"
              />
              <circle cx={rightArm.x} cy={rightArm.y} r="6" fill="#fff" />
              <circle cx="85" cy="80" r="4" fill="#334155" />
            </g>

            {/* Left Arm */}
            <g>
              <line 
                x1="115" y1="80" 
                x2={leftArm.x} y2={leftArm.y} 
                stroke={state === 'top_position' ? "#10b981" : "#60a5fa"} 
                strokeWidth="14" 
                strokeLinecap="round" 
                filter="url(#activeGlow)"
                className="transition-colors duration-300"
              />
              <circle cx={leftArm.x} cy={leftArm.y} r="6" fill="#fff" />
              <circle cx="115" cy="80" r="4" fill="#334155" />
            </g>
          </g>
        </svg>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-800/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-2xl z-20">
        <button 
          onClick={togglePlay}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors text-blue-400"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
        </button>
        <div className="w-px h-6 bg-slate-700" />
        <button 
          onClick={handleReplay}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
          title="Replay"
        >
          <RotateCcw size={24} />
        </button>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
        <div 
          className={`h-full transition-all duration-100 ease-linear ${state === 'top_position' ? 'bg-emerald-500' : 'bg-blue-500'}`}
          style={{ width: `${(time / DURATION) * 100}%` }}
        />
      </div>
    </div>
  );
}
