import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tailwind looks for its config relative to process.cwd(), which is the repo
// root when the build is started from there. Pointing at it explicitly keeps
// the build working from either directory.
const here = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: join(here, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
