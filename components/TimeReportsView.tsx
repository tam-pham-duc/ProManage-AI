
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, PieChart, Clock, Users, Briefcase, Download, Calendar, ChevronDown, User, Layers, FileText, Search, Activity, BarChart3, Zap, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { Task, TimeLog, Project } from '../types';
import { getAvatarColor, getAvatarInitials } from '../utils/avatarUtils';

interface TimeReportsViewProps {
  projectId?: string | null;
  projects?: Project[];
}

// Flattened Log Interface
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

type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
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

const SUPER_ADMIN_EMAIL = 'admin@dev.com';

// --- HELPER: Date Logic Engine ---

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    return new Date(d.setDate(diff));
};

const getRangeFromAnchor = (type: ReportType, anchor: Date, custom: {start: string, end: string}) => {
    const start = new Date(anchor);
    const end = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    switch (type) {
        case 'daily':
            // Already set to start/end of anchor day
            break;
        case 'weekly':
            const monday = getStartOfWeek(anchor);
            start.setTime(monday.getTime());
            start.setHours(0, 0, 0, 0);
            
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            end.setTime(sunday.getTime());
            end.setHours(23, 59, 59, 999);
            break;
        case 'monthly':
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0); // Last day of month
            break;
        case 'quarterly':
            const currentMonth = anchor.getMonth();
            const qStartMonth = Math.floor(currentMonth / 3) * 3;
            start.setMonth(qStartMonth);
            start.setDate(1);
            
            end.setMonth(qStartMonth + 3);
            end.setDate(0);
            break;
        case 'yearly':
            start.setMonth(0, 1);
            end.setMonth(11, 31);
            break;
        case 'custom':
            if (custom.start) {
                const s = new Date(custom.start);
                s.setHours(0,0,0,0); // Local time start
                // Adjust for timezone offset if input value is UTC-based string
                const offsetS = s.getTimezoneOffset() * 60000;
                start.setTime(s.getTime() + offsetS);
            }
            if (custom.end) {
                const e = new Date(custom.end);
                e.setHours(23,59,59,999);
                const offsetE = e.getTimezoneOffset() * 60000;
                end.setTime(e.getTime() + offsetE);
            }
            break;
    }
    return { start, end };
};

const formatRangeDisplay = (type: ReportType, start: Date, end: Date) => {
    if (type === 'daily') return start.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    if (type === 'weekly') return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    if (type === 'monthly') return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (type === 'quarterly') return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
    if (type === 'yearly') return start.getFullYear().toString();
    return 'Custom Range';
};

// --- HELPER: Analytics Generators ---

const generateHeatmapData = (logs: FlatTimeLog[], start: Date, end: Date): HeatmapCell[] => {
    // Cap visual range to last 60 days if range is huge, or use full range if reasonable
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const dailyMap: Record<string, number> = {};
    logs.forEach(l => {
        if (l.date >= start && l.date <= end) {
            const k = l.date.toLocaleDateString('en-CA'); // YYYY-MM-DD
            dailyMap[k] = (dailyMap[k] || 0) + (l.time.duration / 3600);
        }
    });

    const data: HeatmapCell[] = [];
    const curr = new Date(start);
    
    while (curr <= end) {
        const dKey = curr.toLocaleDateString('en-CA');
        const val = dailyMap[dKey] || 0;
        
        let intensity = 0;
        if (val > 0) intensity = 1;
        if (val >= 2) intensity = 2;
        if (val >= 4) intensity = 3;
        if (val >= 8) intensity = 4;

        data.push({ date: dKey, hours: val, intensity });
        curr.setDate(curr.getDate() + 1);
    }
    return data;
};

const calculatePeakHours = (logs: FlatTimeLog[]) => {
    const hours = new Array(24).fill(0);
    logs.forEach(log => {
        const h = new Date(log.time.start).getHours();
        if (h >= 0 && h < 24) hours[h]++;
    });
    const maxCount = Math.max(...hours);
    const peakHourIdx = hours.indexOf(maxCount);
    const peakLabel = maxCount > 0 
        ? new Date(new Date().setHours(peakHourIdx, 0)).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) 
        : 'N/A';
    return { hoursData: hours, maxCount, peakHourIdx, peakLabel };
};

