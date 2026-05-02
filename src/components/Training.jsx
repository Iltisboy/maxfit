import { useState, useEffect } from 'react';
import db from '../db';
import { getTyp } from '../utils/categories.jsx';
import { getExerciseInfo } from '../exercise-library';

const TYPES = [
  { id: 'maschine', label: 'Maschine', geraet: 'Maschine', icon: '🏋️' },
  { id: 'eigen', label: 'Eigengewicht', geraet: 'Eigengewicht', icon: '🤸' },
  { id: 'kb', label: 'Kettlebell', geraet: 'Kettlebell', icon: '🔔' },
  { id: 'cardio', label: 'Cardio (Gym)', geraet: 'Cardio', icon: '💙' },
  { id: 'outdoor', label: 'Cardio (Outdoor)', geraet: 'Outdoor', icon: '💚' },
  { id: 'swim', label: 'Schwimmen', geraet: 'Schwimmbad', icon: '💧' },
  { id: 'prev', label: 'Prävention', geraet: 'Prävention', icon: '✚' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Training({ editEntry, onDone }) {
  const [selType, setSelType] = useState(null);
  const [form, setForm] = useState({
    datum: today(), uebung: '', geraet: '', einseitig: false,
    saetze: 3, wdh: '', gewicht: '', bem: '', typ: '',
    dauer: '', distanz: '', hf: '', hoehenmeter: '',
  });
  const [gewUnit, setGewUnit] = useState('kg');
  const [wdhUnit, setWdhUnit] = useState('wdh');
  const [allExercises, setAllExercises] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    db.entries.toArray().then(all => {
      setAllExercises([...new Set(all.map(e => e.uebung))].sort());
    });
  }, [savedCount]);

  useEffect(() => {
    if (editEntry) {
      if (editEntry.geraet) {
        setForm({ ...editEntry, hf: editEntry.hf || '', hoehenmeter: editEntry.hoehenmeter || '', dauer: editEntry.dauer || '', distanz: editEntry.distanz || '' });
        const t = TYPES.find(t => t.geraet === editEntry.geraet);
        setSelType(t ? t.id : 'maschine');
        if (editEntry.gewicht && /Stufe/i.test(editEntry.gewicht)) setGewUnit('stufe');
      } else if (editEntry.datum) {
        setForm(f => ({ ...f, datum: editEntry.datum }));
        setSelType(null);
      }
    }
  }, [editEntry]);

  function selectType(t) {
    setSelType(t.id);
    setForm(f => ({ ...f, geraet: t.geraet, typ: getTyp(t.geraet) }));
  }

  function selectExercise(name) {
    setForm(f => ({ ...f, uebung: name }));
    setShowSug(false);
    const exInfo = getExerciseInfo(name);
    setInfo(exInfo);
    db.entries.where('uebung').equals(name).last().then(last => {
      if (last) {
        setForm(f => ({ ...f, einseitig: last.einseitig, saetze: last.saetze || 3 }));
        if (last.gewicht && /Stufe/i.test(last.gewicht)) setGewUnit('stufe');
      }
    });
  }

  const sugs = form.uebung.length > 0
    ? allExercises.filter(u => u.toLowerCase().includes(form.uebung.toLowerCase())).slice(0, 8)
    : allExercises.slice(0, 10);

  async function handleSave() {
    if (!form.uebung.trim()) return;

    // Build entry
    const entry = { datum: form.datum, uebung: form.uebung, geraet: form.geraet, typ: form.typ || getTyp(form.geraet), einseitig: form.einseitig };

    if (selType === 'maschine' || selType === 'kb') {
      entry.saetze = Number(form.saetze) || 1;
      entry.wdh = String(form.wdh);
      if (form.gewicht) {
        entry.gewicht = form.gewicht + (gewUnit === 'stufe' ? ' (Stufe)' : ' kg');
      }
    } else if (selType === 'eigen') {
      entry.saetze = Number(form.saetze) || 1;
      entry.wdh = form.wdh + (wdhUnit === 'sek' ? ' sek' : '');
    } else if (selType === 'prev') {
      entry.saetze = Number(form.saetze) || 1;
      entry.wdh = form.wdh + (wdhUnit === 'sek' ? ' sek' : '');
    } else if (selType === 'cardio') {
      entry.saetze = 1;
      entry.wdh = form.dauer || '';
      if (form.gewicht) entry.gewicht = form.gewicht + (gewUnit === 'stufe' ? ' (Stufe)' : '');
      if (form.hf) entry.hf = Number(form.hf);
    } else if (selType === 'outdoor') {
      entry.saetze = 1;
      entry.wdh = form.distanz || '';
      entry.dauer = form.dauer || '';
      if (form.hf) entry.hf = Number(form.hf);
      if (form.hoehenmeter) entry.hoehenmeter = Number(form.hoehenmeter);
      // Auto-calc pace
      if (form.distanz && form.dauer) entry.pace = calcPace(form.distanz, form.dauer);
    } else if (selType === 'swim') {
      entry.saetze = 1;
      entry.wdh = form.distanz || '';
      entry.dauer = form.dauer || '';
      if (form.hf) entry.hf = Number(form.hf);
      if (form.distanz && form.dauer) entry.pace = calcPaceSwim(form.distanz, form.dauer);
    }

    if (form.bem) entry.bem = form.bem;
    Object.keys(entry).forEach(k => { if (entry[k] === '' || entry[k] === undefined || entry[k] === null) delete entry[k]; });

    if (editEntry && editEntry.id) {
      await db.entries.update(editEntry.id, entry);
    } else {
      await db.entries.add(entry);
    }
    setSaved(true);
    setSavedCount(c => c + 1);
    setTimeout(() => {
      setSaved(false);
      setForm(f => ({ datum: f.datum, uebung: '', geraet: f.geraet, einseitig: false, saetze: 3, wdh: '', gewicht: '', bem: '', typ: f.typ, dauer: '', distanz: '', hf: '', hoehenmeter: '' }));
      setInfo(null);
    }, 800);
  }

  function calcPace(distStr, durStr) {
    try {
      const km = parseFloat(distStr.replace(',', '.'));
      const parts = durStr.split(':').map(Number);
      let totalMin = 0;
      if (parts.length === 3) totalMin = parts[0] * 60 + parts[1] + parts[2] / 60;
      else if (parts.length === 2) totalMin = parts[0] + parts[1] / 60;
      else totalMin = parts[0];
      const pace = totalMin / km;
      const pMin = Math.floor(pace);
      const pSec = Math.round((pace - pMin) * 60);
      return pMin + ':' + String(pSec).padStart(2, '0') + ' min/km';
    } catch (e) { return ''; }
  }

  function calcPaceSwim(distStr, durStr) {
    try {
      const m = parseFloat(distStr.replace(',', '.'));
      const parts = durStr.split(':').map(Number);
      let totalSec = 0;
      if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];
      else totalSec = parts[0] * 60;
      const per100 = (totalSec / m) * 100;
      const pMin = Math.floor(per100 / 60);
      const pSec = Math.round(per100 % 60);
      return pMin + ':' + String(pSec).padStart(2, '0') + ' min/100m';
    } catch (e) { return ''; }
  }

  // Type selection
  if (!selType) {
    return (
      <div className="px-5 pt-4 pb-4">
        <h2 className="text-xl font-bold mb-5">Was trainierst du?</h2>
        <div className="grid grid-cols-2 gap-3">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => selectType(t)}
              className="bg-card border border-brd rounded-2xl p-5 text-left cursor-pointer hover:border-acc transition-colors">
              <span className="text-2xl block mb-1">{t.icon}</span>
              <span className="text-base font-bold text-t-primary">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{editEntry?.id ? 'Bearbeiten' : 'Neue Übung'}</h2>
        <button onClick={() => { setSelType(null); setInfo(null); }} className="text-acc text-sm font-semibold bg-transparent border-none cursor-pointer">← Typ ändern</button>
      </div>

      {saved && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">Gespeichert ✓</div>}
      {savedCount > 0 && !saved && <div className="text-xs text-dim mb-2">{savedCount} Übung(en) heute eingetragen</div>}

      {/* Datum */}
      <div className="mb-3">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Datum</label>
        <input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })}
          className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
      </div>

      {/* Übung */}
      <div className="mb-3">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Übung</label>
        <input value={form.uebung}
          onChange={e => { setForm({ ...form, uebung: e.target.value }); setShowSug(true); }}
          onFocus={() => setShowSug(true)}
          placeholder="z.B. Beinpresse"
          className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
        {showSug && sugs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {sugs.map(u => (
              <button key={u} onClick={() => selectExercise(u)}
                className="bg-sf border border-brd rounded-lg px-2.5 py-1.5 text-xs text-dim cursor-pointer">{u}</button>
            ))}
          </div>
        )}
        {info && (
          <div className="bg-bg border border-brd rounded-lg p-2 mt-1.5 text-xs text-cblue leading-relaxed">🏋️ {info.d}</div>
        )}
      </div>

      {/* ===== MASCHINE ===== */}
      {selType === 'maschine' && <>
        <div className="mb-3">
          <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Gerät</label>
          <div className="flex gap-2">
            {['Maschine', 'Kabelzug'].map(g => (
              <button key={g} onClick={() => setForm({ ...form, geraet: g })}
                className={`flex-1 p-3 rounded-xl font-semibold text-sm cursor-pointer border ${form.geraet === g ? 'bg-acc text-bg border-acc' : 'bg-bg text-dim border-brd'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Sätze</label>
            <div className="flex items-center">
              <button onClick={() => setForm({ ...form, saetze: Math.max(1, form.saetze - 1) })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">−</button>
              <span className="flex-1 text-center text-lg font-bold">{form.saetze}</span>
              <button onClick={() => setForm({ ...form, saetze: form.saetze + 1 })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Wiederholungen</label>
            <input value={form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value })} placeholder="12" type="number" inputMode="numeric"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="flex gap-2 mb-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Gewicht</label>
            <input value={form.gewicht} onChange={e => setForm({ ...form, gewicht: e.target.value })} placeholder="22,5" inputMode="decimal"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex gap-1 mb-0">
            <button onClick={() => setGewUnit('kg')}
              className={`px-4 py-3 rounded-xl font-bold text-sm cursor-pointer border ${gewUnit === 'kg' ? 'bg-acc text-bg border-acc' : 'bg-bg text-dim border-brd'}`}>kg</button>
            <button onClick={() => setGewUnit('stufe')}
              className={`px-4 py-3 rounded-xl font-bold text-sm cursor-pointer border ${gewUnit === 'stufe' ? 'bg-acc text-bg border-acc' : 'bg-bg text-dim border-brd'}`}>Stufe</button>
          </div>
          <div>
            <button onClick={() => setForm({ ...form, einseitig: !form.einseitig })}
              className={`px-3 py-3 rounded-xl font-bold text-xs cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
              {form.einseitig ? '1-seitig' : '2-seitig'}
            </button>
          </div>
        </div>
      </>}

      {/* ===== EIGENGEWICHT ===== */}
      {selType === 'eigen' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Sätze</label>
            <div className="flex items-center">
              <button onClick={() => setForm({ ...form, saetze: Math.max(1, form.saetze - 1) })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">−</button>
              <span className="flex-1 text-center text-lg font-bold">{form.saetze}</span>
              <button onClick={() => setForm({ ...form, saetze: form.saetze + 1 })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Wert</label>
            <div className="flex gap-1">
              <input value={form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value })} placeholder="12" type="number" inputMode="numeric"
                className="flex-1 p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
              <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
                className={`px-3 py-3 rounded-xl font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
                {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setForm({ ...form, einseitig: !form.einseitig })}
            className={`px-4 py-3 rounded-xl font-bold text-sm cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
            {form.einseitig ? '1-seitig ✓' : '2-seitig'}
          </button>
        </div>
      </>}

      {/* ===== KETTLEBELL ===== */}
      {selType === 'kb' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Sätze</label>
            <div className="flex items-center">
              <button onClick={() => setForm({ ...form, saetze: Math.max(1, form.saetze - 1) })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">−</button>
              <span className="flex-1 text-center text-lg font-bold">{form.saetze}</span>
              <button onClick={() => setForm({ ...form, saetze: form.saetze + 1 })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Wert</label>
            <div className="flex gap-1">
              <input value={form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value })} placeholder="12" type="number" inputMode="numeric"
                className="flex-1 p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
              <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
                className={`px-3 py-3 rounded-xl font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
                {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mb-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Gewicht (kg)</label>
            <input value={form.gewicht} onChange={e => setForm({ ...form, gewicht: e.target.value })} placeholder="6" inputMode="decimal"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <button onClick={() => setForm({ ...form, einseitig: !form.einseitig })}
            className={`px-4 py-3 rounded-xl font-bold text-sm cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
            {form.einseitig ? '1-seitig ✓' : '2-seitig'}
          </button>
        </div>
      </>}

      {/* ===== CARDIO GYM ===== */}
      {selType === 'cardio' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer (min)</label>
            <input value={form.dauer} onChange={e => setForm({ ...form, dauer: e.target.value })} placeholder="25" inputMode="numeric"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Stufe / Tempo</label>
            <input value={form.gewicht} onChange={e => setForm({ ...form, gewicht: e.target.value })} placeholder="12" inputMode="text"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Ø Herzfrequenz</label>
          <input value={form.hf} onChange={e => setForm({ ...form, hf: e.target.value })} placeholder="148" type="number" inputMode="numeric"
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
        </div>
      </>}

      {/* ===== OUTDOOR ===== */}
      {selType === 'outdoor' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Distanz (km)</label>
            <input value={form.distanz} onChange={e => setForm({ ...form, distanz: e.target.value })} placeholder="7,01" inputMode="decimal"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer (h:mm:ss)</label>
            <input value={form.dauer} onChange={e => setForm({ ...form, dauer: e.target.value })} placeholder="41:50" inputMode="text"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Ø Herzfrequenz</label>
            <input value={form.hf} onChange={e => setForm({ ...form, hf: e.target.value })} placeholder="148" type="number" inputMode="numeric"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Höhenmeter</label>
            <input value={form.hoehenmeter} onChange={e => setForm({ ...form, hoehenmeter: e.target.value })} placeholder="283" type="number" inputMode="numeric"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        {form.distanz && form.dauer && (
          <div className="bg-acc-g border border-acc rounded-xl p-3 mb-3 text-center">
            <span className="text-sm text-acc font-bold">Pace: {calcPace(form.distanz, form.dauer) || '...'}</span>
          </div>
        )}
      </>}

      {/* ===== SCHWIMMEN ===== */}
      {selType === 'swim' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Distanz (m)</label>
            <input value={form.distanz} onChange={e => setForm({ ...form, distanz: e.target.value })} placeholder="800" inputMode="numeric"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer (mm:ss)</label>
            <input value={form.dauer} onChange={e => setForm({ ...form, dauer: e.target.value })} placeholder="18:30" inputMode="text"
              className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Ø Herzfrequenz</label>
          <input value={form.hf} onChange={e => setForm({ ...form, hf: e.target.value })} placeholder="142" type="number" inputMode="numeric"
            className="w-full p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
        </div>
        {form.distanz && form.dauer && (
          <div className="bg-acc-g border border-acc rounded-xl p-3 mb-3 text-center">
            <span className="text-sm text-acc font-bold">Pace: {calcPaceSwim(form.distanz, form.dauer) || '...'}</span>
          </div>
        )}
      </>}

      {/* ===== PRÄVENTION ===== */}
      {selType === 'prev' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Sätze</label>
            <div className="flex items-center">
              <button onClick={() => setForm({ ...form, saetze: Math.max(1, form.saetze - 1) })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">−</button>
              <span className="flex-1 text-center text-lg font-bold">{form.saetze}</span>
              <button onClick={() => setForm({ ...form, saetze: form.saetze + 1 })} className="w-11 h-11 bg-card border border-brd rounded-xl text-t-primary text-xl font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Wert</label>
            <div className="flex gap-1">
              <input value={form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value })} placeholder="12" type="number" inputMode="numeric"
                className="flex-1 p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
              <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
                className={`px-3 py-3 rounded-xl font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
                {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'}
              </button>
            </div>
          </div>
        </div>
      </>}

      {/* Bemerkungen (alle Typen) */}
      <div className="mb-4">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Bemerkungen</label>
        <textarea value={form.bem} onChange={e => setForm({ ...form, bem: e.target.value })}
          placeholder="Steigerung, Schmerz, Supersatz..."
          className="w-full min-h-[52px] p-3 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none resize-y" />
      </div>

      <button onClick={handleSave}
        className="w-full py-4 bg-gradient-to-r from-acc to-acc-d text-bg font-bold text-base rounded-2xl border-none cursor-pointer">
        {editEntry?.id ? 'Aktualisieren' : 'Speichern & nächste Übung'}
      </button>
      {!editEntry?.id && (
        <button onClick={() => { if (onDone) onDone(); }}
          className="w-full py-3 mt-2 bg-card border border-brd text-dim font-semibold text-sm rounded-2xl cursor-pointer">
          Training beenden
        </button>
      )}
    </div>
  );
}
