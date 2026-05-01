import Dexie from 'dexie';
import { SEED_DATA } from './seed-data';

const db = new Dexie('MaxFitDB');

db.version(1).stores({
  entries: '++id, datum, uebung, geraet, typ',
  goals: '++id, name, datum',
  prevLogs: '++id, datum, typ',
});

export async function initDB() {
  const count = await db.entries.count();
  if (count === 0) {
    await db.entries.bulkAdd(SEED_DATA);
  }
}

export default db;
