import { Button } from '../../components/Button'
import { Choice, Row, Section, Toggle } from '../../components/SettingControls'
import type {
  AppUpdateState, BuildInfo, MachineInfo, PluginEntry, SkinEntry, WakeSchedule,
} from '../../api/settings'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function SchedulesSection({
  schedules,
  onToggle,
}: {
  schedules: WakeSchedule[]
  onToggle: (schedule: WakeSchedule) => void
}) {
  if (!schedules.length) return null

  return (
    <Section title="Wake schedules">
      {schedules.map((schedule) => {
        const days = schedule.days?.length === 7
          ? 'every day'
          : (schedule.days ?? []).map((d) => DAYS[(d - 1 + 7) % 7]).join(' ') || 'no days'
        return (
          <Row key={schedule.id} label={schedule.time} hint={days}>
            <Toggle on={schedule.enabled} onChange={() => onToggle(schedule)} />
          </Row>
        )
      })}
    </Section>
  )
}

export function SkinsSection({
  skins,
  current,
  onChoose,
  onCheck,
  busy,
}: {
  skins: SkinEntry[]
  current: string | null
  onChoose: (id: string) => void
  onCheck: () => void
  busy: boolean
}) {
  if (!skins.length) return null

  return (
    <Section title="Skins">
      {skins.map((skin) => (
        <Row key={skin.id} label={skin.name || skin.id} hint={skin.version}>
          <Button width={116} height={42} quiet={skin.id === current} onClick={() => onChoose(skin.id)}>
            <span className="cap">{skin.id === current ? 'default' : 'use'}</span>
          </Button>
        </Row>
      ))}
      <Row label="Skin updates" hint="asks GitHub for newer releases">
        <Button width={130} height={42} disabled={busy} onClick={onCheck}>
          <span className="cap">check</span>
        </Button>
      </Row>
    </Section>
  )
}

export function PluginsSection({
  plugins,
  bundled,
  onToggle,
  onInstallBundled,
  onCheck,
  busy,
}: {
  plugins: PluginEntry[]
  bundled: { name: string; version: string; installed?: string } | null
  onToggle: (plugin: PluginEntry, on: boolean) => void
  onInstallBundled: () => void
  onCheck: () => void
  busy: boolean
}) {
  if (!plugins.length && !bundled) return null

  return (
    <Section title="Plugins">
      {bundled && (
        <Row
          label={`${bundled.name}, bundled with this skin`}
          hint={bundled.installed ? `${bundled.version} here, ${bundled.installed} installed` : `${bundled.version}, not installed`}
        >
          <Button width={130} height={42} disabled={busy} onClick={onInstallBundled}>
            <span className="cap">{bundled.installed ? 'update' : 'install'}</span>
          </Button>
        </Row>
      )}
      {plugins.map((plugin) => (
        <Row
          key={plugin.id}
          label={plugin.name || plugin.id}
          hint={[plugin.version, plugin.loaded ? 'loaded' : 'not loaded'].filter(Boolean).join(' · ')}
        >
          <Toggle on={plugin.enabled ?? plugin.loaded ?? false} onChange={(on) => onToggle(plugin, on)} />
        </Row>
      ))}
      <Row label="Plugin updates">
        <Button width={130} height={42} disabled={busy} onClick={onCheck}>
          <span className="cap">check</span>
        </Button>
      </Row>
    </Section>
  )
}

export function AboutSection({
  build,
  machine,
  update,
  theme,
  onTheme,
  onReset,
  busy,
}: {
  build: BuildInfo | null
  machine: MachineInfo | null
  update: AppUpdateState | null
  theme: string | undefined
  onTheme: (next: string) => void
  onReset: () => void
  busy: boolean
}) {
  return (
    <Section title="About">
      {theme !== undefined && (
        <Row label="Theme">
          <Choice
            value={theme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
            onChange={onTheme}
          />
        </Row>
      )}
      {build && (
        <Row
          label="Decaid"
          hint={[build.version, build.commitShort, build.localIp].filter(Boolean).join(' · ')}
        >{null}</Row>
      )}
      {machine?.model && (
        <Row
          label={machine.model}
          hint={['firmware ' + (machine.version ?? '--'), machine.GHC ? 'GHC' : null].filter(Boolean).join(' · ')}
        >{null}</Row>
      )}
      {update && (
        <Row
          label="App update"
          hint={update.phase === 'available' ? `${update.latestVersion} available` : update.phase}
        >{null}</Row>
      )}
      <Row label="Reset machine settings" hint="puts the DE1 back to its defaults">
        <Button width={130} height={42} quiet disabled={busy} onClick={onReset}>
          <span className="cap">reset</span>
        </Button>
      </Row>
    </Section>
  )
}
