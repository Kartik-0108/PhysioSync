import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';
import { format, parseISO, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Activity, Target, Clock, ArrowLeft, Download, Calendar } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ResultData {
  id: string;
  accuracy: number;
  completedAt: any;
  doctorId: string;
  exerciseId: string;
  exerciseType: string;
  patientId: string;
  reps: number;
  paceStats?: {
    optimal: number;
    tooFast: number;
    tooSlow: number;
  };
}

export default function MonthlyReport() {
  const { profile, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [results, setResults] = useState<ResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'week'>('month');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchResults();
    }
  }, [profile, timeRange, location.state]);

  const handleExport = () => {
    if (results.length === 0) return;
    
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('Physiotherapy Performance Report', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // slate-500
      const dateRange = timeRange === 'month' ? 'This Month' : 'This Week';
      doc.text(`Patient: ${profile?.name || 'Unknown'} | Period: ${dateRange}`, pageWidth / 2, 30, { align: 'center' });
      doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy')}`, pageWidth / 2, 38, { align: 'center' });

      // Summary Stats
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Summary', 14, 55);
      
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Sessions: ${totalSessions}`, 14, 65);
      doc.text(`Average Accuracy: ${avgAccuracy}%`, 14, 72);
      doc.text(`Total Reps: ${totalReps}`, 14, 79);

      // Table Data
      const tableColumn = ["Date", "Exercise", "Reps", "Accuracy", "Pace"];
      const tableRows = results.map(r => {
        let paceStr = "N/A";
        if (r.paceStats) {
          const { optimal, tooFast, tooSlow } = r.paceStats;
          if (optimal >= tooFast && optimal >= tooSlow) paceStr = "Optimal";
          else if (tooFast > optimal && tooFast > tooSlow) paceStr = "Too Fast";
          else if (tooSlow > optimal && tooSlow > tooFast) paceStr = "Too Slow";
        }

        return [
          r.completedAt ? format(r.completedAt.toDate(), 'MMM dd, yyyy HH:mm') : 'N/A',
          (r.exerciseType?.replace('_', ' ') || 'UNKNOWN').toUpperCase(),
          (r.reps?.toString() || '0'),
          `${r.accuracy ?? 0}%`,
          paceStr
        ];
      });

      autoTable(doc, {
        startY: 90,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }, // emerald-500
        styles: { fontSize: 10, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] } // slate-50
      });

      doc.save(`physio_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      const resultsRef = collection(db, 'results');
      
      let q;
      if (profile?.role === 'patient') {
        q = query(resultsRef, where('patientId', '==', profile.uid));
      } else {
        const targetPatientId = location.state?.patientId;
        if (targetPatientId) {
          q = query(resultsRef, where('doctorId', '==', profile?.uid), where('patientId', '==', targetPatientId));
        } else {
          q = query(resultsRef, where('doctorId', '==', profile?.uid));
        }
      }
      
      const snapshot = await getDocs(q);
      const data: ResultData[] = [];
      
      const now = new Date();
      const startDate = timeRange === 'month' ? startOfMonth(now) : subDays(now, 7);
      const endDate = timeRange === 'month' ? endOfMonth(now) : now;

      snapshot.forEach((doc) => {
        const result = { id: doc.id, ...(doc.data() as object) } as ResultData;
        if (result.completedAt) {
          const date = result.completedAt.toDate();
          if (isWithinInterval(date, { start: startDate, end: endDate })) {
            data.push(result);
          }
        }
      });

      // Sort by date ascending
      data.sort((a, b) => a.completedAt.toDate().getTime() - b.completedAt.toDate().getTime());
      setResults(data);
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const performanceData = results.map(r => ({
    date: format(r.completedAt.toDate(), 'MMM dd'),
    accuracy: r.accuracy
  }));

  const repsData = results.reduce((acc: any[], curr) => {
    const date = format(curr.completedAt.toDate(), 'MMM dd');
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.reps += curr.reps || 0;
    } else {
      acc.push({ date, reps: curr.reps || 0 });
    }
    return acc;
  }, []);

  let totalOptimal = 0;
  let totalFast = 0;
  let totalSlow = 0;
  
  results.forEach(r => {
    if (r.paceStats) {
      totalOptimal += r.paceStats.optimal || 0;
      totalFast += r.paceStats.tooFast || 0;
      totalSlow += r.paceStats.tooSlow || 0;
    }
  });

  const paceData = [
    { name: 'Optimal', value: totalOptimal },
    { name: 'Too Fast', value: totalFast },
    { name: 'Too Slow', value: totalSlow }
  ].filter(d => d.value > 0);

  const avgAccuracy = results.length > 0 
    ? Math.round(results.reduce((acc, curr) => acc + curr.accuracy, 0) / results.length) 
    : 0;
    
  const accuracyPieData = [
    { name: 'Correct Posture', value: avgAccuracy },
    { name: 'Incorrect Posture', value: 100 - avgAccuracy }
  ];

  const totalReps = results.reduce((acc, curr) => acc + (curr.reps || 0), 0);
  const totalSessions = results.length;

  const COLORS = ['#10b981', '#f43f5e', '#f59e0b'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-200">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <button 
              onClick={() => navigate(profile?.role === 'doctor' ? '/doctor' : '/patient')}
              className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-4 px-3 py-1 rounded-lg hover:bg-white/20 dark:hover:bg-slate-800/20 backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Performance Analytics</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Track your physiotherapy progress and insights</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-white/40 dark:bg-slate-800/40 p-1 rounded-xl border border-white/20 dark:border-slate-700/30 flex transition-all duration-200 backdrop-blur-md shadow-lg">
              <button 
                onClick={() => setTimeRange('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === 'week' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-slate-700/20'}`}
              >
                This Week
              </button>
              <button 
                onClick={() => setTimeRange('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === 'month' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-slate-700/20'}`}
              >
                This Month
              </button>
            </div>
            <button 
              onClick={handleExport}
              disabled={isExporting || results.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all backdrop-blur-md shadow-lg ${
                isExporting || results.length === 0
                  ? 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-300/30 dark:border-slate-700/30 cursor-not-allowed'
                  : 'bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-700/60 text-slate-900 dark:text-white border-white/20 dark:border-slate-700/30'
              }`}
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isExporting ? 'Generating...' : 'Export'}</span>
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-600 dark:text-slate-400 font-medium">Total Sessions</h3>
              <div className="p-2 bg-blue-100/50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl backdrop-blur-md">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalSessions}</p>
          </div>
          
          <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-600 dark:text-slate-400 font-medium">Average Accuracy</h3>
              <div className="p-2 bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl backdrop-blur-md">
                <Target className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{avgAccuracy}%</p>
          </div>
          
          <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-600 dark:text-slate-400 font-medium">Total Reps</h3>
              <div className="p-2 bg-purple-100/50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl backdrop-blur-md">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalReps}</p>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-12 rounded-3xl text-center transition-all duration-200 shadow-xl">
            <Activity className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">No data available</h3>
            <p className="text-slate-500 dark:text-slate-400">Complete some exercises to see your analytics here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Over Time */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-6">Accuracy Over Time</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.2} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(51, 65, 85, 0.5)', color: '#f8fafc', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Reps Tracking */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-6">Reps Completed</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.2} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(51, 65, 85, 0.5)', color: '#f8fafc', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                      cursor={{ fill: 'rgba(51, 65, 85, 0.2)', radius: 4 }}
                    />
                    <Bar dataKey="reps" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Posture Accuracy Breakdown */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-6">Posture Accuracy Breakdown</h3>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accuracyPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {accuracyPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(51, 65, 85, 0.5)', color: '#f8fafc', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                      formatter={(value) => `${value}%`}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pace Analysis */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 p-6 rounded-3xl transition-all duration-200 shadow-xl">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-6">Pace Analysis</h3>
              {paceData.length > 0 ? (
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(51, 65, 85, 0.5)', color: '#f8fafc', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  No pace data available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
