import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../.preview/', import.meta.url))
const port = Number(process.env.PREVIEW_PORT || 4176)
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
try { await stat(resolve(root, 'index.html')) }
catch { console.error('Preview files missing. Run pnpm demo:build first.'); process.exit(1) }
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const target = resolve(root, `.${path === '/' ? '/index.html' : path}`)
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403); res.end('Forbidden'); return
    }
    const body = await readFile(target)
    res.writeHead(200, { 'Content-Type': contentTypes[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(body)
  }
  catch { res.writeHead(404); res.end('Not found') }
})
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Close the existing preview or set PREVIEW_PORT.` : error.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`UI preview (sample data only): http://127.0.0.1:${port}\nKeep this window open. Press Ctrl+C to stop.`))
