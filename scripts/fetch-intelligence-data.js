/**
 * Intelligence Daily Data Pipeline
 * Calls Cloudflare Worker endpoints, saves JSON to public/api/
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "..", "public", "api");

const WORKER_BASE = process.env.WORKER_BASE_URL || "https://api.bloodyrex.xyz";

async function fetchJSON(endpoint) {
  const url = `${WORKER_BASE}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${endpoint}: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });

  const tasks = [
    { endpoint: "/intelligence/overview", file: "overview.json" },
    { endpoint: "/intelligence/movies", file: "movies.json" },
    { endpoint: "/intelligence/tv", file: "tv.json" },
    { endpoint: "/intelligence/music", file: "music.json" },
    { endpoint: "/intelligence/trending", file: "trending.json" },
    { endpoint: "/intelligence/coming", file: "coming.json" },
    { endpoint: "/intelligence/weekly", file: "weekly.json" },
    { endpoint: "/intelligence/editor", file: "editor.json" },
  ];

  let anyChange = false;

  for (const task of tasks) {
    const filePath = join(API_DIR, task.file);
    try {
      const data = await fetchJSON(task.endpoint);

      // Check if data actually changed
      let oldData = null;
      if (existsSync(filePath)) {
        try {
          oldData = JSON.parse(readFileSync(filePath, "utf8"));
        } catch {}
      }

      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      const changed = !oldData || JSON.stringify(oldData.stats || oldData) !== JSON.stringify(data.stats || data);
      if (changed) anyChange = true;

      console.log(`OK ${task.file} — ${changed ? "NEW DATA" : "unchanged"}`);
    } catch (e) {
      console.error(`FAIL ${task.file}: ${e.message}`);
      process.exitCode = 1;
    }
  }

  if (!anyChange) {
    console.log("\nNo data changes detected — skipping commit.");
  } else {
    console.log("\nData updated — ready for commit.");
  }

  console.log("Pipeline done:", new Date().toISOString().split("T")[0]);
}

main();