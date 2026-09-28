/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { currentQuestion } from "./quizModel"
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
const modules = import.meta.glob("./**/*.ts")
async function setup() {
  const t = convexTest(schema, modules)
  const host = await t.mutation(api.rooms.create, {})
  const guest = (await t.mutation(api.rooms.join, { roomCode: host.room.roomCode, customName: "Guest" }))!
  const args = { roomId: host.room.roomId, anonymousUserId: host.anonymousUserId }
  await t.mutation(api.quiz.start, args)
  const game = async () => (await t.run(ctx => ctx.db.get("rooms", args.roomId)))!.game!
  const advance = async () => { const g = await game(); await t.mutation(api.quiz.advance, { ...args, roundId: g.roundId, revealed: g.revealed }) }
  const answer = async (userId: typeof host.anonymousUserId, right = true) => {
    const g = await game(); await t.mutation(api.quiz.answer, { ...args, anonymousUserId: userId, roundId: g.roundId, choice: (currentQuestion(g).correct + (right ? 0 : 1)) % 4 })
  }
  return { t, host, guest, args, game, advance, answer }
}
test("wrong answers require survival; eliminated players cannot answer", async () => {
  const s = await setup()
  await s.answer(s.host.anonymousUserId)
  await s.answer(s.guest.anonymousUserId, false)
  await s.advance()
  expect((await s.game()).phase).toBe("sudden")
  await expect(s.answer(s.host.anonymousUserId)).rejects.toThrow()
  await s.answer(s.guest.anonymousUserId, false)
  await s.advance()
  expect((await s.game()).phase).toBe("final")
  await expect(s.answer(s.guest.anonymousUserId)).rejects.toThrow()
  await s.answer(s.host.anonymousUserId)
  expect((await s.game()).winners).toEqual([s.host.anonymousUserId])
})
test("newcomers spectate, original players rejoin, replay includes newcomers", async () => {
  const s = await setup()
  const newcomer = (await s.t.mutation(api.rooms.join, { roomCode: s.host.room.roomCode }))!
  await expect(s.answer(newcomer.anonymousUserId)).rejects.toThrow()
  await s.answer(s.guest.anonymousUserId, false)
  await s.t.mutation(api.rooms.leave, { roomCode: s.host.room.roomCode, anonymousUserId: s.guest.anonymousUserId })
  await s.t.mutation(api.rooms.join, { roomCode: s.host.room.roomCode, anonymousUserId: s.guest.anonymousUserId })
  expect((await s.game()).players.find(p => p.userId === s.guest.anonymousUserId)?.answer).toBeDefined()
  await expect(s.answer(s.guest.anonymousUserId)).rejects.toThrow()
  await s.answer(s.host.anonymousUserId, false)
  await s.advance()
  await s.answer(s.host.anonymousUserId, false); await s.answer(s.guest.anonymousUserId, false)
  await s.advance()
  expect((await s.game()).phase).toBe("results")
  expect((await s.game()).winners).toEqual([])
  await s.t.mutation(api.quiz.start, s.args)
  expect((await s.game()).players).toHaveLength(3)
  expect((await s.game()).players.every(p => p.status === "alive" && p.score === 0 && p.answer === undefined)).toBe(true)
})
test("ten questions cap; final fastest correct answer wins", async () => {
  const s = await setup()
  for (let i = 0; i < 10; i++) {
    expect((await s.game()).questionIndex).toBe(i)
    await s.answer(s.host.anonymousUserId); await s.answer(s.guest.anonymousUserId)
    await s.advance()
  }
  expect((await s.game()).phase).toBe("final")
  await s.answer(s.host.anonymousUserId)
  await vi.advanceTimersByTimeAsync(1)
  await s.answer(s.guest.anonymousUserId)
  expect((await s.game()).winners).toEqual([s.host.anonymousUserId])
})
test("timeouts, host controls, hidden answers and stale rounds are enforced", async () => {
  const s = await setup()
  const old = await s.game()
  const view = await s.t.query(api.quiz.state, s.args)
  expect(view.question?.correct).toBeNull()
  expect(view.game?.players[1]).not.toHaveProperty("userId")
  await expect(s.advance()).rejects.toThrow()
  await expect(s.t.mutation(api.quiz.advance, { ...s.args, anonymousUserId: s.guest.anonymousUserId, roundId: old.roundId, revealed: false })).rejects.toThrow()
  await expect(s.t.mutation(api.quiz.start, { ...s.args, anonymousUserId: s.guest.anonymousUserId })).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(20000)
  await s.t.finishInProgressScheduledFunctions()
  await expect(s.answer(s.host.anonymousUserId)).rejects.toThrow()
  expect((await s.game()).revealed).toBe(true)
  expect((await s.game()).players.every(p => p.status === "risk")).toBe(true)
  await s.advance()
  await expect(s.t.mutation(api.quiz.answer, { ...s.args, roundId: old.roundId, choice: 0 })).rejects.toThrow()
  await s.answer(s.host.anonymousUserId); await s.answer(s.guest.anonymousUserId)
  await s.advance()
  expect((await s.game()).phase).toBe("question")
  expect((await s.game()).questionIndex).toBe(1)
})
test("final exact ties share victory and missed finals have no winner", async () => {
  for (const correct of [true, false]) {
    const s = await setup()
    await s.t.run(async ctx => {
      const room = (await ctx.db.get("rooms", s.args.roomId))!
      await ctx.db.patch(room._id, { game: { ...room.game!, phase: "final" } })
    })
    await s.answer(s.host.anonymousUserId, correct); await s.answer(s.guest.anonymousUserId, correct)
    expect((await s.game()).winners).toHaveLength(correct ? 2 : 0)
  }
})

test("last eligible answer reveals once; stale timers cannot reveal the next round", async () => {
  const s = await setup()
  const first = await s.game()
  await s.answer(s.host.anonymousUserId)
  expect((await s.game()).revealed).toBe(false)
  await s.answer(s.guest.anonymousUserId)
  expect((await s.game()).revealed).toBe(true)
  const revealed = await s.game()
  await s.t.mutation(internal.quiz.expireRound, { roomId: s.args.roomId, roundId: first.roundId })
  expect(await s.game()).toEqual(revealed)
  await vi.advanceTimersByTimeAsync(1000)
  await s.advance()
  await vi.advanceTimersByTimeAsync(19000)
  await s.t.finishInProgressScheduledFunctions()
  expect((await s.game()).revealed).toBe(false)
  await vi.advanceTimersByTimeAsync(1000)
  await s.t.finishInProgressScheduledFunctions()
  expect((await s.game()).revealed).toBe(true)
})
