const nextPowerOfTwo = (value) => 2 ** Math.ceil(Math.log2(Math.max(2, value)));
const BRAWLERS = ["Shelly", "Colt", "Bull", "Brock", "Nita", "El Primo", "Barley", "Poco", "Rosa", "Jessie", "Dynamike", "Bo", "Tick", "8-BIT", "Emz", "Stu", "Piper", "Frank", "Bibi", "Bea", "Max", "Mr. P", "Sprout", "Byron", "Squeak", "Colette", "Belle", "Ash", "Lola", "Sam", "Gus", "Mandy"];

function defaultStreaming() {
  return {
    currentMatchId: null,
    draftOverlay: {
      title: "PLAYOFFS", subtitle: "", mapModeText: "", teamLeftPicks: [null, null, null], teamRightPicks: [null, null, null],
      bans: [], seriesScoreLeft: 0, seriesScoreRight: 0, status: "DRAFT", swapped: false
    },
    ingameOverlay: {
      teamLeftScore: 0, teamRightScore: 0, leftSideColor: "blue", rightSideColor: "red", status: "EN JUEGO", swapped: false
    }
  };
}

function ensureStreaming(tournament) {
  const defaults = defaultStreaming();
  tournament.streaming = {
    ...defaults,
    ...(tournament.streaming || {}),
    draftOverlay: { ...defaults.draftOverlay, ...(tournament.streaming?.draftOverlay || {}) },
    ingameOverlay: { ...defaults.ingameOverlay, ...(tournament.streaming?.ingameOverlay || {}) }
  };
  return tournament.streaming;
}

export function createTournament({
  name = "Neon Rivals Cup", category = "Temporada 2026 · América del Sur", tagline = "EL CAMINO AL TÍTULO",
  logoUrl = "", participants = [], status = "LIVE"
} = {}) {
  if (!["UPCOMING", "LIVE", "FINISHED"].includes(status)) throw new Error("Estado del torneo inválido");
  if (!Array.isArray(participants) || ![4, 8, 16, 32].includes(participants.length)) throw new Error("El torneo debe tener 4, 8, 16 o 32 equipos");
  if (participants.some((team) => !team || typeof team.name !== "string" || !team.name.trim() || team.name.length > 40)) throw new Error("Cada equipo debe tener un nombre de 1 a 40 caracteres");
  if (logoUrl && !/^https?:\/\/\S+$/i.test(logoUrl)) throw new Error("La URL del logo no es válida");
  const size = nextPowerOfTwo(participants.length || 8);
  const seeded = [...participants, ...Array(size - participants.length).fill(null)];
  const rounds = [];
  let matches = seeded.map((a, index) => ({
    id: `r1-m${index + 1}`, round: 1, position: index, teamA: a, teamB: seeded[index + 1] || null,
    scoreA: 0, scoreB: 0, state: "PENDING", winnerId: null
  })).filter((_, index) => index % 2 === 0);
  rounds.push(matches);
  let round = 2;
  while (matches.length > 1) {
    matches = Array.from({ length: matches.length / 2 }, (_, index) => ({
      id: `r${round}-m${index + 1}`, round, position: index, teamA: null, teamB: null,
      scoreA: 0, scoreB: 0, state: "PENDING", winnerId: null
    }));
    rounds.push(matches);
    round += 1;
  }
  return { version: 1, name, category, tagline, logoUrl, status, updatedAt: new Date().toISOString(), participants: seeded.filter(Boolean), rounds, streaming: defaultStreaming() };
}

