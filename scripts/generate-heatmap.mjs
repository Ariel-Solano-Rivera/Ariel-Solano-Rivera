import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const username = process.env.GH_USERNAME || "Ariel-Solano-Rivera";
const token = process.env.GH_TOKEN || "";
const requestedOutput = process.env.OUTPUT_PATH || "dist/github-jet.svg";
const outputPath = path.isAbsolute(requestedOutput)
  ? requestedOutput
  : path.resolve(rootDir, requestedOutput);

const WEEKS = 40;
const DAYS = 7;
const CELL = 15;
const GAP = 6;
const STEP = CELL + GAP;
const GRID_X = 154;
const GRID_Y = 150;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 365);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchContributionWeeks() {
  const { from, to } = dateRange();
  const query = `
    query Contributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
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

  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error(`GitHub user not found: ${username}`);

  return {
    source: "GitHub GraphQL API",
    total: calendar.totalContributions,
    weeks: calendar.weeks.slice(-WEEKS).map((week) => week.contributionDays)
  };
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

function sampleContributionWeeks() {
  const random = seededRandom(`${username}-sample-v1`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const lastSaturday = new Date(today);
  lastSaturday.setUTCDate(today.getUTCDate() + (6 - today.getUTCDay()));
  const start = new Date(lastSaturday);
  start.setUTCDate(lastSaturday.getUTCDate() - (WEEKS * 7 - 1));
  const weeks = [];
  let total = 0;

  for (let weekIndex = 0; weekIndex < WEEKS; weekIndex += 1) {
    const days = [];
    for (let dayIndex = 0; dayIndex < DAYS; dayIndex += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + weekIndex * 7 + dayIndex);
      const weekendFactor = dayIndex === 0 || dayIndex === 6 ? 0.45 : 1;
      const wave = (Math.sin(weekIndex * 0.57) + 1.2) * 1.8;
      const active = random() < 0.64 * weekendFactor;
      const contributionCount = date > today || !active
        ? 0
        : Math.max(1, Math.floor(random() * 7 + wave + (random() > 0.92 ? 8 : 0)));
      total += contributionCount;
      days.push({ date: isoDate(date), contributionCount });
    }
    weeks.push(days);
  }
  return { source: "sample data (local preview)", total, weeks };
}

function padWeeks(inputWeeks) {
  const padded = inputWeeks.map((week) => [...week]);
  while (padded.length < WEEKS) padded.unshift([]);
  return padded.slice(-WEEKS).map((week, weekIndex) => {
    const byDay = new Map(week.map((day) => [new Date(`${day.date}T00:00:00Z`).getUTCDay(), day]));
    return Array.from({ length: DAYS }, (_, dayIndex) =>
      byDay.get(dayIndex) || { date: `week-${weekIndex + 1}-day-${dayIndex + 1}`, contributionCount: 0 }
    );
  });
}

function contributionLevel(count, positiveCounts) {
  if (count <= 0) return 0;
  const sorted = [...positiveCounts].sort((a, b) => a - b);
  const q = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] || 1;
  if (count >= q(0.9)) return 4;
  if (count >= q(0.65)) return 3;
  if (count >= q(0.35)) return 2;
  return 1;
}

function buildSvg(dataset) {
  const weeks = padWeeks(dataset.weeks);
  const allDays = weeks.flat();
  const positiveCounts = allDays.map((day) => day.contributionCount).filter(Boolean);
  const visibleTotal = allDays.reduce((sum, day) => sum + day.contributionCount, 0);
  const maxCount = Math.max(0, ...positiveCounts);
  const firstRealDate = allDays.find((day) => /^\d{4}-/.test(day.date))?.date || "—";
  const today = isoDate(new Date());
  const lastRealDate = [...allDays].reverse().find((day) => /^\d{4}-/.test(day.date) && day.date <= today)?.date || "—";
  const palette = ["#132333", "#123f4c", "#087f8c", "#10b9b0", "#67f5d2"];
  const cells = [];
  const highlights = [];

  for (let weekIndex = 0; weekIndex < WEEKS; weekIndex += 1) {
    for (let dayIndex = 0; dayIndex < DAYS; dayIndex += 1) {
      const day = weeks[weekIndex][dayIndex];
      const x = GRID_X + weekIndex * STEP;
      const y = GRID_Y + dayIndex * STEP;
      const level = contributionLevel(day.contributionCount, positiveCounts);
      const opacity = level === 0 ? 0.68 : 1;
      cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${palette[level]}" opacity="${opacity}">
        <title>${escapeXml(day.date)}: ${day.contributionCount} contribuciones</title>
      </rect>`);
      if (day.contributionCount === maxCount && maxCount > 0) {
        highlights.push(`<rect x="${x - 3}" y="${y - 3}" width="${CELL + 6}" height="${CELL + 6}" rx="6" class="hotspot" fill="none" stroke="#f7d154" stroke-width="2"/>`);
      }
    }
  }

  const monthLabels = [];
  let previousMonth = "";
  weeks.forEach((week, index) => {
    const validDay = week.find((day) => /^\d{4}-/.test(day.date));
    if (!validDay) return;
    const date = new Date(`${validDay.date}T00:00:00Z`);
    const month = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" }).format(date).replace(".", "").toUpperCase();
    if (month !== previousMonth && (index === 0 || index % 3 === 0)) {
      monthLabels.push(`<text x="${GRID_X + index * STEP}" y="133" class="month">${escapeXml(month)}</text>`);
      previousMonth = month;
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="430" viewBox="0 0 1180 430" role="img" aria-labelledby="title desc">
  <title id="title">Mapa de contribuciones de ${escapeXml(username)}</title>
  <desc id="desc">Aproximadamente cuarenta semanas de contribuciones de GitHub con un dron animado.</desc>
  <defs>
    <linearGradient id="heatBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111c"/>
      <stop offset="0.55" stop-color="#0b1d2b"/>
      <stop offset="1" stop-color="#071722"/>
    </linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#67f5d2" stop-opacity="0.36"/>
      <stop offset="1" stop-color="#67f5d2" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#173248" stroke-width="1" opacity="0.34"/>
    </pattern>
    <filter id="droneGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <style>
    text { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    .eyebrow { fill: #67f5d2; font-size: 12px; font-weight: 700; letter-spacing: 2px; }
    .heading { fill: #edfaff; font-size: 24px; font-weight: 800; }
    .meta { fill: #83a5bb; font-size: 12px; }
    .month { fill: #83a5bb; font-size: 10px; font-weight: 700; }
    .day { fill: #83a5bb; font-size: 10px; }
    .stat { fill: #edfaff; font-size: 13px; font-weight: 700; }
    .flight { animation: fly 10s cubic-bezier(.45,0,.55,1) infinite; }
    .rotor { animation: rotor .18s linear infinite; transform-box: fill-box; transform-origin: center; }
    .hotspot { animation: hotspot 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    .signal { animation: signal 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes fly {
      0% { transform: translate(116px, 112px); opacity: 0; }
      8% { opacity: 1; }
      25% { transform: translate(330px, 125px); }
      50% { transform: translate(555px, 105px); }
      75% { transform: translate(785px, 122px); }
      92% { opacity: 1; }
      100% { transform: translate(1016px, 110px); opacity: 0; }
    }
    @keyframes rotor { to { transform: rotate(360deg); } }
    @keyframes hotspot { 50% { opacity: .35; transform: scale(1.25); } }
    @keyframes signal { from { opacity: .7; transform: scale(.3); } to { opacity: 0; transform: scale(1.5); } }
    @media (prefers-reduced-motion: reduce) {
      .flight, .rotor, .hotspot, .signal { animation: none !important; }
      .flight { transform: translate(555px, 105px); opacity: 1; }
      .signal { display: none; }
    }
  </style>

  <rect width="1180" height="430" rx="28" fill="url(#heatBg)"/>
  <rect width="1180" height="430" rx="28" fill="url(#grid)"/>
  <path d="M28 88 H1152" stroke="#23445b"/>
  <path d="M28 352 H1152" stroke="#23445b"/>
  <path d="M28 28 H110 V31 H31 V108 H28Z" fill="#22d3ee"/>
  <path d="M1152 402 H1070 V399 H1149 V322 H1152Z" fill="#22d3ee"/>

  <text x="45" y="49" class="eyebrow">FLIGHT LOG // CONTRIBUTIONS</text>
  <text x="45" y="75" class="heading">GITHUB ACTIVITY RADAR</text>
  <text x="1135" y="48" text-anchor="end" class="meta">@${escapeXml(username)}</text>
  <text x="1135" y="69" text-anchor="end" class="meta">${escapeXml(firstRealDate)} → ${escapeXml(lastRealDate)}</text>

  ${monthLabels.join("\n  ")}
  <text x="117" y="161" class="day">SUN</text>
  <text x="117" y="203" class="day">TUE</text>
  <text x="117" y="245" class="day">THU</text>
  <text x="117" y="287" class="day">SAT</text>
  <g>${cells.join("\n")}</g>
  <g>${highlights.join("\n")}</g>

  <g class="flight" filter="url(#droneGlow)">
    <path d="M0 16 L0 54 L46 54 L46 16 Z" fill="url(#beam)"/>
    <ellipse class="signal" cx="23" cy="12" rx="18" ry="7" fill="none" stroke="#67f5d2"/>
    <path d="M9 5 H37 L43 13 L34 20 H12 L3 13Z" fill="#0d2735" stroke="#67f5d2" stroke-width="2"/>
    <path d="M13 10 H33 L29 16 H17Z" fill="#22d3ee"/>
    <circle class="rotor" cx="4" cy="7" r="6" fill="none" stroke="#f7d154" stroke-width="2" stroke-dasharray="4 3"/>
    <circle class="rotor" cx="42" cy="7" r="6" fill="none" stroke="#f7d154" stroke-width="2" stroke-dasharray="4 3"/>
    <circle cx="23" cy="13" r="2.5" fill="#f7d154"/>
  </g>

  <g transform="translate(45 376)">
    <text y="17" class="meta">TOTAL / 40 WEEKS</text>
    <text x="148" y="17" class="stat">${visibleTotal.toLocaleString("es-EC")}</text>
    <text x="250" y="17" class="meta">PEAK DAY</text>
    <text x="329" y="17" class="stat">${maxCount}</text>
    <text x="405" y="17" class="meta">SOURCE</text>
    <text x="465" y="17" class="stat">${escapeXml(dataset.source)}</text>
  </g>
  <g transform="translate(938 376)">
    <text y="17" class="meta">LESS</text>
    ${palette.map((color, index) => `<rect x="${40 + index * 24}" y="3" width="15" height="15" rx="3" fill="${color}"/>`).join("")}
    <text x="168" y="17" class="meta">MORE</text>
  </g>
</svg>`;
}

const dataset = token ? await fetchContributionWeeks() : sampleContributionWeeks();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, buildSvg(dataset), "utf8");
console.log(`Generated ${path.relative(rootDir, outputPath)} using ${dataset.source}`);

