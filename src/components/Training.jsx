import { useState, useEffect } from 'react';
import db from '../db';
import { getTyp } from '../utils/categories.jsx';
import { getExerciseInfo, getAllExerciseNames } from '../exercise-library';
import { localDate } from '../utils/streak';

const TYPES = [
  { id: 'maschine', label: 'Maschine', geraet: 'Maschine', icon: '🏋️' },
  { id: 'eigen', label: 'Eigengewicht', geraet: 'Eigengewicht', icon: '🤸' },
  { id: 'kb', label: 'Kettlebell', geraet: 'Kettlebell', icon: '🔔' },
  { id: 'cardio', label: 'Cardio (Gym)', geraet: 'Cardio', icon: '💙' },
  { id: 'outdoor', label: 'Cardio (Outdoor)', geraet: 'Outdoor', icon: '💚' },
  { id: 'swim', label: 'Schwimmen', geraet: 'Schwimmbad', icon: '💧' },
  { id: 'prev', label: 'Prävention', geraet: 'Prävention', icon: '✚' },
];

const today = () => localDate();
const I = "h-[42px] p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none w-full";
const L = "block text-[10px] text-dim font-bold uppercase tracking-wider mb-0.5";

// Input field with right-side unit suffix
function UnitInput({ value, onChange, placeholder, unit, inputMode = 'numeric', type, style, height = 42 }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
        style={{ ...style, height: `${height}px` }}
        className={`p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none w-full ${unit ? 'pr-9' : ''}`}
      />
      {unit && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-dim font-semibold pointer-events-none select-none">
          {unit}
        </span>
      )}
    </div>
  );
}

