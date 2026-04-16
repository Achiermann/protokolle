'use client';

import { Toaster } from 'react-hot-toast';
import '../styles/main.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Protokoll App</title>
        <meta name="description" content="Manage your meeting protocols and project documentation" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
