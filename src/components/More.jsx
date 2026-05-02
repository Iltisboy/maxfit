import { useState, useEffect, useRef } from 'react';
import db from '../db';
import { EXERCISE_LIB } from '../exercise-library';
import { exportJSON, importJSON } from '../utils/export';
import { CatSymbol, CATEGORIES } from '../utils/categories';

function fmt(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }
function parseWeight(w) { if (!w || w === '-' || w === '–') return null; const m = w.replace(',', '.').match(/([\d.]+)\s*kg/); return m ? parseFloat(m[1]) : null; }

export default function More() {
  const [view, setView] = useState('menu');
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState({ name: '', datum: '', details: '' });
  const [goals, setGoals] = useState([]);
  const [libCat, setLibCat] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

  useEffect(() => { loadData(); }, []);
  async function loadData() {
    setEntries(await db.entries.toArray());
    setGoals(await db.goals.toArray());
  }

  const msg = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // Stats
  const bests = {};
  entries.forEach(e => {
    const w = parseWeight(e.gewicht);
    if (w === null) return;
    if (!bests[e.uebung] || w > bests[e.uebung].w) bests[e.uebung] = { w, d: e.datum, disp: e.gewicht };
  });

  const exerciseHistory = () => {
    const exs = [...new Set(entries.filter(e => !['Cardio', 'Prävention', 'Dehnung', 'Core', 'Praevention'].includes(e.geraet)).map(e => e.uebung))].sort();
    return exs.map(ex => {
      const ee = entries.filter(e => e.uebung === ex).sort((a, b) => a.datum.localeCompare(b.datum));
      const ws = ee.map(e => e.gewicht).filter(w => w && w !== '-' && w !== '–' && /\d/.test(w));
      return { name: ex, count: ee.length, first: ws[0], last: ws[ws.length - 1] };
    });
  };

  async function handleImport(file) {
    try {
      const data = await importJSON(file);
      await db.entries.bulkAdd(data);
      msg(data.length + ' Einträge importiert');
      loadData();
    } catch (e) { msg('Import fehlgeschlagen'); }
  }

  async function handleExportJSON() {
    const all = await db.entries.toArray();
    exportJSON(all);
    msg('JSON exportiert');
  }

  async function saveGoal() {
    if (!goal.name || !goal.datum) return;
    await db.goals.add({ ...goal });
    msg('Ziel gespeichert');
    setGoal({ name: '', datum: '', details: '' });
    loadData();
  }

  async function deleteGoal(id) {
    await db.goals.delete(id);
    loadData();
  }

  // Menu
  if (view === 'menu') {
    return (
      <div className="px-5 pt-4 pb-4 space-y-2">
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}
        {[
          ['📚', 'Übungsbibliothek', 'lib'],
          ['📊', 'Statistik & PRs', 'stats'],
          ['🎯', 'Ziele verwalten', 'goals'],
          ['📥', 'Daten importieren', 'import'],
          ['📤', 'Daten exportieren (JSON)', 'export'],
          ['❓', 'Hilfe', 'help'],
        ].map(([icon, label, v]) => (
          <button key={v} onClick={() => {
            if (v === 'export') { handleExportJSON(); return; }
            if (v === 'import') { fileRef.current?.click(); return; }
            setView(v);
          }} className="w-full bg-card border border-brd rounded-2xl p-5 text-left cursor-pointer flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <span className="text-base font-semibold text-t-primary">{label}</span>
          </button>
        ))}
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); }} />
      </div>
    );
  }

  const BackBtn = () => (
    <button onClick={() => setView('menu')} className="text-acc text-sm font-semibold bg-transparent border-none cursor-pointer mb-3 block">← Zurück</button>
  );

  // Library
  if (view === 'lib') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-lg font-bold mb-3">📚 Übungsbibliothek</h2>
        <p className="text-xs text-dim mb-3">Alle Übungen mit Ausführungstipps. Tippe auf eine Kategorie.</p>
        {Object.entries(EXERCISE_LIB).map(([cat, exs]) => (
          <div key={cat} className="mb-2">
            <button onClick={() => setLibCat(libCat === cat ? null : cat)}
              className="w-full bg-card border border-brd rounded-xl p-3 text-left cursor-pointer">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">{cat}</span>
                <span className="text-xs text-dim">{exs.length} Übungen {libCat === cat ? '▲' : '▼'}</span>
              </div>
            </button>
            {libCat === cat && exs.map((ex, i) => (
              <div key={i} className="bg-card border border-brd rounded-lg p-2.5 mt-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">{ex.n}</span>
                  {ex.e && <span className="text-[10px] text-gold border border-gold px-1 rounded">Einseitig</span>}
                </div>
                <p className="text-[11px] text-cblue mt-1 leading-relaxed">{ex.d}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Stats
  if (view === 'stats') {
    const history = exerciseHistory();
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-lg font-bold mb-3">🏆 Bestleistungen</h2>
        {Object.entries(bests).sort((a, b) => a[0].localeCompare(b[0])).map(([name, b]) => (
          <div key={name} className="bg-card border border-gold/20 rounded-xl p-3 mb-1.5">
            <span className="font-bold text-sm">{name}</span>
            <div className="flex justify-between mt-1">
              <span className="text-base font-extrabold text-gold">{b.disp}</span>
              <span className="text-xs text-dim">{fmt(b.d)}</span>
            </div>
          </div>
        ))}
        <h2 className="text-lg font-bold mt-5 mb-3">Übungshistorie</h2>
        {history.map(h => (
          <div key={h.name} className="bg-card border border-brd rounded-xl p-3 mb-1.5">
            <span className="font-bold text-sm">{h.name}</span>
            <span className="block text-[11px] text-dim">{h.count}x trainiert</span>
            {h.first && h.last && h.first !== h.last && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-mut">{h.first}</span>
                <span className="text-acc">→</span>
                <span className="text-sm font-bold text-acc">{h.last}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Goals
  if (view === 'goals') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-lg font-bold mb-3">🎯 Ziele</h2>
        {goals.map(g => (
          <div key={g.id} className="bg-card border border-brd rounded-xl p-3 mb-2 flex justify-between items-center">
            <div>
              <span className="font-bold text-sm">{g.name}</span>
              <span className="block text-xs text-dim">{fmt(g.datum)}</span>
              {g.details && <span className="block text-[10px] text-mut">{g.details}</span>}
            </div>
            <button onClick={() => deleteGoal(g.id)} className="text-cred bg-transparent border-none cursor-pointer text-sm">🗑</button>
          </div>
        ))}
        <div className="bg-card border border-brd rounded-xl p-3 mt-3 space-y-2">
          <h3 className="text-sm font-bold">Neues Ziel</h3>
          <input value={goal.name} onChange={e => setGoal({ ...goal, name: e.target.value })} placeholder="z.B. Triathlon Köln"
            className="w-full p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none" />
          <input type="date" value={goal.datum} onChange={e => setGoal({ ...goal, datum: e.target.value })}
            className="w-full p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none" />
          <input value={goal.details} onChange={e => setGoal({ ...goal, details: e.target.value })} placeholder="1,25km Swim, 40km Bike, 12km Run"
            className="w-full p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none" />
          <button onClick={saveGoal} className="w-full py-2.5 bg-acc text-bg font-bold text-sm rounded-lg border-none cursor-pointer">Speichern</button>
        </div>
      </div>
    );
  }

  // Help
  if (view === 'help') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-lg font-bold mb-3">So funktioniert MaxFit</h2>
        <div className="space-y-3">
          {[
            ['🏠', 'Home', 'Wochen-Streak, Trainingsübersicht der Woche, Countdown zum nächsten Ziel, Trainingsplan für Claude anfordern.'],
            ['➕', 'Training', 'Wähle den Typ (Kraft, Cardio, Outdoor, Schwimmen, Prävention) – das Formular passt sich automatisch an.'],
            ['📋', 'Verlauf', 'Alle Sessions. Tippe für Details. "Als Vorlage nutzen" kopiert ein vergangenes Training auf heute.'],
            ['📅', 'Kalender', 'Monatsansicht mit farbigen Symbolen. ■ = Kraft, ♥ = Cardio, 💧 = Schwimmen, ✚ = Prävention.'],
            ['📚', 'Bibliothek', 'Alle Übungen mit Ausführungsbeschreibung und Hinweisen.'],
            ['📊', 'Statistik', 'Persönliche Bestleistungen und Gewichtsentwicklung pro Übung.'],
            ['🎯', 'Ziele', 'Eigene Ziele mit Countdown setzen. Nach dem Triathlon einfach neues Ziel eintragen.'],
            ['📤📥', 'Export/Import', 'Daten als JSON sichern und wiederherstellen. Trainingslog für Claude exportieren.'],
            ['🏋️', 'Ausführungstipps', 'Das Hantel-Symbol zeigt dir die korrekte Ausführung jeder Übung.'],
          ].map(([icon, title, desc], i) => (
            <div key={i} className="flex gap-3">
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div>
                <span className="font-bold text-sm block">{title}</span>
                <span className="text-xs text-dim">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
