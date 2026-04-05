import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { User, Mail, Shield, Calendar, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Profile() {
  const { profile, loading } = useAuthStore();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Profile not found</h2>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/20 dark:hover:bg-slate-800/20 rounded-full transition-all backdrop-blur-md border border-transparent hover:border-white/20 dark:hover:border-slate-700/30"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black tracking-tight">My Profile</h1>
          <ThemeToggle />
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-bl-full -z-10"></div>
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-emerald-500/20 mb-4 border-4 border-white/50 dark:border-slate-700/50">
              {profile.name.charAt(0)}
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{profile.name}</h2>
            <div className="flex items-center mt-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-full border border-emerald-200 dark:border-emerald-500/30">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mr-1.5" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{profile.role}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                <User className="w-3.5 h-3.5 mr-1.5" /> Full Name
              </label>
              <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white/20 dark:border-slate-700/30 backdrop-blur-sm font-medium text-slate-900 dark:text-white transition-all group-hover:border-emerald-500/30">
                {profile.name}
              </div>
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1.5" /> Email Address
              </label>
              <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white/20 dark:border-slate-700/30 backdrop-blur-sm font-medium text-slate-900 dark:text-white transition-all group-hover:border-emerald-500/30 flex items-center justify-between">
                <span>{profile.email}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1.5" /> Member Since
              </label>
              <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white/20 dark:border-slate-700/30 backdrop-blur-sm font-medium text-slate-900 dark:text-white transition-all group-hover:border-emerald-500/30">
                {profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'Recently'}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-200/50 dark:border-slate-700/50">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-900/20 dark:shadow-white/10"
            >
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </button>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
              Profile updates are currently in read-only mode.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
