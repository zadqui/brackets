import { defaultDesign } from "./overlay-design.js";
const $ = (id) => document.getElementById(id);
const designInputs = [...document.querySelectorAll("[data-design]")];
let design = { ...defaultDesign };
let pendingDesign = {};
let savingDesign = false;
let designSave;
let saveTimer;
function previewDesign() {
  $("overlay-preview").contentWindow.postMessage({ type: "overlay:preview-design", design }, location.origin);
}
function fillDesign() {
  for (const input of designInputs) {
    if (input.type === "checkbox") input.checked = design[input.dataset.design];
    else input.value = design[input.dataset.design];
  }
  previewDesign();
}
function saveDesign() {
  if (savingDesign) return designSave;
  if (!Object.keys(pendingDesign).length) return Promise.resolve(true);
  designSave = persistDesign();
  return designSave;
}
async function persistDesign() {
  savingDesign = true;
  $("design-status").textContent = "Guardando diseño…";
  try {
    while (Object.keys(pendingDesign).length) {
      const patch = pendingDesign;
      pendingDesign = {};
      try { await api("/api/streaming", { method: "PATCH", body: JSON.stringify(patch) }); }
      catch (error) { pendingDesign = { ...patch, ...pendingDesign }; throw error; }
    }
    $("design-status").textContent = "Diseño guardado y sincronizado con OBS.";
    return true;
  } catch (error) {
    $("design-status").textContent = `No se pudo guardar: ${error.message}. Usa Guardar Streaming para reintentar.`;
    return false;
  } finally { savingDesign = false; }
}
for (const input of designInputs) input.addEventListener("input", () => {
  if (!input.checkValidity() || (input.type === "number" && input.value === "")) return;
  const key = input.dataset.design;
  const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
  design[key] = value;
  pendingDesign[key] = value;
  previewDesign();
  $("design-status").textContent = "Vista previa actualizada · guardando…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDesign, 180);
});
$("reset-design").addEventListener("click", () => {
  design = { ...defaultDesign };
  pendingDesign = { ...defaultDesign };
  fillDesign();
  clearTimeout(saveTimer);
  saveDesign();
});
$("overlay-preview").addEventListener("load", previewDesign);
window.addEventListener("pagehide", () => {
  if (Object.keys(pendingDesign).length) fetch("/api/streaming", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingDesign), keepalive: true });
});
async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error inesperado");
  return data;
}
async function session() {
  const { authenticated } = await api("/api/session");
  $("login").hidden = authenticated;
  $("settings").hidden = !authenticated;
}
$("obs-url").value = `${location.origin}/overlay-ingame.html`;
const socket = io();
let signature;
socket.on("connect", () => { $("connection").textContent = "Conectado · sincronizando"; saveDesign(); });
socket.on("disconnect", () => { $("connection").textContent = "Sin conexión"; $("settings").hidden = true; });
socket.on("streaming:update", (view) => {
  $("connection").textContent = "Conectado · datos sincronizados";
  session().catch((error) => { $("message").textContent = error.message; });
  const { liveMatches, settings } = view;
  if (!savingDesign && !Object.keys(pendingDesign).length) {
    design = { ...defaultDesign, ...Object.fromEntries(Object.keys(defaultDesign).map((key) => [key, settings[key] ?? defaultDesign[key]])) };
    fillDesign();
  }
  $("selection-help").textContent = view.waitingReason || `En OBS: ${view.match.teamA.name} vs ${view.match.teamB.name}`;
  const nextSignature = JSON.stringify([liveMatches.map((m) => [m.id, m.teamA.name, m.teamB.name]), settings.selectedMatchId, settings.swapped]);
  if (signature === nextSignature) return;
  signature = nextSignature;
  $("match").replaceChildren(new Option(liveMatches.length > 1 ? "Selecciona un enfrentamiento" : "Selección automática", ""), ...liveMatches.map((m) => new Option(`${m.id}: ${m.teamA.name} vs ${m.teamB.name}`, m.id)));
  $("match").value = liveMatches.some((m) => m.id === settings.selectedMatchId) ? settings.selectedMatchId : "";
  $("match").disabled = liveMatches.length < 2;
  $("swapped").checked = settings.swapped;
});
$("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); await session(); $("message").textContent = "Sesión iniciada."; }
  catch (error) { $("message").textContent = error.message; }
});
$("settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!await saveDesign()) return;
    await api("/api/streaming", { method: "PATCH", body: JSON.stringify({ selectedMatchId: $("match").disabled ? null : $("match").value || null, swapped: $("swapped").checked }) });
    $("message").textContent = "Streaming guardado y enviado a OBS.";
  } catch (error) { $("message").textContent = error.message; }
});
session().catch((error) => { $("message").textContent = error.message; });
