
import React, { useMemo } from 'react';
import { Tab } from '../types';

interface BackgroundLayerProps {
  activeTab: Tab;
  isDarkMode: boolean;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ activeTab, isDarkMode }) => {
  
  const pattern = useMemo(() => {
    // Slate-500 for Light Mode, Slate-400 for Dark Mode (used in stroke/fill)
    const color = isDarkMode ? '#94a3b8' : '#64748b'; 
    
    const encodeSVG = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    // Dashboard: Tech Dots (Data/Technology)
    const dots = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="2" cy="2" r="1.5" fill="${color}" />
    </svg>`;

    // Kanban: Flow/Waves (Agile Flow)
    const waves = `<svg width="40" height="20" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 10 Q 10 0 20 10 T 40 10" fill="none" stroke="${color}" stroke-width="2" opacity="0.8" />
    </svg>`;

    // Timeline: Topography (Roadmap/Terrain)
    const topo = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 25 Q 25 50 50 25 T 100 25 M0 50 Q 25 75 50 50 T 100 50 M0 75 Q 25 100 50 75 T 100 75" fill="none" stroke="${color}" stroke-width="1" />
    </svg>`;

    // Calendar: Interlocking Circles (Cycles/Time)
    const circles = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="16" fill="none" stroke="${color}" stroke-width="1.5" />
        <path d="M0 20 H40 M20 0 V40" stroke="${color}" stroke-width="0.5" opacity="0.5" />
    </svg>`;

    // Project Hub: Blueprint Grid (Construction)
    const blueprint = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0 L40 0 L40 40 L0 40 Z" fill="none" stroke="${color}" stroke-width="1" />
        <path d="M0 20 L40 20 M20 0 L20 40" stroke="${color}" stroke-width="0.5" opacity="0.5" />
        <rect x="18" y="18" width="4" height="4" fill="${color}" opacity="0.5" />
    </svg>`;

    // Settings/Others: Geometric Hexagons
    const hex = `<svg width="24" height="28" viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0 L24 7 L24 21 L12 28 L0 21 L0 7 Z" fill="none" stroke="${color}" stroke-width="1" />
    </svg>`;

    switch (activeTab) {
        case 'dashboard': return `url("${encodeSVG(dots)}")`;
        case 'kanban': return `url("${encodeSVG(waves)}")`;
        case 'timeline': return `url("${encodeSVG(topo)}")`;
        case 'calendar': return `url("${encodeSVG(circles)}")`;
        case 'projects': return `url("${encodeSVG(blueprint)}")`;
        case 'image-gen': return `url("${encodeSVG(hex)}")`;
        default: return `url("${encodeSVG(hex)}")`;
    }
  }, [activeTab, isDarkMode]);

  return (
    <div 
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-1000 ease-in-out"
        style={{
            backgroundImage: pattern,
            opacity: isDarkMode ? 0.03 : 0.04, // Very subtle watermark
            backgroundRepeat: 'repeat',
            backgroundPosition: 'top left',
            // Fade out at the bottom to blend nicely
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)'
        }}
    />
  );
};

export default BackgroundLayer;
