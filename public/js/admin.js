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
  renderStreaming();
}
function streamingState() {
  return tournament.streaming || {
    currentMatchId: null,
    draftOverlay: { title: "PLAYOFFS", subtitle: "", mapModeText: "", teamLeftPicks: [null, null, null], teamRightPicks: [null, null, null], bans: [], seriesScoreLeft: 0, seriesScoreRight: 0, status: "DRAFT", swapped: false },
    ingameOverlay: { teamLeftScore: 0, teamRightScore: 0, leftSideColor: "blue", rightSideColor: "red", status: "EN JUEGO", swapped: false }
  };
}
function allMatches() {
  return tournament.rounds.flat().map((match) => ({ ...match, roundName: match.round === tournament.rounds.length ? "Gran final" : match.round === tournament.rounds.length - 1 ? "Semifinal" : `Ronda ${match.round}` }));
}
function renderStreaming() {
  const streaming = streamingState();
  const draft = streaming.draftOverlay;
  const game = streaming.ingameOverlay;
  const select = $("#stream-match");
  const statusRank = { LIVE: 0, READY: 1, PENDING: 2, FINISHED: 3 };
  const ordered = allMatches().sort((a, b) => statusRank[a.state] - statusRank[b.state]);
  select.innerHTML = `<option value="">Sin enfrentamiento</option>${ordered.map((match) => `<option value="${match.id}" ${match.id === streaming.currentMatchId ? "selected" : ""}>${match.roundName} · ${match.id.toUpperCase()} · ${match.teamA?.name || "POR DEFINIR"} vs ${match.teamB?.name || "POR DEFINIR"} · ${match.state}</option>`).join("")}`;
  const match = tournament.rounds.flat().find((item) => item.id === streaming.currentMatchId);
  $("#stream-match-preview").textContent = match ? `${match.teamA?.name || "POR DEFINIR"} vs ${match.teamB?.name || "POR DEFINIR"}` : "No hay enfrentamiento conectado.";
  $("#draft-title").value = draft.title;
  $("#draft-subtitle").value = draft.subtitle;
  $("#draft-map").value = draft.mapModeText;
  $("#draft-status").value = draft.status;
  $("#draft-score-left").value = draft.seriesScoreLeft;
  $("#draft-score-right").value = draft.seriesScoreRight;
  $("#game-score-left").value = game.teamLeftScore;
  $("#game-score-right").value = game.teamRightScore;
  $("#game-color").value = game.swapped ? game.rightSideColor : game.leftSideColor;
  $("#game-status").value = game.status;
  $("#draft-left-name").textContent = match?.[draft.swapped ? "teamB" : "teamA"]?.name || "IZQUIERDA · POR DEFINIR";
  $("#draft-right-name").textContent = match?.[draft.swapped ? "teamA" : "teamB"]?.name || "DERECHA · POR DEFINIR";
  $("#draft-bans").value = draft.bans.join(", ");
  renderPickSlots("left", draft.swapped ? draft.teamRightPicks : draft.teamLeftPicks);
  renderPickSlots("right", draft.swapped ? draft.teamLeftPicks : draft.teamRightPicks);
  $("#draft-url").textContent = `${location.origin}/overlay/draft`;
  $("#ingame-url").textContent = `${location.origin}/overlay/ingame`;
  $("#draft-preview").src = "/overlay/draft";
  $("#ingame-preview").src = "/overlay/ingame";
}
function renderPickSlots(side, picks) {
  const brawlers = tournament.brawlers || ["Shelly", "Colt", "Bull", "Brock", "Nita", "El Primo", "Barley", "Poco", "Rosa", "Jessie", "Dynamike", "Bo", "Tick", "8-BIT", "Emz", "Stu", "Piper", "Frank", "Bibi", "Bea", "Max", "Mr. P", "Sprout", "Byron", "Squeak", "Colette", "Belle", "Ash", "Lola", "Sam", "Gus", "Mandy"];
  const query = ($("#brawler-search")?.value || "").trim().toLowerCase();
  const filtered = brawlers.filter((brawler) => brawler.toLowerCase().includes(query));
  $(`.pick-slots[data-side="${side}"]`).innerHTML = picks.map((pick, index) => `<select data-pick-side="${side}" data-pick-index="${index}"><option value="">Pick ${index + 1}</option>${[...new Set([pick, ...filtered])].filter(Boolean).map((brawler) => `<option ${pick === brawler ? "selected" : ""}>${brawler}</option>`).join("")}</select>`).join("");
}
async function streamingAction(body) {
  try {
    await api("/api/streaming", { method: "PATCH", body: JSON.stringify(body) });
    showControl(await api("/api/tournament"));
  } catch (error) { alert(error.message); }
}
async function saveDraft() {
  const picks = (side) => [...document.querySelectorAll(`[data-pick-side="${side}"]`)].map((pick) => pick.value || null);
  const displayLeftPicks = picks("left");
  const displayRightPicks = picks("right");
  const draft = streamingState().draftOverlay;
  await streamingAction({ action: "draftConfig", title: $("#draft-title").value, subtitle: $("#draft-subtitle").value, mapModeText: $("#draft-map").value, status: $("#draft-status").value, seriesScoreLeft: draft.swapped ? Number($("#draft-score-right").value) : Number($("#draft-score-left").value), seriesScoreRight: draft.swapped ? Number($("#draft-score-left").value) : Number($("#draft-score-right").value), teamLeftPicks: draft.swapped ? displayRightPicks : displayLeftPicks, teamRightPicks: draft.swapped ? displayLeftPicks : displayRightPicks, bans: $("#draft-bans").value.split(",").map((value) => value.trim()).filter(Boolean) });
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
$("#stream-match").addEventListener("change", () => streamingAction({ action: "selectMatch", matchId: $("#stream-match").value || null }));
$("#draft-save").addEventListener("click", saveDraft);
$("#brawler-search").addEventListener("input", () => renderStreaming());
$("#draft-swap").addEventListener("click", () => streamingAction({ action: "swapDraft" }));
$("#draft-reset").addEventListener("click", () => { if (confirm("¿Reiniciar picks, bans y score del draft?")) streamingAction({ action: "resetDraft" }); });
$("#game-save").addEventListener("click", () => { const game = streamingState().ingameOverlay; streamingAction({ action: "ingameConfig", teamLeftScore: game.swapped ? Number($("#game-score-right").value) : Number($("#game-score-left").value), teamRightScore: game.swapped ? Number($("#game-score-left").value) : Number($("#game-score-right").value), status: $("#game-status").value }); });
$("#game-swap").addEventListener("click", () => streamingAction({ action: "swapIngame" }));
$("#game-reset").addEventListener("click", () => streamingAction({ action: "resetIngame" }));
$("#game-color").addEventListener("change", () => { const game = streamingState().ingameOverlay; streamingAction({ action: "ingameColor", color: $("#game-color").value, visualSide: game.swapped ? "right" : "left" }); });
document.querySelectorAll("[data-score-side]").forEach((button) => button.addEventListener("click", () => { const game = streamingState().ingameOverlay; const side = game.swapped ? (button.dataset.scoreSide === "left" ? "right" : "left") : button.dataset.scoreSide; streamingAction({ action: "ingameScore", side, delta: Number(button.dataset.scoreDelta) }); }));
document.querySelectorAll("[data-copy-url]").forEach((button) => button.addEventListener("click", async () => { await navigator.clipboard.writeText($(`#${button.dataset.copyUrl}`).textContent); button.textContent = "COPIADO"; setTimeout(() => { button.textContent = "COPIAR"; }, 1200); }));
boot();
