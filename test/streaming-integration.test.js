import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

test("HTTP, Socket.IO, permisos y persistencia con el servidor real", { timeout: 20000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "brackets-stream-test-"));
  let child;
  let socket;
  let port;
  async function start(production = false) {
    child = spawn(process.execPath, ["server/app.js"], { env: { ...process.env, PORT: "0", NODE_ENV: production ? "production" : "test", ADMIN_USER: "test", ADMIN_PASSWORD: "test-password", SESSION_SECRET: "test-secret-with-at-least-32-characters", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", DATA_FILE: path.join(directory, "tournament.json") }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    while (!output.includes("listening on")) {
      if (child.exitCode !== null) throw new Error("El servidor no inició");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    // PORT=0 requests an available port; server reports its bound address.
    port = Number(output.match(/listening on (\d+)/)[1]);
  }
  async function stop() {
    if (child && child.exitCode === null) { const stopped = once(child, "exit"); child.kill(); await stopped; }
  }
  const request = (url, options) => fetch(`http://127.0.0.1:${port}${url}`, options);
  try {
    await start();
    assert.equal((await request("/health")).status, 200);
    for (const url of ["/streaming", "/overlay-ingame.html", "/js/streaming.js", "/js/overlay.js"]) assert.equal((await request(url)).status, 200);
    assert.equal((await request("/api/streaming", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    const login = await request("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "test", password: "test-password" }) });
    const cookie = login.headers.getSetCookie().map((item) => item.split(";")[0]).join("; ");
    const events = [];
    socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
    socket.addEventListener("message", ({ data }) => {
      if (data.startsWith("0")) socket.send("40");
      if (data === "2") socket.send("3");
      if (data.startsWith("42")) events.push(JSON.parse(data.slice(2)));
    });
    async function waitView(predicate) {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const event = events.find(([name, view]) => name === "streaming:update" && predicate(view));
        if (event) return event[1];
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error("No llegó streaming:update");
    }
    await waitView((view) => !view.match);
    async function patch(url, body) {
      const response = await request(url, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
      return response.json();
    }
    await patch("/api/matches/r1-m1", { action: "save", state: "LIVE", scoreA: 4, scoreB: 2 });
    assert.equal((await waitView((view) => view.match?.scoreA === 4)).match.scoreB, 2);
    await patch("/api/matches/r1-m3", { state: "LIVE", scoreA: 1, scoreB: 3 });
    await waitView((view) => view.liveMatches.length === 2 && !view.match);
    const before = await (await request("/api/tournament")).json();
    await patch("/api/streaming", { selectedMatchId: "r1-m3", swapped: true, blueColor: "#123456" });
    await waitView((view) => view.match?.id === "r1-m3" && view.settings.swapped);
    assert.deepEqual(await (await request("/api/tournament")).json(), before);
    await patch("/api/matches/r1-m3", { state: "READY" });
    await patch("/api/matches/r1-m1", { state: "READY" });
    await waitView((view) => view.liveMatches.length === 0 && !view.match);
    socket.close();
    await stop();
    await start();
    const persisted = await (await request("/api/streaming")).json();
    assert.equal(persisted.settings.blueColor, "#123456");
    assert.equal(persisted.settings.swapped, true);
    assert.equal(persisted.match, null);
    await stop();
    await start(true);
    assert.equal((await request("/health")).status, 200);
    assert.equal((await request("/streaming")).status, 200);
  } finally {
    socket?.close();
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
