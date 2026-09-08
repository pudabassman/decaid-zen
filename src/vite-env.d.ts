/// <reference types="vite/client" />

declare global {
  interface Window {
    /** injected by Decaid into every skin page */
    decentApp?: { exitToDashboard?: () => void }
  }
}

export {}
