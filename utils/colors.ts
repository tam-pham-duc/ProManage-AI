
export interface PaletteColor {
  id: string;
  bg: string;
  text: string;
  dot: string;
  name?: string;
}

export const TAG_PALETTE: PaletteColor[] = [
  // REDS
  { id: 'red-1', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', dot: 'bg-red-500' },
  { id: 'red-2', bg: 'bg-red-200 dark:bg-red-900/50', text: 'text-red-900 dark:text-red-100', dot: 'bg-red-600' },
  { id: 'red-3', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-300', dot: 'bg-red-400' },
  
  // ORANGES
  { id: 'orange-1', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-200', dot: 'bg-orange-500' },
  { id: 'orange-2', bg: 'bg-orange-200 dark:bg-orange-900/50', text: 'text-orange-900 dark:text-orange-100', dot: 'bg-orange-600' },
  { id: 'orange-3', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-300', dot: 'bg-orange-400' },

  // AMBERS
  { id: 'amber-1', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200', dot: 'bg-amber-500' },
  { id: 'amber-2', bg: 'bg-amber-200 dark:bg-amber-900/50', text: 'text-amber-900 dark:text-amber-100', dot: 'bg-amber-600' },
  { id: 'amber-3', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-300', dot: 'bg-amber-400' },

  // YELLOWS
  { id: 'yellow-1', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-200', dot: 'bg-yellow-500' },
  { id: 'yellow-2', bg: 'bg-yellow-200 dark:bg-yellow-900/50', text: 'text-yellow-900 dark:text-yellow-100', dot: 'bg-yellow-600' },

  // LIMES
  { id: 'lime-1', bg: 'bg-lime-100 dark:bg-lime-900/30', text: 'text-lime-800 dark:text-lime-200', dot: 'bg-lime-500' },
  { id: 'lime-2', bg: 'bg-lime-200 dark:bg-lime-900/50', text: 'text-lime-900 dark:text-lime-100', dot: 'bg-lime-600' },

  // GREENS
  { id: 'green-1', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', dot: 'bg-green-500' },
  { id: 'green-2', bg: 'bg-green-200 dark:bg-green-900/50', text: 'text-green-900 dark:text-green-100', dot: 'bg-green-600' },
  { id: 'green-3', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-300', dot: 'bg-green-400' },

  // EMERALDS
  { id: 'emerald-1', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500' },
  { id: 'emerald-2', bg: 'bg-emerald-200 dark:bg-emerald-900/50', text: 'text-emerald-900 dark:text-emerald-100', dot: 'bg-emerald-600' },
  { id: 'emerald-3', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-300', dot: 'bg-emerald-400' },

  // TEALS
  { id: 'teal-1', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-200', dot: 'bg-teal-500' },
  { id: 'teal-2', bg: 'bg-teal-200 dark:bg-teal-900/50', text: 'text-teal-900 dark:text-teal-100', dot: 'bg-teal-600' },
  { id: 'teal-3', bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-300', dot: 'bg-teal-400' },

  // CYANS
  { id: 'cyan-1', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-200', dot: 'bg-cyan-500' },
  { id: 'cyan-2', bg: 'bg-cyan-200 dark:bg-cyan-900/50', text: 'text-cyan-900 dark:text-cyan-100', dot: 'bg-cyan-600' },

  // SKIES
  { id: 'sky-1', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-800 dark:text-sky-200', dot: 'bg-sky-500' },
  { id: 'sky-2', bg: 'bg-sky-200 dark:bg-sky-900/50', text: 'text-sky-900 dark:text-sky-100', dot: 'bg-sky-600' },

  // BLUES
  { id: 'blue-1', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', dot: 'bg-blue-500' },
  { id: 'blue-2', bg: 'bg-blue-200 dark:bg-blue-900/50', text: 'text-blue-900 dark:text-blue-100', dot: 'bg-blue-600' },
  { id: 'blue-3', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-300', dot: 'bg-blue-400' },

  // INDIGOS
  { id: 'indigo-1', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-200', dot: 'bg-indigo-500' },
  { id: 'indigo-2', bg: 'bg-indigo-200 dark:bg-indigo-900/50', text: 'text-indigo-900 dark:text-indigo-100', dot: 'bg-indigo-600' },
  { id: 'indigo-3', bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-300', dot: 'bg-indigo-400' },

  // VIOLETS
  { id: 'violet-1', bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-200', dot: 'bg-violet-500' },
  { id: 'violet-2', bg: 'bg-violet-200 dark:bg-violet-900/50', text: 'text-violet-900 dark:text-violet-100', dot: 'bg-violet-600' },

  // PURPLES
  { id: 'purple-1', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-200', dot: 'bg-purple-500' },
  { id: 'purple-2', bg: 'bg-purple-200 dark:bg-purple-900/50', text: 'text-purple-900 dark:text-purple-100', dot: 'bg-purple-600' },
  { id: 'purple-3', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-300', dot: 'bg-purple-400' },

  // FUCHSIAS
  { id: 'fuchsia-1', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', text: 'text-fuchsia-800 dark:text-fuchsia-200', dot: 'bg-fuchsia-500' },
  { id: 'fuchsia-2', bg: 'bg-fuchsia-200 dark:bg-fuchsia-900/50', text: 'text-fuchsia-900 dark:text-fuchsia-100', dot: 'bg-fuchsia-600' },

  // PINKS
  { id: 'pink-1', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-200', dot: 'bg-pink-500' },
  { id: 'pink-2', bg: 'bg-pink-200 dark:bg-pink-900/50', text: 'text-pink-900 dark:text-pink-100', dot: 'bg-pink-600' },

  // ROSES
  { id: 'rose-1', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-200', dot: 'bg-rose-500' },
  { id: 'rose-2', bg: 'bg-rose-200 dark:bg-rose-900/50', text: 'text-rose-900 dark:text-rose-100', dot: 'bg-rose-600' },

  // SLATES
  { id: 'slate-1', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-500' },
  { id: 'slate-2', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', dot: 'bg-slate-600' },
  { id: 'slate-3', bg: 'bg-slate-50 dark:bg-slate-900/50', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },

  // GRAYS
  { id: 'gray-1', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-500' },
  { id: 'gray-2', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', dot: 'bg-gray-600' },

  // ZINCS
  { id: 'zinc-1', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-300', dot: 'bg-zinc-500' },
  { id: 'zinc-2', bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-800 dark:text-zinc-200', dot: 'bg-zinc-600' },

  // NEUTRALS
  { id: 'neutral-1', bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-300', dot: 'bg-neutral-500' },
  { id: 'neutral-2', bg: 'bg-neutral-200 dark:bg-neutral-700', text: 'text-neutral-800 dark:text-neutral-200', dot: 'bg-neutral-600' },

  // STONES
  { id: 'stone-1', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-700 dark:text-stone-300', dot: 'bg-stone-500' },
  { id: 'stone-2', bg: 'bg-stone-200 dark:bg-stone-700', text: 'text-stone-800 dark:text-stone-200', dot: 'bg-stone-600' },
];

export const getColorById = (id: string | undefined): PaletteColor => {
  return TAG_PALETTE.find(c => c.id === id) || TAG_PALETTE.find(c => c.id === 'slate-1')!;
};
