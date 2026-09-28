import { internal } from "./_generated/api"
import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { memberRoom } from "./roomAccess"
import { currentQuestion, eligible, gameValidator, nextRound, reveal, playerValidator } from "./quizModel"

const args = { roomId: v.id("rooms"), anonymousUserId: v.id("anonymousUsers") }
export const state = query({
  args,
  returns: v.object({ isHost: v.boolean(), members: v.array(v.string()), game: v.union(gameValidator.omit("players", "winners").extend({ players: v.array(playerValidator.omit("userId", "answer", "answeredAt").extend({ isMe: v.boolean(), winner: v.boolean() })) }), v.null()), question: v.union(v.object({ kind: v.literal("multipleChoice"), prompt: v.string(), options: v.array(v.string()), correct: v.union(v.number(), v.null()) }), v.null()), myAnswer: v.union(v.number(), v.null()) }),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    const members = await ctx.db.query("roomMembers").withIndex("by_roomId", q => q.eq("roomId", room._id)).take(101)
    const game = room.game
    const question = game ? currentQuestion(game) : null
    return { isHost: room.createdBy === a.anonymousUserId, members: members.map(m => m.customName ?? "Anonymous"),
      game: game ? { roundId: game.roundId, phase: game.phase, questionIndex: game.questionIndex, revealed: game.revealed, deadline: game.deadline, players: game.players.map(p => ({ name: p.name, status: p.status, score: p.score, isMe: p.userId === a.anonymousUserId, winner: game.winners.includes(p.userId) })) } : null,
      question: question ? { ...question, correct: game?.revealed ? question.correct : null } : null,
      myAnswer: game?.players.find(p => p.userId === a.anonymousUserId)?.answer ?? null }
  },
})
export const start = mutation({
  args, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    if (room.createdBy !== a.anonymousUserId) throw new Error("Only the host can start a game.")
    if (room.partyGame && room.partyGame.phase !== "results") throw new Error("Another game is running.")
    if (room.mode && room.mode !== "trivia") throw new Error("Choose Pop Trivia first.")
    if (room.game && room.game.phase !== "results") throw new Error("A game is already running.")
    const members = await ctx.db.query("roomMembers").withIndex("by_roomId", q => q.eq("roomId", room._id)).take(101)
    if (members.length > 100) throw new Error("This mock supports up to 100 players.")
    const roundId = crypto.randomUUID()
    const deadline = Date.now() + 20000
    await ctx.db.patch(room._id, { game: { roundId, phase: "question", questionIndex: 0, revealed: false, deadline, winners: [],
      players: members.map((m, i) => ({ userId: m.userId, name: m.customName ?? `Player ${i + 1}`, score: 0, status: "alive" as const })) } })
    await ctx.scheduler.runAt(deadline, internal.quiz.expireRound, { roomId: room._id, roundId })
    return null
  },
})
export const answer = mutation({
  args: { ...args, roundId: v.string(), choice: v.number() }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    const game = room.game
    const player = game?.players.find(p => p.userId === a.anonymousUserId)
    if (!game || game.roundId !== a.roundId || game.revealed || Date.now() >= game.deadline || !player || !eligible(game, player)) throw new Error("You cannot answer this round.")
    if (player.answer !== undefined) throw new Error("Answer already locked in.")
    if (!Number.isInteger(a.choice) || a.choice < 0 || a.choice >= currentQuestion(game).options.length) throw new Error("Invalid answer.")
    player.answer = a.choice
    player.answeredAt = Date.now()
    const allAnswered = game.players.every(p => !eligible(game, p) || p.answer !== undefined)
    await ctx.db.patch(room._id, { game: allAnswered ? reveal(game) : game })
    return null
  },
})
export const advance = mutation({
  args: { ...args, roundId: v.string(), revealed: v.boolean() }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    if (room.createdBy !== a.anonymousUserId) throw new Error("Only the host can advance rounds.")
    const game = room.game
    if (!game || game.phase === "results" || game.roundId !== a.roundId || game.revealed !== a.revealed) throw new Error("The round has already changed.")
    if (!game.revealed) throw new Error("Wait for the automatic reveal.")
    const next = nextRound(game, Date.now(), crypto.randomUUID())
    await ctx.db.patch(room._id, { game: next })
    if (next.phase !== "results") {
      await ctx.scheduler.runAt(next.deadline, internal.quiz.expireRound, { roomId: room._id, roundId: next.roundId })
    }
    return null
  },
})

// Server-owned timer: still runs when the host disconnects. Old timers are harmless.
export const expireRound = internalMutation({
  args: { roomId: v.id("rooms"), roundId: v.string() }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await ctx.db.get("rooms", a.roomId)
    const game = room?.game
    if (!game || game.roundId !== a.roundId || game.revealed || game.phase === "results" || Date.now() < game.deadline) return null
    await ctx.db.patch(a.roomId, { game: reveal(game) })
    return null
  },
})
