import { test } from "node:test";
import assert from "node:assert/strict";
import { seedDemo, updateMatch } from "../server/bracket-engine.js";
import { defaultSettings, streamingView, validateSettings } from "../server/streaming.js";
import { defaultDesign, designRanges } from "../public/js/overlay-design.js";

test("espera sin LIVE y lee los resultados guardados sin duplicarlos", () => {
  const tournament = seedDemo();
  assert.equal(streamingView(tournament, defaultSettings).match, null);
  updateMatch(tournament, "r1-m1", { action: "save", state: "LIVE", scoreA: 3, scoreB: 2 });
  const view = streamingView(tournament, defaultSettings);
  assert.equal(view.match, tournament.rounds[0][0]);
  assert.equal(view.match.scoreA, 3);
  updateMatch(tournament, "r1-m1", { action: "save", state: "READY" });
  assert.equal(streamingView(tournament, defaultSettings).match, null);
});

test("varios LIVE requieren selección; selección obsoleta no muestra datos antiguos", () => {
  const tournament = seedDemo();
  for (const id of ["r1-m1", "r1-m3"]) updateMatch(tournament, id, { state: "LIVE" });
  assert.equal(streamingView(tournament, defaultSettings).match, null);
  const settings = { ...defaultSettings, selectedMatchId: "r1-m3", swapped: true };
  const before = structuredClone(tournament);
  assert.equal(streamingView(tournament, settings).match.id, "r1-m3");
  assert.deepEqual(tournament, before);
  updateMatch(tournament, "r1-m3", { state: "READY" });
  assert.equal(streamingView(tournament, settings).match.id, "r1-m1");
  updateMatch(tournament, "r1-m5", { state: "LIVE" });
  assert.equal(streamingView(tournament, settings).match, null);
});

test("finalizar conserva avance existente y retira el encuentro del overlay", () => {
  const tournament = seedDemo();
  const match = tournament.rounds[0][0];
  updateMatch(tournament, match.id, { state: "LIVE" });
  updateMatch(tournament, match.id, { action: "finalize", scoreA: 2, scoreB: 1, winnerId: match.teamA.id });
  assert.equal(tournament.rounds[1][0].teamA.id, match.teamA.id);
  assert.equal(streamingView(tournament, defaultSettings).match, null);
});

test("configuración no admite nombres ni resultados duplicados", () => {
  for (const patch of [{ scoreA: 3 }, { teamA: "Otro" }, { blueColor: "red" }, { swapped: "false" }, null]) assert.throws(() => validateSettings(patch));
  assert.deepEqual(validateSettings({ swapped: true, redColor: "#123abc" }), { swapped: true, redColor: "#123abc" });
});

test("diseño predeterminado válido y límites de personalización seguros", () => {
  assert.deepEqual(validateSettings({ ...defaultDesign }), defaultDesign);
  for (const [key, [min, max]] of Object.entries(designRanges)) {
    for (const value of [min - 1, max + 1, "40", null, NaN, Infinity]) assert.throws(() => validateSettings({ [key]: value }));
    assert.doesNotThrow(() => validateSettings({ [key]: min }));
    assert.doesNotThrow(() => validateSettings({ [key]: max }));
  }
  for (const patch of [{ fontFamily: "url(evil)" }, { fontFamily: "__proto__" }, { textColor: "white" }, { shimmer: 1 }]) assert.throws(() => validateSettings(patch));
});
