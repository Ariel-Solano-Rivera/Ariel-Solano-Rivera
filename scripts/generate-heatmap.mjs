import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const username = process.env.GH_USERNAME || "Ariel-Solano-Rivera";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const requestedOutput = process.env.OUTPUT_PATH || "dist/github-jet.svg";
const outputPath = path.isAbsolute(requestedOutput)
  ? requestedOutput
  : path.resolve(rootDir, requestedOutput);

const COLS = 40;
const ROWS = 7;
const CELL = 11;
const STEP = 14;
const GRID_X = 20;
const GRID_Y = 16;
const WIDTH = 600;
const HEIGHT = 180;
const JET_Y = 148;
const LOOP_SECONDS = 20;
const TARGET_COUNT = 12;

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 365);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchWeeks() {
  const { from, to } = dateRange();
  const query = `
    query Contributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${username}-profile-generator`
    },
    body: JSON.stringify({ query, variables: { login: username, from, to } })
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const details = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`GitHub GraphQL request failed: ${details}`);
  }
  const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error(`GitHub user not found: ${username}`);
  return { weeks, source: "GitHub GraphQL API" };
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleWeeks() {
  const random = seededRandom(`${username}-terminal-map`);
  const palette = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
  const weeks = Array.from({ length: COLS }, (_, col) => ({
    contributionDays: Array.from({ length: ROWS }, (_, row) => {
      const active = random() > (row === 0 || row === 6 ? 0.72 : 0.5);
      const count = active ? 1 + Math.floor(random() * 15 + Math.max(0, Math.sin(col * 0.4) * 4)) : 0;
      const level = count === 0 ? 0 : Math.min(4, 1 + Math.floor(count / 4));
      return {
        date: `sample-${col}-${row}`,
        contributionCount: count,
        color: palette[level]
      };
    })
  }));
  return { weeks, source: "sample data" };
}

function normalizeWeeks(rawWeeks) {
  const recent = rawWeeks.slice(-COLS);
  while (recent.length < COLS) {
    recent.unshift({ contributionDays: [] });
  }

  return recent.map((week, col) => {
    const byDay = new Map(
      (week.contributionDays || []).map((day) => {
        const key = /^\d{4}-/.test(day.date)
          ? new Date(`${day.date}T00:00:00Z`).getUTCDay()
          : (week.contributionDays || []).indexOf(day);
        return [key, day];
      })
    );
    return Array.from({ length: ROWS }, (_, row) => {
      const day = byDay.get(row) || { contributionCount: 0, color: "#161b22", date: null };
      return {
        col,
        row,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        count: day.contributionCount || 0,
        color: day.color || "#161b22",
        date: day.date
      };
    });
  }).flat();
}

function pickTargets(cells) {
  return [...cells]
    .filter((cell) => cell.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, TARGET_COUNT)
    .sort((a, b) => a.col - b.col || a.row - b.row);
}

function keyTime(col, direction) {
  const t = 0.03 + (col / (COLS - 1)) * 0.44;
  return direction === "forward" ? t : 1 - t;
}

function fmt(number) {
  return Number(number.toFixed(4));
}

function renderGrid(cells, targets) {
  const targetKeys = new Set(targets.map((cell) => `${cell.col}-${cell.row}`));
  return cells.map((cell) => {
    const title = cell.date
      ? `<title>${escapeXml(cell.date)}: ${cell.count} contribuciones</title>`
      : "";
    const targeted = targetKeys.has(`${cell.col}-${cell.row}`);
    return `<rect x="${cell.x}" y="${cell.y}" width="${CELL}" height="${CELL}" rx="2" fill="${cell.color}"${targeted ? ' stroke="#7ee787" stroke-width="1"' : ""}>${title}</rect>`;
  }).join("\n");
}

