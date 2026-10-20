# Setup and deployment

About 30 minutes. Everything runs on free tiers except Claude API usage (a listing costs roughly a few cents to about $0.20, depending on length).

## 1. Supabase (auth + database)

1. Create a project at <https://supabase.com>.
2. **SQL Editor** → paste `supabase/migrations/001_init.sql` → Run.
3. **Project Settings → API**: copy the Project URL, the anon/publishable key and the service-role/secret key.
4. **Authentication → Sign In / Providers → Email**: for a smooth demo, turn **Confirm email** off (Supabase's built-in mailer sends only a few emails per hour). Keep it on if you configure your own SMTP.
5. **Authentication → URL Configuration**: Site URL = your Vercel URL; add `http://localhost:3000/**` and `https://YOUR-APP.vercel.app/**` to Redirect URLs.
6. Optional Google login: enable the Google provider, then set `NEXT_PUBLIC_GOOGLE_AUTH=on`.

## 2. Claude API

<https://platform.claude.com> → Billing (add credit) → API Keys → create `ANTHROPIC_API_KEY`. Set a monthly spend limit.

## 3. Stripe (test mode)

1. <https://dashboard.stripe.com>, keep **Test mode** on.
2. **Developers → API keys**: copy the secret key (`sk_test_…`).
3. Products and prices are created inline at checkout; nothing to set up.
4. Webhook (after you have the Vercel URL): **Developers → Webhooks → Add endpoint** `https://YOUR-APP.vercel.app/api/stripe/webhook`, events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret (`whsec_…`).

## 4. Run locally

```bash
cp .env.example .env.local     # fill in the values
npm install
npm run dev                    # http://localhost:3000
```

Local webhooks with the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints a whsec_ for .env.local
```

## 5. Deploy to Vercel

1. Push the repository to GitHub.
2. <https://vercel.com> → Add New Project → import the repository (framework: Next.js, defaults are fine).
3. Add every variable from `.env.example` under Settings → Environment Variables (set `NEXT_PUBLIC_SITE_URL` to the Vercel URL).
4. Deploy, then add the Stripe webhook (step 3.4) and redeploy once so the new `STRIPE_WEBHOOK_SECRET` is picked up.
5. Check `https://YOUR-APP.vercel.app/api/health`: all three services should be `true`.

Every push to `main` redeploys.

## 6. Demo checklist

- Sign up → dashboard shows 3 credits.
- New listing with the silicone cup example (include "食品级认证，最好的水杯") → watch five steps → "best" flagged, certification kept as a material fact.
- New listing with only "杯子" → questions, no credit spent.
- Use the remaining credits → checkout with `4242 4242 4242 4242` → credits appear on the dashboard.
