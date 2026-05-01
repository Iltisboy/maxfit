const tabs = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'training', icon: '➕', label: 'Training' },
  { id: 'history', icon: '📋', label: 'Verlauf' },
  { id: 'calendar', icon: '📅', label: 'Kalender' },
  { id: 'more', icon: '☰', label: 'Mehr' },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg border-t border-brd flex z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex-1 flex flex-col items-center py-2 border-none cursor-pointer ${active === t.id ? 'bg-acc-g' : 'bg-transparent'}`}>
          <span className="text-base">{t.icon}</span>
          <span className={`text-[9px] font-semibold ${active === t.id ? 'text-acc' : 'text-dim'}`}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
