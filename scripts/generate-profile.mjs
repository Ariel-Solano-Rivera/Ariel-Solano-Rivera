import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const configPath = path.join(rootDir, "profile.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const avatarPath = path.resolve(rootDir, config.avatar);
const avatarExtension = path.extname(avatarPath).toLowerCase();
const avatarMime = avatarExtension === ".webp" ? "image/webp" : "image/png";
const avatarDataUri = `data:${avatarMime};base64,${(await readFile(avatarPath)).toString("base64")}`;

const WIDTH = 1180;
const HEIGHT = 1140;

const themes = {
  light: {
    bg: "#eaf3f9",
    panel: "#ffffff",
    panelAlt: "#f2f8fc",
    text: "#10243a",
    muted: "#4d667a",
    border: "#afc9db",
    grid: "#c3d9e7",
    shadow: "#7694aa",
    terminal: "#e8f3f9",
    terminalText: "#173c55",
    dotRed: "#ff6b6b",
    dotYellow: "#f7c948",
    dotGreen: "#43c59e"
  },
  dark: {
    bg: "#050b14",
    panel: "#0b1725",
    panelAlt: "#10263a",
    text: "#f1f7ff",
    muted: "#91a9bc",
    border: "#28506a",
    grid: "#173a50",
    shadow: "#00040a",
    terminal: "#08131f",
    terminalText: "#bcecff",
    dotRed: "#ff6b6b",
    dotYellow: "#f7c948",
    dotGreen: "#43c59e"
  }
};

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
    const width = Math.max(78, label.length * 9.2 + 32);
    if (cursorX + width > x + maxWidth) {
      cursorX = x;
      cursorY += 39;
    }
    rows.push(`<g transform="translate(${cursorX} ${cursorY})">
      <rect width="${width.toFixed(1)}" height="30" rx="15" class="pill"/>
      <circle cx="15" cy="15" r="3.5" fill="${accent}"/>
      <text x="27" y="20" class="pillText">${escapeXml(label)}</text>
    </g>`);
    cursorX += width + 10;
  }
  return rows.join("\n");
}

function renderTechnologyPanels(accent) {
  return config.technologies.slice(0, 4).map((group, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 66 + col * 528;
    const y = 675 + row * 145;
    return `<g transform="translate(${x} ${y})">
      <rect width="520" height="126" rx="16" class="subpanel"/>
      <path d="M20 39 H500" class="hairline"/>
      <text x="260" y="26" text-anchor="middle" class="eyebrow">// ${escapeXml(group.category)}</text>
      ${renderPills(group.items, 20, 52, 480, accent)}
    </g>`;
  }).join("\n");
}

function renderContacts(accent) {
  const contacts = config.contacts.slice(0, 3);
  return contacts.map((contact, index) => {
    const x = 66 + index * 356;
    return `<a href="${escapeXml(contact.url)}" target="_blank">
      <g transform="translate(${x} 1010)" class="contact">
        <rect width="336" height="76" rx="14" class="contactBg"/>
        <path d="M0 14 V0 H14 M322 0 H336 V14 M336 62 V76 H322 M14 76 H0 V62" fill="none" stroke="${accent}" stroke-width="2"/>
        <circle cx="24" cy="38" r="8" fill="none" stroke="${accent}" stroke-width="2"/>
        <circle cx="24" cy="38" r="3" fill="${accent}"/>
        <text x="168" y="29" text-anchor="middle" class="contactLabel">${escapeXml(contact.label)}</text>
        <text x="168" y="53" text-anchor="middle" class="contactValue">${escapeXml(contact.value)}</text>
      </g>
    </a>`;
  }).join("\n");
}

