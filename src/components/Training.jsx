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
const I = "h-[42px] p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none w-full";
const L = "block text-[10px] text-dim font-bold uppercase tracking-wider mb-0.5";
const TG = (on, c='acc') => `h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border w-full ${on ? `bg-${c} text-bg border-${c}` : 'bg-bg text-dim border-brd'}`;

export default function Training({ editEntry, onDone }) {
  const [selType, setSelType] = useState(null);
  const [form, setForm] = useState({ datum: today(), uebung: '', geraet: '', einseitig: false, saetze: 3, wdh: '', gewicht: '', bem: '', typ: '', dauer: '', distanz: '', hf: '', hoehenmeter: '', steigung: '', schwimmort: 'Pool' });
  const [gewUnit, setGewUnit] = useState('kg');
  const [wdhUnit, setWdhUnit] = useState('wdh');
  const [allEx, setAllEx] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => { db.entries.toArray().then(a => setAllEx([...new Set(a.map(e => e.uebung))].sort())); }, [savedCount]);

  useEffect(() => {
    if (editEntry) {
      if (editEntry.geraet) {
        setForm({ ...editEntry, hf: editEntry.hf || '', hoehenmeter: editEntry.hoehenmeter || '', dauer: editEntry.dauer || '', distanz: editEntry.distanz || '', steigung: '', schwimmort: editEntry.schwimmort || 'Pool' });
        const t = TYPES.find(t => t.geraet === editEntry.geraet);
        setSelType(t ? t.id : 'maschine');
        if (editEntry.gewicht && /Stufe/i.test(editEntry.gewicht)) setGewUnit('stufe');
      } else if (editEntry.datum) {
        setForm(f => ({ ...f, datum: editEntry.datum }));
        setSelType(null);
      }
    }
  }, [editEntry]);

  function selectType(t) { setSelType(t.id); setForm(f => ({ ...f, geraet: t.geraet, typ: getTyp(t.geraet) })); }

  function selectExercise(name) {
    setForm(f => ({ ...f, uebung: name })); setShowSug(false);
    setInfo(getExerciseInfo(name));
    db.entries.where('uebung').equals(name).last().then(l => { if (l) setForm(f => ({ ...f, einseitig: l.einseitig, saetze: l.saetze || 3 })); });
  }

  const sugs = form.uebung.length > 0 ? allEx.filter(u => u.toLowerCase().includes(form.uebung.toLowerCase())).slice(0, 6) : allEx.slice(0, 8);

  function buildEntry() {
    if (!form.uebung.trim()) return null;
    const e = { datum: form.datum, uebung: form.uebung, geraet: form.geraet, typ: form.typ || getTyp(form.geraet), einseitig: form.einseitig };
    if (selType === 'maschine' || selType === 'kb') {
      e.saetze = Number(form.saetze) || 1; e.wdh = String(form.wdh);
      if (form.gewicht) e.gewicht = form.gewicht + (gewUnit === 'stufe' ? ' (Stufe)' : ' kg');
    } else if (selType === 'eigen' || selType === 'prev') {
      e.saetze = Number(form.saetze) || 1; e.wdh = form.wdh + (wdhUnit === 'sek' ? ' sek' : '');
    } else if (selType === 'cardio') {
      e.saetze = 1; e.wdh = form.dauer ? form.dauer + ' min' : '';
      if (form.gewicht) e.gewicht = 'Stufe ' + form.gewicht;
      if (form.hf) e.hf = Number(form.hf);
      if (form.steigung) e.bem = (form.bem ? form.bem + '; ' : '') + 'Steigung ' + form.steigung + '%';
    } else if (selType === 'outdoor') {
      e.saetze = 1; e.wdh = form.distanz ? form.distanz + ' km' : ''; e.dauer = form.dauer || '';
      if (form.hf) e.hf = Number(form.hf);
      if (form.hoehenmeter) e.hoehenmeter = Number(form.hoehenmeter);
      if (form.distanz && form.dauer) e.pace = calcPace(form.distanz, form.dauer);
    } else if (selType === 'swim') {
      e.saetze = 1; e.wdh = form.distanz ? form.distanz + ' m' : ''; e.dauer = form.dauer || '';
      if (form.hf) e.hf = Number(form.hf); e.schwimmort = form.schwimmort;
      if (form.distanz && form.dauer) e.pace = calcPaceSwim(form.distanz, form.dauer);
    }
    if (form.bem && selType !== 'cardio') e.bem = form.bem;
    if (selType === 'cardio' && form.bem && !form.steigung) e.bem = form.bem;
    Object.keys(e).forEach(k => { if (e[k] === '' || e[k] === undefined || e[k] === null) delete e[k]; });
    return e;
  }

  async function saveEntry() { const e = buildEntry(); if (!e) return false; if (editEntry?.id) await db.entries.update(editEntry.id, e); else await db.entries.add(e); return true; }

  async function handleSave() {
    if (!(await saveEntry())) return;
    setSaved(true); setSavedCount(c => c + 1);
    setTimeout(() => { setSaved(false); setForm(f => ({ datum: f.datum, uebung: '', geraet: f.geraet, einseitig: false, saetze: 3, wdh: '', gewicht: '', bem: '', typ: f.typ, dauer: '', distanz: '', hf: '', hoehenmeter: '', steigung: '', schwimmort: f.schwimmort || 'Pool' })); setInfo(null); }, 700);
  }

  async function handleSaveAndFinish() { if (form.uebung.trim()) await saveEntry(); if (onDone) onDone(); }

  function calcPace(d, t) { try { const km = parseFloat(d.replace(',', '.')); const p = t.split(':').map(Number); let m = p.length === 3 ? p[0]*60+p[1]+p[2]/60 : p.length === 2 ? p[0]+p[1]/60 : p[0]; const r = m/km; return Math.floor(r)+':'+String(Math.round((r-Math.floor(r))*60)).padStart(2,'0')+' min/km'; } catch(e) { return ''; } }
  function calcPaceSwim(d, t) { try { const m = parseFloat(d.replace(',', '.')); const p = t.split(':').map(Number); let s = p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : p[0]*60; const r = (s/m)*100; return Math.floor(r/60)+':'+String(Math.round(r%60)).padStart(2,'0')+' min/100m'; } catch(e) { return ''; } }

  const cur = TYPES.find(t => t.id === selType);

  if (!selType) return (
    <div className="px-4 pt-3 pb-4">
      <h2 className="text-lg font-bold mb-4">Was trainierst du?</h2>
      <div className="grid grid-cols-2 gap-2">
        {TYPES.map(t => (
          <button key={t.id} onClick={() => selectType(t)} className="bg-card border border-brd rounded-xl p-4 text-left cursor-pointer">
            <span className="text-xl block mb-0.5">{t.icon}</span>
            <span className="text-sm font-bold text-t-primary">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-3 pb-4">
      {saved && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">Gespeichert ✓</div>}

      {/* Type indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5"><span className="text-lg">{cur?.icon}</span><span className="text-sm font-bold text-acc">{cur?.label}</span></div>
        <button onClick={() => { setSelType(null); setInfo(null); }} className="text-acc text-xs font-semibold bg-transparent border-none cursor-pointer">Typ ändern</button>
      </div>
      {savedCount > 0 && !saved && <div className="text-[10px] text-dim mb-2 text-center">{savedCount} Übung(en) eingetragen</div>}

      {/* Datum + Übung row */}
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '130px 1fr' }}>
        <div className="overflow-hidden">
          <label className={L}>Datum</label>
          <input type="date" value={form.datum} onChange={e => setForm({...form, datum: e.target.value})} className={I} style={{ fontSize: 13, padding: '0 6px' }} />
        </div>
        <div className="overflow-hidden">
          <label className={L}>Übung</label>
          <input value={form.uebung} onChange={e => { setForm({...form, uebung: e.target.value}); setShowSug(true); }} onFocus={() => setShowSug(true)} placeholder="z.B. Beinpresse" className={I} />
        </div>
      </div>
      {showSug && sugs.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{sugs.map(u => <button key={u} onClick={() => selectExercise(u)} className="bg-sf border border-brd rounded px-2 py-1 text-[11px] text-dim cursor-pointer">{u}</button>)}</div>}
      {info && <div className="bg-bg border border-brd rounded-lg p-2 mb-3 text-[11px] text-cblue leading-relaxed">🏋️ {info.d}</div>}

      {/* ===== MASCHINE ===== */}
      {selType === 'maschine' && <>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Gerät</label>
            <button onClick={() => setForm({...form, geraet: form.geraet === 'Kabelzug' ? 'Maschine' : 'Kabelzug'})}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border bg-acc text-bg border-acc`}>
              {form.geraet === 'Kabelzug' ? 'Kabelzug' : 'Maschine'} ⇄
            </button>
          </div>
          <div>
            <label className={L}>Gewicht</label>
            <input value={form.gewicht} onChange={e => setForm({...form, gewicht: e.target.value})} placeholder="22,5" inputMode="decimal" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <button onClick={() => setGewUnit(gewUnit === 'kg' ? 'stufe' : 'kg')}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${gewUnit === 'kg' ? 'bg-acc text-bg border-acc' : 'bg-corange text-bg border-corange'}`}>
              {gewUnit === 'kg' ? 'kg' : 'Stufe'} ⇄
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Sätze</label>
            <div className="h-[42px] flex items-center bg-bg border border-brd rounded-lg">
              <button onClick={() => setForm({...form, saetze: Math.max(1, form.saetze-1)})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
              <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
              <button onClick={() => setForm({...form, saetze: form.saetze+1})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
            </div>
          </div>
          <div>
            <label className={L}>Wdh</label>
            <input value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" type="number" inputMode="numeric" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <button onClick={() => setForm({...form, einseitig: !form.einseitig})}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-[10px] cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
              {form.einseitig ? '1-seitig' : '2-seitig'}
            </button>
          </div>
        </div>
      </>}

      {/* ===== EIGENGEWICHT ===== */}
      {selType === 'eigen' && <>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Sätze</label>
            <div className="h-[42px] flex items-center bg-bg border border-brd rounded-lg">
              <button onClick={() => setForm({...form, saetze: Math.max(1, form.saetze-1)})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
              <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
              <button onClick={() => setForm({...form, saetze: form.saetze+1})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
            </div>
          </div>
          <div>
            <label className={L}>Wert</label>
            <input value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" type="number" inputMode="numeric" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
              {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'} ⇄
            </button>
          </div>
        </div>
        <div className="mb-3">
          <button onClick={() => setForm({...form, einseitig: !form.einseitig})}
            className={`h-[42px] px-4 flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
            {form.einseitig ? '✓ Einseitig' : 'Beidseitig'}
          </button>
        </div>
      </>}

      {/* ===== KETTLEBELL ===== */}
      {selType === 'kb' && <>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Sätze</label>
            <div className="h-[42px] flex items-center bg-bg border border-brd rounded-lg">
              <button onClick={() => setForm({...form, saetze: Math.max(1, form.saetze-1)})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
              <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
              <button onClick={() => setForm({...form, saetze: form.saetze+1})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
            </div>
          </div>
          <div>
            <label className={L}>Wert</label>
            <input value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" type="number" inputMode="numeric" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
              {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'} ⇄
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className={L}>Gewicht (kg)</label>
            <input value={form.gewicht} onChange={e => setForm({...form, gewicht: e.target.value})} placeholder="6" inputMode="decimal" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <button onClick={() => setForm({...form, einseitig: !form.einseitig})}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
              {form.einseitig ? '✓ Einseitig' : 'Beidseitig'}
            </button>
          </div>
        </div>
      </>}

      {/* ===== CARDIO GYM ===== */}
      {selType === 'cardio' && <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Dauer (min)</label><input value={form.dauer} onChange={e => setForm({...form, dauer: e.target.value})} placeholder="25" inputMode="numeric" className={I} /></div>
          <div><label className={L}>Stufe / Widerstand</label><input value={form.gewicht} onChange={e => setForm({...form, gewicht: e.target.value})} placeholder="12" inputMode="text" className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Ø Herzfrequenz</label><input value={form.hf} onChange={e => setForm({...form, hf: e.target.value})} placeholder="148" type="number" inputMode="numeric" className={I} /></div>
          <div><label className={L}>Steigung % (optional)</label><input value={form.steigung} onChange={e => setForm({...form, steigung: e.target.value})} placeholder="1" inputMode="decimal" className={I} /></div>
        </div>
      </>}

      {/* ===== OUTDOOR ===== */}
      {selType === 'outdoor' && <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Distanz (km)</label><input value={form.distanz} onChange={e => setForm({...form, distanz: e.target.value})} placeholder="7,01" inputMode="decimal" className={I} /></div>
          <div><label className={L}>Dauer (H:MM:SS)</label><input value={form.dauer} onChange={e => setForm({...form, dauer: e.target.value})} placeholder="41:50" inputMode="text" className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Ø Herzfrequenz</label><input value={form.hf} onChange={e => setForm({...form, hf: e.target.value})} placeholder="148" type="number" inputMode="numeric" className={I} /></div>
          <div><label className={L}>Höhenmeter</label><input value={form.hoehenmeter} onChange={e => setForm({...form, hoehenmeter: e.target.value})} placeholder="283" type="number" inputMode="numeric" className={I} /></div>
        </div>
        {form.distanz && form.dauer && <div className="bg-acc-g border border-acc rounded-lg p-2 mb-3 text-center"><span className="text-sm text-acc font-bold">Pace: {calcPace(form.distanz, form.dauer) || '...'}</span></div>}
      </>}

      {/* ===== SCHWIMMEN ===== */}
      {selType === 'swim' && <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Distanz (Meter)</label><input value={form.distanz} onChange={e => setForm({...form, distanz: e.target.value})} placeholder="800" inputMode="numeric" className={I} /></div>
          <div><label className={L}>Dauer (MM:SS)</label><input value={form.dauer} onChange={e => setForm({...form, dauer: e.target.value})} placeholder="18:30" inputMode="text" className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Ø Herzfrequenz</label><input value={form.hf} onChange={e => setForm({...form, hf: e.target.value})} placeholder="142" type="number" inputMode="numeric" className={I} /></div>
          <div>
            <label className={L}>Ort</label>
            <button onClick={() => setForm({...form, schwimmort: form.schwimmort === 'Pool' ? 'Freiwasser' : 'Pool'})}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${form.schwimmort === 'Pool' ? 'bg-cyan text-bg border-cyan' : 'bg-cblue text-bg border-cblue'}`}>
              {form.schwimmort || 'Pool'} ⇄
            </button>
          </div>
        </div>
        {form.distanz && form.dauer && <div className="bg-acc-g border border-acc rounded-lg p-2 mb-3 text-center"><span className="text-sm text-acc font-bold">Pace: {calcPaceSwim(form.distanz, form.dauer) || '...'}</span></div>}
      </>}

      {/* ===== PRÄVENTION ===== */}
      {selType === 'prev' && <>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Sätze</label>
            <div className="h-[42px] flex items-center bg-bg border border-brd rounded-lg">
              <button onClick={() => setForm({...form, saetze: Math.max(1, form.saetze-1)})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
              <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
              <button onClick={() => setForm({...form, saetze: form.saetze+1})} className="w-10 h-10 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
            </div>
          </div>
          <div>
            <label className={L}>Wert</label>
            <input value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" type="number" inputMode="numeric" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
              {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'} ⇄
            </button>
          </div>
        </div>
      </>}

      {/* Bemerkungen */}
      <div className="mb-3">
        <label className={L}>Bemerkungen</label>
        <textarea value={form.bem} onChange={e => setForm({...form, bem: e.target.value})} placeholder="Steigerung, Schmerz, Supersatz..."
          className="w-full min-h-[44px] p-2.5 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none resize-y" />
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={handleSave} className="py-3.5 bg-gradient-to-r from-acc to-acc-d text-bg font-bold text-sm rounded-xl border-none cursor-pointer">
          {editEntry?.id ? 'Aktualisieren' : 'Speichern & Weiter'}
        </button>
        <button onClick={handleSaveAndFinish} className="py-3.5 bg-card border border-brd text-t-primary font-semibold text-sm rounded-xl cursor-pointer">
          Speichern & Beenden
        </button>
      </div>
    </div>
  );
}
