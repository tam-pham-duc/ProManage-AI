
import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, Palette, Highlighter, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, className, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Sync external value changes to innerHTML (only if significantly different to avoid cursor jumps)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
        // Only update if the editor is empty (initial load) or if the value has completely changed 
        // (e.g. switching tasks). Avoid updating on every keystroke loop.
        const isEditorEmpty = editorRef.current.innerHTML === '<br>' || editorRef.current.innerHTML === '';
        if (isEditorEmpty || Math.abs(editorRef.current.innerHTML.length - value.length) > 5) {
             editorRef.current.innerHTML = value;
        }
    }
  }, [value]);

  const exec = (command: string, val: string = '') => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const colors = [
    { color: '#000000', label: 'Black' },
    { color: '#EF4444', label: 'Red' },
    { color: '#3B82F6', label: 'Blue' },
    { color: '#10B981', label: 'Green' },
    { color: '#F59E0B', label: 'Orange' },
    { color: '#6366F1', label: 'Indigo' },
  ];

  const highlights = [
    { color: '#FEF08A', label: 'Yellow' },
    { color: '#BBF7D0', label: 'Green' },
    { color: '#FBCFE8', label: 'Pink' },
    { color: '#BAE6FD', label: 'Blue' },
    { color: 'transparent', label: 'None' },
  ];

  return (
    <div className={`flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 transition-colors ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <ToolbarBtn icon={Bold} onClick={() => exec('bold')} label="Bold" />
        <ToolbarBtn icon={Italic} onClick={() => exec('italic')} label="Italic" />
        <ToolbarBtn icon={Underline} onClick={() => exec('underline')} label="Underline" />
        <ToolbarBtn icon={Strikethrough} onClick={() => exec('strikeThrough')} label="Strikethrough" />
        
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
        
        {/* Color Picker */}
        <div className="relative">
            <ToolbarBtn icon={Palette} onClick={() => { setShowColorPicker(!showColorPicker); setShowBgPicker(false); }} active={showColorPicker} label="Text Color" />
            {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 grid grid-cols-3 gap-1 min-w-[120px]">
                    {colors.map(c => (
                        <button 
                            key={c.color} 
                            onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c.color); setShowColorPicker(false); }}
                            className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform"
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                        />
                    ))}
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 -z-10" onMouseDown={() => setShowColorPicker(false)} />
                </div>
            )}
        </div>

        {/* Highlight Picker */}
        <div className="relative">
             <ToolbarBtn icon={Highlighter} onClick={() => { setShowBgPicker(!showBgPicker); setShowColorPicker(false); }} active={showBgPicker} label="Highlight" />
             {showBgPicker && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 grid grid-cols-3 gap-1 min-w-[120px]">
                    {highlights.map(c => (
                        <button 
                            key={c.color} 
                            onMouseDown={(e) => { e.preventDefault(); exec('hiliteColor', c.color); setShowBgPicker(false); }}
                            className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform relative"
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                        >
                            {c.color === 'transparent' && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 font-bold">/</div>}
                        </button>
                    ))}
                    <div className="fixed inset-0 -z-10" onMouseDown={() => setShowBgPicker(false)} />
                </div>
            )}
        </div>
        
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
        
        <ToolbarBtn icon={List} onClick={() => exec('insertUnorderedList')} label="Bullet List" />
        <ToolbarBtn icon={ListOrdered} onClick={() => exec('insertOrderedList')} label="Numbered List" />

      </div>

      {/* Editor Area */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="flex-1 p-4 min-h-[160px] max-h-[400px] overflow-y-auto outline-none prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 custom-scrollbar empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 cursor-text"
        data-placeholder={placeholder}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
};

const ToolbarBtn = ({ icon: Icon, onClick, active, label }: any) => (
    <button 
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'}`}
        title={label}
    >
        <Icon size={16} strokeWidth={2.5} />
    </button>
);

export default RichTextEditor;
