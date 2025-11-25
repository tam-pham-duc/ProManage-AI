
export const getAvatarInitials = (name: string | null | undefined): string => {
  if (!name || name === 'Unassigned' || name === 'UN') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const getAvatarColor = (name: string | null | undefined): string => {
  if (!name || name === 'Unassigned' || name === 'UN') return 'bg-slate-500 text-white';
  const colors = [
    'bg-red-500 text-white', 'bg-orange-500 text-white', 'bg-amber-500 text-white', 
    'bg-emerald-500 text-white', 'bg-teal-500 text-white', 'bg-cyan-500 text-white', 
    'bg-blue-500 text-white', 'bg-indigo-500 text-white', 'bg-violet-500 text-white', 
    'bg-purple-500 text-white', 'bg-fuchsia-500 text-white', 'bg-pink-500 text-white', 
    'bg-rose-500 text-white'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
