// ReviewSurvey.jsx — Stage 3 of the Reviews & Marketing feature.
//
// This is the public, unauthenticated page every review-invite link points at:
// https://spot-on-ai.com/review/:token (built by the process-completed-appointment Edge
// Function — see spoton_edge_function_process-completed-appointment.ts). It lives in its own
// separately-deployed static site, same precedent as salon-booking-widget/ — not a route inside
// spoton-react, which only ever renders for signed-in staff.
//
// CONFIG, unlike salon-booking-widget: that widget is designed to be embedded on arbitrary
// third-party salon websites via <iframe>, so it resolves its Supabase project from a
// ?supabase_url=/?supabase_key= URL param (with an env-var fallback), letting one deployed build
// serve many different salons without a rebuild. This page has exactly one deployment, for one
// salon, at one fixed URL — there's no multi-tenant need, so it reads straight from
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY and nothing else. Simpler on purpose.
//
// CLIENT: plain fetch() against {SUPABASE_URL}/rest/v1/rpc/{fnName} with just the anon apikey —
// no @supabase/supabase-js SDK, no Authorization/Bearer header at all. These three RPCs
// (public_get_review, public_submit_review, public_submit_review_feedback — see
// spoton_rls_reviews.sql) are deliberately grant-execute'd to `anon`: this page never signs in as
// anyone, by design — the token in the URL *is* the credential, re-validated by each RPC itself
// on every call. Consistent with this whole project's zero-dependency, no-SDK PostgREST pattern.
//
// WHAT THIS PAGE DELIBERATELY DOES NOT DO: funnel a happy client out to leave a public Google/
// Yelp review, or otherwise brand-share on their behalf. That's a legitimate thing some review
// tools do, but it's also the textbook shape of "review gating" (routing only positive sentiment
// toward a public platform), which several review platforms' own guidelines frown on. The
// marketing half of this feature's name is handled differently and more honestly: Stage 4's
// admin dashboard lets a STAFF member manually re-share a client's already-submitted positive
// review on the salon's own social channels — a human decision about the salon's own content,
// not an automatic funnel built into this page. This page's only job is collecting honest
// feedback, with a warmer tone for a good visit and an empathetic one for a bad visit — nothing
// routes anywhere else from here.
//
// A LINK IS GOOD FOR ONE SITTING: once a score has been submitted, the review's status moves off
// 'pending' permanently (see public_submit_review's own guard). Reopening the same link later
// always lands on the "already submitted" screen, even if this tab was closed right after rating
// and before adding written feedback. That's a deliberate simplification, not an oversight —
// matching how a one-time link is expected to behave everywhere else in this app (the booking
// widget's token-less flow aside).

import { useEffect, useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function callRpc(fnName, params) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('This page is not configured yet (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(params),
  });
  if (res.status === 204) return null; // public_submit_review_feedback returns void
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.message) || `Request failed (${res.status})`);
  }
  return data;
}

// The token is the final path segment of /review/:token, however the site happens to be
// deployed (root domain, or a subpath like spot-on-ai.com/review/<token>). Works the same either
// way since it only ever looks at the last segment.
function readTokenFromUrl() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : '';
}

