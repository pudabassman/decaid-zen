import { MOCK } from './mock'

const search = typeof window === 'undefined' ? '' : window.location.search

/** ?shot=1 runs a fake pour so the live screen can be worked on without a machine */
export const MOCK_SHOT = MOCK && search.includes('shot')

export const pourAt = (t: number) => {
  const clamped = Math.min(t, 34)
  const pressure =
    clamped < 2
      ? clamped * 1.5
      : clamped < 8
        ? 3 + (clamped - 2) * 0.9
        : clamped < 22
          ? 8.9 - (clamped - 8) * 0.12
          : 7.2 - (clamped - 22) * 0.35
  const flow = clamped < 8 ? 0.6 + clamped * 0.18 : 2.1 - (clamped - 8) * 0.02
  const weight = clamped < 6 ? 0 : Math.min(38.4, (clamped - 6) * 1.62)
  const mix = clamped < 4 ? 88 + clamped * 0.8 : 92.4 - (clamped - 4) * 0.06
  const targetPressure = clamped < 8 ? 9 : 9 - (clamped - 8) * 0.14
  const targetFlow = clamped < 8 ? 4 : 2.2
  return { pressure, flow, weight, mix, targetPressure, targetFlow, targetMix: 92.5 }
}
