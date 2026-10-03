# Decaid Zen

A calm, graph-first WebUI skin for [Decaid](https://github.com/decentespresso/decaid).
Dark ground, hairline rules, one growing shot graph, swipe-in detail drawers.

## Develop against a running machine

```bash
npm install
cp .env.example .env      # point VITE_GATEWAY at the tablet, e.g. http://192.168.1.100:8080
npm run dev -- --host
```

Then open `http://<laptop-ip>:5173` in the tablet's browser: hot reload on the real
screen, with real touch and real hardware. The gateway's REST handlers send
`Access-Control-Allow-Origin: *`, so the cross-origin calls from the dev server work.

When the skin is installed inside Decaid it is served from the gateway itself, so
`VITE_GATEWAY` is unset in production builds and every call goes to the page's own origin.

## Install onto the machine

```bash
npm run package                     # builds and zips dist/ -> decaid-zen-<version>.zip
python3 -m http.server 9000         # serve the zip from this directory

curl -X POST http://<tablet-ip>:8080/api/v1/webui/skins/install/url \
  -H 'content-type: application/json' \
  -d '{"url":"http://<laptop-ip>:9000/decaid-zen-<version>.zip"}'

curl -X PUT http://<tablet-ip>:8080/api/v1/webui/skins/default \
  -H 'content-type: application/json' -d '{"skinId":"decaid-zen"}'
```

## What talks to what

| Screen | Reads | Writes |
|---|---|---|
| Idle | `ws/v1/machine/snapshot`, `ws/v1/scale/snapshot`, `GET /workflow`, `GET /machine/waterLevels`, `GET /shots/latest` | `PUT /machine/state/{espresso,steam,hotWater,flush}` |
| Live shot | the same two sockets | `PUT /machine/state/idle` to stop |
| Journal | `GET /shots`, `GET /shots/{id}` | — |
| Dial in | `GET /workflow` | `PUT /workflow` |

The shot graph keeps samples in a ref-held ring buffer and paints on
`requestAnimationFrame`, decoupled from the ~10Hz socket, so a slow frame never
blocks the stream. Its x-axis spans 0→now (floor of 15s) with the live edge pinned
right and values in a fixed gutter.

## Design

The visual reference lives in a Claude Design canvas — dark ground, Newsreader for
words, Spectral 200 for numerals, Jost for the small caps labels, and the DE1 line
colours: red brew temp, green pressure, sand weight and ratio, teal flow.

## UI review build

`npm test` runs the numeric-edit, graph-range, label-layout and frame-index regressions.
`npm run build` checks TypeScript and builds the offline font assets. Tests require Node 22.18+.

The preview fixtures run without machine sockets or hardware commands:

- `/?mock` — home; `/?mock&settings` — settings
- `/?mock&shot` — live espresso; `/?mock&steam` — steam
- `/?mock&noscale` — missing scale; `/?mock&asleep` — sleep
- `/?mock&history` — 45 shots to exercise pagination
- `/?mock&failSave=settings` — rejected settings saves
- `/?mock&failSave=%2Fshots%2F` — rejected tasting-note saves

The bundled fonts are Jost and Newsreader; their licenses ship in `font-licenses/`.

Settings → Skin → Colours & theme opens live colour and opacity controls,
including graph colours. Named palettes and the original protected **Default** are
stored in this browser on this device. Undo reverses an edit; Reset to Default
restores the original appearance. There is no import/export. The editor keeps its
recovery controls in Default colours so low-contrast experiments remain reversible.

The bean button traces its border during the first catalog load and sort, then opens
the populated drawer. Reopening uses the cached order; Refresh explicitly updates it.
Use `/?mock&coffeeDelay=2500` or `/?mock&coffeeError` to inspect loading and retry states.

### Shared colour variables

`src/styles/palette-tokens.css` is the single source of colour defaults. Set
`--ground`, `--panel`, `--ink`, `--temp`, `--bar`, `--weight`, `--flow`, or any of
its other variables to recolour all screens, controls, SVGs and canvas charts.
`paletteTokens.ts` contains editor labels only, with no duplicated colour values.

The palette drawer applies custom properties to `document.documentElement`;
saved presets can override the stylesheet. Direct root-variable changes also
repaint graphs, including CSS colours such as `hsl(180 100% 50%)`. For example:

```js
document.documentElement.style.setProperty('--temp', '#00ffff')
```

The protected Default snapshot remains available regardless of current overrides.
Use `/tests/css-palette-review.html` to verify direct CSS edits with a real graph.

The profile carousel follows fractional drag/scroll positions: cards continuously
scale and fade with their distance from the centre, then settle on release.
Only a small window of cards is rendered; ring wraparound happens outside the
visible area. Tap and hold-release selection and arrow/Enter/Escape controls are
preserved. Reduced-motion mode skips settling animations and flick momentum.
