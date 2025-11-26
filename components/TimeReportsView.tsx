
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, PieChart, Clock, Users, Briefcase, Download, Calendar, ChevronDown, User, Layers, FileText, Search, Activity, BarChart3, Zap } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Task, TimeLog, Project } from '../types';
import { getAvatarColor, getAvatarInitials } from '../utils/avatarUtils';

interface TimeReportsViewProps {
  projectId?: string | null;
  projects?: Project[];
}

// Flattened Log Interface for Reporting
interface FlatTimeLog {
  logId: string;
  date: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  project: {
    id: string;
    name: string;
  };
  task: {
    id: string;
    title: string;
  };
  time: {
    start: number;
    end: number;
    duration: number;
  };
  notes?: string;
}

interface FilterOption {
  id: string;
  label: string;
}

type GroupByType = 'none' | 'project' | 'user';

interface HeatmapCell {
    date: string;
    hours: number;
    intensity: number;
}

interface WorkloadItem {
    name: string;
    value: number;
    percentage: number;
    color: string;
}

// Helper to safely parse various date formats
const parseLogDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') return new Date(val);
    if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
    if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
    return null;
};

// Helper: Generate Productivity Heatmap Data
const generateHeatmapData = (logs: FlatTimeLog[], startStr: string, endStr: string): HeatmapCell[] => {
    if (!startStr || !endStr) return [];
    
    // Parse as Local Time to match day boundaries
    let start = new Date(startStr + 'T00:00:00');
    let end = new Date(endStr + 'T23:59:59');
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    // Cap visual range to last 60 days to prevent UI overflow
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 60) {
        start = new Date(end);
        start.setDate(end.getDate() - 60);
        start.setHours(0,0,0,0);
    }

    // Aggregate hours per local date
    const dailyMap: Record<string, number> = {};
    logs.forEach(l => {
        // Use local YYYY-MM-DD key
        const k = l.date.toLocaleDateString('en-CA'); 
        // Add hours (if date is within the render window)
        // Note: logs are already filtered by the broader range, but we check against the capped start
        if (l.date >= start) {
            dailyMap[k] = (dailyMap[k] || 0) + (l.time.duration / 3600);
        }
    });

    const data: HeatmapCell[] = [];
    const curr = new Date(start);
    
    // Iterate day by day
    while (curr <= end) {
        const dKey = curr.toLocaleDateString('en-CA');
        const val = dailyMap[dKey] || 0;
        
        let intensity = 0;
        if (val > 0) intensity = 1;   // < 2h
        if (val >= 2) intensity = 2;  // 2-4h
        if (val >= 4) intensity = 3;  // 4-8h
        if (val >= 8) intensity = 4;  // 8+h

        data.push({
            date: dKey,
            hours: val,
            intensity
        });
        curr.setDate(curr.getDate() + 1);
    }
    return data;
};

// Helper: Calculate Peak Activity Hours
const calculatePeakHours = (logs: FlatTimeLog[]) => {
    const hours = new Array(24).fill(0);
    
    logs.forEach(log => {
        // Use local time hour
        const h = new Date(log.time.start).getHours();
        if (h >= 0 && h < 24) {
            hours[h]++;
        }
    });

    const maxCount = Math.max(...hours);
    const peakHourIdx = hours.indexOf(maxCount);
    
    // Format label (e.g., 14:00)
    const peakLabel = maxCount > 0 
        ? new Date(new Date().setHours(peakHourIdx, 0)).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) 
        : 'N/A';

    return { hoursData: hours, maxCount, peakHourIdx, peakLabel };
};

