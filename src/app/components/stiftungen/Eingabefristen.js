'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import '../../../styles/stiftungen/eingabefristen.css';

export default function Eingabefristen() {
  // *** VARIABLES ***
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/foerderungen');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || 'Request failed');
        if (!cancelled) setItems(json.items || []);
      } catch (err) {
        toast.error(err.message || 'Fehler beim Laden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (iso) => {
    if (!iso) return 'Ganzjährig offen';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };

  return (
    <div className="eingabefristen">
      <div className="eingabefristen-header">
        <h2>Eingabefristen</h2>
      </div>

      {loading && <p className="eingabefristen-empty">Laden…</p>}

      {!loading && items.length === 0 && (
        <p className="eingabefristen-empty">Keine Eingabefristen gefunden.</p>
      )}

      {!loading && items.length > 0 && (
        <table className="eingabefristen-table">
          <thead>
            <tr>
              <th>Förderstelle</th>
              <th>Förderformat</th>
              <th>Eingabefrist</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.förderstelle || '—'}</td>
                <td>{row.förderformat || '—'}</td>
                <td>{formatDate(row.einsendeschluss)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
