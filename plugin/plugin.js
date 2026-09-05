function createPlugin(host) {
  "use strict";

  const PLUGIN_ID = "coffee-catalog.reaplugin";

  const AGGREGATORS = [
    "facebook.", "instagram.", "wikipedia.", "wanderlog.", "tripadvisor.", "foursquare.",
    "youtube.", "linkedin.", "pinterest.", "waze.", "google.", "maps.", "yelp.",
    "roasted.co.il", "easy.co.il", "atly.com", "corner.inc", "zap.co.il", "mapy.",
    "restaurant", "b144", "dun.co.il", "rest.co.il",
  ];

  const NOT_COFFEE = [
    "מנוי", "subscription", "gift", "מתנה", "ספל", "כוס", "mug", "cup", "tumbler",
    "מכונה", "machine", "grinder", "מטחנ", "פילטר", "filter paper", "נייר",
    "ציוד", "accessor", "אביזר", "tote", "חולצה", "shirt", "kettle", "קומקום",
    "scale", "משקל", "dripper", "french press", "קנקן", "voucher", "שובר",
    "course", "סדנ", "tasting kit", "merch",
  ];

  let cacheHours = 24;
  let searchKey = "";
  const UA =
    "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  const learned = {};
  const misses = {};
  const MISS_TTL = 3600 * 1000;

  function log(message) {
    host.log(`[coffee-catalog] ${message}`);
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function slugCandidates(query) {
    const raw = String(query || "").toLowerCase().trim();
    if (!/[a-z]/.test(raw)) return [];
    const cleaned = raw.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return [];
    const words = cleaned.split(" ").filter((w) => w.length > 1 && !["coffee", "roasters", "roastery", "roasting", "cafe", "the"].includes(w));
    const joined = cleaned.replace(/ /g, "");
    const first = words[0] || joined;
    const hyphen = words.join("-");
    const bases = [];
    [joined, first, `${first}coffee`, `${joined}coffee`, hyphen, `${first}roastery`].forEach((base) => {
      if (base && base.length >= 3 && bases.indexOf(base) < 0) bases.push(base);
    });
    const out = [];
    bases.forEach((base) => {
      [".co.il", ".com", ".coffee"].forEach((tld) => {
        const domain = base + tld;
        if (out.indexOf(domain) < 0) out.push(domain);
      });
    });
    return out.slice(0, 12);
  }

  function hostOf(link) {
    const match = String(link || "").match(/^https?:\/\/([^/?#]+)/i);
    if (!match) return null;
    const host = match[1].replace(/^www\./i, "").toLowerCase();
    if (!host || host.indexOf(".") < 0) return null;
    if (AGGREGATORS.some((bad) => host.indexOf(bad) >= 0)) return null;
    return host;
  }

  function collect(hosts, into) {
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      if (host && into.indexOf(host) < 0) into.push(host);
    }
    return into;
  }

  function decodeUddg(html) {
    const out = [];
    const matches = html.match(/uddg=[^"&]+/g) || [];
    for (let i = 0; i < matches.length && out.length < 12; i++) {
      try {
        out.push(hostOf(decodeURIComponent(matches[i].slice(5))));
      } catch (error) {
        /* a malformed link must not stop the scan */
      }
    }
    return out.filter(Boolean);
  }

  function searchDuckDuckGo(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    return fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } })
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => decodeUddg(html))
      .catch(() => []);
  }

  function searchMojeek(query) {
    const url = `https://www.mojeek.com/search?q=${encodeURIComponent(query)}`;
    return fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } })
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => {
        const out = [];
        const links = html.match(/href="https?:\/\/[^"]+"/g) || [];
        for (let i = 0; i < links.length && out.length < 12; i++) {
          const host = hostOf(links[i].slice(6, -1));
          if (host && host.indexOf("mojeek") < 0) out.push(host);
        }
        return out;
      })
      .catch(() => []);
  }

  function searchBrave(query) {
    if (!searchKey) return Promise.resolve([]);
    const url = `https://api.search.brave.com/res/v1/web/search?count=8&q=${encodeURIComponent(query)}`;
    return fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": searchKey } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const results = (data && data.web && data.web.results) || [];
        return results.map((r) => hostOf(r.url)).filter(Boolean);
      })
      .catch(() => []);
  }

  function searchDomains(query) {
    const phrase = `${query} coffee roastery israel`;
    const engines = [searchDuckDuckGo, searchMojeek, searchBrave];
    const found = [];

    function next(index) {
      if (index >= engines.length || found.length >= 5) return Promise.resolve(found);
      return engines[index](phrase).then((hosts) => {
        collect(hosts, found);
        log(`search engine ${index} returned ${hosts.length} hosts for "${query}"`);
        if (found.length >= 3) return found;
        return next(index + 1);
      });
    }

    return next(0).then((hosts) => hosts.slice(0, 5));
  }

  function probeDomain(domain) {
    const shopify = { name: domain, domain, platform: "shopify" };
    const woo = { name: domain, domain, platform: "woo" };
    return fetchShopify(shopify)
      .then((coffees) => (coffees.length ? { platform: "shopify", coffees } : Promise.reject(new Error("empty"))))
      .catch(() =>
        fetchWoo(woo).then((coffees) =>
          coffees.length ? { platform: "woo", coffees } : Promise.reject(new Error("empty")),
        ),
      );
  }

  function probeSequential(domains, index) {
    if (index >= domains.length) return Promise.resolve(null);
    const domain = domains[index];
    return probeDomain(domain)
      .then((hit) => ({ domain, platform: hit.platform, coffees: hit.coffees }))
      .catch(() => probeSequential(domains, index + 1));
  }

  function discover(query) {
    const guesses = slugCandidates(query);
    return probeSequential(guesses, 0).then((hit) => {
      if (hit) return hit;
      return searchDomains(query).then((domains) => probeSequential(domains, 0));
    });
  }

  function findRoaster(query) {
    const q = normalize(query);
    if (!q) return null;
    if (learned[q]) return learned[q];
    const byDomain = Object.keys(learned).find((k) => normalize(learned[k].domain) === q);
    return byDomain ? learned[byDomain] : null;
  }

  function isCoffee(title, extra) {
    const haystack = normalize(`${title} ${extra || ""}`);
    if (!haystack) return false;
    for (let i = 0; i < NOT_COFFEE.length; i++) {
      if (haystack.indexOf(NOT_COFFEE[i]) >= 0) return false;
    }
    return true;
  }

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&#039;|&apos;/gi, "'")
      .replace(/&amp;/gi, "&");
  }

  function cleanName(title) {
    let name = decodeEntities(title).trim();
    const cut = name.indexOf("|");
    if (cut > 0) name = name.slice(0, cut).trim();
    name = name.replace(/^(חדש|חזר|במלאי|מבצע|new|back|sale)\s*!*\s*/i, "");
    name = name.replace(/^[-–—]\s*/, "");
    name = name.replace(/\s*[-–—]\s*$/, "");
    name = name.replace(/\s{2,}/g, " ").trim();
    return name;
  }

  function dedupe(list) {
    const seen = {};
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const key = normalize(list[i].name);
      if (!key || seen[key]) continue;
      seen[key] = true;
      out.push(list[i]);
    }
    return out;
  }

  function fetchShopify(roaster) {
    const url = `https://${roaster.domain}/products.json?limit=250`;
    return fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const products = (data && data.products) || [];
        const coffees = [];
        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          const tags = (product.tags || []).join(" ");
          if (!isCoffee(product.title, `${product.product_type || ""} ${tags}`)) continue;
          coffees.push({
            name: cleanName(product.title),
            title: product.title,
            url: `https://${roaster.domain}/products/${product.handle}`,
          });
        }
        return dedupe(coffees);
      });
  }

  function fetchWoo(roaster) {
    const url = `https://${roaster.domain}/wp-json/wc/store/products?per_page=100`;
    return fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const products = Array.isArray(data) ? data : [];
        const coffees = [];
        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          const categories = (product.categories || []).map((c) => c.name).join(" ");
          if (!isCoffee(product.name, categories)) continue;
          coffees.push({
            name: cleanName(product.name),
            title: product.name,
            url: product.permalink || `https://${roaster.domain}`,
          });
        }
        return dedupe(coffees);
      });
  }

  const memCache = {};
  const inFlight = {};

  function cacheKey(domain) {
    return `catalog:${domain}`;
  }

  function fresh(entry) {
    if (!entry || !entry.fetchedAt || !entry.coffees) return null;
    if (Date.now() - entry.fetchedAt > cacheHours * 3600 * 1000) return null;
    return entry;
  }

  function rememberRoaster(query, roaster) {
    const key = normalize(query);
    if (!key) return;
    learned[key] = roaster;
    const flat = {};
    Object.keys(learned).forEach((k) => {
      flat[k] = { name: learned[k].name, he: learned[k].he || "", city: learned[k].city || "", domain: learned[k].domain, platform: learned[k].platform };
    });
    host.storage({ type: "write", key: "learned", namespace: PLUGIN_ID, data: JSON.stringify(flat) });
  }

  function acceptLearned(value) {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!parsed) return;
      Object.keys(parsed).forEach((k) => {
        learned[k] = parsed[k];
      });
      Object.keys(learned).forEach((k) => {
        host.storage({ type: "read", key: cacheKey(learned[k].domain), namespace: PLUGIN_ID });
      });
      log(`restored ${Object.keys(learned).length} learned roasters`);
    } catch (error) {
      log(`bad learned store: ${error.message}`);
    }
  }

  function acceptStorageRead(payload) {
    if (!payload || !payload.key || payload.value == null) return;
    if (payload.key === "learned") {
      acceptLearned(payload.value);
      return;
    }
    if (String(payload.key).indexOf("catalog:") !== 0) return;
    const domain = String(payload.key).slice("catalog:".length);
    try {
      const parsed = typeof payload.value === "string" ? JSON.parse(payload.value) : payload.value;
      const entry = fresh(parsed);
      if (entry) memCache[domain] = entry;
    } catch (error) {
      log(`bad cache entry for ${domain}: ${error.message}`);
    }
  }

  function writeCache(domain, coffees) {
    const entry = { fetchedAt: Date.now(), coffees };
    memCache[domain] = entry;
    host.storage({
      type: "write",
      key: cacheKey(domain),
      namespace: PLUGIN_ID,
      data: JSON.stringify(entry),
    });
    return entry;
  }

  function catalogFor(roaster, refresh) {
    const domain = roaster.domain;
    if (!refresh) {
      const cached = fresh(memCache[domain]);
      if (cached) {
        return Promise.resolve({ coffees: cached.coffees, fetchedAt: cached.fetchedAt, cached: true });
      }
      if (inFlight[domain]) return inFlight[domain];
    }

    const fetcher = roaster.platform === "shopify" ? fetchShopify : fetchWoo;
    const request = fetcher(roaster)
      .then((coffees) => {
        const entry = writeCache(domain, coffees);
        delete inFlight[domain];
        return { coffees, fetchedAt: entry.fetchedAt, cached: false };
      })
      .catch((error) => {
        delete inFlight[domain];
        throw error;
      });

    inFlight[domain] = request;
    return request;
  }

  function json(requestId, status, body) {
    return {
      requestId,
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(body),
    };
  }

  return {
    id: PLUGIN_ID,
    version: "1.3.0",

    onLoad(settings) {
      const configured = settings && Number(settings.CacheHours);
      if (Number.isFinite(configured) && configured > 0) cacheHours = configured;
      searchKey = (settings && settings.SearchApiKey) || "";
      host.storage({ type: "read", key: "learned", namespace: PLUGIN_ID });
      log(`loaded, cache ${cacheHours}h, search key ${searchKey ? "set" : "unset"}`);
    },

    onUnload() {},

    onEvent(event) {
      if (event && event.name === "storageRead") acceptStorageRead(event.payload);
    },

    __httpRequestHandler(request) {
      const query = request.query || {};

      if (request.endpoint === "roasters") {
        const list = Object.keys(learned).map((key) => ({
          name: learned[key].name,
          domain: learned[key].domain,
          platform: learned[key].platform,
        }));
        return json(request.requestId, 200, { roasters: list });
      }

      if (request.endpoint === "resolve") {
        const site = String(query.site || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "");
        const label = String(query.roaster || site).trim();
        if (!site || !label) {
          return json(request.requestId, 400, { error: "roaster and site are required" });
        }
        return probeDomain(site)
          .then((hit) => {
            const roaster = { name: label, he: "", city: "", domain: site, platform: hit.platform };
            rememberRoaster(label, roaster);
            writeCache(site, hit.coffees);
            return json(request.requestId, 200, {
              available: true,
              roaster: label,
              domain: site,
              platform: hit.platform,
              count: hit.coffees.length,
            });
          })
          .catch(() =>
            json(request.requestId, 200, {
              available: false,
              roaster: label,
              domain: site,
              error: "no product feed found on that site",
            }),
          );
      }

      if (request.endpoint === "coffees") {
        const asked = String(query.roaster || "").trim();
        const roaster = findRoaster(asked);
        if (!roaster) {
          if (query.probe === "1" && query.discover !== "1") {
            return json(request.requestId, 200, { available: false, roaster: asked || null, searched: false });
          }
          const missedAt = misses[normalize(asked)];
          if (missedAt && Date.now() - missedAt < MISS_TTL) {
            return json(request.requestId, 200, { available: false, roaster: asked, searched: true, cached: true });
          }
          return discover(asked)
            .then((hit) => {
              if (!hit) {
                misses[normalize(asked)] = Date.now();
                return json(request.requestId, 200, { available: false, roaster: asked, searched: true });
              }
              const found = { name: asked, he: "", city: "", domain: hit.domain, platform: hit.platform };
              rememberRoaster(asked, found);
              const entry = writeCache(hit.domain, hit.coffees);
              const payload = {
                available: hit.coffees.length > 0,
                roaster: asked,
                domain: hit.domain,
                count: hit.coffees.length,
                cached: false,
                discovered: true,
                fetchedAt: entry.fetchedAt,
              };
              if (query.probe !== "1") payload.coffees = hit.coffees;
              return json(request.requestId, 200, payload);
            })
            .catch((error) =>
              json(request.requestId, 200, { available: false, roaster: asked, error: error.message }),
            );
        }

        return catalogFor(roaster, query.refresh === "1")
          .then((result) => {
            const payload = {
              available: result.coffees.length > 0,
              roaster: roaster.name,
              he: roaster.he,
              domain: roaster.domain,
              count: result.coffees.length,
              cached: result.cached,
              fetchedAt: result.fetchedAt,
            };
            if (query.probe !== "1") payload.coffees = result.coffees;
            return json(request.requestId, 200, payload);
          })
          .catch((error) => {
            log(`catalog failed for ${roaster.domain}: ${error.message}`);
            return json(request.requestId, 502, {
              available: false,
              roaster: roaster.name,
              error: error.message,
            });
          });
      }

      return json(request.requestId, 404, { error: `unknown endpoint ${request.endpoint}` });
    },
  };
}
