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
  // GitHub allows 60 unauthenticated API calls an hour per visitor. The status files are raw
  // downloads and do not count; issues and comments do, so they refresh on a slower clock.
  var ISSUES_EVERY_MS = 5 * 60 * 1000
  var PREVIEWS = ['investigating', 'outage', 'resolved']
  var PREVIEW = (function () {
    var p = new URLSearchParams(location.search).get('preview')
    return PREVIEWS.indexOf(p) >= 0 ? p : null
  })()

  var LOCALES = { nl: 'nl-BE', fr: 'fr-BE', en: 'en-BE' }
  var T = {
    nl: {
      dark: 'Donkere modus',
      names: {
        website: 'Website & planningstools',
        'partner-portal': 'PRO Collective',
        admin: 'Interne tools',
        'api-and-database': 'API & database',
      },
      autoDown: '{name}: onbereikbaar',
      autoSlow: '{name}: traag',
      phase: {
        investigating: 'Onderzoek loopt',
        identified: 'Oorzaak gevonden',
        monitoring: 'We volgen het op',
        resolved: 'Opgelost',
        update: 'Update',
      },
      preview: 'Voorbeeld: dit is niet de echte status.',
      label: 'Status',
      title: 'Hoe gaat het met House of Weddings?',
      intro: 'Alle diensten van House of Weddings, elke vijf minuten gecontroleerd.',
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
      names: {
        website: 'Site web & outils de planification',
        'partner-portal': 'PRO Collective',
        admin: 'Outils internes',
        'api-and-database': 'API & base de données',
      },
      autoDown: '{name} : injoignable',
      autoSlow: '{name} : lent',
      phase: {
        investigating: 'Enquête en cours',
        identified: 'Cause identifiée',
        monitoring: 'Sous surveillance',
        resolved: 'Résolu',
        update: 'Mise à jour',
      },
      preview: 'Aperçu : ce n’est pas le statut réel.',
      label: 'Statut',
      title: 'Comment va House of Weddings ?',
      intro: 'Tous les services de House of Weddings, vérifiés toutes les cinq minutes.',
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
      names: {
        website: 'Website & planning tools',
        'partner-portal': 'PRO Collective',
        admin: 'Internal tools',
        'api-and-database': 'API & database',
      },
      autoDown: '{name}: unreachable',
      autoSlow: '{name}: slow',
      phase: {
        investigating: 'Investigating',
        identified: 'Identified',
        monitoring: 'Monitoring',
        resolved: 'Resolved',
        update: 'Update',
      },
      preview: 'Preview: this is not the real status.',
      label: 'Status',
      title: 'How is House of Weddings doing?',
      intro: 'Every House of Weddings service, checked every five minutes.',
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

  function serviceName(slug, fallback) {
    return (T[lang].names || {})[slug] || fallback
  }

  // Upptime opens and closes its own issues with a technical body ("In [`abc1234`](…), Website
  // was down: HTTP code 403…"). Those get a translated title and no text; an incident a person
  // opened is shown as they wrote it.
  function isAutomatic(i) {
    return /^In \[`[0-9a-f]{7,}`\]/.test(i.body || '')
  }
  function serviceOf(i) {
    var names = (i.labels || []).map(function (l) { return typeof l === 'string' ? l : l.name })
    for (var k in SERVICE_LOOK) if (names.indexOf(k) >= 0) return k
    return null
  }
  function incidentTitle(i) {
    var slug = serviceOf(i)
    if (isAutomatic(i) && slug) {
      return t(/degraded/i.test(i.title) ? 'autoSlow' : 'autoDown', { name: serviceName(slug, slug) })
    }
    return i.title.replace(/^[^\p{L}\p{N}]+\s*/u, '')
  }

  // An update is the newest comment, or the issue text when there is none. Starting it with
  // "Investigating:", "Identified:", "Monitoring:" or "Resolved:" (or the Dutch or French word)
  // sets its label; anything else reads as a plain update.
  var PHASE_WORDS = [
    [/^(investigating|onderzoek loopt|onderzoek|enquête en cours|enquête)/i, 'investigating'],
    [/^(identified|oorzaak gevonden|geïdentificeerd|cause identifiée|identifiée?)/i, 'identified'],
    [/^(monitoring|we volgen het op|opvolging|sous surveillance|surveillance)/i, 'monitoring'],
    [/^(resolved|opgelost|résolue?)/i, 'resolved'],
    [/^(update|mise à jour)/i, 'update'],
  ]
  function plainText(md) {
    return String(md || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>)\s*/gm, '')
      .replace(/(\*\*|__|`)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  function latestUpdate(i) {
    if (isAutomatic(i)) return null
    var comments = i._comments || []
    var last = comments[comments.length - 1]
    var text = plainText(last ? last.body : i.body)
    if (!text) return null
    var phase = 'update'
    for (var n = 0; n < PHASE_WORDS.length; n++) {
      var m = PHASE_WORDS[n][0].exec(text)
      if (m) {
        phase = PHASE_WORDS[n][1]
        text = text.slice(m[0].length).replace(/^\s*[:\-—–]\s*/, '')
        break
      }
    }
    text = text.charAt(0).toUpperCase() + text.slice(1)
    if (text.length > 280) text = text.slice(0, 279).replace(/\s+\S*$/, '') + '…'
    return { phase: phase, text: text, at: last ? last.created_at : i.created_at }
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
          loadIncidents(),
        ])
      })
      .then(function (res) {
        data = { sites: res[0], incidents: res[1] }
        render()
      })
      .catch(function () {
        if (!data) renderError()
      })
  }

  var issuesAt = 0
  var issuesCache = []
  var commentsCache = {} // issue number → { updated_at, comments }
  function loadIncidents() {
    if (Date.now() - issuesAt < ISSUES_EVERY_MS) return Promise.resolve(issuesCache)
    return fetch(ISSUES)
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (list) {
        if (!list) return issuesCache // rate-limited: keep what we had
        list = list.filter(function (i) { return !i.pull_request })
        // Comments only for the incidents people wrote, only the newest few, and only when the
        // issue changed since we last looked — each fetch is one of the visitor's 60 an hour.
        return Promise.all(
          list.map(function (i, n) {
            if (n >= 5 || isAutomatic(i) || !i.comments) return i
            var hit = commentsCache[i.number]
            if (hit && hit.updated_at === i.updated_at) return Object.assign(i, { _comments: hit.comments })
            return fetch(i.comments_url + '?per_page=100')
              .then(function (r) { return r.ok ? r.json() : [] })
              .then(function (c) {
                commentsCache[i.number] = { updated_at: i.updated_at, comments: c }
                return Object.assign(i, { _comments: c })
              })
              .catch(function () { return i })
          }),
        ).then(function (withComments) {
          issuesAt = Date.now()
          issuesCache = withComments
          return withComments
        })
      })
      .catch(function () { return issuesCache }) // offline: the services still render
  }

  // ?preview=investigating | outage | resolved — sample data, so each state can be seen on the
  // real page without opening a real (public, notifying) issue. Nothing is fetched.
  function previewData(kind) {
    var now = Date.now()
    var ago = function (min) { return new Date(now - min * 60000).toISOString() }
    var day = function (n) { return new Date(now - n * 86400000).toISOString().slice(0, 10) }
    var down = kind === 'outage' ? 'api-and-database' : null
    var sites = Object.keys(SERVICE_LOOK).map(function (slug, n) {
      var dm = {}
      dm[day(23)] = 4
      if (n === 0) dm[day(51)] = 95
      if (slug === down) dm[day(0)] = 18
      return {
        name: slug, slug: slug, status: slug === down ? 'down' : 'up',
        uptime: '99.94%', uptimeDay: slug === down ? '98.75%' : '100.00%', uptimeWeek: '99.98%',
        uptimeMonth: '99.96%', uptimeYear: '99.94%',
        time: 240 + n * 40, timeDay: 230 + n * 40, timeWeek: 235 + n * 40, timeMonth: 240 + n * 40, timeYear: 250 + n * 40,
        dailyMinutesDown: dm, startTime: new Date(now - 120 * 86400000).toISOString(), lastUpdated: ago(2),
      }
    })
    var auto = function (slug, open, startMin, endMin) {
      return {
        number: 900 + startMin, state: open ? 'open' : 'closed', html_url: '#', labels: ['status', slug],
        title: '🛑 ' + slug + ' is down', body: 'In [`abc1234`](#), ' + slug + ' was **down**: HTTP code 503',
        created_at: ago(startMin), closed_at: open ? null : ago(endMin), comments: 1,
      }
    }
    var manual = {
      number: 42, html_url: '#', labels: ['status', 'website'],
      title: 'Slower sign-in for some couples', body: 'Investigating: some couples see a slow sign-in.',
      created_at: ago(kind === 'resolved' ? 185 : 34),
    }
    var incidents = []
    if (kind === 'investigating') {
      incidents.push(Object.assign({}, manual, {
        state: 'open', closed_at: null,
        _comments: [
          { created_at: ago(34), body: '**Investigating:** some couples see a spinner for up to 20 seconds when signing in. Planning tools work once you are in.' },
          { created_at: ago(12), body: '**Identified:** a slow response from our sign-in provider. We are switching traffic to a backup and expect sign-in to be quick again within 15 minutes.' },
        ],
      }))
    }
    if (kind === 'outage') incidents.push(auto('api-and-database', true, 18))
    if (kind === 'resolved') {
      incidents.push(Object.assign({}, manual, {
        state: 'closed', closed_at: ago(120),
        _comments: [
          { created_at: ago(150), body: '**Identified:** a slow response from our sign-in provider.' },
          { created_at: ago(120), body: '**Resolved:** sign-in is quick again for everyone. Nothing was lost; sorry for the wait.' },
        ],
      }))
    }
    incidents.push(auto('website', false, 51 * 1440, 51 * 1440 - 95))
    return { sites: sites, incidents: incidents }
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
    var latest = sites.map(function (s) { return s.lastUpdated }).filter(Boolean).sort().pop()
    var text = t(o[1])
    var meta = latest ? t('checked', { t: fmtRelative(latest) }) : ''
    // The checks can all pass while something is still wrong (slow sign-in, a broken payment).
    // An open incident then says so, instead of the banner claiming everything works.
    var open = data.incidents.filter(function (i) { return i.state === 'open' })[0]
    if (open && o[0] === 'up') {
      var u = latestUpdate(open)
      o = ['degraded']
      text = incidentTitle(open)
      meta = (u ? T[lang].phase[u.phase] + ' · ' : '') + t('ongoing', { t: fmtRelative(open.created_at) })
    }
    overall.dataset.state = o[0]
    document.getElementById('overall-icon').replaceChildren(icon(o[0] === 'up' ? 'check' : 'alert'))
    document.getElementById('overall-text').textContent = text
    document.getElementById('overall-meta').textContent = meta

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
    title.append(el('div', { class: 'service-name' }, serviceName(s.slug, s.name)), stats)
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
    var body = el('div', { class: 'incident-body' })
    var head = el('div', { class: 'incident-head' })
    head.append(el('a', { class: 'incident-title', href: i.html_url }, incidentTitle(i)))
    var u = latestUpdate(i)
    if (u && open) head.append(el('span', { class: 'phase', 'data-phase': u.phase }, T[lang].phase[u.phase]))
    body.append(head)
    if (u) body.append(el('p', { class: 'incident-update' }, u.text))
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
      document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#171717' : '#ffffff')
      applyStatic()
    })

    document.getElementById('overall-icon').replaceChildren(icon('clock'))
    applyStatic()
    if (PREVIEW) {
      var note = el('p', { class: 'preview-note', role: 'note', 'data-i18n': 'preview' }, t('preview'))
      document.querySelector('main').prepend(note)
      data = previewData(PREVIEW)
      render()
      return
    }
    load()
    setInterval(function () {
      if (!document.hidden) load()
    }, REFRESH_MS)
  })
})()
