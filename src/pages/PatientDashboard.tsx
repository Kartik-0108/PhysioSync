import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Activity, LogOut, TrendingUp, Award, Zap, Calendar as CalendarIcon, Bell, User, Sparkles, History, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { CircularProgress } from '../components/dashboard/CircularProgress';
import { ExerciseCard } from '../components/dashboard/ExerciseCard';
import { PerformanceGraph } from '../components/dashboard/PerformanceGraph';
import { format, subDays, isSameDay } from 'date-fns';
import { dailyPlanService, DailyPlanItem } from '../services/dailyPlanService';

import { NotificationBell } from '../components/NotificationBell';

export default function PatientDashboard() {
  const { profile, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DailyPlanItem[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.uid) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    try {
      if (!profile?.uid) return;

      // 1. Fetch Today's Plan
      let todayPlan = await dailyPlanService.getTodayPlan(profile.uid);

      // 2. Daily Reset Logic: If empty, populate from master exercises
      if (todayPlan.length === 0) {
        const exQuery = query(
          collection(db, 'exercises'), 
          where('patientId', '==', profile.uid)
        );
        const exSnapshot = await getDocs(exQuery);
        const masterExercises = exSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter active exercises (assigned or in_progress)
        const activeExercises = masterExercises.filter((ex: any) => ex.status === 'assigned' || ex.status === 'in_progress');
        
        // Create daily plan items
        const today = format(new Date(), 'yyyy-MM-dd');
        const newPlanItems = await Promise.all(activeExercises.map(async (ex: any) => {
          const newItem = {
            userId: profile.uid,
            exerciseId: ex.id,
            exerciseType: ex.type,
            exerciseName: ex.name || ex.type.replace('_', ' '),
            date: today,
            status: 'not_started' as const,
            addedBy: ex.addedBy || 'doctor',
            targetReps: ex.targetReps,
            createdAt: Timestamp.now()
          };
          const docRef = await addDoc(collection(db, 'todays_plan'), newItem);
          return { id: docRef.id, ...newItem } as DailyPlanItem;
        }));
        todayPlan = newPlanItems;
      }
      
      setPlan(todayPlan);

      // 3. Fetch Results
      const resQuery = query(
        collection(db, 'results'),
        where('patientId', '==', profile.uid),
      );
      const resSnapshot = await getDocs(resQuery);
      const resultList = resSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0));
      setResults(resultList);

      // 4. Fetch Suggestions
      const smartSuggestions = await dailyPlanService.getSuggestions(profile.uid);
      setSuggestions(smartSuggestions);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const removeFromPlan = async (planId: string) => {
    try {
      await dailyPlanService.removeFromPlan(planId);
      setPlan(prev => prev.filter(item => item.id !== planId));
      setNotification("Removed from today's plan");
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error removing item:", error);
      setNotification("Failed to remove item");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
    navigate('/login');
  };

  // Analytics Calculations
  const completedCount = plan.filter(item => item.status === 'completed').length;
  const progressPercentage = plan.length ? Math.round((completedCount / plan.length) * 100) : 0;
  
  const averageAccuracy = useMemo(() => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, curr) => acc + (curr.accuracy || 0), 0);
    return Math.round(sum / results.length);
  }, [results]);

  const totalRepsToday = useMemo(() => {
    const today = new Date();
    return results
      .filter(r => r.completedAt && isSameDay(r.completedAt.toDate(), today))
      .reduce((acc, curr) => acc + (curr.reps || 0), 0);
  }, [results]);

  const graphData = useMemo(() => {
    return [...results].reverse().slice(-7).map((r, i) => ({
      name: `Session ${i+1}`,
      accuracy: r.accuracy || 0
    }));
  }, [results]);

  const trend = useMemo(() => {
    if (results.length < 2) return 'neutral';
    return (results[0].accuracy || 0) >= (results[1].accuracy || 0) ? 'up' : 'down';
  }, [results]);

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-emerald-400 to-teal-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Welcome back, {profile?.name}</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Your personalized AI physiotherapy plan</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/profile')}
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors px-4 py-2.5 rounded-xl bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-700/60 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm font-bold"
            >
              <User className="w-5 h-5" />
              <span>Profile</span>
            </button>
            <NotificationBell />
            <ThemeToggle />
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors px-4 py-2.5 rounded-xl bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-700/60 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-bold">Logout</span>
            </button>
          </div>
        </header>

        {/* Daily Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="md:col-span-3 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <CircularProgress percentage={progressPercentage} size={120} strokeWidth={10}>
                <div className="text-center">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{completedCount}</span>
                  <span className="text-lg font-bold text-slate-400">/{plan.length}</span>
                </div>
              </CircularProgress>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Today's Progress</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">
                {progressPercentage === 100 
                  ? "Amazing! You've completed your entire plan for today." 
                  : `You've completed ${completedCount} out of ${plan.length} exercises. Keep it up!`}
              </p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-xl text-white flex flex-col justify-between group cursor-pointer overflow-hidden relative" onClick={() => navigate('/exercises')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <Zap className="w-8 h-8 mb-4 fill-current" />
              <h3 className="text-xl font-bold mb-1">Quick Start</h3>
              <p className="text-blue-100 text-sm font-medium">Browse exercise library</p>
            </div>
            <div className="relative z-10 flex items-center text-sm font-bold mt-4 group-hover:translate-x-2 transition-transform">
              Explore Now <ArrowRight className="w-4 h-4 ml-2" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Stats & Suggestions */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Smart Suggestions */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-amber-500" />
                Smart Suggestions
              </h3>
              <div className="space-y-4">
                {suggestions.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">No suggestions yet. Complete more sessions for personalized insights!</p>
                ) : (
                  suggestions.map((s, i) => (
                    <div key={i} className="bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-white/20 dark:border-slate-700/30">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${s.type === 'missed' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                          {s.type === 'missed' ? <Clock className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {s.type === 'missed' ? 'Missed Yesterday' : 'Improve Form'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{s.data.exerciseName || s.data.exerciseType?.replace('_', ' ')}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {s.type === 'missed' ? 'You missed this exercise yesterday. Add it to today\'s plan?' : `Your last accuracy was ${s.data.accuracy}%. Practice more to improve.`}
                      </p>
                      <button 
                        onClick={() => navigate('/exercises')}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center"
                      >
                        Action <ArrowRight className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Performance Trend */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                  Performance Trend
                </h3>
                {trend === 'up' ? (
                  <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg dark:bg-emerald-500/20 dark:text-emerald-400">
                    <TrendingUp className="w-3 h-3 mr-1" /> Improving
                  </span>
                ) : (
                  <span className="flex items-center text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-lg dark:bg-amber-500/20 dark:text-amber-400">
                    Stable
                  </span>
                )}
              </div>
              
              <div className="h-24 mb-4">
                <PerformanceGraph data={graphData} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-white/20 dark:border-slate-700/30">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Avg Accuracy</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{averageAccuracy}%</div>
                </div>
                <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-white/20 dark:border-slate-700/30">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Reps Today</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{totalRepsToday}</div>
                </div>
              </div>

              <button 
                onClick={() => navigate('/report')}
                className="w-full py-3 bg-white/50 dark:bg-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-600/80 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-white/20 dark:border-slate-600/30 backdrop-blur-sm shadow-sm"
              >
                View Full Analytics
              </button>
            </div>
          </div>

          {/* Right Column: Today's Plan */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center">
                <CalendarIcon className="w-6 h-6 mr-2 text-slate-400" />
                Today's Plan
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/report')}
                  className="p-2 text-slate-500 hover:text-emerald-500 transition-colors"
                  title="View History"
                >
                  <History className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => navigate('/exercises')}
                  className="px-4 py-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 border border-blue-500/20 dark:border-blue-500/30 rounded-xl font-bold transition-all backdrop-blur-sm"
                >
                  Add Exercise
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-white/20 dark:bg-slate-800/20 animate-pulse rounded-3xl border border-white/10 dark:border-slate-700/20 backdrop-blur-sm"></div>
                ))}
              </div>
            ) : plan.length === 0 ? (
              <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-12 text-center shadow-inner">
                <div className="w-20 h-20 bg-slate-200/50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No exercises for today</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">Your plan is empty. Add exercises from the library or wait for your doctor's assignment.</p>
                <button 
                  onClick={() => navigate('/exercises')}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
                >
                  Browse Exercises
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {plan.map((item, index) => {
                  const lastResult = results.find(r => r.exerciseType === item.exerciseType);
                  return (
                    <ExerciseCard 
                      key={item.id} 
                      exercise={{
                        ...item,
                        id: item.exerciseId || item.id, // Use master ID if available, else plan ID
                        planId: item.id,
                        name: item.exerciseName,
                        type: item.exerciseType
                      }} 
                      index={index} 
                      lastResult={lastResult}
                      onRemove={item.addedBy === 'patient' ? () => removeFromPlan(item.id!) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 border border-slate-700"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
