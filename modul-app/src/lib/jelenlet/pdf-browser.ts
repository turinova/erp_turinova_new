import { access, mkdir, mkdtemp, rm } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import path from 'path'

const isProduction =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function resolveLocalChromePath(): Promise<string | undefined> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  try {
    const puppeteer = await import('puppeteer')
    const bundled = puppeteer.default.executablePath()
    if (bundled && (await pathExists(bundled))) return bundled
  } catch {
    // fall through
  }

  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
        ]
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
          ]

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }
  return undefined
}

/**
 * Prefer project-local tmp (often on external volume) over macOS /var/folders
 * when the system Data volume is full — Puppeteer mkdtemp fails with ENOSPC.
 */
function resolvePdfTempRoot(): string {
  if (process.env.PDF_TMPDIR) return process.env.PDF_TMPDIR
  return path.join(process.cwd(), '.tmp', 'puppeteer')
}

async function prepareLocalChromeTemp(): Promise<{
  userDataDir: string
  env: NodeJS.ProcessEnv
  cleanup: () => Promise<void>
}> {
  const tempRoot = resolvePdfTempRoot()
  await mkdir(tempRoot, { recursive: true })
  const userDataDir = await mkdtemp(path.join(tempRoot, 'profile-'))
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot
  }
  return {
    userDataDir,
    env,
    cleanup: async () => {
      await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

function isEnospc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  return (
    e.code === 'ENOSPC' ||
    (typeof e.message === 'string' && e.message.includes('ENOSPC'))
  )
}

export async function launchPdfBrowser() {
  if (isProduction) {
    const puppeteerCore = await import('puppeteer-core')
    const chromium = await import('@sparticuz/chromium')
    return puppeteerCore.default.launch({
      args: [
        ...chromium.default.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.default.executablePath(),
      headless: true
    })
  }

  const puppeteer = await import('puppeteer')
  const executablePath = await resolveLocalChromePath()
  if (!executablePath) {
    throw new Error(
      'Hiányzik a Chrome. Futtasd: npx puppeteer browsers install chrome'
    )
  }

  const { userDataDir, env, cleanup } = await prepareLocalChromeTemp()

  try {
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      userDataDir,
      env,
      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--no-sandbox'
      ]
    })
    browser.on('disconnected', () => {
      void cleanup()
    })
    return browser
  } catch (error) {
    await cleanup()
    if (isEnospc(error)) {
      throw new Error(
        'Nincs elég szabad hely a rendszerlemezén a PDF generáláshoz. Szabadíts fel helyet, vagy állítsd a PDF_TMPDIR környezeti változót egy tágas kötetre.'
      )
    }
    throw error
  }
}

export async function renderHtmlToPdfBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any,
  html: string,
  options?: {
    margin?: { top?: string; right?: string; bottom?: string; left?: string }
  }
): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (req: { abort: () => void }) => req.abort())

    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await new Promise((resolve) => setTimeout(resolve, 50))

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1,
      margin: options?.margin ?? {
        top: '8mm',
        right: '4mm',
        bottom: '8mm',
        left: '4mm'
      }
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await page.close().catch(() => {})
  }
}
