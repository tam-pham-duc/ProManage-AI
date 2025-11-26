
import React, { useState, useEffect, useMemo } from 'react';
import { Milestone, MilestoneHorizon, MilestoneStatus } from '../types';
import { Flag, Plus, CheckCircle2, Clock, XCircle, Award, Calendar, Target, Mountain, Footprints, Map, Telescope, ChevronRight, CheckSquare, Medal, AlertCircle, AlertTriangle, Filter } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useNotification } from '../context/NotificationContext';
import { useCelebration } from '../hooks/useCelebration';

interface MilestonesViewProps {
  projectId: string;
  isReadOnly?: boolean;
}

const HORIZON_ORDER: MilestoneHorizon[] = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', '3-Year', '5-Year'];

const MICRO_HORIZONS: MilestoneHorizon[] = ['Daily', 'Weekly'];
const MESO_HORIZONS: MilestoneHorizon[] = ['Monthly', 'Quarterly', 'Yearly'];
const MACRO_HORIZONS: MilestoneHorizon[] = ['3-Year', '5-Year'];

// Safe Date Parser
const parseDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    try {
        if (typeof timestamp === 'object' && 'seconds' in timestamp) {
            return new Date(timestamp.seconds * 1000);
        }
        if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
};

const getEffectiveStatus = (m: Milestone): 'Achieved' | 'Pending' | 'Missed' => {
    if (m.status === 'Achieved') return 'Achieved';
    
    const date = parseDate(m.targetDate);
    if (!date) return 'Pending';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    if (target < today) return 'Missed';
    
    return 'Pending';
};

