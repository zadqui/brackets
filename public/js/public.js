const socket = io();
const $ = (selector) => document.querySelector(selector);
const labels = { PENDING: "PENDIENTE", READY: "LISTO", LIVE: "EN JUEGO", FINISHED: "FINALIZADO" };
function render(tournament) {
  $("#title").textContent = tournament.name;
  $("#category").textContent = tournament.category;
  $("#tagline").textContent = tournament.tagline || "EL CAMINO AL TÍTULO";
  $("#status").textContent = { UPCOMING: "PRÓXIMAMENTE", LIVE: "EN VIVO", FINISHED: "FINALIZADO" }[tournament.status] || tournament.status;
  $("#updated").textContent = `ACTUALIZADO ${new Date(tournament.updatedAt).toLocaleTimeString("es-ES")}`;
  const logo = $("#logo");
  logo.classList.toggle("hidden", !tournament.logoUrl);
  if (tournament.logoUrl) { logo.src = tournament.logoUrl; logo.alt = tournament.name; }
  $("#bracket").innerHTML = tournament.rounds.map((matches, index) => `<section class="round" data-round="${index + 1}"><h2 class="round-title">${index === tournament.rounds.length - 1 ? "GRAN FINAL" : index === tournament.rounds.length - 2 ? "SEMIFINALES" : index === 0 ? "CUARTOS DE FINAL" : "Ronda " + (index + 1)}</h2><div class="round-matches">${matches.map(matchTemplate).join("")}</div></section>`).join("");
  const final = tournament.rounds.at(-1)[0];
  $("#champion").classList.toggle("hidden", !final?.winnerId);
  if (final?.winnerId) $("#champion").innerHTML = `<p class="kicker">THE LAST TEAM STANDING</p><h2>CAMPEÓN</h2><p>${teamName(final, final.winnerId)}</p>`;
}
function teamName(match, id) { return match.teamA?.id === id ? match.teamA.name : match.teamB?.name || "POR DEFINIR"; }
function matchTemplate(match) {
  const row = (team, score, id) => `<div class="team ${match.winnerId === id ? "winner" : match.state === "FINISHED" && id ? "eliminated" : ""}"><span>${team?.name || "POR DEFINIR"}</span><b class="score">${team ? score : "—"}</b></div>`;
  return `<article class="match ${match.state.toLowerCase()}"><div class="match-label"><span>${match.id.toUpperCase()}</span><span>${labels[match.state]}</span></div>${row(match.teamA, match.scoreA, match.teamA?.id)}${row(match.teamB, match.scoreB, match.teamB?.id)}<div class="state">${match.state === "FINISHED" ? "RESULTADO CONFIRMADO" : match.state === "LIVE" ? "PARTIDA EN CURSO" : "ESPERANDO ENFRENTAMIENTO"}</div></article>`;
}
socket.on("connect", () => { $("#connection").textContent = "● CONECTADO"; $("#connection").classList.add("online"); });
socket.on("disconnect", () => { $("#connection").textContent = "● SIN CONEXIÓN"; $("#connection").classList.remove("online"); });
socket.on("tournament:update", render);
$("#fullscreen").addEventListener("click", () => document.documentElement.requestFullscreen?.());
