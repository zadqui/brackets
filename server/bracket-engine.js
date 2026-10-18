const nextPowerOfTwo = (value) => 2 ** Math.ceil(Math.log2(Math.max(2, value)));

export function createTournament({
  name = "Neon Rivals Cup",
  category = "Temporada 2026 · América del Sur",
  tagline = "EL CAMINO AL TÍTULO",
  logoUrl = "",
  participants = [],
  status = "LIVE"
} = {}) {
  if (!["UPCOMING", "LIVE", "FINISHED"].includes(status)) throw new Error("Estado del torneo inválido");
  if (!Array.isArray(participants) || ![4, 8, 16, 32].includes(participants.length)) {
    throw new Error("El torneo debe tener 4, 8, 16 o 32 equipos");
  }
  if (participants.some((team) => !team || typeof team.name !== "string" || !team.name.trim() || team.name.length > 40)) {
    throw new Error("Cada equipo debe tener un nombre de 1 a 40 caracteres");
  }
  if (logoUrl && !/^https?:\/\/\S+$/i.test(logoUrl)) throw new Error("La URL del logo no es válida");
  const size = nextPowerOfTwo(participants.length || 8);
  const seeded = [...participants, ...Array(size - participants.length).fill(null)];
  const rounds = [];
  let matches = seeded.map((a, index) => ({
    id: `r1-m${index + 1}`,
    round: 1,
    position: index,
    teamA: a,
    teamB: seeded[index + 1] || null,
    scoreA: 0,
    scoreB: 0,
    state: "PENDING",
    winnerId: null
  })).filter((_, index) => index % 2 === 0);
  rounds.push(matches);
  let round = 2;
  while (matches.length > 1) {
    matches = Array.from({ length: matches.length / 2 }, (_, index) => ({
      id: `r${round}-m${index + 1}`,
      round,
      position: index,
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      state: "PENDING",
      winnerId: null
    }));
    rounds.push(matches);
    round += 1;
  }
  return {
    version: 1,
    name,
    category,
    tagline,
    logoUrl,
    status,
    updatedAt: new Date().toISOString(),
    participants: seeded.filter(Boolean),
    rounds
  };
}

export function seedDemo() {
  const names = ["GLXY GAMING", "NOVA CREW", "BLOOD MOON", "PIXEL RIOT", "ORBITAL", "VOLTAGE", "NIGHT SHIFT", "ARCANE 8"];
  return createTournament({
    participants: names.map((name, index) => ({ id: `team-${index + 1}`, name, seed: index + 1 })),
    status: "LIVE"
  });
}

function findMatch(tournament, matchId) {
  for (const round of tournament.rounds) {
    const match = round.find((item) => item.id === matchId);
    if (match) return match;
  }
  throw new Error("Enfrentamiento no encontrado");
}

function propagate(tournament, match) {
  if (match.round >= tournament.rounds.length || !match.winnerId) return;
  const target = tournament.rounds[match.round][Math.floor(match.position / 2)];
  const winner = tournament.participants.find((team) => team.id === match.winnerId) || null;
  if (match.position % 2 === 0) target.teamA = winner;
  else target.teamB = winner;
  if (target.teamA && target.teamB && target.state === "PENDING") target.state = "READY";
}

export function updateMatch(tournament, matchId, patch) {
  const match = findMatch(tournament, matchId);
  const allowed = ["PENDING", "READY", "LIVE", "FINISHED"];
  if (patch.state && !allowed.includes(patch.state)) throw new Error("Estado inválido");
  if (patch.scoreA !== undefined && (!Number.isInteger(patch.scoreA) || patch.scoreA < 0)) throw new Error("Marcador inválido");
  if (patch.scoreB !== undefined && (!Number.isInteger(patch.scoreB) || patch.scoreB < 0)) throw new Error("Marcador inválido");
  Object.assign(match, {
    scoreA: patch.scoreA ?? match.scoreA,
    scoreB: patch.scoreB ?? match.scoreB,
    state: patch.state ?? match.state
  });
  if (patch.winnerId !== undefined) {
    if (![match.teamA?.id, match.teamB?.id].includes(patch.winnerId)) throw new Error("El ganador no pertenece al enfrentamiento");
    match.winnerId = patch.winnerId;
  }
  if (match.state === "FINISHED" && !match.winnerId) throw new Error("Confirma un ganador antes de finalizar");
  if (match.state === "FINISHED") propagate(tournament, match);
  if (tournament.rounds.at(-1)[0].state === "FINISHED") tournament.status = "FINISHED";
  tournament.version += 1;
  tournament.updatedAt = new Date().toISOString();
  return tournament;
}
