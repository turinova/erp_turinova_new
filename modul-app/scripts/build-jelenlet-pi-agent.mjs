// Jelenlét Pi v2 telepítő generálása → src/lib/jelenlet/pi-agent-script.generated.ts
// Futtatás: node scripts/build-jelenlet-pi-agent.mjs (raspberry-pi-attendance módosítás után)
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const piRoot = join(appRoot, '..', 'raspberry-pi-attendance')

const b64 = (p) => readFileSync(join(piRoot, p)).toString('base64').replace(/(.{76})/g, '$1\n')

const script = readFileSync(join(piRoot, 'modul-v2', 'install.sh'), 'utf8')
  .replace('__MODUL_API_B64__', b64('backend/modul_api.py'))
  .replace('__PATCHER_B64__', b64('modul-v2/patch_attendance_logic.py'))

if (script.includes('__MODUL_API_B64__') || script.includes('__PATCHER_B64__')) {
  throw new Error('placeholder maradt a telepítőben')
}

const sha = createHash('sha256').update(script).digest('hex')
const out = `// GENERÁLT — ne szerkeszd. Forrás: raspberry-pi-attendance/modul-v2 + backend/modul_api.py
// node scripts/build-jelenlet-pi-agent.mjs
export const JELENLET_PI_AGENT_SHA256 = '${sha}'
export const JELENLET_PI_AGENT_SCRIPT = ${JSON.stringify(script)}
`
writeFileSync(join(appRoot, 'src', 'lib', 'jelenlet', 'pi-agent-script.generated.ts'), out)
console.log(`pi agent script: ${script.length} bytes, sha256 ${sha}`)
