export type StillScene =
  | "store"
  | "truck"
  | "mask"
  | "monitor"
  | "van"
  | "stop"
  | "road"
  | "paint"
  | "forest"
  | "document"
  | "phone"
  | "bags"
  | "box"
  | "boot"
  | "wash"
  | "clinic"
  | "silhouette";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const SCENES: Record<StillScene, string> = {
  store: `
    <rect width="960" height="640" fill="#14110d"/>
    <rect x="0" y="360" width="960" height="280" fill="#2a241c"/>
    <rect x="180" y="150" width="600" height="320" fill="#1b242c"/>
    <rect x="210" y="180" width="250" height="180" fill="#7f93a3" fill-opacity="0.35"/>
    <rect x="490" y="180" width="250" height="180" fill="#d4af37" fill-opacity="0.18"/>
    <rect x="300" y="390" width="120" height="80" fill="#0c0e12"/>
    <rect x="0" y="470" width="960" height="8" fill="#d4af37" fill-opacity="0.35"/>
    <circle cx="760" cy="120" r="36" fill="#f3e2b8" fill-opacity="0.8"/>
  `,
  truck: `
    <rect width="960" height="640" fill="#1a1612"/>
    <rect x="0" y="430" width="960" height="210" fill="#3a3126"/>
    <path d="M80 420 h430 l40-70 h150 v70 h120 v80 H80z" fill="#8a7353"/>
    <rect x="150" y="360" width="120" height="60" fill="#1c2830"/>
    <circle cx="230" cy="500" r="48" fill="#111"/>
    <circle cx="620" cy="500" r="48" fill="#111"/>
    <circle cx="230" cy="500" r="18" fill="#5c5348"/>
    <circle cx="620" cy="500" r="18" fill="#5c5348"/>
    <rect x="700" y="250" width="180" height="40" fill="#d4af37" fill-opacity="0.15"/>
  `,
  mask: `
    <rect width="960" height="640" fill="#12161b"/>
    <ellipse cx="480" cy="430" rx="280" ry="40" fill="#000" fill-opacity="0.45"/>
    <path d="M360 220 h240 l30 40 v180 l-40 30 h-220 l-40-30 V260z" fill="#2c333b"/>
    <path d="M410 300 h50 v36 h-50z M500 300 h50 v36 h-50z" fill="#0b0e12"/>
    <rect x="430" y="360" width="100" height="28" rx="14" fill="#1a1f26"/>
    <rect x="250" y="150" width="90" height="18" fill="#d4af37"/>
  `,
  monitor: `
    <rect width="960" height="640" fill="#07090c"/>
    <rect x="90" y="70" width="780" height="460" rx="8" fill="#101820" stroke="#3bc9db" stroke-opacity="0.45"/>
    <path d="M120 420 L300 250 L430 340 L560 180 L840 390" fill="none" stroke="#9fb4c4" stroke-width="3"/>
    <rect x="150" y="120" width="180" height="24" fill="#d4af37" fill-opacity="0.8"/>
    <text x="160" y="137" fill="#1a1404" font-family="ui-monospace,monospace" font-size="12">CAM 02  02:14:06</text>
    <circle cx="700" cy="160" r="8" fill="#e5484d"/>
  `,
  van: `
    <rect width="960" height="640" fill="#161311"/>
    <rect x="0" y="450" width="960" height="190" fill="#2c2824"/>
    <rect x="140" y="230" width="620" height="230" rx="8" fill="#e7e1d6"/>
    <rect x="180" y="260" width="150" height="90" fill="#243038"/>
    <rect x="360" y="270" width="360" height="150" fill="#c9c2b4"/>
    <circle cx="280" cy="470" r="42" fill="#161616"/>
    <circle cx="680" cy="470" r="42" fill="#161616"/>
    <rect x="150" y="170" width="220" height="16" fill="#e5484d" fill-opacity="0.7"/>
  `,
  stop: `
    <rect width="960" height="640" fill="#0d1218"/>
    <rect x="0" y="400" width="960" height="240" fill="#1c2430"/>
    <rect x="80" y="180" width="520" height="230" fill="#243246"/>
    <rect x="110" y="210" width="140" height="90" fill="#f2d48a" fill-opacity="0.55"/>
    <rect x="270" y="210" width="140" height="90" fill="#d7e4ee" fill-opacity="0.25"/>
    <rect x="430" y="210" width="140" height="90" fill="#f2d48a" fill-opacity="0.35"/>
    <rect x="680" y="80" width="16" height="360" fill="#c5ccd4"/>
    <circle cx="688" cy="70" r="34" fill="#e5484d"/>
  `,
  road: `
    <rect width="960" height="640" fill="#1d2420"/>
    <path d="M0 640 L380 180 H580 L960 640 Z" fill="#2a2f33"/>
    <path d="M470 220 H500 L700 640 H420 Z" fill="#d4af37" fill-opacity="0.75"/>
    <rect x="0" y="150" width="960" height="80" fill="#121814"/>
    <circle cx="760" cy="90" r="28" fill="#f4efe4" fill-opacity="0.7"/>
  `,
  paint: `
    <rect width="960" height="640" fill="#1a1c20"/>
    <ellipse cx="480" cy="340" rx="250" ry="160" fill="#2e343c"/>
    <path d="M300 300 C380 220, 520 250, 640 310 C560 420, 400 430, 300 360 Z" fill="#1f6f86"/>
    <path d="M340 330 C420 280, 540 300, 610 350" fill="none" stroke="#d4af37" stroke-width="8"/>
    <circle cx="420" cy="300" r="10" fill="#e7eef2"/>
  `,
  forest: `
    <rect width="960" height="640" fill="#101612"/>
    <rect x="0" y="430" width="960" height="210" fill="#1c1814"/>
    <path d="M80 460 L180 220 L280 460 Z" fill="#1d3328"/>
    <path d="M220 480 L360 160 L500 480 Z" fill="#244233"/>
    <path d="M460 470 L640 140 L820 470 Z" fill="#1a3329"/>
    <path d="M0 500 Q240 440 480 500 T960 470 V640 H0Z" fill="#0e1411"/>
    <circle cx="140" cy="100" r="22" fill="#f0e6cf" fill-opacity="0.35"/>
  `,
  document: `
    <rect width="960" height="640" fill="#1b1a17"/>
    <rect x="250" y="70" width="460" height="500" fill="#efe6d4"/>
    <rect x="290" y="120" width="280" height="14" fill="#1c1a16"/>
    <rect x="290" y="160" width="360" height="8" fill="#1c1a16" fill-opacity="0.55"/>
    <rect x="290" y="186" width="340" height="8" fill="#1c1a16" fill-opacity="0.4"/>
    <rect x="290" y="212" width="300" height="8" fill="#1c1a16" fill-opacity="0.4"/>
    <rect x="290" y="260" width="200" height="8" fill="#8a1f1f" fill-opacity="0.8"/>
    <rect x="290" y="300" width="360" height="8" fill="#1c1a16" fill-opacity="0.35"/>
    <rect x="290" y="326" width="320" height="8" fill="#1c1a16" fill-opacity="0.35"/>
  `,
  phone: `
    <rect width="960" height="640" fill="#121418"/>
    <rect x="390" y="80" width="180" height="460" rx="22" fill="#0c0d10" stroke="#d4af37"/>
    <rect x="406" y="120" width="148" height="340" fill="#16343a"/>
    <circle cx="480" cy="500" r="12" fill="#2a2e34"/>
    <rect x="430" y="150" width="100" height="10" fill="#3bc9db"/>
    <rect x="430" y="176" width="70" height="8" fill="#d7e7ea" fill-opacity="0.7"/>
  `,
  bags: `
    <rect width="960" height="640" fill="#14181c"/>
    <rect x="120" y="360" width="720" height="16" fill="#2a3036"/>
    <rect x="180" y="230" width="150" height="140" rx="6" fill="#d7d2c6"/>
    <rect x="360" y="200" width="170" height="170" rx="6" fill="#c2ddd8"/>
    <rect x="560" y="240" width="160" height="130" rx="6" fill="#ead7a4"/>
    <path d="M190 250 h130 M370 220 h150 M575 258 h130" stroke="#1a1a1a" stroke-width="4"/>
  `,
  box: `
    <rect width="960" height="640" fill="#171513"/>
    <rect x="230" y="150" width="500" height="340" fill="#6d5a3e"/>
    <path d="M230 150 L480 80 L730 150" fill="#8a7350"/>
    <rect x="300" y="230" width="220" height="90" fill="#efe6d4"/>
    <rect x="318" y="252" width="140" height="10" fill="#1a1404"/>
    <rect x="318" y="274" width="180" height="8" fill="#1a1404" fill-opacity="0.55"/>
    <rect x="560" y="250" width="90" height="90" fill="#d4af37"/>
  `,
  boot: `
    <rect width="960" height="640" fill="#c4b49a"/>
    <ellipse cx="480" cy="340" rx="180" ry="260" fill="#2a241c" fill-opacity="0.82"/>
    <ellipse cx="480" cy="430" rx="90" ry="40" fill="#1a1612"/>
    <rect x="80" y="70" width="180" height="28" fill="#1a1404"/>
    <text x="96" y="89" fill="#e0b84c" font-family="ui-monospace,monospace" font-size="14">CAST 04</text>
  `,
  wash: `
    <rect width="960" height="640" fill="#d9c7a4"/>
    <path d="M0 220 C180 180, 240 300, 400 260 C560 220, 620 120, 960 180 V640 H0Z" fill="#c2a67c"/>
    <path d="M0 420 C200 360, 360 480, 560 420 C720 370, 800 460, 960 410 V640 H0Z" fill="#ad8b5e"/>
    <rect x="620" y="300" width="70" height="18" fill="#6d5a3e"/>
  `,
  clinic: `
    <rect width="960" height="640" fill="#10161c"/>
    <rect x="120" y="160" width="720" height="320" fill="#1c2833"/>
    <rect x="160" y="200" width="90" height="140" fill="#d7e6ef" fill-opacity="0.35"/>
    <rect x="280" y="200" width="90" height="140" fill="#d7e6ef" fill-opacity="0.2"/>
    <rect x="400" y="200" width="90" height="140" fill="#f2d48a" fill-opacity="0.28"/>
    <rect x="520" y="200" width="90" height="140" fill="#d7e6ef" fill-opacity="0.2"/>
    <rect x="640" y="200" width="150" height="220" fill="#121a22"/>
    <rect x="430" y="80" width="16" height="80" fill="#e8eef2"/>
    <rect x="400" y="96" width="76" height="16" fill="#e5484d"/>
  `,
  silhouette: `
    <rect width="960" height="640" fill="#12161c"/>
    <rect x="280" y="40" width="400" height="560" fill="#1a212b" stroke="#d4af37" stroke-opacity="0.5"/>
    <circle cx="480" cy="230" r="70" fill="#2a3340"/>
    <path d="M340 520 C360 390, 400 360, 480 360 C560 360, 600 390, 620 520 Z" fill="#2a3340"/>
    <rect x="310" y="70" width="160" height="16" fill="#d4af37"/>
    <text x="322" y="83" fill="#1a1404" font-family="ui-monospace,monospace" font-size="12">NO BOOKING PHOTO</text>
  `,
};

export function renderStill(scene: StillScene, caption: string, stamp: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <defs>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.28"/></feComponentTransfer>
    </filter>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  ${SCENES[scene]}
  <rect width="960" height="640" filter="url(#grain)" opacity="0.45"/>
  <rect width="960" height="640" fill="url(#vignette)"/>
  <rect x="28" y="28" width="176" height="26" fill="#090c10" fill-opacity="0.78" stroke="#d4af37" stroke-opacity="0.85"/>
  <text x="116" y="46" text-anchor="middle" fill="#e0b84c" font-family="ui-monospace,monospace" font-size="12" letter-spacing="1.6">BCSO EVIDENCE</text>
  <text x="36" y="578" fill="#e0b84c" font-family="ui-monospace,monospace" font-size="13">${esc(stamp)}</text>
  <text x="36" y="604" fill="#f4f7fb" font-family="ui-monospace,monospace" font-size="18">${esc(caption)}</text>
</svg>`;
}