function renderEffects(targets) {
  const bullets = [];
  const blasts = [];
  for (const direction of ["forward", "backward"]) {
    const ordered = direction === "forward" ? targets : [...targets].reverse();
    for (const cell of ordered) {
      const t = keyTime(cell.col, direction);
      const launch = Math.max(0, t - 0.022);
      const end = Math.min(1, t + 0.018);
      const cx = cell.x + CELL / 2;
      const cy = cell.y + CELL / 2;

      bullets.push(`<circle cx="${cx}" cy="${JET_Y - 10}" r="2.2" fill="#7ee787">
        <animate attributeName="cy" dur="${LOOP_SECONDS}s" repeatCount="indefinite" keyTimes="0;${fmt(launch)};${fmt(t)};1" values="${JET_Y - 10};${JET_Y - 10};${cy};${cy}"/>
        <animate attributeName="opacity" dur="${LOOP_SECONDS}s" repeatCount="indefinite" keyTimes="0;${fmt(launch)};${fmt(t)};${fmt(end)};1" values="0;1;1;0;0"/>
      </circle>`);

      blasts.push(`<circle cx="${cx}" cy="${cy}" r="0" fill="none" stroke="#56d364" stroke-width="1.5" opacity="0">
        <animate attributeName="r" dur="${LOOP_SECONDS}s" repeatCount="indefinite" keyTimes="0;${fmt(t)};${fmt(end)};1" values="0;1;9;9"/>
        <animate attributeName="opacity" dur="${LOOP_SECONDS}s" repeatCount="indefinite" keyTimes="0;${fmt(t)};${fmt(end)};1" values="0;1;0;0"/>
      </circle>`);
    }
  }
  return { bullets: bullets.join("\n"), blasts: blasts.join("\n") };
}

function jetShape(className = "") {
  return `<g class="${className}">
    <polygon points="0,-16 8,6 4,3 -4,3 -8,6" fill="#58a6ff" stroke="#1f6feb" stroke-width="1"/>
    <polygon points="-8,6 -14,12 -4,7" fill="#388bfd"/>
    <polygon points="8,6 14,12 4,7" fill="#388bfd"/>
    <circle cx="0" cy="-6" r="2.2" fill="#c9e6ff"/>
    <polygon points="-3,7 3,7 0,15" fill="#f0883e"/>
  </g>`;
}

function renderStars() {
  const stars = [[8,20],[8,60],[8,100],[592,25],[592,70],[592,110],[30,172],[570,172]];
  return stars.map(([x, y], index) =>
    `<circle cx="${x}" cy="${y}" r="1.1" fill="#8b949e" opacity="${index % 2 ? 0.8 : 0.35}"/>`
  ).join("\n");
}

function buildSvg(dataset) {
  const cells = normalizeWeeks(dataset.weeks);
  const targets = pickTargets(cells);
  const effects = renderEffects(targets);
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Mapa animado de contribuciones de ${escapeXml(username)}</title>
  <desc id="desc">${COLS} semanas de actividad con una nave animada. Total visible: ${total} contribuciones. Fuente: ${escapeXml(dataset.source)}.</desc>
  <style>
    .movingJet { animation: jetTravel ${LOOP_SECONDS}s linear infinite; }
    .staticJet { display: none; }
    @keyframes jetTravel {
      0% { transform: translate(35px, ${JET_Y}px); }
      50% { transform: translate(565px, ${JET_Y}px); }
      100% { transform: translate(35px, ${JET_Y}px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .animatedEffects, .movingJet { display: none; }
      .staticJet { display: inline; transform: translate(300px, ${JET_Y}px); }
    }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="12" fill="#0d1117"/>
  ${renderStars()}
  <g id="grid">${renderGrid(cells, targets)}</g>
  <g class="animatedEffects">${effects.bullets}${effects.blasts}</g>
  ${jetShape("movingJet")}
  ${jetShape("staticJet")}
</svg>`;
}

let dataset;
if (token) {
  try {
    dataset = await fetchWeeks();
  } catch (error) {
    console.warn(`GitHub API unavailable (${error.message}); using sample data.`);
    dataset = sampleWeeks();
  }
} else {
  dataset = sampleWeeks();
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, buildSvg(dataset), "utf8");
console.log(`Generated ${path.relative(rootDir, outputPath)} using ${dataset.source}`);

