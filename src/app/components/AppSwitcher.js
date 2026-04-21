'use client';

import '../../styles/app-switcher.css';

export default function AppSwitcher({ activeApp = 'p', onAppChange }) {
  // *** VARIABLES ***
  const apps = [
    { key: 'p', label: 'p', title: 'Protokoll' },
    { key: 's', label: 's', title: 'Stiftungen' },
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
