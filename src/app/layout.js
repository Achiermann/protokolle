'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { THEME_INIT_SCRIPT, watchSystemTheme } from '@/lib/theme';
import '../styles/main.css';

export default function RootLayout({ children }) {
  useEffect(() => watchSystemTheme(), []);

  return (
    // data-theme is set by the inline script before hydration, so the
    // attribute legitimately differs from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Protokoll App</title>
        <meta name="description" content="Manage your meeting protocols and project documentation" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: 'var(--color-bg)', color: 'var(--color-text)' },
          }}
        />
      </body>
    </html>
  );
}
