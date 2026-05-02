import { useState, useEffect } from 'react';
import { initDB } from './db';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import Training from './components/Training';
import History from './components/History';
import Calendar from './components/Calendar';
import Workout from './components/Workout';
import More from './components/More';

export default function App() {
  const [view, setView] = useState('home');
  const [ready, setReady] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [key, setKey] = useState(0);
  const [showWorkout, setShowWorkout] = useState(false); // Force re-render after save

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
    setShowWorkout(false);
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
    <div className="bg-bg min-h-screen max-w-lg mx-auto pb-24">
      {/* Header */}
      <header className="px-5 pb-3 bg-gradient-to-br from-sf to-card border-b border-brd" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 48px)' }}>
        <h1 className="text-2xl font-extrabold tracking-wider text-acc m-0">MaxFit</h1>
      </header>

      {/* Content */}
      <main key={key}>
        {showWorkout ? (
          <Workout onDone={() => { setShowWorkout(false); setView('history'); setKey(k => k + 1); }} />
        ) : <>
          {view === 'home' && <Home onStartWorkout={() => setShowWorkout(true)} />}
          {view === 'training' && <Training editEntry={editEntry} onDone={handleTrainingDone} />}
          {view === 'history' && <History onEdit={handleEdit} />}
          {view === 'calendar' && <Calendar onSelectDate={handleCalendarSelect} />}
          {view === 'more' && <More />}
        </>}
      </main>

      {/* Navigation */}
      <BottomNav active={view} onChange={handleNavChange} />
    </div>
  );
}
