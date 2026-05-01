// Get ISO week number
function getWeek(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return { year: d.getFullYear(), week: Math.ceil(((d - week1) / 86400000 + 1) / 7) };
}

// Get week key string
function weekKey(dateStr) {
  const w = getWeek(dateStr);
  return `${w.year}-W${String(w.week).padStart(2, '0')}`;
}

// Calculate current streak (consecutive weeks with at least 1 training)
export function calcStreak(dates) {
  if (!dates.length) return { current: 0, longest: 0 };

  const weeks = [...new Set(dates.map(weekKey))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = weekKey(today);

  let current = 0;
  let longest = 0;
  let streak = 0;

  // Check if current week has training
  const allWeeksSorted = [...new Set(dates.map(weekKey))].sort().reverse();
  
  // Start from current or last week
  let checkWeek = currentWeek;
  let found = allWeeksSorted.includes(checkWeek);
  
  if (!found) {
    // Check last week
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    checkWeek = weekKey(lastWeekDate.toISOString().slice(0, 10));
    found = allWeeksSorted.includes(checkWeek);
  }

  if (!found) return { current: 0, longest: calcLongest(allWeeksSorted) };

  // Count backwards from found week
  const d = new Date();
  if (checkWeek !== currentWeek) d.setDate(d.getDate() - 7);
  
  for (let i = 0; i < 200; i++) {
    const wk = weekKey(d.toISOString().slice(0, 10));
    if (allWeeksSorted.includes(wk)) {
      current++;
      d.setDate(d.getDate() - 7);
    } else {
      break;
    }
  }

  return { current, longest: Math.max(current, calcLongest(allWeeksSorted)) };
}

function calcLongest(weeksSorted) {
  if (!weeksSorted.length) return 0;
  const sorted = [...weeksSorted].sort();
  let longest = 1;
  let streak = 1;
  
  for (let i = 1; i < sorted.length; i++) {
    // Check if consecutive weeks
    const prev = parseWeek(sorted[i - 1]);
    const curr = parseWeek(sorted[i]);
    const diffDays = (curr - prev) / 86400000;
    
    if (diffDays >= 5 && diffDays <= 9) {
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 1;
    }
  }
  return longest;
}

function parseWeek(weekStr) {
  const [y, w] = weekStr.split('-W').map(Number);
  const d = new Date(y, 0, 1 + (w - 1) * 7);
  return d;
}

// Get training days for current week (Mo=0 .. So=6)
export function getCurrentWeekDays(entries) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Mo=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayEntries = entries.filter(e => e.datum === dateStr);
    days.push({
      label: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i],
      date: dateStr,
      trained: dayEntries.length > 0,
      types: [...new Set(dayEntries.map(e => e.typ))],
    });
  }
  return days;
}