// Helper: Calculate Workload Distribution
const calculateWorkloadDistribution = (logs: FlatTimeLog[]): WorkloadItem[] => {
    const projCounts: Record<string, number> = {};
    let totalDuration = 0;

    logs.forEach(log => {
        const name = log.project.name || 'Unknown Project';
        projCounts[name] = (projCounts[name] || 0) + log.time.duration;
        totalDuration += log.time.duration;
    });

    if (totalDuration === 0) return [];

    const sortedProjects = Object.entries(projCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const result: WorkloadItem[] = [];

    // Logic: Top 4 + Others
    const topLimit = 4;
    
    sortedProjects.forEach((p, index) => {
        if (index < topLimit) {
            result.push({
                name: p.name,
                value: p.value,
                percentage: (p.value / totalDuration) * 100,
                color: colors[index % colors.length]
            });
        } else {
            // Aggregate into 'Others'
            const othersIndex = result.findIndex(r => r.name === 'Others');
            if (othersIndex >= 0) {
                result[othersIndex].value += p.value;
                result[othersIndex].percentage = (result[othersIndex].value / totalDuration) * 100;
            } else {
                result.push({
                    name: 'Others',
                    value: p.value,
                    percentage: (p.value / totalDuration) * 100,
                    color: '#94a3b8' // Slate-400
                });
            }
        }
    });

    return result;
};

const TimeReportsView: React.FC<TimeReportsViewProps> = ({ projectId, projects = [] }) => {
  const [loading, setLoading] = useState(true);
  const [globalTimeLogs, setGlobalTimeLogs] = useState<FlatTimeLog[]>([]);
  
  // Filter Options State
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [userOptions, setUserOptions] = useState<FilterOption[]>([]);
  
  // Lookup Maps
  const [metadata, setMetadata] = useState<{
      users: Record<string, { name: string; email: string; avatar?: string }>;
      projects: Record<string, string>;
  }>({ users: {}, projects: {} });

  // Active Filters
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
      const d = new Date();
      // Default to 1st of current month
      return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
      const d = new Date();
      return d.toISOString().split('T')[0];
  });

  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupByType>('none');

  const isProjectMode = !!projectId;
  const currentProjectName = isProjectMode ? (projects.find(p => p.id === projectId)?.name || metadata.projects[projectId!] || 'Current Project') : null;

  // --- Effect 1: Fetch Metadata (Users & Projects) ---
  useEffect(() => {
      const fetchMetadata = async () => {
          try {
              // 1. Fetch Users
              const usersSnap = await getDocs(collection(db, 'users'));
              const usersMap: Record<string, any> = {};
              const uOptions = usersSnap.docs.map(doc => {
                  const d = doc.data();
                  const info = { 
                      name: d.username || d.displayName || d.email || 'Unknown User',
                      email: d.email || '',
                      avatar: d.avatar
                  };
                  usersMap[doc.id] = info;
                  return { id: doc.id, label: info.name };
              });
              setUserOptions(uOptions);

              // 2. Fetch Projects
              const projectMap: Record<string, string> = {};
              let pOptions: FilterOption[] = [];
              
              if (isProjectMode && projectId) {
                  // Single Project Mode
                  const found = projects.find(p => p.id === projectId);
                  if (found) {
                      pOptions = [{ id: found.id, label: found.name }];
                      projectMap[found.id] = found.name;
                  } else {
                      // Fallback fetch if not in props
                      const pDoc = await getDocs(query(collection(db, 'projects'), where('__name__', '==', projectId)));
                      if (!pDoc.empty) {
                          const d = pDoc.docs[0].data();
                          pOptions = [{ id: pDoc.docs[0].id, label: d.name }];
                          projectMap[pDoc.docs[0].id] = d.name;
                      }
                  }
                  setFilterProject(projectId);
              } else {
                  // Global Mode
                  if (projects.length > 0) {
                      projects.forEach(p => {
                          pOptions.push({ id: p.id, label: p.name });
                          projectMap[p.id] = p.name;
                      });
                  } else {
                      const q = query(collection(db, 'projects'), where('isDeleted', '==', false));
                      const snap = await getDocs(q);
                      snap.docs.forEach(d => {
                          const name = d.data().name;
                          pOptions.push({ id: d.id, label: name });
                          projectMap[d.id] = name;
                      });
                  }
              }
              setProjectOptions(pOptions);
              setMetadata({ users: usersMap, projects: projectMap });

          } catch (e) {
              console.error("Error fetching metadata:", e);
          }
      };

      fetchMetadata();
  }, [projectId, projects, isProjectMode]);

  // --- Effect 2: Fetch & Aggregate Logs ---
  useEffect(() => {
    if (Object.keys(metadata.users).length === 0 && Object.keys(metadata.projects).length === 0) return;

    const fetchReportData = async () => {
      setLoading(true);
      try {
        let tasksQuery;
        
        if (isProjectMode && projectId) {
             tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));
        } else if (filterProject !== 'all') {
             tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', filterProject));
        } else {
             tasksQuery = query(collection(db, 'tasks'));
        }
        
        const tasksSnap = await getDocs(tasksQuery);
        const validTaskDocs = tasksSnap.docs.filter(d => !d.data().isDeleted);

        const flattenedData: FlatTimeLog[] = [];

        validTaskDocs.forEach(doc => {
            const task = doc.data() as Task;
            const logs = task.timeLogs;

            if (Array.isArray(logs) && logs.length > 0) {
                logs.forEach((log: TimeLog) => {
                    const startDate = parseLogDate(log.startTime);
                    const endDate = parseLogDate(log.endTime);

                    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        return;
                    }

                    let duration = log.durationSeconds;
                    if (!duration || duration <= 0) {
                        duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
                    }

                    const userId = log.userId;
                    const projId = task.projectId || 'unknown';
                    
                    const userInfo = metadata.users[userId] || { name: 'Unknown User', email: '', avatar: undefined };
                    const projName = metadata.projects[projId] || 'Unknown Project';

                    flattenedData.push({
                        logId: log.id || Math.random().toString(36),
                        date: startDate,
                        user: {
                            id: userId,
                            name: userInfo.name,
                            email: userInfo.email,
                            avatar: userInfo.avatar
                        },
                        project: {
                            id: projId,
                            name: projName
                        },
                        task: {
                            id: doc.id,
                            title: task.title || 'Untitled Task'
                        },
                        time: {
                            start: startDate.getTime(),
                            end: endDate.getTime(),
                            duration: duration
                        },
                        notes: log.notes
                    });
                });
            }
        });

        flattenedData.sort((a, b) => b.time.start - a.time.start);
        setGlobalTimeLogs(flattenedData);

      } catch (error) {
        console.error("Failed to aggregate time reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [filterProject, metadata, projectId, isProjectMode]);

  // --- Memo: Client-Side Filtering ---
  const filteredLogs = useMemo(() => {
      return globalTimeLogs.filter(log => {
          // 1. User Filter
          if (filterUser !== 'all' && log.user.id !== filterUser) return false;

          // 2. Date Logic (Local Time Boundaries)
          if (!customStartDate || !customEndDate) return true;
          
          const logTime = log.date.getTime();
          const start = new Date(customStartDate + 'T00:00:00').getTime();
          const end = new Date(customEndDate + 'T23:59:59').getTime();

          return logTime >= start && logTime <= end;
      });
  }, [globalTimeLogs, filterUser, customStartDate, customEndDate]);

  // --- Analytics Datasets ---
  const analytics = useMemo(() => {
      // A. Heatmap Data (Using dedicated helper)
      const heatmapData = generateHeatmapData(filteredLogs, customStartDate, customEndDate);

      // B. Peak Hours Data (Using dedicated helper)
      const peakData = calculatePeakHours(filteredLogs);

      // C. Workload Distribution (Using dedicated helper)
      const workloadData = calculateWorkloadDistribution(filteredLogs);

      return { heatmapData, peakData, workloadData };
  }, [filteredLogs, customStartDate, customEndDate]);

  // --- Stats Calculation ---
  const stats = useMemo(() => {
      const totalSeconds = filteredLogs.reduce((acc, log) => acc + log.time.duration, 0);
      const totalHours = (totalSeconds / 3600).toFixed(1);
      const activeUsers = new Set(filteredLogs.map(l => l.user.id)).size;
      let topProject = '-';
      if (analytics.workloadData.length > 0) {
          topProject = analytics.workloadData[0].name;
      }
      return { totalHours, activeUsers, topProject, count: filteredLogs.length };
  }, [filteredLogs, analytics]);

  // --- Grouping Logic ---
  const groupedLogs = useMemo<Record<string, FlatTimeLog[]>>(() => {
      if (groupBy === 'none') return { 'All Logs': filteredLogs };
      const groups: Record<string, FlatTimeLog[]> = {};
      filteredLogs.forEach(log => {
          const key = groupBy === 'project' ? log.project.name : log.user.name;
          if (!groups[key]) groups[key] = [];
          groups[key].push(log);
      });
      return groups;
  }, [filteredLogs, groupBy]);

  // --- Export Handler ---
  const handleExportCSV = () => {
      const headers = ["Date", "Employee Name", "Employee Email", "Project Name", "Task Title", "Start Time", "End Time", "Duration (Decimal Hours)", "Notes"];
      const rows = filteredLogs.map(log => {
          const dateStr = log.date.toISOString().split('T')[0];
          const decimalHours = (log.time.duration / 3600).toFixed(2);
          const notes = `"${(log.notes || '').replace(/"/g, '""')}"`;
          return [
              dateStr,
              log.user.name,
              log.user.email,
              log.project.name,
              `"${log.task.title.replace(/"/g, '""')}"`,
              new Date(log.time.start).toLocaleTimeString(),
              new Date(log.time.end).toLocaleTimeString(),
              decimalHours,
              notes
          ];
      });
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      const scopePrefix = isProjectMode ? `Project_${currentProjectName?.replace(/\s+/g, '_')}` : 'Global';
      const filename = `WorkLogs_${scopePrefix}_${customStartDate}_to_${customEndDate}_${timestamp}.csv`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 animate-fade-in">
        <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Generating Report...</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Aggregating time logs...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in p-6 max-w-[1600px] mx-auto">
      
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            {isProjectMode ? (
                <><span>Projects</span><span className="text-slate-300 dark:text-slate-600">/</span><span className="text-indigo-600 dark:text-indigo-400">{currentProjectName}</span></>
            ) : (
                <><span>Home</span><span className="text-slate-300 dark:text-slate-600">/</span><span className="text-indigo-600 dark:text-indigo-400">Global</span></>
            )}
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <PieChart className="text-indigo-600 dark:text-indigo-400" size={32} />
            {isProjectMode ? `Time Report` : 'Global Time Reports'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
            {isProjectMode ? `Detailed work logs and payroll data for ${currentProjectName}.` : `Payroll & Performance analytics across ${projectOptions.length} active projects.`}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
          
          {/* Filters Left */}
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-end sm:items-center">
              
              {/* Date Pickers */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Calendar size={14} /></span>
                      <input 
                        type="date" 
                        value={customStartDate} 
                        onChange={(e) => setCustomStartDate(e.target.value)} 
                        className="pl-9 pr-3 py-1.5 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                        title="Start Date"
                      />
                  </div>
                  <span className="text-slate-400 text-xs font-bold">to</span>
                  <div className="relative">
                      <input 
                        type="date" 
                        value={customEndDate} 
                        onChange={(e) => setCustomEndDate(e.target.value)} 
                        className="pl-3 pr-3 py-1.5 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]" 
                        title="End Date"
                      />
                  </div>
              </div>

              <div className="relative min-w-[180px]">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none">
                      <option value="all">All Employees</option>
                      {userOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {!isProjectMode ? (
                  <div className="relative min-w-[200px]">
                      <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none">
                          <option value="all">All Projects</option>
                          {projectOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
              ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed">
                      <Briefcase size={14} />
                      <span className="truncate max-w-[150px]">{currentProjectName}</span>
                  </div>
              )}
          </div>

          {/* Actions Right */}
          <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                  <button onClick={() => setGroupBy('none')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === 'none' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Flat</button>
                  {!isProjectMode && <button onClick={() => setGroupBy('project')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === 'project' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Project</button>}
                  <button onClick={() => setGroupBy('user')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === 'user' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>User</button>
              </div>
              <button onClick={handleExportCSV} disabled={filteredLogs.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 active:scale-95 ml-auto xl:ml-0 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Download size={16} /> <span className="hidden sm:inline">Payroll CSV</span>
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2"><Activity size={16} className="text-emerald-500" /> Productivity Heatmap</h3>
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-14 lg:grid-cols-[repeat(auto-fit,minmax(30px,1fr))] gap-2 overflow-hidden">
                  {analytics.heatmapData.map((day) => {
                      let bgClass = 'bg-slate-100 dark:bg-slate-700';
                      if (day.intensity === 1) bgClass = 'bg-emerald-200 dark:bg-emerald-900/40';
                      if (day.intensity === 2) bgClass = 'bg-emerald-300 dark:bg-emerald-800';
                      if (day.intensity === 3) bgClass = 'bg-emerald-400 dark:bg-emerald-600';
                      if (day.intensity === 4) bgClass = 'bg-emerald-600 dark:bg-emerald-400';
                      
                      return (
                          <div key={day.date} className={`aspect-square rounded-lg ${bgClass} flex flex-col items-center justify-center group relative cursor-help transition-all hover:scale-110`}>
                              <span className="text-[10px] font-bold text-slate-500/50 dark:text-slate-400/50 group-hover:text-slate-700 dark:group-hover:text-white transition-colors">{new Date(day.date).getDate()}</span>
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">{day.date}: {day.hours.toFixed(1)}h</div>
                          </div>
                      );
                  })}
              </div>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2"><Zap size={16} className="text-amber-500" /> Peak Activity Hours (Starts)</h3>
                  {analytics.peakData.maxCount > 0 && (
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                          Peak: {analytics.peakData.peakLabel}
                      </span>
                  )}
              </div>
              <div className="h-40 flex items-end gap-1 sm:gap-2">
                  {analytics.peakData.hoursData.map((count, hour) => {
                      const maxVal = analytics.peakData.maxCount;
                      const heightPercent = maxVal > 0 ? (count / maxVal) * 100 : 0;
                      const isPeak = hour === analytics.peakData.peakHourIdx && count > 0;
                      return (
                          <div key={hour} className="flex-1 flex flex-col justify-end group relative">
                              <div className={`w-full rounded-t-md transition-all duration-500 relative group-hover:opacity-80 ${isPeak ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700'}`} style={{ height: `${Math.max(heightPercent, 4)}%` }}></div>
                              {(hour % 4 === 0 || hour === 23) && <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400">{hour}</span>}
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10">{count}</div>
                          </div>
                      );
                  })}
              </div>
              <div className="mt-6 text-xs text-slate-400 text-center">Hour of Day (0-23)</div>
          </div>
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col">
              <h3 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2 mb-4"><BarChart3 size={16} className="text-purple-500" /> Workload Distribution</h3>
              <div className="flex-1 flex items-center justify-center relative">
                  <svg viewBox="0 0 36 36" className="w-32 h-32 transform -rotate-90">
                      {analytics.workloadData.reduce((acc, item, idx) => {
                          const dashArray = `${item.percentage} 100`;
                          const offset = -acc.offset;
                          acc.elements.push(<circle key={idx} cx="18" cy="18" r="15.915" fill="none" stroke={item.color} strokeWidth="4" strokeDasharray={dashArray} strokeDashoffset={offset} className="transition-all duration-1000" />);
                          acc.offset += item.percentage;
                          return acc;
                      }, { offset: 0, elements: [] as React.ReactElement[] }).elements}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs font-bold text-slate-500 uppercase">Total</span><span className="text-lg font-bold text-slate-900 dark:text-white">{stats.totalHours}h</span></div>
              </div>
              <div className="mt-4 space-y-2">{analytics.workloadData.map((item, idx) => (<div key={idx} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2 max-w-[70%]"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div><span className="truncate text-slate-600 dark:text-slate-300" title={item.name}>{item.name}</span></div><span className="font-bold text-slate-900 dark:text-white">{Math.round(item.percentage)}%</span></div>))}</div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"><div><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Man-Hours</p><h3 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalHours}h</h3></div><div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl"><Clock size={24} /></div></div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"><div><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Active Personnel</p><h3 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.activeUsers}</h3></div><div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><Users size={24} /></div></div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"><div><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Top Project</p><h3 className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-[180px]" title={stats.topProject}>{stats.topProject}</h3></div><div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl"><Briefcase size={24} /></div></div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                      <tr><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Date</th><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48">Employee</th>{!isProjectMode && <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48">Project</th>}<th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Task Details</th><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32 text-right">Hours</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {Object.entries(groupedLogs).map(([groupName, logs]) => (
                          <React.Fragment key={groupName}>
                              {groupBy !== 'none' && (logs as FlatTimeLog[]).length > 0 && (<tr className="bg-slate-50/50 dark:bg-slate-800/30"><td colSpan={isProjectMode ? 4 : 5} className="px-6 py-3"><div className="flex items-center gap-2"><Layers size={16} className="text-indigo-500" /><span className="font-bold text-sm text-slate-800 dark:text-white">{groupName}</span><span className="text-xs text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full ml-2">{((logs as FlatTimeLog[]).reduce((acc, l) => acc + l.time.duration, 0) / 3600).toFixed(1)}h</span></div></td></tr>)}
                              {(logs as FlatTimeLog[]).map(log => (
                                  <tr key={log.logId} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                      <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{log.date.toLocaleDateString()}</td>
                                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${getAvatarColor(log.user.name)}`}>{getAvatarInitials(log.user.name)}</div><div><div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{log.user.name}</div><div className="text-[10px] text-slate-400 truncate max-w-[120px]">{log.user.email}</div></div></div></td>
                                      {!isProjectMode && <td className="px-6 py-4"><span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800 truncate max-w-[140px]">{log.project.name}</span></td>}
                                      <td className="px-6 py-4"><div className="flex flex-col"><span className="text-sm font-bold text-slate-800 dark:text-white truncate">{log.task.title}</span>{log.notes ? <span className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 truncate max-w-[300px] flex items-center gap-1"><FileText size={10} /> {log.notes}</span> : <span className="text-xs text-slate-400 mt-0.5">{new Date(log.time.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(log.time.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}</div></td>
                                      <td className="px-6 py-4 text-right"><span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{(log.time.duration / 3600).toFixed(2)}h</span></td>
                                  </tr>
                              ))}
                          </React.Fragment>
                      ))}
                      {filteredLogs.length === 0 && (
                          <tr>
                              <td colSpan={isProjectMode ? 4 : 5} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500">
                                  {globalTimeLogs.length > 0 
                                    ? <><Search size={48} className="mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No logs match your filters.</p></> 
                                    : <><Clock size={48} className="mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No time logs recorded yet.</p></>
                                  }
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Showing {filteredLogs.length} Entries</span><div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">Total: <span className="text-indigo-600 dark:text-indigo-400 text-lg">{stats.totalHours} Hours</span></div></div>
      </div>
    </div>
  );
};

export default TimeReportsView;
