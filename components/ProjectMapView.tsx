
import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { GitGraph, AlertCircle, CheckCircle2, Clock, Lock, Ban } from 'lucide-react';

interface ProjectMapViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

interface GraphNode extends Task {
  x: number;
  y: number;
  level: number;
  color: string;
  borderColor: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
  isBlocked: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Layout Constants
const NODE_WIDTH = 300;
const NODE_HEIGHT = 120;
const X_GAP = 100;
const Y_GAP = 40;
const PADDING = 80;

const ProjectMapView: React.FC<ProjectMapViewProps> = ({ tasks, onTaskClick }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // --- Color Mapping Helper ---
  const getNodeStyles = (status: string, isBlocked: boolean, priority: string) => {
    if (isBlocked) return { bg: 'bg-slate-50 dark:bg-slate-900/50', border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-500', iconColor: 'text-slate-400' };
    
    switch (status) {
      case 'Done':
        return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-500', text: 'text-emerald-900 dark:text-emerald-100', iconColor: 'text-emerald-500' };
      case 'In Progress':
        return { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-500', text: 'text-blue-900 dark:text-blue-100', iconColor: 'text-blue-500' };
      default: // To Do
        if (priority === 'High') return { bg: 'bg-white dark:bg-slate-800', border: 'border-rose-400', text: 'text-slate-900 dark:text-white', iconColor: 'text-rose-500' };
        return { bg: 'bg-white dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-900 dark:text-white', iconColor: 'text-slate-400' };
    }
  };

  // --- Layout Engine (Part 1) ---
  const graphNodes = useMemo<GraphNode[]>(() => {
    const nodes: GraphNode[] = [];
    const levels = new Map<string, number>();
    
    // 1. Initialize levels
    tasks.forEach(t => levels.set(t.id, 0));

    // 2. Calculate Levels (Longest Path Algorithm / Relaxation)
    // Run N times to propagate dependency depths (N = num tasks, sufficient for DAG)
    for (let i = 0; i < tasks.length; i++) {
      let changed = false;
      tasks.forEach(task => {
        if (task.dependencies && task.dependencies.length > 0) {
          let maxParentLevel = -1;
          task.dependencies.forEach(depId => {
            if (levels.has(depId)) {
              maxParentLevel = Math.max(maxParentLevel, levels.get(depId)!);
            }
          });
          
          const newLevel = maxParentLevel + 1;
          if (newLevel > levels.get(task.id)!) {
            levels.set(task.id, newLevel);
            changed = true;
          }
        }
      });
      if (!changed) break;
    }

    // 3. Group by Level
    const levelsArray: Task[][] = [];
    tasks.forEach(task => {
      const lvl = levels.get(task.id) || 0;
      if (!levelsArray[lvl]) levelsArray[lvl] = [];
      levelsArray[lvl].push(task);
    });

    // 4. Assign Geometry (X, Y)
    const maxRows = Math.max(...levelsArray.map(l => l ? l.length : 0));
    const canvasHeight = Math.max(maxRows * (NODE_HEIGHT + Y_GAP), 800);

    levelsArray.forEach((levelTasks, levelIndex) => {
      if (!levelTasks) return;
      
      // Sort purely for stability (alphabetical)
      levelTasks.sort((a, b) => a.title.localeCompare(b.title));

      const columnHeight = levelTasks.length * (NODE_HEIGHT + Y_GAP) - Y_GAP;
      const startY = (canvasHeight - columnHeight) / 2 + PADDING;

      levelTasks.forEach((task, index) => {
        const styles = getNodeStyles(task.status, false, task.priority); // 'isBlocked' calc deferred to render time
        
        nodes.push({
          ...task,
          level: levelIndex,
          x: PADDING + levelIndex * (NODE_WIDTH + X_GAP),
          y: startY + index * (NODE_HEIGHT + Y_GAP),
          color: styles.bg,
          borderColor: styles.border
        });
      });
    });

    return nodes;
  }, [tasks]);

  // --- Connection Engine (Part 2 - Visualization) ---
  const connections = useMemo<Connection[]>(() => {
    const conns: Connection[] = [];
    graphNodes.forEach(node => {
        if (!node.dependencies) return;
        node.dependencies.forEach(depId => {
            const parent = graphNodes.find(n => n.id === depId);
            if (parent) {
                // Coordinates
                const startX = parent.x + NODE_WIDTH;
                const startY = parent.y + NODE_HEIGHT / 2;
                const endX = node.x;
                const endY = node.y + NODE_HEIGHT / 2;

                // Bezier Control Points (S-Curve)
                const cp1x = startX + (X_GAP / 2);
                const cp2x = endX - (X_GAP / 2);

                const path = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;
                
                // Blocked Logic: Parent is NOT Done
                const isBlocked = parent.status !== 'Done';

                conns.push({
                    id: `${parent.id}-${node.id}`,
                    sourceId: parent.id,
                    targetId: node.id,
                    path,
                    isBlocked,
                    startX, startY, endX, endY
                });
            }
        });
    });
    return conns;
  }, [graphNodes]);

  // --- Highlight Logic (Traverse Up & Down) ---
  const highlightContext = useMemo(() => {
      if (!hoveredNodeId) return { relatedNodes: new Set(), relatedConnections: new Set() };

      const relatedNodes = new Set<string>();
      const relatedConnections = new Set<string>();
      
      // Add self
      relatedNodes.add(hoveredNodeId);

      // 1. Upstream (Parents) - Recursive
      const traverseUp = (currentId: string) => {
          const node = graphNodes.find(n => n.id === currentId);
          if (!node || !node.dependencies) return;
          node.dependencies.forEach(depId => {
              if (!relatedNodes.has(depId)) {
                  relatedNodes.add(depId);
                  relatedConnections.add(`${depId}-${currentId}`);
                  traverseUp(depId);
              } else {
                  // Edge case: already visited node, but still need to highlight the connection
                  relatedConnections.add(`${depId}-${currentId}`);
              }
          });
      };
      traverseUp(hoveredNodeId);

      // 2. Downstream (Children) - Recursive
      // Need to scan all nodes to see who points to current
      const traverseDown = (currentId: string) => {
          graphNodes.forEach(possibleChild => {
              if (possibleChild.dependencies && possibleChild.dependencies.includes(currentId)) {
                  relatedConnections.add(`${currentId}-${possibleChild.id}`);
                  if (!relatedNodes.has(possibleChild.id)) {
                      relatedNodes.add(possibleChild.id);
                      traverseDown(possibleChild.id);
                  }
              }
          });
      };
      traverseDown(hoveredNodeId);

      return { relatedNodes, relatedConnections };
  }, [hoveredNodeId, graphNodes]);


  // Calculate Container Size
  const containerWidth = useMemo(() => {
    const maxX = Math.max(...graphNodes.map(n => n.x), 0);
    return maxX + NODE_WIDTH + PADDING * 2;
  }, [graphNodes]);

  const containerHeight = useMemo(() => {
    const maxY = Math.max(...graphNodes.map(n => n.y), 0);
    return maxY + NODE_HEIGHT + PADDING * 2;
  }, [graphNodes]);

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 z-10 relative">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitGraph size={24} className="text-indigo-600 dark:text-indigo-400" />
            Project Map
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Dependency network visualization.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Done</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Active</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400"></div> Pending</div>
              <div className="flex items-center gap-1"><Ban size={10} className="text-red-500" /> Blocked</div>
           </div>
           <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
           <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
              {tasks.length} Tasks
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 relative cursor-grab active:cursor-grabbing">
        <div 
            className="relative"
            style={{ width: containerWidth, height: containerHeight }}
        >
            {/* --- SVG Layer (Connectors) --- */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>
                    <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                    </marker>
                </defs>
                {connections.map(conn => {
                    const isHighlighted = highlightContext.relatedConnections.has(conn.id);
                    const isDimmed = hoveredNodeId && !isHighlighted;
                    const strokeColor = conn.isBlocked 
                        ? (isHighlighted ? '#f87171' : '#e2e8f0') // Red if highlighted blocked, else light gray
                        : (isHighlighted ? '#10b981' : '#cbd5e1'); // Green if highlighted done, else slate
                    
                    return (
                        <g key={conn.id} className={`transition-opacity duration-300 ${isDimmed ? 'opacity-10' : 'opacity-100'}`}>
                            <path 
                                d={conn.path}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={isHighlighted ? 3 : 2}
                                strokeDasharray={conn.isBlocked ? "5,5" : "none"}
                                markerEnd={!conn.isBlocked && isHighlighted ? "url(#arrowhead-green)" : (conn.isBlocked ? "" : "url(#arrowhead)")}
                                className="transition-all duration-300"
                            />
                            {conn.isBlocked && (
                                <foreignObject x={(conn.startX + conn.endX)/2 - 12} y={(conn.startY + conn.endY)/2 - 12} width="24" height="24">
                                    <div className="w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-red-200 dark:border-red-900 shadow-sm z-10">
                                        <Lock size={12} className="text-red-500" />
                                    </div>
                                </foreignObject>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* --- Node Layer (Cards) --- */}
            {graphNodes.map(node => {
                // Calculate Blocked Status relative to parents
                const isBlocked = node.dependencies && node.dependencies.some(depId => {
                    const parent = tasks.find(t => t.id === depId);
                    return parent && parent.status !== 'Done';
                });
                
                const styles = getNodeStyles(node.status, !!isBlocked, node.priority);
                const isDone = node.status === 'Done';
                const isHighlighted = highlightContext.relatedNodes.has(node.id);
                const isDimmed = hoveredNodeId && !isHighlighted;

                return (
                    <div
                        key={node.id}
                        onClick={() => onTaskClick(node)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className={`
                            absolute rounded-xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 border-l-4 flex flex-col justify-between group cursor-pointer
                            ${styles.bg} ${styles.border}
                            ${isBlocked ? 'opacity-90' : ''}
                            ${isDimmed ? 'opacity-20 blur-[1px] scale-95 grayscale' : 'opacity-100 scale-100'}
                            ${isHighlighted && hoveredNodeId !== node.id ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900 scale-105 z-20' : 'z-10'}
                            ${hoveredNodeId === node.id ? 'z-30 scale-110 shadow-2xl' : ''}
                        `}
                        style={{
                            left: node.x,
                            top: node.y,
                            width: NODE_WIDTH,
                            height: NODE_HEIGHT
                        }}
                    >
                        <div className="flex justify-between items-start">
                            <h4 className={`font-bold text-sm line-clamp-2 leading-snug ${styles.text} pr-6`}>
                                {node.title}
                            </h4>
                            {/* Status Icon Top Right */}
                            <div className="absolute top-4 right-4">
                                {isBlocked ? (
                                    <Ban size={18} className="text-red-400" />
                                ) : isDone ? (
                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                ) : (
                                    <div className={`w-4 h-4 rounded-full border-2 ${styles.border.replace('border-', 'border-')} opacity-50`}></div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-end justify-between mt-2">
                            <div className="text-xs space-y-1">
                                <div className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    {node.assigneeAvatar ? (
                                        <img src={node.assigneeAvatar} className="w-5 h-5 rounded-full border border-white dark:border-slate-700" alt="" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold">
                                            {node.assignee.substring(0, 1)}
                                        </div>
                                    )}
                                    <span className="truncate max-w-[120px]">{node.assignee}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-400 pl-0.5">
                                    <Clock size={12} />
                                    <span>{new Date(node.dueDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                            
                            {node.priority === 'High' && !isDone && (
                                <div className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-800 animate-pulse">
                                    <AlertCircle size={10} /> High
                                </div>
                            )}
                        </div>
                        
                        {/* Level Pill (Debug/Info) */}
                        {hoveredNodeId === node.id && (
                             <div className="absolute -top-3 left-2 bg-slate-800 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md animate-fade-in">
                                Level {node.level}
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default ProjectMapView;
