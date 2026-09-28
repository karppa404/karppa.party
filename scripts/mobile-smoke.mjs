import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
const page = await context.newPage()
page.on('pageerror', e => console.error(e.message))
await page.goto('http://127.0.0.1:3000')
await page.getByRole('heading', { name: 'Your people. Your party.' }).waitFor()
await page.evaluate(() => document.fonts.ready)
await mkdir('assets/screenshots', { recursive: true })
await page.screenshot({ path: 'assets/screenshots/mobile-home.png', fullPage: true })
console.log('Home screenshot saved; horizontal overflow:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
await browser.close()
