import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { GraphicsProvider } from './components/GraphicsProvider';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GraphicsProvider>
      <App />
    </GraphicsProvider>
  </React.StrictMode>
);
