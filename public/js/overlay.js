const $ = (selector) => document.querySelector(selector);
const fallback = (team) => team?.logoUrl || "";
function setImage(selector, team) {
  const image = $(selector);
  image.src = fallback(team);
  image.classList.toggle("hidden", !image.src);
}
function pickTemplate(pick) {
  return `<span class="pick-slot">${pick || "—"}</span>`;
}
function banTemplate(ban) {
  return `<span class="ban-slot">${ban}</span>`;
}
function render(data) {
  if ($("#draft-overlay")) renderDraft(data.draftOverlay);
  if ($("#ingame-overlay")) renderIngame(data.ingameOverlay);
}
function renderDraft(draft) {
  $("#draft-title").textContent = draft.title;
  $("#draft-subtitle").textContent = draft.subtitle;
  $("#draft-map").textContent = draft.mapModeText;
  $("#draft-status").textContent = draft.status;
  $("#draft-left-name").textContent = draft.teamLeft?.name || "POR DEFINIR";
  $("#draft-right-name").textContent = draft.teamRight?.name || "POR DEFINIR";
  $("#draft-left-score").textContent = draft.seriesScoreLeft;
  $("#draft-right-score").textContent = draft.seriesScoreRight;
  $("#draft-left-picks").innerHTML = draft.teamLeftPicks.map(pickTemplate).join("");
  $("#draft-right-picks").innerHTML = draft.teamRightPicks.map(pickTemplate).join("");
  $("#draft-bans").innerHTML = draft.bans.map(banTemplate).join("");
  setImage("#draft-left-logo", draft.teamLeft);
  setImage("#draft-right-logo", draft.teamRight);
}
function renderIngame(game) {
  $("#game-left-name").textContent = game.teamLeft?.name || "POR DEFINIR";
  $("#game-right-name").textContent = game.teamRight?.name || "POR DEFINIR";
  $("#game-left-score").textContent = game.teamLeftScore;
  $("#game-right-score").textContent = game.teamRightScore;
  $("#game-status").textContent = game.status;
  $("#game-left").className = `game-team ${game.leftSideColor}`;
  $("#game-right").className = `game-team ${game.rightSideColor}`;
  setImage("#game-left-logo", game.teamLeft);
  setImage("#game-right-logo", game.teamRight);
}
async function refresh() {
  const response = await fetch("/api/streaming");
  if (!response.ok) throw new Error("No se pudo cargar el overlay");
  render(await response.json());
}
socket.on("tournament:update", refresh);
refresh();
