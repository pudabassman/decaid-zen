declare const __GATEWAY__: string

const REA_PORT = 8080

const override = typeof __GATEWAY__ === 'string' && __GATEWAY__ !== '' ? __GATEWAY__ : undefined
const stored = globalThis.localStorage?.getItem('reaGateway') ?? undefined

const derived = () => {
  const wsSecure = window.location.protocol === 'https:'
  return `${wsSecure ? 'https' : 'http'}://${window.location.hostname}:${REA_PORT}`
}

export const httpBase = (override ?? stored ?? derived()).replace(/\/$/, '')
export const wsBase = httpBase.replace(/^http/, 'ws')

export const api = (path: string) => `${httpBase}/api/v1${path}`
export const ws = (channel: string) => `${wsBase}/ws/v1${channel}`
