import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const config = JSON.parse(await readFile(path.join(rootDir, "profile.config.json"), "utf8"));
const asciiPortrait = (await readFile(path.resolve(rootDir, "assets/avatar-ascii.txt"), "utf8"))
  .replace(/\r/g, "")
  .split("\n")
  .filter((line) => line.length > 0);

const WIDTH = 1180;
const HEIGHT = 610;

const themes = {
  light: {
    backgroundStart: "#f8fbff",
    backgroundEnd: "#e8f0f8",
    chrome: "#ffffff",
    panel: "#f7fbff",
    panelOpacity: 0.7,
    text: "#172033",
    value: "#243047",
    muted: "#8290a6",
    scanline: "#38bdf8",
    shadow: "#7d91a8"
  },
  dark: {
    backgroundStart: "#0b1120",
    backgroundEnd: "#050816",
    chrome: "#0b1120",
    panel: "#0b1120",
    panelOpacity: 0.35,
    text: "#dbeafe",
    value: "#e5e7eb",
    muted: "#64748b",
    scanline: "#7dd3fc",
    shadow: "#00040c"
  }
};

const cyan = config.accentDark || config.accent || "#22d3ee";
const violet = "#7c3aed";
const green = "#10b981";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function techItems(match) {
  const group = config.technologies.find((item) =>
    item.category.toLowerCase().includes(match.toLowerCase())
  );
  return group?.items?.join(", ") || "—";
}

function contact(label) {
  return config.contacts.find((item) => item.label === label)?.value || "—";
}

