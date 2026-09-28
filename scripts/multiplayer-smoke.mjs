import { chromium, expect } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import fs from 'node:fs'
import { songs, words, wordMarks } from '../convex/partyModel.ts'
const base = process.env.APP_URL ?? 'http://127.0.0.1:3000'
const env = fs.readFileSync('.env.local', 'utf8')
const convex = new ConvexHttpClient(env.match(/^VITE_CONVEX_URL=(.+)$/m)[1].trim().replace(/^"|"$/g, ''))
const browser = await chromium.launch()
const contexts = [], errors = []
async function mobile() {
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
 contexts.push(context)
 const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); return page
}
async function shot(page, name) {
 await page.evaluate(() => document.fonts.ready)
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
 await page.screenshot({ path: `assets/screenshots/mobile-${name}.png`, fullPage: true })
}
let roomId
async function args(page) { return { roomId, anonymousUserId: (await page.context().cookies()).find(c => c.name === 'karppa_anonymous_user_id').value } }
async function state(page) { return convex.query('games:state', await args(page)) }
async function waitState(page, predicate) { await expect.poll(async () => predicate(await state(page)), { timeout: 15000 }).toBe(true) }
try {
 const host = await mobile(); await host.goto(base)
 await host.getByRole('button', { name: /Wordle Five/ }).click()
 await host.getByRole('button', { name: 'Create a room →' }).click()
 await host.waitForURL('**/choose/*')
 const code = new URL(host.url()).pathname.split('/').at(-1)
 roomId = (await convex.query('rooms:getByCode', { roomCode: code })).roomId
 const a = await mobile(), b = await mobile()
 for (const [page, name] of [[a,'Avery'],[b,'Blair']]) {
   await page.goto(`${base}/choose/${code}`)
   await page.getByRole('textbox', { name: 'Your name', exact: true }).fill(name)
   await page.getByRole('button', { name: 'Join Room', exact: true }).click()
   await page.getByText('The host is choosing your next game.').waitFor()
 }
 await shot(host, 'lobby')
 await host.getByRole('button', { name: 'Let’s play Wordle' }).click()
 for (let round = 0; round < 5; round++) {
   await host.getByRole('button', { name: `Start round ${round+1}` }).click()
   await a.getByRole('textbox', { name: 'Your guess' }).waitFor()
   let candidates = [...words], solution
   for (let attempt = 0; attempt < 6; attempt++) {
     const word = candidates[0]
     await a.getByRole('textbox', { name: 'Your guess' }).fill(word)
     await a.getByRole('button', { name: 'Lock in guess' }).click()
     await waitState(a, s => s.game.guesses.length === attempt+1)
     const s = await state(a), last = s.game.guesses.at(-1)
     if (round === 0 && attempt === 0) await shot(a, 'wordle')
     if (last.marks.every(m => m === 'correct')) { solution = word; break }
     candidates = candidates.filter(w => JSON.stringify(wordMarks(word, w)) === JSON.stringify(last.marks))
   }
   expect(solution).toBeTruthy()
   for (const page of [b, host]) {
     await page.getByRole('textbox', { name: 'Your guess' }).fill(solution)
     await page.getByRole('button', { name: 'Lock in guess' }).click()
   }
   await waitState(host, s => s.game.phase === (round === 4 ? 'results' : 'reveal'))
   if (round < 4) await host.getByRole('button', { name: 'Next round', exact: true }).click()
 }
 console.log("Wordle: all five rounds complete")
 expect((await state(host)).game.players.map(p => p.score)).toEqual([4000,5000,4500])
 await shot(a, 'results')
 await host.getByRole('button', { name: 'Choose another game' }).click()
 await host.getByRole('button', { name: /Songle Know/ }).click()
 await host.getByRole('button', { name: 'Let’s play Songle' }).click()
 for (let round = 0; round < 5; round++) {
   await host.getByRole('button', { name: `Start round ${round+1}` }).waitFor()
   const s = await state(host), song = songs.find(x => x.videoId === s.game.videoId)
   expect(song).toBeTruthy()
   await expect(host.locator('iframe')).toHaveAttribute('src', new RegExp(song.videoId))
   await host.getByRole('button', { name: `Start round ${round+1}` }).click()
   for (const page of [a,b]) {
     await page.getByRole('textbox', { name: 'Song title' }).fill(song.title)
     await page.getByRole('textbox', { name: 'Artist', exact: true }).fill(song.artist)
     if (round === 0 && page === a) await shot(a, 'songle')
     await page.getByRole('button', { name: 'Send my guess' }).click()
     await waitState(page, view => view.game.players.find(p => p.isMe).solved)
   }
   await waitState(host, s => s.game.phase === (round === 4 ? 'results' : 'reveal'))
   if (round < 4) await host.getByRole('button', { name: 'Next round', exact: true }).click()
 }
 console.log("Songle: all five rounds complete")
 expect((await state(host)).game.players.map(p => p.score)).toEqual([6250,5750])
 await host.getByRole('button', { name: 'Choose another game' }).click()
 await host.getByRole('button', { name: /Pop Trivia Think/ }).click()
 await host.getByRole('button', { name: 'Let’s play Pop Trivia' }).click()
 await host.getByRole('heading', { name: 'Which planet has the most famous rings?' }).waitFor()
 await shot(a, 'trivia')
 await host.getByRole('button', { name: /Saturn/ }).click()
 for (const page of [a,b]) await page.getByRole('button', { name: /Mars/ }).click()
 await host.getByRole('button', { name: 'Next round', exact: true }).click()
 for (const page of [a,b]) await page.getByRole('button', { name: '60', exact: true }).click()
 await host.getByRole('button', { name: 'Next round', exact: true }).click()
 await host.getByRole('button', { name: '93', exact: true }).click()
 await host.getByRole('button', { name: 'Play again', exact: true }).waitFor()
 await host.getByRole('button', { name: 'Play again', exact: true }).click()
 await host.getByRole('heading', { name: 'Which planet has the most famous rings?' }).waitFor()
 console.log('PASS: three independent mobile browsers; five Wordle rounds, five Songle tracks, score ordering, mode changes, automatic trivia reveals, sudden death, final and replay.')
 expect(errors).toEqual([])
} finally { await browser.close() }
