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
  const sourceIndex = tournament.rounds[match.round - 1].findIndex((item) => item.id === match.id);
  const target = tournament.rounds[match.round][Math.floor(sourceIndex / 2)];
  const winner = tournament.participants.find((team) => team.id === match.winnerId) || null;
  if (sourceIndex % 2 === 0) target.teamA = winner;
  else target.teamB = winner;
  if (target.teamA && target.teamB && target.state === "PENDING") target.state = "READY";
}

function nextMatch(tournament, match) {
  if (match.round >= tournament.rounds.length) return null;
  const sourceIndex = tournament.rounds[match.round - 1].findIndex((item) => item.id === match.id);
  return tournament.rounds[match.round][Math.floor(sourceIndex / 2)];
}

function setMatchSlot(match, source, team) {
  const sourceIndex = source.round === 1 ? source.position / 2 : source.position;
  if (sourceIndex % 2 === 0) match.teamA = team;
  else match.teamB = team;
}

function hasPlayed(match) {
  return match.state === "LIVE" || match.state === "FINISHED" || match.scoreA !== 0 || match.scoreB !== 0 || Boolean(match.winnerId);
}

function invalidateMatchAndDescendants(tournament, match) {
  const target = nextMatch(tournament, match);
  if (target && match.winnerId) {
    invalidateMatchAndDescendants(tournament, target);
    setMatchSlot(target, match, null);
    target.state = target.teamA && target.teamB ? "READY" : "PENDING";
  }
  match.scoreA = 0;
  match.scoreB = 0;
  match.winnerId = null;
  match.state = match.teamA && match.teamB ? "READY" : "PENDING";
}

function dependencyForChange(tournament, match, winnerId) {
  const target = nextMatch(tournament, match);
  if (!target || match.winnerId === winnerId) return null;
  return hasPlayed(target) ? target : null;
}

export function updateMatch(tournament, matchId, patch) {
  const match = findMatch(tournament, matchId);
  const allowed = ["PENDING", "READY", "LIVE", "FINISHED"];
  if (patch.state && !allowed.includes(patch.state)) throw new Error("Estado inválido");
  if (patch.scoreA !== undefined && (!Number.isInteger(patch.scoreA) || patch.scoreA < 0)) throw new Error("Marcador inválido");
  if (patch.scoreB !== undefined && (!Number.isInteger(patch.scoreB) || patch.scoreB < 0)) throw new Error("Marcador inválido");
  const action = patch.action || (patch.state === "FINISHED" ? "finalize" : "save");
  if (!["save", "finalize", "edit"].includes(action)) throw new Error("Acción inválida");
  if (action === "edit") {
    if (match.state !== "FINISHED") throw new Error("El enfrentamiento ya está editable");
    match.state = "LIVE";
    if (tournament.status === "FINISHED") tournament.status = "LIVE";
    tournament.version += 1;
    tournament.updatedAt = new Date().toISOString();
    return tournament;
  }
  if (match.state === "FINISHED") throw new Error("El enfrentamiento está bloqueado; edita el resultado antes de guardar");

  const scoreA = patch.scoreA ?? match.scoreA;
  const scoreB = patch.scoreB ?? match.scoreB;
  const winnerId = patch.winnerId || null;
  if (winnerId && ![match.teamA?.id, match.teamB?.id].includes(winnerId)) {
    throw new Error("El ganador no pertenece al enfrentamiento");
  }
  if (action === "finalize") {
    if (!match.teamA || !match.teamB) throw new Error("El enfrentamiento aún no tiene dos equipos");
    if (!winnerId) throw new Error("Confirma un ganador antes de finalizar");
    if (scoreA === scoreB) throw new Error("El marcador está empatado; corrígelo antes de finalizar");
    const dependency = dependencyForChange(tournament, match, winnerId);
    if (dependency && !patch.confirmDependencyInvalidation) {
      throw new Error(`Este cambio afecta a ${dependency.id}. Confirma la invalidación de sus resultados dependientes.`);
    }
    if (dependency) invalidateMatchAndDescendants(tournament, dependency);
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.winnerId = winnerId;
    match.state = "FINISHED";
    propagate(tournament, match);
  } else {
    if (winnerId) throw new Error("Seleccionar un ganador solo está permitido al finalizar el enfrentamiento");
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.state = patch.state && patch.state !== "FINISHED" ? patch.state : "LIVE";
  }
  tournament.status = tournament.rounds.at(-1)[0].state === "FINISHED" ? "FINISHED" : "LIVE";
  tournament.version += 1;
  tournament.updatedAt = new Date().toISOString();
  return tournament;
}
