#!/usr/bin/env node
/**
 * Puts a Firebase service account key into apps/web/.env.production.local.
 *
 *   npm run set-service-account -- ~/Downloads/hootka-firebase-adminsdk-xxxxx.json
 *
 * It base64-encodes the key, because the private key inside contains newlines
 * and pasting it raw into an editor or a dashboard field usually mangles them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve('apps/web/.env.production.local');
const source = process.argv[2];

if (!source) {
  console.error('Usage: npm run set-service-account -- <path-to-service-account.json>');
  console.error('Get the file from: Firebase console -> Project settings ->');
  console.error('Service accounts -> Generate new private key');
  process.exit(1);
}

let key;
try {
  key = JSON.parse(readFileSync(resolve(source), 'utf8'));
} catch (error) {
  console.error(`Could not read ${source} as JSON: ${error.message}`);
  process.exit(1);
}

const required = ['project_id', 'client_email', 'private_key'];
const missing = required.filter((field) => !key[field]);
if (missing.length > 0) {
  console.error(`That file is missing: ${missing.join(', ')}`);
  console.error('It should be the "Generate new private key" download, not the');
  console.error('service account email and not an API key.');
  process.exit(1);
}
if (key.type !== 'service_account') {
  console.error(`Expected "type": "service_account", got "${key.type}".`);
  process.exit(1);
}

const encoded = Buffer.from(JSON.stringify(key)).toString('base64');

let env = readFileSync(ENV_FILE, 'utf8');
if (!/^FIREBASE_SERVICE_ACCOUNT=/m.test(env)) {
  env += `\nFIREBASE_SERVICE_ACCOUNT=${encoded}\n`;
} else {
  env = env.replace(/^FIREBASE_SERVICE_ACCOUNT=.*$/m, `FIREBASE_SERVICE_ACCOUNT=${encoded}`);
}
writeFileSync(ENV_FILE, env);

console.log(`Wrote FIREBASE_SERVICE_ACCOUNT (${encoded.length} chars, base64).`);
console.log(`  project : ${key.project_id}`);
console.log(`  account : ${key.client_email}`);
console.log(`\nNext: import apps/web/.env.production.local into Vercel and redeploy.`);
