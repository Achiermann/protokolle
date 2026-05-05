'use client';

import { Fragment } from 'react';
import { getFoerderungen, getOldestVerifiedAt } from '../../../data/foerderstellen';
import '../../../styles/entry-list.css';
import '../../../styles/stiftungen/eingabefristen.css';

const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

function buildGrouped(items) {
  const byYear = new Map();
  const open = [];

  for (const item of items) {
    const dates = Array.isArray(item.eingabefristen) ? item.eingabefristen : [];

    if (dates.length === 0) {
      open.push(item);
      continue;
    }

    for (const d of dates) {
      const [y, m] = d.split('-');
      if (!byYear.has(y)) byYear.set(y, new Map());
      const months = byYear.get(y);
      if (!months.has(m)) months.set(m, []);
      months.get(m).push({ ...item, einsendeschluss: d });
    }
  }

  const years = Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, months]) => ({
      year,
      months: Array.from(months.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, monthItems]) => ({
          month,
          items: monthItems
            .slice()
            .sort((a, b) => a.einsendeschluss.localeCompare(b.einsendeschluss)),
        })),
    }));
  return { years, open };
}

export default function Eingabefristen() {
  // *** VARIABLES ***
  const today = new Date().toISOString().slice(0, 10);
  const items = getFoerderungen(today);
  const oldestVerifiedAt = getOldestVerifiedAt();
  const grouped = buildGrouped(items);

  // *** FUNCTIONS/HANDLERS ***
  const formatDate = (iso) => {
    if (!iso) return 'Ganzjährig offen';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };

  const renderRow = (row) => (
    <tr key={`${row.id}-${row.einsendeschluss ?? 'open'}`}>
      <td>{formatDate(row.einsendeschluss)}</td>
      <td>{row.förderstelle || '—'}</td>
      <td>{row.förderformat || '—'}</td>
    </tr>
  );

  return (
    <div className="eingabefristen">
      <div className="eingabefristen-header">
        <h2>Eingabefristen</h2>
        {oldestVerifiedAt && (
          <span className="eingabefristen-stand">Stand {formatDate(oldestVerifiedAt)}</span>
        )}
      </div>

      {items.length === 0 && (
        <p className="eingabefristen-empty">Keine Eingabefristen gefunden.</p>
      )}

      {items.length > 0 && (
        <table className="eingabefristen-table">
          <thead>
            <tr>
              <th>Eingabefrist</th>
              <th>Förderstelle</th>
              <th>Förderformat</th>
            </tr>
          </thead>
          <tbody>
            {grouped.years.map((yearGroup) => (
              <Fragment key={yearGroup.year}>
                <tr className="eingabefristen-year-header">
                  <th colSpan={3}>
                    <span className="entry-list-item-topic entry-list-item-topic-c4">
                      {yearGroup.year}
                    </span>
                  </th>
                </tr>
                {yearGroup.months.map((g) => (
                  <Fragment key={`${yearGroup.year}-${g.month}`}>
                    <tr className="eingabefristen-month-header">
                      <th colSpan={3}>
                        <span className="entry-list-item-topic entry-list-item-topic-c2">
                          {MONTHS_DE[parseInt(g.month, 10) - 1]}
                        </span>
                      </th>
                    </tr>
                    {g.items.map(renderRow)}
                  </Fragment>
                ))}
              </Fragment>
            ))}
            {grouped.open.length > 0 && (
              <Fragment>
                <tr className="eingabefristen-month-header">
                  <th colSpan={3}>
                    <span className="entry-list-item-topic entry-list-item-topic-c2">
                      Ganzjährig offen
                    </span>
                  </th>
                </tr>
                {grouped.open.map(renderRow)}
              </Fragment>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