export function seedDemo() {
  const names = ["GLXY GAMING", "NOVA CREW", "BLOOD MOON", "PIXEL RIOT", "ORBITAL", "VOLTAGE", "NIGHT SHIFT", "ARCANE 8"];
  return createTournament({ participants: names.map((name, index) => ({ id: `team-${index + 1}`, name, seed: index + 1 })), status: "LIVE" });
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
  if (winnerId && ![match.teamA?.id, match.teamB?.id].includes(winnerId)) throw new Error("El ganador no pertenece al enfrentamiento");
  if (action === "finalize") {
    if (!match.teamA || !match.teamB) throw new Error("El enfrentamiento aún no tiene dos equipos");
    if (!winnerId) throw new Error("Confirma un ganador antes de finalizar");
    if (scoreA === scoreB) throw new Error("El marcador está empatado; corrígelo antes de finalizar");
    const dependency = dependencyForChange(tournament, match, winnerId);
    if (dependency && !patch.confirmDependencyInvalidation) throw new Error(`Este cambio afecta a ${dependency.id}. Confirma la invalidación de sus resultados dependientes.`);
    if (dependency) invalidateMatchAndDescendants(tournament, dependency);
    match.scoreA = scoreA; match.scoreB = scoreB; match.winnerId = winnerId; match.state = "FINISHED";
    propagate(tournament, match);
  } else {
    if (winnerId) throw new Error("Seleccionar un ganador solo está permitido al finalizar el enfrentamiento");
    match.scoreA = scoreA; match.scoreB = scoreB; match.state = patch.state && patch.state !== "FINISHED" ? patch.state : "LIVE";
  }
  tournament.status = tournament.rounds.at(-1)[0].state === "FINISHED" ? "FINISHED" : "LIVE";
  tournament.version += 1;
  tournament.updatedAt = new Date().toISOString();
  return tournament;
}

export function getBrawlers() {
  return [...BRAWLERS];
}

function streamingMatch(tournament) {
  const streaming = ensureStreaming(tournament);
  for (const round of tournament.rounds) {
    const match = round.find((item) => item.id === streaming.currentMatchId);
    if (match) return match;
  }
  return null;
}

export function getStreamingView(tournament) {
  const streaming = ensureStreaming(tournament);
  const match = streamingMatch(tournament);
  const draft = streaming.draftOverlay;
  const ingame = streaming.ingameOverlay;
  const teamA = match?.teamA || null;
  const teamB = match?.teamB || null;
  const draftTeams = draft.swapped ? [teamB, teamA] : [teamA, teamB];
  const ingameTeams = ingame.swapped ? [teamB, teamA] : [teamA, teamB];
  return {
    currentMatchId: streaming.currentMatchId,
    match: match ? { id: match.id, round: match.round, position: match.position, state: match.state, teamA, teamB } : null,
    draftOverlay: { ...draft, teamLeft: draftTeams[0], teamRight: draftTeams[1], teamLeftPicks: draft.swapped ? draft.teamRightPicks : draft.teamLeftPicks, teamRightPicks: draft.swapped ? draft.teamLeftPicks : draft.teamRightPicks, seriesScoreLeft: draft.swapped ? draft.seriesScoreRight : draft.seriesScoreLeft, seriesScoreRight: draft.swapped ? draft.seriesScoreLeft : draft.seriesScoreRight },
    ingameOverlay: { ...ingame, teamLeft: ingameTeams[0], teamRight: ingameTeams[1], teamLeftScore: ingame.swapped ? ingame.teamRightScore : ingame.teamLeftScore, teamRightScore: ingame.swapped ? ingame.teamLeftScore : ingame.teamRightScore, leftSideColor: ingame.swapped ? ingame.rightSideColor : ingame.leftSideColor, rightSideColor: ingame.swapped ? ingame.leftSideColor : ingame.rightSideColor }
  };
}

function validateBrawler(value) {
  if (value !== null && !BRAWLERS.includes(value)) throw new Error("Brawler no válido");
}

