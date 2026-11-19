'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { THEME_INIT_SCRIPT, watchSystemTheme } from '@/lib/theme';
import { isBookingPath } from '@/lib/returnTo';
import '../styles/main.css';

// Two installable apps share this layout: /booking gets its own manifest,
// icon and name so it installs as a separate "Booking" home-screen app.
const PWA = {
  protokolle: {
    title: 'Protokoll App',
    shortName: 'Protokolle',
    manifest: '/manifest.webmanifest',
    appleIcon: '/icons/apple-touch-icon.png',
  },
  booking: {
    title: 'Booking',
    shortName: 'Booking',
    manifest: '/booking.webmanifest',
    appleIcon: '/icons/booking-apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  const pwa = isBookingPath(usePathname()) ? PWA.booking : PWA.protokolle;
  useEffect(() => watchSystemTheme(), []);

  // Register the PWA service worker (prod only, so dev HMR isn't intercepted).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {});
  }, []);

  return (
    // data-theme is set by the inline script before hydration, so the
    // attribute legitimately differs from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>{pwa.title}</title>
        <meta name="description" content="Manage your meeting protocols and project documentation" />
        <link rel="manifest" href={pwa.manifest} />
        <link rel="apple-touch-icon" href={pwa.appleIcon} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={pwa.shortName} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#e4e3ff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1b1b1b" media="(prefers-color-scheme: dark)" />
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
