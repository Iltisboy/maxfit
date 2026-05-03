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

function tsTooltipFmt(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

const TOOLTIP_STYLE = {
  background: '#181a28',
  border: '1px solid #252840',
  borderRadius: 8,
  color: '#e4e6f0',
  fontSize: 12,
};

// === Dynamic time axis ============================================
// Returns { ticks, tickFormatter } based on the actual data span,
// so labels never overlap regardless of zoom level.
function buildTimeAxis(dataPoints) {
  if (!dataPoints || dataPoints.length === 0) {
    return { ticks: [], tickFormatter: () => '' };
  }
  const tsList = dataPoints.map(d => d.ts).sort((a, b) => a - b);
  const minTs = tsList[0];
  const maxTs = tsList[tsList.length - 1];
  const spanDays = (maxTs - minTs) / (1000 * 60 * 60 * 24);

  // Choose granularity based on span
  // <= 21 days  → daily ticks (DD.MM.)
  // <= 90 days  → weekly ticks (DD.MM.)
  // <= 180 days → monthly ticks (MM/YY)
  // <= 540 days → quarterly ticks (MM/YY, every 3 months)
  // > 540 days  → yearly ticks (YYYY)

  let ticks = [];
  let tickFormatter;

  const startDate = new Date(minTs);
  const endDate = new Date(maxTs);

  if (spanDays <= 21) {
    // Daily, every 2-3 days
    const step = spanDays <= 7 ? 1 : (spanDays <= 14 ? 2 : 3);
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    while (cur.getTime() <= maxTs) {
      ticks.push(cur.getTime());
      cur.setDate(cur.getDate() + step);
    }
    tickFormatter = (ts) => {
      const d = new Date(ts);
      return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
    };
  } else if (spanDays <= 90) {
    // Weekly
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    // align to Monday-ish: just step weekly from start
    while (cur.getTime() <= maxTs) {
      ticks.push(cur.getTime());
      cur.setDate(cur.getDate() + 7);
    }
    tickFormatter = (ts) => {
      const d = new Date(ts);
      return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
    };
  } else if (spanDays <= 180) {
    // Monthly
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur.getTime() <= maxTs) {
      if (cur.getTime() >= minTs) ticks.push(cur.getTime());
      cur.setMonth(cur.getMonth() + 1);
    }
    tickFormatter = (ts) => {
      const d = new Date(ts);
      return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    };
  } else if (spanDays <= 540) {
    // Quarterly (every 3 months)
    const startMonth = startDate.getMonth();
    const quarterStart = startMonth - (startMonth % 3);
    const cur = new Date(startDate.getFullYear(), quarterStart, 1);
    while (cur.getTime() <= maxTs) {
      if (cur.getTime() >= minTs) ticks.push(cur.getTime());
      cur.setMonth(cur.getMonth() + 3);
    }
    tickFormatter = (ts) => {
      const d = new Date(ts);
      return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    };
  } else {
    // Yearly
    const cur = new Date(startDate.getFullYear(), 0, 1);
    while (cur.getTime() <= maxTs) {
      if (cur.getTime() >= minTs) ticks.push(cur.getTime());
      cur.setFullYear(cur.getFullYear() + 1);
    }
    tickFormatter = (ts) => {
      const d = new Date(ts);
      return String(d.getFullYear());
    };
  }

  // Cap the number of ticks to avoid clutter (max ~6-7 visible)
  if (ticks.length > 7) {
    const step = Math.ceil(ticks.length / 6);
    ticks = ticks.filter((_, i) => i % step === 0);
  }

  return { ticks, tickFormatter };
}

// Build the common XAxis props for a given dataset
function timeAxisProps(data) {
  const { ticks, tickFormatter } = buildTimeAxis(data);
  return {
    dataKey: 'ts',
    type: 'number',
    scale: 'time',
    domain: ['dataMin', 'dataMax'],
    ticks,
    tickFormatter,
    tick: { fill: '#9da1bd', fontSize: 10 },
    interval: 0,
  };
}