function Stars({ value, onChange, disabled }) {
  return (
    <div className="flex justify-center gap-2 my-6" role="radiogroup" aria-label="Rate your visit">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`text-4xl leading-none transition-transform ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        >
          <span className={value && n <= value ? 'text-brand-500' : 'text-brand-200'}>★</span>
        </button>
      ))}
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-brand-100 p-8 text-center">
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="animate-spin h-8 w-8 border-4 border-brand-200 border-t-brand-500 rounded-full mx-auto" />
  );
}

export default function ReviewSurvey() {
  const [token] = useState(readTokenFromUrl);
  // step: 'loading' | 'invalid' | 'already_used' | 'rating' | 'feedback' | 'done' | 'error'
  const [step, setStep] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [review, setReview] = useState(null); // {clientName, staffName, serviceName, status, score}
  const [selectedScore, setSelectedScore] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultStatus, setResultStatus] = useState(null); // 'received_high' | 'received_low', set once rated

  useEffect(() => {
    if (!token) {
      setStep('invalid');
      return;
    }
    (async () => {
      try {
        const rows = await callRpc('public_get_review', { p_token: token });
        if (!rows || rows.length === 0) {
          setStep('invalid');
          return;
        }
        const row = rows[0];
        setReview({
          clientName: row.client_name,
          staffName: row.staff_name,
          serviceName: row.service_name,
          status: row.status,
          score: row.score,
        });
        if (row.status !== 'pending') {
          setStep('already_used');
        } else {
          setStep('rating');
        }
      } catch (e) {
        setErrorMessage(e.message || 'Something went wrong loading this page.');
        setStep('error');
      }
    })();
  }, [token]);

  async function submitScore() {
    if (!selectedScore || submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const rows = await callRpc('public_submit_review', { p_token: token, p_score: selectedScore });
      const status = rows && rows[0] ? rows[0].status : null;
      setResultStatus(status);
      setStep('feedback');
    } catch (e) {
      setErrorMessage(e.message || 'Could not submit your rating — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFeedback(skip) {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const trimmed = feedbackText.trim();
      if (!skip && trimmed) {
        await callRpc('public_submit_review_feedback', { p_token: token, p_feedback: trimmed });
      }
      setStep('done');
    } catch (e) {
      // The written-feedback step failing shouldn't trap someone who already successfully
      // rated — let them through to the thank-you screen either way; the rating itself is
      // already safely recorded.
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'loading') {
    return (
      <Card>
        <Spinner />
      </Card>
    );
  }

  if (step === 'error') {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-brand-800 mb-2">Something went wrong</h1>
        <p className="text-brand-600 mb-6">{errorMessage}</p>
        <button
          className="px-5 py-2 rounded-full bg-brand-500 text-white hover:bg-brand-600"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </Card>
    );
  }

  if (step === 'invalid') {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-brand-800 mb-2">This link isn't valid</h1>
        <p className="text-brand-600">
          Double-check the link from your text or email, or reach out to us directly if you'd like to share
          feedback about a recent visit.
        </p>
      </Card>
    );
  }

  if (step === 'already_used') {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-brand-800 mb-2">Thanks — we've already heard from you!</h1>
        <p className="text-brand-600">
          We received your feedback on this visit already. We appreciate you taking the time to share it.
        </p>
      </Card>
    );
  }

  if (step === 'rating') {
    const greetingName = review?.clientName ? review.clientName.split(' ')[0] : 'there';
    const visitLine = [review?.serviceName, review?.staffName ? `with ${review.staffName}` : null]
      .filter(Boolean)
      .join(' ');
    return (
      <Card>
        <h1 className="text-xl font-semibold text-brand-800 mb-1">Hi {greetingName}!</h1>
        <p className="text-brand-600 mb-1">How was your visit?</p>
        {visitLine && <p className="text-sm text-brand-400 mb-4">{visitLine}</p>}
        <Stars value={selectedScore} onChange={setSelectedScore} disabled={submitting} />
        {errorMessage && <p className="text-sm text-red-600 mb-3">{errorMessage}</p>}
        <button
          className="w-full py-2.5 rounded-full bg-brand-500 text-white font-medium disabled:opacity-40 hover:bg-brand-600"
          disabled={!selectedScore || submitting}
          onClick={submitScore}
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </Card>
    );
  }

  if (step === 'feedback') {
    const isHappy = resultStatus === 'received_high';
    return (
      <Card>
        <h1 className="text-xl font-semibold text-brand-800 mb-2">
          {isHappy ? "We're so glad you had a great visit!" : "We're sorry to hear that."}
        </h1>
        <p className="text-brand-600 mb-4">
          {isHappy
            ? 'Anything you loved that we should know about? (Optional)'
            : "What happened? Your feedback goes straight to our team so we can make it right. (Optional)"}
        </p>
        <textarea
          className="w-full border border-brand-200 rounded-lg p-3 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-300 mb-4"
          rows={4}
          placeholder={isHappy ? 'Tell us more…' : 'Tell us what went wrong…'}
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          disabled={submitting}
        />
        <div className="flex gap-3">
          <button
            className="flex-1 py-2.5 rounded-full border border-brand-200 text-brand-600 disabled:opacity-40 hover:bg-brand-50"
            disabled={submitting}
            onClick={() => submitFeedback(true)}
          >
            Skip
          </button>
          <button
            className="flex-1 py-2.5 rounded-full bg-brand-500 text-white font-medium disabled:opacity-40 hover:bg-brand-600"
            disabled={submitting || !feedbackText.trim()}
            onClick={() => submitFeedback(false)}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </Card>
    );
  }

  // step === 'done'
  const isHappy = resultStatus === 'received_high';
  return (
    <Card>
      <h1 className="text-xl font-semibold text-brand-800 mb-2">
        {isHappy ? 'Thank you!' : 'Thank you for letting us know.'}
      </h1>
      <p className="text-brand-600">
        {isHappy
          ? "We're thrilled you had a great visit — we hope to see you again soon."
          : 'Someone from our team may follow up with you directly. We appreciate you giving us the chance to make it right.'}
      </p>
    </Card>
  );
}
