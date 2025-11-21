
import React, { useState, useEffect } from 'react';
import { X, Briefcase, User, MapPin, Plus, Trash2, Shield, Mail, Loader2, Clock, Ban, Save } from 'lucide-react';
import { Project, ProjectMember } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: Partial<Project>) => void;
  project?: Project | null;
  currentUser?: { uid: string; email: string; displayName: string };
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSubmit, project, currentUser }) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'details' | 'members'>('details');
  
  // Details State
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');

  // Members State
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  
  // Save State
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setName(project.name);
        setClientName(project.clientName);
        setAddress(project.address);
        
        if (!project.members || project.members.length === 0) {
            if (currentUser && project.ownerId === currentUser.uid) {
                setMembers([{
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    role: 'admin',
                    status: 'active',
                    avatar: currentUser.displayName.charAt(0).toUpperCase()
                }]);
            } else {
                setMembers([]);
            }
        } else {
            setMembers(project.members);
        }
      } else {
        setName('');
        setClientName('');
        setAddress('');
        if (currentUser) {
          setMembers([{
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            role: 'admin',
            status: 'active',
            avatar: currentUser.displayName.charAt(0).toUpperCase()
          }]);
        } else {
          setMembers([]);
        }
      }
      setActiveTab('details');
      setInviteEmail('');
      setIsSaving(false);
    }
  }, [isOpen, project, currentUser]);

  if (!isOpen) return null;

  const handleInviteUser = async () => {
    const email = inviteEmail.trim();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        notify('warning', "Please enter a valid email address.");
        return;
    }

    if (members.some(m => m.email.toLowerCase() === email.toLowerCase())) {
      notify('info', "User is already a member or invited.");
      return;
    }

    setIsInviting(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      let newMember: ProjectMember;

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        newMember = {
          uid: userDoc.id,
          email: userData.email,
          displayName: userData.username || email.split('@')[0],
          role: 'viewer',
          status: 'active',
          avatar: userData.avatar || userData.username?.charAt(0).toUpperCase()
        };
        notify('success', `Added ${newMember.displayName} to project`);
      } else {
        newMember = {
            uid: null,
            email: email,
            displayName: email.split('@')[0],
            role: 'viewer',
            status: 'pending',
            avatar: undefined
        };
        notify('info', `Invitation sent to ${email}`);
      }
      
      setMembers([...members, newMember]);
      setInviteEmail('');
      
    } catch (error) {
      console.error("Error finding user:", error);
      notify('error', "Error searching for user.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (email: string) => {
    if (members.filter(m => m.status === 'active').length <= 1 && members.find(m => m.email === email)?.status === 'active') {
        notify('warning', "Cannot remove the last active member.");
        return;
    }
    setMembers(members.filter(m => m.email !== email));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
        notify('warning', "Project name is required.");
        return;
    }

    setIsSaving(true);

    try {
        const memberUIDs = members.map(m => m.uid).filter((uid): uid is string => uid !== null);
        
        const projectPayload = {
          name,
          clientName: clientName || 'Internal',
          address: address || 'Remote',
          members,
          memberUIDs
        };

        if (project) {
            const projectRef = doc(db, 'projects', project.id);
            await updateDoc(projectRef, projectPayload);
            
            setTimeout(() => {
                setIsSaving(false);
                onClose();
            }, 500);
        } else {
            await onSubmit(projectPayload);
            setIsSaving(false);
        }

    } catch (error) {
        console.error("Error saving project:", error);
        notify('error', "Failed to save project.");
        setIsSaving(false);
    }
  };

  const canEditMembers = !project || (currentUser && project.ownerId === currentUser.uid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase size={20} className="text-indigo-500" />
            {project ? 'Project Settings' : 'New Project'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'members' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Members
            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs text-slate-700 dark:text-slate-300">{members.length}</span>
          </button>
        </div>
        
        <form id="projectForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="e.g. Sunset Villa Renovation"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><User size={14} /> Client Name</label>
                <input 
                  type="text" 
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><MapPin size={14} /> Site Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="e.g. 123 Main St, City"
                />
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
               {/* Invite Section */}
               {canEditMembers && (
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                       <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                          type="email" 
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Enter email to invite..."
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 dark:text-white"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInviteUser())}
                       />
                    </div>
                    <button 
                      type="button"
                      onClick={handleInviteUser}
                      disabled={!inviteEmail.trim() || isInviting}
                      className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isInviting && <Loader2 size={14} className="animate-spin" />}
                      Add
                    </button>
                 </div>
               )}

               {/* Members List */}
               <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team Members</h3>
                  {members.length === 0 && <p className="text-sm text-slate-400 italic">No members found.</p>}
                  
                  {members.map(member => {
                      const isPending = member.status === 'pending';
                      
                      return (
                        <div key={member.uid || member.email} className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border ${isPending ? 'border-yellow-200 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/10' : 'border-slate-200 dark:border-slate-700'} rounded-xl transition-all`}>
                          <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden ${isPending ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
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
                              <div>
                                  <div className="flex items-center gap-2">
                                      <p className={`text-sm font-bold ${isPending ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                          {member.displayName}
                                      </p>
                                      {isPending && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                                              Pending
                                          </span>
                                      )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              {member.role === 'admin' && <Shield size={14} className="text-amber-500" />}
                              {canEditMembers && member.uid !== currentUser?.uid && (
                                  <button 
                                      type="button"
                                      onClick={() => handleRemoveMember(member.email)}
                                      className={`p-1.5 rounded-lg transition-colors ${isPending ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                      title={isPending ? "Cancel Invite" : "Remove Member"}
                                  >
                                      {isPending ? <Ban size={16} /> : <Trash2 size={16} />}
                                  </button>
                              )}
                          </div>
                        </div>
                      );
                  })}
               </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 shrink-0 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              form="projectForm"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
              ) : (
                  <>
                    <Save size={18} />
                    Save
                  </>
              )}
            </button>
        </div>

      </div>
    </div>
  );
};

export default ProjectModal;
