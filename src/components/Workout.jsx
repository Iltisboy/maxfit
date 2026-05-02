import { useState } from 'react';
import db from '../db';
import { getTyp } from '../utils/categories.jsx';

const MODI = {
  normal: { label: 'Normales Training', desc: 'Übung für Übung abarbeiten' },
  amrap: { label: 'AMRAP', desc: 'So viele Runden wie möglich in der vorgegebenen Zeit' },
  hiit: { label: 'HIIT', desc: 'Hochintensive Intervalle mit kurzen Pausen' },
  tabata: { label: 'Tabata', desc: '20 Sek. Belastung, 10 Sek. Pause, 8 Runden' },
  emom: { label: 'EMOM', desc: 'Every Minute On the Minute – Start jede Minute neu' },
};

function parsePlan(text) {
  const lines = text.trim().split('\n');
  let modus = 'normal';
  let modusDetail = '';
  const exercises = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'MAXFIT-PLAN') continue;

    // Parse MODUS line
    if (trimmed.startsWith('MODUS:')) {
      const parts = trimmed.replace('MODUS:', '').trim().split(' ');
      const m = parts[0].toLowerCase();
      if (MODI[m]) modus = m;
      modusDetail = parts.slice(1).join(' ');
      continue;
    }

    // Parse exercise line: Name | Gerät | Details...
    const parts = trimmed.split('|').map(s => s.trim());
    if (parts.length < 2) continue;

    const ex = { name: parts[0], geraet: parts[1], done: false, wdh: '', gewicht: '', saetze: 3, einseitig: false, info: '' };

    for (let i = 2; i < parts.length; i++) {
      const p = parts[i];
      if (p.toLowerCase() === 'einseitig') { ex.einseitig = true; continue; }
      if (p.startsWith('INFO:')) { ex.info = p.replace('INFO:', '').trim(); continue; }
      // Try parse "3x12"
      const sxw = p.match(/^(\d+)x(\d+)/);
      if (sxw) { ex.saetze = parseInt(sxw[1]); ex.wdh = sxw[2]; continue; }
      // Try parse just number (for AMRAP etc)
      if (/^\d+$/.test(p) && !ex.wdh) { ex.wdh = p; ex.saetze = 1; continue; }
      // Time like "10 min" or "60 sek"
      if (/^\d+\s*(min|sek|sec)/i.test(p)) { ex.wdh = p; ex.saetze = 1; continue; }
      // Weight like "25 kg"
      if (/\d+.*kg/i.test(p) || /Stufe/i.test(p)) { ex.gewicht = p; continue; }
      // Anything else goes to wdh
      if (!ex.wdh) ex.wdh = p;
      else ex.gewicht = p;
    }
    exercises.push(ex);
  }
  return { modus, modusDetail, exercises };
}

