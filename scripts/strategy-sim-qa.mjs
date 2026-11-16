import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../assets/masar-strategy-sim.js", import.meta.url), "utf8");
const saved = new Map();
const localStorage = { getItem(key) { return saved.get(key) ?? null; }, setItem(key, value) { saved.set(key, String(value)); } };
const nodes = { srScore: { textContent: "" }, srHistory: { textContent: "" } };
const document = { readyState: "loading", addEventListener() {}, getElementById(id) { return nodes[id] || null; } };
const window = { __MASAR_STRATEGY_SIM_TEST__: true };
vm.runInNewContext(source, { window, document, localStorage, Date, Math, JSON, String, Number, Object, Array }, { timeout: 2000 });

const api = window.__MASAR_STRATEGY_SIM_TEST__;
assert.ok(api, "simulator exposes a test-only API");
assert.equal(api.requiresTradePlan("trade"), true, "trade decisions require a plan");
assert.equal(api.requiresTradePlan("wait"), false, "wait decisions do not require a plan");
assert.equal(api.requiresTradePlan("skip"), false, "skip decisions do not require a plan");
const cleanedReplay = api.cleanCompletedForTest({
  "sr-zones_0": { ok: true, decision: "wait", score: 100 },
  "sr-zones_3": { ok: true, decision: "wait", score: 100 },
  "unknown_0": { ok: true, decision: "wait", score: 100 },
  "sr-zones_1": { ok: true, decision: "wait", score: 101 },
  "sr-zones_2": { ok: "yes", decision: "wait", score: 100 }
});
assert.deepEqual(Object.keys(cleanedReplay), ["sr-zones_0"], "malformed and out-of-range replay records are excluded from the 18 valid scenarios");
api.recordAttemptForTest("sr-zones_0", { ok: true, decision: "trade", score: 92, at: "2026-11-16T12:00:00Z" });
const savedReplay = JSON.parse(localStorage.getItem("masar_strategy_replay_v1"));
assert.equal(savedReplay["sr-zones_0"].score, 92, "a completed strategy replay is persisted under its strategy/scenario key");
const restoredNodes = { srScore: { textContent: "" }, srHistory: { textContent: "" } };
const restoredWindow = {};
const restoredDocument = { readyState: "loading", addEventListener() {}, getElementById(id) { return restoredNodes[id] || null; } };
vm.runInNewContext(source, { window: restoredWindow, document: restoredDocument, localStorage, Date, Math, JSON, String, Number, Object, Array }, { timeout: 2000 });
restoredWindow.masarReloadStrategyProgress();
assert.match(restoredNodes.srScore.textContent, /1 \/ 18 سيناريو · 1 قرارات متوافقة · 92 نقطة/, "a page reload restores the saved simulator attempt and score");
localStorage.setItem = () => { throw new Error("storage full"); };
assert.equal(api.recordAttemptForTest("sr-zones_1", { ok: false, decision: "skip", score: 0 }), false, "storage failures are reported instead of appearing to save");
assert.ok(source.includes("تعذر حفظ المحاولة على هذا الجهاز"), "the simulator explains when local persistence fails");

for (let i = 0; i < 6; i++) {
  const validBars = api.scenarioBars(i, 0);
  const falseBars = api.scenarioBars(i, 1);
  assert.ok(validBars[23].c > validBars[22].c, `valid scenario ${i + 1} shows a bullish confirmation candle before the decision`);
  assert.ok(falseBars[23].c < falseBars[22].c, `failed scenario ${i + 1} shows visible bearish failure before the decision`);
  const rangeBars = api.scenarioBars(i, 2);
  assert.ok(Math.abs(rangeBars[23].c - rangeBars[0].c) < 0.25, `range scenario ${i + 1} does not imply a directional trend`);
}

const completeLong = {
  side: "buy", entry: 100, stop: 98, target: 104, size: 2,
  reason: "ارتداد مؤكد من منطقة دعم بعد إغلاق شمعة رفض",
  cancel: "إغلاق شمعة أسفل منطقة الدعم",
  expectedSide: "buy", referencePrice: 100, averageRange: 0.5, structureLow: 99.8, structureHigh: 100.2
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

const insideStructure = api.evaluateTradePlan({ ...completeLong, stop: 99.9 });
assert.equal(insideStructure.valid, false, "rejects a buy stop that remains inside nearby invalidating structure");
assert.ok(insideStructure.errors.some(x => /قاع البنية/.test(x)), "explains structural stop placement");

const wrongDirection = api.evaluateTradePlan({ ...completeLong, side: "sell", stop: 102, target: 96 });
assert.equal(wrongDirection.valid, false, "rejects a plan that contradicts scenario direction");

const noSize = api.evaluateTradePlan({ ...completeLong, size: 0 });
assert.equal(noSize.valid, false, "requires a positive virtual position size");

const missingReason = api.evaluateTradePlan({ ...completeLong, reason: "سبب" });
assert.equal(missingReason.valid, false, "requires a meaningful entry rationale");

const missingInvalidation = api.evaluateTradePlan({ ...completeLong, cancel: "" });
assert.equal(missingInvalidation.valid, false, "requires an explicit invalidation condition");

const vagueReason = api.evaluateTradePlan({ ...completeLong, reason: "أعتقد أن السعر سيصعد بقوة" });
assert.equal(vagueReason.valid, false, "requires a technical signal in the entry rationale");
assert.ok(vagueReason.errors.some(x => /إشارة فنية محددة/.test(x)), "explains what a useful rationale must identify");

const vagueCancel = api.evaluateTradePlan({ ...completeLong, cancel: "إذا تغير رأيي لاحقاً" });
assert.equal(vagueCancel.valid, false, "requires an observable invalidation condition");
assert.ok(vagueCancel.errors.some(x => /شرط إلغاء قابل للملاحظة/.test(x)), "explains that invalidation must be observable");

const weakRR = api.evaluateTradePlan({ ...completeLong, target: 100.5 });
assert.equal(weakRR.valid, true, "keeps a geometrically valid low-RR plan reviewable");
assert.ok(weakRR.warnings.some(x => /أقل من مسافة المخاطرة/.test(x)), "warns when reward is below risk");

const distantEntry = api.evaluateTradePlan({ ...completeLong, entry: 104 });
assert.equal(distantEntry.valid, false, "rejects an entry price too far from the decision reference");

const invalidPrices = api.evaluateTradePlan({ ...completeLong, entry: 0 });
assert.equal(invalidPrices.valid, false, "rejects non-positive price values");

console.log("MASAR strategy simulator QA passed: plan requirement, long/short geometry, direction, distances, R:R, size, rationale, invalidation, warnings, entry proximity, sanitized 18-scenario state, persistence, and reload restoration.");
