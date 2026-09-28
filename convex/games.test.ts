/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { songs, words, wordMarks } from "./partyModel"
const modules = import.meta.glob("./**/*.ts")
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
async function setup(mode: "songle" | "wordle") {
  const t = convexTest(schema, modules)
  const host = await t.mutation(api.rooms.create, {})
  const guest = (await t.mutation(api.rooms.join, { roomCode: host.room.roomCode, customName: "Avery" }))!
  const third = (await t.mutation(api.rooms.join, { roomCode: host.room.roomCode, customName: "Blair" }))!
  const args = { roomId: host.room.roomId, anonymousUserId: host.anonymousUserId }
  const game = async () => (await t.run(ctx => ctx.db.get("rooms", args.roomId)))!.partyGame!
  await t.mutation(api.games.selectMode, { ...args, mode })
  await t.mutation(api.games.start, args)
  const begin = async () => t.mutation(api.games.beginRound, { ...args, roundId: (await game()).roundId })
  const guess = async (userId: typeof host.anonymousUserId, text: string, artist?: string) => t.mutation(api.games.guess, { ...args, anonymousUserId: userId, roundId: (await game()).roundId, text, ...(artist ? { artist } : {}) })
  return { t, host, guest, third, args, game, begin, guess }
}
test("Songle plays exactly five songs with descending solve points and one artist bonus", async () => {
  const s = await setup("songle")
  expect((await s.game()).players).toHaveLength(2)
  expect(new Set((await s.game()).order).size).toBe(5)
  for (let i = 0; i < 5; i++) {
    await s.begin()
    const g = await s.game(), song = songs[g.order[i]!]!
    await s.guess(s.guest.anonymousUserId, song.title.toUpperCase() + "!!!")
    expect((await s.game()).players[0]!.roundScore).toBe(1000)
    await s.guess(s.guest.anonymousUserId, "", song.artist)
    await expect(s.guess(s.guest.anonymousUserId, song.title, song.artist)).rejects.toThrow()
    await s.guess(s.third.anonymousUserId, song.title, song.artist)
    const result = await s.game()
    expect(result.players.map(p => p.roundScore)).toEqual([1250, 1150])
    expect(result.phase).toBe(i === 4 ? "results" : "reveal")
    if (i < 4) await s.t.mutation(api.games.next, { ...s.args, roundId: result.roundId })
  }
  expect((await s.game()).players.map(p => p.score)).toEqual([6250, 5750])
  await s.t.mutation(api.games.start, s.args)
  expect((await s.game()).round).toBe(0)
  expect((await s.game()).players.every(p => p.score === 0)).toBe(true)
})
test("Wordle ranks solves, keeps guesses private, and finishes after five rounds", async () => {
  const s = await setup("wordle")
  for (let i = 0; i < 5; i++) {
    await s.begin()
    const g = await s.game(), word = words[g.order[i]!]!
    await s.guess(s.guest.anonymousUserId, word)
    await s.guess(s.third.anonymousUserId, word)
    const hostView = await s.t.query(api.games.state, s.args)
    expect(hostView.game?.guesses).toEqual([])
    expect(hostView.game?.solution).toBeNull()
    expect(hostView.game).not.toHaveProperty("order")
    await s.guess(s.host.anonymousUserId, word)
    const result = await s.game()
    expect(result.players.map(p => p.roundScore)).toEqual([800, 1000, 900])
    expect(result.phase).toBe(i === 4 ? "results" : "reveal")
    if (i < 4) await s.t.mutation(api.games.next, { ...s.args, roundId: result.roundId })
  }
})
test("duplicate letter feedback only consumes each answer letter once", () => {
  expect(wordMarks("allee", "apple")).toEqual(["correct", "present", "absent", "absent", "correct"])
  expect(wordMarks("eerie", "serve")).toEqual(["absent", "correct", "correct", "absent", "correct"])
})
test("invalid words do not consume a guess; six misses exhaust a player", async () => {
  const s = await setup("wordle"); await s.begin()
  await expect(s.guess(s.guest.anonymousUserId, "zzzzz")).rejects.toThrow("valid five-letter")
  expect((await s.game()).players[1]!.guesses).toHaveLength(0)
  const solution = words[(await s.game()).order[0]!]!
  const wrong = solution === "crane" ? "apple" : "crane"
  for (let i = 0; i < 6; i++) await s.guess(s.guest.anonymousUserId, wrong)
  await expect(s.guess(s.guest.anonymousUserId, solution)).rejects.toThrow()
})
test("spectators cannot guess; leaving and rejoining retains progress; replay admits newcomers", async () => {
  const s = await setup("wordle"); await s.begin()
  const newcomer = (await s.t.mutation(api.rooms.join, { roomCode: s.host.room.roomCode, customName: "Newcomer" }))!
  await expect(s.guess(newcomer.anonymousUserId, "crane")).rejects.toThrow()
  await s.guess(s.guest.anonymousUserId, "crane")
  await s.t.mutation(api.rooms.leave, { roomCode: s.host.room.roomCode, anonymousUserId: s.guest.anonymousUserId })
  await s.t.mutation(api.rooms.join, { roomCode: s.host.room.roomCode, anonymousUserId: s.guest.anonymousUserId })
  const view = await s.t.query(api.games.state, { ...s.args, anonymousUserId: s.guest.anonymousUserId })
  expect(view.game?.guesses).toHaveLength(1)
  for (let i = 0; i < 5; i++) {
    if (i > 0) await s.begin()
    await vi.advanceTimersByTimeAsync(120000); await s.t.finishInProgressScheduledFunctions()
    if (i < 4) await s.t.mutation(api.games.next, { ...s.args, roundId: (await s.game()).roundId })
  }
  await s.t.mutation(api.games.start, s.args)
  expect((await s.game()).players).toHaveLength(4)
})
test("server timer reveals without host; stale callbacks and submissions cannot change a later round", async () => {
  const s = await setup("songle"); await s.begin()
  const old = await s.game()
  await vi.advanceTimersByTimeAsync(60000); await s.t.finishInProgressScheduledFunctions()
  expect((await s.game()).phase).toBe("reveal")
  await expect(s.guess(s.guest.anonymousUserId, "anything")).rejects.toThrow()
  await s.t.mutation(api.games.next, { ...s.args, roundId: old.roundId })
  await s.begin()
  await s.t.mutation(internal.games.expireRound, { roomId: s.args.roomId, roundId: old.roundId })
  expect((await s.game()).phase).toBe("playing")
  await expect(s.t.mutation(api.games.guess, { ...s.args, anonymousUserId: s.guest.anonymousUserId, roundId: old.roundId, text: "anything" })).rejects.toThrow()
})
test("host-only controls and mutually exclusive game modes", async () => {
  const s = await setup("wordle")
  const guestArgs = { ...s.args, anonymousUserId: s.guest.anonymousUserId }
  await expect(s.t.mutation(api.games.selectMode, { ...guestArgs, mode: "songle" })).rejects.toThrow()
  await expect(s.t.mutation(api.games.beginRound, { ...guestArgs, roundId: (await s.game()).roundId })).rejects.toThrow()
  await expect(s.t.mutation(api.games.start, guestArgs)).rejects.toThrow()
  await expect(s.t.mutation(api.quiz.start, s.args)).rejects.toThrow()
  await expect(s.t.mutation(api.games.selectMode, { ...s.args, mode: "trivia" })).rejects.toThrow()
})
