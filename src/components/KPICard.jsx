import React from 'react';

const COLOR_MAP = {
  blue:    'bg-blue-500/10 border-blue-500/30 text-blue-400',
  indigo:  'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  green:   'bg-green-500/10 border-green-500/30 text-green-400',
  orange:  'bg-orange-500/10 border-orange-500/30 text-orange-400',
  yellow:  'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  purple:  'bg-purple-500/10 border-purple-500/30 text-purple-400',
  teal:    'bg-teal-500/10 border-teal-500/30 text-teal-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  red:     'bg-red-500/10 border-red-500/30 text-red-400',
};

export default function KPICard({ label, value, icon, color = 'blue', sub }) {
  const cls = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`rounded-xl border p-4 ${cls} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
