import React, { useState } from 'react';
import { playUIClick, playUIClose, playJewelPickup } from '../utils/sounds';
import { useJewels } from './JewelProvider';
import { useCosmetics } from './CosmeticsProvider';
import { useConsumables } from './ConsumablesProvider';
import { getJewels, spendJewels } from '../utils/jewels';
import {
  BODY_CATALOG, CROWN_CATALOG,
  purchaseBody, purchaseCrown,
  equipBody, equipCrown,
} from '../utils/cosmetics';
import { CONSUMABLES_CATALOG, purchaseConsumable } from '../utils/consumables';
import './Shop.css';

// Two-tab cosmetic store: Body colors / Crown variants. Cards show a tiny
// color swatch preview (skipping a full r3f mini-canvas to keep the shop
// snappy), name, cost, and a Buy / Equip / Equipped button.
function Shop({ onClose }) {
  const jewels = useJewels();
  const { state } = useCosmetics();
  const { inventory } = useConsumables();
  const [tab, setTab] = useState('items');     // default to Items — most actionable

  const handleBuy = (kind, item) => {
    if (state[kind === 'body' ? 'ownedBody' : 'ownedCrown'].includes(item.id)) return;
    if (getJewels() < item.cost) return;
    if (!spendJewels(item.cost)) return;
    if (kind === 'body') {
      purchaseBody(item.id);
      equipBody(item.id);
    } else {
      purchaseCrown(item.id);
      equipCrown(item.id);
    }
    playJewelPickup('bonus');
  };

  const handleEquip = (kind, item) => {
    if (kind === 'body') equipBody(item.id); else equipCrown(item.id);
    playUIClick();
  };

  const handleBuyConsumable = (item) => {
    if (getJewels() < item.cost) return;
    if (!spendJewels(item.cost)) return;
    purchaseConsumable(item.id);
    playJewelPickup('bonus');
  };

  // Body / Crown view inputs (Items tab uses CONSUMABLES_CATALOG directly).
  const catalog = tab === 'body' ? BODY_CATALOG : CROWN_CATALOG;
  const ownedSet = tab === 'body' ? state.ownedBody : state.ownedCrown;
  const equippedId = tab === 'body' ? state.equippedBody : state.equippedCrown;

  return (
    <div className="shop-screen">
      <div className="shop-card">
        <button className="shop-close" onClick={() => { playUIClose(); onClose(); }} aria-label="Close">×</button>
        <h1 className="shop-title">SHOP</h1>
        <div className="shop-balance">
          <span className="shop-balance-icon">💎</span>
          <span className="shop-balance-value">{jewels >= 999000000 ? '∞' : jewels}</span>
          <span className="shop-balance-label">jewels</span>
        </div>

        <div className="shop-tabs">
          <button
            className={`shop-tab ${tab === 'items' ? 'active' : ''}`}
            onClick={() => { playUIClick(); setTab('items'); }}
          >
            Items
          </button>
          <button
            className={`shop-tab ${tab === 'body' ? 'active' : ''}`}
            onClick={() => { playUIClick(); setTab('body'); }}
          >
            Body
          </button>
          <button
            className={`shop-tab ${tab === 'crown' ? 'active' : ''}`}
            onClick={() => { playUIClick(); setTab('crown'); }}
          >
            Crown
          </button>
        </div>

        {tab === 'items' && (
          <div className="shop-grid">
            {CONSUMABLES_CATALOG.map((item) => {
              const have = inventory[item.id] || 0;
              const canAfford = jewels >= item.cost;
              return (
                <div key={item.id} className="shop-tile shop-tile-item">
                  <div className="shop-tile-icon">{item.icon}</div>
                  <div className="shop-tile-name">{item.name}</div>
                  <div className="shop-tile-desc">{item.desc}</div>
                  <div className="shop-tile-have">In stock: <strong>{have}</strong></div>
                  {canAfford ? (
                    <button className="shop-tile-btn shop-tile-buy" onClick={() => handleBuyConsumable(item)}>
                      Buy <strong>{item.cost} 💎</strong>
                    </button>
                  ) : (
                    <button className="shop-tile-btn shop-tile-locked" disabled>
                      {item.cost} 💎
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab !== 'items' && <div className="shop-grid">
          {catalog.map((item) => {
            const owned = ownedSet.includes(item.id);
            const equipped = item.id === equippedId;
            const canAfford = jewels >= item.cost;
            const isFree = item.cost === 0;

            // Preview color: body uses its color directly; crown uses gold
            // (torus), icy (diamond, halo), or grey (none).
            let previewColor = '#888';
            if (tab === 'body') previewColor = item.color;
            else if (item.kind === 'torus') previewColor = '#ffd966';
            else if (item.kind === 'diamond') previewColor = '#aef0ff';
            else if (item.kind === 'halo') previewColor = '#dddddd';
            else if (item.kind === 'none') previewColor = '#3a304c';

            return (
              <div key={item.id} className={`shop-tile ${equipped ? 'equipped' : ''} ${owned ? 'owned' : ''}`}>
                <div className="shop-tile-preview" style={{ background: previewColor }}>
                  {tab === 'crown' && item.kind !== 'none' && <span className="shop-tile-preview-glyph">♔</span>}
                  {tab === 'crown' && item.kind === 'none' && <span className="shop-tile-preview-glyph">∅</span>}
                </div>
                <div className="shop-tile-name">{item.name}</div>
                {equipped ? (
                  <button className="shop-tile-btn shop-tile-equipped" disabled>Equipped</button>
                ) : owned ? (
                  <button className="shop-tile-btn shop-tile-equip" onClick={() => handleEquip(tab, item)}>Equip</button>
                ) : isFree ? (
                  <button className="shop-tile-btn shop-tile-buy" onClick={() => handleBuy(tab, item)}>Equip Free</button>
                ) : canAfford ? (
                  <button className="shop-tile-btn shop-tile-buy" onClick={() => handleBuy(tab, item)}>
                    Buy <strong>{item.cost} 💎</strong>
                  </button>
                ) : (
                  <button className="shop-tile-btn shop-tile-locked" disabled>
                    {item.cost} 💎
                  </button>
                )}
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}

export default Shop;
