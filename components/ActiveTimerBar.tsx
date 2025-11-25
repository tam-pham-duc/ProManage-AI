
import React, { useState, useEffect } from 'react';
import { Square, Clock } from 'lucide-react';
import { useTimeTracking } from '../context/TimeTrackingContext';

const ActiveTimerBar: React.FC = () => {
  const { activeTimer, stopTimer, formatDurationShort } = useTimeTracking();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) {
        setElapsed(0);
        return;
    }

    const interval = setInterval(() => {
        const seconds = Math.floor((Date.now() - activeTimer.startTime) / 1000);
        setElapsed(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-5 hover:bg-slate-900 transition-colors ring-1 ring-white/5">
            <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">Tracking Time</span>
                    <span className="text-xs font-bold max-w-[150px] truncate">{activeTimer.taskTitle}</span>
                </div>
            </div>

            <div className="h-8 w-px bg-white/10"></div>

            <div className="flex items-center gap-2 font-mono text-xl font-bold text-white min-w-[80px]">
                {formatDurationShort(elapsed)}
            </div>

            <button 
                onClick={stopTimer}
                className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-transform active:scale-90 flex items-center justify-center"
                title="Stop Timer"
            >
                <Square size={14} fill="currentColor" />
            </button>
        </div>
    </div>
  );
};

export default ActiveTimerBar;
