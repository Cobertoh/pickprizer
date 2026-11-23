# PickHit: accounts, plans and payments

## Plans
| Plan | Price | What they get |
|---|---|---|
| Guest (not signed in) | free | Homepage, how it works, pick of the day |
| Free account | free | Same as guest, plus a saved account |
| Basic | $4.99/mo | All picks with every stat and the research, quietly ranked strongest first (no chances, grades or calls). Hit Picks lineups with the lineup's chance only |
| Pro | $14.99/mo | Everything |
| Developer (`PickHitDev`) | — | Everything, plus "Preview the site as" in the account menu |

The data routes the engine uses (`/p`, `/rated`, `/snap`) only answer Basic, Pro and developer sessions, so guests and free accounts can't run the engine.

## Turn on payments (Whop, no monthly fee)
1. Make an account at whop.com and create a business called PickHit.
2. Create a product with two recurring plans: **Basic $4.99/month** and **Pro $14.99/month**. Copy each plan's ID (starts with `plan_`).
3. Dashboard → Developer → API keys: create a company API key that can create checkout configurations. Copy it.
4. Dashboard → Developer → Webhooks → Create webhook
   - URL: `https://YOUR-SITE/pay/whop`
   - Events: membership.activated, membership.deactivated, membership.went_valid, membership.went_invalid, membership.updated, payment.succeeded, refund.created
   - Copy the signing secret (starts with `ws_`).
5. Cloudflare dashboard → Workers & Pages → pickprizer → Settings → Variables and Secrets. Add:
   - `WHOP_API_KEY` (type **Secret**)
   - `WHOP_WEBHOOK_SECRET` (type **Secret**)
   - `WHOP_PLAN_BASIC`: the Basic plan ID (Text)
   - `WHOP_PLAN_PRO`: the Pro plan ID (Text)
6. In Whop, add your bank account for payouts.

That's it: the Get Basic / Get Pro buttons start working, and plans switch on or off automatically when someone pays, cancels or is refunded.

## Optional
- **Google sign-in**: console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID (Web application). Under Authorized JavaScript origins add `https://YOUR-SITE`. Put the client ID in a Text variable named `GOOGLE_CLIENT_ID`. Only Google's account ID is stored, never the email.
- **`SESSION_SECRET`** (Secret, any long random text): pins the key that signs sign-in cookies. Without it, one is generated and saved automatically.
- **`WHOP_MANAGE_URL`**: where "Manage or cancel subscription" points (default: Whop's memberships page).

## Notes
- Passwords are stored as salted PBKDF2 hashes. Sign-ins last 180 days.
- The pick of the day is shared by the first member whose app rates that sport each day (refreshed every 2 hours).
- Basic's hidden ratings are hidden in the page. A technical user could dig them out of the browser. A full lock would mean computing ratings on the server, which the free Cloudflare plan's CPU limit doesn't allow.
- An iPhone App Store version would need Apple's In-App Purchase for subscriptions bought inside the app (US apps may also link out to web checkout).
