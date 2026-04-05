import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Activity, Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Login() {
  const navigate = useNavigate();
  const { user, profile, fetchProfile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user && profile) {
      navigate(profile.role === 'doctor' ? '/doctor' : '/patient');
    }
  }, [user, profile, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await fetchProfile(result.user.uid);
      
      const { profile: currentProfile } = useAuthStore.getState();
      if (!currentProfile) {
        setError('User profile not found. Please register.');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is currently disabled. Please contact the administrator or use Google login.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    setResetLoading(true);
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      // Force sign out to ensure account selection popup
      await signOut(auth);
      const result = await signInWithPopup(auth, googleProvider);
      await fetchProfile(result.user.uid);
      
      const { profile: currentProfile } = useAuthStore.getState();
      if (!currentProfile) {
        navigate('/register');
        return;
      }
      navigate(currentProfile.role === 'doctor' ? '/doctor' : '/patient');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

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
        
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">PhysioSync</h1>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-8">Your AI-Powered Physical Therapy Companion</p>

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

        <div className="space-y-4">
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
                Continue with Google
              </>
            )}
          </button>
          
          <p className="text-xs text-center text-slate-400 dark:text-slate-500 px-4">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Need help? <a href="mailto:support@physiosync.com" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">Contact Support</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
