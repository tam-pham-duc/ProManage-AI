
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Folder, 
  FileText, 
  Link as LinkIcon, 
  MoreHorizontal, 
  ArrowLeft, 
  Plus, 
  Search, 
  Star, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  Save, 
  Loader2, 
  FolderOpen, 
  Pin, 
  PinOff, 
  File,
  CornerDownLeft,
  Check,
  Cloud
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import RichTextEditor from './RichTextEditor';
import { ProjectDocument, DocumentType } from '../types';

interface DocumentsViewProps {
  projectId: string | null;
}

// --- Create Modal Component ---
interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: DocumentType, url?: string) => void;
  initialType?: DocumentType;
}

const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onSubmit, initialType = 'folder' }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<DocumentType>(initialType);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setUrl('');
      setType(initialType);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name, type, url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 dark:text-white">Create New</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><CornerDownLeft size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Type</label>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
              {(['folder', 'wiki', 'file'] as DocumentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${type === t ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Name</label>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
              placeholder={type === 'folder' ? "Folder Name" : type === 'wiki' ? "Wiki Title" : "File Label"}
            />
          </div>

          {type === 'file' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Link URL</label>
              <input 
                type="url" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                placeholder="https://example.com/file.pdf"
              />
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-lg transition-all disabled:opacity-50">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Item Card Component ---
interface ItemCardProps {
  docItem: ProjectDocument;
  onClick: (doc: ProjectDocument) => void;
  onAction: (action: string, doc: ProjectDocument) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ docItem, onClick, onAction }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = () => {
    switch (docItem.type) {
      case 'folder': return <Folder className="text-amber-400 fill-amber-400/20" size={48} strokeWidth={1.5} />;
      case 'wiki': return <FileText className="text-blue-500 fill-blue-500/10" size={48} strokeWidth={1.5} />;
      case 'file': return <LinkIcon className="text-slate-400" size={48} strokeWidth={1.5} />;
      default: return <File className="text-slate-400" size={48} strokeWidth={1.5} />;
    }
  };

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    setShowMenu(false);
    onAction(action, docItem);
  };

  return (
    <div 
      onClick={() => onClick(docItem)}
      className="group relative bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 flex flex-col items-center justify-between text-center aspect-[4/3]"
    >
      {docItem.isPinned && (
        <div className="absolute top-3 left-3 text-amber-400">
          <Star size={14} fill="currentColor" />
        </div>
      )}

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10" ref={menuRef}>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <MoreHorizontal size={18} />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden text-left animate-fade-in">
            <button onClick={(e) => handleAction(e, 'togglePin')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
              {docItem.isPinned ? <PinOff size={12} /> : <Pin size={12} />} {docItem.isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={(e) => handleAction(e, 'rename')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
              <Edit2 size={12} /> Rename
            </button>
            <button onClick={(e) => handleAction(e, 'delete')} className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center w-full transition-transform group-hover:scale-105 duration-300">
        {getIcon()}
      </div>
      
      <div className="w-full mt-2">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1 break-words w-full" title={docItem.name}>
            {docItem.name}
        </h4>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">
            {docItem.type}
        </p>
      </div>
    </div>
  );
};

// --- Main Documents View ---
const DocumentsView: React.FC<DocumentsViewProps> = ({ projectId }) => {
  const { notify } = useNotification();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'EXPLORER' | 'EDITOR'>('EXPLORER');
  
  // Editor State
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<DocumentType>('folder');

  // Data Fetching
  useEffect(() => {
    if (!projectId) return;
    
    const q = query(collection(db, 'projects', projectId, 'documents'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectDocument));
      setDocuments(docsData);
    }, (err) => {
      console.error("Documents fetch error:", err);
      notify('error', 'Failed to load documents');
    });

    return () => unsubscribe();
  }, [projectId]);

  // Navigation Helper
  const breadcrumbs = useMemo(() => {
    const path = [];
    let curr = documents.find(d => d.id === currentFolderId);
    while(curr) {
      path.unshift({ id: curr.id, name: curr.name });
      curr = documents.find(d => d.id === curr.parentId);
    }
    return [{id: null, name: 'Home'}, ...path];
  }, [currentFolderId, documents]);

  // Filtered Lists
  const currentDocs = useMemo(() => {
    return documents
        .filter(d => d.parentId === currentFolderId)
        .sort((a, b) => {
            // Sort folders first, then by name
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
  }, [documents, currentFolderId]);

  const pinnedDocs = useMemo(() => {
    return documents.filter(d => d.isPinned && d.parentId === currentFolderId);
  }, [documents, currentFolderId]);

  // --- Auto-Save Logic ---
  useEffect(() => {
    if (viewMode !== 'EDITOR' || !editingDocId || !projectId) return;

    const timer = setTimeout(async () => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'projects', projectId, 'documents', editingDocId), {
                name: editorTitle,
                content: editorContent,
                updatedAt: serverTimestamp()
            });
            setLastSaved(new Date());
        } catch(e) {
            console.error("Auto-save failed", e);
        } finally {
            setIsSaving(false);
        }
    }, 1500); // Debounce 1.5s

    return () => clearTimeout(timer);
  }, [editorTitle, editorContent, editingDocId, projectId, viewMode]);

  // Handlers
  const handleCreate = async (name: string, type: DocumentType, url?: string) => {
    if (!projectId || !auth.currentUser) return;

    try {
      const newDoc: any = {
        projectId,
        parentId: currentFolderId,
        type,
        name,
        isPinned: false,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };

      if (type === 'file' && url) newDoc.url = url;
      if (type === 'wiki') newDoc.content = '<h1>Untitled Page</h1><p>Start typing...</p>';

      const ref = await addDoc(collection(db, 'projects', projectId, 'documents'), newDoc);
      
      notify('success', `${type} created`);
      
      if (type === 'wiki') {
        setEditingDocId(ref.id);
        setEditorTitle(name);
        setEditorContent(newDoc.content);
        setViewMode('EDITOR');
      }
    } catch (e) {
      notify('error', 'Failed to create item');
    }
  };

  const handleItemClick = (docItem: ProjectDocument) => {
    if (docItem.type === 'folder') {
      setCurrentFolderId(docItem.id);
    } else if (docItem.type === 'wiki') {
      setEditingDocId(docItem.id);
      setEditorTitle(docItem.name);
      setEditorContent(docItem.content || '');
      setViewMode('EDITOR');
    } else if (docItem.type === 'file' && docItem.url) {
      window.open(docItem.url, '_blank');
    }
  };

  const handleItemAction = async (action: string, docItem: ProjectDocument) => {
    if (!projectId) return;
    const docRef = doc(db, 'projects', projectId, 'documents', docItem.id);

    try {
      if (action === 'togglePin') {
        await updateDoc(docRef, { isPinned: !docItem.isPinned });
        notify('success', docItem.isPinned ? 'Unpinned' : 'Pinned');
      } else if (action === 'delete') {
        if (window.confirm(`Delete "${docItem.name}"?`)) {
          if (docItem.type === 'folder') {
             const hasKids = documents.some(d => d.parentId === docItem.id);
             if (hasKids) {
                 notify('warning', 'Folder is not empty. Delete contents first.');
                 return;
             }
          }
          await deleteDoc(docRef);
          notify('success', 'Deleted');
        }
      } else if (action === 'rename') {
        const newName = prompt("New Name:", docItem.name);
        if (newName && newName.trim() !== docItem.name) {
          await updateDoc(docRef, { name: newName.trim() });
          notify('success', 'Renamed');
        }
      }
    } catch (e) {
      notify('error', 'Action failed');
    }
  };

  // --- EDITOR VIEW (Notion Style) ---
  if (viewMode === 'EDITOR' && editingDocId) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 animate-in fade-in zoom-in-95 duration-300 relative z-50">
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 h-16 flex items-center justify-between">
            <button 
                onClick={() => setViewMode('EXPLORER')}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium text-sm"
            >
                <ArrowLeft size={18} />
                Back to Documents
            </button>

            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    {isSaving ? (
                        <><Loader2 size={12} className="animate-spin" /> Saving...</>
                    ) : lastSaved ? (
                        <><Cloud size={12} /> Saved {lastSaved.toLocaleTimeString()}</>
                    ) : (
                        <span className="opacity-50">Draft</span>
                    )}
                </span>
            </div>
        </div>

        {/* Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl min-h-[80vh] flex flex-col relative transition-all duration-300">
                <div className="p-8 md:p-16 flex flex-col h-full">
                    {/* Title Input */}
                    <input
                       type="text"
                       className="text-4xl md:text-5xl font-bold border-none outline-none bg-transparent placeholder-slate-300 dark:placeholder-slate-700 mb-8 text-slate-900 dark:text-white w-full"
                       placeholder="Untitled Page"
                       value={editorTitle}
                       onChange={(e) => setEditorTitle(e.target.value)}
                    />
                    
                    {/* Rich Text Editor - Integrated Style */}
                    <div className="flex-1">
                        <RichTextEditor
                           className="border-0 shadow-none rounded-none !border-none min-h-[500px]"
                           value={editorContent}
                           onChange={setEditorContent}
                           placeholder="Type '/' for commands..."
                        />
                    </div>
                </div>
            </div>
            <div className="h-20"></div> {/* Bottom Spacer */}
        </div>
      </div>
    );
  }

  // --- EXPLORER VIEW ---
  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="mb-6 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FolderOpen className="text-indigo-500" size={28} />
            Documents
          </h1>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 mt-2 text-sm text-slate-500 dark:text-slate-400 overflow-x-auto hide-scrollbar whitespace-nowrap">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.id || 'home'}>
                {i > 0 && <ChevronRight size={14} className="opacity-50" />}
                <button 
                  onClick={() => setCurrentFolderId(b.id)}
                  className={`hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors ${i === breadcrumbs.length - 1 ? 'font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50' : ''}`}
                >
                  {b.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* Toolbar */}
        <div className="flex gap-2">
            <button 
              onClick={() => { setCreateType('folder'); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-bold text-xs"
            >
                <Folder size={16} /> New Folder
            </button>
            <button 
              onClick={() => { setCreateType('wiki'); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-bold text-xs"
            >
                <FileText size={16} /> New Page
            </button>
            <button 
              onClick={() => { setCreateType('file'); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold text-xs"
            >
                <LinkIcon size={16} /> Add Link
            </button>
        </div>
      </div>

      {/* Explorer Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pr-2">
        {/* Pinned Section */}
        {pinnedDocs.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Star size={12} fill="currentColor" className="text-amber-400" /> Pinned Items
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pinnedDocs.map(doc => (
                <ItemCard key={doc.id} docItem={doc} onClick={handleItemClick} onAction={handleItemAction} />
              ))}
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            {currentFolderId ? 'Contents' : 'All Files'}
          </h3>
          
          {currentDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 transition-all hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/10 cursor-pointer" onClick={() => { setCreateType('wiki'); setIsCreateModalOpen(true); }}>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-full mb-4 shadow-sm">
                  <FolderOpen size={32} className="text-indigo-400" />
              </div>
              <p className="text-sm font-medium">This folder is empty.</p>
              <p className="text-xs mt-1">Click to create a new page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {currentDocs.map(doc => (
                <ItemCard key={doc.id} docItem={doc} onClick={handleItemClick} onAction={handleItemAction} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={handleCreate} 
        initialType={createType}
      />
    </div>
  );
};

export default DocumentsView;
