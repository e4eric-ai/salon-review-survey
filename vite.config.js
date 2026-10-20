import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is '/', NOT './' like salon-booking-widget's config. That widget is always loaded from its
// own deployment root (an <iframe src="https://widget-url/">), so a relative base works fine
// there. This site is deliberately deep-linked to via /review/:token — a path that doesn't
// correspond to a real file, resolved to index.html only via the SPA-fallback rewrite in
// vercel.json / public/_redirects. A relative base ('./') would have index.html's own script tag
// resolve against whatever fake /review/<token> path the browser is actually on, not the site's
// real root — found and confirmed by a functional test against a server that mimics the real
// rewrite behavior. '/' is correct here specifically because the standard deploy target is this
// project's OWN subdomain (review.<salon-domain>), so this build's root really is the host's
// root. If this project is ever instead deployed under a path on a shared host (e.g.
// mainsite.com/review/*) rather than its own subdomain, base needs to change back to match that
// path prefix, and REVIEW_SURVEY_BASE_URL needs to match too — see README.md's Deploy notes.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
