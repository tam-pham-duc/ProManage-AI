
import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Play, Download, Terminal, Cpu, Wifi, Database, Trash2, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

interface HealthCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticLog {
  id: string;
  timestamp: string;
  category: 'SYSTEM' | 'LATENCY' | 'LOGIC' | 'LIFECYCLE' | 'VOLUME' | 'CLEANUP';
  action: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO' | 'PENDING';
  message: string;
  latency?: number;
}

interface TestMetrics {
  totalTests: number;
  testsRun: number;
  errors: number;
  avgLatency: number;
  totalLatency: number;
  latencyCount: number;
}

const HealthCheckModal: React.FC<HealthCheckModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [metrics, setMetrics] = useState<TestMetrics>({
    totalTests: 0,
    testsRun: 0,
    errors: 0,
    avgLatency: 0,
    totalLatency: 0,
    latencyCount: 0
  });
  const [progress, setProgress] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const addLog = (
    category: DiagnosticLog['category'], 
    action: string, 
    status: DiagnosticLog['status'], 
    message: string, 
    latency?: number
  ) => {
    const entry: DiagnosticLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      category,
      action,
      status,
      message,
      latency
    };
    
    setLogs(prev => [...prev, entry]);
    
    setMetrics(prev => {
      const newErrors = status === 'FAIL' ? prev.errors + 1 : prev.errors;
      const newRun = (status === 'PASS' || status === 'FAIL') ? prev.testsRun + 1 : prev.testsRun;
      let newTotalLat = prev.totalLatency;
      let newLatCount = prev.latencyCount;
      
      if (latency !== undefined) {
        newTotalLat += latency;
        newLatCount += 1;
      }
      
      return {
        ...prev,
        errors: newErrors,
        testsRun: newRun,
        totalLatency: newTotalLat,
        latencyCount: newLatCount,
        avgLatency: newLatCount > 0 ? Math.round(newTotalLat / newLatCount) : 0
      };
    });
  };

  const runAdvancedDiagnostics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setMetrics({ totalTests: 15, testsRun: 0, errors: 0, avgLatency: 0, totalLatency: 0, latencyCount: 0 });
    setProgress(0);

    const currentUser = auth.currentUser;
    if (!currentUser) {
        addLog('SYSTEM', 'Auth Check', 'FAIL', 'No active user session found.');
        setIsRunning(false);
        return;
    }

    addLog('SYSTEM', 'Initialization', 'INFO', `Starting V2 Diagnostic Suite for User: ${currentUser.uid}`);
    
    // Tracking artifacts for cleanup
    let testProjectId = '';
    let testTaskId = '';
    let batchTaskIds: string[] = [];
    const TEST_PREFIX = `DIAG_V2_${Date.now()}`;

    try {
        // =====================================================================
        // PHASE 1: SYSTEM VITAL SIGNS (LATENCY)
        // =====================================================================
        addLog('LATENCY', 'Round Trip Test', 'PENDING', 'Measuring write/read/delete cycle...');
        const startLat = performance.now();
        
        // 1. Create Temp Doc
        const tempRef = await addDoc(collection(db, 'diagnostics_temp'), {
            timestamp: serverTimestamp(),
            testId: TEST_PREFIX
        });
        
        // 2. Read Temp Doc
        await getDoc(tempRef);
        
        // 3. Delete Temp Doc
        await deleteDoc(tempRef);
        
        const endLat = performance.now();
        const rtt = Math.round(endLat - startLat);
        
        if (rtt > 1000) {
            addLog('LATENCY', 'Round Trip Test', 'WARN', `High Latency detected: ${rtt}ms`, rtt);
        } else {
            addLog('LATENCY', 'Round Trip Test', 'PASS', `System responsive. RTT: ${rtt}ms`, rtt);
        }
        setProgress(15);

        // =====================================================================
        // PHASE 2: TASK DEEP LOGIC
        // =====================================================================
        addLog('LOGIC', 'Setup', 'INFO', 'Creating test container project...');
        const projRef = await addDoc(collection(db, 'projects'), {
            name: `${TEST_PREFIX}_PROJECT`,
            ownerId: currentUser.uid,
            status: 'Diagnostic',
            createdAt: new Date().toISOString()
        });
        testProjectId = projRef.id;

        // 2.1 Create Complex Task
        const startTask = performance.now();
        const taskRef = await addDoc(collection(db, 'tasks'), {
            projectId: testProjectId,
            ownerId: currentUser.uid,
            title: 'Logic Test Task',
            status: 'To Do',
            priority: 'Medium',
            subtasks: [],
            comments: [],
            createdAt: serverTimestamp()
        });
        testTaskId = taskRef.id;
        addLog('LOGIC', 'Task Creation', 'PASS', `Task created: ${testTaskId}`, performance.now() - startTask);

        // 2.2 Subtasks Logic
        const startSub = performance.now();
        const subtasks = [
            { id: 's1', title: 'Sub 1', completed: false },
            { id: 's2', title: 'Sub 2', completed: true },
            { id: 's3', title: 'Sub 3', completed: false }
        ];
        await updateDoc(taskRef, { subtasks });
        const snapSub = await getDoc(taskRef);
        if (snapSub.data()?.subtasks?.length === 3) {
            addLog('LOGIC', 'Subtask Array', 'PASS', 'Subtasks persisted correctly', performance.now() - startSub);
        } else {
            throw new Error('Subtask persistence failed');
        }

        // 2.3 Comments Logic
        const startCom = performance.now();
        const comment = { id: 'c1', user: 'TestBot', text: 'Diagnostic Comment', timestamp: new Date().toISOString() };
        await updateDoc(taskRef, { comments: [comment] });
        addLog('LOGIC', 'Comment Thread', 'PASS', 'Comment added successfully', performance.now() - startCom);

        // 2.4 Rich Text Description
        const htmlDesc = '<h1>Header</h1><p>Paragraph</p>';
        await updateDoc(taskRef, { description: htmlDesc });
        const snapRich = await getDoc(taskRef);
        if (snapRich.data()?.description === htmlDesc) {
            addLog('LOGIC', 'Rich Text', 'PASS', 'HTML content persisted exact match');
        } else {
            addLog('LOGIC', 'Rich Text', 'FAIL', 'Content mismatch or sanitization issue');
        }
        setProgress(40);

        // =====================================================================
        // PHASE 3: LIFECYCLE & WORKFLOW (TRASH LOGIC)
        // =====================================================================
        
        // 3.1 Status Transition
        const startMove = performance.now();
        await updateDoc(taskRef, { status: 'Done' });
        addLog('LIFECYCLE', 'Kanban Move', 'PASS', 'Status transitioned to Done', performance.now() - startMove);

        // 3.2 Soft Delete Flow
        addLog('LIFECYCLE', 'Soft Delete', 'INFO', 'Testing Trash Can mechanics...');
        
        // Delete
        await updateDoc(taskRef, { isDeleted: true, deletedAt: serverTimestamp() });
        
        // Verify "Gone" from Active
        // (In a real app we'd query with !isDeleted, here we check the field explicitly)
        const snapDel = await getDoc(taskRef);
        if (snapDel.data()?.isDeleted === true) {
            addLog('LIFECYCLE', 'Soft Delete Action', 'PASS', 'isDeleted flag set true');
        } else {
            throw new Error('Soft delete failed');
        }

        // Verify "Present" in Trash Query
        const qTrash = query(
            collection(db, 'tasks'), 
            where('ownerId', '==', currentUser.uid),
            where('isDeleted', '==', true),
            where('projectId', '==', testProjectId)
        );
        const snapTrash = await getDocs(qTrash);
        if (!snapTrash.empty) {
            addLog('LIFECYCLE', 'Trash Query', 'PASS', 'Item found in trash query');
        } else {
            addLog('LIFECYCLE', 'Trash Query', 'FAIL', 'Item NOT found in trash query');
        }

        // Restore
        const startRest = performance.now();
        await updateDoc(taskRef, { isDeleted: false, deletedAt: null });
        const snapRest = await getDoc(taskRef);
        if (snapRest.data()?.isDeleted === false) {
            addLog('LIFECYCLE', 'Restore Action', 'PASS', 'Item restored to active', performance.now() - startRest);
        } else {
            throw new Error('Restore failed');
        }
        setProgress(70);

        // =====================================================================
        // PHASE 4: VOLUME STRESS TEST
        // =====================================================================
        addLog('VOLUME', 'Batch Write', 'INFO', 'Generating 50 lightweight tasks...');
        const startVol = performance.now();
        const batch = writeBatch(db);
        
        for (let i = 0; i < 50; i++) {
            const ref = doc(collection(db, 'tasks'));
            batchTaskIds.push(ref.id);
            batch.set(ref, {
                projectId: testProjectId,
                ownerId: currentUser.uid,
                title: `Stress_Task_${i}`,
                status: 'To Do',
                priority: 'Low',
                isDeleted: false,
                createdAt: serverTimestamp()
            });
        }
        
        await batch.commit();
        const endVol = performance.now();
        const volDuration = endVol - startVol;
        
        addLog('VOLUME', 'Batch Execution', 'PASS', `50 Tasks created in ${Math.round(volDuration)}ms`, volDuration);
        
        // Verify Count
        const qCount = query(collection(db, 'tasks'), where('projectId', '==', testProjectId));
        const snapCount = await getDocs(qCount);
        // 1 main task + 50 batch tasks = 51
        if (snapCount.size === 51) {
            addLog('VOLUME', 'Data Integrity', 'PASS', `Confirmed 51 tasks in project`);
        } else {
            addLog('VOLUME', 'Data Integrity', 'WARN', `Expected 51 tasks, found ${snapCount.size}`);
        }
        setProgress(90);

    } catch (error: any) {
        console.error("Advanced Diagnostic Error:", error);
        addLog('SYSTEM', 'Fatal Error', 'FAIL', error.message || 'Unknown error occurred');
    } finally {
        // =====================================================================
        // PHASE 5: CLEANUP
        // =====================================================================
        addLog('CLEANUP', 'Purge', 'INFO', 'Removing test artifacts...');
        
        try {
            const cleanBatch = writeBatch(db);
            
            // Delete Project
            if (testProjectId) {
                cleanBatch.delete(doc(db, 'projects', testProjectId));
            }
            
            // Delete Main Task
            if (testTaskId) {
                cleanBatch.delete(doc(db, 'tasks', testTaskId));
            }
            
            // Delete Batch Tasks
            batchTaskIds.forEach(id => {
                cleanBatch.delete(doc(db, 'tasks', id));
            });
            
            await cleanBatch.commit();
            addLog('CLEANUP', 'Purge', 'PASS', 'All test data deleted permanently.');
        } catch (cleanupErr: any) {
            addLog('CLEANUP', 'Purge', 'FAIL', `Cleanup failed: ${cleanupErr.message}`);
        }
        
        setIsRunning(false);
        setProgress(100);
    }
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      metrics,
      logs
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic_report_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'PASS': return 'text-green-400';
          case 'FAIL': return 'text-red-500';
          case 'WARN': return 'text-yellow-400';
          case 'INFO': return 'text-blue-400';
          default: return 'text-slate-500';
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in font-mono">
      <div className="w-full max-w-5xl h-[85vh] bg-slate-950 rounded-xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header with Live Metrics */}
        <div className="bg-slate-900 p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
                <Activity className={isRunning ? 'text-green-500 animate-pulse' : 'text-slate-500'} size={24} />
                <div>
                    <h2 className="text-slate-200 font-bold text-lg tracking-tight">System Diagnostic V2</h2>
                    <p className="text-xs text-slate-500">Advanced Latency & Logic Suite</p>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6 text-xs">
                <div>
                    <div className="text-slate-500 uppercase tracking-wider font-bold mb-1">Tests Run</div>
                    <div className="text-xl font-bold text-slate-200">{metrics.testsRun}<span className="text-slate-600">/{metrics.totalTests}</span></div>
                </div>
                <div>
                    <div className="text-slate-500 uppercase tracking-wider font-bold mb-1">Errors</div>
                    <div className={`text-xl font-bold ${metrics.errors > 0 ? 'text-red-500' : 'text-green-500'}`}>{metrics.errors}</div>
                </div>
                <div>
                    <div className="text-slate-500 uppercase tracking-wider font-bold mb-1">Avg Latency</div>
                    <div className="text-xl font-bold text-blue-400">{metrics.avgLatency}ms</div>
                </div>
            </div>

            <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                <X size={24} />
            </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-900 w-full relative">
            <div 
                className={`h-full transition-all duration-300 ${metrics.errors > 0 ? 'bg-red-500' : 'bg-green-500'} relative`} 
                style={{ width: `${progress}%` }}
            >
                {isRunning && <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-white/50 to-transparent animate-pulse"></div>}
            </div>
        </div>

        {/* Terminal Log Output */}
        <div 
            ref={logContainerRef}
            className="flex-1 bg-black p-6 overflow-y-auto custom-scrollbar text-sm space-y-1 font-mono"
        >
            {logs.length === 0 && !isRunning && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full"></div>
                        <Terminal size={64} className="relative text-slate-500" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-lg font-bold text-slate-400">Diagnostic Console Ready</p>
                        <p className="text-xs text-slate-600 max-w-xs mx-auto">
                            This suite creates temporary data to stress-test the database, network latency, and application logic. 
                            Artifacts are automatically cleaned up.
                        </p>
                    </div>
                </div>
            )}

            {logs.map((log) => (
                <div key={log.id} className="flex gap-4 items-start animate-fade-in hover:bg-white/5 p-1 rounded -mx-1">
                    <span className="text-slate-600 shrink-0 w-20 text-xs pt-0.5">{log.timestamp.split(' ')[0]}</span>
                    
                    <span className={`shrink-0 w-24 font-bold text-xs pt-0.5 uppercase tracking-wider ${
                        log.category === 'LATENCY' ? 'text-purple-400' :
                        log.category === 'LOGIC' ? 'text-blue-400' :
                        log.category === 'LIFECYCLE' ? 'text-orange-400' :
                        log.category === 'VOLUME' ? 'text-pink-400' :
                        log.category === 'CLEANUP' ? 'text-slate-400' : 'text-white'
                    }`}>
                        {log.category}
                    </span>

                    <div className="flex-1 min-w-0 flex justify-between gap-4">
                        <div className="flex gap-3">
                            <span className={`font-bold ${getStatusColor(log.status)} w-16 shrink-0`}>
                                [{log.status}]
                            </span>
                            <span className="text-slate-300">
                                <span className="font-bold text-slate-200 mr-2">{log.action}:</span>
                                {log.message}
                            </span>
                        </div>
                        
                        {log.latency !== undefined && (
                            <span className="text-slate-500 text-xs shrink-0 font-bold">
                                {log.latency}ms
                            </span>
                        )}
                    </div>
                </div>
            ))}
            
            {isRunning && (
                <div className="animate-pulse text-green-500 mt-4 font-bold flex items-center gap-2">
                    <span className="w-2 h-4 bg-green-500 block"></span>
                    Processing...
                </div>
            )}
        </div>

        {/* Footer Toolbar */}
        <div className="bg-slate-900 p-4 border-t border-slate-800 flex justify-between items-center">
            <div className="flex gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <Wifi size={14} /> Network Status: {navigator.onLine ? 'Online' : 'Offline'}
                </div>
                <div className="flex items-center gap-2">
                    <Database size={14} /> DB Connection: Active
                </div>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={downloadReport}
                    disabled={logs.length === 0 || isRunning}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
                >
                    <Download size={14} /> Export Report
                </button>
                <button 
                    onClick={runAdvancedDiagnostics}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shadow-lg shadow-green-900/20"
                >
                    {isRunning ? <Cpu className="animate-spin" size={14} /> : <Play size={14} />}
                    {isRunning ? 'Running Tests...' : 'Start Diagnostics'}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default HealthCheckModal;
