const $ = (id) => document.getElementById(id);
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
socket.on("connect", () => { $("connection").textContent = "Conectado · sincronizando"; });
socket.on("disconnect", () => { $("connection").textContent = "Sin conexión"; $("settings").hidden = true; });
socket.on("streaming:update", (view) => {
  $("connection").textContent = "Conectado · datos sincronizados";
  session().catch((error) => { $("message").textContent = error.message; });
  const { liveMatches, settings } = view;
  const nextSignature = JSON.stringify([liveMatches.map((m) => [m.id, m.teamA.name, m.teamB.name]), settings]);
  if (signature === nextSignature) return;
  signature = nextSignature;
  $("match").replaceChildren(new Option(liveMatches.length > 1 ? "Selecciona un enfrentamiento" : "Selección automática", ""), ...liveMatches.map((m) => new Option(`${m.id}: ${m.teamA.name} vs ${m.teamB.name}`, m.id)));
  $("match").value = liveMatches.some((m) => m.id === settings.selectedMatchId) ? settings.selectedMatchId : "";
  $("match").disabled = liveMatches.length < 2;
  $("selection-help").textContent = view.waitingReason || `En OBS: ${view.match.teamA.name} vs ${view.match.teamB.name}`;
  $("swapped").checked = settings.swapped;
  $("blue").value = settings.blueColor;
  $("red").value = settings.redColor;
});
$("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); await session(); $("message").textContent = "Sesión iniciada."; }
  catch (error) { $("message").textContent = error.message; }
});
$("settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/streaming", { method: "PATCH", body: JSON.stringify({ selectedMatchId: $("match").disabled ? null : $("match").value || null, swapped: $("swapped").checked, blueColor: $("blue").value, redColor: $("red").value }) });
    $("message").textContent = "Streaming guardado y enviado a OBS.";
  } catch (error) { $("message").textContent = error.message; }
});
session().catch((error) => { $("message").textContent = error.message; });
