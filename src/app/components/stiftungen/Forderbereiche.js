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
  const maxRows = Math.max(kantonOptions.length, PROJEKTE_OPTIONS.length);

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

      <table className="forderbereiche-table">
        <thead>
          <tr>
            <th>Kanton</th>
            <th>Projekte</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }).map((_, i) => (
            <tr key={i}>
              <td>
                {kantonOptions[i] && (
                  <button
                    type="button"
                    className={`forderbereiche-pill ${
                      activeKantons.has(kantonOptions[i]) ? 'forderbereiche-pill-active' : ''
                    }`}
                    onClick={() => toggle(activeKantons, kantonOptions[i], setActiveKantons)}
                  >
                    {kantonOptions[i]}
                  </button>
                )}
              </td>
              <td>
                {PROJEKTE_OPTIONS[i] && (
                  <button
                    type="button"
                    className={`forderbereiche-pill ${
                      activeProjekte.has(PROJEKTE_OPTIONS[i]) ? 'forderbereiche-pill-active' : ''
                    }`}
                    onClick={() => toggle(activeProjekte, PROJEKTE_OPTIONS[i], setActiveProjekte)}
                  >
                    {PROJEKTE_OPTIONS[i]}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
