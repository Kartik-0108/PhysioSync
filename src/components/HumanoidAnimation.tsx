import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, useAnimations, ContactShadows } from '@react-three/drei';
import { ErrorBoundary } from './ErrorBoundary';

interface HumanoidAnimationProps {
  modelUrl: string;
}

function Model({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    // Play the first animation if it exists
    const actionNames = Object.keys(actions);
    if (actionNames.length > 0) {
      const firstAction = actions[actionNames[0]];
      if (firstAction) {
        firstAction.reset().fadeIn(0.5).play();
      }
    }
  }, [actions]);

  return <primitive object={scene} scale={2} position={[0, -1.5, 0]} />;
}

export default function HumanoidAnimation({ modelUrl }: HumanoidAnimationProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="w-full h-full bg-slate-900 rounded-2xl overflow-hidden relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
            <span className="text-slate-400 text-sm font-medium">Loading 3D Model...</span>
          </div>
        </div>
      )}
      
      <ErrorBoundary>
        <Canvas 
          camera={{ position: [0, 1, 5], fov: 45 }}
          onCreated={() => setIsLoaded(true)}
        >
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.7} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          <Suspense fallback={null}>
            <Model url={modelUrl} />
            <Environment preset="city" />
            <ContactShadows 
              position={[0, -1.5, 0]} 
              opacity={0.4} 
              scale={10} 
              blur={2} 
              far={4} 
            />
          </Suspense>
          
          <OrbitControls 
            enableZoom={true} 
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
