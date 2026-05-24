import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { GraphicsProvider } from './components/GraphicsProvider';
import { JewelProvider } from './components/JewelProvider';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GraphicsProvider>
      <JewelProvider>
        <App />
      </JewelProvider>
    </GraphicsProvider>
  </React.StrictMode>
);
