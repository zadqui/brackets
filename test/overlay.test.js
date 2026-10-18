import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { applyDesign, defaultDesign } from "../public/js/overlay-design.js";

test("overlay intercambia nombres con sus marcadores y limpia datos al esperar/desconectar", async () => {
  const handlers = {};
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: "", dataset: {}, clientWidth: 0, classList: { toggle() {} }, querySelector: node, style: { setProperty(key, value) { this[key] = value; } } });
    return nodes.get(id);
  };
  const source = (await readFile(new URL("../public/js/overlay.js", import.meta.url), "utf8")).replace(/^import .*;\r?\n/, "");
  vm.runInNewContext(source, {
    applyDesign, defaultDesign, URLSearchParams,
    location: { search: "" }, window: { innerWidth: 1920, addEventListener() {} },
    ResizeObserver: class { observe() {} },
    getComputedStyle: () => ({ paddingLeft: "0", paddingRight: "0" }),
    io: () => ({ on: (event, handler) => { handlers[event] = handler; } }),
    document: { getElementById: node, querySelector: node, createElement: () => ({ getContext: () => ({}) }), fonts: { ready: Promise.resolve(), addEventListener() {} } }
  });
  const view = { match: { teamA: { name: "Uno <texto>" }, teamB: { name: "Dos" }, scoreA: 7, scoreB: 2 }, settings: { swapped: false, blueColor: "#123456", redColor: "#abcdef" } };
  handlers["streaming:update"](view);
  assert.equal(node("blue-name").textContent, "Uno <texto>");
  assert.equal(node("blue-score").textContent, 7);
  view.settings.swapped = true;
  handlers["streaming:update"](view);
  assert.equal(node("blue-name").textContent, "Dos");
  assert.equal(node("blue-score").textContent, 2);
  assert.equal(node("red-score").textContent, 7);
  assert.equal(node(".blue").style["--side-color"], "#123456");
  handlers.disconnect();
  assert.equal(node("scoreboard").hidden, true);
  assert.equal(node("blue-name").textContent, "");
  handlers["streaming:update"](view);
  assert.equal(node("scoreboard").hidden, false);
  handlers["streaming:update"]({ match: null, waitingReason: "Esperando" });
  assert.equal(node("red-score").textContent, "");
  assert.equal(node("waiting").textContent, "Esperando");
  assert.equal(node("blue-name").dataset.name, "");
});
