"use client";

import { useEffect, useState, type FormEvent } from "react";

import MonitoringDashboard from "./monitoring-dashboard";
import { demoPlots, type Observation } from "../lib/monitoring";

export default function Home() {
  const [records, setRecords] = useState<Observation[]>([]);
  const [plot, setPlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [role, setRole] = useState<"reader" | "editor" | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch("/api/observations", { signal: controller.signal });
        if (controller.signal.aborted || response.status === 401) return;
        if (!response.ok) throw new Error("Could not load history");
        const access = response.headers.get("x-haloa-role");
        const history: Observation[] = await response.json();
        if (!controller.signal.aborted) {
          setRecords(history);
          setRole(access === "editor" || access === "reader" ? access : null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError("Could not load observation history. Refresh to try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadHistory();
    return () => controller.abort();
  }, [sessionVersion]);

  async function changeSession(method: "POST" | "DELETE", key?: string) {
    setSessionBusy(true);
    setSessionError("");
    try {
      const response = await fetch("/api/session", {
        method,
        headers: key ? { "X-Haloa-Access-Key": key } : undefined,
      });
      if (!response.ok) {
        const { error } = await response.json();
        setSessionError(error);
        return;
      }
      setRecords([]);
      setRole(null);
      setLoadError("");
      setSaveError("");
      setLoading(true);
      setSessionVersion((version) => version + 1);
    } catch {
      setSessionError("Could not update your session. Try again.");
    } finally {
      setSessionBusy(false);
    }
  }

  async function recordObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || sessionBusy || role !== "editor") return;
    const form = event.currentTarget;
    const data = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      data.set(name, String(value));
    }
    setSaveError("");
    setSaving(true);

    try {
      const response = await fetch("/api/observations", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setRecords([]);
          setRole(null);
          setSessionError("Your session expired. Sign in again to continue.");
        }
        setSaveError(result.error ?? "Could not save the observation. Your entries are still here.");
        return;
      }

      setRecords((previous) => [result as Observation, ...previous]);
      form.reset();
    } catch {
      setSaveError("Could not confirm the save. Your entries are still here. Check the history before retrying.");
    } finally {
      setSaving(false);
    }
  }

  const visibleRecords = plot ? records.filter((record) => record.plotId === plot) : records;

  const inputStyle =
    "mt-2 block w-full rounded-lg border border-slate-400 bg-white p-3 text-slate-950";

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="font-semibold text-emerald-800">
            Mahi.ai Innovations
          </p>
          <h1 className="text-4xl font-bold">Hāloa</h1>
          <p className="text-xl">Loʻi observation journal</p>
          <p className="rounded-lg border border-amber-500 bg-amber-50 p-4">
            Demonstration using fictional plots. Use simulated observations only.
            Saved records are available when you return to this journal.
          </p>
          {role && (
            <nav aria-label="Journal sections" className="flex flex-wrap gap-4">
              <a className="font-medium text-emerald-800 underline" href="#journal">Record an observation</a>
              <a className="font-medium text-emerald-800 underline" href="#monitoring">Monitoring dashboard</a>
            </nav>
          )}
          {role && (
            <button type="button" disabled={sessionBusy || saving} onClick={() => void changeSession("DELETE")}
              className="rounded-lg border border-emerald-800 px-4 py-2 font-semibold">
              Sign out
            </button>
          )}
          {!role && !loading && (
            <form method="post" action="/api/session" className="space-y-3" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const key = String(new FormData(form).get("key") ?? "");
              form.reset();
              void changeSession("POST", key);
            }}>
              <label className="block font-medium">
                Demo access key
                <input name="key" type="password" required minLength={64} maxLength={64} className={inputStyle} />
              </label>
              <button type="submit" disabled={sessionBusy} className="rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white">
                Sign in
              </button>
            </form>
          )}
          {sessionError && <p role="alert" className="text-red-800">{sessionError}</p>}
          {loading && !role && <p role="status">Checking demo access…</p>}
          {loadError && !role && <p role="alert" className="text-red-800">{loadError}</p>}
        </header>

        <section id="journal" hidden={!role} className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold">Record an observation</h2>

          <form onSubmit={recordObservation}>
            {role === "reader" && <p className="mb-4">Your demo access is read-only.</p>}
            <fieldset disabled={saving || sessionBusy || role !== "editor"} className="space-y-5">
              <label className="block font-medium">
                Sample loʻi plot (required)
                <select
                  name="plot"
                  required
                  value={plot}
                  onChange={(event) => setPlot(event.target.value)}
                  className={inputStyle}
                >
                  <option value="">Choose a plot</option>
                  {demoPlots.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>

              <label className="block font-medium">
                Observation date (required)
                <input
                  name="date"
                  type="date"
                  required
                  className={inputStyle}
                />
              </label>

              <p id="count-help" className="text-slate-700">
                Leave counts blank if not surveyed. Enter 0 only when
                surveyed and none were found.
              </p>

              <label className="block font-medium">
                Adult snails observed
                <input
                  name="adults"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  aria-describedby="count-help"
                  className={inputStyle}
                />
              </label>

              <label className="block font-medium">
                Egg masses observed
                <input
                  name="eggs"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  aria-describedby="count-help"
                  className={inputStyle}
                />
              </label>

              <label className="block font-medium">
                Survey duration in minutes (required)
                <input
                  name="minutes"
                  type="number"
                  min="1"
                  max="2147483647"
                  step="1"
                  required
                  className={inputStyle}
                />
              </label>

              <label className="block font-medium">
                Crop damage and field notes
                <textarea
                  name="notes"
                  rows={4}
                  maxLength={2000}
                  className={inputStyle}
                />
              </label>

              <button
                type="submit"
                disabled={loading || saving}
                className="rounded-lg bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Add demonstration observation"}
              </button>
            </fieldset>
            {saveError && (
              <p role="alert" className="mt-4 text-red-800">{saveError}</p>
            )}
          </form>
        </section>

        <section id="monitoring" hidden={!role} aria-labelledby="monitoring-heading" className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <h2 id="monitoring-heading" className="text-2xl font-bold">Apple Snail Monitoring Dashboard</h2>
          {loading ? (
            <p role="status">Loading monitoring data…</p>
          ) : loadError ? (
            <p>Monitoring data is unavailable. Refresh to try again.</p>
          ) : <MonitoringDashboard records={records} />}
        </section>

        <section hidden={!role} className="space-y-4">
          <h2 className="text-2xl font-bold">Observation history</h2>
          {loadError && <p role="alert" className="text-red-800">{loadError}</p>}
          {!loadError && (
            <p role="status">
              {loading ? "Loading observation history…" : `${visibleRecords.length} saved demonstration observation(s).`}
            </p>
          )}

          {visibleRecords.map((record) => (
            <article
              key={record.id}
              className="space-y-2 rounded-xl border border-stone-300 bg-white p-6"
            >
              <h3 className="text-xl font-bold">{record.plot}</h3>
              <p>Date: {record.date}</p>
              <p>Adult snails: {record.adults ?? "Not surveyed"}</p>
              <p>Egg masses: {record.eggs ?? "Not surveyed"}</p>
              <p>Survey duration: {record.minutes} minutes</p>
              <p className="whitespace-pre-wrap">
                Notes: {record.notes || "None recorded"}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
