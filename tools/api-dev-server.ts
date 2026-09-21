import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Serves the /api routes during `npm run dev`.
 *
 * In production these are Vercel serverless functions; Vite knows nothing about
 * them, so without this the whole backend is missing locally and every game
 * action fails with "Something went wrong". The plugin loads each handler
 * through Vite's own module graph, so edits hot-reload like the rest of the app.
 */
export function apiDevServer(): Plugin {
  return {
    name: 'hootka:api-dev-server',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Point the Admin SDK at the emulator suite, the way the deployed routes
      // are pointed at the real project by Vercel's environment variables.
      if (process.env.VITE_USE_EMULATORS !== 'false') {
        process.env.GCLOUD_PROJECT ??= 'demo-hootka';
        process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
        process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
        process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';
        process.env.FIREBASE_DATABASE_URL ??= 'https://demo-hootka.firebaseio.com';
        process.env.CRON_SECRET ??= 'dev-cron-secret';
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();

        const name = url.slice('/api/'.length).split('?')[0]?.replace(/[^\w-]/g, '') ?? '';
        if (!name) return next();

        try {
          const body = await readJsonBody(req);
          const module = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = module.default as (
            request: unknown,
            response: unknown,
          ) => Promise<void>;

          await handler(
            { method: req.method ?? 'POST', headers: req.headers, body, query: {} },
            vercelResponseShim(res),
          );
        } catch (error) {
          // A missing route file lands here as well as a genuine failure.
          server.config.logger.error(`[api] ${name} failed: ${String(error)}`);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Dev API route "${name}" failed. See the terminal.` }));
          }
        }
      });
    },
  };
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Body was not JSON.'));
      }
    });
    req.on('error', reject);
  });
}

/** The handful of response methods the routes actually use. */
function vercelResponseShim(res: ServerResponse) {
  const shim = {
    status(code: number) {
      res.statusCode = code;
      return shim;
    },
    json(payload: unknown) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
      return shim;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
      return shim;
    },
    get writableEnded() {
      return res.writableEnded;
    },
  };
  return shim;
}
