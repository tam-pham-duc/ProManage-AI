
import React, { useState } from 'react';
import { Wrench, Database, Trash2, Loader2, X, ChevronUp, LogOut } from 'lucide-react';
import { User } from '../types';
import { generateDemoData, clearDevData } from '../services/demoDataService';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface DevToolbarProps {
  currentUser: User;
}

const DevToolbar: React.FC<DevToolbarProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState('');

  const handleGenerateDemoData = async () => {
    if (!window.confirm("STRESS TEST MODE: This will delete existing data and generate 3 projects with ~50 tasks total. Continue?")) return;
    
    setIsWorking(true);
    setMessage('Cleaning up...');

    try {
      await clearDevData(currentUser.id);
      setMessage('Generating comprehensive dataset...');
      await generateDemoData(currentUser.id);
      setMessage('Success! Dataset generated.');
      setTimeout(() => { setMessage(''); window.location.reload(); }, 2000);
    } catch (e) {
      console.error(e);
      setMessage('Error generating data.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleCleanAndExit = async () => {
    if (!window.confirm("WARNING: This will delete ALL your data and log you out. Are you sure?")) return;
    setIsWorking(true);
    try {
        await clearDevData(currentUser.id);
        await signOut(auth);
        window.location.reload();
    } catch (e) {
        console.error(e);
        setMessage('Error cleaning data.');
    } finally {
        setIsWorking(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 animate-fade-in">
      {isOpen && (
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 w-64 mb-2 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <h3 className="font-bold text-sm flex items-center gap-2"><Wrench size={14} /> Dev Tools</h3>
                <button onClick={() => setIsOpen(false)}><X size={16} className="text-slate-400 hover:text-white" /></button>
            </div>
            
            <div className="space-y-2">
                <button 
                  onClick={handleGenerateDemoData}
                  disabled={isWorking}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isWorking ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
                  Reset Demo Data
                </button>

                <button 
                  onClick={handleCleanAndExit}
                  disabled={isWorking}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-red-900/50 hover:bg-red-900 rounded-lg text-xs font-bold text-red-200 transition-colors disabled:opacity-50"
                >
                   <LogOut size={14} />
                   Clean & Exit
                </button>
            </div>

            {message && (
                <div className="text-xs text-center text-emerald-400 font-medium pt-1 animate-pulse">
                    {message}
                </div>
            )}
            
            <div className="text-[10px] text-slate-500 text-center pt-2">
                Logged in as Admin
            </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 ${isOpen ? 'bg-slate-700 rotate-90' : 'bg-indigo-600'}`}
      >
         {isOpen ? <ChevronUp size={24} /> : <Wrench size={24} />}
      </button>
    </div>
  );
};

export default DevToolbar;
