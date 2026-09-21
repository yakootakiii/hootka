// Imported first for its side effect: it sets the deployment region for every
// function, and must run before any handler is defined. See options.ts.
import './options.js';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

export const rtdb = getDatabase();
export const firestore = getFirestore();

export const gameRef = (gameId: string) => rtdb.ref(`games/${gameId}`);
export const codeRef = (code: string) => rtdb.ref(`gameCodes/${code}`);
