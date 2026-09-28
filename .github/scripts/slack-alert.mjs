// Posts one Slack message per incident event, as a coloured attachment, instead of Upptime's
// one-line text.
// Run by .github/workflows/slack-alerts.yml; reads the GitHub event payload, needs Node 20+ and
// no dependencies. Upptime's own Slack notifier is switched off (no NOTIFICATION_SLACK secret)
// so each event is announced once.
//
//   issue opened by Upptime      → 🔴 <service> is down, with HTTP code and response time
//   issue closed (automatic)     → 🟢 <service> is back up, with how long it was down
//   issue opened by a person     → 🟡 incident title and its text
//   comment by a person          → 🟡/🟢 update, labelled by its first word (Investigating: …)
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

const when = (iso) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const duration = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
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
  [/^\**\s*(investigating|onderzoek( loopt)?|enquête( en cours)?)\b/i, 'Investigating', '🟡'],
  [/^\**\s*(identified|oorzaak gevonden|identifiée?)\b/i, 'Identified', '🟡'],
  [/^\**\s*(monitoring|we volgen het op|opvolging|surveillance)\b/i, 'Monitoring', '🔵'],
  [/^\**\s*(resolved|opgelost|résolue?)\b/i, 'Resolved', '🟢'],
]
const phaseOf = (text) => PHASES.find(([re]) => re.test(String(text || '').trim())) || [null, 'Update', '🟡']
// The label already says the phase, so drop "**Investigating:**" from the front of the text.
const withoutPhase = (text) => {
  const t = String(text || '').trim()
  const [re] = phaseOf(t)
  const rest = re ? t.replace(re, '').replace(/^\**\s*[:\-—–]?\s*\**\s*/, '') : t
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

// Slack's attachment layout: a coloured bar, one bold title line, then short "Label: value"
// lines — the shape monitoring alerts usually take, and compact in a busy channel.
const COLOR = { down: '#e7000b', up: '#16a34a', incident: '#f59e0b', monitoring: '#3b82f6' }
const moreInfo = `*More info:* <${issue.html_url}|Incident #${issue.number}> · <${STATUS_PAGE}|Status page>`

let color, title, lines

if (automatic && (action === 'opened' || action === 'reopened')) {
  const code = /HTTP code:\s*(\d+)/.exec(issue.body)?.[1]
  const ms = /Response time:\s*(\d+)\s*ms/.exec(issue.body)?.[1]
  const url = /\((https?:\/\/[^)\s]+)\) was/.exec(issue.body)?.[1]
  color = COLOR.down
  title = `🔴 DOWN — ${service}`
  lines = [
    `Failed check: ${code ? `HTTP ${code}` : 'no answer'}${ms ? ` in ${ms} ms` : ''}`,
    ...(url ? [`*URL:* ${url}`] : []),
    `*Since:* ${when(issue.created_at)}`,
    moreInfo,
  ]
} else if (automatic && action === 'closed') {
  color = COLOR.up
  title = `🟢 UP — ${service} is back`
  lines = [
    `*Down for:* ${duration(new Date(issue.closed_at) - new Date(issue.created_at))}`,
    `*Recovered:* ${when(issue.closed_at)}`,
    moreInfo,
  ]
} else if (!automatic && (action === 'opened' || action === 'reopened')) {
  const [, phase] = phaseOf(issue.body)
  color = COLOR.incident
  title = `🟡 INCIDENT — ${issue.title}`
  lines = [
    ...(issue.body ? [mrkdwn(withoutPhase(issue.body))] : []),
    `*Status:* ${phase}`,
    `*Service:* ${service}`,
    `*Opened:* ${when(issue.created_at)} by ${issue.user.login}`,
    moreInfo,
  ]
} else if (!automatic && action === 'closed') {
  color = COLOR.up
  title = `🟢 RESOLVED — ${issue.title}`
  lines = [
    `*Service:* ${service}`,
    `*Lasted:* ${duration(new Date(issue.closed_at) - new Date(issue.created_at))}`,
    moreInfo,
  ]
} else if (!automatic && action === 'created' && comment) {
  const [, phase, dot] = phaseOf(comment.body)
  color = phase === 'Resolved' ? COLOR.up : phase === 'Monitoring' ? COLOR.monitoring : COLOR.incident
  title = `${dot} ${phase.toUpperCase()} — ${issue.title}`
  lines = [
    mrkdwn(withoutPhase(comment.body)),
    `*Service:* ${service}`,
    `*Update:* ${when(comment.created_at)} by ${comment.user.login}`,
    moreInfo,
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
