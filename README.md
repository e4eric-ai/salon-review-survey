# salon-review-survey

The public, unauthenticated review/survey page — Stage 3 of the Reviews & Marketing feature.
Every review-invite link (built by the `process-completed-appointment` Edge Function) points
here: `https://review.<salon-domain>/review/:token`.

A separately-deployed static site, same precedent as `salon-booking-widget/` — not a route inside
`spoton-react`, which only ever renders for signed-in staff. Each salon gets its own build+deploy
of this project (see the New Salon Setup Playbook in the project docs) — there's no shared/
multi-tenant hosting of this site across salons.

## Develop

```
npm install
cp .env.example .env.local   # fill in your real Supabase project URL + anon key
npm run dev
```

## Build

```
npm run build
```

Outputs to `dist/` — deploy that folder's contents to any static host.

## Deploy notes

- **Standard: its own subdomain, `review.<salon-domain>`.** `vite.config.js` sets `base: '/'`,
  meaning this build expects to own the root of whatever domain it's deployed to — which is
  exactly true for a dedicated subdomain (e.g. `review.rosewater-salon.com`), and is the
  standardized setup for every salon (see the New Salon Setup Playbook). After deploying, set the
  Supabase secret `REVIEW_SURVEY_BASE_URL` to `https://review.<that-salon's-domain>` so the
  Edge Function builds links that actually point here.
- **If a salon can't get a subdomain** and this has to live at a path under their main site
  instead (e.g. `mainsite.com/review/*`), two things change together: `base` in `vite.config.js`
  becomes the fixed path prefix (`'/review/'`), and `vercel.json` / `public/_redirects` need their
  rewrite scoped to that same prefix instead of the root wildcard they ship with. This is the
  exception, not the default — it also depends on whatever's hosting the main site supporting a
  rewrite/proxy for that path (a Vercel monorepo rewrite, an Nginx `location /review/` block, a
  Cloudflare Worker route, etc.), which isn't guaranteed the way a DNS subdomain record is.
  Whichever path is used, the `REVIEW_SURVEY_BASE_URL` secret and this project's actual deployed
  location must agree, or links in review invites 404. This was caught during testing, not
  guessed at: a relative `base: './'` (the convention `salon-booking-widget` uses, since it's
  always loaded from its own root via an iframe) silently 404'd the JS bundle the moment the page
  was loaded from a `/review/<token>` deep link instead of the site's literal root — the failure
  mode this project is designed to avoid by using an absolute `base` matched to the real deploy
  location.
- **Set the env vars** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your host's build
  settings — same values as the main app, just the public anon key, never the service role key.
- **Deep-linking rewrite included for both common static hosts**, scoped to the whole site (root
  wildcard, matching the subdomain standard above): `vercel.json` and `public/_redirects` (the
  Netlify equivalent) — a static host serves only the files it's given, so without one of these,
  loading `/review/<token>` directly (rather than navigating there from another page on the same
  site) would 404 before this page's own JS ever got a chance to read the token from the URL and
  route internally.

## What this page does and doesn't do

Loads whatever review a link's token points to, lets the client pick a 1–5 star rating, then asks
an optional follow-up question (phrased differently depending on whether the rating was positive
or negative) before a plain thank-you screen. It never links out to Google, Yelp, or any other
public platform — see the header comment in `src/ReviewSurvey.jsx` for why that was a deliberate
choice, not an oversight. A link is good for one sitting only: once a score is submitted, the
review's status moves off `pending` for good, and reopening the same link always shows the
"already submitted" screen, even if written feedback was skipped the first time through.
