import { createRoot } from 'react-dom/client';
import { missingFirebaseConfig } from './lib/config';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const root = createRoot(container);
const missing = missingFirebaseConfig();

if (missing.length > 0) {
  // Rendered without importing App, because importing it would evaluate the
  // Firebase modules and throw before anything could be shown.
  void import('./components/ConfigError').then(({ ConfigError }) => {
    root.render(<ConfigError missing={missing} />);
  });
} else {
  void Promise.all([import('react'), import('react-router-dom'), import('./App')]).then(
    ([{ StrictMode }, { BrowserRouter }, { App }]) => {
      root.render(
        <StrictMode>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </StrictMode>,
      );
    },
  );
}
