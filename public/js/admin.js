let tournament;
const $ = (selector) => document.querySelector(selector);
async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error inesperado");
  return data;
}
async function boot() {
  const session = await api("/api/session");
  if (session.authenticated) showControl(await api("/api/tournament"));
}
function showControl(data) {
  tournament = data;
  $("#login-panel").classList.add("hidden");
  $("#control-panel").classList.remove("hidden");
  $("#admin-title").textContent = data.name;
  fillSettings();
  renderMatches();
}
function fillSettings() {
  $("#tournament-name").value = tournament.name;
  $("#tournament-category").value = tournament.category;
  $("#tournament-tagline").value = tournament.tagline || "";
  $("#tournament-logo").value = tournament.logoUrl || "";
  $("#tournament-status").value = tournament.status;
  $("#team-count").value = tournament.participants.length;
  renderTeamFields();
}
function renderTeamFields() {
  const count = Number($("#team-count").value);
  const teams = tournament?.participants || [];
  $("#team-fields").innerHTML = Array.from({ length: count }, (_, index) => `<label class="team-field"><span>${String(index + 1).padStart(2, "0")}</span><input maxlength="40" data-team-index="${index}" value="${escapeHtml(teams[index]?.name || `Equipo ${index + 1}`)}" required></label>`).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}
function roundTitle(round, totalRounds) {
  const names = ["", "DIECISEISAVOS DE FINAL", "OCTAVOS DE FINAL", "CUARTOS DE FINAL", "SEMIFINALES", "GRAN FINAL"];
  const initialParticipants = tournament.rounds[0].length * 2;
  const exponent = Math.log2(initialParticipants);
  return names[5 - exponent + round] || `RONDA ${round}`;
}
function matchName(match, totalRounds) {
  if (match.round === totalRounds) return "GRAN FINAL";
  const title = roundTitle(match.round, totalRounds).replace("SEMIFINALES", "SEMIFINAL");
  return `${title} ${match.round === 1 ? match.position / 2 + 1 : match.position + 1}`;
}
function renderMatches() {
  const totalRounds = tournament.rounds.length;
  $("#matches").innerHTML = tournament.rounds.map((matches, index) => `<section class="admin-round"><h2 class="admin-round-title">${roundTitle(index + 1, totalRounds)}</h2><div class="round-match-list">${matches.map((match) => matchTemplate(match, totalRounds)).join("")}</div></section>`).join("");
  document.querySelectorAll("[data-save-match]").forEach((button) => button.addEventListener("click", () => saveMatch(button.dataset.saveMatch)));
  document.querySelectorAll("[data-finish-match]").forEach((button) => button.addEventListener("click", () => finishMatch(button.dataset.finishMatch)));
  document.querySelectorAll("[data-edit-match]").forEach((button) => button.addEventListener("click", () => editMatch(button.dataset.editMatch)));
}
function matchTemplate(match, totalRounds) {
  const locked = match.state === "FINISHED";
  const canPlay = Boolean(match.teamA && match.teamB);
  const disabled = locked || !canPlay ? "disabled" : "";
  const state = match.state === "PENDING" || match.state === "READY" ? "LIVE" : match.state;
  return `<article class="admin-match ${locked ? "locked" : ""}"><h3>${matchName(match, totalRounds)} <small>${match.id.toUpperCase()}</small></h3><small>${match.teamA?.name || "POR DEFINIR"} vs ${match.teamB?.name || "POR DEFINIR"}</small><div class="match-controls"><input id="${match.id}-a" type="number" min="0" value="${match.scoreA}" ${disabled}><input id="${match.id}-b" type="number" min="0" value="${match.scoreB}" ${disabled}><select id="${match.id}-state" ${disabled}><option value="LIVE" ${state === "LIVE" ? "selected" : ""}>EN JUEGO</option><option value="READY" ${state === "READY" ? "selected" : ""}>LISTO</option><option value="PENDING" ${state === "PENDING" ? "selected" : ""}>PENDIENTE</option></select><select id="${match.id}-winner" ${disabled}><option value="">Seleccionar ganador</option><option value="${match.teamA?.id || ""}" ${match.winnerId === match.teamA?.id ? "selected" : ""}>${match.teamA?.name || "Equipo A"}</option><option value="${match.teamB?.id || ""}" ${match.winnerId === match.teamB?.id ? "selected" : ""}>${match.teamB?.name || "Equipo B"}</option></select><button class="button yellow" data-save-match="${match.id}" ${disabled}>GUARDAR RESULTADO</button><button class="button lime" data-finish-match="${match.id}" ${disabled}>FINALIZAR ENFRENTAMIENTO</button>${locked ? `<button class="button dark" data-edit-match="${match.id}">EDITAR RESULTADO</button><p class="confirmed-result">GANADOR: ${escapeHtml(match.winnerId === match.teamA?.id ? match.teamA.name : match.teamB?.name || "POR DEFINIR")}</p>` : ""}</div></article>`;
}
async function saveMatch(id) {
  try {
    const state = $(`#${id}-state`).value;
    await updateMatch(id, { action: "save", state, scoreA: Number($(`#${id}-a`).value), scoreB: Number($(`#${id}-b`).value) });
  } catch (error) { alert(error.message); }
}
async function finishMatch(id, confirmDependencyInvalidation = false) {
  const body = { action: "finalize", scoreA: Number($(`#${id}-a`).value), scoreB: Number($(`#${id}-b`).value), winnerId: $(`#${id}-winner`).value || undefined, confirmDependencyInvalidation };
  try {
    await updateMatch(id, body);
  } catch (error) {
    if (!confirmDependencyInvalidation && error.message.includes("Confirma la invalidación")) {
      if (confirm(`${error.message}\n\n¿Deseas invalidar los resultados dependientes?`)) await finishMatch(id, true);
      return;
    }
    alert(error.message);
  }
}
async function updateMatch(id, body) {
  showControl(await api(`/api/matches/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
}
async function editMatch(id) {
  if (!confirm("El resultado quedará editable. Si cambias el ganador, se revisarán las rondas posteriores.")) return;
  try { await updateMatch(id, { action: "edit" }); } catch (error) { alert(error.message); }
}
$("#login-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); showControl(await api("/api/tournament")); } catch (error) { $("#login-error").textContent = error.message; } });
$("#tournament-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!confirm("¿Guardar la configuración? Esto reiniciará los enfrentamientos del bracket.")) return; const participants = [...document.querySelectorAll("[data-team-index]")].map((input, index) => ({ id: `team-${index + 1}`, name: input.value.trim(), seed: index + 1 })); try { showControl(await api("/api/tournament", { method: "PUT", body: JSON.stringify({ name: $("#tournament-name").value.trim(), category: $("#tournament-category").value.trim(), tagline: $("#tournament-tagline").value.trim(), logoUrl: $("#tournament-logo").value.trim(), status: $("#tournament-status").value, participants }) })); $("#settings-error").textContent = "Configuración guardada."; } catch (error) { $("#settings-error").textContent = error.message; } });
$("#team-count").addEventListener("change", renderTeamFields);
$("#demo").addEventListener("click", async () => { if (confirm("¿Cargar el torneo demo y reemplazar el estado actual?")) showControl(await api("/api/tournament/demo", { method: "POST" })); });
$("#logout").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }); location.reload(); });
boot();
