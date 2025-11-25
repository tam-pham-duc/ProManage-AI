
import { collection, doc, writeBatch, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TaskPriority, ActivityLog, ActivityType } from '../types';

// Helper Data Generators
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

    // --- 1. Create "Structural Engineering" Project (Complex Dependencies) ---
    const complexProjectRef = doc(collection(db, 'projects'));
    batch.set(complexProjectRef, {
        ownerId: userId,
        name: 'Skyline Tower - Phase 1',
        clientName: 'Apex Developers',
        address: '200 Innovation Blvd',
        status: 'Active',
        createdAt: new Date().toISOString(),
        members: [
            { uid: userId, email: 'demo@user.com', displayName: 'You', role: 'admin' },
            { uid: 'u1', email: 'sarah@demo.com', displayName: 'Sarah W.', role: 'editor' }
        ],
        memberUIDs: [userId, 'u1']
    });

    // Create IDs for dependency chaining
    const taskFoundationRef = doc(collection(db, 'tasks'));
    const taskWallsRef = doc(collection(db, 'tasks'));
    const taskRoofRef = doc(collection(db, 'tasks'));
    const taskInteriorRef = doc(collection(db, 'tasks'));
    const taskDeletedRef = doc(collection(db, 'tasks'));

    // Task A: Foundation (In Progress)
    batch.set(taskFoundationRef, {
        ownerId: userId,
        projectId: complexProjectRef.id,
        title: "Pour Concrete Foundation",
        status: "In Progress",
        priority: "High",
        startDate: getRandomDate(-5, -2),
        dueDate: getRandomDate(2, 5),
        assignee: "Sarah W.",
        assigneeId: "u1",
        estimatedCost: 25000,
        actualCost: 10000,
        description: "<p>Coordinate with concrete supplier for <b>Grade 40 mix</b>.</p><ul><li>Check rebar spacing</li><li>Verify formwork integrity</li><li>Schedule pump truck</li></ul>",
        subtasks: [
            { id: "st1", title: "Excavation", completed: true },
            { id: "st2", title: "Rebar Installation", completed: true },
            { id: "st3", title: "Pouring", completed: false }
        ],
        comments: [],
        activityLog: [{ id: "log1", action: "started task", timestamp: getRandomTimestamp(24), userName: "Sarah W.", type: "status_change" }],
        attachments: [],
        tags: [{ id: "t1", name: "Structural", colorClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" }],
        createdAt: serverTimestamp()
    });

    // Task B: Walls (Blocked by Foundation)
    batch.set(taskWallsRef, {
        ownerId: userId,
        projectId: complexProjectRef.id,
        title: "Erect Steel Frame & Walls",
        status: "To Do",
        priority: "Medium",
        startDate: getRandomDate(6, 8),
        dueDate: getRandomDate(15, 20),
        assignee: "Unassigned",
        assigneeId: "UN",
        estimatedCost: 45000,
        actualCost: 0,
        description: "<p>Begin steel erection sequence as per <i>Sheet S-201</i>.</p><p><b>Note:</b> Ensure anchor bolts are cured before starting.</p>",
        dependencies: [taskFoundationRef.id], // Dependency Link
        subtasks: [],
        comments: [],
        activityLog: [],
        attachments: [],
        tags: [{ id: "t1", name: "Structural", colorClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" }],
        createdAt: serverTimestamp()
    });

    // Task C: Roof (Blocked by Walls)
    batch.set(taskRoofRef, {
        ownerId: userId,
        projectId: complexProjectRef.id,
        title: "Install Roof Decking",
        status: "To Do",
        priority: "Low",
        startDate: getRandomDate(21, 22),
        dueDate: getRandomDate(25, 30),
        assignee: "Mike R.",
        assigneeId: "u2",
        estimatedCost: 15000,
        actualCost: 0,
        description: "Install corrugated metal decking and weatherproofing layer.",
        dependencies: [taskWallsRef.id], // Dependency Link
        subtasks: [],
        comments: [],
        activityLog: [],
        attachments: [],
        tags: [],
        createdAt: serverTimestamp()
    });

    // Task D: Soft Deleted Example
    batch.set(taskDeletedRef, {
        ownerId: userId,
        projectId: complexProjectRef.id,
        title: "Legacy Blueprints (Archived)",
        status: "Done",
        priority: "Low",
        startDate: getRandomDate(-30, -20),
        dueDate: getRandomDate(-10, -5),
        assignee: "Unassigned",
        description: "Old version of plans. Deleted to avoid confusion.",
        isDeleted: true, // Soft Delete Flag
        deletedAt: new Date().toISOString(),
        createdAt: serverTimestamp()
    });


    // --- 2. Create "Urgent Repairs" Project (Simple List) ---
    const urgentProjectRef = doc(collection(db, 'projects'));
    batch.set(urgentProjectRef, {
        ownerId: userId,
        name: 'Downtown Emergency Repairs',
        clientName: 'City Metro',
        address: '880 Main St',
        status: 'Active',
        createdAt: getRandomTimestamp(48), // Recent
        members: [{ uid: userId, email: 'demo@user.com', displayName: 'You', role: 'admin' }],
        memberUIDs: [userId]
    });

    for (let i = 0; i < 5; i++) {
        const tRef = doc(collection(db, 'tasks'));
        batch.set(tRef, {
            ownerId: userId,
            projectId: urgentProjectRef.id,
            title: `Emergency Repair Unit ${i + 101}`,
            status: Math.random() > 0.5 ? 'In Progress' : 'To Do',
            priority: 'High',
            startDate: getRandomDate(-1, 0),
            dueDate: getRandomDate(1, 3),
            assignee: "Unassigned",
            estimatedCost: 500,
            description: "Standard emergency response ticket.",
            tags: [{ id: 'urg', name: 'Urgent', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }],
            createdAt: serverTimestamp()
        });
    }
    
    await batch.commit();
};
