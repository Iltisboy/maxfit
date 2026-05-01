function fmt(d) {
  const p = d.split('-');
  return `${p[2]}.${p[1]}.${p[0]}`;
}

// Generate text export for Claude
export function exportForClaude(entries, maxSessions = 25) {
  const dates = [...new Set(entries.map(e => e.datum))].sort((a, b) => b.localeCompare(a)).slice(0, maxSessions);
  const filtered = entries.filter(e => dates.includes(e.datum)).sort((a, b) => a.datum.localeCompare(b.datum));

  let t = `TRAININGS-LOG (${dates.length} Sessions)\n`;
  let cd = '';
  filtered.forEach(e => {
    if (e.datum !== cd) { cd = e.datum; t += `\n${fmt(e.datum)}:\n`; }
    t += ` ${e.uebung} ${e.saetze}x${e.wdh}`;
    if (e.gewicht && e.gewicht !== '-' && e.gewicht !== '–') t += ` ${e.gewicht}`;
    if (e.pace) t += ` ${e.pace}`;
    if (e.hf) t += ` HF ${e.hf}`;
    if (e.bem) t += ` (${e.bem})`;
    t += '\n';
  });
  t += `\nErstelle Trainingsplan fuer heute (${fmt(new Date().toISOString().slice(0, 10))}). Progression, Fersensporn, Schulter beachten.`;
  return t;
}

// Export as JSON backup file
export function exportJSON(entries) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maxfit-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import from JSON backup
export async function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('Ungültige JSON-Datei'));
      }
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsText(file);
  });
}
