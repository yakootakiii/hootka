import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { missingFirebaseConfig } from './lib/config';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const root = createRoot(container);
const missing = missingFirebaseConfig();

// Only App is loaded lazily, and only when the config is usable: importing it
// evaluates the Firebase modules, which throw on an unconfigured build before
// anything could be rendered to explain why.
if (missing.length > 0) {
  void import('./components/ConfigError').then(({ ConfigError }) => {
    root.render(<ConfigError missing={missing} />);
  });
} else {
  void import('./App').then(({ App }) => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
  });
}
