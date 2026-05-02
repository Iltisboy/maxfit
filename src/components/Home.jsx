import { useState, useEffect } from 'react';
import db from '../db';
import { calcStreak, getCurrentWeekDays } from '../utils/streak';
import { CatSymbol } from '../utils/categories';
import { exportForClaude } from '../utils/export';

export default function Home() {
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const all = await db.entries.toArray();
    setEntries(all);
    const goals = await db.goals.toArray();
    if (goals.length > 0) setGoal(goals[goals.length - 1]);
  }

  const dates = [...new Set(entries.map(e => e.datum))].sort();
  const streak = calcStreak(dates);
  const weekDays = getCurrentWeekDays(entries);
  const trainedThisWeek = weekDays.filter(d => d.trained).length;
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const lastEntries = lastDate ? entries.filter(e => e.datum === lastDate) : [];

  // Countdown
  const daysToGoal = goal ? Math.max(0, Math.ceil((new Date(goal.datum) - new Date()) / 86400000)) : null;

  function handleExport() {
    const text = exportForClaude(entries);
    setExportText(text);
    setShowExport(true);
  }

  function fmt(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }

  return (
    <div className="px-5 pt-4 pb-4 space-y-4">
      {/* Streak */}
      <div className="bg-card rounded-2xl p-6 border border-brd text-center">
        <div className="flex items-baseline justify-center gap-3">
          <span className="text-4xl font-extrabold text-corange">🔥 {streak.current}</span>
          <span className="text-base font-semibold text-dim">Wochen-Streak</span>
        </div>
        <div className="text-xs text-mut mt-2">Längster: {streak.longest} Wochen</div>
      </div>

      {/* Week overview */}
      <div className="bg-card rounded-2xl p-4 border border-brd">
        <div className="text-sm text-dim font-semibold mb-3">Diese Woche: {trainedThisWeek} von 7 Tagen</div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d, i) => (
            <div key={i} className="text-center">
              <div className="text-[11px] text-mut font-bold mb-1">{d.label}</div>
              <div className={`h-12 rounded-lg flex flex-col items-center justify-center ${d.trained ? 'bg-acc-g border border-acc' : 'bg-bg border border-brd'}`}>
                {d.trained ? (
                  <div className="flex gap-0.5">
                    {d.types.slice(0, 2).map((t, j) => <CatSymbol key={j} typ={t} size={10} />)}
                  </div>
                ) : (
                  <span className="text-mut text-sm">·</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal / Countdown */}
      {goal && daysToGoal !== null && (
        <div className="bg-card rounded-2xl p-5 border border-brd text-center">
          <div className="text-sm text-dim font-semibold">{goal.name}</div>
          <div className="text-4xl font-extrabold text-acc mt-1">{daysToGoal}</div>
          <div className="text-sm text-dim">Tage bis {fmt(goal.datum)}</div>
          {goal.details && <div className="text-xs text-mut mt-1">{goal.details}</div>}
        </div>
      )}

      {/* Last session */}
      {lastDate && (
        <div className="bg-card rounded-2xl p-4 border border-brd">
          <div className="text-sm text-dim font-semibold">Letzte Session: {fmt(lastDate)}</div>
          <div className="text-base text-t-primary mt-1">
            {lastEntries.slice(0, 3).map(e => e.uebung).join(', ')}
            {lastEntries.length > 3 && ` +${lastEntries.length - 3}`}
          </div>
        </div>
      )}

      {/* Export for Claude */}
      <button onClick={handleExport}
        className="w-full py-4 bg-gradient-to-r from-acc to-acc-d text-bg font-bold text-base rounded-2xl border-none cursor-pointer">
        🤖 Trainingsplan anfordern
      </button>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowExport(false)}>
          <div className="bg-sf rounded-xl p-5 max-w-md w-full border border-brd max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-t-primary">Trainingslog kopieren</h2>
              <button onClick={() => setShowExport(false)} className="text-dim text-xl bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <p className="text-xs text-dim mb-2">Tippe ins Textfeld, alles auswählen, kopieren, dann im Chat einfügen:</p>
            <textarea readOnly value={exportText} onFocus={e => e.target.select()}
              className="w-full min-h-[200px] bg-bg border border-brd rounded-lg text-t-primary p-3 text-[11px] font-mono resize-y" />
            <button className="w-full mt-2 py-3 bg-acc text-bg font-bold text-sm rounded-xl border-none cursor-pointer"
              onClick={async () => {
                try { await navigator.clipboard.writeText(exportText); setShowExport(false); } catch(e) {}
              }}>
              In Zwischenablage kopieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
