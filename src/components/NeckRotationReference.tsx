import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export default function NeckRotationReference() {
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

  // Reset previous time when play state changes so we don't jump
  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = performance.now();
    }
  }, [isPlaying]);

  // Calculate rotation and text based on time
  let rotation = 0;
  let text = "";
  let direction: 'center' | 'right' | 'left' = 'center';

  if (time < 1) {
    rotation = 0;
    text = "Start in a neutral position";
    direction = 'center';
  } else if (time < 4) {
    // Turn Right (1 to 4s)
    const p = (time - 1) / 3;
    // Ease in out sine
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    rotation = ease * 80;
    text = "Slowly turn your head to the right";
    direction = 'right';
  } else if (time < 6) {
    // Hold Right (4 to 6s)
    rotation = 80;
    text = "Hold and feel the stretch";
    direction = 'right';
  } else if (time < 9) {
    // Return Center (6 to 9s)
    const p = (time - 6) / 3;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    rotation = 80 - (ease * 80);
    text = "Return to center";
    direction = 'center';
  } else if (time < 10) {
    rotation = 0;
    text = "Pause";
    direction = 'center';
  } else if (time < 13) {
    // Turn Left (10 to 13s)
    const p = (time - 10) / 3;
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    rotation = -(ease * 80);
    text = "Slowly turn your head to the left";
    direction = 'left';
  } else if (time < 15) {
    // Hold Left (13 to 15s)
    rotation = -80;
    text = "Hold and feel the stretch";
    direction = 'left';
  } else {
    // Return Center (15 to 16s)
    const p = (time - 15) / 1; // Faster return
    const ease = -(Math.cos(Math.PI * p) - 1) / 2;
    rotation = -80 - (ease * -80);
    text = "Return to center";
    direction = 'center';
  }

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleReplay = () => {
    setTime(0);
    setIsPlaying(true);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-4 overflow-hidden relative group">
      {/* Premium Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900"></div>
      
      {/* Phase Indicator */}
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
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl overflow-visible">
          <defs>
            <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrowRight" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
            </marker>
            <marker id="arrowLeft" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
            </marker>
            
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="headGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {/* Motion Paths */}
          {/* Right Turn Path */}
          <path 
            d="M 100 20 A 50 15 0 0 1 150 20" 
            fill="none" 
            stroke={direction === 'right' ? "#34d399" : "#334155"} 
            strokeWidth="3" 
            strokeDasharray="6 6" 
            markerEnd={direction === 'right' ? "url(#arrowRight)" : ""}
            opacity={direction === 'right' ? 0.8 : 0.3}
            className="transition-all duration-500"
          />
          {/* Left Turn Path */}
          <path 
            d="M 100 20 A 50 15 0 0 0 50 20" 
            fill="none" 
            stroke={direction === 'left' ? "#34d399" : "#334155"} 
            strokeWidth="3" 
            strokeDasharray="6 6" 
            markerEnd={direction === 'left' ? "url(#arrowLeft)" : ""}
            opacity={direction === 'left' ? 0.8 : 0.3}
            className="transition-all duration-500"
          />

          {/* Body (Front View) */}
          <g>
            {/* Shoulders & Torso */}
            <path d="M 40 200 C 40 150, 60 140, 100 140 C 140 140, 160 150, 160 200 Z" fill="url(#bodyGradient)" opacity="0.8" />
            
            {/* Neck */}
            <rect x="85" y="110" width="30" height="40" fill="#cbd5e1" filter="url(#activeGlow)" />
            
            {/* Head Group */}
            <g>
              {/* Head Base */}
              <ellipse cx="100" cy="80" rx="35" ry="45" fill="url(#headGradient)" filter="url(#activeGlow)" />
              
              {/* Facial Features (Shift based on rotation) */}
              <g style={{ transform: `translateX(${rotation * 0.3}px)`, transition: 'transform 0.1s linear' }}>
                {/* Eyes */}
                <ellipse cx="85" cy="75" rx="4" ry="6" fill="#475569" opacity={Math.max(0, 1 - Math.abs(rotation)/100)} />
                <ellipse cx="115" cy="75" rx="4" ry="6" fill="#475569" opacity={Math.max(0, 1 - Math.abs(rotation)/100)} />
                
                {/* Nose */}
                <path d="M 100 75 L 105 90 L 100 92 Z" fill="#94a3b8" />
                
                {/* Mouth */}
                <path d="M 90 105 Q 100 110 110 105" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
              </g>
              
              {/* Ears (Shift opposite to rotation to simulate 3D) */}
              <ellipse cx={65 + rotation * 0.1} cy="85" rx="5" ry="10" fill="#cbd5e1" opacity={rotation > 40 ? 0 : 1} />
              <ellipse cx={135 + rotation * 0.1} cy="85" rx="5" ry="10" fill="#cbd5e1" opacity={rotation < -40 ? 0 : 1} />
            </g>
          </g>
        </svg>
      </div>

      {/* Controls Overlay */}
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
      
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
        <div 
          className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
          style={{ width: `${(time / DURATION) * 100}%` }}
        />
      </div>
    </div>
  );
}
