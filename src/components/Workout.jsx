import { useState } from 'react';
import db from '../db';
import { getTyp } from '../utils/categories.jsx';
import { localDate } from '../utils/streak';
import { getExerciseInfo } from '../exercise-library';

const MODI = {
  normal: { label: 'Normales Training', desc: 'Übung für Übung abarbeiten' },
  amrap:  { label: 'AMRAP',  desc: 'So viele Runden wie möglich in der vorgegebenen Zeit' },
  hiit:   { label: 'HIIT',   desc: 'Hochintensive Intervalle mit kurzen Pausen' },
  tabata: { label: 'Tabata', desc: '20 Sek. Belastung, 10 Sek. Pause, 8 Runden' },
  emom:   { label: 'EMOM',   desc: 'Every Minute On the Minute – Start jede Minute neu' },
};

// --- Field type detection (mirrors Training.jsx form types) ---
function getFieldType(geraet) {
  if (['Cardio', 'Laufband'].includes(geraet)) return 'cardio';
  if (geraet === 'Outdoor') return 'outdoor';
  if (geraet === 'Schwimmbad') return 'swim';
  if (geraet === 'Kettlebell') return 'kettlebell';
  if (['Eigengewicht', 'Core', 'Boden', 'Gewichtsball'].includes(geraet)) return 'eigen';
  if (['Prävention', 'Praevention', 'Dehnung'].includes(geraet)) return 'prev';
  return 'maschine'; // Maschine, Kabelzug, Kabel, default
}

function calcPace(d, t) {
  try {
    const km = parseFloat(String(d).replace(',', '.'));
    const p = String(t).split(':').map(Number);
    let m = p.length === 3 ? p[0]*60+p[1]+p[2]/60 : p.length === 2 ? p[0]+p[1]/60 : p[0];
    const r = m/km;
    return Math.floor(r) + ':' + String(Math.round((r-Math.floor(r))*60)).padStart(2,'0') + ' min/km';
  } catch(e) { return ''; }
}
function calcPaceSwim(d, t) {
  try {
    const m = parseFloat(String(d).replace(',', '.'));
    const p = String(t).split(':').map(Number);
    let s = p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : p[0]*60;
    const r = (s/m)*100;
    return Math.floor(r/60) + ':' + String(Math.round(r%60)).padStart(2,'0') + ' min/100m';
  } catch(e) { return ''; }
}

// Strip a trailing unit like "kg", "m", "km", "min", "sek", "Stufe" from a value.
// Returns { value: "25", unit: "kg" } for "25 kg".
function splitValueUnit(s) {
  if (!s) return { value: '', unit: '' };
  const str = String(s).trim();
  // "Stufe 12" -> {12, stufe}
  let m = str.match(/^Stufe\s*([\d.,]+)$/i);
  if (m) return { value: m[1].replace('.', ','), unit: 'stufe' };
  // "25 kg" / "25kg"
  m = str.match(/^([\d.,]+)\s*kg$/i);
  if (m) return { value: m[1].replace('.', ','), unit: 'kg' };
  // "4 km" / "800 m" / "30 min" / "60 sek"
  m = str.match(/^([\d.,]+)\s*(km|m|min|sek|sec)$/i);
  if (m) return { value: m[1].replace('.', ','), unit: m[2].toLowerCase() };
  // bare number
  if (/^[\d.,]+$/.test(str)) return { value: str.replace('.', ','), unit: '' };
  return { value: str, unit: '' };
}

