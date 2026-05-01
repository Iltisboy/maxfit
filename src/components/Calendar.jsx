import { useState, useEffect } from 'react';
import db from '../db';
import { getTyp, getEntryTypes, CatSymbol, CATEGORIES } from '../utils/categories';

export default function Calendar({ onSelectDate }) {
  const [entries, setEntries] = useState([]);
  const [calM, setCalM] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  useEffect(() => { db.entries.toArray().then(setEntries); }, []);

  const dates = [...new Set(entries.map(e => e.datum))];
  const calStr = (d) => `${calM.y}-${String(calM.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const calHas = (d) => d && dates.includes(calStr(d));

  const calCats = (d) => {
    if (!d) return [];
    const ds = calStr(d);
    const dayEntries = entries.filter(e => e.datum === ds);
    return getEntryTypes(dayEntries);
  };

  const calDays = () => {
    const { y, m } = calM;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startDay = (first.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= last.getDate(); i++) days.push(i);
    return days;
  };

  const monthName = new Date(calM.y, calM.m).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const legend = [
    ['maschine', 'Maschine'],
    ['eigengewicht', 'Eigengewicht'],
    ['cardio_gym', 'Cardio Gym'],
    ['outdoor', 'Outdoor'],
    ['schwimmen', 'Schwimmen'],
    ['praevention', 'Prävention'],
  ];

  return (
    <div className="px-4 pt-3 pb-4">
      {/* Month nav */}
      <div className="flex justify-between items-center mb-3">
        <button onClick={() => setCalM(p => ({ y: p.m === 0 ? p.y - 1 : p.y, m: p.m === 0 ? 11 : p.m - 1 }))}
          className="text-acc text-xl font-bold bg-transparent border-none cursor-pointer px-3">‹</button>
        <span className="text-base font-bold">{monthName}</span>
        <button onClick={() => setCalM(p => ({ y: p.m === 11 ? p.y + 1 : p.y, m: p.m === 11 ? 0 : p.m + 1 }))}
          className="text-acc text-xl font-bold bg-transparent border-none cursor-pointer px-3">›</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3 p-2 bg-card rounded-lg border border-brd">
        {legend.map(([typ, label]) => (
          <div key={typ} className="flex items-center gap-1">
            <CatSymbol typ={typ} size={10} />
            <span className="text-[9px] text-dim">{label}</span>
          </div>
        ))}
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
          <span key={d} className="text-center text-[9px] text-mut font-bold py-1">{d}</span>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {calDays().map((d, i) => {
          const has = calHas(d);
          const types = d ? calCats(d) : [];
          return (
            <button key={i}
              onClick={() => { if (has && onSelectDate) onSelectDate(calStr(d)); }}
              className={`min-h-[44px] rounded-md flex flex-col items-center justify-center p-0.5 border cursor-pointer ${has ? 'bg-acc-g border-acc' : 'bg-card border-brd'} ${!d ? 'invisible' : ''}`}>
              <span className={`text-xs font-semibold ${has ? 'text-acc' : 'text-t-primary'}`}>{d || ''}</span>
              {types.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center" style={{ maxWidth: 36 }}>
                  {types.map(t => <CatSymbol key={t} typ={t} size={7} />)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