export default function More() {
  const [view, setView] = useState('menu');
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState({ name: '', datum: '', details: '' });
  const [goals, setGoals] = useState([]);
  const [libCat, setLibCat] = useState(null);
  const [libSearch, setLibSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [bwForm, setBwForm] = useState({ datum: localDate(), gewicht: '' });
  const [bwData, setBwData] = useState([]);
  const [selExercise, setSelExercise] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // { kind: 'json'|'csv', data: {...}, totalCount }
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

  // --- Exercise weight history
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

  // --- Body weight chart data
  function getBodyWeightChart() {
    return [...bwData]
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map(b => ({ ts: tsOf(b.datum), datum: fmt(b.datum), kg: b.gewicht }));
  }

  // === Relative progression: averaged across all exercises ===
  // Per exercise: take best weight per day, normalize against first-ever
  // weight for that exercise (= 100). Per session date: average of all
  // currently-tracked exercises' relative values.
  function getRelativeProgression() {
    // Collect (datum, max gewicht) per exercise
    const byExercise = {};
    for (const e of entries) {
      const w = pw(e.gewicht);
      if (w === null) continue;
      if (!byExercise[e.uebung]) byExercise[e.uebung] = {};
      const prev = byExercise[e.uebung][e.datum];
      if (prev === undefined || w > prev) byExercise[e.uebung][e.datum] = w;
    }

    // Build relative series per exercise (anchored at 100 = first-ever)
    const relByExercise = {}; // { name: [ {datum, rel}, ... ] }
    for (const [name, byDate] of Object.entries(byExercise)) {
      const dates = Object.keys(byDate).sort();
      if (dates.length < 2) continue; // need at least 2 points to show change
      const baseline = byDate[dates[0]];
      if (!baseline) continue;
      relByExercise[name] = dates.map(d => ({
        datum: d,
        rel: (byDate[d] / baseline) * 100,
      }));
    }

    // Get all unique session dates
    const allDates = new Set();
    for (const series of Object.values(relByExercise)) {
      for (const p of series) allDates.add(p.datum);
    }
    const sortedDates = [...allDates].sort();

    // For each date, average the relative values of exercises that had
    // any entry up to and including this date (carry-forward last value).
    const lastByExercise = {}; // name -> last rel value seen
    const out = [];
    for (const d of sortedDates) {
      // Update lastByExercise with this date's points
      for (const [name, series] of Object.entries(relByExercise)) {
        const point = series.find(p => p.datum === d);
        if (point) lastByExercise[name] = point.rel;
      }
      const vals = Object.values(lastByExercise);
      if (vals.length === 0) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      out.push({
        ts: tsOf(d),
        datum: fmt(d),
        rel: Math.round(avg * 10) / 10,
        n: vals.length,
      });
    }
    return out;
  }

  const searchResults = searchQ.length > 1 ? entries.filter(e =>
    e.uebung.toLowerCase().includes(searchQ.toLowerCase())
  ).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 30) : [];

  const exerciseNames = [...new Set(entries.filter(e => pw(e.gewicht) !== null).map(e => e.uebung))].sort();

  // --- Backup handlers (now with import preview / replace option)
  async function readJSONFile(file) {
    return await importFullBackup(file);
  }

  async function previewJSONImport(file) {
    try {
      const data = await readJSONFile(file);
      const total = (data.entries?.length || 0) + (data.bodyweight?.length || 0) +
                    (data.sessionNotes?.length || 0) + (data.goals?.length || 0) +
                    (data.prevLogs?.length || 0);
      setPendingImport({ kind: 'json', data, totalCount: total, breakdown: {
        entries: data.entries?.length || 0,
        bodyweight: data.bodyweight?.length || 0,
        sessionNotes: data.sessionNotes?.length || 0,
        goals: data.goals?.length || 0,
        prevLogs: data.prevLogs?.length || 0,
      }});
    } catch (e) {
      console.error(e);
      msg('Datei konnte nicht gelesen werden');
    }
  }

  async function previewCSVImport(file) {
    try {
      const data = await parseFullCSV(file);
      const total = (data.entries?.length || 0) + (data.bodyweight?.length || 0) +
                    (data.sessionNotes?.length || 0) + (data.goals?.length || 0) +
                    (data.prevLogs?.length || 0);
      setPendingImport({ kind: 'csv', data, totalCount: total, breakdown: {
        entries: data.entries?.length || 0,
        bodyweight: data.bodyweight?.length || 0,
        sessionNotes: data.sessionNotes?.length || 0,
        goals: data.goals?.length || 0,
        prevLogs: data.prevLogs?.length || 0,
      }});
    } catch (e) {
      console.error(e);
      msg('CSV konnte nicht gelesen werden');
    }
  }

  async function confirmImport(mode) {
    if (!pendingImport) return;
    try {
      const counts = await applyBackup(pendingImport.data, mode);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      msg(`${total} Einträge ${mode === 'replace' ? 'ersetzt' : 'hinzugefügt'}`);
      setPendingImport(null);
      loadData();
    } catch (e) {
      console.error(e);
      msg('Import fehlgeschlagen');
    }
  }

  async function handleExportJSON() { await exportFullBackup(); msg('JSON-Backup exportiert'); }
  async function handleExportCSV() { await exportFullCSV(); msg('CSV-Backup exportiert'); }

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
    const q = libSearch.trim().toLowerCase();
    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        <h2 className="text-xl font-bold mb-3">📚 Übungsbibliothek</h2>

        <div className="relative mb-3">
          <input
            value={libSearch}
            onChange={e => setLibSearch(e.target.value)}
            placeholder="Übung suchen…"
            className="w-full h-[44px] pl-10 pr-9 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim text-base pointer-events-none">🔍</span>
          {libSearch && (
            <button onClick={() => setLibSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-dim bg-transparent border-none cursor-pointer">✕</button>
          )}
        </div>

        {Object.entries(EXERCISE_LIB).map(([cat, exs]) => {
          const filtered = q ? exs.filter(ex => ex.n.toLowerCase().includes(q)) : exs;
          if (q && filtered.length === 0) return null;
          const isOpen = q ? true : libCat === cat;
          return (
            <div key={cat} className="mb-2">
              <button onClick={() => !q && setLibCat(libCat === cat ? null : cat)}
                className="w-full bg-card border border-brd rounded-2xl p-4 text-left cursor-pointer">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">{cat}</span>
                  <span className="text-sm text-dim">{filtered.length}{q ? ` / ${exs.length}` : ''} {!q && (isOpen ? '▲' : '▼')}</span>
                </div>
              </button>
              {isOpen && filtered.map((ex, i) => (
                <div key={i} className="bg-card border border-brd rounded-xl p-3 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-base">{ex.n}</span>
                    {ex.e && <span className="text-xs text-gold border border-gold px-1.5 rounded">Einseitig</span>}
                  </div>
                  <p className="text-xs text-cblue mt-1 leading-relaxed">{ex.d}</p>
                </div>
              ))}
            </div>
          );
        })}
        {q && Object.values(EXERCISE_LIB).every(exs => exs.filter(ex => ex.n.toLowerCase().includes(q)).length === 0) && (
          <p className="text-dim text-center py-6">Keine Treffer für „{libSearch}"</p>
        )}
      </div>
    );
  }

  // --- Stats with relative progression + dynamic axes
  if (view === 'stats') {
    const exData = selExercise ? getExData(selExercise) : [];
    const bwChart = getBodyWeightChart();
    const relProg = getRelativeProgression();

    return (
      <div className="px-5 pt-4 pb-4">
        <BackBtn />
        {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">{toast}</div>}

        {/* Relative Gesamtprogression */}
        <h2 className="text-xl font-bold mb-3">🚀 Gesamtfortschritt</h2>
        <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
          <p className="text-xs text-dim mb-2 leading-relaxed">
            Durchschnittliche Gewichtssteigerung über alle getrackten Übungen.
            Pro Übung gilt das erste geloggte Gewicht als 100% — der Graph zeigt den Mittelwert über die Zeit.
          </p>
          {relProg.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={relProg}>
                <XAxis {...timeAxisProps(relProg)} />
                <YAxis tick={{ fill: '#9da1bd', fontSize: 10 }} unit=" %" domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={tsTooltipFmt}
                  formatter={(value, name, p) => [`${value} % (${p.payload.n} Übungen)`, 'Mittelwert']}
                />
                <Line type="monotone" dataKey="rel" stroke="#fbbf24" strokeWidth={2} dot={{ fill: '#fbbf24', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-dim text-center py-4">Noch zu wenig Daten für diesen Graph</p>
          )}
          {relProg.length > 0 && (
            <p className="text-sm text-acc font-bold text-center mt-2">
              Aktuell: {relProg[relProg.length - 1].rel} % vom Startpunkt
            </p>
          )}
        </div>

        {/* Per-exercise weight progression */}
        <h2 className="text-xl font-bold mb-3">📈 Gewicht pro Übung</h2>
        <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
          <select value={selExercise || ''} onChange={e => setSelExercise(e.target.value || null)}
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none mb-3">
            <option value="">Übung auswählen…</option>
            {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {exData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={exData}>
                <XAxis {...timeAxisProps(exData)} />
                <YAxis tick={{ fill: '#9da1bd', fontSize: 10 }} unit=" kg" />
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

        {/* Bodyweight chart */}
        {bwChart.length >= 1 && (
          <>
            <h2 className="text-xl font-bold mb-3">⚖️ Körpergewicht</h2>
            <div className="bg-card rounded-2xl p-4 border border-brd mb-4">
              {bwChart.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bwChart}>
                    <XAxis {...timeAxisProps(bwChart)} />
                    <YAxis tick={{ fill: '#9da1bd', fontSize: 10 }} unit=" kg" domain={['auto', 'auto']} />
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

  // --- Body weight tracker
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
                <XAxis {...timeAxisProps(bwChart)} />
                <YAxis tick={{ fill: '#9da1bd', fontSize: 10 }} unit=" kg" domain={['auto', 'auto']} />
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

  // --- Backup with import preview / replace option
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

        <div className="bg-bg border border-brd rounded-xl p-3 text-xs text-dim leading-relaxed">
          <p className="mb-1">
            <b className="text-acc">Tipp:</b> Beim Import kannst du wählen, ob die bestehenden Daten <b>ergänzt</b> oder
            komplett <b>ersetzt</b> werden — das verhindert Duplikate beim Wiedereinspielen eines Backups.
          </p>
        </div>

        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={e => { if (e.target.files[0]) previewJSONImport(e.target.files[0]); e.target.value = ''; }} />
        <input ref={csvRef} type="file" accept=".csv" className="hidden"
          onChange={e => { if (e.target.files[0]) previewCSVImport(e.target.files[0]); e.target.value = ''; }} />

        {/* Import confirmation modal */}
        {pendingImport && (
          <div className="fixed inset-0 bg-bg/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPendingImport(null)}>
            <div className="bg-card border border-brd rounded-2xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2">Import bestätigen</h3>
              <p className="text-sm text-dim mb-3">
                {pendingImport.kind === 'json' ? 'JSON' : 'CSV'}-Backup mit insgesamt <b className="text-acc">{pendingImport.totalCount}</b> Einträgen geladen:
              </p>
              <ul className="text-xs text-dim space-y-0.5 mb-4 pl-2">
                <li>• Trainings: <b>{pendingImport.breakdown.entries}</b></li>
                <li>• Körpergewicht: <b>{pendingImport.breakdown.bodyweight}</b></li>
                <li>• Session-Notizen: <b>{pendingImport.breakdown.sessionNotes}</b></li>
                <li>• Ziele: <b>{pendingImport.breakdown.goals}</b></li>
                <li>• Prävention-Logs: <b>{pendingImport.breakdown.prevLogs}</b></li>
              </ul>

              <div className="space-y-2">
                <button onClick={() => confirmImport('replace')}
                  className="w-full py-3 bg-cred text-bg font-bold text-sm rounded-xl border-none cursor-pointer">
                  🔄 Alles ersetzen
                  <span className="block text-[10px] font-normal opacity-90">Bestehende Daten werden gelöscht</span>
                </button>
                <button onClick={() => confirmImport('append')}
                  className="w-full py-3 bg-acc text-bg font-bold text-sm rounded-xl border-none cursor-pointer">
                  ➕ Hinzufügen
                  <span className="block text-[10px] font-normal opacity-90">Backup wird zu bestehenden Daten ergänzt (Duplikate möglich)</span>
                </button>
                <button onClick={() => setPendingImport(null)}
                  className="w-full py-2.5 bg-card border border-brd text-dim font-semibold text-sm rounded-xl cursor-pointer">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
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
            ['🔥', 'Workout-Modus', 'Importiere einen Plan von Claude. Jede Übung ist einzeln editierbar; Haken kannst du jederzeit setzen oder entfernen. Übungen können manuell hinzugefügt werden. Aktive Workouts werden automatisch gespeichert — schließe die App ruhig zwischendurch.'],
            ['📋', 'Verlauf', 'Alle Sessions. Tippe für Details. "Als Vorlage nutzen" kopiert ein Training auf heute.'],
            ['📅', 'Kalender', 'Monatsansicht mit Symbolen.'],
            ['📊', 'Statistik', 'Gesamtfortschritt (Mittelwert relativer Steigerung), Gewicht pro Übung, Körpergewicht — alles mit dynamischer Zeitachse.'],
            ['🔍', 'Übung suchen', 'Wann und mit welchem Gewicht hast du eine Übung zuletzt gemacht?'],
            ['⚖️', 'Körpergewicht', 'Tracking + Verlauf als Graph.'],
            ['💾', 'Backup', 'JSON oder CSV Voll-Export. Beim Import kannst du wählen: ergänzen oder komplett ersetzen.'],
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
