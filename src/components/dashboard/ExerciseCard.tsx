import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle, Activity, Clock, AlertCircle, Trash2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ExerciseCardProps {
  exercise: any;
  index: number;
  lastResult?: any;
  onRemove?: (exerciseId: string) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, index, lastResult, onRemove }) => {
  const navigate = useNavigate();
  const isCompleted = exercise.status === 'completed';
  const isPatientAdded = exercise.addedBy === 'patient' || exercise.doctorId === 'self';
  const [showTooltip, setShowTooltip] = useState(false);

  const navigateToSession = () => {
    const url = `/exercise/${exercise.id}${exercise.planId ? `?planId=${exercise.planId}` : ''}`;
    navigate(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`backdrop-blur-xl border rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between transition-all group hover:shadow-2xl hover:scale-[1.02] ${
        isCompleted 
          ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30' 
          : 'bg-white/40 dark:bg-slate-800/40 border-white/20 dark:border-slate-700/30 hover:border-white/40 dark:hover:border-slate-600/50'
      }`}
    >
      <div className="flex items-start space-x-6 mb-4 md:mb-0 w-full md:w-auto">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-md shrink-0 shadow-inner ${
          isCompleted ? 'bg-emerald-100/80 dark:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30' : 'bg-blue-100/80 dark:bg-blue-500/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/30'
        }`}>
          {isCompleted ? <CheckCircle className="w-8 h-8" /> : <Activity className="w-8 h-8" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{exercise.name || exercise.type.replace('_', ' ')}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
            }`}>
              {isCompleted ? 'Completed' : 'Not Started'}
            </span>
            {!isPatientAdded && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Doctor Assigned
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
            <span className="text-slate-600 dark:text-slate-300 font-medium bg-white/50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/20 dark:border-slate-700/30">
              Target: {exercise.targetReps} reps
            </span>
            {exercise.difficulty && (
              <span className={`px-2.5 py-1 rounded-lg font-medium backdrop-blur-sm border ${
                exercise.difficulty === 'Easy' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' :
                exercise.difficulty === 'Medium' ? 'bg-amber-100/50 text-amber-700 border-amber-200/50 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' :
                'bg-red-100/50 text-red-700 border-red-200/50 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
              }`}>
                {exercise.difficulty}
              </span>
            )}
          </div>

          {lastResult && (
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Last Performance</span>
                <div className="flex items-center text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  <Clock className="w-3 h-3 mr-1" />
                  {lastResult.completedAt?.toDate ? lastResult.completedAt.toDate().toLocaleDateString() : 'Recently'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200/50 dark:border-slate-700/30">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Accuracy</div>
                  <div className="flex items-end gap-2">
                    <div className={`text-xl font-black ${lastResult.accuracy > 80 ? 'text-emerald-500' : lastResult.accuracy > 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {lastResult.accuracy}%
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full mb-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${lastResult.accuracy > 80 ? 'bg-emerald-500' : lastResult.accuracy > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${lastResult.accuracy}%` }}
                      />
                    </div>
                  </div>
                </div>
                {lastResult.paceStats?.tooFast > 0 && (
                  <div className="bg-amber-500/10 dark:bg-amber-500/20 rounded-xl p-3 border border-amber-500/20 dark:border-amber-500/30 flex flex-col justify-center">
                    <div className="flex items-center text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Pace Alert
                    </div>
                    <div className="text-[10px] text-amber-500/80 dark:text-amber-400/80 font-medium">Too fast</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="w-full md:w-auto flex items-center justify-end gap-3 mt-4 md:mt-0">
        {onRemove && (
          <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
            {isPatientAdded ? (
              <button
                onClick={() => onRemove(exercise.id)}
                className="p-3 bg-white/50 dark:bg-slate-800/50 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-colors border border-white/20 dark:border-slate-700/30 shadow-sm"
                aria-label="Remove exercise"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            ) : (
              <div className="p-3 bg-slate-100/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 rounded-xl border border-slate-200/50 dark:border-slate-700/30 cursor-not-allowed group/lock">
                <Lock className="w-5 h-5 group-hover/lock:scale-110 transition-transform" />
              </div>
            )}
            
            <AnimatePresence>
              {showTooltip && !isPatientAdded && (
                <motion.div
                  initial={{ opacity: 0, y: 5, x: '50%' }}
                  animate={{ opacity: 1, y: 0, x: '50%' }}
                  exit={{ opacity: 0, y: 5, x: '50%' }}
                  className="absolute bottom-full right-1/2 mb-2 w-48 p-3 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-xl shadow-2xl text-center z-50 border border-slate-700 leading-relaxed"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>Doctor-assigned exercises are mandatory and cannot be removed from your plan.</span>
                  </div>
                  <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isCompleted ? (
          <button 
            onClick={navigateToSession}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 group-hover:scale-105"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Session</span>
          </button>
        ) : (
          <div className="flex-1 md:flex-none flex items-center justify-center px-8 py-4 bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-2xl border border-emerald-200/50 dark:border-emerald-500/20 backdrop-blur-sm">
            <CheckCircle className="w-5 h-5 mr-2" />
            Completed
          </div>
        )}
      </div>
    </motion.div>
  );
};
