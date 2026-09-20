import { Screen, Wordmark } from './Layout';
import { Mascot } from './Mascot';

/**
 * Shown instead of a blank page when the build has no Firebase config. It is
 * deliberately addressed to whoever deployed the site, not to a player.
 */
export function ConfigError({ missing }: { missing: string[] }) {
  // Rendered outside App, so it has to supply the viewport height itself.
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Screen className="items-center justify-center text-center">
        <Wordmark className="text-grape-500" />
        <Mascot mood="sad" className="h-32 w-32" />
        <div className="card max-w-xl text-left">
        <h1 className="font-display text-3xl">Hootka is not configured yet</h1>
        <p className="mt-3">
          This build has no Firebase settings, so it cannot reach the database.
          Whoever deployed the site needs to set these environment variables and
          deploy again:
        </p>
        <ul className="mt-3 list-inside list-disc font-mono text-sm">
          {missing.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-soft">
          They come from the Firebase console under Project settings → Your apps
          → SDK setup and configuration. On Vercel they go in Settings →
          Environment Variables; the values are read when the site is built, so
          the site has to be redeployed after adding them. See docs/DEPLOY.md.
        </p>
        </div>
      </Screen>
    </div>
  );
}