function buildSvg(mode) {
  const theme = themes[mode];
  const accent = mode === "light"
    ? (config.accentLight || config.accent || "#087ea4")
    : (config.accentDark || config.accent || "#2dd4e8");
  const statusLines = wrapText(config.status, 46).slice(0, 3);
  const focusRows = config.focus.slice(0, 4).map((item, index) => {
    const x = 492 + (index % 2) * 310;
    const y = 544 + Math.floor(index / 2) * 40;
    return `<g transform="translate(${x} ${y})">
      <path d="M0 10 h12" stroke="${accent}" stroke-width="2"/>
      <circle cx="5" cy="10" r="3" fill="${theme.panel}" stroke="${accent}" stroke-width="2"/>
      <text x="22" y="15" class="focus">${escapeXml(item)}</text>
    </g>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Perfil profesional de ${escapeXml(config.name)}</title>
  <desc id="desc">Panel futurista tipo terminal con retrato pixel-art, perfil, tecnologías y contactos.</desc>
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
    <clipPath id="terminalClip"><rect x="42" y="42" width="1096" height="1056" rx="24"/></clipPath>
    <clipPath id="avatarClip"><rect x="82" y="168" width="338" height="338" rx="16"/></clipPath>
  </defs>
  <style>
    text { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    .frame { fill: ${theme.panel}; stroke: ${theme.border}; stroke-width: 1.5; }
    .terminalBar { fill: ${theme.terminal}; }
    .titlebar { fill: ${theme.muted}; font-size: 13px; letter-spacing: 1.35px; }
    .kicker { fill: ${accent}; font-size: 14px; font-weight: 800; letter-spacing: 2.8px; }
    .name { fill: ${theme.text}; font-size: 47px; font-weight: 800; letter-spacing: -1.5px; }
    .role { fill: ${theme.muted}; font-size: 18.5px; font-weight: 650; }
    .prompt { fill: ${accent}; font-size: 16px; font-weight: 800; }
    .status { fill: ${theme.text}; font-size: 17px; font-weight: 500; }
    .metaLabel { fill: ${theme.muted}; font-size: 12px; font-weight: 800; letter-spacing: 1.7px; }
    .metaValue { fill: ${theme.text}; font-size: 15.5px; font-weight: 700; }
    .avatarLabel { fill: ${accent}; font-size: 12px; font-weight: 800; letter-spacing: 2.1px; }
    .eyebrow { fill: ${accent}; font-size: 12.5px; font-weight: 800; letter-spacing: 1.8px; }
    .sectionTitle { fill: ${theme.text}; font-size: 24px; font-weight: 800; letter-spacing: .6px; }
    .focus { fill: ${theme.text}; font-size: 15.5px; font-weight: 700; }
    .subpanel { fill: ${theme.panelAlt}; stroke: ${theme.border}; stroke-width: 1.25; }
    .hairline { fill: none; stroke: ${theme.border}; stroke-width: 1; }
    .pill { fill: ${theme.panel}; stroke: ${theme.border}; stroke-width: 1; }
    .pillText { fill: ${theme.text}; font-size: 13px; font-weight: 700; }
    .contactBg { fill: ${theme.panelAlt}; stroke: ${theme.border}; stroke-width: 1.25; transition: fill .2s ease; }
    .contactLabel { fill: ${accent}; font-size: 11.5px; font-weight: 800; letter-spacing: 1.6px; }
    .contactValue { fill: ${theme.text}; font-size: 14px; font-weight: 700; }
    .contact:hover .contactBg { fill: ${theme.terminal}; }
    .cursor { animation: blink 1.1s steps(1) infinite; }
    .scan { animation: scan 7s linear infinite; }
    .pulse { animation: pulse 2.8s ease-in-out infinite; transform-origin: 437px 432px; }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes scan { from { transform: translateY(-40px); } to { transform: translateY(1080px); } }
    @keyframes pulse { 50% { opacity: .45; } }
    @media (prefers-reduced-motion: reduce) {
      .cursor, .scan, .pulse { animation: none !important; }
      .scan { display: none; }
    }
  </style>

  <rect width="1180" height="1140" rx="30" fill="url(#background)"/>
  <rect width="1180" height="1140" rx="30" fill="url(#microgrid)" opacity="0.38"/>
  <path d="M0 160 H1180 M0 970 H1180" stroke="${accent}" stroke-opacity="0.09"/>
  <g filter="url(#shadow)">
    <rect x="42" y="42" width="1096" height="1056" rx="24" class="frame"/>
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
    <rect x="66" y="122" width="370" height="450" rx="20" fill="${theme.terminal}" stroke="${theme.border}" stroke-width="1.25"/>
    <path d="M86 153 H416" stroke="${theme.border}"/>
    <circle cx="96" cy="141" r="3.5" fill="${accent}" class="pulse"/>
    <text x="251" y="145" text-anchor="middle" class="avatarLabel">PORTRAIT.PX / IDENTITY</text>
    <image href="${avatarDataUri}" x="82" y="168" width="338" height="338" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
    <rect x="82" y="168" width="338" height="338" rx="16" fill="none" stroke="${accent}" stroke-opacity="0.72"/>
    <path d="M82 192 V168 H106 M396 168 H420 V192 M420 482 V506 H396 M106 506 H82 V482" fill="none" stroke="${accent}" stroke-width="3"/>
    <text x="251" y="545" text-anchor="middle" class="titlebar">PIXEL_RENDER // SIGNAL LOCKED</text>
  </g>

  <g>
    <text x="794" y="145" text-anchor="middle" class="kicker">HELLO_WORLD.EXE</text>
    <text x="794" y="198" text-anchor="middle" class="name">${escapeXml(config.name)}</text>
    <text x="794" y="236" text-anchor="middle" class="role">${escapeXml(config.role)}</text>
    <path d="M474 262 H1114" stroke="url(#accentLine)" stroke-width="2"/>
    <text x="794" y="302" text-anchor="middle" class="prompt">$ whoami <tspan class="cursor">█</tspan></text>
    ${renderTextLines(statusLines, 794, 337, 26, "status", 'text-anchor="middle"')}

    <g transform="translate(474 414)">
      <rect width="310" height="76" rx="13" class="subpanel"/>
      <text x="155" y="27" text-anchor="middle" class="metaLabel">LOCATION</text>
      <text x="155" y="54" text-anchor="middle" class="metaValue">${escapeXml(config.location)}</text>
    </g>
    <g transform="translate(804 414)">
      <rect width="310" height="76" rx="13" class="subpanel"/>
      <text x="155" y="25" text-anchor="middle" class="metaLabel">EDUCATION</text>
      ${renderTextLines(wrapText(config.education, 31).slice(0, 2), 155, 49, 18, "metaValue", 'text-anchor="middle"')}
    </g>
    <text x="794" y="522" text-anchor="middle" class="eyebrow">CURRENT_FOCUS[]</text>
    ${focusRows}
  </g>

  <path d="M66 622 H1114" stroke="${theme.border}"/>
  <rect x="530" y="620" width="120" height="4" rx="2" fill="${accent}"/>
  <text x="590" y="655" text-anchor="middle" class="sectionTitle">TECH STACK // TOOLKIT</text>
  ${renderTechnologyPanels(accent)}

  <path d="M66 972 H1114" stroke="${theme.border}"/>
  <text x="590" y="997" text-anchor="middle" class="eyebrow">OPEN_CHANNELS</text>
  ${renderContacts(accent)}
  <text x="1114" y="1122" text-anchor="end" class="titlebar">CONFIG-DRIVEN · SVG/1.1 · ${escapeXml(config.username)}</text>
</svg>`;
}

for (const mode of Object.keys(themes)) {
  const outputPath = path.join(rootDir, `${mode}.svg`);
  await writeFile(outputPath, buildSvg(mode), "utf8");
  console.log(`Generated ${path.relative(rootDir, outputPath)}`);
}
