import db from '../db';
import { localDate } from './streak';

function fmt(d) {
  const p = d.split('-');
  return `${p[2]}.${p[1]}.${p[0]}`;
}

// Generate text export for Claude
export function exportForClaude(entries, maxSessions = 50) {
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
  t += `\nErstelle Trainingsplan fuer heute (${fmt(localDate())}). Progression, Fersensporn, Schulter beachten.`;
  return t;
}

// Export ALL data as a structured JSON backup (all tables)
export async function exportFullBackup() {
  const data = {
    _format: 'maxfit-backup-v2',
    _exportedAt: new Date().toISOString(),
    entries: await db.entries.toArray(),
    bodyweight: await db.bodyweight.toArray(),
    sessionNotes: await db.sessionNotes.toArray(),
    goals: await db.goals.toArray(),
    prevLogs: await db.prevLogs.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maxfit-backup-${localDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Legacy single-array (entries-only) export, kept for compatibility
export function exportJSON(entries) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maxfit-entries-${localDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import from JSON backup. Handles both legacy array (entries only)
// and new object format with all tables.
export async function importFullBackup(file) {
  const text = await readFileText(file);
  const data = JSON.parse(text);

  // Legacy: bare array = just entries
  if (Array.isArray(data)) {
    return { entries: data };
  }
  // New format
  return {
    entries: data.entries || [],
    bodyweight: data.bodyweight || [],
    sessionNotes: data.sessionNotes || [],
    goals: data.goals || [],
    prevLogs: data.prevLogs || [],
  };
}

// Apply imported data into the DB. Strips IDs to avoid collisions.
// mode: 'append' (default) keeps existing data and adds the backup on top.
//       'replace' wipes all existing data first, then writes the backup.
export async function applyBackup(backup, mode = 'append') {
  const counts = { entries: 0, bodyweight: 0, sessionNotes: 0, goals: 0, prevLogs: 0 };

  if (mode === 'replace') {
    await db.entries.clear();
    await db.bodyweight.clear();
    await db.sessionNotes.clear();
    await db.goals.clear();
    await db.prevLogs.clear();
  }

  if (backup.entries?.length) {
    const items = backup.entries.map(({ id, ...rest }) => rest);
    await db.entries.bulkAdd(items);
    counts.entries = items.length;
  }
  if (backup.bodyweight?.length) {
    const items = backup.bodyweight.map(({ id, ...rest }) => rest);
    await db.bodyweight.bulkAdd(items);
    counts.bodyweight = items.length;
  }
  if (backup.sessionNotes?.length) {
    const items = backup.sessionNotes.map(({ id, ...rest }) => rest);
    await db.sessionNotes.bulkAdd(items);
    counts.sessionNotes = items.length;
  }
  if (backup.goals?.length) {
    const items = backup.goals.map(({ id, ...rest }) => rest);
    await db.goals.bulkAdd(items);
    counts.goals = items.length;
  }
  if (backup.prevLogs?.length) {
    const items = backup.prevLogs.map(({ id, ...rest }) => rest);
    await db.prevLogs.bulkAdd(items);
    counts.prevLogs = items.length;
  }

  return counts;
}

// Legacy export name used by older callers
export async function importJSON(file) {
  return importFullBackup(file);
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsText(file);
  });
}

// === Comprehensive multi-section CSV export (all tables) ===
// Sections separated by blank line and header marker. Importable.

const ENTRY_COLS = ['datum', 'uebung', 'geraet', 'typ', 'einseitig', 'saetze', 'wdh', 'gewicht', 'dauer', 'hf', 'hoehenmeter', 'pace', 'stufe', 'schwimmort', 'bem'];
const BW_COLS = ['datum', 'gewicht'];
const NOTE_COLS = ['datum', 'note'];
const GOAL_COLS = ['name', 'datum', 'details'];
const PREV_COLS = ['datum', 'typ', 'wert'];

function csvEsc(v) {
  if (v === undefined || v === null) return '';
  let s = String(v);
  if (typeof v === 'boolean') s = v ? 'Ja' : 'Nein';
  // Quote if contains separator, quote or newline
  if (/[;"\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCSV(rows, cols) {
  let out = cols.join(';') + '\n';
  for (const r of rows) {
    out += cols.map(c => csvEsc(r[c])).join(';') + '\n';
  }
  return out;
}

export async function exportFullCSV() {
  const entries = await db.entries.toArray();
  const bodyweight = await db.bodyweight.toArray();
  const sessionNotes = await db.sessionNotes.toArray();
  const goals = await db.goals.toArray();
  const prevLogs = await db.prevLogs.toArray();

  const sortByDate = (a, b) => (a.datum || '').localeCompare(b.datum || '');

  let csv = '';
  csv += '=== TRAININGSEINTRAEGE ===\n';
  csv += rowsToCSV([...entries].sort(sortByDate), ENTRY_COLS);
  csv += '\n=== KOERPERGEWICHT ===\n';
  csv += rowsToCSV([...bodyweight].sort(sortByDate), BW_COLS);
  csv += '\n=== SESSION-NOTIZEN ===\n';
  csv += rowsToCSV([...sessionNotes].sort(sortByDate), NOTE_COLS);
  csv += '\n=== ZIELE ===\n';
  csv += rowsToCSV(goals, GOAL_COLS);
  csv += '\n=== PRAEVENTION-LOGS ===\n';
  csv += rowsToCSV([...prevLogs].sort(sortByDate), PREV_COLS);

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maxfit-backup-${localDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// === CSV import (parses the multi-section format above) ===

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ';') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function castVal(col, v) {
  if (v === '' || v === undefined) return undefined;
  if (col === 'einseitig') return v === 'Ja' || v === 'true' || v === '1';
  if (['saetze', 'hf', 'hoehenmeter'].includes(col)) {
    const n = Number(v.replace(',', '.'));
    return isNaN(n) ? v : n;
  }
  return v;
}

export async function parseFullCSV(file) {
  const text = await readFileText(file);
  const lines = text.replace(/^\ufeff/, '').split(/\r?\n/);

  const sections = {};
  let curSection = null;
  let header = null;

  for (const line of lines) {
    const t = line.trim();
    if (!t) { header = null; continue; }
    const m = t.match(/^=== (.+?) ===$/);
    if (m) {
      curSection = m[1];
      sections[curSection] = [];
      header = null;
      continue;
    }
    if (!curSection) continue;
    if (!header) {
      header = parseCSVLine(line);
      continue;
    }
    const cells = parseCSVLine(line);
    const obj = {};
    header.forEach((h, i) => {
      let v = cells[i];
      if (v === undefined) return;
      // Bodyweight section: gewicht is numeric kg
      if (curSection === 'KOERPERGEWICHT' && h === 'gewicht') {
        const n = parseFloat(String(v).replace(',', '.'));
        if (!isNaN(n)) v = n;
      } else {
        v = castVal(h, v);
      }
      if (v !== undefined && v !== '') obj[h] = v;
    });
    if (Object.keys(obj).length) sections[curSection].push(obj);
  }

  return {
    entries: sections['TRAININGSEINTRAEGE'] || [],
    bodyweight: sections['KOERPERGEWICHT'] || [],
    sessionNotes: sections['SESSION-NOTIZEN'] || [],
    goals: sections['ZIELE'] || [],
    prevLogs: sections['PRAEVENTION-LOGS'] || [],
  };
}
