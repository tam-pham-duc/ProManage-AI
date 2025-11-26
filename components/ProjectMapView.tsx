
import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { GitGraph, AlertCircle, CheckCircle2, Clock, Lock, Ban, Check, ArrowRight } from 'lucide-react';

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

const SmartConnector: React.FC<{ connection: Connection; isHighlighted: boolean; isDimmed: boolean }> = ({ connection, isHighlighted, isDimmed }) => {
    const { isBlocked, startX, startY, endX, endY, path } = connection;
    
    // Midpoint calculation for icon placement
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Dynamic Styles
    const strokeColor = isBlocked 
        ? (isHighlighted ? '#f87171' : '#94a3b8') // Red if highlighted blocked, else slate-400
        : (isHighlighted ? '#10b981' : '#cbd5e1'); // Green if highlighted done, else slate-300
    
    const strokeWidth = isHighlighted ? 3 : 2;
    const strokeDasharray = isBlocked ? "5,5" : "none";
    
    const animationClass = !isBlocked && isHighlighted ? "animate-flow-pulse" : "";

    return (
        <g className={`transition-opacity duration-300 ${isDimmed ? 'opacity-10' : 'opacity-100'}`}>
            <path 
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                className={`transition-all duration-300 ${animationClass}`}
            />
            
            <foreignObject x={midX - 12} y={midY - 12} width="24" height="24">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-sm z-10 transition-transform duration-300 ${isHighlighted ? 'scale-125' : ''} ${
                    isBlocked 
                        ? 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-900' 
                        : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800'
                }`}>
                    {isBlocked ? (
                        <Lock size={10} className="text-red-500" />
                    ) : (
                        <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                    )}
                </div>
            </foreignObject>
        </g>
    );
};

const ProjectMapView: React.FC<ProjectMapViewProps> = ({ tasks, onTaskClick }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // --- Color Mapping Helper ---
  const getNodeStyles = (status: string, isBlocked: boolean, priority: string) => {
    // Blocked Overrides
    if (isBlocked) {
        return { 
            bg: 'bg-slate-50 dark:bg-slate-900/50', 
            border: 'border-red-300 dark:border-red-900/50', 
            text: 'text-slate-500', 
            shadow: 'shadow-none',
            glow: 'ring-1 ring-red-200 dark:ring-red-900/30'
        };
    }
    
    switch (status) {
      case 'Done':
        return { 
            bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
            border: 'border-emerald-500', 
            text: 'text-emerald-900 dark:text-emerald-100',
            shadow: 'shadow-sm',
            glow: ''
        };
      case 'In Progress':
        return { 
            bg: 'bg-blue-50 dark:bg-blue-900/20', 
            border: 'border-blue-500', 
            text: 'text-blue-900 dark:text-blue-100',
            shadow: 'shadow-md shadow-blue-100 dark:shadow-blue-900/20',
            glow: ''
        };
      default: // To Do
        if (priority === 'High') return { 
            bg: 'bg-white dark:bg-slate-800', 
            border: 'border-rose-400', 
            text: 'text-slate-900 dark:text-white',
            shadow: 'shadow-sm',
            glow: ''
        };
        return { 
            bg: 'bg-white dark:bg-slate-800', 
            border: 'border-slate-300 dark:border-slate-600', 
            text: 'text-slate-900 dark:text-white',
            shadow: 'shadow-sm',
            glow: ''
        };
    }
  };

  // --- Layout Engine ---
  const graphNodes = useMemo<GraphNode[]>(() => {
    const validTasks = (tasks || []).filter(t => t && t.id);
    const nodes: GraphNode[] = [];
    const levels = new Map<string, number>();
    
    validTasks.forEach(t => levels.set(t.id, 0));

    for (let i = 0; i < validTasks.length; i++) {
      let changed = false;
      validTasks.forEach(task => {
        const deps = task.dependencies || [];
        if (deps.length > 0) {
          let maxParentLevel = -1;
          deps.forEach(depId => {
            if (levels.has(depId)) {
              const parentLevel = levels.get(depId);
              if (typeof parentLevel === 'number') {
                maxParentLevel = Math.max(maxParentLevel, parentLevel);
              }
            }
          });
          
          const newLevel = maxParentLevel + 1;
          const currentLevel = levels.get(task.id) || 0;
          if (newLevel > currentLevel) {
            levels.set(task.id, newLevel);
            changed = true;
          }
        }
      });
      if (!changed) break;
    }

    const levelsArray: Task[][] = [];
    validTasks.forEach(task => {
      const lvl = levels.get(task.id) || 0;
      if (!levelsArray[lvl]) levelsArray[lvl] = [];
      levelsArray[lvl].push(task);
    });

    const maxRows = Math.max(...levelsArray.map(l => l ? l.length : 0));
    const canvasHeight = Math.max(maxRows * (NODE_HEIGHT + Y_GAP), 800);

    levelsArray.forEach((levelTasks, levelIndex) => {
      if (!levelTasks) return;
      
      levelTasks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      const columnHeight = levelTasks.length * (NODE_HEIGHT + Y_GAP) - Y_GAP;
      const startY = (canvasHeight - columnHeight) / 2 + PADDING;

      levelTasks.forEach((task, index) => {
        const styles = getNodeStyles(task.status, false, task.priority); 
        
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

  // --- Connection Engine ---
  const connections = useMemo<Connection[]>(() => {
    const conns: Connection[] = [];
    graphNodes.forEach(node => {
        const deps = node.dependencies || [];
        deps.forEach(depId => {
            const parent = graphNodes.find(n => n.id === depId);
            if (parent) {
                const startX = parent.x + NODE_WIDTH;
                const startY = parent.y + NODE_HEIGHT / 2;
                const endX = node.x;
                const endY = node.y + NODE_HEIGHT / 2;

                const cp1x = startX + (X_GAP / 2);
                const cp2x = endX - (X_GAP / 2);

                const path = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;
                
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

  // --- Highlight Logic ---
  const highlightContext = useMemo(() => {
      if (!hoveredNodeId) return { relatedNodes: new Set(), relatedConnections: new Set() };

      const relatedNodes = new Set<string>();
      const relatedConnections = new Set<string>();
      
      relatedNodes.add(hoveredNodeId);

      const traverseUp = (currentId: string) => {
          const node = graphNodes.find(n => n.id === currentId);
          const deps = node?.dependencies || [];
          if (!node || deps.length === 0) return;
          
          deps.forEach(depId => {
              if (!relatedNodes.has(depId)) {
                  relatedNodes.add(depId);
                  relatedConnections.add(`${depId}-${currentId}`);
                  traverseUp(depId);
              } else {
                  relatedConnections.add(`${depId}-${currentId}`);
              }
          });
      };
      traverseUp(hoveredNodeId);

      const traverseDown = (currentId: string) => {
          graphNodes.forEach(possibleChild => {
              const deps = possibleChild.dependencies || [];
              if (deps.includes(currentId)) {
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
      <style>{`
        @keyframes flow-pulse {
          0%, 100% { stroke-opacity: 1; stroke-width: 3; }
          50% { stroke-opacity: 0.6; stroke-width: 4; }
        }
        .animate-flow-pulse {
          animation: flow-pulse 2s ease-in-out infinite;
        }
      `}</style>
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
              <div className="flex items-center gap-1"><Lock size={10} className="text-red-500" /> Blocked</div>
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
                {connections.map(conn => {
                    const isHighlighted = highlightContext.relatedConnections.has(conn.id);
                    const isDimmed = hoveredNodeId && !isHighlighted;
                    
                    return (
                        <SmartConnector 
                            key={conn.id}
                            connection={conn}
                            isHighlighted={isHighlighted}
                            isDimmed={!!isDimmed}
                        />
                    );
                })}
            </svg>

            {/* --- Node Layer (Cards) --- */}
            {graphNodes.map(node => {
                const deps = node.dependencies || [];
                const isBlocked = deps.some(depId => {
                    const parent = tasks.find(t => t && t.id === depId);
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
                            absolute rounded-xl p-4 transition-all duration-300 border-l-4 flex flex-col justify-between group cursor-pointer
                            ${styles.bg} ${styles.border} ${styles.shadow} ${styles.glow}
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
                            
                            <div className="absolute top-4 right-4">
                                {isBlocked ? (
                                    <div className="relative">
                                        <Ban size={18} className="text-red-400" />
                                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                    </div>
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
                                            {node.assignee ? node.assignee.substring(0, 1) : 'U'}
                                        </div>
                                    )}
                                    <span className="truncate max-w-[120px]">{node.assignee || 'Unassigned'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-400 pl-0.5">
                                    <Clock size={12} />
                                    <span>{node.dueDate ? new Date(node.dueDate).toLocaleDateString() : 'No Date'}</span>
                                </div>
                            </div>
                            
                            {node.priority === 'High' && !isDone && (
                                <div className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-800 animate-pulse">
                                    <AlertCircle size={10} /> High
                                </div>
                            )}
                        </div>
                        
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
