/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useAuthStore } from './store/useAuthStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useThemeStore } from './store/useThemeStore';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import ExerciseSession from './pages/ExerciseSession';
import ExerciseSelection from './pages/ExerciseSelection';
import MonthlyReport from './pages/MonthlyReport';
import Profile from './pages/Profile';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: 'doctor' | 'patient' }) {
  const { user, profile, loading } = useAuthStore();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>;
  if (!user) return <Navigate to="/login" />;
  
  // If user is logged in but has no profile, they must complete registration
  if (!profile && window.location.pathname !== '/register') return <Navigate to="/register" />;
  
  if (role && profile?.role !== role) {
    return <Navigate to={profile?.role === 'doctor' ? '/doctor' : '/patient'} />;
  }

  return <>{children}</>;
}

export default function App() {
  const { profile, setUser, fetchProfile } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme
    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('theme') || 'dark';
    } catch (e) {}
    setTheme(savedTheme as 'light' | 'dark');
  }, [setTheme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid);
      } else {
        useAuthStore.getState().setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [setUser, fetchProfile]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500/30 transition-colors duration-200 relative overflow-hidden">
          {/* Background Blobs for Glassmorphism */}
          <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
          <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
          <div className="fixed top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
          
          <div className="relative z-10 min-h-screen">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route path="/doctor" element={
                <ProtectedRoute role="doctor">
                  <DoctorDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/patient" element={
                <ProtectedRoute role="patient">
                  <PatientDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/exercises" element={
                <ProtectedRoute role="patient">
                  <ExerciseSelection />
                </ProtectedRoute>
              } />
              
              <Route path="/exercise/:exerciseId" element={
                <ProtectedRoute role="patient">
                  <ExerciseSession />
                </ProtectedRoute>
              } />

              <Route path="/report" element={
                <ProtectedRoute>
                  <MonthlyReport />
                </ProtectedRoute>
              } />

              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />

              <Route path="/" element={
                <ProtectedRoute>
                  {profile?.role === 'doctor' ? <Navigate to="/doctor" /> : <Navigate to="/patient" />}
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
