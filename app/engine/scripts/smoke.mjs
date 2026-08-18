// Smoke test do engine (modo mock) — valida o protocolo stdin/stdout ponta a ponta.
// Uso: node scripts/smoke.mjs
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const enginePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.mjs");
const child = spawn(process.execPath, [enginePath, "--mock"], { stdio: ["pipe", "pipe", "inherit"] });

const counts = new Map();
const interesting = new Set(["status", "phase", "qa-verdict", "injected", "exit", "error"]);
let pausedSeen = false;
let exitEvent = null;

const lines = [];
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      lines.push(`NON-JSON: ${trimmed}`);
      continue;
    }
    counts.set(ev.type, (counts.get(ev.type) ?? 0) + 1);
    if (ev.type === "exit") exitEvent = ev;
    if (interesting.has(ev.type)) {
      lines.push(`  ${ev.type}: ${ev.type === "phase" ? `fase="${ev.fase}" pct=${ev.pct}` : JSON.stringify(ev)}`);
    }
    if (ev.type === "paused") pausedSeen = true;
  }
});

child.on("close", (code) => {
  const table = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`);
  lines.push("--- EVENTOS ---");
  lines.push(table.join("  "));
  lines.push(`--- pause? ${pausedSeen} | exitEvent? ${JSON.stringify(exitEvent)} | code=${code} ---`);
  console.log(lines.join("\n"));
  process.exit(code === 0 ? 0 : 1);
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitExit(delay = 3000) {
  const deadline = Date.now() + delay;
  while (Date.now() < deadline) {
    if (exitEvent) return exitEvent;
    await sleep(50);
  }
  return null;
}

await sleep(300);
send({ type: "start", projectDir: "/tmp/fake-project" });
await sleep(600);
send({ type: "pause" });
await sleep(400);
send({ type: "inject", text: "Use pnpm, não npm." });
await sleep(300);
send({ type: "resume" });
await sleep(800);
send({ type: "pause" });
await sleep(300);
send({ type: "resume" });
await sleep(900);
send({ type: "ping" });
const finished = await waitExit(6000);

if (finished) {
  console.log("RESULTADO: mock concluiu com exit event");
} else {
  console.log("RESULTADO: ainda em execução — enviando stop…");
  send({ type: "stop" });
  await waitExit(3000);
}
// Encerra o processo após receber exit (engine fica vivo aguardando comandos).
child.stdin.end();
setTimeout(() => child.kill("SIGTERM"), 400).unref();
