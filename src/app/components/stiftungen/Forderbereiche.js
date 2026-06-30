'use client';

import { useState } from 'react';
import { getFoerderungen } from '../../../data/foerderstellen';
import '../../../styles/stiftungen/forderbereiche.css';

const PROJEKTE_OPTIONS = [
  'Konzerttournee Inland',
  'Konzerttournee Ausland',
  'Tonträgerproduktion',
  'Promotion und Diffusion',
];

const ÜBERGREIFEND = 'Übergreifend';

function buildKantonOptions(items) {
  const set = new Set();
  let hasNull = false;
  for (const item of items) {
    if (item.kanton == null) hasNull = true;
    else set.add(item.kanton);
  }
  const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
  if (hasNull) sorted.push(ÜBERGREIFEND);
  return sorted;
}

function applyFilters(items, activeKantons, activeProjekte) {
  return items.filter((item) => {
    if (activeKantons.size > 0) {
      const itemKanton = item.kanton == null ? ÜBERGREIFEND : item.kanton;
      if (!activeKantons.has(itemKanton)) return false;
    }
    if (activeProjekte.size > 0) {
      const bereiche = Array.isArray(item.förderbereiche) ? item.förderbereiche : [];
      const hasOverlap = bereiche.some((b) => activeProjekte.has(b));
      if (!hasOverlap) return false;
    }
    return true;
  });
}

export default function Forderbereiche() {
  // *** VARIABLES ***
  const today = new Date().toISOString().slice(0, 10);
  const items = getFoerderungen(today);
  const [activeKantons, setActiveKantons] = useState(() => new Set());
  const [activeProjekte, setActiveProjekte] = useState(() => new Set());

  const kantonOptions = buildKantonOptions(items);
  const filtered = applyFilters(items, activeKantons, activeProjekte);

  // *** FUNCTIONS/HANDLERS ***
  const toggle = (set, value, setter) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  return (
    <div className="forderbereiche">
      <div className="forderbereiche-header">
        <h2>Förderbereiche</h2>
      </div>

      <div className="forderbereiche-table">
        <div className="forderbereiche-headings">
          <span>Kanton</span>
          <span>Projekte</span>
        </div>
        <div className="forderbereiche-grid">
          <div className="forderbereiche-col">
            {kantonOptions.map((kanton) => (
              <button
                key={kanton}
                type="button"
                className={`forderbereiche-tile ${
                  activeKantons.has(kanton) ? 'forderbereiche-tile-active' : ''
                }`}
                onClick={() => toggle(activeKantons, kanton, setActiveKantons)}
              >
                {kanton}
              </button>
            ))}
          </div>
          <div className="forderbereiche-col">
            {PROJEKTE_OPTIONS.map((projekt) => (
              <button
                key={projekt}
                type="button"
                className={`forderbereiche-tile ${
                  activeProjekte.has(projekt) ? 'forderbereiche-tile-active' : ''
                }`}
                onClick={() => toggle(activeProjekte, projekt, setActiveProjekte)}
              >
                {projekt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="forderbereiche-results">
        {filtered.length === 0 && (
          <p className="forderbereiche-empty">Keine passenden Förderstellen.</p>
        )}
        {filtered.length > 0 && (
          <ul className="forderbereiche-list">
            {filtered.map((item) => (
              <li key={item.id} className="forderbereiche-list-item">
                <div className="forderbereiche-list-item-name">{item.förderstelle}</div>
                <div className="forderbereiche-list-item-meta">
                  {item.förderformat || '—'}
                  {item.kanton && ` · ${item.kanton}`}
                  {item.stadt && ` · ${item.stadt}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
