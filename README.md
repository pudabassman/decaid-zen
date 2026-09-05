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

curl -X POST http://<tablet-ip>:8080/api/v1/webui/skins/default \
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
