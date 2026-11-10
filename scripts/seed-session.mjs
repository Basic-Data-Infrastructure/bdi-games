// Local development only: creates a session with four claimed, ready roles and prints bootstrap links.
//   --start         start round 1 right away
//   --only-bdi      a session that starts with the BDI round
//   --en            English session
//   --keepalive     keep sending heartbeats so the game does not pause
//   --autoplay S14  play (guessing like a player) until that step, logging every action
const api = process.env.API_URL ?? 'http://localhost:8787'
const web = process.env.WEB_URL ?? 'http://localhost:5173'
const args = process.argv.slice(2)
const mode = args.includes('--only-bdi') ? 'only_bdi' : 'without_bdi'
const autoplay = args.includes('--autoplay') ? args[args.indexOf('--autoplay') + 1] : null
const start = args.includes('--start') || Boolean(autoplay)
const keepalive = args.includes('--keepalive') || Boolean(autoplay)
const language = args.includes('--en') ? 'en' : 'nl'

async function call(path, token, body) {
  const response = await fetch(`${api}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(`${path}: ${response.status} ${json.message ?? ''}`), { status: response.status, body: json })
  return json
}

const anonymous = async () => (await call('/api/dev/anonymous', null, {})).token

const host = await anonymous()
const created = await call('/api/sessions', host, { name: 'Seed', language, startMode: mode, gameId: 'logistics' })
const session = created.sessionId
const tokens = {}
const links = { host: `${web}/#/bootstrap?slot=host&token=${host}&next=${encodeURIComponent(`/host/${session}`)}` }
for (const role of created.roles) {
  const token = await anonymous()
  await call(`/api/sessions/${session}/claim`, token, { organizationId: role.organizationId, inviteToken: role.inviteToken, displayName: '' })
  await call(`/api/sessions/${session}/ready`, token, {})
  tokens[role.organizationId] = token
  links[role.organizationId] = `${web}/#/bootstrap?slot=${role.organizationId}&token=${token}&next=${encodeURIComponent(`/play/${session}`)}`
}
if (start) await call(`/api/sessions/${session}/start`, host, {})
console.log(JSON.stringify({ sessionId: session, code: created.code, links }, null, 2))

if (keepalive) {
  setInterval(() => {
    for (const token of Object.values(tokens)) void call(`/api/sessions/${session}/heartbeat`, token, {}).catch(() => undefined)
  }, 4000)
}

if (autoplay) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const tried = new Map()
  let lastLine = ''
  for (;;) {
    const view = await call(`/api/sessions/${session}/training`, host)
    const round = view.round
    const line = `${round.stepId} actor=${round.actor} phase=${round.logistics.phase} paused=${view.paused} status=${view.status}`
    if (line !== lastLine) { console.log(new Date().toISOString().slice(11, 19), line); lastLine = line }
    if (round.stepId === autoplay) break
    const submit = async (token, value) => {
      try {
        await call(`/api/sessions/${session}/actions`, token, {
          roundId: round.id, stepId: round.stepId, expectedStateVersion: round.stateVersion, actionId: crypto.randomUUID(), value,
        })
        console.log(`   ${round.stepId} -> ${value}`)
      } catch (err) {
        console.log(`   ${round.stepId} -> ${value} REFUSED ${err.message}`)
      }
    }
    if (round.actor === 'host') await submit(host, 'continue')
    else if (round.actor === 'all') {
      for (const token of Object.values(tokens)) {
        const player = await call(`/api/sessions/${session}/player`, token)
        if (player.round.canAnswer && player.round.task) await submit(token, player.round.task.options[0].id)
      }
    } else if (tokens[round.actor]) {
      const player = await call(`/api/sessions/${session}/player`, tokens[round.actor])
      const task = player.round.task
      if (task && player.round.canAnswer && task.feedbackOk !== true) {
        const key = `${round.id}:${round.stepId}`
        const done = tried.get(key) ?? new Set()
        tried.set(key, done)
        const pick = [task.highlightOptionId, ...task.options.map((o) => o.id)].find((id) => id && !done.has(id))
        if (pick) {
          done.add(pick)
          await submit(tokens[round.actor], pick)
        }
      }
    }
    await sleep(500)
  }
  process.exit(0)
}
