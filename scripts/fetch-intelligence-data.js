/**
 * Intelligence Daily Data Pipeline (v3 — calls Worker endpoints)
 */

import { writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "..", "public", "api");
const ARCHIVE_DIR = join(API_DIR, "archive");

const WORKER_BASE = process.env.WORKER_BASE_URL || "https://api.bloodyrex.xyz";

async function fetchJSON(endpoint) {
  const url = `${WORKER_BASE}${endpoint}`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });
  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

  const today = new Date().toISOString().split("T")[0];

  // Archive previous data before overwriting
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

  for (const task of tasks) {
    const filePath = join(API_DIR, task.file);

    // Archive existing data if different from today
    try {
      if (existsSync(filePath)) {
        const oldData = JSON.parse(await import("fs").then(m => m.readFileSync(filePath, "utf8")));
        if (oldData.updated && oldData.updated !== today) {
          const archivePath = join(ARCHIVE_DIR, `${oldData.updated}_${task.file}`);
          if (!existsSync(archivePath)) {
            copyFileSync(filePath, archivePath);
            console.log(`Archived: ${task.file} (${oldData.updated})`);
          }
        }
      }
    } catch (e) {
      console.warn(`Archive warning for ${task.file}: ${e.message}`);
    }

    // Fetch new data
    try {
      const data = await fetchJSON(task.endpoint);
      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      const summary = task.endpoint.includes("editor")
        ? "picks:" + Object.keys(data.picks || {}).filter(k => data.picks[k]?.length).length + " categories"
        : "OK";
      console.log(`OK ${task.file} (${summary})`);
    } catch (e) {
      console.error(`FAIL ${task.file}: ${e.message}`);
      process.exitCode = 1;
    }
  }

  console.log("\nPipeline done:", today);
}

main();