
import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { GitGraph, AlertCircle, CheckCircle2, Clock, Lock, Ban, Check, ArrowRight, Zap } from 'lucide-react';

interface ProjectMapViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

interface GraphNode extends Task {
  x: number;
  y: number;
  level: number;
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
const NODE_WIDTH = 280;
const NODE_HEIGHT = 100;
const X_GAP = 120;
const Y_GAP = 40;
const PADDING = 80;

const SmartConnector: React.FC<{ connection: Connection; isHighlighted: boolean; isDimmed: boolean }> = ({ connection, isHighlighted, isDimmed }) => {
    const { isBlocked, startX, startY, endX, endY, path } = connection;
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Visual Logic
    const strokeColor = isBlocked 
        ? (isHighlighted ? '#f87171' : '#94a3b8') // Red-400 if active blocked, else Slate-400
        : (isHighlighted ? '#10b981' : '#cbd5e1'); // Emerald-500 if active flowing, else Slate-300
    
    const strokeWidth = isHighlighted ? 3 : 2;
    
    // Flow Animation: Only active if Highlighted AND Unlocked
    const isFlowing = isHighlighted && !isBlocked;
    
    // Line Style
    // Blocked: Dashed
    // Flowing: Dashed (for animation movement) but looks like moving ants
    // Static Unlocked: Solid
    const strokeDasharray = isBlocked ? "6, 4" : (isFlowing ? "8, 4" : "none");
    const animationClass = isFlowing ? "animate-dash-flow" : "";

    return (
        <g className={`transition-all duration-500 ${isDimmed ? 'opacity-20' : 'opacity-100'}`}>
            {/* Glow effect for active lines */}
            {isHighlighted && (
                <path 
                    d={path} 
                    fill="none" 
                    stroke={isBlocked ? "rgba(248, 113, 113, 0.2)" : "rgba(16, 185, 129, 0.2)"} 
                    strokeWidth={8} 
                    className="transition-all duration-500"
                />
            )}

            <path 
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                className={`transition-all duration-500 ${animationClass}`}
            />
            
            {/* Connector Icon Badge */}
            <foreignObject x={midX - 12} y={midY - 12} width="24" height="24">
                <div 
                    className={`
                        w-6 h-6 rounded-full flex items-center justify-center border shadow-sm z-10 transition-transform duration-300
                        ${isHighlighted ? 'scale-125' : 'scale-100'} 
                        ${isBlocked 
                            ? 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-900 shadow-red-100 dark:shadow-none' 
                            : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 shadow-emerald-100 dark:shadow-none'
                        }
                    `}
                >
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

  // --- Layout Engine ---
  const graphNodes = useMemo<GraphNode[]>(() => {
    const validTasks = (tasks || []).filter(t => t && t.id);
    const nodes: GraphNode[] = [];
    const levels = new Map<string, number>();
    
    // Initialize levels
    validTasks.forEach(t => levels.set(t.id, 0));

    // Determine topological levels
    for (let i = 0; i < validTasks.length; i++) {
      let changed = false;
      validTasks.forEach(task => {
        const deps = task.dependencies || [];
        if (deps.length > 0) {
          let maxParentLevel = -1;
          deps.forEach(depId => {
            if (levels.has(depId)) {
              const parentLevel = levels.get(depId) || 0;
              maxParentLevel = Math.max(maxParentLevel, parentLevel);
            }
          });
          
          const newLevel = maxParentLevel + 1;
          if (newLevel > (levels.get(task.id) || 0)) {
            levels.set(task.id, newLevel);
            changed = true;
          }
        }
      });
      if (!changed) break;
    }

    // Group by level
    const levelsArray: Task[][] = [];
    validTasks.forEach(task => {
      const lvl = levels.get(task.id) || 0;
      if (!levelsArray[lvl]) levelsArray[lvl] = [];
      levelsArray[lvl].push(task);
    });

    const maxRows = Math.max(...levelsArray.map(l => l ? l.length : 0));
    const canvasHeight = Math.max(maxRows * (NODE_HEIGHT + Y_GAP), 800);

    // Position nodes
    levelsArray.forEach((levelTasks, levelIndex) => {
      if (!levelTasks) return;
      // Sort within level for stability
      levelTasks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      const columnHeight = levelTasks.length * (NODE_HEIGHT + Y_GAP) - Y_GAP;
      const startY = (canvasHeight - columnHeight) / 2 + PADDING;

      levelTasks.forEach((task, index) => {
        nodes.push({
          ...task,
          level: levelIndex,
          x: PADDING + levelIndex * (NODE_WIDTH + X_GAP),
          y: startY + index * (NODE_HEIGHT + Y_GAP)
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
                // Calculate connection points
                const startX = parent.x + NODE_WIDTH;
                const startY = parent.y + NODE_HEIGHT / 2;
                const endX = node.x;
                const endY = node.y + NODE_HEIGHT / 2;

                // Bezier Control Points
                const cp1x = startX + (X_GAP * 0.5);
                const cp2x = endX - (X_GAP * 0.5);

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

  // --- Cinematic Highlight Logic ---
  const highlightContext = useMemo(() => {
      if (!hoveredNodeId) return { relatedNodes: new Set<string>(), relatedConnections: new Set<string>() };

      const relatedNodes = new Set<string>();
      const relatedConnections = new Set<string>();
      
      relatedNodes.add(hoveredNodeId);

      // Traverse Upstream (Parents)
      const traverseUp = (currentId: string) => {
          const node = graphNodes.find(n => n.id === currentId);
          const deps = node?.dependencies || [];
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

      // Traverse Downstream (Children)
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

  // Container Dimensions
  const containerWidth = useMemo(() => {
    const maxX = Math.max(...graphNodes.map(n => n.x), 0);
    return maxX + NODE_WIDTH + PADDING * 2;
  }, [graphNodes]);

  const containerHeight = useMemo(() => {
    const maxY = Math.max(...graphNodes.map(n => n.y), 0);
    return maxY + NODE_HEIGHT + PADDING * 2;
  }, [graphNodes]);

  return (
    <div className="h-full flex flex-col animate-fade-in bg-white dark:bg-slate-900">
      <style>{`
        @keyframes dash-flow {
          to { stroke-dashoffset: -24; }
        }
        .animate-dash-flow {
          animation: dash-flow 1s linear infinite;
        }
      `}</style>
      
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 z-20 relative shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitGraph size={24} className="text-indigo-600 dark:text-indigo-400" />
            Dependency Map
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Interactive visualization of task relationships.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Done</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Active</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400"></div> Pending</div>
              <div className="flex items-center gap-1.5"><Lock size={10} className="text-red-500" /> Blocked</div>
           </div>
        </div>
      </div>

      <div className={`flex-1 overflow-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 relative cursor-grab active:cursor-grabbing transition-colors duration-500 ${hoveredNodeId ? 'has-hover-active' : ''}`}>
        <div 
            className="relative transition-transform duration-300 ease-out"
            style={{ width: containerWidth, height: containerHeight }}
        >
            {/* --- SVG Layer (Connectors) --- */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>
                </defs>
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
                
                const isDone = node.status === 'Done';
                const isActive = node.status === 'In Progress';
                const isHighlighted = highlightContext.relatedNodes.has(node.id);
                const isDimmed = hoveredNodeId && !isHighlighted;

                // Node Styling Logic
                let borderColor = 'border-slate-200 dark:border-slate-700';
                let bgColor = 'bg-white dark:bg-slate-800';
                let glowClass = '';
                
                if (isBlocked) {
                    borderColor = 'border-red-300 dark:border-red-900/50';
                    bgColor = 'bg-slate-50 dark:bg-slate-900/50';
                    if (isHighlighted) glowClass = 'shadow-[0_0_20px_rgba(248,113,113,0.3)] ring-1 ring-red-400 dark:ring-red-900';
                } else if (isDone) {
                    borderColor = 'border-emerald-500';
                    bgColor = 'bg-emerald-50/30 dark:bg-emerald-900/20';
                    if (isHighlighted) glowClass = 'shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500 dark:ring-emerald-900';
                } else if (isActive) {
                    borderColor = 'border-blue-500';
                    bgColor = 'bg-blue-50/30 dark:bg-blue-900/20';
                    if (isHighlighted) glowClass = 'shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-500 dark:ring-blue-900';
                }

                return (
                    <div
                        key={node.id}
                        onClick={() => onTaskClick(node)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className={`
                            absolute rounded-2xl p-4 flex flex-col justify-between cursor-pointer border-2
                            transition-all duration-300 ease-out
                            ${borderColor} ${bgColor} ${glowClass}
                            ${isDimmed ? 'opacity-40 blur-[1px] grayscale scale-95' : 'opacity-100 scale-100'}
                            ${isHighlighted && hoveredNodeId !== node.id ? 'z-20' : 'z-10'}
                            ${hoveredNodeId === node.id ? 'z-30 scale-105 -translate-y-1 shadow-2xl' : 'shadow-sm'}
                        `}
                        style={{
                            left: node.x,
                            top: node.y,
                            width: NODE_WIDTH,
                            height: NODE_HEIGHT
                        }}
                    >
                        {/* Blocked Overlay Badge */}
                        {isBlocked && (
                            <div className="absolute -top-3 -right-3 z-40 bg-white dark:bg-slate-800 text-red-500 p-1.5 rounded-full shadow-md border border-red-100 dark:border-red-900/50">
                                <Lock size={16} />
                            </div>
                        )}
                        {/* Done Badge */}
                        {!isBlocked && isDone && (
                            <div className="absolute -top-3 -right-3 z-40 bg-white dark:bg-slate-800 text-emerald-500 p-1.5 rounded-full shadow-md border border-emerald-100 dark:border-emerald-900/50">
                                <Check size={16} strokeWidth={3} />
                            </div>
                        )}

                        {/* Card Content */}
                        <div className="flex justify-between items-start gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${isBlocked ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' : isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                        {node.status}
                                    </span>
                                    {node.priority === 'High' && !isDone && (
                                        <AlertCircle size={14} className="text-rose-500 animate-pulse" />
                                    )}
                                </div>
                                <h4 className={`font-bold text-sm line-clamp-2 leading-snug ${isBlocked ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                    {node.title}
                                </h4>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-2">
                                {node.assigneeAvatar ? (
                                    <img src={node.assigneeAvatar} className="w-5 h-5 rounded-full border border-white dark:border-slate-600 shadow-sm" alt="" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                        {node.assignee ? node.assignee.charAt(0) : 'U'}
                                    </div>
                                )}
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{node.assignee}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                <Clock size={10} />
                                <span>{node.dueDate ? new Date(node.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '--'}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default ProjectMapView;
