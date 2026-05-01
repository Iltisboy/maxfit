import { useState, useEffect } from 'react';
import { initDB } from './db';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import Training from './components/Training';
import History from './components/History';
import Calendar from './components/Calendar';
import More from './components/More';

export default function App() {
  const [view, setView] = useState('home');
  const [ready, setReady] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [key, setKey] = useState(0); // Force re-render after save

  useEffect(() => {
    initDB().then(() => setReady(true));
  }, []);

  function handleEdit(entry) {
    setEditEntry(entry);
    setView('training');
  }

  function handleTrainingDone() {
    setEditEntry(null);
    setView('history');
    setKey(k => k + 1);
  }

  function handleCalendarSelect(date) {
    // Navigate to history with that date selected
    setView('history');
  }

  function handleNavChange(v) {
    setView(v);
    if (v !== 'training') setEditEntry(null);
    setKey(k => k + 1);
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-acc tracking-wider mb-2">MaxFit</div>
          <div className="text-sm text-dim">Lade...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg min-h-screen max-w-lg mx-auto pb-20">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 bg-gradient-to-br from-sf to-card border-b border-brd">
        <h1 className="text-xl font-extrabold tracking-wider text-acc m-0">MaxFit</h1>
      </header>

      {/* Content */}
      <main key={key}>
        {view === 'home' && <Home />}
        {view === 'training' && <Training editEntry={editEntry} onDone={handleTrainingDone} />}
        {view === 'history' && <History onEdit={handleEdit} />}
        {view === 'calendar' && <Calendar onSelectDate={handleCalendarSelect} />}
        {view === 'more' && <More />}
      </main>

      {/* Navigation */}
      <BottomNav active={view} onChange={handleNavChange} />
    </div>
  );
}
