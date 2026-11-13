# Hāloa loʻi observation journal

The journal records simulated apple snail surveys for three fictional loʻi plots. It requires Node.js 20.9 or later, npm, a PostgreSQL database, and the `psql` client for the migration.

## Run locally

From the repository root:

```sh
cd haloa
npm ci
```

Create an empty development database named `haloa_demo`, or use a dedicated empty PostgreSQL database. Set `DATABASE_URL` in your shell to that database's connection URL. For local PostgreSQL it will typically look like `postgresql://USER:PASSWORD@localhost:5432/haloa_demo`. Next.js can also read the setting from `haloa/.env.local`; the `psql` command below needs the setting exported in your shell. Keep credentials out of Git.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_create_observations.sql
npm run dev -- --hostname localhost
```

Apply the migration once per database. It creates both tables and seeds the three fictional plots in one transaction. Open [the local journal](http://localhost:3000). The observation history shows all plots until you select a plot in the form.

Use simulated records only and keep the demo on a trusted development network.

## Verify the workflow

- Run `npm run lint` and `npm run build`.
- Select Demo Loʻi 1, enter a date, set the adult count to `0`, leave the egg-mass count blank, and enter a positive survey duration. Save and refresh. The history should show `0` and “Not surveyed.” Select Demo Loʻi 2 to verify that its history excludes the first plot’s record.
- Try a negative or fractional count and a zero duration. The form should reject each entry. The server also validates submissions.
- With a disposable database, sign in as an editor, fill the form, stop PostgreSQL, and submit. Verify the save error appears and the entries stay in the form.

## Automated checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` from `haloa/`. For integration tests, use Node.js 24 and point `TEST_DATABASE_URL` at a disposable PostgreSQL database. The test role needs permission to create schemas. The tests create and remove their own schema and apply the real migration. They never use `DATABASE_URL` from your shell to select a test database.

```sh
TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/haloa_test' npm test
```

GitHub Actions runs these checks on pull requests and uses a disposable PostgreSQL service. It needs no application database credentials.

## Demo sign-in and API access

Set these server-only values in `haloa/.env.local` before starting the app:

```dotenv
HALOA_ORIGIN=http://localhost:3000
HALOA_READER_KEY=<first generated key>
HALOA_EDITOR_KEY=<second generated key>
```

Generate two distinct 64-character lowercase hexadecimal keys with
`openssl rand -hex 32` (run it twice). Keep keys and database credentials
out of Git. Open the app at the exact configured origin and enter the
appropriate key in the sign-in form. A reader can view the journal and
dashboard. An editor can also save observations. Missing or invalid
configuration leaves both API methods closed.

Sessions are random, server-side, and expire after one hour. Sign-out revokes
the session. Restart the server when rotating a key to revoke existing sessions.
Cookies are host-only, HttpOnly and SameSite=Strict, with Secure and a
`__Host-` prefix on HTTPS. Plain HTTP is allowed for loopback development only.
Sign-in, sign-out and observation writes require an exact Origin match against
`HALOA_ORIGIN`. Protected responses are private and uncacheable.

This demo assumes a single Node.js process. Sessions are cleared on restart.
Fixed one-minute budgets are shared per process: 10 sign-in attempts, 120
reads per role, and 30 editor writes. One client can consume a shared budget.
Use network-level restrictions for the demo. A multi-instance deployment
would need shared session and rate-limit state and individual identities.
Keep the database URL server-side and use a restricted database role.

## Monitoring dashboard

The journal page includes the Apple Snail Monitoring Dashboard. It reads the
same fictional observations as the journal and updates after a successful save.
Each loʻi summary shows total counts, survey minutes, and the number of survey
records that counted each measure. The trend table groups observations by date
and plot. A blank count stays unsurveyed. Zero counts contribute to coverage.
Totals reflect recorded survey effort and should be read alongside coverage.

The dashboard uses the protected observation history endpoint. Its access
matches the journal and uses the existing PostgreSQL schema.
