import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../assets/masar-strategy-sim.js", import.meta.url), "utf8");
const window = { __MASAR_STRATEGY_SIM_TEST__: true };
const document = { readyState: "loading", addEventListener() {} };
const localStorage = { getItem() { return null; }, setItem() {} };
vm.runInNewContext(source, { window, document, localStorage, Date, Math, JSON, String, Number, Object, Array }, { timeout: 2000 });

const api = window.__MASAR_STRATEGY_SIM_TEST__;
assert.ok(api, "simulator exposes a test-only API");
assert.equal(api.requiresTradePlan("trade"), true, "trade decisions require a plan");
assert.equal(api.requiresTradePlan("wait"), false, "wait decisions do not require a plan");
assert.equal(api.requiresTradePlan("skip"), false, "skip decisions do not require a plan");

const completeLong = {
  side: "buy", entry: 100, stop: 98, target: 104, size: 2,
  reason: "ارتداد مؤكد من منطقة دعم بعد إغلاق شمعة رفض",
  cancel: "إغلاق شمعة أسفل منطقة الدعم",
  expectedSide: "buy", referencePrice: 100, averageRange: 0.5
};
const good = api.evaluateTradePlan(completeLong);
assert.equal(good.valid, true, "accepts a geometrically valid long plan");
assert.equal(good.riskDistance, 2, "calculates price risk distance");
assert.equal(good.rewardDistance, 4, "calculates price reward distance");
assert.equal(good.riskReward, 2, "calculates reward-to-risk ratio from price distances");
assert.equal(good.score, 100, "scores a complete, rule-aligned plan at 100");

const badGeometry = api.evaluateTradePlan({ ...completeLong, stop: 101 });
assert.equal(badGeometry.valid, false, "rejects a long plan whose stop is above entry");
assert.ok(badGeometry.errors.some(x => /وقف الخسارة/.test(x)), "explains invalid long stop placement");

const validShort = api.evaluateTradePlan({
  ...completeLong, side: "sell", stop: 102, target: 96, expectedSide: "sell"
});
assert.equal(validShort.valid, true, "accepts correctly ordered short prices");

const wrongDirection = api.evaluateTradePlan({ ...completeLong, side: "sell", stop: 102, target: 96 });
assert.equal(wrongDirection.valid, false, "rejects a plan that contradicts scenario direction");

const noSize = api.evaluateTradePlan({ ...completeLong, size: 0 });
assert.equal(noSize.valid, false, "requires a positive virtual position size");

const missingReason = api.evaluateTradePlan({ ...completeLong, reason: "سبب" });
assert.equal(missingReason.valid, false, "requires a meaningful entry rationale");

const missingInvalidation = api.evaluateTradePlan({ ...completeLong, cancel: "" });
assert.equal(missingInvalidation.valid, false, "requires an explicit invalidation condition");

const weakRR = api.evaluateTradePlan({ ...completeLong, target: 100.5 });
assert.equal(weakRR.valid, true, "keeps a geometrically valid low-RR plan reviewable");
assert.ok(weakRR.warnings.some(x => /أقل من 1/.test(x)), "warns when reward is below risk");

const distantEntry = api.evaluateTradePlan({ ...completeLong, entry: 104 });
assert.equal(distantEntry.valid, false, "rejects an entry price too far from the decision reference");

const invalidPrices = api.evaluateTradePlan({ ...completeLong, entry: 0 });
assert.equal(invalidPrices.valid, false, "rejects non-positive price values");

console.log("MASAR strategy simulator QA passed: plan requirement, long/short geometry, direction, distances, R:R, size, rationale, invalidation, warnings, and entry proximity.");