export function updateStreaming(tournament, patch) {
  const streaming = ensureStreaming(tournament);
  const action = patch.action;
  if (action === "selectMatch") {
    if (patch.matchId !== null && !tournament.rounds.flat().some((match) => match.id === patch.matchId)) throw new Error("Enfrentamiento no encontrado");
    streaming.currentMatchId = patch.matchId;
  } else if (action === "draftText" || action === "draftConfig") {
    for (const field of ["title", "subtitle", "mapModeText", "status"]) if (patch[field] !== undefined) streaming.draftOverlay[field] = String(patch[field]).slice(0, 80);
    for (const field of ["seriesScoreLeft", "seriesScoreRight"]) {
      if (patch[field] !== undefined && (!Number.isInteger(patch[field]) || patch[field] < 0)) throw new Error("Score de serie inválido");
      if (patch[field] !== undefined) streaming.draftOverlay[field] = patch[field];
    }
    if (action === "draftConfig") {
      if (!Array.isArray(patch.teamLeftPicks) || !Array.isArray(patch.teamRightPicks) || !Array.isArray(patch.bans)) throw new Error("Datos de draft inválidos");
      for (const pick of [...patch.teamLeftPicks, ...patch.teamRightPicks, ...patch.bans]) validateBrawler(pick);
      streaming.draftOverlay.teamLeftPicks = patch.teamLeftPicks.slice(0, 3);
      streaming.draftOverlay.teamRightPicks = patch.teamRightPicks.slice(0, 3);
      streaming.draftOverlay.bans = [...new Set(patch.bans.filter(Boolean))];
    }
  } else if (action === "draftPick") {
    const side = patch.side === "right" ? "Right" : "Left";
    if (!Number.isInteger(patch.index) || patch.index < 0 || patch.index > 2) throw new Error("Slot de pick inválido");
    validateBrawler(patch.brawler);
    streaming.draftOverlay[`team${side}Picks`][patch.index] = patch.brawler;
  } else if (action === "draftBan") {
    if (!Array.isArray(patch.brawlers)) throw new Error("Bans inválidos");
    for (const brawler of patch.brawlers) validateBrawler(brawler);
    streaming.draftOverlay.bans = [...new Set(patch.brawlers.filter(Boolean))];
  } else if (action === "resetDraft") {
    streaming.draftOverlay.teamLeftPicks = [null, null, null]; streaming.draftOverlay.teamRightPicks = [null, null, null]; streaming.draftOverlay.bans = []; streaming.draftOverlay.seriesScoreLeft = 0; streaming.draftOverlay.seriesScoreRight = 0;
  } else if (action === "swapDraft") {
    streaming.draftOverlay.swapped = !streaming.draftOverlay.swapped;
  } else if (action === "ingameConfig") {
    if (patch.status !== undefined) streaming.ingameOverlay.status = String(patch.status).slice(0, 40);
    for (const field of ["teamLeftScore", "teamRightScore"]) {
      if (patch[field] !== undefined && (!Number.isInteger(patch[field]) || patch[field] < 0)) throw new Error("Score de partida inválido");
      if (patch[field] !== undefined) streaming.ingameOverlay[field] = patch[field];
    }
  } else if (action === "ingameScore") {
    const side = patch.side === "right" ? "Right" : "Left";
    const field = `team${side}Score`;
    const value = patch.value === undefined ? streaming.ingameOverlay[field] + Number(patch.delta || 0) : Number(patch.value);
    if (!Number.isInteger(value) || value < 0) throw new Error("Score de partida inválido");
    streaming.ingameOverlay[field] = value;
  } else if (action === "ingameColor") {
    if (!["blue", "red"].includes(patch.color)) throw new Error("Color inválido");
    const leftIsRaw = !streaming.ingameOverlay.swapped || patch.visualSide !== "right";
    const field = leftIsRaw ? "leftSideColor" : "rightSideColor";
    streaming.ingameOverlay[field] = patch.color;
    streaming.ingameOverlay[leftIsRaw ? "rightSideColor" : "leftSideColor"] = patch.color === "blue" ? "red" : "blue";
  } else if (action === "resetIngame") {
    streaming.ingameOverlay.teamLeftScore = 0; streaming.ingameOverlay.teamRightScore = 0;
  } else if (action === "swapIngame") {
    streaming.ingameOverlay.swapped = !streaming.ingameOverlay.swapped;
  } else {
    throw new Error("Acción de streaming inválida");
  }
  tournament.version += 1;
  tournament.updatedAt = new Date().toISOString();
  return tournament;
}
