import { MOCK, mockGrinds, mockProfiles, mockShot, mockWater, mockWorkflow } from './mock'
import type { ShotRecord, Workflow } from '../api/types'

const BEANS: Array<[string, string, string]> = [
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso'],
  ['Cafelix', 'Ethiopia Guji Natural', 'D-Flow'],
  ['Nomena', 'Colombia El Porvenir', 'Blooming Espresso'],
  ['Tsukcafe', 'Rwanda Nyakibanda Red Bourbon', "Damian's LRv2"],
  ['Peony', 'Dominican Republic Barahona Washed', 'Classic Italian'],
  ['Unico', 'Brazil Alta Catucai', 'A-Flow light'],
]

const COFFEES = [
  'Colombia Finca La Rosi Ombligón Mango Infused',
  'Kenya Kirinyaga Kabingara Washed',
  'Dominican Republic Barahona Washed',
  'Colombia Los Yarumos Chiroso Washed',
  'Kenya Nyeri Ichamara Washed',
  'Ethiopia Guji Hambela Wamena Benti Nenka Natural',
  'Rwanda Gitwe Red Bourbon Natural',
  'Panama Hartmann Geisha Washed',
]

const state = {
  workflow: mockWorkflow(),
  grinds: mockGrinds(),
  water: mockWater(),
  waterUse: { shot: [2.1, 2.4, 2.2], steam: [1.3, 1.5, 1.4], maxLevel: 45, mlPerMm: [33.4, 32.1, 34.0] },
  grinders: [
    { id: 'grinder:niche', model: 'Niche Zero' },
    { id: 'grinder:df64', model: 'DF64' },
    { id: 'grinder:ek43', model: 'Mahlkönig EK43' },
  ],
  notes: {} as Record<string, string>,
  app: {
    gatewayMode: 'tracking',
    themeMode: 'dark',
    logLevel: 'INFO',
    weightFlowMultiplier: 1,
    volumeFlowMultiplier: 0.3,
    hotWaterFlowMultiplier: 0.3,
    scalePowerMode: 'disconnect',
    blockOnNoScale: false,
    blockTareDuringShot: false,
    stopHotWaterAtWeight: true,
    preferredMachineId: 'FA:78:82:BA:6B:06',
    preferredScaleId: 'EC:8B:BE:C7:55:6C',
    defaultSkinId: 'decaid-zen',
    automaticUpdateCheck: true,
    chargingMode: 'longevity',
    nightModeEnabled: true,
    nightModeSleepTime: 1320,
    nightModeMorningTime: 360,
    lowBatteryBrightnessLimit: true,
    keepAwake: true,
  } as Record<string, unknown>,
  machineSettings: {
    fan: 50, usb: false, flushTemp: 90, flushTimeout: 10, flushFlow: 6,
    hotWaterFlow: 8, steamFlow: 0.8, tankTemp: 0, steamPurgeMode: 1,
  } as Record<string, unknown>,
  advanced: {
    heaterPh1Flow: 2, heaterPh2Flow: 0.5, heaterIdleTemp: 85,
    heaterPh2Timeout: 2, heaterVoltage: 230, refillKitSetting: 2,
  } as Record<string, unknown>,
  display: { brightness: 100, wakeLockEnabled: true, lowBatteryBrightnessActive: false } as Record<string, unknown>,
  presence: { userPresenceEnabled: true, sleepTimeoutMinutes: 15 } as Record<string, unknown>,
  cupWarmer: { temperature: 60, enabled: true, currentTemperature: 48 } as Record<string, unknown>,
  preheat: { enabled: true, leadMinutes: 20, active: false } as Record<string, unknown>,
  led: {
    frontStrip: { sleeping: '000000000000', awake: 'FFFF80004000' },
    backStrip: { sleeping: '000020004000', awake: '4000FFFFC000' },
  },
  calibration: { flowMultiplier: 1.02 } as Record<string, unknown>,
  schedules: [
    { id: 'wake-1', enabled: true, time: '06:20', days: [1, 2, 3, 4, 5] },
    { id: 'wake-2', enabled: false, time: '08:10', days: [6, 7] },
  ],
  devices: [
    { id: 'FA:78:82:BA:6B:06', name: 'DE1', type: 'machine', state: 'connected', available: true },
    { id: 'EC:8B:BE:C7:55:6C', name: 'Acaia Lunar', type: 'scale', state: 'disconnected', available: false },
    { id: 'D1:22:0A:44:91:7C', name: 'Bookoo Themis', type: 'scale', state: 'connected', available: true },
  ],
  skins: [
    { id: 'decaid-zen', name: 'Decaid Zen', version: '0.2.30' },
    { id: 'streamline.js', name: 'Streamline', version: '0.1.106' },
    { id: 'insight', name: 'Insight', version: '0.2.7' },
  ],
  defaultSkin: 'decaid-zen',
  plugins: [
    { id: 'coffee-catalog.reaplugin', name: 'Coffee catalog', version: '1.2.0', enabled: true, loaded: true },
    { id: 'dye2.reaplugin', name: 'DYE2 strip', version: '0.4.1', enabled: false, loaded: false },
  ],
}

