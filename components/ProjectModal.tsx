
import React, { useState, useEffect, useRef } from 'react';
import { X, Briefcase, User, MapPin, Plus, Trash2, Shield, Mail, Loader2, Clock, Ban, Save, ChevronDown, ArrowRight, ArrowLeft, Check, LayoutTemplate } from 'lucide-react';
import { Project, ProjectMember, ProjectRole } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import { saveProjectAsTemplate } from '../services/templateService';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: Partial<Project>) => void;
  project?: Project | null;
  currentUser?: { uid: string; email: string; displayName: string };
  currentUserRole?: ProjectRole;
  onDelete?: (projectId: string) => Promise<void>;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSubmit, project, currentUser, currentUserRole = 'admin', onDelete }) => {
  const { notify } = useNotification();
  const isMounted = useRef(false);
  
  // Mode Determination
  const isEditMode = !!project;

  // Wizard State (Creation)
  const [currentStep, setCurrentStep] = useState(1);
  
  // Tab State (Editing)
  const [activeTab, setActiveTab] = useState<'details' | 'members'>('details');
  
  // Form Data
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');

  // Members State (Local Buffer)
  const [localMembers, setLocalMembers] = useState<ProjectMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Save State
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const canManageRoles = !project || currentUserRole === 'admin';

  // Reset State on Open
  useEffect(() => {
    isMounted.current = true;
    if (isOpen) {
      setCurrentStep(1); // Reset wizard
      setActiveTab('details'); // Reset tabs
      setInviteEmail('');
      setIsSaving(false);
      setIsDeleting(false);
      setIsSavingTemplate(false);

      if (project) {
        // EDIT MODE: Load Data
        setName(project.name);
        setClientName(project.clientName);
        setAddress(project.address);
        setLocalMembers(project.members || []);
      } else {
        // CREATE MODE: Reset Data
        setName('');
        setClientName('');
        setAddress('');
        // Add current user as Admin by default
        if (currentUser) {
          setLocalMembers([{
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            role: 'admin',
            status: 'active',
            avatar: currentUser.displayName.charAt(0).toUpperCase()
          }]);
        } else {
          setLocalMembers([]);
        }
      }
    }
    return () => { isMounted.current = false; };
  }, [isOpen, project]); // Depend on isOpen and project reference

  if (!isOpen) return null;

  // --- Background User Resolver ---
  const resolveMemberDetails = async (email: string) => {
      try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const userData = userDoc.data();
              
              // Update the specific member in local state if they exist
              if (isMounted.current) {
                  setLocalMembers(prev => prev.map(m => {
                      if (m.email.toLowerCase() === email.toLowerCase()) {
                          return {
                              ...m,
                              uid: userDoc.id,
                              displayName: userData.username || userData.email.split('@')[0],
                              avatar: userData.avatar || userData.username?.charAt(0).toUpperCase(),
                              status: 'active'
                          };
                      }
                      return m;
                  }));
              }
          }
      } catch (error) {
          console.error("Error resolving user:", error);
      }
  };

  // --- Handlers ---

  const handleInviteUser = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault(); // Prevent form submission
    const email = inviteEmail.trim();
    
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        notify('warning', "Please enter a valid email address.");
        return;
    }

    if (localMembers.some(m => m.email.toLowerCase() === email.toLowerCase())) {
      notify('info', "User is already a member or invited.");
      setInviteEmail('');
      return;
    }

    // 1. Optimistic Add
    const newMember: ProjectMember = {
        uid: null,
        email: email,
        displayName: email.split('@')[0],
        role: 'member',
        status: 'pending', // Default to pending until resolved
        avatar: undefined
    };

    setLocalMembers(prev => [...prev, newMember]);
    setInviteEmail('');
    
    // 2. Trigger Background Check
    resolveMemberDetails(email);
  };

  const handleRemoveMember = (email: string) => {
    // Prevent removing self if active admin in Edit Mode, or generic safety in Create Mode
    if (currentUser && email === currentUser.email && localMembers.length === 1) {
         notify('warning', "You cannot remove yourself as the only member.");
         return;
    }
    setLocalMembers(prev => prev.filter(m => m.email !== email));
  };

  const handleRoleChange = (email: string, newRole: ProjectRole) => {
      setLocalMembers(prev => prev.map(m => m.email === email ? { ...m, role: newRole } : m));
  };

  // Wizard Navigation
  const handleNextStep = () => {
      if (!name.trim()) {
          notify('warning', "Please enter a project name.");
          return;
      }
      setCurrentStep(2);
  };

  const handlePrevStep = () => {
      setCurrentStep(1);
  };

  // Final Submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
        notify('warning', "Project name is required.");
        return;
    }

    setIsSaving(true);

    try {
        const memberUIDs = localMembers.map(m => m.uid).filter((uid): uid is string => uid !== null);
        
        const projectPayload = {
          name,
          clientName: clientName || 'Internal',
          address: address || 'Remote',
          members: localMembers,
          memberUIDs
        };

        if (project) {
            // Edit Existing
            const projectRef = doc(db, 'projects', project.id);
            await updateDoc(projectRef, projectPayload);
            notify('success', "Project updated successfully.");
            setTimeout(() => {
                if (isMounted.current) {
                    setIsSaving(false);
                    onClose();
                }
            }, 500);
        } else {
            // Create New
            await onSubmit(projectPayload);
            if (isMounted.current) setIsSaving(false);
        }

    } catch (error) {
        console.error("Error saving project:", error);
        notify('error', "Failed to save project.");
        if (isMounted.current) setIsSaving(false);
    }
  };

  const handleDeleteClick = async () => {
      if (onDelete && project) {
          setIsDeleting(true);
          await onDelete(project.id);
          // Only update state if still mounted (i.e., delete failed or logic didn't unmount parent)
          if (isMounted.current) {
              setIsDeleting(false);
          }
      }
  };

  const handleSaveAsTemplate = async () => {
      if (!project || !currentUser) return;
      
      const templateName = prompt("Enter a name for this template:", project.name + " Template");
      if (!templateName || !templateName.trim()) return;

      setIsSavingTemplate(true);
      try {
          await saveProjectAsTemplate(project, templateName.trim(), currentUser.uid);
          notify('success', "Project template saved successfully!");
      } catch (e) {
          console.error(e);
          notify('error', "Failed to save template.");
      } finally {
          setIsSavingTemplate(false);
      }
  };

  // --- Render Helpers ---

  const renderDetailsFields = () => (
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name <span className="text-red-500">*</span></label>
          <input 
            autoFocus
            type="text" 
            readOnly={isEditMode && !canManageRoles}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 ${isEditMode && !canManageRoles ? 'opacity-70 cursor-not-allowed' : ''}`}
            placeholder="e.g. Sunset Villa Renovation"
            required
            onKeyDown={(e) => {
                if (!isEditMode && e.key === 'Enter') {
                    e.preventDefault();
                    handleNextStep();
                }
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><User size={14} /> Client Name</label>
          <input 
            type="text" 
            readOnly={isEditMode && !canManageRoles}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 ${isEditMode && !canManageRoles ? 'opacity-70 cursor-not-allowed' : ''}`}
            placeholder="e.g. John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><MapPin size={14} /> Site Address</label>
          <input 
            type="text" 
            readOnly={isEditMode && !canManageRoles}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 ${isEditMode && !canManageRoles ? 'opacity-70 cursor-not-allowed' : ''}`}
            placeholder="e.g. 123 Main St, City"
          />
        </div>
      </div>
  );

  const renderMembersFields = () => (
    <div className="space-y-6 h-full flex flex-col">
        {canManageRoles && (
        <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input 
                    type="email" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email to invite..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 dark:text-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleInviteUser(e)}
                />
            </div>
            <button 
                type="button" // IMPORTANT: Prevent submit
                onClick={handleInviteUser}
                disabled={!inviteEmail.trim()}
                className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                Add
            </button>
        </div>
        )}

        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-slate-800 py-2">Team Members ({localMembers.length})</h3>
            
            {localMembers.map(member => {
                const isPending = member.status === 'pending';
                const isMe = currentUser && member.uid === currentUser.uid;
                
                return (
                <div key={member.uid || member.email} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border ${isPending ? 'border-yellow-200 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/10' : 'border-slate-200 dark:border-slate-700'} rounded-xl transition-all gap-3`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden shrink-0 ${isPending ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                            {isPending ? (
                                <Clock size={16} />
                            ) : (
                                member.avatar && member.avatar.startsWith('http') ? (
                                <img src={member.avatar} alt={member.displayName} className="w-full h-full object-cover" />
                                ) : (
                                (member.avatar || member.displayName.charAt(0)).toUpperCase()
                                )
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className={`text-sm font-bold truncate ${isPending ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                    {member.displayName} {isMe && '(You)'}
                                </p>
                                {isPending && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                                        Pending
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        {canManageRoles && !isMe ? (
                        <div className="relative group/role">
                            <select
                                value={member.role}
                                onChange={(e) => handleRoleChange(member.email, e.target.value as ProjectRole)}
                                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold py-1.5 pl-3 pr-7 rounded-lg cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                                <option value="guest">Guest</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                        )}

                        {canManageRoles && !isMe && (
                            <button 
                                type="button"
                                onClick={() => handleRemoveMember(member.email)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
                );
            })}
        </div>
    </div>
  );

  // --- Main Render ---

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase size={20} className="text-indigo-500" />
            {isEditMode ? 'Project Settings' : 'Create New Project'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* WIZARD MODE: Step Indicators */}
        {!isEditMode && (
             <div className="px-6 pt-4">
                <div className="flex items-center gap-2 mb-4">
                   <div className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${currentStep >= 1 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                   <div className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {currentStep === 1 ? "Step 1: Project Details" : "Step 2: Invite Team"}
                </h3>
             </div>
        )}

        {/* EDIT MODE: Tabs */}
        {isEditMode && (
            <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 gap-6 shrink-0">
                <button onClick={() => setActiveTab('details')} className={`py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    Details
                </button>
                <button onClick={() => setActiveTab('members')} className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'members' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    Members <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs text-slate-700 dark:text-slate-300">{localMembers.length}</span>
                </button>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-800">
             {isEditMode ? (
                 // Edit Mode Layout
                 <form id="projectForm" onSubmit={handleSave} className="h-full">
                     {activeTab === 'details' && renderDetailsFields()}
                     {activeTab === 'members' && renderMembersFields()}
                 </form>
             ) : (
                 // Wizard Mode Layout
                 <div className="h-full flex flex-col">
                     {currentStep === 1 && renderDetailsFields()}
                     {currentStep === 2 && renderMembersFields()}
                 </div>
             )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 shrink-0 flex gap-3 flex-wrap">
            
            {/* Wizard Buttons */}
            {!isEditMode && (
                <>
                    {currentStep === 1 ? (
                        <>
                             <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                Cancel
                             </button>
                             <div className="flex-1"></div>
                             <button onClick={handleNextStep} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2">
                                Next <ArrowRight size={18} />
                             </button>
                        </>
                    ) : (
                        <>
                             <button onClick={handlePrevStep} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                                <ArrowLeft size={18} /> Back
                             </button>
                             <div className="flex-1"></div>
                             <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2">
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                Create Project
                             </button>
                        </>
                    )}
                </>
            )}

            {/* Edit Mode Buttons */}
            {isEditMode && (
                <>
                    {onDelete && canManageRoles && (
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            disabled={isDeleting || isSaving}
                            className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
                            title="Delete Project"
                        >
                            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                    )}
                    
                    {canManageRoles && (
                        <button
                            type="button"
                            onClick={handleSaveAsTemplate}
                            disabled={isSavingTemplate}
                            className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-center"
                            title="Save as Template"
                        >
                            {isSavingTemplate ? <Loader2 size={18} className="animate-spin" /> : <LayoutTemplate size={18} />}
                        </button>
                    )}

                    <div className="flex-1"></div>

                    <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        Cancel
                    </button>
                    
                    {canManageRoles && (
                        <button 
                            type="submit" 
                            form="projectForm"
                            disabled={isSaving || isDeleting} 
                            className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Save Changes
                        </button>
                    )}
                </>
            )}
        </div>

      </div>
    </div>
  );
};

export default ProjectModal;
