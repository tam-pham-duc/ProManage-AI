
import { collection, doc, writeBatch, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TaskPriority, ActivityLog, ActivityType } from '../types';

// Helper Data Generators
const VERBS = ["Install", "Inspect", "Repair", "Pour", "Draft", "Survey", "Excavate", "Paint", "Wire", "Frame", "Level", "Demolish", "Weld", "Seal", "Reinforce"];
const NOUNS = ["Foundation", "HVAC System", "Roofing", "Drywall", "Electrical Panel", "Plumbing", "Windows", "Flooring", "Insulation", "Landscaping", "Steel Beams", "Concrete Slab", "Ventilation", "Support Columns"];
const USERS = [
    { name: 'Sarah W.', initials: 'SW', avatar: '' },
    { name: 'Mike R.', initials: 'MR', avatar: '' },
    { name: 'Alex J.', initials: 'AJ', avatar: '' },
    { name: 'Jessica T.', initials: 'JT', avatar: '' }
];

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const getRandomDate = (startOffsetDays: number, endOffsetDays: number) => {
    const date = new Date();
    const offset = Math.floor(Math.random() * (endOffsetDays - startOffsetDays + 1)) + startOffsetDays;
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
};

const getRandomTimestamp = (startOffsetHours: number) => {
    const date = new Date();
    date.setHours(date.getHours() - Math.floor(Math.random() * startOffsetHours));
    return date.toISOString();
};

const getRandomStatus = (bias?: 'future' | 'active' | 'urgent'): string => {
    const statuses = ['To Do', 'To Do', 'In Progress', 'In Progress', 'Done'];
    if (bias === 'future') return Math.random() > 0.85 ? 'In Progress' : 'To Do';
    if (bias === 'active') return getRandomItem(['To Do', 'In Progress', 'Done']);
    if (bias === 'urgent') return Math.random() > 0.6 ? 'In Progress' : 'To Do';
    return getRandomItem(statuses);
};

const getRandomPriority = (bias?: 'urgent' | 'low'): TaskPriority => {
    if (bias === 'urgent') return Math.random() > 0.3 ? 'High' : 'Medium';
    if (bias === 'low') return Math.random() > 0.7 ? 'Medium' : 'Low';
    return getRandomItem(['High', 'Medium', 'Low']);
};

const generateTitle = () => `${getRandomItem(VERBS)} ${getRandomItem(NOUNS)}`;

export const clearDevData = async (userId: string) => {
    const batch = writeBatch(db);
    let opCount = 0;

    // Get Tasks
    const tasksQ = query(collection(db, 'tasks'), where('ownerId', '==', userId));
    const tasksSnap = await getDocs(tasksQ);
    tasksSnap.forEach(doc => {
        batch.delete(doc.ref);
        opCount++;
    });

    // Get Projects
    const projQ = query(collection(db, 'projects'), where('ownerId', '==', userId));
    const projSnap = await getDocs(projQ);
    projSnap.forEach(doc => {
        batch.delete(doc.ref);
        opCount++;
    });

    if (opCount > 0) await batch.commit();
};

