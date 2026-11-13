import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { GET, POST } from "../src/app/api/observations/route.ts";

import { POST as login, DELETE as logout } from "../src/app/api/session/route.ts";

const origin = "http://localhost:3000";
process.env.HALOA_ORIGIN = origin;
process.env.HALOA_READER_KEY = randomUUID().replaceAll("-", "").repeat(2);
process.env.HALOA_EDITOR_KEY = randomUUID().replaceAll("-", "").repeat(2);
const endpoint = "http://localhost:3000/api/observations";
const sample = {
  plot: "demo-1",
  date: "2026-10-10",
  adults: "0",
  eggs: "",
  minutes: "15",
  notes: "Fictional survey",
};

async function signIn(key, requestOrigin = origin, url = origin) {
  return login(new Request(url + "/api/session", {
    method: "POST", headers: { origin: requestOrigin, "x-haloa-access-key": key },
  }));
}

async function cookieFor(key) {
  const response = await signIn(key);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

const editorCookie = await cookieFor(process.env.HALOA_EDITOR_KEY);
const readerCookie = await cookieFor(process.env.HALOA_READER_KEY);
function history(cookie = editorCookie) {
  return GET(new Request(endpoint, { headers: { cookie } }));
}

function submit(fields, headers) {
  return POST(new Request(endpoint, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { origin, cookie: editorCookie, ...headers },
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
  assert.equal((await POST(new Request(endpoint, { method: "POST", headers: { origin, cookie: editorCookie }, body: "plain text" }))).status, 415);
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
    headers: { origin, cookie: editorCookie, "Content-Type": "application/x-www-form-urlencoded" },
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
  assert.deepEqual(await (await history()).json(), []);
  assert.equal((await submit({ ...sample, plot: "other" })).status, 400);

  await t.test("retains zero and unsurveyed separately in storage and on a new read", async () => {
    const first = await submit(sample, { origin: "http://localhost:3000" });
    assert.equal(first.status, 201);
    const saved = await first.json();
    const second = await submit({ ...sample, plot: "demo-2", adults: "", eggs: "0" });
    assert.equal(second.status, 201);
    const secondSaved = await second.json();

    const response = await history();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await history(readerCookie)).headers.get("x-haloa-role"), "reader");
    assert.deepEqual(await response.json(), [
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
      const response = await history();
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
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
    assert.equal((await history()).status, 200);
    assert.equal((await (await history()).json()).length, 2);
  });
});

test("fails closed without configuration, a valid session, or write permission", async () => {
  assert.equal((await history("")).status, 401);
  assert.equal((await submit(sample, { cookie: "" })).status, 401);
  assert.equal((await history("haloa-local-session=" + "a".repeat(64))).status, 401);
  assert.equal((await history(editorCookie + "; " + editorCookie)).status, 401);
  assert.equal((await submit(sample, { cookie: readerCookie })).status, 403);
  assert.equal((await submit(sample, { origin: "null" })).status, 403);
  assert.equal((await POST(new Request(endpoint, {
    method: "POST", headers: { cookie: editorCookie }, body: new URLSearchParams(sample),
  }))).status, 403);
  delete process.env.HALOA_ORIGIN;
  try {
    assert.equal((await history()).status, 503);
    assert.equal((await submit(sample)).status, 503);
  } finally {
    process.env.HALOA_ORIGIN = origin;
  }
});

test("protects login and logout, expires sessions, and sets secure cookie flags", async (t) => {
  const key = process.env.HALOA_READER_KEY;
  assert.equal((await signIn(key, "https://example.org")).status, 403);
  assert.equal((await signIn("")).status, 401);
  const cookie = await cookieFor(key);
  const endSession = (requestOrigin) => logout(new Request(origin + "/api/session", {
    method: "DELETE", headers: { origin: requestOrigin, cookie },
  }));
  assert.equal((await endSession("https://example.org")).status, 403);
  const ended = await endSession(origin);
  assert.match(ended.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await history(cookie)).status, 401);

  const expiringCookie = await cookieFor(key);
  t.mock.method(Date, "now", () => new Date().getTime() + 3_600_001);
  assert.equal((await history(expiringCookie)).status, 401);
  t.mock.restoreAll();

  const secureOrigin = "https://demo.example.org";
  process.env.HALOA_ORIGIN = secureOrigin;
  try {
    const response = await signIn(key, secureOrigin, secureOrigin);
    assert.match(response.headers.get("set-cookie"),
      /^__Host-haloa-session=[a-f0-9]{64}; Path=\/; Max-Age=3600; HttpOnly; SameSite=Strict; Secure$/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    process.env.HALOA_ORIGIN = origin;
  }
});

test("limits repeated writes and sign-ins within a minute", async () => {
  let write;
  for (let i = 0; i <= 30; i++) write = await submit({ ...sample, plot: "" });
  assert.equal(write.status, 429);
  assert.ok(Number(write.headers.get("retry-after")) > 0);

  let attempt;
  for (let i = 0; i <= 10; i++) attempt = await signIn("");
  assert.equal(attempt.status, 429);
  assert.ok(Number(attempt.headers.get("retry-after")) > 0);
});
