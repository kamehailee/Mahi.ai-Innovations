"use client";

import { useState, type FormEvent } from "react";

type Observation = {
  id: number;
  plot: string;
  date: string;
  adults: string;
  eggs: string;
  minutes: string;
  notes: string;
};

export default function Home() {
  const [records, setRecords] = useState<Observation[]>([]);

  function recordObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const observation: Observation = {
      id: Date.now(),
      plot: String(data.get("plot")),
      date: String(data.get("date")),
      adults: String(data.get("adults")),
      eggs: String(data.get("eggs")),
      minutes: String(data.get("minutes")),
      notes: String(data.get("notes")),
    };

    setRecords((previous) => [observation, ...previous]);
    form.reset();
  }

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
            Demonstration using fictional plots. Records stay on this
            screen only and disappear when you refresh. Database storage
            and AI features are not connected yet.
          </p>
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold">Record an observation</h2>

          <form onSubmit={recordObservation} className="space-y-5">
            <label className="block font-medium">
              Sample loʻi plot (required)
              <select name="plot" required className={inputStyle}>
                <option value="">Choose a plot</option>
                <option>Demo Loʻi 1</option>
                <option>Demo Loʻi 2</option>
                <option>Demo Loʻi 3</option>
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
              className="rounded-lg bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            >
              Add demonstration observation
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Observation history</h2>
          <p role="status">
            {records.length === 0
              ? "No observations recorded yet."
              : `${records.length} demonstration observation(s) recorded.`}
          </p>

          {records.map((record) => (
            <article
              key={record.id}
              className="space-y-2 rounded-xl border border-stone-300 bg-white p-6"
            >
              <h3 className="text-xl font-bold">{record.plot}</h3>
              <p>Date: {record.date}</p>
              <p>Adult snails: {record.adults || "Not surveyed"}</p>
              <p>Egg masses: {record.eggs || "Not surveyed"}</p>
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