export const generateDemoData = async (userId: string) => {
    const batch = writeBatch(db);

    // Define Scenarios
    const scenarios = [
        {
            name: 'Luxury Villa - Riverside',
            client: 'Rivera Holdings',
            address: '450 Palm Blvd',
            type: 'complex',
            taskCount: 20,
            dateBias: { start: -30, end: 30 }
        },
        {
            name: 'Emergency Repair - Downtown',
            client: 'City Metro Services',
            address: '880 Main St',
            type: 'urgent',
            taskCount: 15,
            dateBias: { start: -5, end: 10 }
        },
        {
            name: 'Q4 Planning - New City',
            client: 'Urban Future Grp',
            address: '101 Innovation Way',
            type: 'future',
            taskCount: 15,
            dateBias: { start: 10, end: 60 }
        }
    ];

    // Generate Data
    for (const scenario of scenarios) {
        // Create Project
        const projectRef = doc(collection(db, 'projects'));
        batch.set(projectRef, {
            ownerId: userId,
            name: scenario.name,
            clientName: scenario.client,
            address: scenario.address,
            status: 'Active',
            createdAt: new Date().toISOString(),
            members: [
                { uid: userId, email: 'demo@user.com', displayName: 'You', role: 'admin' },
                { uid: 'u1', email: 'sarah@demo.com', displayName: 'Sarah W.', role: 'editor' },
                { uid: 'u2', email: 'mike@demo.com', displayName: 'Mike R.', role: 'viewer' }
            ],
            memberUIDs: [userId, 'u1', 'u2']
        });

        // Create Tasks
        for (let i = 0; i < scenario.taskCount; i++) {
            const taskRef = doc(collection(db, 'tasks'));
            
            // Basic Task Data
            let status = getRandomStatus(scenario.type as any);
            let priority = getRandomPriority(scenario.type as any);
            
            let startDate = getRandomDate(scenario.dateBias.start, scenario.dateBias.end - 5);
            let dueDate = getRandomDate(scenario.dateBias.start + 5, scenario.dateBias.end);
            let estimatedCost = Math.floor(Math.random() * 5000) + 500;
            let actualCost = status === 'Done' ? estimatedCost + (Math.random() * 1000 - 500) : 0;
            
            let title = generateTitle();
            let description = `Standard task generated for **${scenario.name}**.\n\nEnsure all safety protocols are followed.`;
            let subtasks: any[] = [];
            let comments: any[] = [];
            let tags: any[] = [];
            let assignee = getRandomItem(['Sarah W.', 'Mike R.', 'Alex J.', 'Unassigned']);
            let assigneeId = 'UN';
            let assigneeAvatar = '';

            if (assignee !== 'Unassigned') {
                // Mock IDs
                if (assignee === 'Sarah W.') { assigneeId = 'u1'; }
                if (assignee === 'Mike R.') { assigneeId = 'u2'; }
            }

            // --- EDGE CASES INJECTION ---
            let activityLogs: ActivityLog[] = [];
            const createdUser = getRandomItem(USERS);
            
            activityLogs.push({ 
                id: `log-${i}-create`, 
                action: 'created this task', 
                timestamp: getRandomTimestamp(120), // ISO string
                userName: createdUser.name,
                type: 'create'
            });

            // Case 1: Overdue Task
            if (scenario.type === 'complex' && i === 0) {
                title = "CRITICAL: Foundation Inspection (Overdue)";
                status = "In Progress";
                priority = "High";
                dueDate = getRandomDate(-10, -2); // Past date
                tags.push({ id: 't-urgent', name: 'Urgent', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' });
                
                activityLogs.push({
                    id: `log-${i}-alert`,
                    action: 'marked as urgent',
                    details: 'Priority raised to High due to delays',
                    timestamp: getRandomTimestamp(5),
                    userName: 'System',
                    type: 'alert'
                });
            }

            // Case 2: Discussion Heavy
            if (scenario.type === 'complex' && i === 2) {
                title = "Client Design Review";
                comments = [
                    { id: 'c1', user: 'Sarah W.', text: 'Client wants to change the facade material to brick.', timestamp: getRandomTimestamp(48) },
                    { id: 'c2', user: 'Mike R.', text: 'That will increase the budget by approx $2k.', timestamp: getRandomTimestamp(24) },
                ];
            }

            // Add random status changes
            if (Math.random() > 0.7) {
                const u = getRandomItem(USERS);
                const oldStatus = status === 'Done' ? 'In Progress' : 'To Do';
                activityLogs.push({
                     id: `log-${i}-update`,
                     action: 'changed status',
                     details: `From ${oldStatus} -> ${status}`,
                     timestamp: getRandomTimestamp(10),
                     userName: u.name,
                     type: 'status_change'
                });
            }

            batch.set(taskRef, {
                ownerId: userId,
                projectId: projectRef.id,
                title: title,
                status: status,
                priority: priority,
                startDate: startDate,
                dueDate: dueDate,
                assignee: assignee,
                assigneeId: assigneeId,
                assigneeAvatar: assigneeAvatar,
                estimatedCost: estimatedCost,
                actualCost: actualCost,
                description: description,
                subtasks: subtasks,
                comments: comments,
                activityLog: activityLogs,
                attachments: [],
                tags: tags,
                createdAt: serverTimestamp()
            });
        }
    }
    
    await batch.commit();
};