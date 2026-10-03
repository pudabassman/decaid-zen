import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="screen empty-state" role="alert">
      <span className="eyebrow">Decaid Zen</span><h1>Let’s try that again.</h1>
      <p>This screen couldn’t load. Your saved settings are still on the machine.</p>
      <button className="btn" onClick={() => location.reload()}>Reload screen</button>
    </div>
    return this.props.children
  }
}