const RECENT: Array<[string, string, string, number]> = [
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 29.4],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 28.1],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 30.2],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 27.6],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 28.8],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 26.4],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 28.2],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 29.0],
  ['Peony', 'Kenya Kirinyaga Kabingara Washed', 'Blooming Espresso', 27.9],
]

const shots = (): ShotRecord[] =>
  [...RECENT, ...BEANS.map((bean) => [...bean, 30] as [string, string, string, number])].map(([roaster, bean, profile, span], i) => {
    const base = mockShot(span)
    const workflow: Workflow = {
      ...base.workflow,
      profile: { ...base.workflow?.profile, title: profile },
      context: { ...base.workflow?.context, coffeeRoaster: roaster, coffeeName: bean },
    }
    return {
      ...base,
      id: `shot-${i + 1}`,
      timestamp: new Date(Date.now() - (i * 5 + 1) * 3600 * 1000).toISOString(),
      workflow,
      annotations: {
        ...base.annotations,
        actualYield: 36 + i * 0.7,
        espressoNotes: state.notes[`shot-${i + 1}`] ?? (i === 0 ? 'Balanced, florality on the finish.' : ''),
      },
    }
  })

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

function route(path: string, method: string, body: unknown): Response | null {
  const [pathname, query] = path.split('?')
  const params = new URLSearchParams(query ?? '')

  if (pathname.endsWith('/workflow')) {
    if (method === 'PUT') {
      state.workflow = body as Workflow
      return ok(state.workflow)
    }
    return ok(state.workflow)
  }

  if (pathname.endsWith('/machine/waterLevels')) return ok(state.water)

  const merge = (into: Record<string, unknown>) => {
    Object.assign(into, body as Record<string, unknown>)
    return ok(into)
  }
  if (pathname.endsWith('/machine/settings/advanced')) {
    return method === 'POST' ? merge(state.advanced) : ok(state.advanced)
  }
  if (pathname.endsWith('/machine/settings')) {
    return method === 'POST' ? merge(state.machineSettings) : ok(state.machineSettings)
  }
  if (pathname.endsWith('/presence/settings')) {
    return method === 'POST' ? merge(state.presence) : ok(state.presence)
  }
  if (pathname.endsWith('/settings')) {
    return method === 'POST' ? merge(state.app) : ok(state.app)
  }
  if (pathname.endsWith('/display/brightness')) {
    state.display.brightness = (body as { brightness: number }).brightness
    return ok({})
  }
  if (pathname.endsWith('/display')) return ok(state.display)
  if (pathname.endsWith('/grinders') && method === 'GET') return ok(state.grinders)
  if (pathname.endsWith('/grinders') && method === 'POST') {
    const model = (body as { model: string }).model
    const created = { id: `grinder:${model.toLowerCase().replace(/\s+/g, '-')}`, model }
    state.grinders = [...state.grinders, created]
    return ok(created)
  }

  if (pathname.endsWith('/profiles')) return ok(mockProfiles())

  if (pathname.includes('/store/decaid-zen/')) {
    const key = pathname.split('/').pop()
    if (method === 'POST') {
      if (key === 'grindByProfile') state.grinds = body as Record<string, string>
      if (key === 'waterUse') state.waterUse = body as typeof state.waterUse
      return ok({})
    }
    if (key === 'grindByProfile') return ok(state.grinds)
    if (key === 'waterUse') return ok(state.waterUse)
    return ok(null)
  }

  if (pathname.endsWith('/shots/latest')) return ok(shots()[0])
  if (pathname.endsWith('/shots')) {
    const coffeeName = params.get('coffeeName')
    const profileTitle = params.get('profileTitle')
    const limit = Number(params.get('limit') ?? 20)
    const matching = shots().filter(
      (shot) =>
        (!coffeeName || shot.workflow?.context?.coffeeName === coffeeName) &&
        (!profileTitle || shot.workflow?.profile?.title === profileTitle),
    )
    const items = matching.slice(0, limit)
    return ok({ items, total: matching.length, limit, offset: 0 })
  }
  if (pathname.includes('/shots/')) {
    const id = decodeURIComponent(pathname.split('/').pop() ?? '')
    if (method === 'PUT') {
      const notes = (body as { annotations?: { espressoNotes?: string } })?.annotations?.espressoNotes
      if (notes !== undefined) state.notes[id] = notes
      return ok(shots().find((s) => s.id === id) ?? shots()[0])
    }
    return ok(shots().find((s) => s.id === id) ?? shots()[0])
  }

  if (pathname.includes('coffee-catalog.reaplugin/coffees')) {
    const roaster = params.get('roaster') ?? ''
    const known = ['peony', 'cafelix', 'nomena', 'tsukcafe', 'unico'].some((r) =>
      roaster.toLowerCase().includes(r),
    )
    if (!known) return ok({ available: false, roaster, searched: true })
    const coffees = COFFEES.map((name) => ({ name, title: name, url: `https://example.test/${name}` }))
    const payload: Record<string, unknown> = {
      available: true,
      roaster,
      domain: `${roaster.toLowerCase()}.co.il`,
      count: coffees.length,
      cached: true,
      fetchedAt: Date.now() - 12 * 60 * 1000,
    }
    if (params.get('probe') !== '1') payload.coffees = coffees
    return ok(payload)
  }
  if (pathname.includes('coffee-catalog.reaplugin/resolve')) {
    return ok({ available: true, roaster: params.get('roaster'), domain: params.get('site'), count: 8 })
  }

  if (pathname.endsWith('/machine/cupWarmer/preheat')) {
    if (method === 'PUT') return merge(state.preheat)
    return ok(state.preheat)
  }
  if (pathname.endsWith('/machine/cupWarmer')) {
    if (method === 'PUT') return merge(state.cupWarmer)
    return ok(state.cupWarmer)
  }
  if (pathname.endsWith('/machine/ledStrip')) {
    if (method === 'PUT') {
      state.led = body as typeof state.led
      return ok({})
    }
    return ok(state.led)
  }
  if (pathname.endsWith('/machine/calibration')) {
    if (method === 'POST') return merge(state.calibration)
    return ok(state.calibration)
  }
  if (pathname.endsWith('/machine/shotSettings')) return ok({})
  if (pathname.endsWith('/machine/settings/reset')) return ok({})
  if (pathname.endsWith('/presence/schedules')) return ok(state.schedules)
  if (pathname.includes('/presence/schedules/')) return ok({})
  if (pathname.endsWith('/devices')) return ok(state.devices)
  if (pathname.endsWith('/devices/forget')) return ok({})
  if (pathname.endsWith('/webui/skins/default')) {
    if (method === 'POST') {
      state.defaultSkin = (body as { skinId: string }).skinId
      return ok({})
    }
    return ok(state.skins.find((skin) => skin.id === state.defaultSkin))
  }
  if (pathname.endsWith('/webui/skins/update')) return ok({ updated: [] })
  if (pathname.endsWith('/webui/skins')) return ok(state.skins)
  if (pathname.endsWith('/plugins/update')) return ok({ checked: state.plugins.length })
  if (pathname.includes('/plugins/') && (pathname.endsWith('/enable') || pathname.endsWith('/disable'))) return ok({})
  if (pathname.endsWith('/plugins')) return ok(state.plugins)
  if (pathname.endsWith('/info')) return ok({ version: '0.8.5', buildNumber: '2624', commitShort: 'a08bc41e', localIp: '192.168.68.72' })
  if (pathname.endsWith('/machine/info')) return ok({ model: 'DE1 Pro', version: '1.6', GHC: true })
  if (pathname.endsWith('/update')) return ok({ phase: 'idle', currentVersion: '0.8.5', latestVersion: null, installable: false })

  if (pathname.endsWith('/machine/state')) return ok({ state: { state: 'idle', substate: 'ready' } })

  return null
}

export function installMockServer() {
  if (!MOCK) return
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.includes('/api/v1/')) return real(input as RequestInfo, init)
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown = null
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string)
      } catch {
        body = init.body
      }
    }
    const path = url.split('/api/v1')[1] ?? ''
    const response = route(path, method, body)
    await new Promise((resolve) => setTimeout(resolve, 140))
    return response ?? ok({})
  }
}
