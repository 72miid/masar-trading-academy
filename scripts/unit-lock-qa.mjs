import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { readFileSync as readText } from "node:fs";

const source = readFileSync(new URL("../assets/masar-unit-access.js", import.meta.url), "utf8");
const window = {};
vm.runInNewContext(source, { window, Array, Number, Set, Object, Math });
const access = window.MASARUnitAccess;
assert.ok(access, "unit access rules are available to the app and QA");

assert.equal(access.isUnlocked(0, [], 10), true, "the first unit is available to a new learner");
assert.equal(access.isUnlocked(1, [], 10), false, "the next unit stays locked before passing the current quiz");
assert.equal(access.isPassingScore(3), false, "3/5 does not pass");
assert.equal(access.isUnlocked(1, [], 10), false, "a failed attempt does not unlock the next unit");
assert.equal(access.isPassingScore(4), true, "4/5 meets the pass requirement");
assert.equal(access.isUnlocked(1, [0], 10), true, "passing the first quiz unlocks the next unit");
assert.equal(access.isUnlocked(0, [0], 10), true, "a completed unit remains available for review");
assert.equal(access.isUnlocked(2, [0], 10), false, "later units remain locked until all earlier units are complete");
assert.equal(access.isUnlocked(3, [0, 2], 10), false, "a skipped completion record cannot bypass a prerequisite");
assert.equal(access.isUnlocked(1.5, [0], 10), false, "fractional unit indices are rejected");
assert.equal(access.isUnlocked(-1, [], 10), false, "negative unit indices are rejected");
assert.equal(access.isUnlocked(10, Array.from({ length: 10 }, (_, i) => i), 10), false, "indices beyond the curriculum are rejected");

const academy = readText(new URL("../index.html", import.meta.url), "utf8");
const lines = academy.split(/\r?\n/);
const getLine = name => lines.find(line => new RegExp(`^\\s*function ${name}\\(`).test(line));
const integrationFunctions = ["unitUnlocked", "renderUnits", "openUnit", "submitUnitQuiz"].map(name => {
  const line = getLine(name);
  assert.ok(line, `academy integration function exists: ${name}`);
  return line;
});
const navigationLine = getLine("nextUnit");
assert.ok(navigationLine?.includes("function prevUnit()"), "next and previous navigation handlers are present together");
integrationFunctions.push(navigationLine);
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { id, innerHTML: "", textContent: "", value: "", disabled: false, style: {}, classList: { add(){}, remove(){}, toggle(){} } });
  return nodes.get(id);
};
const unitCount = 2;
const questions = Array.from({length:5},(_,index)=>[`السؤال ${index+1}`,["صحيح","خطأ"],0]);
const units = Array.from({length:unitCount},(_,index)=>({title:`وحدة ${index+1}`,intro:"مقدمة",content:[["عنوان","شرح"]],key:"خلاصة",exercise:"تطبيق",quiz:questions}));
let answers = [];
const document = { getElementById:node, querySelector(selector){const match=selector.match(/uq(\d+)/);const value=match?answers[Number(match[1])]:null;return value===undefined?null:{value:String(value)}} };
const context = { window:{}, document, localStorage:{getItem(){return ""}}, units, state:{completed:[],scores:{}}, currentUnit:0, quizAnswers:{}, renderLessonVisual(){}, showView(){}, saveState(){}, renderUnits:null, MASARUnitAccess:access, console, Number, Math, Array, String, Object };
vm.runInNewContext([...integrationFunctions].join("\n"), context, {timeout:2000});
context.renderUnits();
assert.match(node("unitGrid").innerHTML,/disabled onclick="openUnit\(1\)"/,"the curriculum list disables a locked unit");
assert.equal(vm.runInNewContext("openUnit(1)",context),false,"direct openUnit call cannot open a locked unit");
context.nextUnit();
assert.equal(context.currentUnit,0,"next navigation cannot skip an uncompleted unit");
answers=[0,0,0,1,1];context.submitUnitQuiz();
assert.deepEqual(Array.from(context.state.completed),[],"3/5 leaves the current unit incomplete");
answers=[0,0,0,0,1];context.submitUnitQuiz();
assert.deepEqual(Array.from(context.state.completed),[0],"4/5 marks the unit complete");
context.nextUnit();
assert.equal(context.currentUnit,1,"the next button opens the newly unlocked unit");
context.prevUnit();
assert.equal(context.currentUnit,0,"previous navigation allows reviewing a completed unit");
context.renderUnits();
assert.match(node("unitGrid").innerHTML,/مراجعة الوحدة/,"completed units remain available from the list for review");

console.log("MASAR unit lock QA passed: helper rules plus live academy list/direct-open/next/previous/quiz paths, 4/5 threshold, retry lock, completed-unit review, prerequisites, and invalid indices.");
