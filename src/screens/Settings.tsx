import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Choice, MultiSelect, NumberValue, Row, Section, Toggle } from '../components/SettingControls'
import { EditableValue } from '../components/EditableValue'
import { useSwipe } from '../lib/useSwipe'
import { MAX_DECK, profiles as profileApi, type ProfileRecord } from '../api/profiles'
import { useAction } from '../lib/useAction'
import {
  asClock,
  fromClock,
  settingsApi,
  type AdvancedSettings,
  type AppSettings,
  type DisplayState,
  type MachineSettings,
  type PresenceSettings,
} from '../api/settings'

export function Settings({ onDone }: { onDone: () => void }) {
  const [app, setApp] = useState<AppSettings | null>(null)
  const [machine, setMachine] = useState<MachineSettings | null>(null)
  const [advanced, setAdvanced] = useState<AdvancedSettings | null>(null)
  const [display, setDisplay] = useState<DisplayState | null>(null)
  const [presence, setPresence] = useState<PresenceSettings | null>(null)
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [preferred, setPreferred] = useState<string[]>([])
  const screen = useRef<HTMLDivElement>(null)
  const { run, message } = useAction()

  useSwipe(screen, { onLeft: (fromRightEdge) => fromRightEdge && onDone() })

  useEffect(() => {
    settingsApi.app().then(setApp).catch(() => setApp(null))
    settingsApi.machine().then(setMachine).catch(() => setMachine(null))
    settingsApi.advanced().then(setAdvanced).catch(() => setAdvanced(null))
    settingsApi.display().then(setDisplay).catch(() => setDisplay(null))
    settingsApi.presence().then(setPresence).catch(() => setPresence(null))
    profileApi.list().then(setRecords).catch(() => setRecords([]))
    profileApi.preferred().then((ids) => setPreferred(ids ?? [])).catch(() => undefined)
  }, [])

  const togglePreferred = (id: string) => {
    const next = preferred.includes(id)
      ? preferred.filter((other) => other !== id)
      : [...preferred, id].slice(0, MAX_DECK)
    setPreferred(next)
    run('Save deck profiles', () => profileApi.savePreferred(next))
  }

  const patchApp = (patch: Partial<AppSettings>) => {
    setApp((prev) => (prev ? { ...prev, ...patch } : prev))
    run('Save setting', () => settingsApi.saveApp(patch))
  }

  const patchMachine = (patch: Partial<MachineSettings>) => {
    setMachine((prev) => (prev ? { ...prev, ...patch } : prev))
    run('Save machine setting', () => settingsApi.saveMachine(patch))
  }

  const patchAdvanced = (patch: Partial<AdvancedSettings>) => {
    setAdvanced((prev) => (prev ? { ...prev, ...patch } : prev))
    run('Save advanced setting', () => settingsApi.saveAdvanced(patch))
  }

  const patchPresence = (patch: Partial<PresenceSettings>) => {
    setPresence((prev) => (prev ? { ...prev, ...patch } : prev))
    run('Save presence setting', () => settingsApi.savePresence(patch))
  }

  return (
    <div className="screen" ref={screen}>
      <div className="row between" style={{ marginBottom: 26 }}>
        <span className="display" style={{ fontSize: 42, letterSpacing: '-0.01em' }}>Settings</span>
        <span className="cap" style={{ color: message ? 'var(--temp)' : undefined }}>
          {message ?? 'changes save as you make them'}
        </span>
      </div>

      <div className="grow settingsbody">
        <div className="settingscol">
          <Section title="Machine">
            {machine ? (
              <>
                <Row label="Flush temperature" hint="water used to rinse the group">
                  <NumberValue value={machine.flushTemp} unit="°" step={0.5}
                    onCommit={(v) => patchMachine({ flushTemp: v })} />
                </Row>
                <Row label="Flush flow">
                  <NumberValue value={machine.flushFlow} unit="ml/s" step={0.2}
                    onCommit={(v) => patchMachine({ flushFlow: v })} />
                </Row>
                <Row label="Flush timeout">
                  <NumberValue value={machine.flushTimeout} unit="s" step={1}
                    onCommit={(v) => patchMachine({ flushTimeout: v })} />
                </Row>
                <Row label="Hot water flow">
                  <NumberValue value={machine.hotWaterFlow} unit="ml/s" step={0.2}
                    onCommit={(v) => patchMachine({ hotWaterFlow: v })} />
                </Row>
                <Row label="Steam flow">
                  <NumberValue value={machine.steamFlow} unit="ml/s" digits={2} step={0.05}
                    onCommit={(v) => patchMachine({ steamFlow: v })} />
                </Row>
                <Row label="Steam purge" hint="how the wand clears after steaming">
                  <Choice
                    value={machine.steamPurgeMode}
                    options={[
                      { value: 0, label: 'Off' },
                      { value: 1, label: 'Auto' },
                      { value: 2, label: 'Full' },
                    ]}
                    onChange={(v) => patchMachine({ steamPurgeMode: v })}
                  />
                </Row>
                <Row label="Tank temperature" hint="0 leaves the tank unheated">
                  <NumberValue value={machine.tankTemp} unit="°" digits={0} step={1}
                    onCommit={(v) => patchMachine({ tankTemp: v })} />
                </Row>
                <Row label="Fan threshold">
                  <NumberValue value={machine.fan} unit="°" digits={0} step={1}
                    onCommit={(v) => patchMachine({ fan: v })} />
                </Row>
                <Row label="USB port">
                  <Toggle on={machine.usb} onChange={(v) => patchMachine({ usb: v })} />
                </Row>
              </>
            ) : (
              <Row label="Machine settings" hint="no machine connected">{null}</Row>
            )}
          </Section>

          <Section title="Heating">
            {advanced ? (
              <>
                <Row label="Idle temperature">
                  <NumberValue value={advanced.heaterIdleTemp} unit="°" step={0.5}
                    onCommit={(v) => patchAdvanced({ heaterIdleTemp: v })} />
                </Row>
                <Row label="Phase 1 flow">
                  <NumberValue value={advanced.heaterPh1Flow} unit="ml/s" step={0.1}
                    onCommit={(v) => patchAdvanced({ heaterPh1Flow: v })} />
                </Row>
                <Row label="Phase 2 flow">
                  <NumberValue value={advanced.heaterPh2Flow} unit="ml/s" step={0.1}
                    onCommit={(v) => patchAdvanced({ heaterPh2Flow: v })} />
                </Row>
                <Row label="Phase 2 timeout">
                  <NumberValue value={advanced.heaterPh2Timeout} unit="s" step={0.5}
                    onCommit={(v) => patchAdvanced({ heaterPh2Timeout: v })} />
                </Row>
                <Row label="Mains voltage" hint="set for your machine; not changed from here">
                  <span className="num" style={{ fontSize: 24, color: 'var(--muted)' }}>
                    {advanced.heaterVoltage} V
                  </span>
                </Row>
                <Row label="Refill kit">
                  <Choice
                    value={advanced.refillKitSetting}
                    options={[
                      { value: 0, label: 'Off' },
                      { value: 1, label: 'On' },
                      { value: 2, label: 'Auto' },
                    ]}
                    onChange={(v) => patchAdvanced({ refillKitSetting: v })}
                  />
                </Row>
              </>
            ) : (
              <Row label="Heating" hint="no machine connected">{null}</Row>
            )}
          </Section>
        </div>

        <div className="settingscol">
          <Section title="Scale and safety">
            {app && (
              <>
                <Row label="Block espresso without a scale">
                  <Toggle on={app.blockOnNoScale} onChange={(v) => patchApp({ blockOnNoScale: v })} />
                </Row>
                <Row label="Block tare mid shot">
                  <Toggle on={app.blockTareDuringShot} onChange={(v) => patchApp({ blockTareDuringShot: v })} />
                </Row>
                <Row label="Stop hot water at weight">
                  <Toggle on={app.stopHotWaterAtWeight} onChange={(v) => patchApp({ stopHotWaterAtWeight: v })} />
                </Row>
                <Row label="Scale power" hint="what happens to the scale when idle">
                  <Choice
                    value={app.scalePowerMode}
                    options={[
                      { value: 'disabled', label: 'Leave on' },
                      { value: 'displayOff', label: 'Display off' },
                      { value: 'disconnect', label: 'Disconnect' },
                    ]}
                    onChange={(v) => patchApp({ scalePowerMode: v })}
                  />
                </Row>
                <Row label="Weight flow lookahead">
                  <NumberValue value={app.weightFlowMultiplier} digits={2} step={0.05}
                    onCommit={(v) => patchApp({ weightFlowMultiplier: v })} />
                </Row>
                <Row label="Volume flow lookahead">
                  <NumberValue value={app.volumeFlowMultiplier} digits={2} step={0.05}
                    onCommit={(v) => patchApp({ volumeFlowMultiplier: v })} />
                </Row>
                <Row label="Hot water lookahead">
                  <NumberValue value={app.hotWaterFlowMultiplier} digits={2} step={0.05}
                    onCommit={(v) => patchApp({ hotWaterFlowMultiplier: v })} />
                </Row>
              </>
            )}
          </Section>

          <Section title="Screen and sleep">
            {display && (
              <Row label="Brightness">
                <NumberValue value={display.brightness} unit="%" digits={0} step={5}
                  onCommit={(v) => {
                    const next = Math.max(1, Math.min(100, Math.round(v)))
                    setDisplay((prev) => (prev ? { ...prev, brightness: next } : prev))
                    run('Set brightness', () => settingsApi.setBrightness(next))
                  }} />
              </Row>
            )}
            {app && (
              <>
                <Row label="Keep the screen awake">
                  <Toggle on={app.keepAwake} onChange={(v) => patchApp({ keepAwake: v })} />
                </Row>
                <Row label="Dim on low battery">
                  <Toggle on={app.lowBatteryBrightnessLimit}
                    onChange={(v) => patchApp({ lowBatteryBrightnessLimit: v })} />
                </Row>
                <Row label="Night mode">
                  <Toggle on={app.nightModeEnabled} onChange={(v) => patchApp({ nightModeEnabled: v })} />
                </Row>
                <Row label="Sleeps at">
                  <EditableValue className="num" style={{ fontSize: 24 }} width={80}
                    value={asClock(app.nightModeSleepTime)}
                    onCommit={(v) => patchApp({ nightModeSleepTime: fromClock(v, app.nightModeSleepTime) })} />
                </Row>
                <Row label="Wakes at">
                  <EditableValue className="num" style={{ fontSize: 24 }} width={80}
                    value={asClock(app.nightModeMorningTime)}
                    onCommit={(v) => patchApp({ nightModeMorningTime: fromClock(v, app.nightModeMorningTime) })} />
                </Row>
              </>
            )}
            {presence && (
              <>
                <Row label="Sleep when nobody is there">
                  <Toggle on={presence.userPresenceEnabled}
                    onChange={(v) => patchPresence({ userPresenceEnabled: v })} />
                </Row>
                <Row label="Idle before sleeping">
                  <NumberValue value={presence.sleepTimeoutMinutes} unit="min" digits={0} step={5}
                    onCommit={(v) => patchPresence({ sleepTimeoutMinutes: Math.max(1, Math.round(v)) })} />
                </Row>
              </>
            )}
          </Section>

          <Section title="Skin">
            <Row label="Profiles on the deck" hint={`up to ${MAX_DECK}; the badge turns through them`}>
              <MultiSelect
                options={records.map((record) => ({
                  value: record.id,
                  label: record.profile?.title ?? 'Untitled',
                }))}
                chosen={preferred}
                max={MAX_DECK}
                empty={`first ${MAX_DECK}`}
                onToggle={togglePreferred}
              />
            </Row>
          </Section>

          <Section title="App">
            {app && (
              <>
                <Row label="Gateway mode" hint="full hands the machine to the skin">
                  <Choice
                    value={app.gatewayMode}
                    options={[
                      { value: 'disabled', label: 'Off' },
                      { value: 'tracking', label: 'Tracking' },
                      { value: 'full', label: 'Full' },
                    ]}
                    onChange={(v) => patchApp({ gatewayMode: v })}
                  />
                </Row>
                <Row label="Charging">
                  <Choice
                    value={app.chargingMode}
                    options={[
                      { value: 'longevity', label: 'Longevity' },
                      { value: 'balanced', label: 'Balanced' },
                      { value: 'highAvailability', label: 'Always' },
                    ]}
                    onChange={(v) => patchApp({ chargingMode: v })}
                  />
                </Row>
                <Row label="Check for updates">
                  <Toggle on={app.automaticUpdateCheck}
                    onChange={(v) => patchApp({ automaticUpdateCheck: v })} />
                </Row>
                <Row label="Log level">
                  <Choice
                    value={app.logLevel}
                    options={[
                      { value: 'INFO', label: 'Info' },
                      { value: 'FINE', label: 'Fine' },
                      { value: 'WARNING', label: 'Warning' },
                    ]}
                    onChange={(v) => patchApp({ logLevel: v })}
                  />
                </Row>
                <Row label="Machine" hint={app.preferredMachineId ?? 'none paired'}>{null}</Row>
                <Row label="Scale" hint={app.preferredScaleId ?? 'none paired'}>{null}</Row>
              </>
            )}
          </Section>
        </div>
      </div>

      <div className="row between" style={{ paddingTop: 14 }}>
        <span className="cap">Swipe from the right edge to leave</span>
        <Button width={168} height={52} onClick={onDone}>
          <span className="display" style={{ fontSize: 24 }}>Done</span>
        </Button>
      </div>
    </div>
  )
}
