import { Choice, NumberValue, Row, Section, Toggle } from '../../components/SettingControls'
import type { CupWarmer, CupWarmerPreheat, ShotSettings } from '../../api/settings'

export function ShotSettingsSection({
  settings,
  patch,
}: {
  settings: ShotSettings | null
  patch: (next: Partial<ShotSettings>) => void
}) {
  return (
    <Section title="Steam and water">
      {settings ? (
        <>
          <Row label="Steam" hint="off keeps the boiler cold">
            <Toggle on={settings.steamSetting > 0} onChange={(on) => patch({ steamSetting: on ? 1 : 0 })} />
          </Row>
          <Row label="Steam temperature">
            <NumberValue value={settings.targetSteamTemp} unit="°" digits={0} step={1}
              onCommit={(v) => patch({ targetSteamTemp: Math.round(v) })} />
          </Row>
          <Row label="Steam stops after" hint="the machine ends the steam itself">
            <NumberValue value={settings.targetSteamDuration} unit="s" digits={0} step={5}
              onCommit={(v) => patch({ targetSteamDuration: Math.max(0, Math.round(v)) })} />
          </Row>
          <Row label="Hot water temperature">
            <NumberValue value={settings.targetHotWaterTemp} unit="°" digits={0} step={1}
              onCommit={(v) => patch({ targetHotWaterTemp: Math.round(v) })} />
          </Row>
          <Row label="Hot water volume">
            <NumberValue value={settings.targetHotWaterVolume} unit="ml" digits={0} step={10}
              onCommit={(v) => patch({ targetHotWaterVolume: Math.max(0, Math.round(v)) })} />
          </Row>
          <Row label="Hot water stops after">
            <NumberValue value={settings.targetHotWaterDuration} unit="s" digits={0} step={5}
              onCommit={(v) => patch({ targetHotWaterDuration: Math.max(0, Math.round(v)) })} />
          </Row>
          <Row label="Espresso volume limit" hint="0 leaves the profile in charge">
            <NumberValue value={settings.targetShotVolume} unit="ml" digits={0} step={5}
              onCommit={(v) => patch({ targetShotVolume: Math.max(0, Math.round(v)) })} />
          </Row>
          <Row label="Group temperature" hint="the machine's own target, not the profile's">
            <NumberValue value={settings.groupTemp} unit="°" step={0.5}
              onCommit={(v) => patch({ groupTemp: v })} />
          </Row>
        </>
      ) : (
        <Row label="Steam and water" hint="no machine connected">{null}</Row>
      )}
    </Section>
  )
}

export function CupWarmerSection({
  warmer,
  preheat,
  patchWarmer,
  patchPreheat,
}: {
  warmer: CupWarmer | null
  preheat: CupWarmerPreheat | null
  patchWarmer: (next: Partial<CupWarmer>) => void
  patchPreheat: (next: Partial<CupWarmerPreheat>) => void
}) {
  if (!warmer) return null

  return (
    <Section title="Cup warmer">
      <Row
        label="Mat"
        hint={warmer.currentTemperature === null ? 'no reading' : `now ${warmer.currentTemperature.toFixed(0)}°`}
      >
        <Toggle on={warmer.enabled} onChange={(on) => patchWarmer({ enabled: on })} />
      </Row>
      <Row label="Mat temperature" hint="0 turns it off">
        <Choice
          value={warmer.temperature}
          options={[
            { value: 0, label: 'Off' },
            { value: 40, label: '40°' },
            { value: 50, label: '50°' },
            { value: 60, label: '60°' },
          ]}
          onChange={(v) => patchWarmer({ temperature: v })}
        />
      </Row>
      {preheat && (
        <>
          <Row label="Warm before a scheduled wake" hint={preheat.active ? 'running now' : undefined}>
            <Toggle on={preheat.enabled} onChange={(on) => patchPreheat({ enabled: on })} />
          </Row>
          <Row label="Head start">
            <NumberValue value={preheat.leadMinutes} unit="min" digits={0} step={5}
              onCommit={(v) => patchPreheat({ leadMinutes: Math.max(0, Math.min(120, Math.round(v))) })} />
          </Row>
        </>
      )}
    </Section>
  )
}
