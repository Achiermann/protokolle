'use client';

import '../../styles/app-switcher.css';

export default function AppSwitcher({ activeApp = 'p', onAppChange }) {
  // *** VARIABLES ***
  const apps = [
    { key: 'p', label: 'p', title: 'Protokoll' },
    { key: 'f', label: 'f', title: 'Finanzen' },
    { key: 'b', label: 'b', title: 'Booking' },
  ];

  // *** FUNCTIONS/HANDLERS ***
  const handleClick = (key) => {
    if (onAppChange) onAppChange(key);
  };

  return (
    <div className="app-switcher">
      {apps.map((app) => (
        <button
          key={app.key}
          type="button"
          title={app.title}
          aria-label={app.title}
          className={`app-switcher-button ${activeApp === app.key ? 'active' : ''}`}
          onClick={() => handleClick(app.key)}
        >
          {app.label}
        </button>
      ))}
    </div>
  );
}
