import { useState, useEffect, useRef } from 'react';
import db from '../db';
import { EXERCISE_LIB } from '../exercise-library';
import {
  exportFullBackup,
  importFullBackup,
  applyBackup,
  exportFullCSV,
  parseFullCSV,
} from '../utils/export';
import { localDate, parseLocalDate } from '../utils/streak';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function fmt(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }
function pw(w) { if (!w || w === '-' || w === '–') return null; const m = String(w).replace(',', '.').match(/([\d.]+)\s*kg/); return m ? parseFloat(m[1]) : null; }
function tsOf(dateStr) { return parseLocalDate(dateStr).getTime(); }
function tsTickFmt(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
}
function tsTooltipFmt(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// Common XAxis props for time-based chart axis (handles uneven date gaps correctly)
const TIME_AXIS_PROPS = {
  dataKey: 'ts',
  type: 'number',
  scale: 'time',
  domain: ['dataMin', 'dataMax'],
  tickFormatter: tsTickFmt,
  tick: { fill: '#7b7f9e', fontSize: 10 },
};

const TOOLTIP_STYLE = {
  background: '#181a28',
  border: '1px solid #252840',
  borderRadius: 8,
  color: '#e4e6f0',
  fontSize: 12,
};

export default function More() {
  const [view, setView] = useState('menu');
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState({ name: '', datum: '', details: '' });
  const [goals, setGoals] = useState([]);
  const [libCat, setLibCat] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [bwForm, setBwForm] = useState({ datum: localDate(), gewicht: '' });
  const [bwData, setBwData] = useState([]);
  const [selExercise, setSelExercise] = useState(null);
  const fileRef = useRef();
  const csvRef = useRef();

  useEffect(() => { loadData(); }, []);
  async function loadData() {
    setEntries(await db.entries.toArray());
    setGoals(await db.goals.toArray());
    setBwData(await db.bodyweight.toArray());
  }

  const msg = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // --- Bests
  const bests = {};
  entries.forEach(e => {
    const w = pw(e.gewicht);
    if (w === null) return;
    if (!bests[e.uebung] || w > bests[e.uebung].w) bests[e.uebung] = { w, d: e.datum, disp: e.gewicht };
  });

  // --- Exercise weight history (with timestamp for time-axis)
  function getExData(name) {
    return entries
      .filter(e => e.uebung === name)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map(e => ({
        ts: tsOf(e.datum),
        datum: fmt(e.datum),
        gewicht: pw(e.gewicht),
        wdh: e.wdh,
        saetze: e.saetze,
        bem: e.bem,
      }))
      .filter(e => e.gewicht !== null);
  }

  // --- Body weight chart data (with timestamp)
  function getBodyWeightChart() {
    return [...bwData]
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map(b => ({ ts: tsOf(b.datum), datum: fmt(b.datum), kg: b.gewicht }));
  }

  const searchResults = searchQ.length > 1 ? entries.filter(e =>
    e.uebung.toLowerCase().includes(searchQ.toLowerCase())
  ).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 30) : [];

  const exerciseNames = [...new Set(entries.filter(e => pw(e.gewicht) !== null).map(e => e.uebung))].sort();

  // --- JSON backup handlers
  async function handleImportJSON(file) {
    try {
      const data = await importFullBackup(file);
      const counts = await applyBackup(data);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      msg(`${total} Eintraege importiert`);
      loadData();
    } catch (e) {
      console.error(e);
      msg('Import fehlgeschlagen');
    }
  }

  async function handleExportJSON() {
    await exportFullBackup();
    msg('JSON-Backup exportiert (alle Daten)');
  }

  // --- CSV backup handlers
  async function handleExportCSV() {
    await exportFullCSV();
    msg('CSV-Backup exportiert (alle Daten)');
  }

  async function handleImportCSV(file) {
    try {
      const data = await parseFullCSV(file);
      const counts = await applyBackup(data);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      msg(`${total} Eintraege aus CSV importiert`);
      loadData();
    } catch (e) {
      console.error(e);
      msg('CSV-Import fehlgeschlagen');
    }
  }

  async function saveGoal() {
    if (!goal.name || !goal.datum) return;
    await db.goals.add({ ...goal });
    msg('Ziel gespeichert');
    setGoal({ name: '', datum: '', details: '' });
    loadData();
  }
  async function deleteGoal(id) { await db.goals.delete(id); loadData(); }

  async function saveBW() {
    if (!bwForm.gewicht) return;
    await db.bodyweight.add({ datum: bwForm.datum, gewicht: parseFloat(String(bwForm.gewicht).replace(',', '.')) });
    msg('Gewicht gespeichert');
    setBwForm({ ...bwForm, gewicht: '' });
    loadData();
  }
  async function deleteBW(id) { await db.bodyweight.delete(id); loadData(); }

  // --- Menu
  if (view === 'menu') {
    return (
      <div className="px-5 pt-4 pb-4 space-y-2">
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}
        {[
          ['📚', 'Übungsbibliothek', 'lib'],
          ['📊', 'Statistik & Graphen', 'stats'],
          ['🔍', 'Übung suchen', 'search'],
          ['⚖️', 'Körpergewicht', 'weight'],
          ['🎯', 'Ziele verwalten', 'goals'],
          ['💾', 'Backup & Daten', 'backup'],
          ['❓', 'Hilfe', 'help'],
        ].map(([icon, label, v]) => (
          <button key={v} onClick={() => setView(v)} className="w-full bg-card border border-brd rounded-2xl p-5 text-left cursor-pointer flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <span className="text-base font-semibold text-t-primary">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  const BackBtn = () => (
    <button onClick={() => { setView('menu'); setSelExercise(null); }} className="text-acc text-sm font-semibold bg-transparent border-none cursor-pointer mb-4 block">← Zurück</button>
  );

  // --- Library
  if (view === 'lib') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-3">📚 Übungsbibliothek</h2>
        {Object.entries(EXERCISE_LIB).map(([cat, exs]) => (
          <div key={cat} className="mb-2">
            <button onClick={() => setLibCat(libCat === cat ? null : cat)}
              className="w-full bg-card border border-brd rounded-2xl p-4 text-left cursor-pointer">
              <div className="flex justify-between items-center">
                <span className="font-bold text-base">{cat}</span>
                <span className="text-sm text-dim">{exs.length} {libCat === cat ? '▲' : '▼'}</span>
              </div>
            </button>
            {libCat === cat && exs.map((ex, i) => (
              <div key={i} className="bg-card border border-brd rounded-xl p-3 mt-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-base">{ex.n}</span>
                  {ex.e && <span className="text-xs text-gold border border-gold px-1.5 rounded">Einseitig</span>}
                </div>
                <p className="text-xs text-cblue mt-1 leading-relaxed">{ex.d}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // --- Stats with time-based axis charts
  if (view === 'stats') {
    const exData = selExercise ? getExData(selExercise) : [];
    const bwChart = getBodyWeightChart();

    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}

        {/* Weight Progression */}
        <h2 className="text-xl font-bold mb-3">📈 Gewichtsprogression</h2>
        <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
          <select value={selExercise || ''} onChange={e => setSelExercise(e.target.value || null)}
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none mb-3">
            <option value="">Übung auswählen…</option>
            {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {exData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={exData}>
                <XAxis {...TIME_AXIS_PROPS} />
                <YAxis tick={{ fill: '#7b7f9e', fontSize: 10 }} unit=" kg" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={tsTooltipFmt}
                  formatter={(value) => [`${value} kg`, 'Gewicht']}
                />
                <Line type="monotone" dataKey="gewicht" stroke="#00d4aa" strokeWidth={2} dot={{ fill: '#00d4aa', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-dim text-center py-4">{selExercise ? 'Mindestens 2 Einträge nötig' : 'Wähle eine Übung'}</p>
          )}
        </div>

        {/* Bodyweight chart in stats overview */}
        {bwChart.length >= 1 && (
          <>
            <h2 className="text-xl font-bold mb-3">⚖️ Körpergewicht</h2>
            <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
              {bwChart.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bwChart}>
                    <XAxis {...TIME_AXIS_PROPS} />
                    <YAxis tick={{ fill: '#7b7f9e', fontSize: 10 }} unit=" kg" domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={tsTooltipFmt}
                      formatter={(value) => [`${value} kg`, 'Gewicht']}
                    />
                    <Line type="monotone" dataKey="kg" stroke="#a3e635" strokeWidth={2} dot={{ fill: '#a3e635', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-dim text-center py-4">
                  Aktuell: <span className="text-acc font-bold">{bwChart[0].kg} kg</span> – mindestens 2 Einträge für Graph
                </p>
              )}
            </div>
          </>
        )}

        {/* PRs */}
        <h2 className="text-xl font-bold mb-3">🏆 Bestleistungen</h2>
        {Object.entries(bests).sort((a, b) => a[0].localeCompare(b[0])).map(([name, b]) => (
          <div key={name} className="bg-card border border-gold/20 rounded-2xl p-4 mb-2">
            <span className="font-bold text-base">{name}</span>
            <div className="flex justify-between mt-1">
              <span className="text-lg font-extrabold text-gold">{b.disp}</span>
              <span className="text-sm text-dim">{fmt(b.d)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Exercise search
  if (view === 'search') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-3">🔍 Übung suchen</h2>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="z.B. Latzug, Beinpresse…"
          className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none mb-4" autoFocus />
        {searchResults.map(e => (
          <div key={e.id} className="bg-card border border-brd rounded-xl p-3 mb-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">{e.uebung}</span>
              <span className="text-xs text-dim">{fmt(e.datum)}</span>
            </div>
            <div className="text-sm text-acc mt-0.5">
              {e.saetze}x{e.wdh} {e.gewicht && e.gewicht !== '-' ? `· ${e.gewicht}` : ''}
            </div>
            {e.bem && <div className="text-xs text-dim mt-0.5">{e.bem}</div>}
          </div>
        ))}
        {searchQ.length > 1 && searchResults.length === 0 && <p className="text-dim text-center py-4">Keine Treffer</p>}
      </div>
    );
  }

  // --- Body weight tracker (with time-based chart)
  if (view === 'weight') {
    const bwChart = getBodyWeightChart();
    const bwSorted = [...bwData].sort((a, b) => a.datum.localeCompare(b.datum));

    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}
        <h2 className="text-xl font-bold mb-3">⚖️ Körpergewicht</h2>

        <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
          <div className="flex gap-2 mb-3">
            <input type="date" value={bwForm.datum} onChange={e => setBwForm({ ...bwForm, datum: e.target.value })}
              className="flex-1 p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
            <input value={bwForm.gewicht} onChange={e => setBwForm({ ...bwForm, gewicht: e.target.value })} placeholder="kg"
              className="w-24 p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" type="number" step="0.1" />
          </div>
          <button onClick={saveBW} className="w-full py-3 bg-acc text-bg font-bold text-sm rounded-xl border-none cursor-pointer">Speichern</button>
        </div>

        {bwChart.length > 1 && (
          <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={bwChart}>
                <XAxis {...TIME_AXIS_PROPS} />
                <YAxis tick={{ fill: '#7b7f9e', fontSize: 10 }} unit=" kg" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={tsTooltipFmt}
                  formatter={(value) => [`${value} kg`, 'Gewicht']}
                />
                <Line type="monotone" dataKey="kg" stroke="#a3e635" strokeWidth={2} dot={{ fill: '#a3e635', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {[...bwSorted].reverse().map(b => (
          <div key={b.id} className="bg-card border border-brd rounded-xl p-3 mb-1.5 flex justify-between items-center">
            <div>
              <span className="font-bold text-base">{b.gewicht} kg</span>
              <span className="text-sm text-dim ml-2">{fmt(b.datum)}</span>
            </div>
            <button onClick={() => deleteBW(b.id)} className="text-cred bg-transparent border-none cursor-pointer">🗑</button>
          </div>
        ))}
        {bwData.length === 0 && <p className="text-dim text-center py-4">Noch keine Einträge</p>}
      </div>
    );
  }

  // --- Goals
  if (view === 'goals') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}
        <h2 className="text-xl font-bold mb-3">🎯 Ziele</h2>
        {goals.map(g => (
          <div key={g.id} className="bg-card border border-brd rounded-2xl p-4 mb-2 flex justify-between items-center">
            <div>
              <span className="font-bold text-base">{g.name}</span>
              <span className="block text-sm text-dim">{fmt(g.datum)}</span>
              {g.details && <span className="block text-xs text-mut">{g.details}</span>}
            </div>
            <button onClick={() => deleteGoal(g.id)} className="text-cred bg-transparent border-none cursor-pointer text-base">🗑</button>
          </div>
        ))}
        <div className="bg-card border border-brd rounded-2xl p-4 mt-3 space-y-3">
          <h3 className="text-base font-bold">Neues Ziel</h3>
          <input value={goal.name} onChange={e => setGoal({ ...goal, name: e.target.value })} placeholder="z.B. Triathlon Köln"
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
          <input type="date" value={goal.datum} onChange={e => setGoal({ ...goal, datum: e.target.value })}
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
          <input value={goal.details} onChange={e => setGoal({ ...goal, details: e.target.value })} placeholder="1,25km Swim, 40km Bike, 12km Run"
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
          <button onClick={saveGoal} className="w-full py-3 bg-acc text-bg font-bold text-sm rounded-xl border-none cursor-pointer">Speichern</button>
        </div>
      </div>
    );
  }

  // --- Backup & data
  if (view === 'backup') {
    return (
      <div className="px-5 pt-4 pb-4 space-y-2">
        <BackBtn />
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}
        <h2 className="text-xl font-bold mb-3">💾 Backup & Daten</h2>

        <div className="bg-card border border-brd rounded-2xl p-4 mb-2">
          <h3 className="text-base font-bold mb-2">Vollständiges Backup</h3>
          <p className="text-xs text-dim mb-3">
            Beinhaltet Trainings, Körpergewicht, Session-Notizen, Ziele und Prävention-Logs.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={handleExportJSON} className="py-3 bg-acc text-bg font-bold text-sm rounded-xl border-none cursor-pointer">📤 JSON Export</button>
            <button onClick={() => fileRef.current?.click()} className="py-3 bg-card border border-acc text-acc font-bold text-sm rounded-xl cursor-pointer">📥 JSON Import</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleExportCSV} className="py-3 bg-corange text-bg font-bold text-sm rounded-xl border-none cursor-pointer">📑 CSV Export</button>
            <button onClick={() => csvRef.current?.click()} className="py-3 bg-card border border-corange text-corange font-bold text-sm rounded-xl cursor-pointer">📥 CSV Import</button>
          </div>
        </div>

        <p className="text-xs text-mut text-center px-2">
          Tipp: JSON ist robust und vollständig. CSV ist für Excel/Inspektion und enthält alle Sektionen.
          Importe werden zu vorhandenen Daten hinzugefügt (keine Duplikat-Erkennung – vorher ggf. Browserdaten löschen).
        </p>

        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={e => { if (e.target.files[0]) handleImportJSON(e.target.files[0]); e.target.value = ''; }} />
        <input ref={csvRef} type="file" accept=".csv" className="hidden"
          onChange={e => { if (e.target.files[0]) handleImportCSV(e.target.files[0]); e.target.value = ''; }} />
      </div>
    );
  }

  // --- Help
  if (view === 'help') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-4">So funktioniert MaxFit</h2>
        <div className="space-y-4">
          {[
            ['🏠', 'Home', 'Wochen-Streak, Trainingswochen-Übersicht, Ziel-Countdown, Trainingsplan anfordern, Workout starten.'],
            ['➕', 'Training', 'Wähle den Typ – das Formular passt sich automatisch an.'],
            ['🔥', 'Workout-Modus', 'Importiere einen Plan von Claude. Jede Übung ist einzeln editierbar; Haken kannst du jederzeit setzen oder entfernen. Workout früher beenden möglich.'],
            ['📋', 'Verlauf', 'Alle Sessions. Tippe für Details. "Als Vorlage nutzen" kopiert ein Training auf heute.'],
            ['📅', 'Kalender', 'Monatsansicht mit Symbolen.'],
            ['📊', 'Statistik', 'Gewichts-, Cardio- und Körpergewichts-Graph mit echter Zeit-Achse.'],
            ['🔍', 'Übung suchen', 'Wann und mit welchem Gewicht hast du eine Übung zuletzt gemacht?'],
            ['⚖️', 'Körpergewicht', 'Tracking + Verlauf als Graph.'],
            ['💾', 'Backup', 'Voll-Export/Import als JSON oder CSV (alle Daten).'],
          ].map(([icon, title, desc], i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div>
                <span className="font-bold text-base block">{title}</span>
                <span className="text-sm text-dim">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
