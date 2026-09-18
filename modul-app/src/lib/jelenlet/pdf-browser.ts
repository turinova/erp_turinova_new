import { access } from 'fs/promises'
import { constants as fsConstants } from 'fs'

const isProduction =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK)
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
            'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe'
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

  return puppeteer.default.launch({
    headless: true,
    executablePath,
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-sandbox'
    ]
  })
}

export async function renderHtmlToPdfBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any,
  html: string
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
      margin: { top: '8mm', right: '4mm', bottom: '8mm', left: '4mm' }
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await page.close().catch(() => {})
  }
}
