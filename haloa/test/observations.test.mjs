import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { GET, POST } from "../src/app/api/observations/route.ts";

const endpoint = "http://localhost:3000/api/observations";
const sample = {
  plot: "demo-1",
  date: "2026-10-10",
  adults: "0",
  eggs: "",
  minutes: "15",
  notes: "Fictional survey",
};

function submit(fields, headers) {
  return POST(new Request(endpoint, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers,
  }));
}

test("rejects invalid observations before saving", async () => {
  for (const [field, value] of [
    ["plot", ""],
    ["date", "2026-02-30"],
    ["adults", "-1"],
    ["eggs", "1.5"],
    ["eggs", "2147483648"],
    ["minutes", "0"],
    ["notes", "a".repeat(2001)],
  ]) {
    const response = await submit({ ...sample, [field]: value });
    assert.equal(response.status, 400, field);
    assert.ok((await response.json()).error);
  }
});

test("rejects cross-origin, unsupported and oversized writes", async () => {
  assert.equal((await submit(sample, { origin: "https://example.org" })).status, 403);
  assert.equal((await POST(new Request(endpoint, { method: "POST", body: "plain text" }))).status, 415);
  const chunk = new TextEncoder().encode("notes=" + "a".repeat(20_000));
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const response = await POST(new Request(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    duplex: "half",
  }));
  assert.equal(response.status, 413);
});

test("persists and retrieves observations and handles database errors", async (t) => {
  const testUrl = process.env.TEST_DATABASE_URL;
  assert.ok(testUrl, "Set TEST_DATABASE_URL to a disposable PostgreSQL database.");
  const schema = "haloa_test_" + randomUUID().replaceAll("-", "");
  const scopedUrl = new URL(testUrl);
  scopedUrl.searchParams.set("options", "-c search_path=" + schema);
  const admin = new Client({ connectionString: testUrl, connectionTimeoutMillis: 5000 });
  const database = new Client({ connectionString: scopedUrl.href, connectionTimeoutMillis: 5000 });
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = scopedUrl.href;

  let schemaCreated = false;
  let databaseConnected = false;
  t.after(async () => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    try {
      if (databaseConnected) await database.end();
      if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  });

  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  await database.connect();
  databaseConnected = true;
  await database.query(await readFile(new URL("../db/migrations/001_create_observations.sql", import.meta.url), "utf8"));
  assert.deepEqual(await (await GET()).json(), []);
  assert.equal((await submit({ ...sample, plot: "other" })).status, 400);

  await t.test("retains zero and unsurveyed separately in storage and on a new read", async () => {
    const first = await submit(sample, { origin: "http://localhost:3000" });
    assert.equal(first.status, 201);
    const saved = await first.json();
    const second = await submit({ ...sample, plot: "demo-2", adults: "", eggs: "0" });
    assert.equal(second.status, 201);
    const secondSaved = await second.json();

    const history = await GET();
    assert.equal(history.status, 200);
    assert.equal(history.headers.get("cache-control"), "no-store");
    assert.deepEqual(await history.json(), [
      { ...secondSaved, plotId: "demo-2", adults: null, eggs: 0 },
      { ...saved, plotId: "demo-1", adults: 0, eggs: null },
    ]);
    assert.deepEqual((await database.query(
      "SELECT adult_count, egg_mass_count FROM observations WHERE id = $1", [saved.id],
    )).rows, [{ adult_count: 0, egg_mass_count: null }]);
  });

  await t.test("returns generic 503 responses when queries fail and recovers", async () => {
    await database.query("ALTER TABLE observations RENAME TO unavailable_observations");
    try {
      const history = await GET();
      assert.equal(history.status, 503);
      assert.deepEqual(await history.json(), {
        error: "Observation history is unavailable. Refresh to try again.",
      });
      const save = await submit(sample);
      assert.equal(save.status, 503);
      assert.deepEqual(await save.json(), {
        error: "Could not confirm the save. Your entries are still here. Check the history before retrying.",
      });
    } finally {
      await database.query("ALTER TABLE unavailable_observations RENAME TO observations");
    }
    assert.equal((await GET()).status, 200);
    assert.equal((await (await GET()).json()).length, 2);
  });
});
