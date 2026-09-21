import { setGlobalOptions } from 'firebase-functions/v2';
import { FUNCTIONS_REGION } from '@hootka/core';

/**
 * Deployment options for every function in this project.
 *
 * This must run before any `onCall` or `onSchedule` is evaluated, and ES module
 * imports are hoisted - so putting the call in index.ts is too late, because
 * the re-exported handler modules are evaluated first. Instead `firebase.ts`
 * imports this module, and every handler imports `firebase.ts`, which makes the
 * ordering a guarantee rather than a coincidence.
 */
setGlobalOptions({ region: FUNCTIONS_REGION });
