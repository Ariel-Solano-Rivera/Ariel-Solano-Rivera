import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const configPath = path.join(rootDir, "profile.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

const WIDTH = 1180;
const HEIGHT = 980;

const themes = {
  light: {
    bg: "#f4f8fc",
    panel: "#ffffff",
    panelAlt: "#edf5fb",
    text: "#10253a",
    muted: "#567086",
    border: "#bdd2e3",
    grid: "#cfe0ec",
    shadow: "#8ca7b8",
    terminal: "#e7f1f7",
    terminalText: "#173c55",
    dotRed: "#ff6b6b",
    dotYellow: "#f7c948",
    dotGreen: "#43c59e"
  },
  dark: {
    bg: "#07111c",
    panel: "#0d1b2a",
    panelAlt: "#102538",
    text: "#e6f6ff",
    muted: "#83a5bb",
    border: "#23445b",
    grid: "#173248",
    shadow: "#000814",
    terminal: "#091722",
    terminalText: "#bcecff",
    dotRed: "#ff6b6b",
    dotYellow: "#f7c948",
    dotGreen: "#43c59e"
  }
};

const asciiPortrait = [
  "             .------.",
  "          .-'  _  _  '-.",
  "        .'    (o)(o)    '.",
  "       /       .--.       \\",
  "      |       /____\\       |",
  "      |     .-      -.     |",
  "       \\   |  /\\  |    /",
  "        '._ \\______/ _.'",
  "           '-.____.-'",
  "          __/|    |\\__",
  "       .-'   | /\\ |   '-.",
  "      /  ____|/  \\|____  \\",
  "     /  /  {  CODE  }  \\  \\",
  "    |  |     /____\\     |  |",
  "    |__|____/______\\____|__|",
  "       /___/  /\\  \\___\\",
  "      /___/__/  \\__\\___\\",
  "         << SIGNAL OK >>"
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderTextLines(lines, x, y, lineHeight, className, extra = "") {
  return `<text x="${x}" y="${y}" class="${className}" ${extra}>${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("")}</text>`;
}

function renderPills(items, x, y, maxWidth, accent) {
  const rows = [];
  let cursorX = x;
  let cursorY = y;
  for (const item of items) {
    const label = String(item);
    const width = Math.max(72, label.length * 8.1 + 28);
    if (cursorX + width > x + maxWidth) {
      cursorX = x;
      cursorY += 34;
    }
    rows.push(`<g transform="translate(${cursorX} ${cursorY})">
      <rect width="${width.toFixed(1)}" height="25" rx="12.5" class="pill"/>
      <circle cx="13" cy="12.5" r="3" fill="${accent}"/>
      <text x="23" y="16.5" class="pillText">${escapeXml(label)}</text>
    </g>`);
    cursorX += width + 9;
  }
  return rows.join("\n");
}

function renderTechnologyPanels(accent) {
  return config.technologies.slice(0, 4).map((group, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 46 + col * 554;
    const y = 597 + row * 122;
    return `<g transform="translate(${x} ${y})">
      <rect width="534" height="104" rx="14" class="subpanel"/>
      <path d="M18 31 H516" class="hairline"/>
      <text x="18" y="21" class="eyebrow">// ${escapeXml(group.category)}</text>
      ${renderPills(group.items, 18, 44, 498, accent)}
    </g>`;
  }).join("\n");
}

function renderContacts(accent) {
  const contacts = config.contacts.slice(0, 3);
  const slotWidth = 350;
  return contacts.map((contact, index) => {
    const x = 47 + index * 366;
    return `<a href="${escapeXml(contact.url)}" target="_blank">
      <g transform="translate(${x} 864)" class="contact">
        <rect width="350" height="64" rx="12" class="contactBg"/>
        <path d="M0 12 V0 H12 M338 0 H350 V12 M350 52 V64 H338 M12 64 H0 V52" fill="none" stroke="${accent}" stroke-width="2"/>
        <circle cx="25" cy="32" r="7" fill="none" stroke="${accent}" stroke-width="2"/>
        <circle cx="25" cy="32" r="2.5" fill="${accent}"/>
        <text x="43" y="25" class="contactLabel">${escapeXml(contact.label)}</text>
        <text x="43" y="44" class="contactValue">${escapeXml(contact.value)}</text>
      </g>
    </a>`;
  }).join("\n");
}

function buildSvg(mode) {
  const theme = themes[mode];
  const accent = config.accent || "#22d3ee";
  const statusLines = wrapText(config.status, 52).slice(0, 3);
  const asciiLines = asciiPortrait.map((line, index) =>
    `<tspan x="76" dy="${index === 0 ? 0 : 20}">${escapeXml(line)}</tspan>`
  ).join("");
  const focusRows = config.focus.slice(0, 4).map((item, index) => {
    const x = 472 + (index % 2) * 300;
    const y = 475 + Math.floor(index / 2) * 35;
    return `<g transform="translate(${x} ${y})">
      <path d="M0 10 h12" stroke="${accent}" stroke-width="2"/>
      <circle cx="5" cy="10" r="3" fill="${theme.panel}" stroke="${accent}" stroke-width="2"/>
      <text x="22" y="15" class="focus">${escapeXml(item)}</text>
    </g>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Perfil profesional de ${escapeXml(config.name)}</title>
  <desc id="desc">Panel futurista tipo terminal con retrato ASCII, perfil, tecnologías y contactos.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.bg}"/>
      <stop offset="0.58" stop-color="${theme.panelAlt}"/>
      <stop offset="1" stop-color="${theme.bg}"/>
    </linearGradient>
    <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="microgrid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="${theme.grid}" stroke-width="1" opacity="0.42"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="${theme.shadow}" flood-opacity="0.28"/>
    </filter>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="terminalClip"><rect x="42" y="42" width="1096" height="896" rx="24"/></clipPath>
  </defs>
  <style>
    text { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    .frame { fill: ${theme.panel}; stroke: ${theme.border}; stroke-width: 1.5; }
    .terminalBar { fill: ${theme.terminal}; }
    .titlebar { fill: ${theme.muted}; font-size: 12px; letter-spacing: 1.2px; }
    .kicker { fill: ${accent}; font-size: 13px; font-weight: 700; letter-spacing: 2.6px; }
    .name { fill: ${theme.text}; font-size: 42px; font-weight: 800; letter-spacing: -1.4px; }
    .role { fill: ${theme.muted}; font-size: 17px; font-weight: 600; }
    .prompt { fill: ${accent}; font-size: 14px; font-weight: 700; }
    .status { fill: ${theme.text}; font-size: 15px; }
    .metaLabel { fill: ${theme.muted}; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
    .metaValue { fill: ${theme.text}; font-size: 14px; font-weight: 600; }
    .ascii { fill: ${theme.terminalText}; font-size: 13.5px; font-weight: 600; white-space: pre; }
    .asciiAccent { fill: ${accent}; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
    .eyebrow { fill: ${accent}; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; }
    .sectionTitle { fill: ${theme.text}; font-size: 20px; font-weight: 800; letter-spacing: .5px; }
    .focus { fill: ${theme.text}; font-size: 14px; font-weight: 600; }
    .subpanel { fill: ${theme.panelAlt}; stroke: ${theme.border}; stroke-width: 1; }
    .hairline { fill: none; stroke: ${theme.border}; stroke-width: 1; }
    .pill { fill: ${theme.panel}; stroke: ${theme.border}; stroke-width: 1; }
    .pillText { fill: ${theme.text}; font-size: 11.5px; font-weight: 600; }
    .contactBg { fill: ${theme.panelAlt}; stroke: ${theme.border}; stroke-width: 1; transition: fill .2s ease; }
    .contactLabel { fill: ${accent}; font-size: 10px; font-weight: 700; letter-spacing: 1.4px; }
    .contactValue { fill: ${theme.text}; font-size: 12.5px; font-weight: 600; }
    .contact:hover .contactBg { fill: ${theme.terminal}; }
    .cursor { animation: blink 1.1s steps(1) infinite; }
    .scan { animation: scan 7s linear infinite; }
    .pulse { animation: pulse 2.8s ease-in-out infinite; transform-origin: 437px 432px; }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes scan { from { transform: translateY(-40px); } to { transform: translateY(930px); } }
    @keyframes pulse { 50% { opacity: .45; } }
    @media (prefers-reduced-motion: reduce) {
      .cursor, .scan, .pulse { animation: none !important; }
      .scan { display: none; }
    }
  </style>

  <rect width="1180" height="980" rx="30" fill="url(#background)"/>
  <rect width="1180" height="980" rx="30" fill="url(#microgrid)" opacity="0.5"/>
  <path d="M0 145 H1180 M0 825 H1180" stroke="${accent}" stroke-opacity="0.08"/>
  <g filter="url(#shadow)">
    <rect x="42" y="42" width="1096" height="896" rx="24" class="frame"/>
    <path d="M66 42 H1114 Q1138 42 1138 66 V94 H42 V66 Q42 42 66 42Z" class="terminalBar"/>
  </g>
  <g clip-path="url(#terminalClip)">
    <rect x="42" y="94" width="1096" height="2" fill="url(#accentLine)"/>
    <rect class="scan" x="42" y="94" width="1096" height="2" fill="url(#accentLine)" opacity="0.33"/>
  </g>

  <circle cx="69" cy="68" r="6" fill="${theme.dotRed}"/>
  <circle cx="89" cy="68" r="6" fill="${theme.dotYellow}"/>
  <circle cx="109" cy="68" r="6" fill="${theme.dotGreen}"/>
  <text x="590" y="72" text-anchor="middle" class="titlebar">ARIEL://PROFILE — ${mode.toUpperCase()} MODE</text>
  <text x="1107" y="72" text-anchor="end" class="titlebar">NODE 20 · ONLINE</text>

  <g>
    <rect x="66" y="119" width="350" height="424" rx="18" fill="${theme.terminal}" stroke="${theme.border}"/>
    <path d="M86 146 H396" stroke="${theme.border}"/>
    <circle cx="87" cy="136" r="3" fill="${accent}" class="pulse"/>
    <text x="98" y="140" class="asciiAccent">AVATAR.ASCII / ORIGINAL</text>
    <text x="76" y="178" class="ascii">${asciiLines}</text>
  </g>

  <g>
    <text x="456" y="137" class="kicker">HELLO_WORLD.EXE</text>
    <text x="456" y="188" class="name">${escapeXml(config.name)}</text>
    <text x="456" y="222" class="role">${escapeXml(config.role)}</text>
    <path d="M456 245 H1090" stroke="url(#accentLine)" stroke-width="2"/>
    <text x="456" y="280" class="prompt">$ whoami <tspan class="cursor">█</tspan></text>
    ${renderTextLines(statusLines, 456, 309, 23, "status")}

    <g transform="translate(456 372)">
      <rect width="310" height="58" rx="10" class="subpanel"/>
      <text x="16" y="20" class="metaLabel">LOCATION</text>
      <text x="16" y="42" class="metaValue">${escapeXml(config.location)}</text>
    </g>
    <g transform="translate(780 372)">
      <rect width="310" height="58" rx="10" class="subpanel"/>
      <text x="16" y="20" class="metaLabel">EDUCATION</text>
      ${renderTextLines(wrapText(config.education, 34).slice(0, 2), 16, 39, 15, "metaValue")}
    </g>
    <text x="456" y="459" class="eyebrow">CURRENT_FOCUS[]</text>
    ${focusRows}
  </g>

  <path d="M66 568 H1114" stroke="${theme.border}"/>
  <rect x="66" y="567" width="112" height="3" rx="1.5" fill="${accent}"/>
  <text x="66" y="584" class="sectionTitle">TECH STACK // TOOLKIT</text>
  ${renderTechnologyPanels(accent)}

  <path d="M66 838 H1114" stroke="${theme.border}"/>
  <text x="66" y="859" class="eyebrow">OPEN_CHANNELS</text>
  ${renderContacts(accent)}
  <text x="1114" y="958" text-anchor="end" class="titlebar">CONFIG-DRIVEN · SVG/1.1 · ${escapeXml(config.username)}</text>
</svg>`;
}

for (const mode of Object.keys(themes)) {
  const outputPath = path.join(rootDir, `${mode}.svg`);
  await writeFile(outputPath, buildSvg(mode), "utf8");
  console.log(`Generated ${path.relative(rootDir, outputPath)}`);
}

