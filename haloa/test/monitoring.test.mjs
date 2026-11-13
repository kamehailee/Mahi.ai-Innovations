import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeMonitoring } from "../src/lib/monitoring.ts";

test("shows all fictional plots even with no observations", () => {
  const plots = summarizeMonitoring([]);
  assert.equal(plots.length, 3);
  for (const plot of plots) {
    assert.deepEqual(
      [plot.surveys, plot.surveyMinutes, plot.adultSurveys, plot.eggSurveys],
      [0, 0, 0, 0],
    );
    assert.equal(plot.adults, null);
    assert.equal(plot.eggs, null);
    assert.deepEqual(plot.trend, []);
  }
});

test("aggregates by plot and date while distinguishing zero from unsurveyed", () => {
  const [first, second, third] = summarizeMonitoring([
    { plotId: "demo-1", date: "2026-10-04", adults: null, eggs: 0, minutes: 10 },
    { plotId: "demo-2", date: "2026-10-04", adults: 9, eggs: null, minutes: 30 },
    { plotId: "demo-1", date: "2026-10-01", adults: 0, eggs: null, minutes: 15 },
    { plotId: "demo-1", date: "2026-10-04", adults: null, eggs: 2, minutes: 5 },
  ]);

  assert.deepEqual(
    [first.adults, first.eggs, first.surveys, first.adultSurveys, first.eggSurveys, first.surveyMinutes],
    [0, 2, 3, 1, 2, 30],
  );
  assert.deepEqual(first.trend, [
    { date: "2026-10-01", adults: 0, eggs: null, surveys: 1, adultSurveys: 1, eggSurveys: 0 },
    { date: "2026-10-04", adults: null, eggs: 2, surveys: 2, adultSurveys: 0, eggSurveys: 2 },
  ]);
  assert.deepEqual([second.adults, second.eggs, second.surveys], [9, null, 1]);
  assert.equal(third.surveys, 0);
});
