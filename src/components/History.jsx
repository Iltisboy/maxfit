import { useState, useEffect } from 'react';
import db from '../db';
import { getTyp, getEntryTypes, CatSymbol, CATEGORIES } from '../utils/categories';
import { getExerciseInfo } from '../exercise-library';

function fmt(d) { const p = d.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; }

function parseWeight(w) {
  if (!w || w === '-' || w === '–') return null;
  const m = w.replace(',', '.').match(/([\d.]+)\s*kg/);
  return m ? parseFloat(m[1]) : null;
}

export default function History({ onEdit }) {
  const [entries, setEntries] = useState([]);
  const [selDate, setSelDate] = useState(null);
  const [showInfo, setShowInfo] = useState(null);
  const [bests, setBests] = useState({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const all = await db.entries.toArray();
    setEntries(all);
    // Calc bests
    const b = {};
    all.forEach(e => {
      const w = parseWeight(e.gewicht);
      if (w === null) return;
      if (!b[e.uebung] || w > b[e.uebung].w) b[e.uebung] = { w, d: e.datum, disp: e.gewicht };
    });
    setBests(b);
  }

  const dates = [...new Set(entries.map(e => e.datum))].sort((a, b) => b.localeCompare(a));
  const dayEntries = selDate ? entries.filter(e => e.datum === selDate) : [];

  async function handleDelete(id) {
    await db.entries.delete(id);
    loadData();
  }

  async function copyAsTemplate(sourceDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (today === sourceDate) return;
    const src = entries.filter(e => e.datum === sourceDate);
    const newEntries = src.map(e => {
      const { id, ...rest } = e;
      return { ...rest, datum: today, bem: '' };
    });
    await db.entries.bulkAdd(newEntries);
    setSelDate(today);
    loadData();
  }

  // Day detail view
  if (selDate) {
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setSelDate(null)} className="text-acc text-sm font-semibold bg-transparent border-none cursor-pointer">← Zurück</button>
          <h2 className="text-base font-bold">{fmt(selDate)}</h2>
          <button onClick={() => onEdit && onEdit({ datum: selDate })} className="w-8 h-8 rounded-lg bg-acc text-bg border-none font-extrabold text-lg cursor-pointer">+</button>
        </div>

        {selDate !== today && (
          <button onClick={() => copyAsTemplate(selDate)}
            className="w-full py-2.5 mb-3 bg-acc-g border border-acc rounded-lg text-acc font-bold text-sm cursor-pointer">
            📋 Als Vorlage für heute nutzen
          </button>
        )}

        {dayEntries.map(e => {
          const isBest = bests[e.uebung] && bests[e.uebung].d === e.datum && bests[e.uebung].disp === e.gewicht && parseWeight(e.gewicht) !== null;
          const info = getExerciseInfo(e.uebung);
          const infoOpen = showInfo === e.id;
          const typ = e.typ || getTyp(e.geraet);

          return (
            <div key={e.id} className={`bg-card rounded-xl p-3 mb-2 border relative ${isBest ? 'border-gold' : 'border-brd'}`}
              style={isBest ? { boxShadow: '0 0 10px rgba(251,191,36,0.12)' } : {}}>
              {isBest && <span className="absolute top-2 right-2 text-[11px] text-gold font-bold">🏆 PR</span>}
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <CatSymbol typ={typ} size={10} />
                  <span className="font-bold text-sm">{e.uebung}</span>
                  {info && (
                    <button onClick={() => setShowInfo(infoOpen ? null : e.id)}
                      className="bg-transparent border-none text-sm cursor-pointer p-0">🏋️</button>
                  )}
                </div>
                <span className="text-[10px] text-dim bg-bg px-1.5 py-0.5 rounded">{e.geraet}</span>
              </div>
              {infoOpen && info && (
                <div className="bg-bg border border-brd rounded-md p-2 mb-1 text-[11px] text-cblue leading-relaxed">{info.d}</div>
              )}
              <div className="flex gap-2 items-center mb-1">
                <span className="text-sm text-acc font-semibold">{e.saetze}x{e.wdh}</span>
                {e.gewicht && e.gewicht !== '-' && e.gewicht !== '–' && <span className="text-sm text-acc font-semibold">{e.gewicht}</span>}
                {e.pace && <span className="text-sm text-acc font-semibold">{e.pace}</span>}
                {e.hf && <span className="text-[11px] text-cred">♥ {e.hf}</span>}
                {e.einseitig && <span className="text-[10px] text-gold border border-gold px-1 rounded">Einseitig</span>}
              </div>
              {e.bem && <p className="text-[11px] text-dim mt-1">{e.bem}</p>}
              <div className="flex gap-2 mt-2 pt-2 border-t border-brd">
                <button onClick={() => onEdit && onEdit(e)} className="bg-transparent border border-brd rounded-md px-2 py-1 text-sm cursor-pointer">✏️</button>
                <button onClick={() => handleDelete(e.id)} className="bg-transparent border border-cred/30 rounded-md px-2 py-1 text-sm cursor-pointer">🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Session list
  return (
    <div className="px-4 pt-3 pb-4">
      {dates.length === 0 ? <p className="text-mut text-center py-8">Noch keine Einträge.</p> :
        dates.map(date => {
          const de = entries.filter(e => e.datum === date);
          const types = getEntryTypes(de);
          return (
            <button key={date} onClick={() => setSelDate(date)}
              className="w-full text-left bg-card border border-brd rounded-xl p-3 mb-2 cursor-pointer block">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm text-t-primary">{fmt(date)}</span>
                <span className="text-[10px] text-acc bg-acc-g px-2 py-0.5 rounded-full font-bold">{de.length}</span>
              </div>
              <div className="flex gap-1 mb-1">
                {types.map(t => <CatSymbol key={t} typ={t} size={10} />)}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {de.slice(0, 3).map(e => <span key={e.id} className="text-[11px] text-dim">{e.uebung}</span>)}
                {de.length > 3 && <span className="text-[11px] text-mut">+{de.length - 3}</span>}
              </div>
            </button>
          );
        })
      }
    </div>
  );
}
