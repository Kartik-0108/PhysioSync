import { motion } from 'motion/react';

export default function ReferenceAnimation({ type }: { type: string }) {
  // Step-based animation: Start (0%), Movement (50%), End (100%)
  const transition: any = { duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.5, 1] };

  const isSquat = type === 'squat';
  const isArmRaise = type === 'arm_raise';
  const isKneeBend = type === 'knee_bend';
  const isNeckRotation = type === 'neck_rotation';
  const isSpineExtension = type === 'spine_extension';
  const isBicepCurl = type === 'bicep_curl';
  const isPushUp = type === 'push_up';
  const isFullBodyStretch = type === 'full_body_stretch';
  const isLunge = type === 'lunge';

  // Colors
  const bodyColor = "#94a3b8"; // slate-400
  const activeColor = "#34d399"; // emerald-400
  const glowColor = "rgba(52, 211, 153, 0.5)";

  // Determine active joints for glowing effect
  const activeJoints = {
    knees: isSquat || isKneeBend || isLunge,
    hips: isSquat || isSpineExtension || isLunge,
    shoulders: isArmRaise || isFullBodyStretch,
    elbows: isBicepCurl || isPushUp,
    neck: isNeckRotation
  };

  // Spine Extension Specific Sequence
  const spineExtensionSequence = {
    rotate: [0, 15, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, times: [0, 0.5, 1] }
  };

  const neckRotationSequence = {
    rotate: [0, 45, 0, -45, 0],
    transition: { duration: 8, repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1], ease: "easeInOut" as const }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 p-4 overflow-hidden relative">
      {/* Premium Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900"></div>
      
      {/* Phase Indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-full shadow-xl">
        <motion.div 
          className="w-2 h-2 rounded-full bg-emerald-500"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-slate-300 text-xs font-medium uppercase tracking-wider">Reference Motion</span>
      </div>

      <svg viewBox="0 0 200 300" className="w-full h-full max-h-full z-10 drop-shadow-2xl">
        <defs>
          <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <marker id="motionArrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={activeColor} opacity="0.8" />
          </marker>
          
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>

        <g>
          {/* Floor */}
          <ellipse cx="100" cy="280" rx="60" ry="8" fill="#1e293b" />
          
          {/* Motion Paths (Arrows) */}
          {isSquat && (
            <motion.path
              d="M 140 150 Q 160 190 140 230"
              fill="none"
              stroke={activeColor}
              strokeWidth="2"
              strokeDasharray="4 4"
              markerEnd="url(#motionArrow)"
              markerStart="url(#motionArrow)"
              opacity="0.6"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={transition}
            />
          )}
          {isArmRaise && (
            <g>
              <motion.path d="M 40 180 A 60 60 0 0 1 20 80" fill="none" stroke={activeColor} strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#motionArrow)" opacity="0.6" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={transition} />
              <motion.path d="M 160 180 A 60 60 0 0 0 180 80" fill="none" stroke={activeColor} strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#motionArrow)" opacity="0.6" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={transition} />
            </g>
          )}

          {/* Upper Body Group */}
          <motion.g
            animate={isSquat ? { y: [0, 60, 0] } : isSpineExtension ? spineExtensionSequence : { y: 0 }}
            style={{ transformOrigin: "100px 150px" }}
            transition={isSpineExtension ? spineExtensionSequence.transition : transition}
          >
            {/* Head */}
            <motion.g
              animate={isNeckRotation ? neckRotationSequence : {}}
              style={{ transformOrigin: "100px 50px" }}
            >
              <circle cx="100" cy="45" r="18" fill="url(#bodyGradient)" filter={activeJoints.neck ? "url(#activeGlow)" : ""} />
            </motion.g>
            
            {/* Torso */}
            <motion.line 
              x1="100" y1="65" x2="100" y2="140" 
              stroke="url(#bodyGradient)" strokeWidth="24" strokeLinecap="round" 
              animate={isSquat ? { x2: [100, 130, 100], y2: [140, 170, 140] } : {}}
              transition={transition}
            />
            
            {/* Shoulders */}
            <line x1="75" y1="75" x2="125" y2="75" stroke="url(#bodyGradient)" strokeWidth="20" strokeLinecap="round" filter={activeJoints.shoulders ? "url(#activeGlow)" : ""} />
            
            {/* Hips */}
            <motion.line 
              x1="85" y1="140" x2="115" y2="140" 
              stroke="url(#bodyGradient)" strokeWidth="20" strokeLinecap="round" 
              animate={isSquat ? { x1: [85, 115, 85], x2: [115, 145, 115] } : {}}
              transition={transition}
              filter={activeJoints.hips ? "url(#activeGlow)" : ""}
            />
            
            {/* Arms */}
            <motion.path 
              stroke="url(#bodyGradient)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none"
              animate={
                isArmRaise ? { d: ["M 75 75 L 60 120 L 50 170", "M 75 75 L 25 75 L 5 65", "M 75 75 L 60 120 L 50 170"] } 
                : isSquat ? { d: ["M 75 75 L 60 120 L 50 170", "M 75 75 L 40 80 L 10 80", "M 75 75 L 60 120 L 50 170"] } 
                : isBicepCurl ? { d: ["M 75 75 L 60 120 L 50 170", "M 75 75 L 60 120 L 70 90", "M 75 75 L 60 120 L 50 170"] }
                : { d: "M 75 75 L 60 120 L 50 170" }
              }
              transition={transition}
            />
            <motion.path 
              stroke="url(#bodyGradient)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none"
              animate={
                isArmRaise ? { d: ["M 125 75 L 140 120 L 150 170", "M 125 75 L 175 75 L 195 65", "M 125 75 L 140 120 L 150 170"] } 
                : isSquat ? { d: ["M 125 75 L 140 120 L 150 170", "M 125 75 L 160 80 L 190 80", "M 125 75 L 140 120 L 150 170"] } 
                : isBicepCurl ? { d: ["M 125 75 L 140 120 L 150 170", "M 125 75 L 140 120 L 130 90", "M 125 75 L 140 120 L 150 170"] }
                : { d: "M 125 75 L 140 120 L 150 170" }
              }
              transition={transition}
            />
            
            {/* Elbow Highlights */}
            {activeJoints.elbows && (
              <g>
                <motion.circle r="6" fill={activeColor} filter="url(#activeGlow)" animate={isBicepCurl ? { cx: [60, 60, 60], cy: [120, 120, 120] } : { cx: 60, cy: 120 }} transition={transition} />
                <motion.circle r="6" fill={activeColor} filter="url(#activeGlow)" animate={isBicepCurl ? { cx: [140, 140, 140], cy: [120, 120, 120] } : { cx: 140, cy: 120 }} transition={transition} />
              </g>
            )}
          </motion.g>

          {/* Legs */}
          <motion.path
            stroke="url(#bodyGradient)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none"
            animate={
              isSquat 
                ? { d: ["M 85 140 L 80 200 L 75 270", "M 115 170 L 60 220 L 75 270", "M 85 140 L 80 200 L 75 270"] } 
                : isLunge
                ? { d: ["M 85 140 L 80 200 L 75 270", "M 85 180 L 120 200 L 120 270", "M 85 140 L 80 200 L 75 270"] }
                : { d: "M 85 140 L 80 200 L 75 270" }
            }
            transition={transition}
          />
          <motion.path
            stroke="url(#bodyGradient)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none"
            animate={
              isSquat 
                ? { d: ["M 115 140 L 120 200 L 125 270", "M 145 170 L 160 220 L 125 270", "M 115 140 L 120 200 L 125 270"] } 
                : isLunge
                ? { d: ["M 115 140 L 120 200 L 125 270", "M 115 180 L 70 230 L 40 230", "M 115 140 L 120 200 L 125 270"] }
                : { d: "M 115 140 L 120 200 L 125 270" }
            }
            transition={transition}
          />

          {/* Knee Highlights */}
          {activeJoints.knees && (
            <g>
              <motion.circle
                r="7" fill={activeColor} filter="url(#activeGlow)"
                animate={
                  isSquat ? { cx: [80, 60, 80], cy: [200, 220, 200] }
                  : { cx: 80, cy: 200 }
                }
                transition={transition}
              />
              <motion.circle
                r="7" fill={activeColor} filter="url(#activeGlow)"
                animate={
                  isSquat ? { cx: [120, 160, 120], cy: [200, 220, 200] }
                  : { cx: 120, cy: 200 }
                }
                transition={transition}
              />
            </g>
          )}
          
          {/* Feet */}
          <line x1="65" y1="270" x2="85" y2="270" stroke="url(#bodyGradient)" strokeWidth="10" strokeLinecap="round" />
          <line x1="115" y1="270" x2="135" y2="270" stroke="url(#bodyGradient)" strokeWidth="10" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
