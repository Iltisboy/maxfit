import { useState, useEffect } from 'react';
import db from '../db';
import { getTyp } from '../utils/categories';
import { getExerciseInfo } from '../exercise-library';

const TYPES = [
  { id: 'kraft', label: 'Kraft (Maschine)', geraet: 'Maschine' },
  { id: 'kabel', label: 'Kraft (Kabelzug)', geraet: 'Kabelzug' },
  { id: 'eigen', label: 'Eigengewicht', geraet: 'Eigengewicht' },
  { id: 'kb', label: 'Kettlebell', geraet: 'Kettlebell' },
  { id: 'cardio', label: 'Cardio (Gym)', geraet: 'Cardio' },
  { id: 'outdoor', label: 'Cardio (Outdoor)', geraet: 'Outdoor' },
  { id: 'swim', label: 'Schwimmen', geraet: 'Schwimmbad' },
  { id: 'prev', label: 'Prävention', geraet: 'Prävention' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Training({ editEntry, onDone }) {
  const [selType, setSelType] = useState(null);
  const [form, setForm] = useState({
    datum: today(), uebung: '', geraet: '', einseitig: false,
    saetze: 3, wdh: '', gewicht: '', bem: '',
    dauer: '', distanz: '', pace: '', hf: '', hoehenmeter: '', stufe: '', typ: '',
  });
  const [allExercises, setAllExercises] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    db.entries.toArray().then(all => {
      setAllExercises([...new Set(all.map(e => e.uebung))].sort());
    });
  }, []);

  useEffect(() => {
    if (editEntry) {
      setForm({ ...editEntry, hf: editEntry.hf || '', hoehenmeter: editEntry.hoehenmeter || '', dauer: editEntry.dauer || '', distanz: editEntry.distanz || '', pace: editEntry.pace || '', stufe: editEntry.stufe || '' });
      const t = TYPES.find(t => t.geraet === editEntry.geraet);
      setSelType(t ? t.id : 'kraft');
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
    // Auto-fill from last entry
    db.entries.where('uebung').equals(name).last().then(last => {
      if (last) {
        setForm(f => ({ ...f, einseitig: last.einseitig, saetze: last.saetze || 3 }));
      }
    });
  }

  const sugs = form.uebung.length > 0
    ? allExercises.filter(u => u.toLowerCase().includes(form.uebung.toLowerCase())).slice(0, 8)
    : allExercises.slice(0, 10);

  async function handleSave() {
    if (!form.uebung.trim()) return;
    const entry = {
      ...form,
      typ: form.typ || getTyp(form.geraet),
      saetze: Number(form.saetze) || 1,
      hf: form.hf ? Number(form.hf) : undefined,
      hoehenmeter: form.hoehenmeter ? Number(form.hoehenmeter) : undefined,
    };
    // Clean empty fields
    Object.keys(entry).forEach(k => { if (entry[k] === '' || entry[k] === undefined) delete entry[k]; });

    if (editEntry && editEntry.id) {
      await db.entries.update(editEntry.id, entry);
    } else {
      await db.entries.add(entry);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      if (onDone) onDone();
      // Reset
      setForm({ datum: today(), uebung: '', geraet: form.geraet, einseitig: false, saetze: 3, wdh: '', gewicht: '', bem: '', dauer: '', distanz: '', pace: '', hf: '', hoehenmeter: '', stufe: '', typ: form.typ });
      setInfo(null);
    }, 800);
  }

  const isCardio = ['cardio', 'outdoor', 'swim'].includes(selType);
  const isOutdoor = selType === 'outdoor';
  const isSwim = selType === 'swim';
  const isPrev = selType === 'prev';
  const isKraft = ['kraft', 'kabel', 'eigen', 'kb'].includes(selType);

  // Type selection
  if (!selType) {
    return (
      <div className="px-5 pt-4 pb-4">
        <h2 className="text-xl font-bold mb-5">Was trainierst du?</h2>
        <div className="grid grid-cols-2 gap-3">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => selectType(t)}
              className="bg-card border border-brd rounded-2xl p-5 text-left cursor-pointer hover:border-acc transition-colors">
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
        <h2 className="text-lg font-bold">{editEntry ? 'Bearbeiten' : 'Neue Übung'}</h2>
        <button onClick={() => { setSelType(null); setInfo(null); }} className="text-acc text-sm font-semibold bg-transparent border-none cursor-pointer">← Typ ändern</button>
      </div>

      {saved && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">Gespeichert ✓</div>}

      {/* Datum */}
      <div className="mb-3">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Datum</label>
        <input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })}
          className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
      </div>

      {/* Übung */}
      <div className="mb-3">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Übung</label>
        <input value={form.uebung}
          onChange={e => { setForm({ ...form, uebung: e.target.value }); setShowSug(true); }}
          onFocus={() => setShowSug(true)}
          placeholder="z.B. Beinpresse"
          className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
        {showSug && sugs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {sugs.map(u => (
              <button key={u} onClick={() => selectExercise(u)}
                className="bg-sf border border-brd rounded-md px-2 py-1 text-[11px] text-dim cursor-pointer">{u}</button>
            ))}
          </div>
        )}
        {info && (
          <div className="bg-bg border border-brd rounded-md p-2 mt-1 text-[11px] text-cblue leading-relaxed">
            🏋️ {info.d}
          </div>
        )}
      </div>

      {/* Kraft-Felder */}
      {isKraft && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Sätze</label>
            <div className="flex items-center">
              <button onClick={() => setForm({ ...form, saetze: Math.max(1, form.saetze - 1) })} className="w-11 h-11 bg-card border border-brd rounded-lg text-t-primary text-xl font-bold cursor-pointer">−</button>
              <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
              <button onClick={() => setForm({ ...form, saetze: form.saetze + 1 })} className="w-11 h-11 bg-card border border-brd rounded-lg text-t-primary text-xl font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Wdh / Zeit</label>
            <input value={form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value })} placeholder="12 oder 60 sek"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Gewicht / Stufe</label>
            <input value={form.gewicht} onChange={e => setForm({ ...form, gewicht: e.target.value })} placeholder="22,5 kg"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="w-20">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Einseitig</label>
            <button onClick={() => setForm({ ...form, einseitig: !form.einseitig })}
              className={`w-full p-2.5 rounded-lg font-semibold text-sm cursor-pointer border ${form.einseitig ? 'bg-acc text-bg border-acc' : 'bg-bg text-dim border-brd'}`}>
              {form.einseitig ? 'Ja' : 'Nein'}
            </button>
          </div>
        </div>
      </>}

      {/* Cardio Gym */}
      {selType === 'cardio' && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer</label>
            <input value={form.dauer || form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value, dauer: e.target.value })} placeholder="25 min"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Stufe / Tempo</label>
            <input value={form.stufe || form.gewicht} onChange={e => setForm({ ...form, gewicht: e.target.value, stufe: e.target.value })} placeholder="Stufe 12"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Ø Herzfrequenz</label>
          <input value={form.hf} onChange={e => setForm({ ...form, hf: e.target.value })} placeholder="148" type="number"
            className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
        </div>
      </>}

      {/* Outdoor */}
      {isOutdoor && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Distanz</label>
            <input value={form.distanz || form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value, distanz: e.target.value })} placeholder="34,75 km"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer</label>
            <input value={form.dauer} onChange={e => setForm({ ...form, dauer: e.target.value })} placeholder="2:22:52"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Pace / Speed</label>
            <input value={form.pace} onChange={e => setForm({ ...form, pace: e.target.value })} placeholder="5:58 min/km"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Ø Herzfrequenz</label>
            <input value={form.hf} onChange={e => setForm({ ...form, hf: e.target.value })} placeholder="148" type="number"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Höhenmeter</label>
          <input value={form.hoehenmeter} onChange={e => setForm({ ...form, hoehenmeter: e.target.value })} placeholder="283" type="number"
            className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
        </div>
      </>}

      {/* Schwimmen */}
      {isSwim && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Distanz</label>
            <input value={form.distanz || form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value, distanz: e.target.value })} placeholder="800 m"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer</label>
            <input value={form.dauer} onChange={e => setForm({ ...form, dauer: e.target.value })} placeholder="18:30 min"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Pace</label>
            <input value={form.pace} onChange={e => setForm({ ...form, pace: e.target.value })} placeholder="2:19 min/100m"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Ø Herzfrequenz</label>
            <input value={form.hf} onChange={e => setForm({ ...form, hf: e.target.value })} placeholder="142" type="number"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
      </>}

      {/* Prävention */}
      {isPrev && <>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Sätze</label>
            <div className="flex items-center">
              <button onClick={() => setForm({ ...form, saetze: Math.max(1, form.saetze - 1) })} className="w-11 h-11 bg-card border border-brd rounded-lg text-t-primary text-xl font-bold cursor-pointer">−</button>
              <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
              <button onClick={() => setForm({ ...form, saetze: form.saetze + 1 })} className="w-11 h-11 bg-card border border-brd rounded-lg text-t-primary text-xl font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Dauer / Wdh</label>
            <input value={form.wdh} onChange={e => setForm({ ...form, wdh: e.target.value })} placeholder="45 sek oder 12"
              className="w-full p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none" />
          </div>
        </div>
      </>}

      {/* Bemerkungen (alle Typen) */}
      <div className="mb-4">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Bemerkungen</label>
        <textarea value={form.bem} onChange={e => setForm({ ...form, bem: e.target.value })}
          placeholder="Steigerung, Schmerz, Supersatz..."
          className="w-full min-h-[56px] p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-base outline-none resize-y" />
      </div>

      <button onClick={handleSave}
        className="w-full py-4 bg-gradient-to-r from-acc to-acc-d text-bg font-bold text-base rounded-2xl border-none cursor-pointer">
        {editEntry ? 'Aktualisieren' : 'Speichern'}
      </button>
    </div>
  );
}
