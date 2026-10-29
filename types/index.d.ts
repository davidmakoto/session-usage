export type Snap = {
  five: number | null
  week: number | null
  tokens: number
  window: number
  pct: number
  usd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'session-usage': { snap: Snap | null; baseline: number | null }
  }
}