function compact(value, max = 42) {
  const text = String(value);
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const infoRows = [
  { type: "head", value: `${config.username.toLowerCase()}@devos` },
  { key: "Subject", value: config.name },
  { key: "Role", value: config.terminal?.role || compact(config.role, 30) },
  { key: "Origin", value: config.location },
  { key: "Education", value: config.terminal?.education || compact(config.education, 30) },
  { key: "Status", value: config.terminal?.status || compact(config.status, 30) },
  { key: "ToolChain", value: config.terminal?.toolchain || compact(techItems("TOOLS"), 30) },
  { type: "spacer" },
  { key: "Core.Lang", value: config.terminal?.languages || compact(techItems("LANGUAGES"), 30) },
  { key: "Core.Frontend", value: config.terminal?.frontend || compact(techItems("WEB"), 30) },
  { key: "Core.Backend", value: config.terminal?.backend || "Node.js, REST APIs, Java" },
  { key: "Core.Data", value: config.terminal?.data || compact(techItems("DATA"), 30) },
  { key: "Core.Focus", value: config.terminal?.focus || compact(config.focus.join(", "), 30) },
  { type: "spacer" },
  { type: "section", value: "- Contact" },
  { key: "Grid.Mail", value: contact("EMAIL") },
  { key: "Grid.Portfolio", value: contact("PORTFOLIO") },
  { key: "Grid.Instagram", value: contact("INSTAGRAM") },
  { key: "Grid.Github", value: config.username },
  { type: "spacer" },
  { type: "section", value: "- Live Stats" },
  { type: "value", value: "Contribution radar synchronized below ↓" }
];

function renderAscii() {
  const startY = 69;
  const lineHeight = 7.35;
  return asciiPortrait.slice(0, 56).map((line, index) =>
    `<tspan x="30" y="${(startY + index * lineHeight).toFixed(2)}" xml:space="preserve">${escapeXml(line)}</tspan>`
  ).join("\n");
}

function renderInfoRows() {
  return infoRows.map((row, index) => {
    const y = 42 + index * 22;
    const delay = (0.65 + index * 0.105).toFixed(2);
    const style = `style="animation-delay: ${delay}s"`;

    if (row.type === "spacer") {
      return `<g class="infoLine" ${style}><text x="520" y="${y}" class="leaders">·</text></g>`;
    }
    if (row.type === "head") {
      return `<g class="infoLine" ${style}>
        <text x="520" y="${y}" class="head">${escapeXml(row.value)}<tspan class="leaders"> ─────────────────────────────</tspan></text>
      </g>`;
    }
    if (row.type === "section") {
      return `<g class="infoLine" ${style}>
        <text x="520" y="${y}" class="section">${escapeXml(row.value)}<tspan class="leaders"> ───────────────────────────────────</tspan></text>
      </g>`;
    }
    if (row.type === "value") {
      return `<g class="infoLine" ${style}><text x="520" y="${y}" class="value">·  ${escapeXml(row.value)}</text></g>`;
    }

    const displayValue = compact(row.value, 30);
    return `<g class="infoLine" ${style}>
      <text x="520" y="${y}">
        <tspan x="520" class="leaders">·</tspan>
        <tspan x="540" class="key">${escapeXml(row.key)}</tspan>
        <tspan x="680" class="leaders">: ..................</tspan>
        <tspan x="870" class="value">${escapeXml(displayValue)}</tspan>
      </text>
    </g>`;
  }).join("\n");
}

function buildSvg(mode) {
  const theme = themes[mode];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Perfil terminal de ${escapeXml(config.name)}</title>
  <desc id="desc">Interfaz de terminal con retrato ASCII, información profesional y contactos.</desc>
  <defs>
    <linearGradient id="asciiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${cyan}"/>
      <stop offset="55%" stop-color="${mode === "dark" ? "#60a5fa" : "#2563eb"}"/>
      <stop offset="100%" stop-color="${violet}"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${violet}"/>
      <stop offset="50%" stop-color="${cyan}"/>
      <stop offset="100%" stop-color="${green}"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="30%" cy="20%" r="85%">
      <stop offset="0%" stop-color="${theme.backgroundStart}"/>
      <stop offset="100%" stop-color="${theme.backgroundEnd}"/>
    </radialGradient>
    <linearGradient id="scanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${cyan}" stop-opacity="0"/>
      <stop offset="45%" stop-color="${cyan}" stop-opacity="0.04"/>
      <stop offset="50%" stop-color="${mode === "dark" ? "#a5f3fc" : "#0891b2"}" stop-opacity="0.7"/>
      <stop offset="55%" stop-color="${cyan}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="${violet}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="${theme.scanline}" opacity="0.055"/>
    </pattern>
    <filter id="frameShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="${theme.shadow}" flood-opacity="0.22"/>
    </filter>
    <mask id="portraitReveal">
      <rect x="0" y="0" width="488" height="468" fill="white" class="revealRect"/>
    </mask>
  </defs>
  <style>
    text, tspan { white-space: pre; font-family: "Courier New", Consolas, monospace; }
    .ascii { font-size: 7.4px; fill: url(#asciiGrad); letter-spacing: -0.2px; font-weight: 700; }
    .key { font-size: 15px; fill: ${cyan}; font-weight: 700; }
    .value { font-size: 15px; fill: ${theme.value}; }
    .leaders { font-size: 15px; fill: ${theme.muted}; }
    .head { font-size: 17px; fill: ${violet}; font-weight: 700; }
    .section { font-size: 15px; fill: ${green}; font-weight: 700; }
    .termLabel { font-size: 12px; fill: ${theme.muted}; letter-spacing: .5px; }
    .scanLabel { font-size: 10px; fill: #f87171; letter-spacing: 1px; }
    .panelTitle { font-size: 11px; fill: ${mode === "dark" ? "#38bdf8" : "#0284c7"}; letter-spacing: 2px; opacity: .78; }
    .infoLine { opacity: 0; transform: translateX(-10px); animation: lineIn .38s ease forwards; }
    .revealRect { transform-box: fill-box; transform-origin: top; transform: scaleY(0); animation: reveal 2.6s .2s cubic-bezier(.25,.1,.25,1) forwards; }
    .scanBeam { animation: scan 4.2s linear infinite; mix-blend-mode: screen; }
    .frameBorder { animation: borderPulse 3.2s ease-in-out infinite; }
    .statusDot { animation: blink 1.1s ease-in-out infinite; }
    .cursor { animation: blink 1.1s steps(1) 3.3s infinite; }
    @keyframes lineIn { to { opacity: 1; transform: translateX(0); } }
    @keyframes reveal { to { transform: scaleY(1); } }
    @keyframes scan { from { transform: translateY(-70px); } to { transform: translateY(680px); } }
    @keyframes borderPulse { 50% { opacity: .52; } }
    @keyframes blink { 50% { opacity: .18; } }
    @media (prefers-reduced-motion: reduce) {
      .infoLine, .revealRect, .scanBeam, .frameBorder, .statusDot, .cursor { animation: none !important; }
      .infoLine { opacity: 1; transform: none; }
      .revealRect { transform: scaleY(1); }
      .scanBeam { display: none; }
    }
  </style>

  <rect width="1180" height="610" rx="18" fill="url(#bgGlow)"/>
  <rect width="1180" height="610" rx="18" fill="url(#scanlines)"/>

  <g id="titlebar">
    <rect x="3" y="3" width="1174" height="34" rx="16" fill="${theme.chrome}" fill-opacity=".9"/>
    <circle cx="24" cy="20" r="5" fill="#ef4444"/>
    <circle cx="42" cy="20" r="5" fill="#f59e0b"/>
    <circle cx="60" cy="20" r="5" fill="#10b981"/>
    <text x="590" y="25" text-anchor="middle" class="termLabel">${escapeXml(config.username.toLowerCase())}@devos ~ % ./profile.sh --live</text>
    <circle cx="1108" cy="20" r="4" fill="#f87171" class="statusDot"/>
    <text x="1118" y="24" class="scanLabel">SCANNING</text>
  </g>

  <g transform="translate(0 38)">
    <rect x="14" y="26" width="488" height="468" rx="14" fill="${theme.panel}" fill-opacity="${theme.panelOpacity}" stroke="url(#borderGrad)" stroke-width="1" opacity=".55"/>
    <rect x="508" y="10" width="655" height="500" rx="14" fill="${theme.panel}" fill-opacity="${theme.panelOpacity}" stroke="url(#borderGrad)" stroke-width="1" opacity=".55"/>
    <text x="30" y="24" class="panelTitle">VISUAL.MAP</text>
    <text x="524" y="24" class="panelTitle">SYSTEM.INFO</text>

    <g mask="url(#portraitReveal)">
      <text x="30" y="0" class="ascii">${renderAscii()}</text>
    </g>

    ${renderInfoRows()}

    <rect x="522" y="485" width="9" height="16" fill="${cyan}" class="cursor"/>
  </g>

  <rect x="0" y="-70" width="1180" height="70" fill="url(#scanGrad)" opacity=".72" class="scanBeam"/>
  <rect x="3" y="3" width="1174" height="604" rx="16" fill="none" stroke="url(#borderGrad)" stroke-width="2" opacity=".88" class="frameBorder" filter="url(#frameShadow)"/>
</svg>`;
}

for (const mode of ["light", "dark"]) {
  const output = path.join(rootDir, `${mode}.svg`);
  await writeFile(output, buildSvg(mode), "utf8");
  console.log(`Generated ${path.relative(rootDir, output)}`);
}
