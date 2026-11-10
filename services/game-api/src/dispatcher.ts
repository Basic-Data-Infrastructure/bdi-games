const secret = process.env.INTERNAL_TICK_SECRET ?? 'dev-tick-secret'
const base = process.env.API_URL ?? 'http://localhost:8787'
setInterval(() => {
  void fetch(`${base}/internal/tick`, { method: 'POST', headers: { 'x-tick-secret': secret } })
}, 500)
console.log('Dispatcher posts ticks to', base)
