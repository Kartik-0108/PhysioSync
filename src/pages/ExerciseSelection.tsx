import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Activity, ArrowLeft, Play, Search, Filter, Plus, X, CheckCircle, Clock, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';
import { EXERCISE_LIBRARY, ExerciseCategory, ExerciseTemplate } from '../lib/exerciseLibrary';
import { dailyPlanService } from '../services/dailyPlanService';
import { format } from 'date-fns';

export default function ExerciseSelection() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [starting, setStarting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'All'>('All');
  
  // Modal state
  const [selectedExercise, setSelectedExercise] = useState<ExerciseTemplate | null>(null);
  const [addedToPlan, setAddedToPlan] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.uid) {
      fetchResults();
    }
  }, [profile]);

  const fetchResults = async () => {
    try {
      const resQuery = query(
        collection(db, 'results'),
        where('patientId', '==', profile?.uid)
      );
      const resSnapshot = await getDocs(resQuery);
      const resultList = resSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.completedAt?.toMillis() || 0) - (a.completedAt?.toMillis() || 0));
      setResults(resultList);
    } catch (error) {
      console.error("Error fetching results:", error);
    }
  };

  const filteredLibrary = useMemo(() => {
    return EXERCISE_LIBRARY.filter(ex => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const addToTodayPlan = async (exercise: ExerciseTemplate) => {
    if (!profile) return;
    try {
      await dailyPlanService.addToPlan({
        userId: profile.uid,
        exerciseId: '', // Self-guided, no master exercise ID
        exerciseType: exercise.id,
        exerciseName: exercise.name,
        status: 'not_started',
        addedBy: 'patient',
        targetReps: 10
      });
      setAddedToPlan(exercise.id);
      setTimeout(() => setAddedToPlan(null), 3000);
    } catch (error) {
      console.error("Error adding to plan:", error);
    }
  };

  const handleStart = async (exercise: ExerciseTemplate) => {
    if (!profile) return;
    setStarting(exercise.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Create master exercise if it doesn't exist (or just use a dummy ID if it's self-guided)
      // For simplicity, we'll just add to todays_plan directly for self-guided sessions
      const planId = await dailyPlanService.addToPlan({
        userId: profile.uid,
        exerciseId: '', // Self-guided
        exerciseType: exercise.id,
        exerciseName: exercise.name,
        status: 'in_progress',
        addedBy: 'patient',
        targetReps: 10
      });

      // We still need a master exercise ID for the session page to fetch details if it relies on 'exercises' collection
      // But wait, ExerciseSession fetches from 'exercises' collection.
      // So I MUST create a master exercise doc too.
      
      const docRef = await addDoc(collection(db, 'exercises'), {
        doctorId: 'self',
        patientId: profile.uid,
        addedBy: 'patient',
        type: exercise.id,
        name: exercise.name,
        targetReps: 10,
        difficulty: exercise.difficulty,
        status: 'in_progress',
        date: today,
        createdAt: serverTimestamp()
      });

      navigate(`/exercise/${docRef.id}?planId=${planId}`);
    } catch (error) {
      console.error("Error creating exercise:", error);
      setStarting(null);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/patient')} 
              className="p-2 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-xl hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all border border-white/20 dark:border-slate-700/30 shadow-lg"
            >
              <ArrowLeft className="w-6 h-6 text-slate-700 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Exercise Library</h1>
              <p className="text-slate-500 dark:text-slate-400">Select an exercise to view details or start a session</p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search exercises..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-2xl pl-12 pr-4 py-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200 shadow-lg"
            />
          </div>
          <div className="w-full md:w-64 relative">
            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ExerciseCategory | 'All')}
              className="w-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-2xl pl-12 pr-4 py-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200 appearance-none shadow-lg"
            >
              <option value="All">All Categories</option>
              <option value="Knee Rehabilitation">Knee Rehabilitation</option>
              <option value="Shoulder Rehabilitation">Shoulder Rehabilitation</option>
              <option value="Arm Rehabilitation">Arm Rehabilitation</option>
              <option value="Chest / Upper Body">Chest / Upper Body</option>
              <option value="Back / Spine Exercises">Back / Spine Exercises</option>
              <option value="Neck Exercises">Neck Exercises</option>
              <option value="Full Body Mobility">Full Body Mobility</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLibrary.map((ex, idx) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setSelectedExercise(ex)}
              className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-xl flex flex-col transition-all duration-200 hover:shadow-2xl hover:scale-[1.02] cursor-pointer group"
            >
              <div className="w-14 h-14 bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Activity className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{ex.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">{ex.category}</span>
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                  ex.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                  ex.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                }`}>
                  {ex.difficulty}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 mb-6 flex-1 text-sm line-clamp-2">{ex.description}</p>
              
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-slate-500 dark:text-slate-500">Target Joints</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{ex.targetJoints.join(', ')}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Exercise Details Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedExercise(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
                <button 
                  onClick={() => setSelectedExercise(null)}
                  className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                    <Activity className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedExercise.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{selectedExercise.category}</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        selectedExercise.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        selectedExercise.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      }`}>
                        {selectedExercise.difficulty}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Last Performance Section */}
                  {selectedExercise && results.find(r => r.exerciseType === selectedExercise.id) && (
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                          <Award className="w-4 h-4 mr-2" />
                          Your Last Performance
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          {(() => {
                            const last = results.find(r => r.exerciseType === selectedExercise.id);
                            return last.completedAt?.toDate ? last.completedAt.toDate().toLocaleDateString() : 'Recently';
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Accuracy</div>
                          <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {results.find(r => r.exerciseType === selectedExercise.id).accuracy}%
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${results.find(r => r.exerciseType === selectedExercise.id).accuracy}%` }}
                              className="h-full bg-emerald-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Description</h3>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selectedExercise.description}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Instructions</h3>
                    <ul className="space-y-3">
                      {selectedExercise.instructions.map((instruction, idx) => (
                        <li key={idx} className="flex items-start text-slate-600 dark:text-slate-300">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 mr-3 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{instruction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Target Joints</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedExercise.targetJoints.map((joint, idx) => (
                        <span key={idx} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium capitalize">
                          {joint}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => addToTodayPlan(selectedExercise)}
                  disabled={addedToPlan === selectedExercise.id}
                  className="flex-1 py-3.5 px-6 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-xl transition-all border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {addedToPlan === selectedExercise.id ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />
                      Added to Plan
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Add to Today's Plan
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleStart(selectedExercise)}
                  disabled={starting === selectedExercise.id}
                  className="flex-1 py-3.5 px-6 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center"
                >
                  {starting === selectedExercise.id ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2 fill-current" />
                      Start Exercise
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
