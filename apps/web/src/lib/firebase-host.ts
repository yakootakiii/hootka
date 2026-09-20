import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { app, usingEmulators } from './firebase';

/**
 * Host-only services. Kept out of `firebase.ts` so that Firestore and Storage
 * stay in the host chunk and never reach a player's phone.
 */
export const firestore = getFirestore(app);
export const storage = getStorage(app);

if (usingEmulators) {
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
