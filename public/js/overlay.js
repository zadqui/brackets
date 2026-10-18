const socket = io();
const $ = (id) => document.getElementById(id);
function wait(message) {
  $("scoreboard").hidden = true;
  $("waiting").hidden = false;
  $("waiting").textContent = message;
  for (const id of ["blue-name", "red-name", "blue-score", "red-score"]) $(id).textContent = "";
}
socket.on("disconnect", () => wait("Sin conexión. Esperando sincronización…"));
socket.on("connect_error", () => wait("Sin conexión. Esperando sincronización…"));
socket.on("streaming:update", ({ match, settings, waitingReason }) => {
  if (!match) return wait(waitingReason);
  const blue = settings.swapped ? [match.teamB.name, match.scoreB] : [match.teamA.name, match.scoreA];
  const red = settings.swapped ? [match.teamA.name, match.scoreA] : [match.teamB.name, match.scoreB];
  for (const [side, values] of [["blue", blue], ["red", red]]) {
    $(`${side}-name`).textContent = values[0];
    $(`${side}-score`).textContent = values[1];
    document.querySelector(`.${side}`).style.setProperty("--side-color", settings[`${side}Color`]);
  }
  $("waiting").hidden = true;
  $("scoreboard").hidden = false;
});
