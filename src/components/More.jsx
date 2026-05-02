import { useState, useEffect, useRef } from 'react';
import db from '../db';
import { EXERCISE_LIB } from '../exercise-library';
import { exportJSON, importJSON } from '../utils/export';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function fmt(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }
function pw(w) { if (!w || w === '-' || w === '–') return null; const m = w.replace(',', '.').match(/([\d.]+)\s*kg/); return m ? parseFloat(m[1]) : null; }

export default function More() {
  const [view, setView] = useState('menu');
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState({ name: '', datum: '', details: '' });
  const [goals, setGoals] = useState([]);
  const [libCat, setLibCat] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [bwForm, setBwForm] = useState({ datum: new Date().toISOString().slice(0, 10), gewicht: '' });
  const [bwData, setBwData] = useState([]);
  const [selExercise, setSelExercise] = useState(null);
  const fileRef = useRef();

  useEffect(() => { loadData(); }, []);
  async function loadData() {
    setEntries(await db.entries.toArray());
    setGoals(await db.goals.toArray());
    setBwData(await db.bodyweight.toArray());
  }

  const msg = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // Bests
  const bests = {};
  entries.forEach(e => {
    const w = pw(e.gewicht);
    if (w === null) return;
    if (!bests[e.uebung] || w > bests[e.uebung].w) bests[e.uebung] = { w, d: e.datum, disp: e.gewicht };
  });

  // Exercise history for graphs
  function getExData(name) {
    return entries.filter(e => e.uebung === name).sort((a, b) => a.datum.localeCompare(b.datum)).map(e => ({
      datum: fmt(e.datum), gewicht: pw(e.gewicht), wdh: e.wdh, saetze: e.saetze, bem: e.bem,
    })).filter(e => e.gewicht !== null);
  }

  // Cardio data for graph
  function getCardioData() {
    return entries.filter(e => e.typ === 'outdoor' || (e.geraet === 'Outdoor')).sort((a, b) => a.datum.localeCompare(b.datum)).map(e => ({
      datum: fmt(e.datum), uebung: e.uebung, hf: e.hf || null, pace: e.pace || e.gewicht || '',
    })).filter(e => e.hf);
  }

  // Search results
  const searchResults = searchQ.length > 1 ? entries.filter(e =>
    e.uebung.toLowerCase().includes(searchQ.toLowerCase())
  ).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 30) : [];

  // All unique exercise names for graph selector
  const exerciseNames = [...new Set(entries.filter(e => pw(e.gewicht) !== null).map(e => e.uebung))].sort();

  async function handleImport(file) {
    try {
      const data = await importJSON(file);
      await db.entries.bulkAdd(data);
      msg(data.length + ' Eintraege importiert');
      loadData();
    } catch (e) { msg('Import fehlgeschlagen'); }
  }

  async function handleExportJSON() {
    const all = await db.entries.toArray();
    exportJSON(all);
    msg('JSON exportiert');
  }

  async function handleExportExcel() {
    const all = await db.entries.toArray();
    const sorted = [...all].sort((a, b) => a.datum.localeCompare(b.datum));
    let csv = 'Datum;Uebung;Geraet;Einseitig;Saetze;Wdh/Zeit;Gewicht/Stufe;Bemerkungen\n';
    sorted.forEach(e => {
      csv += `${e.datum};${e.uebung};${e.geraet || ''};${e.einseitig ? 'Ja' : 'Nein'};${e.saetze || ''};${e.wdh || ''};${e.gewicht || ''};${e.bem || ''}\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maxfit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    msg('CSV exportiert (oeffne in Excel)');
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
    await db.bodyweight.add({ datum: bwForm.datum, gewicht: parseFloat(bwForm.gewicht.replace(',', '.')) });
    msg('Gewicht gespeichert');
    setBwForm({ ...bwForm, gewicht: '' });
    loadData();
  }

  async function deleteBW(id) { await db.bodyweight.delete(id); loadData(); }

  const chartTheme = { stroke: '#00d4aa', fill: '#00d4aa' };

  // Menu
  if (view === 'menu') {
    return (
      <div className="px-5 pt-4 pb-4 space-y-2">
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}
        {[
          ['📚', 'Uebungsbibliothek', 'lib'],
          ['📊', 'Statistik & Graphen', 'stats'],
          ['🔍', 'Uebung suchen', 'search'],
          ['⚖️', 'Koerpergewicht', 'weight'],
          ['🎯', 'Ziele verwalten', 'goals'],
          ['📥', 'Daten importieren (JSON)', 'import'],
          ['📤', 'Daten exportieren (JSON)', 'exportjson'],
          ['📑', 'Excel/CSV Export', 'exportcsv'],
          ['❓', 'Hilfe', 'help'],
        ].map(([icon, label, v]) => (
          <button key={v} onClick={() => {
            if (v === 'exportjson') { handleExportJSON(); return; }
            if (v === 'exportcsv') { handleExportExcel(); return; }
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
    <button onClick={() => { setView('menu'); setSelExercise(null); }} className="text-acc text-sm font-semibold bg-transparent border-none cursor-pointer mb-4 block">← Zurueck</button>
  );

  // Library
  if (view === 'lib') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-3">📚 Uebungsbibliothek</h2>
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

  // Stats with graphs
  if (view === 'stats') {
    const exData = selExercise ? getExData(selExercise) : [];
    const cardioData = getCardioData();

    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}

        {/* Weight Progression Graph */}
        <h2 className="text-xl font-bold mb-3">📈 Gewichtsprogression</h2>
        <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
          <select value={selExercise || ''} onChange={e => setSelExercise(e.target.value || null)}
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none mb-3">
            <option value="">Uebung auswaehlen...</option>
            {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {exData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={exData}>
                <XAxis dataKey="datum" tick={{ fill: '#7b7f9e', fontSize: 10 }} />
                <YAxis tick={{ fill: '#7b7f9e', fontSize: 10 }} unit=" kg" />
                <Tooltip contentStyle={{ background: '#181a28', border: '1px solid #252840', borderRadius: 8, color: '#e4e6f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="gewicht" stroke="#00d4aa" strokeWidth={2} dot={{ fill: '#00d4aa', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-dim text-center py-4">{selExercise ? 'Mindestens 2 Eintraege noetig' : 'Waehle eine Uebung'}</p>
          )}
        </div>

        {/* Cardio HF Graph */}
        {cardioData.length > 1 && (
          <>
            <h2 className="text-xl font-bold mb-3">❤️ Cardio Outdoor – Herzfrequenz</h2>
            <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cardioData}>
                  <XAxis dataKey="datum" tick={{ fill: '#7b7f9e', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#7b7f9e', fontSize: 10 }} unit=" bpm" domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#181a28', border: '1px solid #252840', borderRadius: 8, color: '#e4e6f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="hf" stroke="#f87171" strokeWidth={2} dot={{ fill: '#f87171', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
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

  // Exercise search
  if (view === 'search') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-3">🔍 Uebung suchen</h2>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="z.B. Latzug, Beinpresse..."
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

  // Body weight tracker
  if (view === 'weight') {
    const bwSorted = [...bwData].sort((a, b) => a.datum.localeCompare(b.datum));
    const bwChart = bwSorted.map(b => ({ datum: fmt(b.datum), kg: b.gewicht }));

    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-3">⚖️ Koerpergewicht</h2>

        {/* Input */}
        <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
          <div className="flex gap-2 mb-3">
            <input type="date" value={bwForm.datum} onChange={e => setBwForm({ ...bwForm, datum: e.target.value })}
              className="flex-1 p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
            <input value={bwForm.gewicht} onChange={e => setBwForm({ ...bwForm, gewicht: e.target.value })} placeholder="kg"
              className="w-24 p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" type="number" step="0.1" />
          </div>
          <button onClick={saveBW} className="w-full py-3 bg-acc text-bg font-bold text-sm rounded-xl border-none cursor-pointer">Speichern</button>
        </div>

        {/* Graph */}
        {bwChart.length > 1 && (
          <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={bwChart}>
                <XAxis dataKey="datum" tick={{ fill: '#7b7f9e', fontSize: 10 }} />
                <YAxis tick={{ fill: '#7b7f9e', fontSize: 10 }} unit=" kg" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#181a28', border: '1px solid #252840', borderRadius: 8, color: '#e4e6f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="kg" stroke="#a3e635" strokeWidth={2} dot={{ fill: '#a3e635', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History */}
        {bwSorted.reverse().map(b => (
          <div key={b.id} className="bg-card border border-brd rounded-xl p-3 mb-1.5 flex justify-between items-center">
            <div>
              <span className="font-bold text-base">{b.gewicht} kg</span>
              <span className="text-sm text-dim ml-2">{fmt(b.datum)}</span>
            </div>
            <button onClick={() => deleteBW(b.id)} className="text-cred bg-transparent border-none cursor-pointer">🗑</button>
          </div>
        ))}
        {bwData.length === 0 && <p className="text-dim text-center py-4">Noch keine Eintraege</p>}
      </div>
    );
  }

  // Goals
  if (view === 'goals') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
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
          <input value={goal.name} onChange={e => setGoal({ ...goal, name: e.target.value })} placeholder="z.B. Triathlon Koeln"
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

  // Help
  if (view === 'help') {
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-4">So funktioniert MaxFit</h2>
        <div className="space-y-4">
          {[
            ['🏠', 'Home', 'Wochen-Streak, Trainingswochen-Uebersicht, Ziel-Countdown, Trainingsplan anfordern, Workout starten.'],
            ['➕', 'Training', 'Waehle den Typ (Maschine, Eigengewicht, Kettlebell, Cardio, Outdoor, Schwimmen, Praevention) – das Formular passt sich automatisch an. Bei Maschine kannst du zwischen Maschine/Kabelzug/Kabel waehlen.'],
            ['🔥', 'Workout-Modus', 'Importiere einen Trainingsplan von Claude. Arbeite Uebungen als Checkliste ab. Unterstuetzt AMRAP, HIIT, Tabata und EMOM mit Rundenzaehler.'],
            ['📋', 'Verlauf', 'Alle Sessions. Tippe fuer Details. "Als Vorlage nutzen" kopiert ein Training auf heute.'],
            ['📅', 'Kalender', 'Monatsansicht mit Symbolen: ■ Kraft, ♥ Cardio, 💧 Schwimmen, ✚ Praevention.'],
            ['📊', 'Statistik', 'Gewichtsprogression als Graph pro Uebung. Cardio-HF-Entwicklung. Persoenliche Bestleistungen.'],
            ['🔍', 'Uebung suchen', 'Finde schnell: Wann und mit welchem Gewicht hast du eine Uebung zuletzt gemacht?'],
            ['⚖️', 'Koerpergewicht', 'Optional Gewicht tracken. Verlauf als Graph.'],
            ['📑', 'Excel/CSV Export', 'Alle Daten als CSV fuer Excel exportieren.'],
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
