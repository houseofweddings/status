// Posts one Slack message per incident event, as a coloured attachment, instead of Upptime's
// one-line text.
// Run by .github/workflows/slack-alerts.yml; reads the GitHub event payload, needs Node 20+ and
// no dependencies. Upptime's own Slack notifier is switched off (no NOTIFICATION_SLACK secret)
// so each event is announced once.
//
//   issue opened by Upptime      → [DOWN] or [DEGRADED] <service>, with check, result, latency
//   issue closed (automatic)     → [HEALTHY] <service>, with how long it was failing
//   issue opened by a person     → [INVESTIGATING] incident title and its text
//   comment by a person          → [IDENTIFIED] / [MONITORING] / [RESOLVED] / [UPDATE]
// Two vocabularies on purpose: a check reports a state (healthy / degraded / down), an incident a
// person runs moves through phases (investigating → identified → monitoring → resolved).
// No emoji: the attachment colour carries the state.
//   anything labelled false-alarm, or without the `status` label → nothing
import { readFileSync } from 'node:fs'

const WEBHOOK = process.env.SLACK_WEBHOOK_URL
const STATUS_PAGE = 'https://status.houseofweddings.ai'
const TZ = 'Europe/Brussels'

// Same names as the status page (status-page/assets/status.js), English: this is the team's channel.
const NAMES = {
  website: 'Website & planning tools',
  'vendor-pages': 'Vendor pages',
  auth: 'Sign-in & accounts',
  storage: 'Photos & uploads',
  cache: 'Caching',
  'api-and-database': 'API & database',
  admin: 'Internal tools',
  'partner-portal': 'PRO Collective',
}

// EVENT_FILE for a manual re-send: GitHub does not let a step overwrite GITHUB_EVENT_PATH.
// What a failure of each check means, for the Severity line. critical: couples or partners
// cannot use the product; major: part of it degrades; minor: only the team notices.
const SEVERITY = {
  website: 'critical',
  'vendor-pages': 'critical',
  auth: 'critical',
  'api-and-database': 'critical',
  storage: 'major',
  cache: 'major',
  'partner-portal': 'major',
  admin: 'minor',
}

const event = JSON.parse(readFileSync(process.env.EVENT_FILE || process.env.GITHUB_EVENT_PATH, 'utf8'))
const action = process.env.EVENT_ACTION || event.action
const issue = event.issue
const comment = event.comment

const labels = (issue.labels || []).map((l) => l.name)
if (!labels.includes('status') || labels.includes('false-alarm')) {
  console.log('Not a status incident, or a false alarm — nothing to send.')
  process.exit(0)
}

const slug = labels.find((l) => NAMES[l] || (l !== 'status' && l !== 'false-alarm'))
// A service not in NAMES (a new monitor): take the name Upptime put in its own title.
const titleName = issue.title.replace(/^[^\p{L}\p{N}]+\s*/u, '').replace(/ (is down|has degraded performance)$/, '')
const service = NAMES[slug] || titleName || slug || 'A service'
const automatic = /^In \[`[0-9a-f]{7,}`\]/.test(issue.body || '')

// "2026-09-28 13:46 CEST (11:46 UTC)" — unambiguous, sortable, and readable next to server logs.
const when = (iso) => {
  const d = new Date(iso)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  )
  const zone = { 'GMT+2': 'CEST', 'GMT+1': 'CET' }[parts.timeZoneName] || parts.timeZoneName
  const utc = d.toISOString().slice(11, 16)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${zone} (${utc} UTC)`
}
const duration = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000))
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}
// Slack mrkdwn, not GitHub markdown: **bold** → *bold*, [t](u) → <u|t>, and escape the three
// characters Slack treats as control.
const mrkdwn = (md) =>
  String(md || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .trim()
    .slice(0, 2900)

const PHASES = [
  [/^\**\s*(investigating|onderzoek( loopt)?|enquête( en cours)?)\b/i, 'Investigating'],
  [/^\**\s*(identified|oorzaak gevonden|identifiée?)\b/i, 'Identified'],
  [/^\**\s*(monitoring|we volgen het op|opvolging|surveillance)\b/i, 'Monitoring'],
  [/^\**\s*(resolved|opgelost|résolue?)\b/i, 'Resolved'],
]
const phaseOf = (text) => PHASES.find(([re]) => re.test(String(text || '').trim())) || [null, 'Update']
// The label already says the phase, so drop "**Investigating:**" from the front of the text.
const withoutPhase = (text) => {
  const t = String(text || '').trim()
  const [re] = phaseOf(t)
  const rest = re ? t.replace(re, '').replace(/^\**\s*[:\-—–]?\s*\**\s*/, '') : t
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

// Slack's attachment layout: a coloured bar, one bold title line, then short "Label: value"
// lines — the shape monitoring alerts usually take, and compact in a busy channel.
const COLOR = { firing: '#e7000b', resolved: '#16a34a', incident: '#f59e0b', monitoring: '#3b82f6' }
const severity = SEVERITY[slug] || 'major'
const links = `*Links:* <${issue.html_url}|Incident #${issue.number}> · <${STATUS_PAGE}|Status page>`

