
import React from 'react';
import { Trash2 } from 'lucide-react';

const TrashView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-fade-in text-slate-500 dark:text-slate-400">
      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
        <Trash2 size={48} className="opacity-20" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Trash Can</h2>
      <p className="text-sm max-w-md text-center leading-relaxed">
        Items deleted from your workspace will appear here.<br/>
        This feature is currently under construction.
      </p>
    </div>
  );
};

export default TrashView;