export default function Training({ editEntry, onDone }) {
  const [selType, setSelType] = useState(null);
  const [form, setForm] = useState({
    datum: today(), uebung: '', geraet: '', einseitig: false,
    saetze: 3, wdh: '', gewicht: '', bem: '', typ: '',
    dauer: '', distanz: '', hf: '', hoehenmeter: '', steigung: '', schwimmort: 'Pool'
  });
  const [gewUnit, setGewUnit] = useState('kg'); // 'kg' | 'stufe'
  const [wdhUnit, setWdhUnit] = useState('wdh'); // 'wdh' | 'sek'
  const [allEx, setAllEx] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    db.entries.toArray().then(a => {
      const fromHistory = a.map(e => e.uebung).filter(Boolean);
      const fromLib = getAllExerciseNames();
      // Library names are canonical; history adds custom names you've used before
      const all = [...new Set([...fromLib, ...fromHistory])]
        .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
      setAllEx(all);
    });
  }, [savedCount]);

  function stripUnit(s, kind) {
    if (!s) return '';
    const str = String(s).trim();
    if (kind === 'gewicht') {
      const sm = str.match(/^Stufe\s*([\d.,]+)$/i);
      if (sm) return sm[1];
      const km = str.match(/^([\d.,]+)\s*kg/i);
      if (km) return km[1];
      const sk = str.match(/^([\d.,]+)\s*\(Stufe\)$/i);
      if (sk) return sk[1];
      return str;
    }
    if (kind === 'wdh') {
      const m = str.match(/^([\d.,]+)\s*(sek|sec|min|km|m)?/i);
      if (m) return m[1];
      return str;
    }
    return str;
  }

  useEffect(() => {
    if (editEntry) {
      if (editEntry.geraet) {
        const t = TYPES.find(x => x.geraet === editEntry.geraet);
        const isStufe = editEntry.gewicht && /Stufe/i.test(editEntry.gewicht);
        setForm({
          ...editEntry,
          gewicht: stripUnit(editEntry.gewicht, 'gewicht'),
          wdh: stripUnit(editEntry.wdh, 'wdh'),
          hf: editEntry.hf || '',
          hoehenmeter: editEntry.hoehenmeter || '',
          dauer: editEntry.dauer || '',
          distanz: editEntry.distanz || '',
          steigung: '',
          schwimmort: editEntry.schwimmort || 'Pool',
        });
        setSelType(t ? t.id : 'maschine');
        if (isStufe) setGewUnit('stufe'); else setGewUnit('kg');
        if (editEntry.wdh && /sek|sec/i.test(editEntry.wdh)) setWdhUnit('sek'); else setWdhUnit('wdh');
      } else if (editEntry.datum) {
        setForm(f => ({ ...f, datum: editEntry.datum }));
        setSelType(null);
      }
    }
  }, [editEntry]);

  function selectType(t) { setSelType(t.id); setForm(f => ({ ...f, geraet: t.geraet, typ: getTyp(t.geraet) })); }

  function selectExercise(name) {
    setForm(f => ({ ...f, uebung: name }));
    setShowSug(false);
    const libInfo = getExerciseInfo(name);
    setInfo(libInfo);
    setShowInfo(false);
    db.entries.where('uebung').equals(name).last().then(l => {
      if (l) {
        // Use last logged values where available
        setForm(f => ({ ...f, einseitig: l.einseitig, saetze: l.saetze || 3 }));
      } else if (libInfo) {
        // No history — adopt library's einseitig hint
        setForm(f => ({ ...f, einseitig: !!libInfo.e }));
      }
    });
  }

  // Sort matching suggestions: prefix-matches first, then substring matches; alphabetical within each group
  const sugs = (() => {
    if (!form.uebung) return allEx.slice(0, 10);
    const q = form.uebung.toLowerCase();
    const starts = [];
    const includes = [];
    for (const u of allEx) {
      const lo = u.toLowerCase();
      if (lo.startsWith(q)) starts.push(u);
      else if (lo.includes(q)) includes.push(u);
    }
    return [...starts, ...includes].slice(0, 10);
  })();

  function buildEntry() {
    if (!form.uebung.trim()) return null;
    const e = { datum: form.datum, uebung: form.uebung, geraet: form.geraet, typ: form.typ || getTyp(form.geraet), einseitig: form.einseitig };

    if (selType === 'maschine' || selType === 'kb') {
      e.saetze = Number(form.saetze) || 1;
      e.wdh = String(form.wdh);
      if (selType === 'kb' && wdhUnit === 'sek') e.wdh = e.wdh + ' sek';
      if (form.gewicht) {
        e.gewicht = gewUnit === 'stufe' ? `Stufe ${form.gewicht}` : `${form.gewicht} kg`;
      }
    } else if (selType === 'eigen' || selType === 'prev') {
      e.saetze = Number(form.saetze) || 1;
      e.wdh = form.wdh ? form.wdh + (wdhUnit === 'sek' ? ' sek' : '') : '';
    } else if (selType === 'cardio') {
      e.saetze = 1;
      e.wdh = form.dauer ? form.dauer + ' min' : '';
      if (form.gewicht) e.gewicht = `Stufe ${form.gewicht}`;
      if (form.hf) e.hf = Number(form.hf);
      if (form.steigung) e.bem = (form.bem ? form.bem + '; ' : '') + 'Steigung ' + form.steigung + '%';
    } else if (selType === 'outdoor') {
      e.saetze = 1;
      e.wdh = form.distanz ? form.distanz + ' km' : '';
      e.dauer = form.dauer || '';
      if (form.hf) e.hf = Number(form.hf);
      if (form.hoehenmeter) e.hoehenmeter = Number(form.hoehenmeter);
      if (form.distanz && form.dauer) e.pace = calcPace(form.distanz, form.dauer);
    } else if (selType === 'swim') {
      e.saetze = 1;
      e.wdh = form.distanz ? form.distanz + ' m' : '';
      e.dauer = form.dauer || '';
      if (form.hf) e.hf = Number(form.hf);
      e.schwimmort = form.schwimmort;
      if (form.distanz && form.dauer) e.pace = calcPaceSwim(form.distanz, form.dauer);
    }

    if (form.bem && selType !== 'cardio') e.bem = form.bem;
    if (selType === 'cardio' && form.bem && !form.steigung) e.bem = form.bem;
    Object.keys(e).forEach(k => { if (e[k] === '' || e[k] === undefined || e[k] === null) delete e[k]; });
    return e;
  }

  async function saveEntry() {
    const e = buildEntry();
    if (!e) return false;
    if (editEntry?.id) await db.entries.update(editEntry.id, e);
    else await db.entries.add(e);
    return true;
  }

  async function handleSave() {
    if (!(await saveEntry())) return;
    setSaved(true); setSavedCount(c => c + 1);
    setTimeout(() => {
      setSaved(false);
      setForm(f => ({ datum: f.datum, uebung: '', geraet: f.geraet, einseitig: false, saetze: 3, wdh: '', gewicht: '', bem: '', typ: f.typ, dauer: '', distanz: '', hf: '', hoehenmeter: '', steigung: '', schwimmort: f.schwimmort || 'Pool' }));
      setInfo(null); setShowInfo(false);
    }, 700);
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

  // Reusable layout pieces

  const SaetzeStepper = ({ height = 42 }) => (
    <div className="flex items-center bg-bg border border-brd rounded-lg" style={{ height: `${height}px` }}>
      <button onClick={() => setForm({...form, saetze: Math.max(1, form.saetze-1)})} className="w-10 h-full text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
      <span className="flex-1 text-center text-base font-bold">{form.saetze}</span>
      <button onClick={() => setForm({...form, saetze: form.saetze+1})} className="w-10 h-full text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
    </div>
  );

  const WdhSekToggle = ({ height = 42 }) => (
    <button onClick={() => setWdhUnit(wdhUnit === 'wdh' ? 'sek' : 'wdh')}
      style={{ height: `${height}px` }}
      className={`w-full flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${wdhUnit === 'sek' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
      {wdhUnit === 'wdh' ? 'Wdh' : 'Sek'} ⇄
    </button>
  );

  const KgStufeToggle = ({ height = 42 }) => (
    <button onClick={() => setGewUnit(gewUnit === 'kg' ? 'stufe' : 'kg')}
      style={{ height: `${height}px` }}
      className={`w-full flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${gewUnit === 'stufe' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
      {gewUnit === 'kg' ? 'kg' : 'Stufe'} ⇄
    </button>
  );

  const EinseitigToggle = ({ height = 42, label }) => (
    <button onClick={() => setForm({...form, einseitig: !form.einseitig})}
      style={{ height: `${height}px` }}
      className={`w-full flex items-center justify-center rounded-lg font-bold text-[10px] cursor-pointer border ${form.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
      {label || (form.einseitig ? '1-seitig' : '2-seitig')}
    </button>
  );

  return (
    <div className="px-4 pt-3 pb-4">
      {saved && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-acc text-bg px-5 py-2 rounded-full text-sm font-bold z-50">Gespeichert ✓</div>}

      {/* Type indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5"><span className="text-lg">{cur?.icon}</span><span className="text-sm font-bold text-acc">{cur?.label}</span></div>
        <button onClick={() => { setSelType(null); setInfo(null); setShowInfo(false); }} className="text-acc text-xs font-semibold bg-transparent border-none cursor-pointer">Typ ändern</button>
      </div>
      {savedCount > 0 && !saved && <div className="text-[10px] text-dim mb-2 text-center">{savedCount} Übung(en) eingetragen</div>}

      {/* Datum + Übung row (more breathing room between fields) */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '130px 1fr' }}>
        <div className="overflow-hidden">
          <label className={L}>Datum</label>
          <input type="date" value={form.datum} onChange={e => setForm({...form, datum: e.target.value})} className={I} style={{ fontSize: 13, padding: '0 6px' }} />
        </div>
        <div className="overflow-hidden">
          <label className={L}>Übung {info && (
            <button onClick={(e) => { e.preventDefault(); setShowInfo(!showInfo); }} className="text-acc bg-transparent border-none cursor-pointer p-0 ml-1 text-xs align-middle" title="Ausführung">🏋️</button>
          )}</label>
          <input value={form.uebung} onChange={e => { setForm({...form, uebung: e.target.value}); setShowSug(true); setInfo(getExerciseInfo(e.target.value)); }} onFocus={() => setShowSug(true)} placeholder="z.B. Beinpresse" className={I} />
        </div>
      </div>
      {showSug && sugs.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{sugs.map(u => <button key={u} onClick={() => selectExercise(u)} className="bg-sf border border-brd rounded px-2 py-1 text-[11px] text-dim cursor-pointer">{u}</button>)}</div>}
      {showInfo && info && <div className="bg-bg border border-brd rounded-lg p-2.5 mb-3 text-[11px] text-cblue leading-relaxed">{info.d}</div>}

      {/* ===== MASCHINE ===== */}
      {selType === 'maschine' && <>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Gerät</label>
            <button onClick={() => setForm({...form, geraet: form.geraet === 'Kabelzug' ? 'Maschine' : 'Kabelzug'})}
              className={`w-full h-[42px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${form.geraet === 'Kabelzug' ? 'bg-corange text-bg border-corange' : 'bg-acc text-bg border-acc'}`}>
              {form.geraet === 'Kabelzug' ? 'Kabelzug' : 'Maschine'} ⇄
            </button>
          </div>
          <div>
            <label className={L}>Wert</label>
            <UnitInput value={form.gewicht} onChange={e => setForm({...form, gewicht: e.target.value})} placeholder="22,5" unit={gewUnit === 'stufe' ? 'St.' : 'kg'} inputMode="decimal" />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <KgStufeToggle />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Sätze</label>
            <SaetzeStepper />
          </div>
          <div>
            <label className={L}>Wdh</label>
            <input value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" type="number" inputMode="numeric" className={I} />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <EinseitigToggle />
          </div>
        </div>
      </>}

      {/* ===== EIGENGEWICHT ===== */}
      {selType === 'eigen' && <>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="col-span-2">
            <label className={L}>Sätze</label>
            <SaetzeStepper />
          </div>
          <div>
            <label className={L}>Wert</label>
            <UnitInput value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" unit={wdhUnit === 'sek' ? 'Sek' : 'Wdh'} inputMode="numeric" />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <WdhSekToggle />
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
            <SaetzeStepper />
          </div>
          <div>
            <label className={L}>Wert</label>
            <UnitInput value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" unit={wdhUnit === 'sek' ? 'Sek' : 'Wdh'} inputMode="numeric" />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <WdhSekToggle />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className={L}>Gewicht</label>
            <UnitInput value={form.gewicht} onChange={e => setForm({...form, gewicht: e.target.value})} placeholder="6" unit="kg" inputMode="decimal" />
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
          <div><label className={L}>Dauer</label><UnitInput value={form.dauer} onChange={e => setForm({...form, dauer: e.target.value})} placeholder="25" unit="min" inputMode="numeric" /></div>
          <div><label className={L}>Stufe / Widerstand</label><input value={form.gewicht} onChange={e => setForm({...form, gewicht: e.target.value})} placeholder="12" inputMode="text" className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Ø HF</label><UnitInput value={form.hf} onChange={e => setForm({...form, hf: e.target.value})} placeholder="148" unit="bpm" inputMode="numeric" type="number" /></div>
          <div><label className={L}>Steigung</label><UnitInput value={form.steigung} onChange={e => setForm({...form, steigung: e.target.value})} placeholder="1" unit="%" inputMode="decimal" /></div>
        </div>
      </>}

      {/* ===== OUTDOOR ===== */}
      {selType === 'outdoor' && <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Distanz</label><UnitInput value={form.distanz} onChange={e => setForm({...form, distanz: e.target.value})} placeholder="7,01" unit="km" inputMode="decimal" /></div>
          <div><label className={L}>Dauer (H:MM:SS)</label><input value={form.dauer} onChange={e => setForm({...form, dauer: e.target.value})} placeholder="41:50" inputMode="text" className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Ø HF</label><UnitInput value={form.hf} onChange={e => setForm({...form, hf: e.target.value})} placeholder="148" unit="bpm" inputMode="numeric" type="number" /></div>
          <div><label className={L}>Höhenmeter</label><UnitInput value={form.hoehenmeter} onChange={e => setForm({...form, hoehenmeter: e.target.value})} placeholder="283" unit="hm" inputMode="numeric" type="number" /></div>
        </div>
        {form.distanz && form.dauer && <div className="bg-acc-g border border-acc rounded-lg p-2 mb-3 text-center"><span className="text-sm text-acc font-bold">Pace: {calcPace(form.distanz, form.dauer) || '...'}</span></div>}
      </>}

      {/* ===== SCHWIMMEN ===== */}
      {selType === 'swim' && <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Distanz</label><UnitInput value={form.distanz} onChange={e => setForm({...form, distanz: e.target.value})} placeholder="800" unit="m" inputMode="numeric" /></div>
          <div><label className={L}>Dauer (MM:SS)</label><input value={form.dauer} onChange={e => setForm({...form, dauer: e.target.value})} placeholder="18:30" inputMode="text" className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className={L}>Ø HF</label><UnitInput value={form.hf} onChange={e => setForm({...form, hf: e.target.value})} placeholder="142" unit="bpm" inputMode="numeric" type="number" /></div>
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
            <SaetzeStepper />
          </div>
          <div>
            <label className={L}>Wert</label>
            <UnitInput value={form.wdh} onChange={e => setForm({...form, wdh: e.target.value})} placeholder="12" unit={wdhUnit === 'sek' ? 'Sek' : 'Wdh'} inputMode="numeric" />
          </div>
          <div>
            <label className={L}>&nbsp;</label>
            <WdhSekToggle />
          </div>
        </div>
      </>}

      {/* Bemerkungen */}
      <div className="mb-3">
        <label className={L}>Bemerkungen</label>
        <textarea value={form.bem} onChange={e => setForm({...form, bem: e.target.value})} placeholder="Steigerung, Schmerz, …"
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