const calculateWorkloadDistribution = (logs: FlatTimeLog[]): WorkloadItem[] => {
    const projCounts: Record<string, number> = {};
    let totalDuration = 0;
    logs.forEach(log => {
        const name = log.project.name;
        projCounts[name] = (projCounts[name] || 0) + log.time.duration;
        totalDuration += log.time.duration;
    });
    if (totalDuration === 0) return [];

    const sorted = Object.entries(projCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const result: WorkloadItem[] = [];
    
    sorted.forEach((p, index) => {
        if (index < 5) {
            result.push({ name: p.name, value: p.value, percentage: (p.value / totalDuration) * 100, color: colors[index % colors.length] });
        } else {
            const others = result.find(r => r.name === 'Others');
            if (others) {
                others.value += p.value;
                others.percentage = (others.value / totalDuration) * 100;
            } else {
                result.push({ name: 'Others', value: p.value, percentage: (p.value / totalDuration) * 100, color: '#94a3b8' });
            }
        }
    });
    return result;
};

const TimeReportsView: React.FC<TimeReportsViewProps> = ({ projectId, projects = [] }) => {
  const [loading, setLoading] = useState(true);
  const [globalTimeLogs, setGlobalTimeLogs] = useState<FlatTimeLog[]>([]);
  
  // --- 1. Metadata State (Populated First) ---
  const [projectOptions, setProjectOptions] = useState<FilterOption[]>([]);
  const [userOptions, setUserOptions] = useState<FilterOption[]>([]);
  const [metadata, setMetadata] = useState<{
      users: Record<string, { name: string; email: string; avatar?: string }>;
      projects: Record<string, string>;
  }>({ users: {}, projects: {} });

  // --- 2. Date Navigation State ---
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date()); // The reference point (e.g. Today)
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
  });

  // --- 3. Filter State ---
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupByType>('none');

  const isProjectMode = !!projectId;
  const currentProjectName = isProjectMode ? (projects.find(p => p.id === projectId)?.name || metadata.projects[projectId!] || 'Current Project') : null;

  // --- Calculated Range ---
  const { start: rangeStart, end: rangeEnd } = useMemo(() => 
      getRangeFromAnchor(reportType, anchorDate, customRange), 
  [reportType, anchorDate, customRange]);

  // --- Effect: Fetch Metadata with Privacy Rules ---
  useEffect(() => {
      const fetchMetadata = async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) return;

          const isSuperAdmin = currentUser.email === SUPER_ADMIN_EMAIL;

          try {
              const projectMap: Record<string, string> = {};
              const usersMap: Record<string, any> = {};
              let pOptions: FilterOption[] = [];
              let uOptions: FilterOption[] = [];

              // 1. FETCH PROJECTS & USERS BASED ON ROLE
              if (isSuperAdmin) {
                  // --- SUPER ADMIN: FETCH ALL ---
                  const projectsSnap = await getDocs(query(collection(db, 'projects'), where('isDeleted', '==', false)));
                  projectsSnap.docs.forEach(doc => {
                      const data = doc.data();
                      projectMap[doc.id] = data.name;
                      pOptions.push({ id: doc.id, label: data.name });
                  });

                  // Fetch ALL users for Super Admin
                  const usersSnap = await getDocs(collection(db, 'users'));
                  usersSnap.docs.forEach(doc => {
                      const d = doc.data();
                      const info = { name: d.username || d.displayName || d.email, email: d.email, avatar: d.avatar };
                      usersMap[doc.id] = info;
                      uOptions.push({ id: doc.id, label: info.name });
                  });

              } else {
                  // --- REGULAR USER: FETCH ACCESSIBLE ONLY ---
                  const projectsSnap = await getDocs(query(
                      collection(db, 'projects'), 
                      where('memberUIDs', 'array-contains', currentUser.uid), 
                      where('isDeleted', '==', false)
                  ));

                  projectsSnap.docs.forEach(doc => {
                      const data = doc.data();
                      projectMap[doc.id] = data.name;
                      pOptions.push({ id: doc.id, label: data.name });

                      // Extract Users from Project Members (Accessible Users)
                      if (data.members && Array.isArray(data.members)) {
                          data.members.forEach((m: any) => {
                              // Collect unique UIDs from accessible projects
                              if (m.uid && !usersMap[m.uid]) {
                                  usersMap[m.uid] = { 
                                      name: m.displayName || m.email, 
                                      email: m.email, 
                                      avatar: m.avatar 
                                  };
                                  uOptions.push({ id: m.uid, label: m.displayName || m.email });
                              }
                          });
                      }
                  });

                  // Ensure Current User is in User Options
                  if (!usersMap[currentUser.uid]) {
                      usersMap[currentUser.uid] = {
                          name: currentUser.displayName || 'Me',
                          email: currentUser.email || '',
                          avatar: currentUser.photoURL || undefined
                      };
                      uOptions.push({ id: currentUser.uid, label: currentUser.displayName || 'Me' });
                  }
              }

              // 2. CONFIGURE STATE
              
              // Handle Project Mode Pre-selection
              if (isProjectMode && projectId) {
                  // Verify Access
                  if (!projectMap[projectId] && !isSuperAdmin) {
                      // Access Denied or Project Deleted
                      setProjectOptions([]);
                      setUserOptions([]);
                      setMetadata({ users: {}, projects: {} });
                      return;
                  }
                  
                  const foundName = projectMap[projectId];
                  if (foundName) {
                      // In Project Mode, only show current project option
                      pOptions = [{ id: projectId, label: foundName }];
                      setFilterProject(projectId);
                  }
              }

              // Sort Options
              pOptions.sort((a, b) => a.label.localeCompare(b.label));
              uOptions.sort((a, b) => a.label.localeCompare(b.label));

              // Set Options
              if (!isProjectMode) {
                  setProjectOptions([{ id: 'all', label: 'All Projects' }, ...pOptions]);
              } else {
                  setProjectOptions(pOptions);
              }
              
              setUserOptions([{ id: 'all', label: 'All Employees' }, ...uOptions]);
              setMetadata({ users: usersMap, projects: projectMap });

          } catch (e) {
              console.error("Metadata fetch failed", e);
          }
      };
      fetchMetadata();
  }, [projectId, projects, isProjectMode]);

  // --- Effect: Fetch Logs (After Metadata) ---
  useEffect(() => {
      // Don't fetch if we haven't loaded metadata (prevents fetching unmapped IDs)
      if (Object.keys(metadata.users).length === 0 && Object.keys(metadata.projects).length === 0) {
          if (!loading) setLoading(false);
          return;
      }

      const fetchLogs = async () => {
          setLoading(true);
          try {
              let q = query(collection(db, 'tasks'));
              // Server-side filter optimization if single project
              if (isProjectMode && projectId) {
                  q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
              }

              const snap = await getDocs(q);
              const rawLogs: FlatTimeLog[] = [];

              snap.docs.forEach(taskDoc => {
                  const task = taskDoc.data();
                  if (task.isDeleted) return;
                  
                  // PRIVACY CHECK: Skip tasks from projects not in our metadata map (inaccessible)
                  if (!metadata.projects[task.projectId]) return;

                  if (filterProject !== 'all' && !isProjectMode && task.projectId !== filterProject) return;

                  if (task.timeLogs && Array.isArray(task.timeLogs)) {
                      task.timeLogs.forEach((l: any) => {
                          // Safe Date Parsing
                          let d: Date | null = null;
                          if (l.startTime?.seconds) d = new Date(l.startTime.seconds * 1000);
                          else if (typeof l.startTime === 'number') d = new Date(l.startTime);
                          
                          if (d) {
                              // Resolve User from Metadata
                              // PRIVACY CHECK: Only display users that are in our allowed user map
                              const user = metadata.users[l.userId];
                              
                              if (!user) return;

                              const project = { id: task.projectId, name: metadata.projects[task.projectId] || 'Unknown Project' };
                              
                              // Calculate duration if missing
                              let dur = l.durationSeconds;
                              if (!dur) {
                                  const endT = l.endTime?.seconds ? l.endTime.seconds * 1000 : l.endTime;
                                  dur = Math.floor((endT - d.getTime()) / 1000);
                              }

                              rawLogs.push({
                                  logId: l.id,
                                  date: d,
                                  user: { id: l.userId, name: user.name, email: user.email, avatar: user.avatar },
                                  project,
                                  task: { id: taskDoc.id, title: task.title },
                                  time: { start: d.getTime(), end: l.endTime?.seconds ? l.endTime.seconds * 1000 : l.endTime, duration: dur },
                                  notes: l.notes
                              });
                          }
                      });
                  }
              });
              
              rawLogs.sort((a, b) => b.time.start - a.time.start);
              setGlobalTimeLogs(rawLogs);

          } catch (e) {
              console.error(e);
          } finally {
              setLoading(false);
          }
      };
      fetchLogs();
  }, [metadata, filterProject, projectId, isProjectMode]);

  // --- Filter Logs by Calculated Range ---
  const filteredLogs = useMemo(() => {
      const startTs = rangeStart.getTime();
      const endTs = rangeEnd.getTime();

      return globalTimeLogs.filter(log => {
          // User Filter
          if (filterUser !== 'all' && log.user.id !== filterUser) return false;
          // Project Filter (if not handled by fetch)
          if (filterProject !== 'all' && log.project.id !== filterProject) return false;
          
          // Date Range Filter
          const logTs = log.date.getTime();
          return logTs >= startTs && logTs <= endTs;
      });
  }, [globalTimeLogs, rangeStart, rangeEnd, filterUser, filterProject]);

  // --- Navigation Handlers ---
  const handleNavigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(anchorDate);
      const dir = direction === 'next' ? 1 : -1;
      
      if (reportType === 'daily') newDate.setDate(newDate.getDate() + dir);
      if (reportType === 'weekly') newDate.setDate(newDate.getDate() + (dir * 7));
      if (reportType === 'monthly') newDate.setMonth(newDate.getMonth() + dir);
      if (reportType === 'quarterly') newDate.setMonth(newDate.getMonth() + (dir * 3));
      if (reportType === 'yearly') newDate.setFullYear(newDate.getFullYear() + dir);
      
      setAnchorDate(newDate);
  };

  // --- Derived Data for UI ---
  const analytics = useMemo(() => ({
      heatmapData: generateHeatmapData(filteredLogs, rangeStart, rangeEnd),
      peakData: calculatePeakHours(filteredLogs),
      workloadData: calculateWorkloadDistribution(filteredLogs)
  }), [filteredLogs, rangeStart, rangeEnd]);

  const stats = useMemo(() => ({
      totalHours: (filteredLogs.reduce((sum, l) => sum + l.time.duration, 0) / 3600).toFixed(1),
      activeUsers: new Set(filteredLogs.map(l => l.user.id)).size,
      topProject: analytics.workloadData[0]?.name || '-',
      count: filteredLogs.length
  }), [filteredLogs, analytics]);

  const groupedLogs = useMemo(() => {
      if (groupBy === 'none') return { 'All Logs': filteredLogs };
      const groups: Record<string, FlatTimeLog[]> = {};
      filteredLogs.forEach(log => {
          const key = groupBy === 'project' ? log.project.name : log.user.name;
          if (!groups[key]) groups[key] = [];
          groups[key].push(log);
      });
      return groups;
  }, [filteredLogs, groupBy]);

  const handleExport = () => {
      const headers = ["Date", "Employee", "Email", "Project", "Task", "Start", "End", "Hours", "Notes"];
      const rows = filteredLogs.map(l => [
          l.date.toLocaleDateString(),
          l.user.name,
          l.user.email,
          l.project.name,
          `"${l.task.title.replace(/"/g, '""')}"`,
          new Date(l.time.start).toLocaleTimeString(),
          new Date(l.time.end).toLocaleTimeString(),
          (l.time.duration / 3600).toFixed(2),
          `"${(l.notes || '').replace(/"/g, '""')}"`
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TimeReport_${reportType}_${rangeStart.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  return (
    <div className="flex flex-col h-full animate-fade-in p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <PieChart className="text-indigo-600 dark:text-indigo-400" />
                  {isProjectMode ? `Time Report: ${currentProjectName}` : 'Global Time Intelligence'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {formatRangeDisplay(reportType, rangeStart, rangeEnd)} • {stats.count} entries found
              </p>
          </div>
          <div className="flex gap-2">
              {!isProjectMode && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
                      <Briefcase size={14} className="text-slate-400" />
                      <select 
                        value={filterProject} 
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                      >
                          {projectOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                  </div>
              )}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  <select 
                    value={filterUser} 
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                      {userOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
              </div>
          </div>
      </div>

      {/* Advanced Date Navigation Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 flex flex-col lg:flex-row items-center gap-4">
          
          {/* Mode Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl shrink-0 overflow-x-auto max-w-full">
              {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as ReportType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all whitespace-nowrap ${reportType === type ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                      {type}
                  </button>
              ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3 flex-1 w-full justify-center lg:justify-start">
              {reportType !== 'custom' ? (
                  <>
                    <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                        <button onClick={() => handleNavigate('prev')} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={16}/></button>
                        <div className="px-4 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[140px] text-center select-none">
                            {formatRangeDisplay(reportType, rangeStart, rangeEnd)}
                        </div>
                        <button onClick={() => handleNavigate('next')} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><ChevronRight size={16}/></button>
                    </div>
                    <button onClick={() => setAnchorDate(new Date())} className="text-xs font-bold text-indigo-600 hover:underline px-2">Today</button>
                  </>
              ) : (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <input type="date" value={customRange.start} onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
                      <span className="text-slate-400">-</span>
                      <input type="date" value={customRange.end} onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
                  </div>
              )}
          </div>

          {/* View Actions */}
          <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                  <button 
                    onClick={() => setGroupBy('none')} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${groupBy === 'none' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Flat
                  </button>
                  <button 
                    onClick={() => setGroupBy('user')} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${groupBy === 'user' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    User
                  </button>
                  {!isProjectMode && (
                    <button 
                        onClick={() => setGroupBy('project')} 
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${groupBy === 'project' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Project
                    </button>
                  )}
              </div>
              <button onClick={handleExport} disabled={filteredLogs.length === 0} className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Download size={18} /></button>
          </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workload Stats Cards */}
          <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div><p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Hours</p><h3 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalHours}h</h3></div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl"><Clock size={24} /></div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div><p className="text-xs font-bold text-slate-500 uppercase mb-1">Active Staff</p><h3 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.activeUsers}</h3></div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl"><Users size={24} /></div>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2"><BarChart3 size={14}/> Project Distribution</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {analytics.workloadData.map((w, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: w.color}}></div><span className="text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{w.name}</span></div>
                              <span className="font-bold">{Math.round(w.percentage)}%</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* Peak Hours Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Zap size={18} className="text-amber-500" /> Activity Heatmap & Peak Hours</h3>
                  {analytics.peakData.maxCount > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">Peak: {analytics.peakData.peakLabel}</span>}
              </div>
              
              {/* Heatmap Grid */}
              <div className="mb-6">
                  <div className="flex flex-wrap gap-1">
                      {analytics.heatmapData.map((cell) => (
                          <div 
                            key={cell.date} 
                            className={`w-3 h-3 sm:w-4 sm:h-4 rounded-sm ${
                                cell.intensity === 0 ? 'bg-slate-100 dark:bg-slate-700' : 
                                cell.intensity === 1 ? 'bg-emerald-200 dark:bg-emerald-900' :
                                cell.intensity === 2 ? 'bg-emerald-300 dark:bg-emerald-700' :
                                cell.intensity === 3 ? 'bg-emerald-400 dark:bg-emerald-600' :
                                'bg-emerald-600 dark:bg-emerald-500'
                            }`} 
                            title={`${cell.date}: ${cell.hours.toFixed(1)}h`}
                          />
                      ))}
                  </div>
              </div>

              {/* Peak Bar Chart */}
              <div className="h-32 flex items-end gap-1 mt-auto">
                  {analytics.peakData.hoursData.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end group relative">
                          <div 
                            className={`w-full rounded-t-sm transition-all ${i === analytics.peakData.peakHourIdx ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} 
                            style={{ height: `${(h / (analytics.peakData.maxCount || 1)) * 100}%`, minHeight: '4px' }} 
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">{h}</div>
                      </div>
                  ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-mono">
                  <span>00:00</span><span>12:00</span><span>23:00</span>
              </div>
          </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%] text-center">Date</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%] text-left">Employee</th>
                          {!isProjectMode && <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%] text-left">Project</th>}
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">Task / Notes</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[10%] text-center">Hours</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {Object.entries(groupedLogs).map(([group, logs]) => (
                          <React.Fragment key={group}>
                              {groupBy !== 'none' && (
                                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                      <td colSpan={isProjectMode ? 4 : 5} className="px-6 py-2">
                                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                              <Layers size={14} className="text-indigo-500" />
                                              {group}
                                              <span className="text-xs font-normal text-slate-500 ml-2 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                                                  {(logs as FlatTimeLog[]).reduce((acc, l) => acc + l.time.duration, 0) / 3600 < 0.1 ? '0.0' : ((logs as FlatTimeLog[]).reduce((acc, l) => acc + l.time.duration, 0) / 3600).toFixed(1)}h
                                              </span>
                                          </div>
                                      </td>
                                  </tr>
                              )}
                              {(logs as FlatTimeLog[]).map(log => (
                                  <tr key={log.logId} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono truncate text-center">{log.date.toLocaleDateString()}</td>
                                      <td className="px-6 py-4 truncate">
                                          <div className="flex items-center gap-3 overflow-hidden">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 ${getAvatarColor(log.user.name)}`}>{getAvatarInitials(log.user.name)}</div>
                                              <div className="min-w-0"><div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{log.user.name}</div></div>
                                          </div>
                                      </td>
                                      {!isProjectMode && (
                                          <td className="px-6 py-4 truncate"><span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800 truncate block w-fit max-w-full">{log.project.name}</span></td>
                                      )}
                                      <td className="px-6 py-4 text-left">
                                          <div className="flex flex-col min-w-0">
                                              <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{log.task.title}</span>
                                              {log.notes && <span className="text-xs text-slate-500 italic flex items-center gap-1 mt-0.5 truncate"><FileText size={10} className="shrink-0"/> {log.notes}</span>}
                                              <span className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{new Date(log.time.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(log.time.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{(log.time.duration / 3600).toFixed(2)}h</span>
                                      </td>
                                  </tr>
                              ))}
                          </React.Fragment>
                      ))}
                      {filteredLogs.length === 0 && (
                          <tr>
                              <td colSpan={isProjectMode ? 4 : 5} className="px-6 py-20 text-center text-slate-400">
                                  <div className="flex flex-col items-center">
                                      <Search size={48} className="opacity-20 mb-4" />
                                      <p className="font-medium">No logs found for this period.</p>
                                      <p className="text-xs mt-1">Try adjusting the date range or filters.</p>
                                  </div>
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default TimeReportsView;
