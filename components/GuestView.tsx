
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Project, Task } from '../types';
import Timeline from './Timeline';
import MilestonesView from './MilestonesView';
import { Loader2, LayoutDashboard, AlertCircle, Briefcase, User, MapPin, Wallet, TrendingUp, CheckCircle2, Clock, Lock } from 'lucide-react';
import { sanitizeFirestoreData } from '../utils/dataUtils';

interface GuestViewProps {
  token: string;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
};

// Simplified Donut Chart for Guest View
const StatusChart: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const stats = useMemo(() => {
        const total = tasks.length;
        if (total === 0) return { total: 0, active: 0, completed: 0, data: [] };

        const done = tasks.filter(t => t.status === 'Done').length;
        const active = tasks.filter(t => t.status === 'In Progress').length;
        const todo = tasks.filter(t => t.status === 'To Do').length;
        
        // Simple segments: Done (Green), Active (Blue), Todo (Gray)
        const data = [
            { label: 'Done', value: done, color: 'text-emerald-500' },
            { label: 'In Progress', value: active, color: 'text-blue-500' },
            { label: 'To Do', value: todo, color: 'text-slate-300' }
        ];

        let acc = 0;
        const segments = data.map(d => {
            const pct = d.value / total;
            const dash = `${pct * 100} 100`;
            const offset = -acc * 100;
            acc += pct;
            return { ...d, dash, offset };
        });

        return { total, active, completed: done, data: segments };
    }, [tasks]);

    if (stats.total === 0) return null;

    return (
        <div className="flex items-center gap-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full">
            <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                    {stats.data.map((d, i) => (
                        <path key={i} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={d.dash} strokeDashoffset={d.offset} className={`${d.color} transition-all duration-1000`} />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-900">{Math.round((stats.completed / stats.total) * 100)}%</span>
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Complete</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Done</span><span className="font-bold">{stats.completed}</span></div>
                <div className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>In Progress</span><span className="font-bold">{stats.active}</span></div>
                <div className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span>To Do</span><span className="font-bold">{stats.total - stats.completed - stats.active}</span></div>
            </div>
        </div>
    );
};

const FinancialCard: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const stats = useMemo(() => {
        const budget = tasks.reduce((sum, t) => sum + (t.estimatedCost || 0), 0);
        const spent = tasks.reduce((sum, t) => sum + (t.actualCost || 0), 0);
        const variance = budget - spent;
        return { budget, spent, variance };
    }, [tasks]);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Wallet size={16} /> Financial Overview
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-slate-500 mb-1">Budget</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.budget)}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 mb-1">Spent</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(stats.spent)}</p>
                </div>
            </div>
            <div className={`flex items-center gap-2 text-sm font-bold ${stats.variance >= 0 ? 'text-emerald-600' : 'text-red-600'} pt-4 border-t border-slate-100`}>
                <TrendingUp size={16} />
                {stats.variance >= 0 ? 'Under Budget' : 'Over Budget'}: {formatCurrency(Math.abs(stats.variance))}
            </div>
        </div>
    );
};

const GuestView: React.FC<GuestViewProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        try {
            // 1. Find Project by Token
            const projectsRef = collection(db, 'projects');
            const q = query(projectsRef, where('shareConfig.token', '==', token));
            const snap = await getDocs(q);

            if (snap.empty) {
                setError("Project not found or link expired.");
                setLoading(false);
                return;
            }

            const projectData = { id: snap.docs[0].id, ...sanitizeFirestoreData(snap.docs[0].data()) } as Project;

            if (!projectData.shareConfig?.isEnabled) {
                setError("Sharing has been disabled for this project.");
                setLoading(false);
                return;
            }

            setProject(projectData);

            // 2. Fetch Tasks
            const tasksRef = collection(db, 'tasks');
            const tasksQ = query(tasksRef, where('projectId', '==', projectData.id));
            const tasksSnap = await getDocs(tasksQ);
            
            const loadedTasks = tasksSnap.docs.map(d => ({ id: d.id, ...sanitizeFirestoreData(d.data()) } as Task));
            setTasks(loadedTasks.filter(t => !t.isDeleted));

        } catch (err) {
            console.error("Guest Fetch Error:", err);
            setError("Unable to load project data.");
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [token]);

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
      );
  }

  if (error || !project) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                  <Lock size={32} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
              <p className="text-slate-500 max-w-md">{error || "This link is invalid or has expired."}</p>
              <a href="/" className="mt-8 text-indigo-600 font-bold hover:underline">Return to Home</a>
          </div>
      );
  }

  const config = project.shareConfig!;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {/* Top Navigation */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">P</div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-none">{project.name}</h1>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            {project.clientName && <span className="flex items-center gap-1"><User size={10} /> {project.clientName}</span>}
                            {project.address && <span className="flex items-center gap-1"><MapPin size={10} /> {project.address}</span>}
                        </div>
                    </div>
                </div>
                <div className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Guest Mode
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <StatusChart tasks={tasks} />
                </div>
                {config.showFinancials && (
                    <div>
                        <FinancialCard tasks={tasks} />
                    </div>
                )}
            </div>

            {/* Timeline Module */}
            {config.showTimeline && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="text-indigo-600" /> Project Timeline
                    </h2>
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px]">
                        <Timeline tasks={tasks} isReadOnly={true} />
                    </div>
                </div>
            )}

            {/* Milestones Module */}
            {config.showMilestones && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-600" /> Key Milestones
                    </h2>
                    <div className="h-[500px]">
                        <MilestonesView projectId={project.id} isReadOnly={true} />
                    </div>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="py-8 text-center text-slate-400 text-xs border-t border-slate-200 mt-12 bg-white">
            <p>Powered by <strong>ProManage AI</strong></p>
        </div>
    </div>
  );
};

export default GuestView;
