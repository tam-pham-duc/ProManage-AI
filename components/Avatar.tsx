
import React, { useState, useEffect } from 'react';
import { getAvatarColor, getAvatarInitials } from '../utils/uiUtils';

interface AvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  onClick?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ src, name = 'User', className = "w-10 h-10", onClick }) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const initials = getAvatarInitials(name);
  const bgColor = getAvatarColor(name);

  // Determine dimensions for font scaling based on class string (simple heuristic)
  const isSmall = className.includes('w-6') || className.includes('w-5') || className.includes('w-4');
  const fontSize = isSmall ? 'text-[9px] leading-none' : 'text-sm';

  if (src && !imgError) {
    return (
      <img 
        src={src} 
        alt={name} 
        className={`${className} rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
        onError={() => setImgError(true)}
        onClick={onClick}
      />
    );
  }

  return (
    <div 
      className={`${className} rounded-full flex items-center justify-center text-white font-bold shadow-sm ${bgColor} ${fontSize} border border-white/10 ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
      title={name}
      onClick={onClick}
    >
      {initials}
    </div>
  );
};

export default Avatar;
