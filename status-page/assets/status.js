// Reads Upptime's committed data at view time, so the page never needs a redeploy to be current:
//   history/summary.json   — uptime %, response times, minutes down per day (rewritten daily)
//   history/<slug>.yml     — current status and last check (rewritten on every status change)
//   GitHub issues, label `status` — incidents; Upptime opens one when a site goes down, closes it on recovery
// Everything is rendered with textContent, never innerHTML: issue titles are user-editable.
;(function () {
  'use strict'

  var REPO = 'houseofweddings/status'
  var BRANCH = 'master'
  var RAW = document.documentElement.dataset.source || 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH
  var ISSUES = document.documentElement.dataset.issues || 'https://api.github.com/repos/' + REPO + '/issues?labels=status&state=all&per_page=10'
  var DAYS = 90
  var REFRESH_MS = 60 * 1000

  var LOCALES = { nl: 'nl-BE', fr: 'fr-BE', en: 'en-BE' }
  var T = {
    nl: {
      dark: 'Donkere modus',
      label: 'Status',
      title: 'Hoe gaat het met House of Weddings?',
      intro: 'De website, het partnerportaal en de admin, elke vijf minuten gecontroleerd.',
      loading: 'Status ophalen…',
      services: 'Diensten',
      incidents: 'Recente incidenten',
      footer: 'Elke vijf minuten gecontroleerd.',
      powered: 'Gemeten met Upptime',
      allUp: 'Alles werkt zoals het hoort',
      someDown: 'Een deel werkt niet',
      allDown: 'House of Weddings is onbereikbaar',
      degraded: 'Sommige onderdelen zijn traag',
      up: 'Werkt',
      stateDegraded: 'Traag',
      down: 'Onbereikbaar',
      checked: 'Laatst gecontroleerd {t}',
      uptime: '{p} beschikbaar',
      response: 'gem. {ms} ms',
      daysAgo: '{n} dagen geleden',
      today: 'Vandaag',
      noData: 'Geen metingen',
      noDowntime: 'Geen onderbreking',
      barsSummary: 'Laatste {days} dagen: {n} met een onderbreking',
      minutesDown: '{n} min onderbroken',
      noIncidents: 'Geen incidenten de voorbije tijd.',
      ongoing: 'Loopt nog · begonnen {t}',
      resolved: 'Opgelost · {t} · duurde {d}',
      failed: 'De status kon niet worden opgehaald. Probeer het zo meteen opnieuw.',
      period: { Day: '24u', Week: '7d', Month: '30d', Year: '1j' },
    },
    fr: {
      dark: 'Mode sombre',
      label: 'Statut',
      title: 'Comment va House of Weddings ?',
      intro: 'Le site, le portail partenaires et l’admin, vérifiés toutes les cinq minutes.',
      loading: 'Récupération du statut…',
      services: 'Services',
      incidents: 'Incidents récents',
      footer: 'Vérifié toutes les cinq minutes.',
      powered: 'Mesuré avec Upptime',
      allUp: 'Tout fonctionne normalement',
      someDown: 'Une partie ne fonctionne pas',
      allDown: 'House of Weddings est injoignable',
      degraded: 'Certains services sont lents',
      up: 'Opérationnel',
      stateDegraded: 'Lent',
      down: 'Injoignable',
      checked: 'Dernière vérification {t}',
      uptime: '{p} disponible',
      response: 'moy. {ms} ms',
      daysAgo: 'il y a {n} jours',
      today: "Aujourd'hui",
      noData: 'Aucune mesure',
      noDowntime: 'Aucune interruption',
      barsSummary: '{days} derniers jours : {n} avec une interruption',
      minutesDown: '{n} min d’interruption',
      noIncidents: 'Aucun incident récent.',
      ongoing: 'En cours · depuis {t}',
      resolved: 'Résolu · {t} · a duré {d}',
      failed: 'Impossible de récupérer le statut. Réessayez dans un instant.',
      period: { Day: '24 h', Week: '7 j', Month: '30 j', Year: '1 an' },
    },
    en: {
      dark: 'Dark mode',
      label: 'Status',
      title: 'How is House of Weddings doing?',
      intro: 'The website, the partner portal and the admin, checked every five minutes.',
      loading: 'Fetching status…',
      services: 'Services',
      incidents: 'Recent incidents',
      footer: 'Checked every five minutes.',
      powered: 'Measured with Upptime',
      allUp: 'Everything is working',
      someDown: 'Part of the service is down',
      allDown: 'House of Weddings is unreachable',
      degraded: 'Some services are slow',
      up: 'Working',
      stateDegraded: 'Slow',
      down: 'Unreachable',
      checked: 'Last checked {t}',
      uptime: '{p} uptime',
      response: 'avg. {ms} ms',
      daysAgo: '{n} days ago',
      today: 'Today',
      noData: 'No measurements',
      noDowntime: 'No downtime',
      barsSummary: 'Last {days} days: {n} with downtime',
      minutesDown: '{n} min down',
      noIncidents: 'No recent incidents.',
      ongoing: 'Ongoing · started {t}',
      resolved: 'Resolved · {t} · lasted {d}',
      failed: 'Could not fetch the status. Try again in a moment.',
      period: { Day: '24h', Week: '7d', Month: '30d', Year: '1y' },
    },
  }

  // Lucide paths, as the app uses. Constant markup, so innerHTML is safe here — unlike issue titles.
  var ICONS = {
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    store: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-2 1 2 2 0 0 1-2-2z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  }
  // One pastel per service, the way the homepage's feature cards alternate them.
  var SERVICE_LOOK = {
    website: ['globe', 'pink'],
    'partner-portal': ['store', 'lavender'],
    admin: ['shield', 'yellow'],
    'api-and-database': ['database', 'lavender'],
  }
  function icon(name) {
    var span = document.createElement('span')
    span.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'
    return span.firstChild
  }

  var lang = pickLang()
  var range = readPref('status-range', 'Month')
  var data = null // { sites, incidents }

  function pickLang() {
    var saved = readPref('status-lang', null)
    if (saved && T[saved]) return saved
    var nav = (navigator.languages || [navigator.language || 'nl'])
    for (var i = 0; i < nav.length; i++) {
      var two = String(nav[i]).slice(0, 2).toLowerCase()
      if (T[two]) return two
    }
    return 'nl'
  }
  function readPref(k, d) {
    try { return localStorage.getItem(k) || d } catch (e) { return d }
  }
  function writePref(k, v) {
    try { localStorage.setItem(k, v) } catch (e) { /* private mode */ }
  }
  function t(key, vars) {
    var s = T[lang][key]
    if (vars) for (var k in vars) s = s.replace('{' + k + '}', vars[k])
    return s
  }
  function el(tag, attrs, text) {
    var n = document.createElement(tag)
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k])
    if (text != null) n.textContent = text
    return n
  }
  function fmtDateTime(iso) {
    return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  }
  function fmtRelative(iso) {
    var diff = (new Date(iso).getTime() - Date.now()) / 1000
    var rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' })
    var abs = Math.abs(diff)
    if (abs < 60) return rtf.format(Math.round(diff), 'second')
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
    return rtf.format(Math.round(diff / 86400), 'day')
  }
  function fmtDuration(ms) {
    var m = Math.max(1, Math.round(ms / 60000))
    if (m < 60) return m + ' min'
    var h = Math.floor(m / 60)
    return h + (lang === 'nl' ? ' u ' : ' h ') + (m % 60) + ' min'
  }
  function dayKey(d) {
    return d.toISOString().slice(0, 10)
  }

  // history/<slug>.yml is flat `key: value` lines — no need for a YAML library.
  function parseFlatYaml(text) {
    var out = {}
    text.split('\n').forEach(function (line) {
      var m = /^(\w+):\s*(.*)$/.exec(line)
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    })
    return out
  }

  function load() {
    var bust = '?t=' + Math.floor(Date.now() / REFRESH_MS)
    return fetch(RAW + '/history/summary.json' + bust)
      .then(function (r) {
        if (!r.ok) throw new Error('summary ' + r.status)
        return r.json()
      })
      .then(function (summary) {
        return Promise.all([
          Promise.all(
            summary.map(function (s) {
              return fetch(RAW + '/history/' + s.slug + '.yml' + bust)
                .then(function (r) { return r.ok ? r.text() : '' })
                .then(function (y) {
                  var live = parseFlatYaml(y)
                  return Object.assign({}, s, {
                    status: live.status || s.status,
                    lastUpdated: live.lastUpdated || null,
                    // Only in the per-site file, not summary.json. Days before it are "no data",
                    // not "no downtime" — otherwise a monitor started today shows 90 green days.
                    startTime: live.startTime || s.startTime || null,
                  })
                })
                .catch(function () { return s })
            }),
          ),
          fetch(ISSUES)
            .then(function (r) { return r.ok ? r.json() : [] })
            .catch(function () { return [] }), // rate-limited or offline: the services still render
        ])
      })
      .then(function (res) {
        data = { sites: res[0], incidents: res[1].filter(function (i) { return !i.pull_request }) }
        render()
      })
      .catch(function () {
        if (!data) renderError()
      })
  }

  function overallState(sites) {
    var down = sites.filter(function (s) { return s.status === 'down' }).length
    if (down === sites.length && down > 0) return ['down', 'allDown']
    if (down > 0) return ['down', 'someDown']
    if (sites.some(function (s) { return s.status === 'degraded' })) return ['degraded', 'degraded']
    return ['up', 'allUp']
  }

  function render() {
    applyStatic()
    if (!data) return
    var sites = data.sites
    var o = overallState(sites)
    var overall = document.getElementById('overall')
    overall.dataset.state = o[0]
    document.getElementById('overall-icon').replaceChildren(icon(o[0] === 'up' ? 'check' : 'alert'))
    document.getElementById('overall-text').textContent = t(o[1])
    var latest = sites.map(function (s) { return s.lastUpdated }).filter(Boolean).sort().pop()
    document.getElementById('overall-meta').textContent = latest ? t('checked', { t: fmtRelative(latest) }) : ''

    var list = document.getElementById('services')
    list.replaceChildren.apply(list, sites.map(renderService))

    var inc = document.getElementById('incidents')
    if (!data.incidents.length) {
      inc.replaceChildren(el('li', { class: 'empty' }, t('noIncidents')))
    } else {
      inc.replaceChildren.apply(inc, data.incidents.map(renderIncident))
    }
  }

  function stateLabel(s) {
    return s === 'down' ? t('down') : s === 'degraded' ? t('stateDegraded') : t('up')
  }

  function renderService(s) {
    var li = el('li', { class: 'service' })
    var look = SERVICE_LOOK[s.slug] || ['globe', 'lavender']
    var tile = el('span', { class: 'tile', 'data-tone': look[1], 'aria-hidden': 'true' })
    tile.append(icon(look[0]))
    var stats = el('div', { class: 'service-stats' })
    var pct = s['uptime' + range] || s.uptime
    var ms = s['time' + range] || s.time
    stats.append(el('span', null, t('uptime', { p: pct })))
    if (ms) stats.append(el('span', null, t('response', { ms: ms })))
    var title = el('div', { class: 'service-title' })
    title.append(el('div', { class: 'service-name' }, s.name), stats)
    var row = el('div', { class: 'service-row' })
    row.append(tile, title, el('span', { class: 'badge', 'data-state': s.status }, stateLabel(s.status)))

    // Not 90 tab stops per service: the bars are hover detail, and the summary below is what a
    // screen reader gets.
    var bars = el('div', { class: 'bars', role: 'img' })
    var badDays = 0
    var today = new Date()
    var start = s.startTime ? dayKey(new Date(s.startTime)) : null
    for (var i = DAYS - 1; i >= 0; i--) {
      var d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
      var key = dayKey(d)
      var mins = (s.dailyMinutesDown || {})[key] || 0
      var state, label
      if (start && key < start) {
        state = 'none'
        label = t('noData')
      } else if (mins === 0) {
        state = 'up'
        label = t('noDowntime')
      } else {
        // Upptime counts minutes down per day; over an hour reads as an outage, under as a blip.
        state = mins >= 60 ? 'down' : 'degraded'
        badDays++
        label = t('minutesDown', { n: mins })
      }
      var dateLabel = new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short' }).format(d)
      var bar = el('span', { class: 'bar', 'data-state': state })
      bar.dataset.tip = dateLabel + ' · ' + label
      bars.append(bar)
    }
    bars.setAttribute('aria-label', t('barsSummary', { days: DAYS, n: badDays }))
    var legend = el('div', { class: 'bars-legend', 'aria-hidden': 'true' })
    legend.append(el('span', null, t('daysAgo', { n: DAYS })), el('span', null, t('today')))
    li.append(row, bars, legend)
    return li
  }

  function renderIncident(i) {
    var open = i.state === 'open'
    var li = el('li', { class: 'incident', 'data-open': String(open) })
    var tile = el('span', { class: 'tile', 'aria-hidden': 'true' })
    tile.append(icon(open ? 'alert' : 'check'))
    var body = el('div')
    body.append(el('a', { class: 'incident-title', href: i.html_url }, i.title.replace(/^[^\w]+\s*/u, '')))
    var meta = open
      ? t('ongoing', { t: fmtRelative(i.created_at) })
      : t('resolved', {
          t: fmtDateTime(i.created_at),
          d: fmtDuration(new Date(i.closed_at).getTime() - new Date(i.created_at).getTime()),
        })
    body.append(el('div', { class: 'incident-meta' }, meta))
    li.append(tile, body)
    return li
  }

  function renderError() {
    applyStatic()
    var overall = document.getElementById('overall')
    overall.dataset.state = 'unknown'
    document.getElementById('overall-icon').replaceChildren(icon('alert'))
    document.getElementById('overall-text').textContent = t('failed')
    document.getElementById('services').replaceChildren()
  }

  function applyStatic() {
    document.documentElement.lang = lang
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      var v = T[lang][n.dataset.i18n]
      if (typeof v === 'string') n.textContent = v
    })
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang))
    })
    var toggle = document.getElementById('theme-toggle')
    toggle.setAttribute('aria-label', T[lang].dark)
    toggle.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'))
    document.querySelectorAll('[data-range]').forEach(function (b) {
      b.textContent = T[lang].period[b.dataset.range]
      b.setAttribute('aria-pressed', String(b.dataset.range === range))
    })
  }

  // One tooltip for every bar, positioned on hover.
  var tip
  function showTip(e) {
    var b = e.target.closest && e.target.closest('.bar')
    if (!b) return
    var r = b.getBoundingClientRect()
    tip.textContent = b.dataset.tip
    tip.style.left = r.left + r.width / 2 + 'px'
    tip.style.top = r.top + 'px'
    tip.hidden = false
  }
  function hideTip() {
    tip.hidden = true
  }

  document.addEventListener('DOMContentLoaded', function () {
    tip = document.getElementById('tip')
    var services = document.getElementById('services')
    services.addEventListener('mouseover', showTip)
    services.addEventListener('mouseleave', hideTip)
    window.addEventListener('scroll', hideTip, { passive: true })

    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        lang = b.dataset.lang
        writePref('status-lang', lang)
        render()
      })
    })
    document.querySelectorAll('[data-range]').forEach(function (b) {
      b.addEventListener('click', function () {
        range = b.dataset.range
        writePref('status-range', range)
        render()
      })
    })

    document.getElementById('theme-toggle').addEventListener('click', function () {
      var dark = document.documentElement.dataset.theme !== 'dark'
      if (dark) document.documentElement.dataset.theme = 'dark'
      else delete document.documentElement.dataset.theme
      writePref('status-theme', dark ? 'dark' : 'light')
      document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0a0a0a' : '#ffffff')
      applyStatic()
    })

    document.getElementById('overall-icon').replaceChildren(icon('clock'))
    applyStatic()
    load()
    setInterval(function () {
      if (!document.hidden) load()
    }, REFRESH_MS)
  })
})()
