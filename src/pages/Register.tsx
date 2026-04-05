import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuthStore, Role } from '../store/useAuthStore';
import { Activity, User, Stethoscope, Mail, Lock, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Register() {
  const navigate = useNavigate();
  const { user, createProfile, fetchProfile } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await createProfile(result.user.uid, email, name, selectedRole);
      navigate(selectedRole === 'doctor' ? '/doctor' : '/patient');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password registration is currently disabled. Please use Google login or contact the administrator.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError(err.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Force sign out to ensure account selection popup
      await signOut(auth);
      const result = await signInWithPopup(auth, googleProvider);
      const resultUser = result.user;

      if (resultUser) {
        await fetchProfile(resultUser.uid);
        
        const { profile: currentProfile } = useAuthStore.getState();
        if (!currentProfile) {
          await createProfile(
            resultUser.uid,
            resultUser.email || '',
            resultUser.displayName || name || 'User',
            selectedRole
          );
        }
        
        const updatedProfile = useAuthStore.getState().profile;
        navigate(updatedProfile?.role === 'doctor' ? '/doctor' : '/patient');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const isSocialComplete = user && !loading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4 relative overflow-hidden transition-colors duration-200">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/30 w-full max-w-md z-10 transition-all duration-200"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-100/50 dark:bg-emerald-500/20 p-4 rounded-full backdrop-blur-md border border-emerald-200/50 dark:border-emerald-500/20">
            <Activity className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">
          {isSocialComplete ? 'Complete Profile' : 'Get Started'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
          {isSocialComplete ? 'Select your role to continue' : 'Join PhysioSync today'}
        </p>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-100/50 dark:bg-red-500/10 backdrop-blur-md border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start"
            >
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!isSocialComplete ? (
          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 px-6 bg-white dark:bg-slate-100 hover:bg-slate-50 dark:hover:bg-white text-slate-900 rounded-2xl font-bold flex items-center justify-center transition-all shadow-xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 group"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              ) : (
                <>
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                  Sign up with Google
                </>
              )}
            </button>
            
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 px-4">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Signed in as <span className="font-bold">{user.email}</span>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">I am a:</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('patient')}
                  className={`flex flex-col items-center p-4 rounded-2xl border transition-all backdrop-blur-md ${
                    selectedRole === 'patient' 
                      ? 'bg-emerald-50/50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                      : 'bg-white/30 dark:bg-slate-800/30 border-white/20 dark:border-slate-700/30 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <User className="w-6 h-6 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider">Patient</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('doctor')}
                  className={`flex flex-col items-center p-4 rounded-2xl border transition-all backdrop-blur-md ${
                    selectedRole === 'doctor' 
                      ? 'bg-blue-50/50 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                      : 'bg-white/30 dark:bg-slate-800/30 border-white/20 dark:border-slate-700/30 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Stethoscope className="w-6 h-6 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider">Doctor</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Complete Registration'}
            </button>
            
            <button 
              onClick={() => auth.signOut()}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Sign out and use another account
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            Log in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
