import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';
import Webcam from 'react-webcam';
import { PoseEstimator } from '../lib/poseEstimation';
import { ArrowLeft, CheckCircle, Activity, ChevronRight, Brain, ListChecks, AlertCircle, CheckCircle2, Info, X, Play, Pause } from 'lucide-react';
import ExerciseAnimation from '../components/ExerciseAnimation';
import { ThemeToggle } from '../components/ThemeToggle';
import { motion, AnimatePresence } from 'motion/react';
import { exerciseRules, ExerciseState } from '../lib/exerciseRules';
import { EXERCISE_LIBRARY, ExerciseTemplate } from '../lib/exerciseLibrary';
import { dailyPlanService } from '../services/dailyPlanService';

export default function ExerciseSession() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuthStore();
  
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('planId');
  
  const [exercise, setExercise] = useState<any>(null);
  const [template, setTemplate] = useState<ExerciseTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  // ... rest of state ...
  const [reps, setReps] = useState(0);
  const [leftReps, setLeftReps] = useState(0);
  const [rightReps, setRightReps] = useState(0);
  const [symmetryScore, setSymmetryScore] = useState<number>(100);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [clinicalScore, setClinicalScore] = useState<number>(0);
  const [feedback, setFeedback] = useState("Get into position");
  const [pace, setPace] = useState<"Good" | "Too Fast" | "Too Slow" | "Tracking...">("Tracking...");
  const [currentRepTime, setCurrentRepTime] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [extensionAngle, setExtensionAngle] = useState<number>(0);
  const [reachHeight, setReachHeight] = useState<number>(0);
  const [lungeDepth, setLungeDepth] = useState<number>(0);
  const [backAngle, setBackAngle] = useState<number>(180);
  const [armAlignment, setArmAlignment] = useState<boolean>(true);
  const [squatAngle, setSquatAngle] = useState<number>(180);
  const [squatState, setSquatState] = useState<string>("standing");
  const [sessionTimer, setSessionTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const lastVoiceFeedback = useRef<string>("");
  
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseEstimatorRef = useRef<PoseEstimator | null>(null);
  const requestRef = useRef<number>(0);
  
  // State for rep counting logic
  const stateRef = useRef<ExerciseState>({
    isDown: false,
    reps: 0,
    lastTime: 0,
    repStartTime: 0,
    totalFrames: 0,
    correctFrames: 0,
    paceStats: {
      tooFast: 0,
      optimal: 0,
      tooSlow: 0
    },
    faultFrames: {},
    recentPaces: []
  });

  useEffect(() => {
    if (exerciseId) {
      fetchExercise();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [exerciseId]);

  const fetchExercise = async () => {
    try {
      console.log("Fetching exercise with ID:", exerciseId);
      console.log("Current user profile:", profile);
      
      if (!exerciseId) {
        console.error("No exerciseId provided in URL");
        setLoading(false);
        return;
      }

      const docRef = doc(db, 'exercises', exerciseId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Exercise data fetched successfully:", data);
        setExercise({ id: docSnap.id, ...data });
        
        // Find the template from the library
        const foundTemplate = EXERCISE_LIBRARY.find(ex => ex.id === data.type);
        if (foundTemplate) {
          console.log("Template found:", foundTemplate.name);
          setTemplate(foundTemplate);
        } else {
          console.error("Template not found for type:", data.type);
        }
      } else {
        console.warn("Exercise document does not exist in Firestore at path: exercises/" + exerciseId);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error in fetchExercise:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      beginTracking();
    }
  }, [countdown]);

  const startSession = () => {
    setCountdown(10);
  };

  const beginTracking = async () => {
    setIsStarted(true);
    try {
      poseEstimatorRef.current = new PoseEstimator();
      await poseEstimatorRef.current.initialize();
      detectPose();
    } catch (error) {
      console.error("Failed to initialize pose estimator:", error);
      setFeedback("Error starting camera or AI. Please refresh.");
    }
  };

  const detectPose = () => {
    if (isPaused) {
      // If paused, just request the next frame and return early
      if (!isFinished) {
        requestRef.current = requestAnimationFrame(detectPose);
      }
      return;
    }

    if (
      webcamRef.current &&
      webcamRef.current.video &&
      webcamRef.current.video.readyState === 4 &&
      canvasRef.current &&
      poseEstimatorRef.current
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      let nowInMs = performance.now();
      if (nowInMs <= stateRef.current.lastTime) {
        nowInMs = stateRef.current.lastTime + 1;
      }
      stateRef.current.lastTime = nowInMs;
      
      try {
        const results = poseEstimatorRef.current.detectVideo(video, nowInMs);
        
        if (results) {
          const { incorrectJoints } = analyzePose(results);
          poseEstimatorRef.current.draw(canvas, results, incorrectJoints);
        }
      } catch (error) {
        console.error("Pose detection error:", error);
      }
    }
    
    if (!isFinished && !isPaused) {
      requestRef.current = requestAnimationFrame(detectPose);
    } else if (!isFinished && isPaused) {
      // If paused, we still want to keep the loop alive but not process frames
      // We'll just request the next frame and do nothing
      requestRef.current = requestAnimationFrame(detectPose);
    }
  };

  const analyzePose = (results: any): { isCorrect: boolean, incorrectJoints: number[] } => {
    if (!results.landmarks || results.landmarks.length === 0) {
      setFeedback("Please step into the frame");
      return { isCorrect: false, incorrectJoints: [] };
    }
    if (!exercise) return { isCorrect: true, incorrectJoints: [] };
    
    const landmarks = results.landmarks[0];
    stateRef.current.totalFrames++;

    const ruleFunction = exerciseRules[exercise.type];
    
    if (!ruleFunction) {
      setFeedback("Tracking active...");
      return { isCorrect: true, incorrectJoints: [] };
    }

    const { isCorrect, feedback: newFeedback, repCompleted, incorrectJoints, repDuration, paceClassification } = ruleFunction(
      landmarks, 
      stateRef.current, 
      poseEstimatorRef.current!, 
      exercise.targetReps
    );

    setFeedback(newFeedback);

    // Voice Guidance
    if (newFeedback !== lastVoiceFeedback.current && isStarted && !isFinished) {
      const utterance = new SpeechSynthesisUtterance(newFeedback);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      window.speechSynthesis.cancel(); // Stop current speech
      window.speechSynthesis.speak(utterance);
      lastVoiceFeedback.current = newFeedback;
    }

    if (stateRef.current.isDown) {
      setCurrentRepTime((Date.now() - stateRef.current.repStartTime) / 1000);
    } else {
      setCurrentRepTime(0);
    }

    if (repCompleted) {
      stateRef.current.isDown = false;
      const newReps = stateRef.current.reps + 1;
      stateRef.current.reps = newReps;
      setReps(newReps);
      
      if ((stateRef.current as any).leftReps !== undefined) {
        setLeftReps((stateRef.current as any).leftReps);
      }
      if ((stateRef.current as any).rightReps !== undefined) {
        setRightReps((stateRef.current as any).rightReps);
      }
      
      // Pace calculation & smoothing
      if (repDuration && paceClassification) {
        stateRef.current.recentPaces.push(repDuration);
        if (stateRef.current.recentPaces.length > 3) stateRef.current.recentPaces.shift();
        
        const avgPace = stateRef.current.recentPaces.reduce((a, b) => a + b, 0) / stateRef.current.recentPaces.length;
        
        if (paceClassification === 'too-fast') {
          setPace("Too Fast");
          stateRef.current.paceStats.tooFast++;
        } else if (paceClassification === 'too-slow') {
          setPace("Too Slow");
          stateRef.current.paceStats.tooSlow++;
        } else {
          setPace("Good");
          stateRef.current.paceStats.optimal++;
        }
      }
      
      if (newReps >= exercise.targetReps) {
        finishExercise(newReps);
      }

      // Call backend for detailed analysis if overhead reach
      if (exercise.type === 'full_body_stretch' || exercise.type === 'overhead_reach') {
        const analyzeOverhead = async () => {
          try {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiUrl}/api/analyze-overhead-reach`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                landmarks: [], // In a real app, we'd send the frame landmarks
                userId: profile?.uid,
                reps: newReps,
                symmetryScore: (stateRef.current as any).symmetryScore
              })
            });
            const data = await response.json();
            if (data.status === 'success') {
              setFeedback(data.postureFeedback);
            }
          } catch (error) {
            console.error("Error calling backend analysis:", error);
          }
        };
        analyzeOverhead();
      }
    }
    
    if (isCorrect) stateRef.current.correctFrames++;
    
    // Update rotation angle for UI if available
    if ((stateRef.current as any).rotationAngle !== undefined) {
      setRotationAngle((stateRef.current as any).rotationAngle);
    }
    
    if ((stateRef.current as any).extensionAngle !== undefined) {
      setExtensionAngle((stateRef.current as any).extensionAngle);
    }

    // Calculate reach height for UI
    if ((stateRef.current as any).reachHeight !== undefined) {
      setReachHeight((stateRef.current as any).reachHeight);
    } else if (exercise.type === 'full_body_stretch' && stateRef.current.totalFrames > 0) {
      // This is a simplified representation for the UI bar
      setReachHeight(feedback.includes("Great reach") ? 100 : feedback.includes("Keep reaching") ? 60 : 20);
    }

    if ((stateRef.current as any).lungeDepth !== undefined) {
      setLungeDepth((stateRef.current as any).lungeDepth);
    }

    if ((stateRef.current as any).symmetryScore !== undefined) {
      setSymmetryScore((stateRef.current as any).symmetryScore);
    }
    
    if ((stateRef.current as any).backAngle !== undefined) {
      setBackAngle((stateRef.current as any).backAngle);
    }
    
    if ((stateRef.current as any).armAlignment !== undefined) {
      setArmAlignment((stateRef.current as any).armAlignment);
    }

    if (stateRef.current.kneeAngle !== undefined) {
      setSquatAngle(stateRef.current.kneeAngle);
    }

    if (stateRef.current.squatState !== undefined) {
      setSquatState(stateRef.current.squatState);
    }
    
    // Update accuracy every 30 frames to avoid flickering
    if (stateRef.current.totalFrames % 30 === 0) {
      const currentAccuracy = Math.round((stateRef.current.correctFrames / stateRef.current.totalFrames) * 100);
      setAccuracy(currentAccuracy);
    }
    
    return { isCorrect, incorrectJoints: incorrectJoints || [] };
  };

  const finishExercise = async (finalReps: number) => {
    setIsFinished(true);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    // Calculate clinical score based on actual accuracy
    const finalAccuracy = Math.round((stateRef.current.correctFrames / Math.max(1, stateRef.current.totalFrames)) * 100);
    setClinicalScore(finalAccuracy);
    
    try {
      // 1. Mark exercise as completed in master collection
      await updateDoc(doc(db, 'exercises', exercise.id), {
        status: 'completed'
      });

      // 2. Mark in today's plan if applicable
      if (planId) {
        await dailyPlanService.updateStatus(planId, 'completed');
      }
      
      // 3. Save result
      await addDoc(collection(db, 'results'), {
        exerciseId: exercise.id,
        exerciseType: exercise.type,
        patientId: profile?.uid,
        doctorId: exercise.doctorId,
        accuracy: finalAccuracy,
        reps: finalReps,
        paceStats: stateRef.current.paceStats,
        symmetryScore: (exercise.type === 'full_body_stretch' || exercise.type === 'overhead_reach') ? (stateRef.current as any).symmetryScore : null,
        mistakes: [],
        completedAt: serverTimestamp()
      });

      // 4. Notify doctor if assigned by doctor
      if (exercise.doctorId && exercise.addedBy === 'doctor') {
        await addDoc(collection(db, 'notifications'), {
          userId: exercise.doctorId,
          title: 'Exercise Completed',
          message: `${profile?.name} completed ${exercise.name || exercise.type.replace('_', ' ')} with ${finalAccuracy}% accuracy.`,
          type: 'completed',
          read: false,
          createdAt: serverTimestamp()
        });
      }
      
    } catch (error) {
      console.error("Error saving result:", error);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStarted && !isFinished && !isPaused) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStarted, isFinished, isPaused]);

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-200"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>;
  if (!exercise) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center transition-colors duration-200">Exercise not found</div>;

  const isNeckRotation = exercise.type === 'neck_rotation';
  const isSpineExtension = exercise.type === 'spine_extension';
  const isOverheadReach = exercise.type === 'full_body_stretch' || exercise.type === 'overhead_reach';
  const isLunge = exercise.type === 'lunge';
  const isSquat = exercise.type === 'squat';

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getFeedbackColor = (msg: string) => {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('good') || lowerMsg.includes('great') || lowerMsg.includes('perfect')) {
      return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100';
    }
    if (lowerMsg.includes('tracking') || lowerMsg.includes('ready') || lowerMsg.includes('reaching') || lowerMsg.includes('lowering')) {
      return 'bg-blue-500/20 border-blue-500/50 text-blue-100';
    }
    return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-100';
  };

  const getFeedbackIcon = (msg: string) => {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('good') || lowerMsg.includes('great') || lowerMsg.includes('perfect')) {
      return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
    }
    if (lowerMsg.includes('tracking') || lowerMsg.includes('ready') || lowerMsg.includes('reaching') || lowerMsg.includes('lowering')) {
      return <Info className="w-6 h-6 text-blue-400" />;
    }
    return <AlertCircle className="w-6 h-6 text-yellow-400" />;
  };

  const renderGuidanceSteps = () => {
    let steps: string[] = [];
    let activeStep = 0;

    if (isNeckRotation) {
      steps = ['Look Straight', 'Turn Right', 'Center', 'Turn Left', 'Center'];
      activeStep = rotationAngle > 20 ? 1 : rotationAngle < -20 ? 3 : 0;
    } else if (isSpineExtension) {
      steps = ['Upright', 'Lean Back', 'Hold', 'Return'];
      activeStep = extensionAngle > 20 ? 2 : extensionAngle > 5 ? 1 : 0;
    } else if (isOverheadReach) {
      steps = ['Start', 'Reach Up', 'Hold', 'Lower'];
      activeStep = feedback.includes("lower") ? 3 : feedback.includes("Hold") ? 2 : feedback.includes("reaching") ? 1 : 0;
    } else if (isLunge) {
      steps = ['Step', 'Lower', '90° Angle', 'Push Back'];
      activeStep = feedback.includes("Push") ? 3 : feedback.includes("depth") ? 2 : feedback.includes("Lower") ? 1 : 0;
    } else if (isSquat) {
      steps = ['Standing', 'Squatting', 'Bottom', 'Standing Up'];
      activeStep = squatState === 'going_down' ? 1 : squatState === 'bottom' ? 2 : squatState === 'going_up' ? 3 : 0;
    } else {
      steps = ['Start', 'Perform Rep', 'Return'];
      activeStep = feedback.includes("Good") ? 1 : 0;
    }

    return (
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => {
          const isActive = idx === activeStep;
          const isPast = idx < activeStep;
          return (
            <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-500/20 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-slate-800/40 border border-transparent'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-blue-500 text-white' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`font-bold text-sm ${isActive ? 'text-blue-400' : isPast ? 'text-slate-300' : 'text-slate-500'}`}>{step}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSpecificMetrics = () => {
    if (isNeckRotation) {
      return (
        <div>
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rotation Angle</span>
            <span className="text-blue-500 font-black">{Math.abs(Math.round(rotationAngle))}°</span>
          </div>
          <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30 relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500 z-10"></div>
            <motion.div 
              className="absolute top-0 bottom-0 bg-blue-500"
              animate={{ 
                left: rotationAngle > 0 ? "50%" : `${50 + rotationAngle}%`,
                right: rotationAngle > 0 ? `${50 - rotationAngle}%` : "50%"
              }}
            />
          </div>
        </div>
      );
    }
    if (isSpineExtension) {
      return (
        <div>
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Extension Angle</span>
            <span className="text-blue-500 font-black">{Math.max(0, Math.round(extensionAngle))}°</span>
          </div>
          <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
            <motion.div 
              className="h-full bg-blue-500"
              animate={{ width: `${Math.min(100, (extensionAngle / 30) * 100)}%` }}
            />
          </div>
        </div>
      );
    }
    if (isLunge) {
      return (
        <div>
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lunge Depth</span>
            <span className="text-orange-500 font-black">{Math.round(lungeDepth)}%</span>
          </div>
          <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
            <motion.div 
              className="h-full bg-orange-500"
              animate={{ width: `${lungeDepth}%` }}
            />
          </div>
        </div>
      );
    }
    if (isSquat) {
      return (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Knee Angle</span>
              <span className="text-blue-500 font-black">{Math.round(squatAngle)}°</span>
            </div>
            <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
              <motion.div 
                className="h-full bg-blue-500"
                animate={{ width: `${Math.min(100, (squatAngle / 180) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current State</span>
              <span className="text-emerald-500 font-black uppercase tracking-widest text-[10px]">{squatState}</span>
            </div>
          </div>
        </div>
      );
    }
    if (isOverheadReach) {
      return (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reach Height</span>
              <span className="text-amber-500 font-black">{Math.round(reachHeight)}%</span>
            </div>
            <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
              <motion.div 
                className="h-full bg-amber-500"
                animate={{ width: `${reachHeight}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Symmetry</span>
              <span className="text-emerald-500 font-black">{Math.round(symmetryScore)}%</span>
            </div>
            <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
              <motion.div 
                className="h-full bg-emerald-500"
                animate={{ width: `${symmetryScore}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Back Straightness</span>
              <span className={backAngle >= 155 ? "text-emerald-500 font-black" : "text-red-500 font-black"}>
                {Math.round(backAngle)}°
              </span>
            </div>
            <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
              <motion.div 
                className={`h-full ${backAngle >= 155 ? 'bg-emerald-500' : 'bg-red-500'}`}
                animate={{ width: `${Math.min(100, (backAngle / 180) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Arm Alignment</span>
              <span className={armAlignment ? "text-emerald-500 font-black" : "text-red-500 font-black"}>
                {armAlignment ? "Aligned" : "Misaligned"}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-4 md:p-8 flex flex-col transition-colors duration-200">
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">End Session?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to exit? Your progress will not be saved.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowExitConfirm(false);
                    setIsPaused(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Resume
                </button>
                <button 
                  onClick={() => navigate('/patient')}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Exit Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between mb-8 max-w-7xl mx-auto w-full">
        <button 
          onClick={() => {
            if (isStarted && !isFinished) {
              setShowExitConfirm(true);
              setIsPaused(true);
            } else {
              navigate('/patient');
            }
          }}
          className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all px-3 py-1 rounded-lg hover:bg-white/20 dark:hover:bg-slate-800/20 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center space-x-4">
          {isStarted && !isFinished && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="flex items-center space-x-2 bg-white/30 dark:bg-slate-800/30 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 dark:border-slate-700/30 text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              <span className="font-medium">{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}
          <div className="flex items-center space-x-3 bg-white/30 dark:bg-slate-800/30 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 dark:border-slate-700/30">
            <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{exercise.name || exercise.type.replace('_', ' ')}</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col">
        {!isStarted && countdown === null ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/40 dark:border-slate-700/50 shadow-2xl flex items-center justify-center p-8 min-h-[600px]">
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 max-w-5xl mx-auto w-full">
              <div className="w-full md:w-1/2 bg-white/80 dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl border border-white/40 dark:border-slate-700/50 flex flex-col items-center justify-center aspect-square">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Reference Form</h3>
                <div className="w-full h-full relative rounded-2xl overflow-hidden bg-slate-100/50 dark:bg-slate-900/50">
                  <ExerciseAnimation type={exercise.type} className="h-full" />
                </div>
              </div>
              
              <div className="w-full md:w-1/2 flex flex-col justify-center">
                <div className="inline-flex items-center space-x-2 bg-blue-100/80 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider mb-6 w-fit border border-blue-200/50 dark:border-blue-500/30">
                  <Activity className="w-4 h-4" />
                  <span>Pre-Exercise Briefing</span>
                </div>
                
                <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
                  {template?.name || exercise.name || 'Exercise'}
                </h2>
                
                <div className="space-y-6 mb-10">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />
                      How to perform:
                    </h4>
                    <ul className="space-y-3">
                      {template?.instructions?.map((instruction, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 mr-3 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                            {instruction}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={startSession}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-2xl text-xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-3"
                >
                  <span>Start Tracking Now</span>
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        ) : isFinished ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/40 dark:border-slate-700/50 shadow-2xl flex items-center justify-center p-10 min-h-[600px]">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-10 rounded-3xl text-center max-w-md shadow-2xl transition-all duration-200">
              <div className="w-24 h-24 bg-emerald-100/50 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-500/20">
                <CheckCircle className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Workout Complete!</h2>
              
              <div className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-md rounded-2xl p-6 my-6 border border-white/20 dark:border-slate-700/30 transition-all duration-200">
                <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Clinical Score</p>
                <div className="text-6xl font-black text-emerald-600 dark:text-emerald-400">{clinicalScore}</div>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">Based on joint alignment and DTW analysis</p>
              </div>

              {isOverheadReach && (
                <div className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-md rounded-2xl p-6 my-6 border border-white/20 dark:border-slate-700/30 transition-all duration-200">
                  <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Symmetry Score</p>
                  <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{Math.round(symmetryScore)}%</div>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">Balance between left and right arm reach</p>
                </div>
              )}

              <button 
                onClick={() => navigate('/patient')}
                className="w-full px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[600px]">
            {/* Left Column: Reference, AI Analysis & Guidance */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/20 dark:border-slate-700/30 shadow-xl aspect-video relative">
                <div className="absolute top-3 left-3 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg text-[10px] z-20 backdrop-blur-md border border-blue-500/20 font-bold uppercase tracking-wider">Reference</div>
                <ExerciseAnimation type={exercise.type} className="w-full h-full object-cover" />
              </div>
              
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl p-5 border border-white/20 dark:border-slate-700/30 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-purple-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">AI Analysis</h3>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Form Accuracy</span>
                      <span className={`${accuracy > 80 ? 'text-emerald-500' : accuracy > 50 ? 'text-yellow-500' : 'text-red-500'} font-black`}>{accuracy}%</span>
                    </div>
                    <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-300/20 dark:border-slate-700/30">
                      <motion.div 
                        className={`${accuracy > 80 ? 'bg-emerald-500' : accuracy > 50 ? 'bg-yellow-500' : 'bg-red-500'} h-full shadow-[0_0_10px_currentColor]`}
                        animate={{ width: `${accuracy}%` }}
                        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pace Analysis</span>
                      <span className={`${pace === 'Good' ? 'text-emerald-500' : pace === 'Too Fast' ? 'text-red-500' : pace === 'Too Slow' ? 'text-amber-500' : 'text-blue-500'} font-black`}>
                        {pace} {currentRepTime > 0 && `(${currentRepTime.toFixed(1)}s)`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/50 dark:bg-slate-900/50 rounded-full h-3 overflow-hidden border border-slate-300/20 dark:border-slate-700/30 flex">
                      <div className={`h-full transition-all duration-300 ${pace === 'Good' ? 'bg-emerald-500 w-full' : pace === 'Too Fast' ? 'bg-red-500 w-full' : pace === 'Too Slow' ? 'bg-amber-500 w-full' : 'bg-blue-500 w-0'}`} />
                    </div>
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[8px] text-slate-500 uppercase font-bold">Fast</span>
                      <span className="text-[8px] text-slate-500 uppercase font-bold">Optimal</span>
                      <span className="text-[8px] text-slate-500 uppercase font-bold">Slow</span>
                    </div>
                  </div>

                  {renderSpecificMetrics()}
                </div>
              </div>

              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl p-5 border border-white/20 dark:border-slate-700/30 shadow-xl flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <ListChecks className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Live Guidance</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {renderGuidanceSteps()}
                </div>
              </div>
            </div>

            {/* Right Column: Camera & Feedback */}
            <div className="lg:col-span-8 flex flex-col gap-4 relative">
              <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl relative flex-1 min-h-[500px]">
                {countdown !== null && (
                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
                    <h2 className="text-3xl font-bold text-white mb-4">Get Ready</h2>
                    <div className="text-8xl font-black text-emerald-400 animate-pulse drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]">{countdown}</div>
                  </div>
                )}
                
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs backdrop-blur-md border border-emerald-500/20 font-bold uppercase tracking-wider flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Feed
                  </div>
                  <div className="bg-slate-800/60 text-slate-300 px-3 py-1.5 rounded-xl text-xs backdrop-blur-md border border-slate-700 font-mono">
                    {formatTime(sessionTimer)}
                  </div>
                </div>
                
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  {exercise.type === 'knee_bend' ? (
                    <>
                      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-xl text-center flex flex-col items-center justify-center min-w-[80px]">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">Left</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white leading-none">{leftReps}</span>
                        </div>
                      </div>
                      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-xl text-center flex flex-col items-center justify-center min-w-[80px]">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">Right</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white leading-none">{rightReps}</span>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-xl text-center flex flex-col items-center justify-center min-w-[80px]">
                    <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">Total Reps</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white leading-none">{reps}</span>
                      <span className="text-sm font-bold text-slate-500">/{exercise.targetReps}</span>
                    </div>
                  </div>
                </div>

                <Webcam
                  ref={webcamRef}
                  audio={false}
                  className="absolute inset-0 w-full h-full object-cover"
                  mirrored
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover z-10"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
              
              {/* Dynamic Feedback Bar - Moved outside camera to prevent overlapping user's form */}
              <div className="h-24">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={feedback}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className={`backdrop-blur-xl border p-5 rounded-2xl shadow-xl flex items-center gap-4 h-full ${getFeedbackColor(feedback)}`}
                  >
                    <div className="shrink-0 bg-white/10 p-3 rounded-full">
                      {getFeedbackIcon(feedback)}
                    </div>
                    <p className="text-xl font-bold tracking-wide">{feedback}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