function parsePlan(text) {
  const lines = text.trim().split('\n');
  let modus = 'normal';
  let modusDetail = '';
  const exercises = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'MAXFIT-PLAN') continue;

    if (trimmed.startsWith('MODUS:')) {
      const parts = trimmed.replace('MODUS:', '').trim().split(' ');
      const m = parts[0].toLowerCase();
      if (MODI[m]) modus = m;
      modusDetail = parts.slice(1).join(' ');
      continue;
    }

    const parts = trimmed.split('|').map(s => s.trim());
    if (parts.length < 2) continue;

    const ex = {
      name: parts[0],
      geraet: parts[1],
      done: false,
      saetze: 3,
      wdh: '',
      gewicht: '',      // numeric value only (no unit)
      gewUnit: 'kg',    // 'kg' | 'stufe'
      einseitig: false,
      info: '',
      // Cardio / Outdoor / Swim
      dauer: '',        // numeric (cardio: minutes; outdoor/swim: H:MM:SS or MM:SS)
      distanz: '',      // numeric (outdoor: km; swim: m)
      hf: '',
      hoehenmeter: '',
      steigung: '',
      schwimmort: 'Pool',
      bem: '',
    };

    const ftype = getFieldType(ex.geraet);

    for (let i = 2; i < parts.length; i++) {
      const p = parts[i];
      if (p.toLowerCase() === 'einseitig') { ex.einseitig = true; continue; }
      if (p.startsWith('INFO:')) { ex.info = p.replace('INFO:', '').trim(); continue; }

      // "3x12" or "3x60 sek"
      const sxw = p.match(/^(\d+)x(.+)$/);
      if (sxw) {
        ex.saetze = parseInt(sxw[1]);
        // Strip "sek/min" from rep value too
        const rest = sxw[2].trim();
        const restMatch = rest.match(/^(\d+)\s*(sek|sec|min)?$/i);
        ex.wdh = restMatch ? restMatch[1] : rest;
        continue;
      }

      // Stufe
      if (/^Stufe\s/i.test(p)) {
        const sm = p.match(/^Stufe\s*([\d.,]+)$/i);
        if (sm) { ex.gewicht = sm[1].replace('.', ','); ex.gewUnit = 'stufe'; continue; }
      }

      // Distance km (outdoor)
      if (/^[\d.,]+\s*km$/i.test(p)) {
        ex.distanz = p.replace(/\s*km$/i, '').replace('.', ',').trim();
        continue;
      }
      // Distance meters (swim)
      if (ftype === 'swim' && /^[\d.,]+\s*m$/i.test(p)) {
        ex.distanz = p.replace(/\s*m$/i, '').replace('.', ',').trim();
        continue;
      }
      // Duration "30 min" / "60 sek"
      if (/^[\d.,]+\s*(min|sek|sec)$/i.test(p)) {
        const num = p.replace(/\s*(min|sek|sec)$/i, '').replace('.', ',').trim();
        if (['cardio', 'outdoor', 'swim'].includes(ftype)) {
          ex.dauer = num;
        } else if (!ex.wdh) {
          ex.wdh = num; ex.saetze = 1;
        }
        continue;
      }
      // H:MM:SS or MM:SS (duration)
      if (/^\d+:\d+(:\d+)?$/.test(p) && ['cardio', 'outdoor', 'swim'].includes(ftype)) {
        ex.dauer = p; continue;
      }
      // HF
      const hfm = p.match(/^HF\s*(\d+)$/i);
      if (hfm) { ex.hf = hfm[1]; continue; }
      // Hm
      const hmm = p.match(/^(\d+)\s*hm$/i);
      if (hmm) { ex.hoehenmeter = hmm[1]; continue; }
      // Schwimmort
      if (/^pool$/i.test(p)) { ex.schwimmort = 'Pool'; continue; }
      if (/^freiwasser$/i.test(p)) { ex.schwimmort = 'Freiwasser'; continue; }
      // Steigung
      const stm = p.match(/^Steigung\s*([\d.,]+)\s*%?$/i);
      if (stm) { ex.steigung = stm[1].replace('.', ','); continue; }
      // Weight "25 kg"
      if (/^[\d.,]+\s*kg$/i.test(p)) {
        ex.gewicht = p.replace(/\s*kg$/i, '').replace('.', ',').trim();
        ex.gewUnit = 'kg';
        continue;
      }
      // Pure number
      if (/^[\d.,]+$/.test(p) && !ex.wdh) { ex.wdh = p; ex.saetze = 1; continue; }

      // Fallback
      if (!ex.wdh) ex.wdh = p;
      else if (!ex.bem) ex.bem = p;
    }
    exercises.push(ex);
  }
  return { modus, modusDetail, exercises };
}

// --- UI helpers ---
const I_BASE = "h-[40px] p-2 bg-bg border border-brd rounded-lg text-t-primary text-sm outline-none w-full";
const L = "block text-[10px] text-dim font-bold uppercase tracking-wider mb-0.5";

// Input field with right-side unit suffix
function UnitInput({ value, onChange, placeholder, unit, inputMode = 'numeric' }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`${I_BASE} ${unit ? 'pr-9' : ''}`}
      />
      {unit && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-dim font-semibold pointer-events-none select-none">
          {unit}
        </span>
      )}
    </div>
  );
}

