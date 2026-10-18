import { defaultDesign, designFonts, designRanges } from "../public/js/overlay-design.js";
export const defaultSettings = { selectedMatchId: null, swapped: false, ...defaultDesign };

export function validateSettings(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Configuración inválida");
  const allowed = Object.keys(defaultSettings);
  if (Object.keys(patch).some((key) => !allowed.includes(key))) throw new Error("Campo de Streaming inválido");
  if (patch.selectedMatchId !== undefined && patch.selectedMatchId !== null && (typeof patch.selectedMatchId !== "string" || patch.selectedMatchId.length > 80)) throw new Error("Enfrentamiento inválido");
  if (patch.swapped !== undefined && typeof patch.swapped !== "boolean") throw new Error("Lados inválidos");
  for (const key of ["blueColor", "redColor", "textColor"]) {
    if (patch[key] !== undefined && (typeof patch[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(patch[key]))) throw new Error("Color inválido");
  }
  for (const [key, [min, max]] of Object.entries(designRanges)) {
    if (patch[key] !== undefined && (typeof patch[key] !== "number" || !Number.isFinite(patch[key]) || patch[key] < min || patch[key] > max)) throw new Error(`Valor inválido: ${key}`);
  }
  if (patch.fontFamily !== undefined && !Object.hasOwn(designFonts, patch.fontFamily)) throw new Error("Tipografía inválida");
  if (patch.shimmer !== undefined && typeof patch.shimmer !== "boolean") throw new Error("Brillo inválido");
  return patch;
}

export function streamingView(tournament, settings) {
  const liveMatches = tournament.rounds.flat().filter((match) => match.state === "LIVE" && match.teamA && match.teamB);
  const match = liveMatches.length === 1 ? liveMatches[0] : liveMatches.find((item) => item.id === settings.selectedMatchId) || null;
  return { settings, liveMatches, match, waitingReason: match ? null : liveMatches.length ? "Selecciona un enfrentamiento EN JUEGO desde Streaming." : "Esperando un enfrentamiento EN JUEGO." };
}
