"use client";

import { useEffect, useState, type FormEvent } from "react";

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

export default function Home() {
  const [records, setRecords] = useState<Observation[]>([]);
  const [plot, setPlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch("/api/observations", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load history");
        const history: Observation[] = await response.json();
        if (!controller.signal.aborted) setRecords(history);
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
  }, []);

  async function recordObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading) return;
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
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold">Record an observation</h2>

          <form onSubmit={recordObservation}>
            <fieldset disabled={saving} className="space-y-5">
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
                  <option value="demo-1">Demo Loʻi 1</option>
                  <option value="demo-2">Demo Loʻi 2</option>
                  <option value="demo-3">Demo Loʻi 3</option>
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

        <section className="space-y-4">
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
