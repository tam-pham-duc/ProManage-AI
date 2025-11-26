import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface EditColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
  initialTitle: string;
  initialColor: string;
}

const EditColumnModal: React.FC<EditColumnModalProps> = ({ isOpen, onClose, onSave, initialTitle, initialColor }) => {
  const [title, setTitle] = useState(initialTitle);
  const [color, setColor] = useState(initialColor);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setColor(initialColor);
    }
  }, [isOpen, initialTitle, initialColor]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
        onSave(title, color);
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-bold text-slate-900 dark:text-white">Edit Column</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSave} className="p-5 space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Column Name</label>
                <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                    placeholder="e.g. In Review"
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Color Theme</label>
                <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                    <ColorPicker selectedColorId={color} onChange={setColor} />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select a color tag</span>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                    Cancel
                </button>
                <button type="submit" className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                    <Save size={16} /> Save Changes
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default EditColumnModal;