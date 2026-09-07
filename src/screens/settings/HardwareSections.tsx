import { Button } from '../../components/Button'
import { NumberValue, Row, Section } from '../../components/SettingControls'
import { asHex, fromHex, type DeviceEntry, type LedStrip, type ZoneLed } from '../../api/settings'

function Swatch({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <label className="swatch" style={{ background: asHex(value) }}>
      <input type="color" value={asHex(value)} onChange={(e) => onChange(fromHex(e.target.value))} />
    </label>
  )
}

function ZoneRow({
  label,
  zone,
  onChange,
}: {
  label: string
  zone: ZoneLed
  onChange: (next: ZoneLed) => void
}) {
  return (
    <Row label={label} hint="awake, then asleep">
      <Swatch value={zone.awake} onChange={(awake) => onChange({ ...zone, awake })} />
      <Swatch value={zone.sleeping} onChange={(sleeping) => onChange({ ...zone, sleeping })} />
    </Row>
  )
}

export function LedSection({ led, save }: { led: LedStrip | null; save: (next: LedStrip) => void }) {
  if (!led) return null

  return (
    <Section title="Lights">
      <ZoneRow label="Front strip" zone={led.frontStrip} onChange={(frontStrip) => save({ ...led, frontStrip })} />
      <ZoneRow label="Back strip" zone={led.backStrip} onChange={(backStrip) => save({ ...led, backStrip })} />
    </Section>
  )
}

export function WaterSection({
  refillLevel,
  flowMultiplier,
  onRefillLevel,
  onFlowMultiplier,
}: {
  refillLevel: number | undefined
  flowMultiplier: number | undefined
  onRefillLevel: (next: number) => void
  onFlowMultiplier: (next: number) => void
}) {
  return (
    <Section title="Water and calibration">
      <Row label="Refill warning" hint="tank depth that counts as empty">
        <NumberValue value={refillLevel} unit="mm" digits={0} step={1} onCommit={onRefillLevel} />
      </Row>
      {flowMultiplier !== undefined && (
        <Row label="Flow estimate" hint="0.13 to 2.0; the machine's own flow correction">
          <NumberValue value={flowMultiplier} digits={2} step={0.01} onCommit={onFlowMultiplier} />
        </Row>
      )}
    </Section>
  )
}

export function DevicesSection({
  devices,
  preferredMachineId,
  preferredScaleId,
  onPrefer,
  onForget,
}: {
  devices: DeviceEntry[]
  preferredMachineId: string | null
  preferredScaleId: string | null
  onPrefer: (device: DeviceEntry) => void
  onForget: (device: DeviceEntry) => void
}) {
  if (!devices.length) return null

  return (
    <Section title="Devices">
      {devices.map((device) => {
        const preferred = device.id === preferredMachineId || device.id === preferredScaleId
        const state = device.state === 'connected' ? 'connected' : device.available ? 'in range' : 'away'
        return (
          <Row key={device.id} label={device.name || device.id} hint={`${device.type} · ${state}`}>
            <Button width={116} height={42} quiet={preferred} onClick={() => onPrefer(device)}>
              <span className="cap">{preferred ? 'preferred' : 'prefer'}</span>
            </Button>
            <Button width={100} height={42} quiet onClick={() => onForget(device)}>
              <span className="cap">forget</span>
            </Button>
          </Row>
        )
      })}
    </Section>
  )
}
