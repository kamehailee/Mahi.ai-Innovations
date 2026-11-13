import { Pool } from "pg";

type Observation = {
  id: string;
  plotId: string;
  plot: string;
  date: string;
  adults: number | null;
  eggs: number | null;
  minutes: number;
  notes: string;
};

const MAX_BODY_BYTES = 32 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

let pool: Pool | undefined;

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is missing");
  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
      statement_timeout: 5_000,
    });
    pool.on("error", () => console.error("An idle Hāloa database connection failed."));
  }
  return pool;
}

function parseCount(value: string | null) {
  if (value === "") return null;
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const count = Number(value);
  return count <= 2_147_483_647 ? count : undefined;
}

function validDate(value: string | null): value is string {
  if (value === null || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function invalid(error: string, status = 400) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET() {
  try {
    const { rows } = await database().query<Observation>(`
      SELECT o.id::text, o.plot_id AS "plotId", p.name AS plot,
             to_char(o.observed_on, 'YYYY-MM-DD') AS date,
             o.adult_count AS adults, o.egg_mass_count AS eggs,
             o.survey_minutes AS minutes, o.notes
      FROM observations o
      JOIN loi_plots p ON p.id = o.plot_id
      ORDER BY o.id DESC
    `);
    return Response.json(rows, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "Observation history is unavailable. Refresh to try again." },
      { status: 503, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return invalid("Submit the observation from the journal site.", 403);
  }

  const contentType = request.headers.get("content-type")
    ?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded" || !request.body) {
    return invalid("Submit the observation using the journal form.", 415);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return invalid("This observation is too large. Shorten the field notes.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    void reader.cancel().catch(() => {});
    return invalid("Submit the observation using the journal form.");
  } finally {
    reader.releaseLock();
  }
  const data = new URLSearchParams(body);

  const plot = data.get("plot");
  const date = data.get("date");
  const adults = parseCount(data.get("adults"));
  const eggs = parseCount(data.get("eggs"));
  const minutes = parseCount(data.get("minutes"));
  const notes = data.get("notes");

  if (!plot) return invalid("Choose a sample loʻi plot.");
  if (!validDate(date)) return invalid("Enter a valid observation date.");
  if (adults === undefined || eggs === undefined) {
    return invalid("Enter whole counts from 0 to 2,147,483,647, or leave counts blank if not surveyed.");
  }
  if (!minutes) return invalid("Enter a whole survey duration from 1 to 2,147,483,647 minutes.");
  if (notes === null || notes.length > 2000 || notes.includes("\0")) {
    return invalid("Enter field notes of 2,000 characters or fewer using text only.");
  }

  try {
    const { rows } = await database().query<Observation>(`
      WITH saved AS (
        INSERT INTO observations (plot_id, observed_on, adult_count, egg_mass_count, survey_minutes, notes)
        SELECT id, $2::date, $3, $4, $5, $6 FROM loi_plots WHERE id = $1
        RETURNING *
      )
      SELECT s.id::text, s.plot_id AS "plotId", p.name AS plot,
             to_char(s.observed_on, 'YYYY-MM-DD') AS date,
             s.adult_count AS adults, s.egg_mass_count AS eggs,
             s.survey_minutes AS minutes, s.notes
      FROM saved s
      JOIN loi_plots p ON p.id = s.plot_id
    `, [plot, date, adults, eggs, minutes, notes]);
    if (!rows[0]) return invalid("Choose a valid sample loʻi plot.");
    return Response.json(rows[0], { status: 201, headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "Could not confirm the save. Your entries are still here. Check the history before retrying." },
      { status: 503, headers: NO_STORE },
    );
  }
}
