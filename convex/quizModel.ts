import { v, type Infer } from "convex/values"

export const phaseValidator = v.union(v.literal("question"), v.literal("sudden"), v.literal("final"), v.literal("results"))
export const playerValidator = v.object({
  userId: v.id("anonymousUsers"), name: v.string(),
  status: v.union(v.literal("alive"), v.literal("risk"), v.literal("out")),
  score: v.number(), answer: v.optional(v.number()), answeredAt: v.optional(v.number()),
})
// A bounded roster (100 max), replaced for each game; no history or plugin framework.
export const gameValidator = v.object({
  roundId: v.string(), phase: phaseValidator, questionIndex: v.number(),
  revealed: v.boolean(), deadline: v.number(), players: v.array(playerValidator),
  winners: v.array(v.id("anonymousUsers")),
})
export type Game = Infer<typeof gameValidator>

// Add a discriminated question variant here when its first playable mode exists.
export type Question = { kind: "multipleChoice"; prompt: string; options: string[]; correct: number }
const q = (prompt: string, options: string[], correct: number): Question => ({ kind: "multipleChoice", prompt, options, correct })
export const questions: Question[] = [
  q("Which planet has the most famous rings?", ["Mars", "Venus", "Saturn", "Mercury"], 2),
  q("How many sides does a hexagon have?", ["5", "6", "7", "8"], 1),
  q("What is the largest ocean on Earth?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3),
  q("Which animal has three hearts?", ["Octopus", "Dolphin", "Shark", "Penguin"], 0),
  q("What does the 'www' in a web address stand for?", ["World Web Wire", "World Wide Web", "Wide World Window", "Web Work World"], 1),
  q("Which of these is a prime number?", ["21", "27", "29", "33"], 2),
  q("In chess, which piece moves in an L shape?", ["Bishop", "Rook", "Queen", "Knight"], 3),
  q("What is the chemical symbol for gold?", ["Au", "Ag", "Go", "Gd"], 0),
  q("Which instrument usually has 88 keys?", ["Violin", "Trumpet", "Piano", "Flute"], 2),
  q("Which fictional detective lives at 221B Baker Street?", ["Poirot", "Sherlock Holmes", "Nancy Drew", "Inspector Gadget"], 1),
]
const survival: Question[] = [
  q("SURVIVE: How many minutes are in two hours?", ["60", "90", "120", "180"], 2),
  q("SURVIVE: Which number is even?", ["13", "17", "22", "31"], 2),
  q("SURVIVE: Which is a mammal?", ["Frog", "Whale", "Lizard", "Trout"], 1),
  q("SURVIVE: Which direction is opposite north?", ["East", "West", "South", "Up"], 2),
  q("SURVIVE: What is 9 × 7?", ["56", "63", "72", "81"], 1),
  q("SURVIVE: Which month comes after April?", ["March", "June", "July", "May"], 3),
  q("SURVIVE: How many wheels does a tricycle have?", ["2", "3", "4", "6"], 1),
  q("SURVIVE: Which is a primary color of light?", ["Brown", "Orange", "Red", "Pink"], 2),
  q("SURVIVE: What is frozen water called?", ["Steam", "Ice", "Fog", "Rain"], 1),
  q("SURVIVE: Which shape has no corners?", ["Square", "Triangle", "Rectangle", "Circle"], 3),
]
const finalQuestion = q("FINAL: What is 17 × 6 − 9?", ["93", "102", "87", "99"], 0)
export function currentQuestion(game: Game): Question {
  return game.phase === "final" || game.phase === "results" ? finalQuestion :
    game.phase === "sudden" ? survival[game.questionIndex]! : questions[game.questionIndex]!
}
export function eligible(game: Game, player: Game["players"][number]) {
  return game.phase === "sudden" ? player.status === "risk" : game.phase !== "results" && player.status === "alive"
}
export function reveal(game: Game): Game {
  const correct = currentQuestion(game).correct
  const players = game.players.map(player => {
    if (!eligible(game, player)) return player
    const right = player.answer === correct
    return { ...player, score: player.score + (right ? 1000 : 0),
      status: (right ? "alive" : game.phase === "question" ? "risk" : "out") as typeof player.status }
  })
  if (game.phase === "final") {
    const survivors = players.filter(p => p.status === "alive")
    const fastest = Math.min(...survivors.map(p => p.answeredAt!))
    return { ...game, players, revealed: true, phase: "results", winners: survivors.filter(p => p.answeredAt === fastest).map(p => p.userId) }
  }
  return { ...game, players, revealed: true }
}
export function nextRound(game: Game, now: number, roundId: string): Game {
  const alive = game.players.filter(p => p.status !== "out")
  if (!alive.length) return { ...game, phase: "results", winners: [] }
  const phase = game.phase === "question" && game.players.some(p => p.status === "risk") ? "sudden" :
    game.questionIndex >= questions.length - 1 || alive.length === 1 ? "final" : "question"
  return { ...game, phase, roundId, revealed: false, deadline: now + 20000,
    questionIndex: phase === "question" ? game.questionIndex + 1 : game.questionIndex,
    players: game.players.map(({ answer: _answer, answeredAt: _at, ...p }) => p) }
}
