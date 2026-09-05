# Decaid Zen — plan and open items

Working notes for the skin + `coffee-catalog` plugin. Single tester right now
(Ami, Pixel Tablet), so nothing here is a compatibility promise yet.

## Now

- [ ] Live shot screen: not exercised since the graph rewrite — needs a real pour
      (or a mock path) to confirm frame markers, stop button and the drawer.
- [ ] Journal: notes field only verified against one shot. Check long notes,
      an empty shot list, and that the note survives a Visualizer back-sync.
- [ ] Dial in: same header treatment as Idle (single divider, first-line
      anchored values) — currently still the older per-field underlines.
- [ ] Roaster coverage: only names that resolve to a Shopify or WooCommerce
      feed work. Walk the roasters actually in use and record which resolve,
      which need the manual site field, and which have no feed at all.

## Next

- [ ] Plugin distribution: it is installed with `PUT /api/v1/plugins/:id/source`
      from this repo. If anyone else tests, cut a GitHub release and install via
      `POST /api/v1/plugins/install/github-release` so updates are tracked.
- [ ] Bean picker → beans API: tapping a coffee only writes `coffeeName` into the
      workflow context. Consider creating a real `/api/v1/beans` entry (roaster +
      name) so shot history filters by bean.
- [ ] Catalog quality: titles are cleaned heuristically (`cleanName`). Roast date,
      origin and process are in the feeds too — worth pulling if the picker should
      show more than a name.
- [ ] Search key: `SearchApiKey` (Brave) is optional and unset. Keyless DDG +
      Mojeek work from the tablet; if they start rate-limiting, add a key.

## Someday

- [ ] Wix / custom shops (e.g. Sybaris) publish no product feed. Only routes are
      HTML scraping or an LLM extraction pass — both fragile, neither started.
- [ ] Cross-device catalog cache: `learned` lives in plugin storage on one tablet.
- [ ] Skin settings screen: gateway override, cache TTL, clear learned roasters.

## Known limits

- Mock mode (`?mock=1`) stays in for now — deliberate, single tester. Strip
  `src/lib/mock.ts` and its guards in `useMachine.ts` / `Idle.tsx` before anyone
  else uses this.
- Mock covers Idle only: live shot and Journal still read real data.
- Search engines are blocked from the dev laptop (VPN egress). Discovery must be
  tested on the tablet, which is where the plugin runs.
- Scale live data and machine connection have been down on the tablet — BLE scans
  return 0 devices with the adapter powered on. That is an app/device issue, not
  the skin; see the session notes. `preferredScaleId` is unset, so the scale never
  auto-reconnects.

## How this is wired

- Skin talks only to its own origin; the plugin does all third-party network work
  (skins cannot fetch roaster sites — no CORS).
- Resolution order per roaster: learned cache → domain guesses → keyless web
  search → user-supplied site.
- Catalogs cache 24 h (`CacheHours`), failed lookups 1 h, learned roasters forever.

## Dev loop

```bash
npm run package                     # build + zip
python3 -m http.server 9000         # serve the zip from the repo root
curl -X POST http://<tablet>:8080/api/v1/webui/skins/install/url \
  -H 'content-type: application/json' \
  -d '{"url":"http://<laptop-ip>:9000/decaid-zen-0.1.0.zip"}'

# plugin
python3 -c "import json;print(json.dumps({'manifest':json.load(open('plugin/manifest.json')),'plugin':open('plugin/plugin.js').read()}))" > /tmp/p.json
curl -X PUT http://<tablet>:8080/api/v1/plugins/coffee-catalog.reaplugin/source \
  -H 'content-type: application/json' --data-binary @/tmp/p.json
```

The tablet's IP moves — find it with a sweep for port 8080 rather than assuming
the last one.
