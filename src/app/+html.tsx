import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only root HTML for static rendering. Runs in Node at build time, not in the browser.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
          viewport-fit=cover lets safe-area insets work when installed to the home screen.
          maximum-scale=1 stops iOS Safari zooming in when a field (under 16px text) is focused;
          iOS still allows pinch zoom, so it doesn't lock anyone out.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Link previews (Messenger, Slack, etc.). Previews need absolute URLs. The <title> is set in _layout. */}
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={TITLE} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${WEB_URL}/`} />
        <meta property="og:image" content={`${WEB_URL}/logo512.png`} />
        <meta name="twitter:card" content="summary" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#121615" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Artemis" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
        {/* No double-tap to zoom (iOS Safari): taps feel like an app's, with no zoom or delay. */}
        <style dangerouslySetInnerHTML={{ __html: 'html, body { touch-action: manipulation; }' }} />

        {/* Only the production export ships a service worker (see `build:web`). */}
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{ __html: serviceWorker }} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}

const TITLE = 'Artemis Creatives Tracker';
const DESCRIPTION = 'Review and approve ad creatives from your phone.';
// Where this build is hosted; set per deploy (see `EXPO_PUBLIC_WEB_URL` in the deploy command).
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://artemis-creatives-tracker--efb.expo.app').replace(/\/+$/, '');

const serviceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
`;
