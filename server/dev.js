import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serverPath = fileURLToPath(new URL('./index.js', import.meta.url))
const vitePath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const children = [
  spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, API_ONLY: '1', PORT: '5174' },
  }),
  spawn(process.execPath, [vitePath, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    stdio: 'inherit',
    env: process.env,
  }),
]

let stopping = false
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = exitCode
}

for (const child of children) {
  child.on('error', error => {
    console.error('Unable to start the development server:', error)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`Development server stopped (${signal ?? code}).`)
      stop(code ?? 1)
    }
  })
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
