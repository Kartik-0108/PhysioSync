import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export default function KneeBendReference() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  const DURATION = 16; // Total loop duration in seconds

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
  let leftKneeAngle = 180;
  let rightKneeAngle = 180;
  let text = "";
  let activeLeg: 'left' | 'right' | 'none' = 'none';

  if (time < 1) {
    text = "Stand straight";
    activeLeg = 'none';
  } else if (time < 4) {
    // Bend Right (1 to 4s)
    const p = (time - 1) / 3;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    rightKneeAngle = 180 - (ease * 90); // Bend to 90 degrees
    text = "Bend right knee";
    activeLeg = 'right';
  } else if (time < 6) {
    // Hold Right (4 to 6s)
    rightKneeAngle = 90;
    text = "Hold";
    activeLeg = 'right';
  } else if (time < 9) {
    // Return Right (6 to 9s)
    const p = (time - 6) / 3;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    rightKneeAngle = 90 + (ease * 90);
    text = "Return";
    activeLeg = 'right';
  } else if (time < 10) {
    text = "Stand straight";
    activeLeg = 'none';
  } else if (time < 13) {
    // Bend Left (10 to 13s)
    const p = (time - 10) / 3;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    leftKneeAngle = 180 - (ease * 90);
    text = "Bend left knee";
    activeLeg = 'left';
  } else if (time < 15) {
    // Hold Left (13 to 15s)
    leftKneeAngle = 90;
    text = "Hold";
    activeLeg = 'left';
  } else {
    // Return Left (15 to 16s)
    const p = (time - 15) / 1; // Faster return
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    leftKneeAngle = 90 + (ease * 90);
    text = "Return";
    activeLeg = 'left';
  }

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleReplay = () => {
    setTime(0);
    setIsPlaying(true);
  };

  // Helper to calculate coordinates based on angle and bone length
  const getLegCoords = (hipX: number, hipY: number, angleDeg: number, thighLen: number, calfLen: number) => {
    // Thigh is always straight down in standing knee bends
    const kneeX = hipX;
    const kneeY = hipY + thighLen;
    // Calf rotates around knee
    const rad = (angleDeg - 90) * (Math.PI / 180);
    const ankleX = kneeX + Math.cos(rad) * calfLen;
    const ankleY = kneeY + Math.sin(rad) * calfLen;
    return { kneeX, kneeY, ankleX, ankleY };
  };

  const thighLen = 50;
  const calfLen = 50;
  
  const rightLeg = getLegCoords(80, 100, rightKneeAngle, thighLen, calfLen);
  const leftLeg = getLegCoords(120, 100, leftKneeAngle, thighLen, calfLen);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-4 overflow-hidden relative group">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900"></div>
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-full shadow-xl">
          <motion.div 
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-slate-300 text-xs font-medium uppercase tracking-wider">Reference Motion</span>
        </div>
        <div className="bg-slate-800/90 backdrop-blur-md border border-emerald-500/30 px-6 py-3 rounded-2xl shadow-2xl mt-2 text-center min-w-[280px]">
          <p className="text-emerald-400 font-medium text-lg">{text}</p>
        </div>
      </div>

      <div className="relative w-full max-w-md aspect-square z-10 flex items-center justify-center mt-12">
        <svg viewBox="0 0 200 250" className="w-full h-full drop-shadow-2xl overflow-visible">
          <defs>
            <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrowUp" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
            </marker>
            
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
          </defs>

          {/* Floor */}
          <ellipse cx="100" cy="210" rx="70" ry="10" fill="#1e293b" />

          {/* Motion Paths */}
          {/* Right Leg Path */}
          <path 
            d="M 80 200 Q 60 170 80 150" 
            fill="none" 
            stroke={activeLeg === 'right' ? "#34d399" : "#334155"} 
            strokeWidth="3" 
            strokeDasharray="6 6" 
            markerEnd={activeLeg === 'right' ? "url(#arrowUp)" : ""}
            opacity={activeLeg === 'right' ? 0.8 : 0.3}
            className="transition-all duration-500"
          />
          {/* Left Leg Path */}
          <path 
            d="M 120 200 Q 140 170 120 150" 
            fill="none" 
            stroke={activeLeg === 'left' ? "#34d399" : "#334155"} 
            strokeWidth="3" 
            strokeDasharray="6 6" 
            markerEnd={activeLeg === 'left' ? "url(#arrowUp)" : ""}
            opacity={activeLeg === 'left' ? 0.8 : 0.3}
            className="transition-all duration-500"
          />

          {/* Body */}
          <g>
            {/* Head */}
            <circle cx="100" cy="40" r="20" fill="url(#bodyGradient)" />
            {/* Torso */}
            <rect x="80" y="60" width="40" height="50" rx="10" fill="url(#bodyGradient)" />
            {/* Shoulders/Arms */}
            <path d="M 70 70 L 60 120 M 130 70 L 140 120" stroke="url(#bodyGradient)" strokeWidth="12" strokeLinecap="round" />
            
            {/* Right Leg (Back) */}
            <g opacity={activeLeg === 'left' ? 0.5 : 1}>
              <line x1="80" y1="100" x2={rightLeg.kneeX} y2={rightLeg.kneeY} stroke={activeLeg === 'right' ? "#34d399" : "url(#bodyGradient)"} strokeWidth="16" strokeLinecap="round" filter={activeLeg === 'right' ? "url(#activeGlow)" : ""} />
              <line x1={rightLeg.kneeX} y1={rightLeg.kneeY} x2={rightLeg.ankleX} y2={rightLeg.ankleY} stroke={activeLeg === 'right' ? "#34d399" : "url(#bodyGradient)"} strokeWidth="14" strokeLinecap="round" filter={activeLeg === 'right' ? "url(#activeGlow)" : ""} />
              <circle cx={rightLeg.kneeX} cy={rightLeg.kneeY} r="6" fill={activeLeg === 'right' ? "#fff" : "#64748b"} />
              <circle cx={rightLeg.ankleX} cy={rightLeg.ankleY} r="5" fill={activeLeg === 'right' ? "#fff" : "#64748b"} />
            </g>

            {/* Left Leg (Front) */}
            <g opacity={activeLeg === 'right' ? 0.5 : 1}>
              <line x1="120" y1="100" x2={leftLeg.kneeX} y2={leftLeg.kneeY} stroke={activeLeg === 'left' ? "#34d399" : "url(#bodyGradient)"} strokeWidth="16" strokeLinecap="round" filter={activeLeg === 'left' ? "url(#activeGlow)" : ""} />
              <line x1={leftLeg.kneeX} y1={leftLeg.kneeY} x2={leftLeg.ankleX} y2={leftLeg.ankleY} stroke={activeLeg === 'left' ? "#34d399" : "url(#bodyGradient)"} strokeWidth="14" strokeLinecap="round" filter={activeLeg === 'left' ? "url(#activeGlow)" : ""} />
              <circle cx={leftLeg.kneeX} cy={leftLeg.kneeY} r="6" fill={activeLeg === 'left' ? "#fff" : "#64748b"} />
              <circle cx={leftLeg.ankleX} cy={leftLeg.ankleY} r="5" fill={activeLeg === 'left' ? "#fff" : "#64748b"} />
            </g>
          </g>
        </svg>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-800/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-2xl z-20">
        <button 
          onClick={togglePlay}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors text-emerald-400"
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
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
        <div 
          className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
          style={{ width: `${(time / DURATION) * 100}%` }}
        />
      </div>
    </div>
  );
}