export default function Workout({ onDone }) {
  const [step, setStep] = useState('import'); // import | workout | done
  const [planText, setPlanText] = useState('');
  const [plan, setPlan] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [exercises, setExercises] = useState([]);
  const [rounds, setRounds] = useState(0);
  const [sessionNote, setSessionNote] = useState('');
  const [saved, setSaved] = useState(false);

  function handleImport() {
    if (!planText.trim()) return;
    const parsed = parsePlan(planText);
    if (parsed.exercises.length === 0) return;
    setPlan(parsed);
    setExercises(parsed.exercises);
    setActiveIdx(0);
    setStep('workout');
  }

  function updateEx(idx, field, value) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function toggleDone(idx) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, done: !e.done } : e));
    if (idx === activeIdx && idx < exercises.length - 1) setActiveIdx(idx + 1);
  }

  async function finishWorkout() {
    const datum = new Date().toISOString().slice(0, 10);
    const isCircuit = plan.modus !== 'normal';

    for (const ex of exercises) {
      const entry = {
        datum,
        uebung: ex.name,
        geraet: ex.geraet,
        typ: getTyp(ex.geraet),
        einseitig: ex.einseitig,
        saetze: isCircuit ? (rounds || 1) : (Number(ex.saetze) || 1),
        wdh: ex.wdh || '',
        gewicht: ex.gewicht || '',
        bem: isCircuit ? `${MODI[plan.modus]?.label || plan.modus} ${plan.modusDetail}${rounds ? ' · ' + rounds + ' Runden' : ''}` : '',
      };
      Object.keys(entry).forEach(k => { if (entry[k] === '' || entry[k] === undefined) delete entry[k]; });
      await db.entries.add(entry);
    }

    // Save session note
    if (sessionNote.trim()) {
      await db.sessionNotes.add({ datum, note: sessionNote.trim() });
    }

    setSaved(true);
    setTimeout(() => {
      if (onDone) onDone();
    }, 1500);
  }

  const doneCount = exercises.filter(e => e.done).length;
  const isCircuit = plan?.modus && plan.modus !== 'normal';

  // Import step
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

  // Workout done
  if (saved) {
    return (
      <div className="px-5 pt-8 pb-4 text-center">
        <div className="text-5xl mb-4">💪</div>
        <h2 className="text-2xl font-bold text-acc mb-2">Workout gespeichert!</h2>
        <p className="text-dim">{exercises.length} Übungen abgeschlossen</p>
      </div>
    );
  }

  // Active workout
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

      {/* Exercise list */}
      {exercises.map((ex, idx) => {
        const isActive = idx === activeIdx;
        return (
          <div key={idx} className={`bg-card rounded-2xl p-4 mb-2 border transition-all ${ex.done ? 'border-acc/30 opacity-60' : isActive ? 'border-acc' : 'border-brd'}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleDone(idx)}
                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center cursor-pointer flex-shrink-0 ${ex.done ? 'bg-acc border-acc text-bg' : 'bg-transparent border-brd text-transparent'}`}>
                {ex.done ? '✓' : ''}
              </button>
              <div className="flex-1">
                <div className="font-bold text-base">{ex.name}</div>
                <div className="text-sm text-dim">
                  {ex.geraet}
                  {!isCircuit && ex.saetze > 1 && ` · ${ex.saetze}x${ex.wdh}`}
                  {!isCircuit && ex.saetze <= 1 && ex.wdh && ` · ${ex.wdh}`}
                  {isCircuit && ex.wdh && ` · ${ex.wdh} Wdh`}
                  {ex.gewicht && ` · ${ex.gewicht}`}
                  {ex.einseitig && ' · Einseitig'}
                </div>
              </div>
            </div>

            {/* Info */}
            {ex.info && (
              <div className="bg-bg border border-brd rounded-lg p-2 mt-2 text-xs text-cblue">🏋️ {ex.info}</div>
            )}

            {/* Edit fields when active */}
            {isActive && !ex.done && !isCircuit && (
              <div className="flex gap-2 mt-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-dim font-bold mb-1">GEWICHT</label>
                  <input value={ex.gewicht} onChange={e => updateEx(idx, 'gewicht', e.target.value)} placeholder="kg"
                    className="w-full p-2.5 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-dim font-bold mb-1">WDH</label>
                  <input value={ex.wdh} onChange={e => updateEx(idx, 'wdh', e.target.value)} placeholder="12"
                    className="w-full p-2.5 bg-bg border border-brd rounded-xl text-t-primary text-sm outline-none" />
                </div>
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

      {/* Finish */}
      <button onClick={finishWorkout}
        className={`w-full py-4 font-bold text-base rounded-2xl border-none cursor-pointer ${doneCount === exercises.length ? 'bg-gradient-to-r from-acc to-acc-d text-bg' : 'bg-card border border-brd text-dim'}`}>
        {doneCount === exercises.length ? '✓ Workout abschließen' : `Workout beenden (${doneCount}/${exercises.length})`}
      </button>
    </div>
  );
}
