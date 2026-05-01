// Category type mapping
export function getTyp(geraet) {
  const map = {
    'Maschine': 'maschine', 'Kabelzug': 'maschine', 'Kabel': 'maschine',
    'Eigengewicht': 'eigengewicht', 'Core': 'eigengewicht', 'Boden': 'eigengewicht',
    'Kettlebell': 'eigengewicht', 'Gewichtsball': 'eigengewicht',
    'Cardio': 'cardio_gym', 'Laufband': 'cardio_gym',
    'Outdoor': 'outdoor',
    'Schwimmbad': 'schwimmen',
    'Prävention': 'praevention', 'Dehnung': 'praevention', 'Praevention': 'praevention',
  };
  return map[geraet] || 'sonstige';
}

// Category definitions
export const CATEGORIES = {
  maschine:     { label: 'Maschine',       color: '#00d4aa', shape: 'square' },
  eigengewicht: { label: 'Eigengewicht',    color: '#fb923c', shape: 'square' },
  cardio_gym:   { label: 'Cardio (Gym)',    color: '#60a5fa', shape: 'heart' },
  outdoor:      { label: 'Cardio (Outdoor)',color: '#a3e635', shape: 'heart' },
  schwimmen:    { label: 'Schwimmen',       color: '#22d3ee', shape: 'drop' },
  praevention:  { label: 'Prävention',      color: '#4ade80', shape: 'cross' },
};

// SVG symbol component (size in px)
export function CatSymbol({ typ, size = 8 }) {
  const cat = CATEGORIES[typ];
  if (!cat) return null;
  const { color, shape } = cat;
  const s = size;
  const v = 14; // viewBox

  if (shape === 'square') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${v} ${v}`}>
        <rect x="2" y="2" width="10" height="10" rx="2" fill={color} />
      </svg>
    );
  }
  if (shape === 'heart') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${v} ${v}`}>
        <path d="M7 3C7 3 4 1 2 3.5C0 6 3 9 7 12C11 9 14 6 12 3.5C10 1 7 3 7 3Z" fill={color} />
      </svg>
    );
  }
  if (shape === 'drop') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${v} ${v}`}>
        <path d="M7 1C7 1 3 6 3 9C3 11.2 4.8 13 7 13C9.2 13 11 11.2 11 9C11 6 7 1 7 1Z" fill={color} />
      </svg>
    );
  }
  if (shape === 'cross') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${v} ${v}`}>
        <path d="M5 1v4.5H1v3h4v4.5h4v-4.5h4v-3H9V1z" fill={color} />
      </svg>
    );
  }
  return null;
}

// Get unique category types for a set of entries
export function getEntryTypes(entries) {
  const types = [...new Set(entries.map(e => e.typ || getTyp(e.geraet)))];
  return types.filter(t => CATEGORIES[t]);
}
