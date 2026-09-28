import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { memberRoom } from "./roomAccess"
import { duration, guessValidator, isFinished, modeValidator, normalize, partyValidator, revealed, shuffledIndices, solvePoints, songs, wordMarks, words, type Party } from "./partyModel"
import { validWords } from "./wordList"
const args = { roomId: v.id("rooms"), anonymousUserId: v.id("anonymousUsers") }
const publicPlayer = v.object({ name: v.string(), isMe: v.boolean(), score: v.number(), roundScore: v.number(), solved: v.boolean(), finished: v.boolean(), artistCorrect: v.boolean() })
const publicGame = partyValidator.omit("order", "players").extend({ players: v.array(publicPlayer), guesses: v.array(guessValidator), lastGuess: v.union(v.string(), v.null()), solution: v.union(v.string(), v.null()), videoId: v.union(v.string(), v.null()), videoStart: v.number() })
export const state = query({
  args, returns: v.object({ mode: modeValidator, isHost: v.boolean(), triviaStarted: v.boolean(), triviaEnded: v.boolean(), members: v.array(v.string()), game: v.union(publicGame, v.null()) }),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    const members = await ctx.db.query("roomMembers").withIndex("by_roomId", q => q.eq("roomId", room._id)).take(101)
    const g = room.partyGame
    const me = g?.players.find(p => p.userId === a.anonymousUserId)
    const isHost = room.createdBy === a.anonymousUserId
    const song = g?.mode === "songle" ? songs[g.order[g.round]!] : null
    const showSolution = g?.phase === "reveal" || g?.phase === "results"
    return { mode: room.mode ?? "trivia", isHost, triviaStarted: !!room.game, triviaEnded: room.game?.phase === "results", members: members.map((m, i) => m.customName ?? `Player ${i + 1}`),
      game: g ? { mode: g.mode, roundId: g.roundId, round: g.round, phase: g.phase, startedAt: g.startedAt, deadline: g.deadline,
        players: g.players.map(p => ({ name: p.name, isMe: p.userId === a.anonymousUserId, score: p.score, roundScore: p.roundScore, solved: p.solvedAt !== undefined, finished: isFinished(g, p), artistCorrect: p.artistCorrect })),
        guesses: me?.guesses ?? [], lastGuess: me?.lastGuess ?? null,
        solution: showSolution ? song ? `${song.title} — ${song.artist}` : words[g.order[g.round]!]! : null,
        videoId: song && isHost ? song.videoId : null, videoStart: song?.start ?? 0 } : null }
  },
})
export const selectMode = mutation({
  args: { ...args, mode: modeValidator }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    if (room.createdBy !== a.anonymousUserId) throw new Error("Only the host chooses the game.")
    if ((room.game && room.game.phase !== "results") || (room.partyGame && room.partyGame.phase !== "results")) throw new Error("Finish the current game first.")
    await ctx.db.patch(room._id, { mode: a.mode, game: undefined, partyGame: undefined })
    return null
  },
})
export const start = mutation({
  args, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    if (room.createdBy !== a.anonymousUserId) throw new Error("Only the host starts the game.")
    if (room.mode !== "songle" && room.mode !== "wordle") throw new Error("Select Songle or Wordle first.")
    if ((room.game && room.game.phase !== "results") || (room.partyGame && room.partyGame.phase !== "results")) throw new Error("A game is running.")
    const members = await ctx.db.query("roomMembers").withIndex("by_roomId", q => q.eq("roomId", room._id)).take(101)
    if (members.length > 100) throw new Error("Rooms support up to 100 players.")
    // The Songle host runs the music; YouTube may show them the title, so they do not compete.
    const roster = members.filter(m => room.mode !== "songle" || m.userId !== room.createdBy)
    if (!roster.length) throw new Error("Songle needs at least one player in addition to the host.")
    const game: Party = { mode: room.mode, roundId: crypto.randomUUID(), round: 0, phase: "ready", startedAt: 0, deadline: 0,
      order: shuffledIndices(room.mode === "songle" ? songs.length : words.length),
      players: roster.map((m, i) => ({ userId: m.userId, name: m.customName ?? `Player ${i + 1}`, score: 0, roundScore: 0, artistCorrect: false, guesses: [], attempts: 0 })) }
    await ctx.db.patch(room._id, { partyGame: game, game: undefined })
    return null
  },
})
export const beginRound = mutation({
  args: { ...args, roundId: v.string() }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    const game = room.partyGame
    if (room.createdBy !== a.anonymousUserId || !game || game.phase !== "ready" || game.roundId !== a.roundId) throw new Error("Only the host can begin a ready round.")
    game.phase = "playing"; game.startedAt = Date.now(); game.deadline = game.startedAt + duration(game.mode)
    await ctx.db.patch(room._id, { partyGame: game })
    await ctx.scheduler.runAt(game.deadline, internal.games.expireRound, { roomId: room._id, roundId: game.roundId })
    return null
  },
})
export const guess = mutation({
  args: { ...args, roundId: v.string(), text: v.string(), artist: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    const game = room.partyGame
    const p = game?.players.find(p => p.userId === a.anonymousUserId)
    if (!game || game.roundId !== a.roundId || game.phase !== "playing" || Date.now() >= game.deadline || !p || isFinished(game, p)) throw new Error("You cannot guess in this round.")
    if (a.text.length > 120 || (a.artist?.length ?? 0) > 120) throw new Error("Keep guesses under 120 characters.")
    if (game.mode === "wordle") {
      const word = a.text.trim().toLowerCase()
      if (!/^[a-z]{5}$/.test(word) || !validWords.has(word)) throw new Error("Enter a valid five-letter English word.")
      const solution = words[game.order[game.round]!]!
      p.guesses.push({ word, marks: wordMarks(word, solution) })
      if (word === solution) { p.roundScore = solvePoints(game); p.solvedAt = Date.now(); p.score += p.roundScore }
    } else {
      if (++p.attempts > 30) throw new Error("You have used all 30 guesses. Wait for the reveal.")
      if (!normalize(a.text) && !normalize(a.artist ?? "")) throw new Error("Enter a song or artist guess.")
      const song = songs[game.order[game.round]!]!
      if (p.solvedAt === undefined && normalize(a.text) === normalize(song.title)) { const points = solvePoints(game); p.solvedAt = Date.now(); p.roundScore += points; p.score += points }
      if (!p.artistCorrect && [song.artist, ...(song.artistAliases ?? [])].some(name => normalize(name) === normalize(a.artist ?? ""))) { p.artistCorrect = true; p.roundScore += 250; p.score += 250 }
      p.lastGuess = `Song: ${p.solvedAt !== undefined ? "correct" : "keep trying"} · Artist: ${p.artistCorrect ? "correct (+250)" : "keep trying"}`
    }
    await ctx.db.patch(room._id, { partyGame: game.players.every(p => isFinished(game, p)) ? revealed(game) : game })
    return null
  },
})
export const next = mutation({
  args: { ...args, roundId: v.string() }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await memberRoom(ctx, a.roomId, a.anonymousUserId)
    const game = room.partyGame
    if (room.createdBy !== a.anonymousUserId || !game || game.phase !== "reveal" || game.roundId !== a.roundId) throw new Error("Wait for the round to finish.")
    await ctx.db.patch(room._id, { partyGame: { ...game, round: game.round + 1, roundId: crypto.randomUUID(), phase: "ready", startedAt: 0, deadline: 0,
      players: game.players.map(({ solvedAt: _at, lastGuess: _last, ...p }) => ({ ...p, roundScore: 0, artistCorrect: false, guesses: [], attempts: 0 })) } })
    return null
  },
})
export const expireRound = internalMutation({
  args: { roomId: v.id("rooms"), roundId: v.string() }, returns: v.null(),
  handler: async (ctx, a) => {
    const room = await ctx.db.get("rooms", a.roomId)
    const game = room?.partyGame
    if (game && game.roundId === a.roundId && game.phase === "playing" && Date.now() >= game.deadline) await ctx.db.patch(a.roomId, { partyGame: revealed(game) })
    return null
  },
})
