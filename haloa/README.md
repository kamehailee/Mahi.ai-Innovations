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
npm run dev
```

Apply the migration once per database. It creates both tables and seeds the three fictional plots in one transaction. Open [the local journal](http://localhost:3000). The observation history shows all plots until you select a plot in the form.

Use simulated records only and keep the demo on a trusted development network. Anyone who can access the app can read and add observations.

## Verify the workflow

- Run `npm run lint` and `npm run build`.
- Select Demo Loʻi 1, enter a date, set the adult count to `0`, leave the egg-mass count blank, and enter a positive survey duration. Save and refresh. The history should show `0` and “Not surveyed.” Select Demo Loʻi 2 to verify that its history excludes the first plot’s record.
- Try a negative or fractional count and a zero duration. The form should reject each entry. The server also validates submissions.
- With a disposable database, fill the form, stop PostgreSQL, and submit. Verify the save error appears and the entries stay in the form.
