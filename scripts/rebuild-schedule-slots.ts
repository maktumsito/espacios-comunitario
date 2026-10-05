import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore';
import { rebuildScheduleSlots } from '../src/services/migrations/rebuildScheduleSlots';

// This executable intentionally cannot target production.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8087') throw new Error('Se requiere FIRESTORE_EMULATOR_HOST=127.0.0.1:8087. Solo se permite el entorno local demo.');
const db = getFirestore(initializeApp({ projectId: 'demo-espacios', apiKey: 'local-only' }));
connectFirestoreEmulator(db,'127.0.0.1',8087);
try {
  const applied = process.argv.includes('--apply');
  console.log(JSON.stringify(await rebuildScheduleSlots(db,applied),null,2));
  if(applied) {
    const check = await rebuildScheduleSlots(db,false);
    if(check.changed || check.obsolete) throw new Error('El índice aún no coincide con las reservas; revisar antes de continuar.');
    console.log('Índice verificado.');
  }
} finally { await terminate(db); }
