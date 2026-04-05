import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Users, Activity, Plus, LogOut, ChevronRight, Search, Filter, Calendar as CalendarIcon, Target, Clock, AlertCircle, User, Trash2, LayoutDashboard, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { EXERCISE_LIBRARY, ExerciseCategory, DifficultyLevel } from '../lib/exerciseLibrary';
import { NotificationBell } from '../components/NotificationBell';

export default function DoctorDashboard() {
  const { profile, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState<'dashboard' | 'patients' | 'exercises' | 'reports'>('dashboard');
  const [allExercises, setAllExercises] = useState<any[]>([]);

  // History filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'completed'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New exercise form
  const [newExerciseType, setNewExerciseType] = useState(EXERCISE_LIBRARY[0].id);
  const [newTargetReps, setNewTargetReps] = useState(10);
  const [newDuration, setNewDuration] = useState(7); // days
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>('Medium');
  
  // Library filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'All'>('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredLibrary = useMemo(() => {
    return EXERCISE_LIBRARY.filter(ex => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const assignedToday = allExercises.filter(ex => {
      const date = ex.createdAt?.toDate ? ex.createdAt.toDate() : null;
      return date && date >= today;
    }).length;

    const activePatients = patients.filter(p => 
      allExercises.some(ex => ex.patientId === p.id && ex.status === 'assigned')
    ).length;

    return {
      totalPatients: patients.length,
      activePatients,
      assignedToday
    };
  }, [patients, allExercises]);

  useEffect(() => {
    if (profile?.uid) {
      fetchPatients();
      fetchAllExercises();
    }
  }, [profile]);

  const fetchAllExercises = async () => {
    if (!profile?.uid) return;
    try {
      const q = query(collection(db, 'exercises'), where('doctorId', '==', profile.uid));
      const snapshot = await getDocs(q);
      setAllExercises(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching all exercises:", error);
    }
  };

  const fetchPatients = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'patient'));
      const snapshot = await getDocs(q);
      const patientList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(patientList);
      setLoading(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    }
  };

  const fetchPatientExercises = async (patientId: string) => {
    try {
      const q = query(
        collection(db, 'exercises'), 
        where('patientId', '==', patientId),
        where('doctorId', '==', profile?.uid)
      );
      const snapshot = await getDocs(q);
      setExercises(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'exercises');
    }
  };

  const handleAssignExercise = async () => {
    if (!selectedPatient || !profile?.uid) return;
    
    const selectedTemplate = EXERCISE_LIBRARY.find(ex => ex.id === newExerciseType);
    if (!selectedTemplate) return;

    try {
      await addDoc(collection(db, 'exercises'), {
        doctorId: profile.uid,
        patientId: selectedPatient.id,
        addedBy: 'doctor',
        type: newExerciseType,
        name: selectedTemplate.name,
        targetReps: newTargetReps,
        durationDays: newDuration,
        difficulty: newDifficulty,
        status: 'assigned',
        createdAt: serverTimestamp()
      });

      // Notify patient
      await addDoc(collection(db, 'notifications'), {
        userId: selectedPatient.id,
        title: 'New Exercise Assigned',
        message: `Dr. ${profile.name} assigned you a new exercise: ${selectedTemplate.name}`,
        type: 'assigned',
        read: false,
        createdAt: serverTimestamp()
      });

      fetchPatientExercises(selectedPatient.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'exercises');
    }
  };

  const filteredExercises = useMemo(() => {
    if (statusFilter === 'all') return exercises;
    return exercises.filter(ex => ex.status === statusFilter);
  }, [exercises, statusFilter]);

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!selectedPatient) return;
    setDeletingId(exerciseId);
    setError('');
    setMessage('');
    try {
      await deleteDoc(doc(db, 'exercises', exerciseId));
      setMessage('Exercise removed successfully');
      fetchPatientExercises(selectedPatient.id);
      setShowDeleteConfirm(null);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exercises/${exerciseId}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
      {/* Sidebar */}
      <div className="w-full md:w-72 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border-r border-white/20 dark:border-slate-700/30 p-6 flex flex-col transition-colors duration-200 shadow-xl z-20">
        <div className="flex items-center space-x-3 mb-10">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">PhysioSync</h1>
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Doctor Portal</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'patients', label: 'Patients List', icon: Users },
            { id: 'exercises', label: 'Assigned Exercises', icon: Target },
            { id: 'reports', label: 'Reports', icon: FileText },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id as any);
                if (item.id !== 'patients') setSelectedPatient(null);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                currentView === item.id && !selectedPatient
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/20 dark:border-slate-700/30 space-y-4">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
              {profile?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile?.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Physiotherapist</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => navigate('/profile')}
                className="p-2 text-slate-500 hover:text-blue-500 transition-colors"
                title="Profile"
              >
                <User className="w-5 h-5" />
              </button>
              <NotificationBell position="bottom" />
              <ThemeToggle />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {selectedPatient ? (
            <motion.div 
              key="patient-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {/* Back Button */}
              <button
                onClick={() => setSelectedPatient(null)}
                className="flex items-center space-x-2 text-slate-500 hover:text-blue-500 transition-colors font-bold group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span>Back to {currentView === 'dashboard' ? 'Dashboard' : 'Patients'}</span>
              </button>

              {/* Patient Header */}
              <AnimatePresence mode="wait">
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-emerald-100/50 dark:bg-emerald-500/10 backdrop-blur-md border border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl text-sm font-bold flex items-center shadow-lg"
                  >
                    <Activity className="w-5 h-5 mr-2" />
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-bl-full -z-10"></div>
                <div className="flex items-center space-x-6 mb-4 md:mb-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-lg">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{selectedPatient.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center mt-1">
                      <Activity className="w-4 h-4 mr-1 text-emerald-500" />
                      {exercises.filter(e => e.status === 'completed').length} / {exercises.length} Exercises Completed
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/report', { state: { patientId: selectedPatient.id } })}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <FileText className="w-5 h-5" />
                  View Full Report
                </button>
              </div>

              {/* Assign New Exercise */}
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center">
                  <Plus className="w-6 h-6 mr-2 text-blue-500" />
                  Assign New Exercise
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                      <Search className="w-3 h-3 mr-1" /> Exercise Type
                    </label>
                    <select 
                      value={newExerciseType}
                      onChange={(e) => setNewExerciseType(e.target.value)}
                      className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200 appearance-none"
                    >
                      {EXERCISE_LIBRARY.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                      <Target className="w-3 h-3 mr-1" /> Target Reps
                    </label>
                    <input 
                      type="number" 
                      value={newTargetReps}
                      onChange={(e) => setNewTargetReps(parseInt(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> Days
                    </label>
                    <input 
                      type="number" 
                      value={newDuration}
                      onChange={(e) => setNewDuration(parseInt(e.target.value))}
                      min="1"
                      max="90"
                      className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" /> Difficulty
                    </label>
                    <select 
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value as DifficultyLevel)}
                      className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200 appearance-none"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button 
                      onClick={handleAssignExercise}
                      disabled={!newExerciseType}
                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95 flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5 mr-1" /> Assign
                    </button>
                  </div>
                </div>
              </div>

              {/* Exercise History */}
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center">
                    <CalendarIcon className="w-6 h-6 mr-2 text-slate-400" />
                    Assigned Exercises
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl px-3 py-1.5 shadow-sm">
                      <Filter className="w-4 h-4 mr-2 text-slate-400" />
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                      >
                        <option value="all">All Status</option>
                        <option value="assigned">Assigned</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredExercises.length === 0 ? (
                    <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-12 text-center shadow-inner">
                      <Activity className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No exercises found for this patient.</p>
                    </div>
                  ) : (
                    filteredExercises.map(ex => (
                      <div key={ex.id} className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-200 shadow-md hover:shadow-lg hover:border-white/40 dark:hover:border-slate-600/50 group">
                        <div className="mb-4 sm:mb-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{ex.name || ex.type.replace('_', ' ')}</h4>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              {ex.createdAt?.toDate ? ex.createdAt.toDate().toLocaleDateString() : 'Recently'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/20 dark:border-slate-700/30 flex items-center">
                              <Target className="w-3.5 h-3.5 mr-1" /> {ex.targetReps} reps
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border ${
                              ex.difficulty === 'Easy' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' :
                              ex.difficulty === 'Medium' ? 'bg-amber-100/50 text-amber-700 border-amber-200/50 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' :
                              'bg-red-100/50 text-red-700 border-red-200/50 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
                            }`}>
                              {ex.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider backdrop-blur-md border ${
                            ex.status === 'completed' ? 'bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/30' : 'bg-amber-100/80 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/30'
                          }`}>
                            {ex.status}
                          </div>
                          
                          {showDeleteConfirm === ex.id ? (
                            <div className="flex items-center space-x-2 bg-red-50 dark:bg-red-900/20 p-2 rounded-xl border border-red-200 dark:border-red-500/30">
                              <button
                                onClick={() => handleDeleteExercise(ex.id)}
                                disabled={deletingId === ex.id}
                                className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg"
                              >
                                {deletingId === ex.id ? '...' : 'Remove'}
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowDeleteConfirm(ex.id)}
                              className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key={currentView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-10"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                    {currentView === 'dashboard' ? 'Overview' : 
                     currentView === 'patients' ? 'Patients Directory' : 
                     currentView === 'exercises' ? 'Exercise Management' : 'Reports'}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                    {currentView === 'dashboard' ? 'Welcome back, Dr. ' + profile?.name : 
                     currentView === 'patients' ? 'Manage and monitor your patients' : 
                     currentView === 'exercises' ? 'Review all assigned exercises' : 'Analyze patient progress'}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="px-6 py-3 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-2xl font-bold flex items-center space-x-2 shadow-sm">
                    <CalendarIcon className="w-5 h-5 text-blue-500" />
                    <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </button>
                </div>
              </div>

              {currentView === 'dashboard' && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'blue' },
                      { label: 'Active Patients', value: stats.activePatients, icon: Activity, color: 'emerald' },
                      { label: 'Assigned Today', value: stats.assignedToday, icon: CheckCircle2, color: 'indigo' },
                    ].map((stat, i) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-xl relative overflow-hidden group"
                      >
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform`}></div>
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 bg-${stat.color}-500/10 rounded-2xl`}>
                            <stat.icon className={`w-6 h-6 text-${stat.color}-500`} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</p>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{stat.label}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Recent Patients */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">Recent Patients</h3>
                      <button 
                        onClick={() => setCurrentView('patients')}
                        className="text-sm font-bold text-blue-500 hover:underline"
                      >
                        View All
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {patients.slice(0, 6).map((patient, i) => (
                        <motion.button
                          key={patient.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => {
                            setSelectedPatient(patient);
                            fetchPatientExercises(patient.id);
                          }}
                          className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all text-left group"
                        >
                          <div className="flex items-center space-x-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md">
                              {patient.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 dark:text-white truncate">{patient.name}</p>
                              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Patient</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-white/10 dark:border-slate-700/30">
                            <div className="flex items-center space-x-1 text-emerald-500">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">Active</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {currentView === 'patients' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {patients.map((patient, i) => (
                    <motion.button
                      key={patient.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        setSelectedPatient(patient);
                        fetchPatientExercises(patient.id);
                      }}
                      className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-6 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all text-left group"
                    >
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-lg font-black text-slate-900 dark:text-white truncate">{patient.name}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{patient.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-white/10 dark:border-slate-700/30">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned</span>
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {allExercises.filter(ex => ex.patientId === patient.id).length} Exercises
                          </span>
                        </div>
                        <div className="px-4 py-2 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-bold group-hover:bg-blue-500 group-hover:text-white transition-all">
                          Manage
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {currentView === 'exercises' && (
                <div className="space-y-4">
                  {allExercises.length === 0 ? (
                    <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-12 text-center shadow-inner">
                      <Target className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No exercises have been assigned yet.</p>
                    </div>
                  ) : (
                    allExercises.map(ex => (
                      <div key={ex.id} className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-2xl p-6 flex items-center justify-between shadow-md">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Target className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{ex.name}</h4>
                            <p className="text-xs text-slate-500">Assigned to: <span className="font-bold">{patients.find(p => p.id === ex.patientId)?.name || 'Unknown'}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                            ex.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {ex.status}
                          </span>
                          <button 
                            onClick={() => {
                              const patient = patients.find(p => p.id === ex.patientId);
                              if (patient) {
                                setSelectedPatient(patient);
                                fetchPatientExercises(patient.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {currentView === 'reports' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {patients.map(patient => (
                    <div key={patient.id} className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-8 shadow-xl">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-slate-600 dark:text-slate-300">
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 dark:text-white">{patient.name}</h4>
                            <p className="text-xs text-slate-500">Patient Report</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => navigate('/report', { state: { patientId: patient.id } })}
                          className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-white/20 dark:border-slate-700/30">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completion</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white">
                            {Math.round((allExercises.filter(ex => ex.patientId === patient.id && ex.status === 'completed').length / (allExercises.filter(ex => ex.patientId === patient.id).length || 1)) * 100)}%
                          </p>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-white/20 dark:border-slate-700/30">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exercises</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white">
                            {allExercises.filter(ex => ex.patientId === patient.id).length}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
