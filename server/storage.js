import fs from "node:fs/promises";
import path from "node:path";
import { seedDemo } from "./bracket-engine.js";
import { defaultSettings } from "./streaming.js";

const file = path.resolve(process.env.DATA_FILE || "./data/tournament.json");
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
let memory;
let streamingSettings = { ...defaultSettings };
const streamingFile = path.join(path.dirname(file), "streaming.json");

export async function loadStreaming() {
  if (redisUrl && redisToken) {
    const result = await redisCommand(["get", "brackets-live:streaming"]);
    streamingSettings = { ...defaultSettings, ...JSON.parse(result.result || "{}") };
  } else {
    try { streamingSettings = { ...defaultSettings, ...JSON.parse(await fs.readFile(streamingFile, "utf8")) }; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

export function getStreaming() { return streamingSettings; }

export async function saveStreaming(patch) {
  const next = { ...streamingSettings, ...patch };
  if (redisUrl && redisToken) await redisCommand(["set", "brackets-live:streaming", JSON.stringify(next)]);
  else {
    await fs.mkdir(path.dirname(streamingFile), { recursive: true });
    await fs.writeFile(streamingFile, JSON.stringify(next, null, 2), "utf8");
  }
  streamingSettings = next;
  return next;
}

async function redisCommand(command) {
  const response = await fetch(`${redisUrl}/${command.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  if (!response.ok) throw new Error(`Redis respondió ${response.status}`);
  return response.json();
}

export async function loadTournament() {
  if (redisUrl && redisToken) {
    const result = await redisCommand(["get", "brackets-live:tournament"]);
    memory = result.result ? JSON.parse(result.result) : seedDemo();
    if (!result.result) await saveTournament(memory);
    return memory;
  }
  try {
    memory = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    memory = seedDemo();
    await saveTournament(memory);
  }
  return memory;
}

export async function saveTournament(tournament) {
  memory = tournament;
  if (redisUrl && redisToken) {
    await redisCommand(["set", "brackets-live:tournament", JSON.stringify(tournament)]);
    return tournament;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(tournament, null, 2), "utf8");
  return tournament;
}

export function getTournament() {
  return memory;
}