const getOverdueDays = (date: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(date);
    target.setHours(0,0,0,0);
    const diff = today.getTime() - target.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const MilestonesView: React.FC<MilestonesViewProps> = ({ projectId, isReadOnly }) => {
  const { notify } = useNotification();
  const { triggerCelebration } = useCelebration();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Achieved' | 'Missed'>('All');

  // Modal State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [horizon, setHorizon] = useState<MilestoneHorizon>('Monthly');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('Pending');

  useEffect(() => {
    if (!projectId) return;
    
    // Real-time subscription with ordering
    const q = query(
        collection(db, 'projects', projectId, 'milestones'), 
        orderBy('targetDate', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
      setMilestones(data);
    });
    
    return () => unsubscribe();
  }, [projectId]);

  // Group milestones strictly by Horizon key with Filtering
  const milestonesByHorizon = useMemo(() => {
    const groups: Record<string, Milestone[]> = {};
    HORIZON_ORDER.forEach(h => groups[h] = []);
    
    milestones.forEach(m => {
        const effectiveStatus = getEffectiveStatus(m);
        
        // Apply Filter
        if (filterStatus === 'All' || effectiveStatus === filterStatus) {
            if (groups[m.horizon]) {
                groups[m.horizon].push(m);
            }
        }
    });
    
    return groups;
  }, [milestones, filterStatus]);

  const openModal = (defaultHorizon?: MilestoneHorizon, milestone?: Milestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setTitle(milestone.title);
      setDescription(milestone.description || '');
      setHorizon(milestone.horizon);
      setTargetDate(milestone.targetDate);
      setStatus(milestone.status);
    } else {
      setEditingMilestone(null);
      setTitle('');
      setDescription('');
      setHorizon(defaultHorizon || 'Monthly');
      setTargetDate(new Date().toISOString().split('T')[0]);
      setStatus('Pending');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) {
      notify('error', 'Title and Target Date are required.');
      return;
    }

    try {
      const payload = {
        title, description, horizon, targetDate, status,
        projectId
      };

      if (editingMilestone) {
        await updateDoc(doc(db, 'projects', projectId, 'milestones', editingMilestone.id), payload);
        notify('success', 'Milestone updated');
      } else {
        await addDoc(collection(db, 'projects', projectId, 'milestones'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        notify('success', 'Milestone created');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      notify('error', 'Failed to save milestone');
    }
  };

  const handleStatusToggle = async (m: Milestone) => {
    if (isReadOnly) return;
    
    const newStatus = m.status === 'Pending' ? 'Achieved' : 'Pending';
    const isMajor = ['Yearly', '3-Year', '5-Year'].includes(m.horizon);

    try {
      await updateDoc(doc(db, 'projects', projectId, 'milestones', m.id), {
        status: newStatus,
        achievedAt: newStatus === 'Achieved' ? serverTimestamp() : null
      });
      
      if (newStatus === 'Achieved') {
        notify('success', 'Milestone Achieved!');
        if (isMajor) triggerCelebration();
      }
    } catch (error) {
      notify('error', 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Delete this milestone?")) return;
      try {
          await deleteDoc(doc(db, 'projects', projectId, 'milestones', id));
          notify('success', 'Milestone deleted');
          setIsModalOpen(false);
      } catch(e) {
          notify('error', 'Failed to delete');
      }
  };

  // --- Component: Milestone Card ---
  const MilestoneCard: React.FC<{ m: Milestone; variant: 'micro' | 'meso' | 'macro' }> = ({ m, variant }) => {
    const effectiveStatus = getEffectiveStatus(m);
    const isAchieved = effectiveStatus === 'Achieved';
    const isMissed = effectiveStatus === 'Missed';
    
    // Safe date check
    let dateObj = parseDate(m.targetDate);
    if (!dateObj) dateObj = new Date();
    
    const overdueDays = isMissed ? getOverdueDays(dateObj) : 0;

    // --- 1. MACRO (Vision) Style ---
    if (variant === 'macro') {
        return (
            <div 
                onClick={() => openModal(m.horizon, m)}
                className={`
                    relative p-6 rounded-2xl shadow-lg transition-all duration-500 cursor-pointer overflow-hidden group hover:-translate-y-1 hover:shadow-2xl
                    ${isAchieved 
                        ? 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-white ring-2 ring-amber-200' 
                        : isMissed
                            ? 'bg-gradient-to-br from-red-900 to-slate-900 text-white border-2 border-red-500'
                            : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700'
                    }
                `}
            >
                {/* Background Watermark Icon */}
                <div className={`absolute -bottom-4 -right-4 opacity-10 pointer-events-none transition-transform group-hover:scale-110 duration-700 ${isMissed ? 'text-red-500' : 'text-white'}`}>
                    {isAchieved ? <Medal size={120} /> : isMissed ? <AlertTriangle size={120} /> : <Mountain size={120} />}
                </div>

                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isAchieved ? 'bg-white/20 text-white' : isMissed ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-indigo-200'}`}>
                            {m.horizon} Vision
                        </span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleStatusToggle(m); }}
                            className={`p-2 rounded-full transition-all hover:scale-110 ${isAchieved ? 'bg-white text-amber-500 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {isAchieved ? <Award size={20} fill="currentColor" /> : <CheckCircle2 size={20} />}
                        </button>
                    </div>

                    <h3 className="text-2xl font-bold leading-tight mb-2 tracking-wide drop-shadow-md">
                        {m.title}
                    </h3>
                    
                    {isMissed && (
                        <div className="inline-flex items-center gap-1 text-red-300 font-bold text-xs bg-red-900/50 px-2 py-1 rounded mb-3">
                            <AlertTriangle size={12} /> Overdue by {overdueDays} days
                        </div>
                    )}
                    
                    {m.description && (
                        <p className={`text-sm mb-4 line-clamp-3 ${isAchieved ? 'text-white/90 font-medium' : 'text-slate-400'}`}>
                            {m.description}
                        </p>
                    )}

                    <div className="mt-auto flex items-center gap-2 text-xs font-medium opacity-80">
                        <Calendar size={14} />
                        <span>Target: {dateObj.toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        );
    }

    // --- 2. MESO (Tactical) Style ---
    if (variant === 'meso') {
        // Horizon specific accent colors
        const accentColor = 
            m.horizon === 'Yearly' ? 'border-pink-500' :
            m.horizon === 'Quarterly' ? 'border-purple-500' :
            'border-indigo-500'; // Monthly

        return (
            <div 
                onClick={() => openModal(m.horizon, m)}
                className={`
                    relative p-4 rounded-xl shadow-sm transition-all hover:shadow-md cursor-pointer group border
                    ${isAchieved 
                        ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900 border-l-4 border-l-emerald-500' 
                        : isMissed
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 border-l-4 border-l-red-500'
                            : `bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 border-l-4 ${accentColor}`
                    }
                `}
            >
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded 
                                ${isAchieved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
                                : isMissed ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                {m.horizon}
                            </span>
                            {isMissed && <span className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle size={10}/> {overdueDays}d late</span>}
                        </div>
                        <h4 className={`font-bold leading-snug 
                            ${isAchieved ? 'text-emerald-800 dark:text-emerald-200' 
                            : isMissed ? 'text-red-800 dark:text-red-200' 
                            : 'text-slate-800 dark:text-slate-200'}`}>
                            {m.title}
                        </h4>
                        <div className={`flex items-center gap-2 mt-2 text-xs ${isMissed ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            <Clock size={12} />
                            <span>{dateObj.toLocaleDateString()}</span>
                        </div>
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); handleStatusToggle(m); }}
                        className={`
                            shrink-0 p-1.5 rounded-full border transition-all
                            ${isAchieved 
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110' 
                                : isMissed
                                    ? 'border-red-300 text-red-400 hover:border-red-500 hover:text-red-600 hover:bg-red-50'
                                    : 'border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500'
                            }
                        `}
                    >
                        <CheckCircle2 size={18} fill={isAchieved ? 'currentColor' : 'none'} />
                    </button>
                </div>
            </div>
        );
    }

    // --- 3. MICRO (Execution) Style ---
    return (
        <div 
            onClick={() => openModal(m.horizon, m)}
            className={`
                flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
                ${isAchieved 
                    ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 opacity-70 grayscale' 
                    : isMissed
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50'
                }
            `}
        >
            <button 
                onClick={(e) => { e.stopPropagation(); handleStatusToggle(m); }}
                className={`shrink-0 transition-colors ${isAchieved ? 'text-emerald-500' : isMissed ? 'text-red-400 hover:text-red-600' : 'text-slate-300 hover:text-slate-500'}`}
            >
                {isAchieved ? <CheckCircle2 size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-current"></div>}
            </button>
            
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isAchieved ? 'text-slate-500 line-through' : isMissed ? 'text-red-800 dark:text-red-200' : 'text-slate-800 dark:text-slate-200'}`}>
                    {m.title}
                </p>
                <p className={`text-[10px] flex items-center gap-1 ${isMissed ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-400'}`}>
                    <Calendar size={10} /> 
                    {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {isMissed && <span>({overdueDays}d overdue)</span>}
                </p>
            </div>
            
            {isMissed && <AlertTriangle size={16} className="text-red-500 shrink-0 animate-pulse" />}
        </div>
    );
  };

  // --- Column Renderer ---
  const renderColumn = (
      title: string, 
      description: string,
      horizons: MilestoneHorizon[], 
      Icon: any, 
      variant: 'micro' | 'meso' | 'macro',
      headerClass: string
  ) => {
      const hasMilestones = horizons.some(h => milestonesByHorizon[h].length > 0);

      return (
        <div className="flex flex-col h-full min-w-[300px] bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
            {/* Column Header */}
            <div className={`p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm ${headerClass}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-current">
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                </div>
                {!isReadOnly && (
                    <button 
                        onClick={() => openModal(horizons[0])} 
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {!hasMilestones ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 space-y-2 min-h-[200px]">
                        <Icon size={32} strokeWidth={1.5} />
                        <p className="text-xs italic">No milestones found.</p>
                    </div>
                ) : (
                    horizons.map(horizon => {
                        const items = milestonesByHorizon[horizon];
                        if (items.length === 0) return null;

                        return (
                            <div key={horizon} className="space-y-3 animate-fade-in">
                                <div className="flex items-center gap-2 px-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                        {horizon}
                                    </span>
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                </div>
                                <div className={`${variant === 'micro' ? 'space-y-2' : 'grid grid-cols-1 gap-3'}`}>
                                    {items.map(m => <MilestoneCard key={m.id} m={m} variant={variant} />)}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Main View Header */}
      <div className="mb-6 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Flag className="text-indigo-500" size={28} />
            Horizon Board
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Align daily execution with long-term vision.</p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Filter Controls */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {(['All', 'Pending', 'Achieved', 'Missed'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`
                            px-3 py-1.5 text-xs font-bold rounded-md transition-all
                            ${filterStatus === status 
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }
                        `}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {!isReadOnly && (
                <button 
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95"
                >
                    <Plus size={16} /> Add Goal
                </button>
            )}
        </div>
      </div>

      {/* Horizon Board Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 pb-6">
        
        {/* 1. Execution (Micro) */}
        {renderColumn(
            'Execution', 
            'Daily & Weekly Targets', 
            MICRO_HORIZONS, 
            Footprints, 
            'micro',
            'text-emerald-600'
        )}

        {/* 2. Tactical (Meso) */}
        {renderColumn(
            'Tactical', 
            'Monthly to Yearly Goals', 
            MESO_HORIZONS, 
            Map, 
            'meso',
            'text-blue-600'
        )}

        {/* 3. Vision (Macro) */}
        {renderColumn(
            'Vision', 
            'Long-term Strategy', 
            MACRO_HORIZONS, 
            Telescope, 
            'macro',
            'text-indigo-600'
        )}

      </div>

      {/* Milestone Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target className="text-indigo-500" /> {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
                </h2>
                
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Goal Title</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white font-medium"
                            placeholder="e.g., Reach $1M Revenue"
                            autoFocus
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time Horizon</label>
                            <select 
                                value={horizon} 
                                onChange={(e) => setHorizon(e.target.value as MilestoneHorizon)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white cursor-pointer"
                            >
                                {HORIZON_ORDER.map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Date</label>
                            <input 
                                type="date" 
                                value={targetDate} 
                                onChange={(e) => setTargetDate(e.target.value)} 
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <textarea 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white h-24 resize-none text-sm"
                            placeholder="Details about this goal..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        {editingMilestone && (
                            <button 
                                type="button" 
                                onClick={() => handleDelete(editingMilestone.id)}
                                className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            >
                                Delete
                            </button>
                        )}
                        <div className="flex-1"></div>
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg transition-colors"
                        >
                            Save Goal
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default MilestonesView;
