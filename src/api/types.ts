export type MachineStateName =
  | 'booting' | 'busy' | 'idle' | 'sleeping' | 'heating' | 'preheating'
  | 'espresso' | 'hotWater' | 'flush' | 'steam' | 'steamRinse'
  | 'descale' | 'transportMode' | 'unknown'

export interface MachineSnapshot {
  timestamp: string
  state: { state: MachineStateName; substate: string }
  flow: number
  pressure: number
  targetFlow: number
  targetPressure: number
  mixTemperature: number
  groupTemperature: number
  targetMixTemperature: number
  targetGroupTemperature: number
  profileFrame: number
  steamTemperature: number
}

export interface ScaleSnapshot {
  timestamp: string
  weight: number
  batteryLevel?: number
}

export type ScaleFrame = ScaleSnapshot | { status: 'connected' | 'disconnected' }

export interface ProfileStep {
  name: string
  pump?: 'pressure' | 'flow'
  transition?: string
  exit?: unknown
  sensor?: string
  pressure?: number
  flow?: number
  seconds?: number
  volume?: number
  weight?: number | null
  temperature?: number
  limiter?: unknown
}

export interface Profile {
  version?: string
  title: string
  author?: string
  notes?: string
  beverage_type?: string
  steps?: ProfileStep[]
  target_weight?: number
  target_volume?: number
  tank_temperature?: number
}

export interface WorkflowContext {
  targetDoseWeight?: number
  targetYield?: number
  grinderId?: string
  grinderModel?: string
  grinderSetting?: string
  beanBatchId?: string
  coffeeName?: string
  coffeeRoaster?: string
  finalBeverageType?: string
}

export interface Workflow {
  id?: string
  name?: string
  description?: string
  profile?: Profile
  context?: WorkflowContext
  steamSettings?: { targetTemperature?: number; duration?: number; flow?: number }
  hotWaterData?: { targetTemperature?: number; volume?: number; duration?: number }
  rinseData?: { targetTemperature?: number; duration?: number; flow?: number }
}

export interface ShotSummary {
  id: string
  timestamp: string
  workflow?: Workflow
  annotations?: ShotAnnotations
}

export interface ShotScaleSample {
  timestamp: string
  weight: number
  weightFlow?: number
  battery?: number | null
  timerValue?: number | null
}

export interface ShotMeasurement {
  machine: MachineSnapshot
  scale?: ShotScaleSample | null
  volume?: number | null
}

export interface ShotAnnotations {
  actualDoseWeight?: number
  actualYield?: number
  drinkTds?: number
  drinkEy?: number
  enjoyment?: number
  espressoNotes?: string
}

export interface ShotRecord extends ShotSummary {
  measurements?: ShotMeasurement[]
  annotations?: ShotAnnotations
}

export interface ShotsPage {
  items: ShotSummary[]
  total: number
  limit: number
  offset: number
}

export interface WaterLevels {
  currentPercentage?: number
  currentLevel?: number
  warningThresholdPercentage?: number
}
