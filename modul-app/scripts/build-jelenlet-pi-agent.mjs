// Jelenlét Pi telepítők generálása → src/lib/jelenlet/pi-agent-script.generated.ts
// Futtatás: node scripts/build-jelenlet-pi-agent.mjs (raspberry-pi-attendance módosítás után)
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const piRoot = join(appRoot, '..', 'raspberry-pi-attendance')

const b64 = (p) => readFileSync(join(piRoot, p)).toString('base64').replace(/(.{76})/g, '$1\n')

function build(installer, patcher) {
  const script = readFileSync(join(piRoot, installer), 'utf8')
    .replace('__MODUL_API_B64__', b64('backend/modul_api.py'))
    .replace('__PATCHER_B64__', b64(patcher))
  if (script.includes('__MODUL_API_B64__') || script.includes('__PATCHER_B64__')) {
    throw new Error(`placeholder maradt: ${installer}`)
  }
  return { script, sha: createHash('sha256').update(script).digest('hex') }
}

const v2 = build('modul-v2/install.sh', 'modul-v2/patch_attendance_logic.py')
const v3 = build('modul-v3/install.sh', 'modul-v3/patch_offline_first.py')

const out = `// GENERÁLT — ne szerkeszd. Forrás: raspberry-pi-attendance/modul-v2, modul-v3 + backend/modul_api.py
// node scripts/build-jelenlet-pi-agent.mjs
export const JELENLET_PI_AGENT_SHA256 = '${v2.sha}'
export const JELENLET_PI_AGENT_SCRIPT = ${JSON.stringify(v2.script)}
export const JELENLET_PI_AGENT_V3_SHA256 = '${v3.sha}'
export const JELENLET_PI_AGENT_V3_SCRIPT = ${JSON.stringify(v3.script)}
`
writeFileSync(join(appRoot, 'src', 'lib', 'jelenlet', 'pi-agent-script.generated.ts'), out)
console.log(`pi agent v2: ${v2.script.length} bytes, sha256 ${v2.sha}`)
console.log(`pi agent v3: ${v3.script.length} bytes, sha256 ${v3.sha}`)
