export type Observation = {
  id: string;
  plotId: string;
  plot: string;
  date: string;
  adults: number | null;
  eggs: number | null;
  minutes: number;
  notes: string;
};

export const demoPlots = [
  { id: "demo-1", name: "Demo Loʻi 1" },
  { id: "demo-2", name: "Demo Loʻi 2" },
  { id: "demo-3", name: "Demo Loʻi 3" },
];

function emptyCounts() {
  return { adults: null as number | null, eggs: null as number | null, adultSurveys: 0, eggSurveys: 0, surveys: 0 };
}

function addSurvey(counts: ReturnType<typeof emptyCounts>, record: Observation) {
  counts.surveys++;
  if (record.adults !== null) {
    counts.adults = (counts.adults ?? 0) + record.adults;
    counts.adultSurveys++;
  }
  if (record.eggs !== null) {
    counts.eggs = (counts.eggs ?? 0) + record.eggs;
    counts.eggSurveys++;
  }
}

export function summarizeMonitoring(records: readonly Observation[]) {
  return demoPlots.map((plot) => {
    const totals = emptyCounts();
    const daily = new Map<string, ReturnType<typeof emptyCounts>>();
    let surveyMinutes = 0;
    for (const record of records) {
      if (record.plotId !== plot.id) continue;
      addSurvey(totals, record);
      surveyMinutes += record.minutes;
      const day = daily.get(record.date) ?? emptyCounts();
      addSurvey(day, record);
      daily.set(record.date, day);
    }
    const trend = [...daily.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([date, counts]) => ({ date, ...counts }));
    return { ...plot, ...totals, surveyMinutes, trend };
  });
}
