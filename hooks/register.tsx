import type { Register, SessionUsage } from 'claude-code'

import type { Snap } from '../types'

const PANE = 'session-usage'
const snap = { plugin: 'session-usage', key: 'snap' } as const
const baseline = { plugin: 'session-usage', key: 'baseline' } as const

const CHAT = '#f97316'
const OTHER = '#2dd4bf'
const FREE = '#94a3b8'
const WEEK = '#a78bfa'

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

const toSnap = (u: SessionUsage): Snap => ({
  five: u.rateLimits.find(r => r.kind === 'five_hour')?.percentUsed ?? null,
  week: u.rateLimits.find(r => r.kind === 'seven_day')?.percentUsed ?? null,
  tokens: u.context.tokens ?? 0,
  window: u.context.window,
  pct: Math.round(u.context.percent ?? 0),
  usd: u.cost ? u.cost.usd : null,
})

const pt = (r: number, f: number): [number, number] => {
  const a = f * 2 * Math.PI - Math.PI / 2
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]
}

// Donut slice between fractions f0..f1 of the circle.
const slice = (f0: number, f1: number, color: string, opacity = 1) => {
  const end = Math.min(f1, f0 + 0.9999)
  if (end - f0 <= 0.0005) return ''
  const [x0, y0] = pt(70, f0)
  const [x1, y1] = pt(70, end)
  const [x2, y2] = pt(46, end)
  const [x3, y3] = pt(46, f0)
  const big = end - f0 > 0.5 ? 1 : 0
  return `<path d="M${x0} ${y0} A70 70 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A46 46 0 ${big} 0 ${x3} ${y3} Z" fill="${color}" fill-opacity="${opacity}"/>`
}

const pieSvg = (chat: number, other: number, five: number, week: number | null) => {
  const c = chat / 100
  const o = other / 100
  const parts = [
    slice(0, 1, FREE, 0.18),
    slice(0, c, CHAT),
    slice(c, c + o, OTHER),
  ]
  let weekly = ''
  if (week !== null) {
    const w = Math.min(week, 100) / 100
    const [tx0, ty0] = pt(76, w)
    const [tx1, ty1] = pt(90, w)
    const [ax, ay] = pt(83, 0)
    const [bx, by] = pt(83, Math.min(w, 0.9999))
    weekly =
      `<circle cx="100" cy="100" r="83" fill="none" stroke="${WEEK}" stroke-opacity="0.12" stroke-width="2"/>` +
      `<path d="M${ax} ${ay} A83 83 0 ${w > 0.5 ? 1 : 0} 1 ${bx} ${by}" fill="none" stroke="${WEEK}" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>` +
      `<line x1="${tx0}" y1="${ty0}" x2="${tx1}" y2="${ty1}" stroke="${WEEK}" stroke-opacity="0.8" stroke-width="2.5" stroke-linecap="round"/>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
    parts.join('') +
    weekly +
    `<text x="100" y="98" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="${FREE}">${Math.round(five)}%</text>` +
    `<text x="100" y="116" text-anchor="middle" font-family="sans-serif" font-size="10" fill="${FREE}">of 5-hour</text>` +
    `</svg>`
  )
}

const bar = (pct: number, n = 20) => {
  const on = Math.round((Math.min(pct, 100) / 100) * n)
  return '█'.repeat(on) + '░'.repeat(n - on)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage', description: 'Open the usage pane' })
    const s = toSnap(await $.session.usage())
    await $.state.set(snap, s)
    const { value: b = null } = await $.state.get(baseline)
    if (b === null) await $.state.set(baseline, s.five ?? 0)
    $.ui.status(`Usage ${fmt(s.tokens)}/${fmt(s.window)} (${s.pct}%)`)
    void $.ui.open({ id: PANE, title: 'Usage' })

    return next(e)
  })

  on('command.run', { command: 'usage' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Usage' })

    return { text: 'Usage pane opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    const s = toSnap(await $.session.usage())
    await $.state.set(snap, s)
    $.ui.status(`Usage ${fmt(s.tokens)}/${fmt(s.window)} (${s.pct}%)`)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const { value: s = null } = await $.state.get(snap)
    const { value: base = 0 } = await $.state.get(baseline)

    if (s === null) return <Text dimColor>Waiting for first reading…</Text>

    const ctx = `Context ${fmt(s.tokens)}/${fmt(s.window)} (${s.pct}%)${s.usd === null ? '' : ` · $${s.usd.toFixed(2)}`}`
    if (s.five === null) {
      return (
        <Box flexDirection="column">
          <Text color="cyan">{bar(s.pct)} {s.pct}%</Text>
          <Text>{ctx}</Text>
          <Text dimColor>No rate-limit reading yet (appears after the first response).</Text>
        </Box>
      )
    }

    // The chat's share: growth of the 5-hour figure since this session began
    // (a reset of the window drops it below the baseline, so count it whole).
    const chat = s.five >= base ? s.five - base : s.five
    const other = Math.max(0, s.five - chat)
    const free = Math.max(0, 100 - s.five)
    const weekLine = s.week === null ? '' : `Week ${Math.round(s.week)}% used`

    const legend = (
      <Box flexDirection="column">
        <Text color="#f97316">● This chat {chat.toFixed(1)}%</Text>
        <Text color="#2dd4bf">● Other usage {other.toFixed(1)}%</Text>
        <Text dimColor>● Free {free.toFixed(1)}%</Text>
        {weekLine !== '' && <Text color="#a78bfa">▏{weekLine}</Text>}
        <Text dimColor>{ctx}</Text>
      </Box>
    )

    if (e.surface === 'terminal') {
      return (
        <Box flexDirection="column">
          <Text color="#f97316">{bar(chat)} chat</Text>
          <Text color="#2dd4bf">{bar(other)} other</Text>
          {legend}
        </Box>
      )
    }

    const { Svg } = ui as unknown as { Svg: typeof Box }
    return (
      <Box flexDirection="column">
        <Svg
          {...({ source: pieSvg(chat, other, s.five, s.week), alt: `5-hour usage ${Math.round(s.five)}%`, width: 200, height: 200 } as object)}
        />
        {legend}
      </Box>
    )
  })
}
