import { useState } from "react";
import { summarizeMonitoring, type Observation } from "../lib/monitoring";

function countLabel(count: number | null) {
  return count === null ? "Not surveyed" : count.toLocaleString();
}

export default function MonitoringDashboard({ records }: { records: Observation[] }) {
  const summaries = summarizeMonitoring(records);
  const [selectedPlot, setSelectedPlot] = useState(summaries[0].id);
  const selected = summaries.find((plot) => plot.id === selectedPlot) ?? summaries[0];

  return (
    <div className="space-y-6">
      <p className="text-slate-700">
        Fictional observations only. Totals add counts across recorded surveys. Coverage shows how many surveys included each count.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {summaries.map((plot) => (
          <article key={plot.id} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="font-semibold text-emerald-950">{plot.name}</h3>
            <p className="mt-1 text-sm text-slate-700">{plot.surveys} surveys · {plot.surveyMinutes} minutes</p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm">Adult snails</dt>
                <dd className="font-semibold">{countLabel(plot.adults)}</dd>
                <dd className="text-sm text-slate-700">{plot.adultSurveys} of {plot.surveys} surveys counted</dd>
              </div>
              <div>
                <dt className="text-sm">Egg masses</dt>
                <dd className="font-semibold">{countLabel(plot.eggs)}</dd>
                <dd className="text-sm text-slate-700">{plot.eggSurveys} of {plot.surveys} surveys counted</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="space-y-3">
        <label className="block font-semibold">
          Observation trends by loʻi
          <select
            className="mt-2 block w-full max-w-xs rounded-lg border border-slate-400 bg-white p-2 font-normal"
            value={selectedPlot}
            onChange={(event) => setSelectedPlot(event.target.value)}
          >
            {summaries.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
          </select>
        </label>
        {selected.trend.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm tabular-nums">
              <caption className="mb-2 text-left text-slate-700">
                Daily totals for {selected.name}. Dates without survey records are omitted.
              </caption>
              <thead className="bg-stone-100">
                <tr>
                  <th scope="col" className="p-2">Date</th>
                  <th scope="col" className="p-2">Surveys</th>
                  <th scope="col" className="p-2">Adult snails</th>
                  <th scope="col" className="p-2">Egg masses</th>
                </tr>
              </thead>
              <tbody>
                {selected.trend.map((day) => (
                  <tr key={day.date} className="border-b border-stone-200">
                    <th scope="row" className="whitespace-nowrap p-2 font-medium">{day.date}</th>
                    <td className="p-2">{day.surveys}</td>
                    <td className="p-2">
                      {countLabel(day.adults)}
                      <span className="block text-slate-600">{day.adultSurveys} of {day.surveys} counted</span>
                    </td>
                    <td className="p-2">
                      {countLabel(day.eggs)}
                      <span className="block text-slate-600">{day.eggSurveys} of {day.surveys} counted</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No surveys recorded for {selected.name}.</p>}
      </div>
    </div>
  );
}