export default function Workout({ onDone }) {
  const [step, setStep] = useState('import'); // import | workout
  const [planText, setPlanText] = useState('');
  const [plan, setPlan] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [rounds, setRounds] = useState(0);
  const [sessionNote, setSessionNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [showInfoIdx, setShowInfoIdx] = useState(null); // which exercise's info is open

  function handleImport() {
    if (!planText.trim()) return;
    const parsed = parsePlan(planText);
    if (parsed.exercises.length === 0) return;
    setPlan(parsed);
    setExercises(parsed.exercises);
    setStep('workout');
  }

  function updateEx(idx, field, value) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function toggleDone(idx) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, done: !e.done } : e));
  }

  function buildEntry(ex, datum, isCircuit, plan) {
    const ftype = getFieldType(ex.geraet);
    const entry = {
      datum,
      uebung: ex.name,
      geraet: ex.geraet,
      typ: getTyp(ex.geraet),
      einseitig: !!ex.einseitig,
      bem: ex.bem || '',
    };

    if (isCircuit) {
      entry.saetze = rounds || 1;
      entry.wdh = ex.wdh || '';
      if (ex.gewicht) {
        entry.gewicht = ex.gewUnit === 'stufe' ? `Stufe ${ex.gewicht}` : `${ex.gewicht} kg`;
      }
      const circuitTag = `${MODI[plan.modus]?.label || plan.modus}${plan.modusDetail ? ' ' + plan.modusDetail : ''}${rounds ? ' · ' + rounds + ' Runden' : ''}`;
      entry.bem = entry.bem ? entry.bem + '; ' + circuitTag : circuitTag;
    } else if (ftype === 'maschine' || ftype === 'kettlebell') {
      entry.saetze = Number(ex.saetze) || 1;
      entry.wdh = String(ex.wdh || '');
      if (ex.gewicht) {
        entry.gewicht = ex.gewUnit === 'stufe' ? `Stufe ${ex.gewicht}` : `${ex.gewicht} kg`;
      }
    } else if (ftype === 'eigen' || ftype === 'prev') {
      entry.saetze = Number(ex.saetze) || 1;
      entry.wdh = String(ex.wdh || '');
    } else if (ftype === 'cardio') {
      entry.saetze = 1;
      entry.wdh = ex.dauer ? `${ex.dauer} min` : (ex.wdh || '');
      if (ex.gewicht) {
        entry.gewicht = ex.gewUnit === 'stufe' ? `Stufe ${ex.gewicht}` : ex.gewicht;
      }
      if (ex.hf) entry.hf = Number(ex.hf);
      if (ex.steigung) entry.bem = (entry.bem ? entry.bem + '; ' : '') + 'Steigung ' + ex.steigung + '%';
    } else if (ftype === 'outdoor') {
      entry.saetze = 1;
      entry.wdh = ex.distanz ? `${ex.distanz} km` : (ex.wdh || '');
      if (ex.dauer) entry.dauer = ex.dauer;
      if (ex.hf) entry.hf = Number(ex.hf);
      if (ex.hoehenmeter) entry.hoehenmeter = Number(ex.hoehenmeter);
      if (ex.distanz && ex.dauer) entry.pace = calcPace(ex.distanz, ex.dauer);
    } else if (ftype === 'swim') {
      entry.saetze = 1;
      entry.wdh = ex.distanz ? `${ex.distanz} m` : (ex.wdh || '');
      if (ex.dauer) entry.dauer = ex.dauer;
      if (ex.hf) entry.hf = Number(ex.hf);
      entry.schwimmort = ex.schwimmort || 'Pool';
      if (ex.distanz && ex.dauer) entry.pace = calcPaceSwim(ex.distanz, ex.dauer);
    }

    Object.keys(entry).forEach(k => { if (entry[k] === '' || entry[k] === undefined || entry[k] === null) delete entry[k]; });
    return entry;
  }

  async function finishWorkout() {
    const datum = localDate();
    const isCircuit = plan.modus !== 'normal';
    const toSave = exercises.filter(e => e.done);

    for (const ex of toSave) {
      await db.entries.add(buildEntry(ex, datum, isCircuit, plan));
    }

    if (sessionNote.trim()) {
      await db.sessionNotes.add({ datum, note: sessionNote.trim() });
    }

    setSaved(true);
    setTimeout(() => { if (onDone) onDone(); }, 1500);
  }

  const doneCount = exercises.filter(e => e.done).length;
  const isCircuit = plan?.modus && plan.modus !== 'normal';

  // === Import step ===
  if (step === 'import') {
    return (
      <div className="px-5 pt-4 pb-4">
        <h2 className="text-xl font-bold mb-3">Workout importieren</h2>
        <p className="text-sm text-dim mb-4">Trainingsplan von Claude kopieren und hier einfügen:</p>
        <textarea value={planText} onChange={e => setPlanText(e.target.value)}
          placeholder={"MAXFIT-PLAN\nMODUS: AMRAP 20min\n\nKB Swing | Kettlebell | 15\nBurpees | Eigengewicht | 10\n\noder:\n\nMAXFIT-PLAN\nBrustpresse | Maschine | 3x12 | 25 kg | Einseitig\nLatzug | Maschine | 3x12 | 37,5 kg"}
          className="w-full min-h-[180px] p-3.5 bg-bg border border-brd rounded-xl text-t-primary text-sm font-mono outline-none resize-y" />
        <button onClick={handleImport}
          className="w-full mt-4 py-4 bg-gradient-to-r from-acc to-acc-d text-bg font-bold text-base rounded-2xl border-none cursor-pointer">
          Workout starten
        </button>
      </div>
    );
  }

  // === Saved confirmation ===
  if (saved) {
    return (
      <div className="px-5 pt-8 pb-4 text-center">
        <div className="text-5xl mb-4">💪</div>
        <h2 className="text-2xl font-bold text-acc mb-2">Workout gespeichert!</h2>
        <p className="text-dim">{doneCount} Übung(en) erfasst</p>
      </div>
    );
  }

  // === Active workout ===
  return (
    <div className="px-5 pt-4 pb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Workout</h2>
        <span className="text-sm text-dim font-semibold">{doneCount}/{exercises.length}</span>
      </div>

      {/* Modus banner */}
      {isCircuit && (
        <div className="bg-corange/15 border border-corange rounded-2xl p-4 mb-4">
          <div className="text-lg font-bold text-corange">🔥 {MODI[plan.modus]?.label || plan.modus} {plan.modusDetail && `· ${plan.modusDetail}`}</div>
          <div className="text-sm text-dim mt-1">{MODI[plan.modus]?.desc}</div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm text-t-primary font-semibold">Runden:</span>
            <button onClick={() => setRounds(Math.max(0, rounds - 1))} className="w-10 h-10 bg-bg border border-brd rounded-xl text-t-primary text-lg font-bold cursor-pointer">−</button>
            <span className="text-2xl font-extrabold text-corange w-10 text-center">{rounds}</span>
            <button onClick={() => setRounds(rounds + 1)} className="w-10 h-10 bg-bg border border-brd rounded-xl text-t-primary text-lg font-bold cursor-pointer">+</button>
          </div>
        </div>
      )}

      {/* Exercise list — every card is independently editable */}
      {exercises.map((ex, idx) => {
        const ftype = getFieldType(ex.geraet);
        // Description either from plan-INFO or fallback to library
        const libInfo = getExerciseInfo(ex.name);
        const description = ex.info || libInfo?.d;
        const infoOpen = showInfoIdx === idx;
        return (
          <div key={idx} className={`bg-card rounded-2xl p-4 mb-2 border transition-all ${ex.done ? 'border-acc/40' : 'border-brd'}`}>
            {/* Header row */}
            <div className="flex items-center gap-3">
              <button onClick={() => toggleDone(idx)}
                title={ex.done ? 'Haken entfernen, um zu bearbeiten' : 'Als erledigt markieren'}
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center cursor-pointer flex-shrink-0 ${ex.done ? 'bg-acc border-acc text-bg' : 'bg-transparent border-brd text-transparent'}`}>
                {ex.done ? '✓' : ''}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`font-bold text-base truncate ${ex.done ? 'opacity-70' : ''}`}>{ex.name}</div>
                  {description && (
                    <button onClick={() => setShowInfoIdx(infoOpen ? null : idx)}
                      title="Ausführung anzeigen"
                      className="text-base bg-transparent border-none cursor-pointer p-0 leading-none flex-shrink-0">🏋️</button>
                  )}
                </div>
                <div className="text-sm text-dim">
                  {ex.geraet}
                  {ex.einseitig && ' · Einseitig'}
                </div>
              </div>
            </div>

            {/* Info on toggle */}
            {infoOpen && description && (
              <div className="bg-bg border border-brd rounded-lg p-2.5 mt-2 text-xs text-cblue leading-relaxed">{description}</div>
            )}

            {/* === Edit fields (hidden when done — uncheck to edit again) === */}
            {!ex.done && !isCircuit && (
              <div className="mt-3 space-y-2">

                {/* MASCHINE */}
                {ftype === 'maschine' && <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={L}>Sätze</label>
                      <div className="h-[40px] flex items-center bg-bg border border-brd rounded-lg">
                        <button onClick={() => updateEx(idx, 'saetze', Math.max(1, (Number(ex.saetze)||1) - 1))} className="w-9 h-9 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
                        <span className="flex-1 text-center text-sm font-bold">{ex.saetze}</span>
                        <button onClick={() => updateEx(idx, 'saetze', (Number(ex.saetze)||1) + 1)} className="w-9 h-9 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
                      </div>
                    </div>
                    <div>
                      <label className={L}>Wdh</label>
                      <input value={ex.wdh} onChange={e => updateEx(idx, 'wdh', e.target.value)} placeholder="12" inputMode="numeric" className={I_BASE} />
                    </div>
                    <div>
                      <label className={L}>Gewicht</label>
                      <UnitInput value={ex.gewicht} onChange={e => updateEx(idx, 'gewicht', e.target.value)} placeholder="22,5" unit={ex.gewUnit === 'stufe' ? 'Stufe' : 'kg'} inputMode="decimal" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateEx(idx, 'gewUnit', ex.gewUnit === 'kg' ? 'stufe' : 'kg')}
                      className={`h-[36px] px-3 rounded-lg font-bold text-xs cursor-pointer border ${ex.gewUnit === 'stufe' ? 'bg-corange text-bg border-corange' : 'bg-bg text-dim border-brd'}`}>
                      {ex.gewUnit === 'stufe' ? 'Stufe' : 'kg'} ⇄
                    </button>
                    <button onClick={() => updateEx(idx, 'einseitig', !ex.einseitig)}
                      className={`h-[36px] px-3 rounded-lg font-bold text-xs cursor-pointer border ${ex.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
                      {ex.einseitig ? '✓ Einseitig' : 'Beidseitig'}
                    </button>
                  </div>
                </>}

                {/* KETTLEBELL */}
                {ftype === 'kettlebell' && <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={L}>Sätze</label>
                      <div className="h-[40px] flex items-center bg-bg border border-brd rounded-lg">
                        <button onClick={() => updateEx(idx, 'saetze', Math.max(1, (Number(ex.saetze)||1) - 1))} className="w-9 h-9 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
                        <span className="flex-1 text-center text-sm font-bold">{ex.saetze}</span>
                        <button onClick={() => updateEx(idx, 'saetze', (Number(ex.saetze)||1) + 1)} className="w-9 h-9 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
                      </div>
                    </div>
                    <div>
                      <label className={L}>Wdh</label>
                      <input value={ex.wdh} onChange={e => updateEx(idx, 'wdh', e.target.value)} placeholder="12" inputMode="numeric" className={I_BASE} />
                    </div>
                    <div>
                      <label className={L}>Gewicht</label>
                      <UnitInput value={ex.gewicht} onChange={e => updateEx(idx, 'gewicht', e.target.value)} placeholder="6" unit="kg" inputMode="decimal" />
                    </div>
                  </div>
                  <button onClick={() => updateEx(idx, 'einseitig', !ex.einseitig)}
                    className={`h-[36px] px-4 rounded-lg font-bold text-xs cursor-pointer border ${ex.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
                    {ex.einseitig ? '✓ Einseitig' : 'Beidseitig'}
                  </button>
                </>}

                {/* EIGENGEWICHT / PRÄVENTION */}
                {(ftype === 'eigen' || ftype === 'prev') && <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Sätze</label>
                      <div className="h-[40px] flex items-center bg-bg border border-brd rounded-lg">
                        <button onClick={() => updateEx(idx, 'saetze', Math.max(1, (Number(ex.saetze)||1) - 1))} className="w-9 h-9 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">−</button>
                        <span className="flex-1 text-center text-sm font-bold">{ex.saetze}</span>
                        <button onClick={() => updateEx(idx, 'saetze', (Number(ex.saetze)||1) + 1)} className="w-9 h-9 text-t-primary text-lg font-bold cursor-pointer bg-transparent border-none">+</button>
                      </div>
                    </div>
                    <div>
                      <label className={L}>Wdh / Sek</label>
                      <input value={ex.wdh} onChange={e => updateEx(idx, 'wdh', e.target.value)} placeholder="12 oder 60 sek" className={I_BASE} />
                    </div>
                  </div>
                  {ftype === 'eigen' && (
                    <button onClick={() => updateEx(idx, 'einseitig', !ex.einseitig)}
                      className={`h-[36px] px-4 rounded-lg font-bold text-xs cursor-pointer border ${ex.einseitig ? 'bg-gold text-bg border-gold' : 'bg-bg text-dim border-brd'}`}>
                      {ex.einseitig ? '✓ Einseitig' : 'Beidseitig'}
                    </button>
                  )}
                </>}

                {/* CARDIO GYM */}
                {ftype === 'cardio' && <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Dauer</label>
                      <UnitInput value={ex.dauer} onChange={e => updateEx(idx, 'dauer', e.target.value)} placeholder="25" unit="min" inputMode="numeric" />
                    </div>
                    <div>
                      <label className={L}>Stufe / Widerstand</label>
                      <UnitInput value={ex.gewicht} onChange={e => updateEx(idx, 'gewicht', e.target.value)} placeholder="12" unit="" inputMode="text" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Ø HF</label>
                      <UnitInput value={ex.hf} onChange={e => updateEx(idx, 'hf', e.target.value)} placeholder="148" unit="bpm" inputMode="numeric" />
                    </div>
                    <div>
                      <label className={L}>Steigung</label>
                      <UnitInput value={ex.steigung} onChange={e => updateEx(idx, 'steigung', e.target.value)} placeholder="1" unit="%" inputMode="decimal" />
                    </div>
                  </div>
                </>}

                {/* OUTDOOR */}
                {ftype === 'outdoor' && <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Distanz</label>
                      <UnitInput value={ex.distanz} onChange={e => updateEx(idx, 'distanz', e.target.value)} placeholder="7,01" unit="km" inputMode="decimal" />
                    </div>
                    <div>
                      <label className={L}>Dauer (H:MM:SS)</label>
                      <input value={ex.dauer} onChange={e => updateEx(idx, 'dauer', e.target.value)} placeholder="41:50" className={I_BASE} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Ø HF</label>
                      <UnitInput value={ex.hf} onChange={e => updateEx(idx, 'hf', e.target.value)} placeholder="148" unit="bpm" inputMode="numeric" />
                    </div>
                    <div>
                      <label className={L}>Höhenmeter</label>
                      <UnitInput value={ex.hoehenmeter} onChange={e => updateEx(idx, 'hoehenmeter', e.target.value)} placeholder="283" unit="hm" inputMode="numeric" />
                    </div>
                  </div>
                  {ex.distanz && ex.dauer && (
                    <div className="bg-acc-g border border-acc rounded-lg p-2 text-center">
                      <span className="text-sm text-acc font-bold">Pace: {calcPace(ex.distanz, ex.dauer) || '...'}</span>
                    </div>
                  )}
                </>}

                {/* SCHWIMMEN */}
                {ftype === 'swim' && <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Distanz</label>
                      <UnitInput value={ex.distanz} onChange={e => updateEx(idx, 'distanz', e.target.value)} placeholder="800" unit="m" inputMode="numeric" />
                    </div>
                    <div>
                      <label className={L}>Dauer (MM:SS)</label>
                      <input value={ex.dauer} onChange={e => updateEx(idx, 'dauer', e.target.value)} placeholder="18:30" className={I_BASE} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={L}>Ø HF</label>
                      <UnitInput value={ex.hf} onChange={e => updateEx(idx, 'hf', e.target.value)} placeholder="142" unit="bpm" inputMode="numeric" />
                    </div>
                    <div>
                      <label className={L}>Ort</label>
                      <button onClick={() => updateEx(idx, 'schwimmort', ex.schwimmort === 'Pool' ? 'Freiwasser' : 'Pool')}
                        className={`w-full h-[40px] flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer border ${ex.schwimmort === 'Pool' ? 'bg-cyan text-bg border-cyan' : 'bg-cblue text-bg border-cblue'}`}>
                        {ex.schwimmort || 'Pool'} ⇄
                      </button>
                    </div>
                  </div>
                  {ex.distanz && ex.dauer && (
                    <div className="bg-acc-g border border-acc rounded-lg p-2 text-center">
                      <span className="text-sm text-acc font-bold">Pace: {calcPaceSwim(ex.distanz, ex.dauer) || '...'}</span>
                    </div>
                  )}
                </>}

                {/* Bemerkung (alle Typen) */}
                <div>
                  <label className={L}>Bemerkung</label>
                  <input value={ex.bem} onChange={e => updateEx(idx, 'bem', e.target.value)} placeholder="Optional…" className={I_BASE} />
                </div>
              </div>
            )}

            {/* AMRAP/HIIT/Tabata: nur Wdh + Gewicht editierbar */}
            {!ex.done && isCircuit && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className={L}>Wdh / Runde</label>
                  <input value={ex.wdh} onChange={e => updateEx(idx, 'wdh', e.target.value)} placeholder="15" className={I_BASE} />
                </div>
                <div>
                  <label className={L}>Gewicht (optional)</label>
                  <UnitInput value={ex.gewicht} onChange={e => updateEx(idx, 'gewicht', e.target.value)} placeholder="12" unit="kg" inputMode="decimal" />
                </div>
              </div>
            )}

            {/* Done summary */}
            {ex.done && (
              <div className="text-xs text-dim mt-2 ml-12">
                {!isCircuit && ex.saetze > 0 && `${ex.saetze}× `}
                {ex.wdh && `${ex.wdh}`}
                {ex.dauer && ` · ${ex.dauer}${ftype === 'cardio' ? ' min' : ''}`}
                {ex.distanz && ` · ${ex.distanz}${ftype === 'swim' ? ' m' : ' km'}`}
                {ex.gewicht && ` · ${ex.gewicht}${ex.gewUnit === 'kg' ? ' kg' : (ex.gewUnit === 'stufe' ? ' (Stufe)' : '')}`}
                {ex.hf && ` · ♥ ${ex.hf}`}
                {ex.hoehenmeter && ` · ${ex.hoehenmeter} hm`}
                {ex.bem && ` · ${ex.bem}`}
              </div>
            )}
          </div>
        );
      })}

      {/* Session note */}
      <div className="mt-4 mb-4">
        <label className="block text-xs text-dim font-bold uppercase tracking-wider mb-1">Session-Notiz (optional)</label>
        <textarea value={sessionNote} onChange={e => setSessionNote(e.target.value)}
          placeholder="Energie, Schlaf, Gefühl..."
          className="w-full min-h-[48px] p-3 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none resize-y" />
      </div>

      {/* Finish — always active */}
      {doneCount === 0 ? (
        <button onClick={() => onDone && onDone()}
          className="w-full py-4 font-bold text-base rounded-2xl border border-brd bg-card text-dim cursor-pointer">
          Abbrechen (nichts speichern)
        </button>
      ) : doneCount === exercises.length ? (
        <button onClick={finishWorkout}
          className="w-full py-4 font-bold text-base rounded-2xl border-none bg-gradient-to-r from-acc to-acc-d text-bg cursor-pointer">
          ✓ Workout abschließen ({doneCount} Übungen)
        </button>
      ) : !confirmEarly ? (
        <button onClick={() => setConfirmEarly(true)}
          className="w-full py-4 font-bold text-base rounded-2xl border-2 border-corange bg-card text-corange cursor-pointer">
          Workout früher beenden ({doneCount}/{exercises.length})
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-dim text-center">
            {exercises.length - doneCount} Übung(en) ohne Haken – diese werden <b>nicht gespeichert</b>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmEarly(false)}
              className="py-3 font-semibold text-sm rounded-xl border border-brd bg-card text-t-primary cursor-pointer">
              Zurück
            </button>
            <button onClick={finishWorkout}
              className="py-3 font-bold text-sm rounded-xl border-none bg-gradient-to-r from-acc to-acc-d text-bg cursor-pointer">
              Ja, jetzt beenden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
