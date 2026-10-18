export const defaultSettings = { selectedMatchId: null, swapped: false, blueColor: "#1677ff", redColor: "#ef3340" };

export function validateSettings(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Configuración inválida");
  const allowed = Object.keys(defaultSettings);
  if (Object.keys(patch).some((key) => !allowed.includes(key))) throw new Error("Campo de Streaming inválido");
  if (patch.selectedMatchId !== undefined && patch.selectedMatchId !== null && (typeof patch.selectedMatchId !== "string" || patch.selectedMatchId.length > 80)) throw new Error("Enfrentamiento inválido");
  if (patch.swapped !== undefined && typeof patch.swapped !== "boolean") throw new Error("Lados inválidos");
  for (const key of ["blueColor", "redColor"]) {
    if (patch[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(patch[key])) throw new Error("Color inválido");
  }
  return patch;
}

export function streamingView(tournament, settings) {
  const liveMatches = tournament.rounds.flat().filter((match) => match.state === "LIVE" && match.teamA && match.teamB);
  const match = liveMatches.length === 1 ? liveMatches[0] : liveMatches.find((item) => item.id === settings.selectedMatchId) || null;
  return { settings, liveMatches, match, waitingReason: match ? null : liveMatches.length ? "Selecciona un enfrentamiento EN JUEGO desde Streaming." : "Esperando un enfrentamiento EN JUEGO." };
}