let color, title, lines

if (automatic && (action === 'opened' || action === 'reopened')) {
  const code = /HTTP code:\s*(\d+)/.exec(issue.body)?.[1]
  const ms = /Response time:\s*(\d+)\s*ms/.exec(issue.body)?.[1]
  const url = /\((https?:\/\/[^)\s]+)\) was/.exec(issue.body)?.[1]
  // Upptime titles a slow-but-answering check "… has degraded performance".
  const degraded = /degraded/i.test(issue.title)
  color = degraded ? COLOR.incident : COLOR.firing
  title = `[${degraded ? 'DEGRADED' : 'DOWN'}] ${service}: ${code ? `HTTP ${code}` : 'no response'}`
  lines = [
    ...(url ? [`*Check:* \`GET ${url}\``] : []),
    `*Result:* ${code ? `HTTP ${code}` : 'no response'} (expected 2xx)${ms ? ` · ${ms} ms` : ''}`,
    `*Severity:* ${severity}`,
    `*Started:* ${when(issue.created_at)}`,
    links,
  ]
} else if (automatic && action === 'closed') {
  color = COLOR.resolved
  title = `[HEALTHY] ${service}`
  lines = [
    `*Duration:* ${duration(new Date(issue.closed_at) - new Date(issue.created_at))}`,
    `*Started:* ${when(issue.created_at)}`,
    `*Resolved:* ${when(issue.closed_at)}`,
    links,
  ]
} else if (!automatic && (action === 'opened' || action === 'reopened')) {
  const [, phase] = phaseOf(issue.body)
  color = COLOR.incident
  title = `[${phase.toUpperCase()}] ${issue.title}`
  lines = [
    ...(issue.body ? [mrkdwn(withoutPhase(issue.body))] : []),
    `*Service:* ${service} · *Severity:* ${severity}`,
    `*Opened:* ${when(issue.created_at)} by ${issue.user.login}`,
    links,
  ]
} else if (!automatic && action === 'closed') {
  color = COLOR.resolved
  title = `[RESOLVED] ${issue.title}`
  lines = [
    `*Service:* ${service}`,
    `*Duration:* ${duration(new Date(issue.closed_at) - new Date(issue.created_at))}`,
    `*Resolved:* ${when(issue.closed_at)}`,
    links,
  ]
} else if (!automatic && action === 'created' && comment) {
  const [, phase] = phaseOf(comment.body)
  color = phase === 'Resolved' ? COLOR.resolved : phase === 'Monitoring' ? COLOR.monitoring : COLOR.incident
  title = `[${phase.toUpperCase()}] ${issue.title}`
  lines = [
    mrkdwn(withoutPhase(comment.body)),
    `*Service:* ${service} · *Severity:* ${severity}`,
    `*Posted:* ${when(comment.created_at)} by ${comment.user.login}`,
    links,
  ]
} else {
  // Upptime's own "Resolved: … is back up" comment on an automatic issue — the close event
  // right after it already says so.
  console.log(`Nothing to send for ${automatic ? 'automatic' : 'manual'} issue, action ${action}.`)
  process.exit(0)
}

// No top-level `text`: Slack would print it above the attachment as a duplicate line.
// `fallback` is what notifications and screen readers show instead.
const payload = {
  attachments: [
    {
      color,
      fallback: title,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: [`*${mrkdwn(title)}*`, ...lines].join('\n') } }],
    },
  ],
}

if (!WEBHOOK) {
  console.log('No SLACK_WEBHOOK_URL; would have sent:\n' + JSON.stringify(payload, null, 2))
  process.exit(0)
}
const res = await fetch(WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
const body = await res.text()
console.log(`Slack answered ${res.status} ${body}`)
if (!res.ok) process.exit(1)
