import { v, type Infer } from "convex/values"

export const modeValidator = v.union(v.literal("trivia"), v.literal("songle"), v.literal("wordle"))
export const markValidator = v.union(v.literal("correct"), v.literal("present"), v.literal("absent"))
export const guessValidator = v.object({ word: v.string(), marks: v.array(markValidator) })
export const racePlayerValidator = v.object({
  userId: v.id("anonymousUsers"), name: v.string(), score: v.number(), roundScore: v.number(),
  solvedAt: v.optional(v.number()), artistCorrect: v.boolean(), guesses: v.array(guessValidator),
  attempts: v.number(), lastGuess: v.optional(v.string()),
})
export const partyValidator = v.object({
  mode: v.union(v.literal("songle"), v.literal("wordle")), roundId: v.string(), round: v.number(),
  phase: v.union(v.literal("ready"), v.literal("playing"), v.literal("reveal"), v.literal("results")),
  startedAt: v.number(), deadline: v.number(), order: v.array(v.number()), players: v.array(racePlayerValidator),
})
export type Party = Infer<typeof partyValidator>
export type Mode = Infer<typeof modeValidator>
export const songs = [
  { videoId: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", artist: "Rick Astley", start: 0 },
  { videoId: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", start: 50 },
  { videoId: "Zi_XLOBDo_Y", title: "Billie Jean", artist: "Michael Jackson", start: 20 },
  { videoId: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", start: 20 },
  { videoId: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi", artistAliases: ["Luis Fonsi and Daddy Yankee", "Luis Fonsi featuring Daddy Yankee", "Luis Fonsi Daddy Yankee"], start: 30 },
]
export const words = "crane flame proud light dream beach smile music party stone apple grape bread cloud dance earth fresh ghost heart magic ocean peach piano plant quiet river sheep shine spice storm sweet tiger train water whale world zebra chair brave lemon maple brush coral lucky night robin candy frost pearl spark".split(" ")
export const duration = (mode: Party["mode"]) => mode === "wordle" ? 120000 : 60000
export function shuffledIndices(length: number) {
  const order = Array.from({ length }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order.slice(0, 5)
}
export function normalize(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") }
export function wordMarks(guess: string, answer: string): Infer<typeof markValidator>[] {
  const marks: Infer<typeof markValidator>[] = Array(5).fill("absent")
  const remaining = answer.split("")
  for (let i = 0; i < 5; i++) if (guess[i] === answer[i]) { marks[i] = "correct"; remaining[i] = "" }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === "correct") continue
    const index = remaining.indexOf(guess[i]!)
    if (index !== -1) { marks[i] = "present"; remaining[index] = "" }
  }
  return marks
}
// First solve gets 1000, then each place loses 100; every solve earns at least 100.
export function solvePoints(game: Party) { return Math.max(100, 1000 - game.players.filter(p => p.solvedAt !== undefined).length * 100) }
export function isFinished(game: Party, player: Party["players"][number]) {
  return game.mode === "wordle" ? player.solvedAt !== undefined || player.guesses.length === 6 : player.solvedAt !== undefined && player.artistCorrect
}
export function revealed(game: Party): Party { return { ...game, phase: game.round === 4 ? "results" : "reveal" } }
