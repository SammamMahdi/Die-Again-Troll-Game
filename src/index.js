import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { GraphicsProvider } from './components/GraphicsProvider';
import { JewelProvider } from './components/JewelProvider';
import { CosmeticsProvider } from './components/CosmeticsProvider';
import { ConsumablesProvider } from './components/ConsumablesProvider';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GraphicsProvider>
      <JewelProvider>
        <CosmeticsProvider>
          <ConsumablesProvider>
            <App />
          </ConsumablesProvider>
        </CosmeticsProvider>
      </JewelProvider>
    </GraphicsProvider>
  </React.StrictMode>
);
