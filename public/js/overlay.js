import { applyDesign, defaultDesign } from "./overlay-design.js";
const socket = io();
const $ = (id) => document.getElementById(id);
let currentSettings = { ...defaultDesign };
let previewDesign = null;
const isPreview = new URLSearchParams(location.search).has("preview") && window.parent !== window;
const measuringCanvas = document.createElement("canvas");
function fitNames() {
  const design = { ...currentSettings, ...previewDesign };
  const base = design.nameSize * window.innerWidth / 1920;
  const context = measuringCanvas.getContext("2d");
  for (const side of ["blue", "red"]) {
    const name = $(`${side}-name`);
    const style = getComputedStyle(name);
    const available = name.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 6;
    if (available <= 0) continue;
    context.font = `${style.fontWeight} ${base}px ${style.fontFamily}`;
    const original = name.dataset.originalName || name.textContent;
    const text = original.toUpperCase();
    const measured = context.measureText(text).width;
    let display = original;
    let size = Math.min(base, base * available / Math.max(1, measured));
    // Two balanced lines keep very long names readable instead of crushing
    // forty characters into one tiny line. No scaling or skew transforms.
    if (size < base * .72 && text.length > 1) {
      const characters = Array.from(original);
      let best;
      const wordBreaks = characters.flatMap((character, index) => character === " " && index > 0 ? [index] : []);
      const breaks = wordBreaks.length ? wordBreaks : characters.slice(1).map((_, index) => index + 1);
      for (const split of breaks) {
        const lines = [characters.slice(0, split).join("").trim(), characters.slice(split).join("").trim()];
        const width = Math.max(...lines.map((line) => context.measureText(line.toUpperCase()).width));
        if (!best || width < best.width) best = { lines, width };
      }
      if (best) {
        size = Math.min(base * .72, base * available / Math.max(1, best.width));
        display = best.lines.join("\n");
      }
    }
    name.textContent = display;
    name.dataset.name = display.toUpperCase();
    name.style.fontSize = `${size}px`;
    name.style.setProperty("--fitted-stroke", `${design.textStroke * size / 48}px`);
    name.style.setProperty("--fitted-shadow", `${design.shadowOffset * size / 48}px`);
  }
}
function updateDesign() {
  applyDesign($("scoreboard"), { ...currentSettings, ...previewDesign });
  fitNames();
}
window.addEventListener("message", (event) => {
  if (!isPreview || event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "overlay:preview-design") return;
  previewDesign = event.data.design;
  updateDesign();
});
window.addEventListener("resize", fitNames);
new ResizeObserver(fitNames).observe($("scoreboard"));
document.fonts.ready.then(fitNames);
document.fonts.addEventListener("loadingdone", fitNames);
function wait(message) {
  $("scoreboard").hidden = true;
  $("waiting").hidden = false;
  $("waiting").textContent = message;
  for (const id of ["blue-name", "red-name", "blue-score", "red-score"]) $(id).textContent = "";
  for (const side of ["blue", "red"]) {
    $(`${side}-name`).dataset.name = "";
    $(`${side}-name`).dataset.originalName = "";
  }
}
socket.on("disconnect", () => wait("Sin conexión. Esperando sincronización…"));
socket.on("connect_error", () => wait("Sin conexión. Esperando sincronización…"));
socket.on("streaming:update", ({ match, settings, waitingReason }) => {
  currentSettings = { ...defaultDesign, ...settings };
  updateDesign();
  if (!match) return wait(waitingReason);
  const blue = settings.swapped ? [match.teamB.name, match.scoreB] : [match.teamA.name, match.scoreA];
  const red = settings.swapped ? [match.teamA.name, match.scoreA] : [match.teamB.name, match.scoreB];
  for (const [side, values] of [["blue", blue], ["red", red]]) {
    $(`${side}-name`).textContent = values[0];
    $(`${side}-name`).dataset.originalName = values[0];
    $(`${side}-name`).dataset.name = values[0].toUpperCase();
    $(`${side}-score`).textContent = values[1];
  }
  $("waiting").hidden = true;
  $("scoreboard").hidden = false;
  fitNames();
});
