import "dotenv/config";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieSession from "cookie-session";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createTournament, seedDemo, updateMatch } from "./bracket-engine.js";
import { getTournament, loadTournament, saveTournament } from "./storage.js";
import { getStreaming, loadStreaming, saveStreaming } from "./storage.js";
import { streamingView, validateSettings } from "./streaming.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("En producción se requieren ADMIN_USER, ADMIN_PASSWORD (mínimo 12 caracteres) y SESSION_SECRET (mínimo 32 caracteres)");
}
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server);
const session = cookieSession({
  name: "brackets-session",
  secret: process.env.SESSION_SECRET || "development-secret-change-me",
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  maxAge: 8 * 60 * 60 * 1000
});

app.use(express.json({ limit: "100kb" }));
app.use(session);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.static(path.join(__dirname, "..", "public")));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true });
const adminOnly = (req, res, next) => req.session.admin ? next() : res.status(401).json({ error: "No autorizado" });
const currentStream = () => streamingView(getTournament(), getStreaming());
io.on("connection", (socket) => socket.emit("streaming:update", currentStream()));
app.get("/api/streaming", (req, res) => res.json(currentStream()));
app.patch("/api/streaming", adminOnly, async (req, res) => {
  try {
    const patch = validateSettings(req.body);
    if (patch.selectedMatchId && !currentStream().liveMatches.some((match) => match.id === patch.selectedMatchId)) throw new Error("El enfrentamiento ya no está EN JUEGO");
    await saveStreaming(patch);
    io.emit("streaming:update", currentStream());
    res.json(currentStream());
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.get("/streaming", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "streaming.html")));

app.get("/api/tournament", (req, res) => res.json(getTournament()));
app.get("/health", (req, res) => res.json({ ok: true, version: getTournament()?.version ?? null }));
app.post("/api/login", loginLimiter, (req, res) => {
  if (req.body.username !== (process.env.ADMIN_USER || "admin") || req.body.password !== (process.env.ADMIN_PASSWORD || "change-this-password")) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  req.session.admin = true;
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => { req.session = null; res.json({ ok: true }); });
app.get("/api/session", (req, res) => res.json({ authenticated: Boolean(req.session.admin) }));
app.put("/api/tournament", adminOnly, async (req, res) => {
  try {
    const tournament = await saveTournament(createTournament(req.body));
    io.emit("tournament:update", tournament);
    io.emit("streaming:update", currentStream());
    res.json(tournament);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post("/api/tournament/demo", adminOnly, async (req, res) => {
  try {
    const tournament = await saveTournament(seedDemo());
    io.emit("tournament:update", tournament);
    io.emit("streaming:update", currentStream());
    res.json(tournament);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.patch("/api/matches/:id", adminOnly, async (req, res) => {
  try {
    const tournament = await saveTournament(updateMatch(getTournament(), req.params.id, req.body));
    io.emit("tournament:update", tournament);
    io.emit("streaming:update", currentStream());
    res.json(tournament);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.get("/api/export", adminOnly, (req, res) => {
  res.setHeader("Content-Disposition", "attachment; filename=tournament.json");
  res.json(getTournament());
});
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "admin.html")));
io.on("connection", (socket) => socket.emit("tournament:update", getTournament()));

await loadTournament();
await loadStreaming();
const port = Number(process.env.PORT || 10000);
server.listen(port, "0.0.0.0", () => console.log(`Brackets Live listening on ${server.address().port}`));
