import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import ReferenceAnimation from './ReferenceAnimation';
import NeckRotationReference from './NeckRotationReference';
import KneeBendReference from './KneeBendReference';
import OverheadReachReference from './OverheadReachReference';
import PushupReference from './PushupReference';

const HumanoidAnimation = lazy(() => import('./HumanoidAnimation'));

// Map of exercise types to Lottie JSON URLs or 3D Model URLs
const ANIMATION_CONFIG: Record<string, { type: 'lottie' | '3d', url: string }> = {
  'squat': { 
    type: 'lottie', 
    url: 'https://assets8.lottiefiles.com/packages/lf20_m6cu96.json' // Specific high-quality humanoid squat
  },
  'neck_rotation': {
    type: 'lottie',
    url: 'https://assets1.lottiefiles.com/packages/lf20_33as9i.json' // Humanoid head rotation
  },
  'arm_raise': {
    type: 'lottie',
    url: 'https://assets1.lottiefiles.com/packages/lf20_9w998v.json' // Humanoid silhouette
  },
  'knee_bend': {
    type: 'lottie',
    url: 'https://assets1.lottiefiles.com/packages/lf20_9w998v.json'
  },
  'spine_extension': {
    type: 'lottie',
    url: 'https://assets1.lottiefiles.com/packages/lf20_33as9i.json'
  },
  'bicep_curl': {
    type: 'lottie',
    url: 'https://assets1.lottiefiles.com/packages/lf20_9w998v.json'
  },
  'push_up': {
    type: 'lottie',
    url: 'https://assets1.lottiefiles.com/packages/lf20_9w998v.json'
  },
  'full_body_stretch': {
    type: 'lottie',
    url: 'https://assets10.lottiefiles.com/packages/lf20_9w998v.json' // Humanoid overhead reach
  }
};

interface ExerciseAnimationProps {
  type: string;
  className?: string;
}

export default function ExerciseAnimation({ type, className = "" }: ExerciseAnimationProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  
  const config = ANIMATION_CONFIG[type];

  useEffect(() => {
    if (!config) {
      setError(true);
      setLoading(false);
      return;
    }

    if (config.type === 'lottie') {
      const fetchAnimation = async () => {
        try {
          const response = await fetch(config.url);
          if (!response.ok) throw new Error('Failed to load animation');
          const data = await response.json();
          setAnimationData(data);
        } catch (err) {
          // Fallback to ReferenceAnimation on fetch failure
          setError(true);
        } finally {
          setLoading(false);
        }
      };
      fetchAnimation();
    } else {
      setLoading(false);
    }
  }, [type, config]);

  const togglePlay = () => {
    if (isPlaying) {
      lottieRef.current?.pause();
    } else {
      lottieRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReplay = () => {
    lottieRef.current?.goToAndPlay(0);
    setIsPlaying(true);
  };

  if (loading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-slate-900/80 p-4 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || (!animationData && config?.type === 'lottie')) {
    if (type === 'neck_rotation') {
      return <NeckRotationReference key={type} />;
    }
    if (type === 'knee_bend') {
      return <KneeBendReference key={type} />;
    }
    if (type === 'overhead_reach' || type === 'full_body_stretch') {
      return <OverheadReachReference key={type} />;
    }
    if (type === 'push_up') {
      return <PushupReference key={type} />;
    }
    return <ReferenceAnimation key={type} type={type} />;
  }

  if (config?.type === '3d') {
    return (
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      }>
        <HumanoidAnimation modelUrl={config.url} />
      </Suspense>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-slate-900/80 p-4 overflow-hidden relative group ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      
      <div className="z-10 w-full h-full max-h-full flex items-center justify-center">
        <Lottie 
          lottieRef={lottieRef}
          animationData={animationData} 
          loop={true} 
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button 
          onClick={togglePlay}
          className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-emerald-400"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
        </button>
        <div className="w-px h-4 bg-slate-700" />
        <button 
          onClick={handleReplay}
          className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
          title="Replay"
        >
          <RotateCcw size={20} />
        </button>
      </div>
    </div>
  );
}
