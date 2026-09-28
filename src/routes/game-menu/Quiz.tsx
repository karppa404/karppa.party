import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"

const colors = ["bg-rose-600", "bg-blue-600", "bg-amber-600", "bg-emerald-600"]
const shapes = ["▲", "◆", "●", "■"]
export default function Quiz({ roomId, anonymousUserId }: { roomId: Id<"rooms">; anonymousUserId: Id<"anonymousUsers"> }) {
  const args = { roomId, anonymousUserId }
  const state = useQuery(api.quiz.state, args)
  const start = useMutation(api.quiz.start)
  const answer = useMutation(api.quiz.answer)
  const advance = useMutation(api.quiz.advance)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await action() } catch (e) { setError(e instanceof Error ? e.message.replace(/\[CONVEX[^\]]*\]\s*/, "") : "Something went wrong. Try again.") }
    finally { setBusy(false) }
  }
  if (!state) return <p>Loading game…</p>
  const { game, question, isHost } = state
  const me = game?.players.find(p => p.isMe)
  const seconds = game ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : 0
  const canAnswer = game && !game.revealed && seconds > 0 && me && (game.phase === "sudden" ? me.status === "risk" : game.phase !== "results" && me.status === "alive")
  const winners = game?.players.filter(p => p.winner) ?? []
  return <section className="w-full space-y-6 rounded-3xl border bg-card p-5 text-left shadow-sm sm:p-8">
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-muted-foreground">Pop Trivia</p>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{isHost ? "Host + player" : "Player"}</span>
    </div>
    {!game ? <>
      <h2 className="text-3xl font-black">A little trivia.<br />A lot at stake.</h2>
      <p className="text-muted-foreground">10 questions max. Get one wrong (or miss it) and face sudden death. Answer that correctly to survive; otherwise, watch from the sidelines.</p>
      <p className="text-sm text-muted-foreground">The last survivors face a final: fastest correct answer wins. No correct answers means no winner. New arrivals spectate until the next game.</p>
      <div className="rounded-xl bg-secondary p-4"><strong>{state.members.length} in the lobby</strong><p className="mt-2 text-sm">{state.members.join(" · ")}</p></div>
      {isHost ? <Button className="w-full" disabled={busy} onClick={() => act(() => start(args))}>Start mock quiz</Button> : <p>Waiting for the host to start…</p>}
    </> : game.phase === "results" ? <>
      <p className="text-5xl" aria-hidden="true">{winners.length ? "🏆" : "👻"}</p>
      <h2 className="text-3xl font-black">{winners.length ? `${winners.map(p => p.name).join(" & ")} ${winners.length === 1 ? "wins!" : "win!"}` : "Nobody survived."}</h2>
      <p className="text-muted-foreground">{isHost ? "One more game? Everyone currently in the room gets a fresh start, including spectators." : "Waiting for the host. Stay here to play the next game."}</p>
      {isHost && <Button className="w-full" disabled={busy} onClick={() => act(() => start(args))}>Play again</Button>}
    </> : <>
      <div className="flex items-center justify-between">
        <span className="font-bold">{game.phase === "sudden" ? "⚡ Sudden death" : game.phase === "final" ? "💀 Final sudden death" : `Question ${game.questionIndex + 1} / 10`}</span>
        <span className="rounded-full bg-secondary px-4 py-2 font-mono font-bold" role="timer" aria-label={`${seconds} seconds remaining`}>{game.revealed ? "Reveal" : `${seconds}s`}</span>
      </div>
      <h2 className="text-2xl font-extrabold sm:text-3xl">{question?.prompt}</h2>
      {game.phase === "final" && <p className="text-sm text-muted-foreground">Fastest correct answer survives. Exact ties share the win.</p>}
      {!me ? <p role="status">You’re spectating. You can play when the host starts the next game.</p> : me.status === "out" ? <p role="status">You’re out, but the show goes on. Stay for the next game!</p> : game.phase === "sudden" && me.status === "alive" && !game.revealed ? <p>You’re safe. Watch the others fight to survive.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {question?.options.map((option, i) => <button key={i}
          className={`${colors[i]} min-h-24 rounded-xl p-4 text-left font-bold text-white transition enabled:hover:brightness-110 disabled:cursor-default ${state.myAnswer === i ? "ring-4 ring-foreground ring-offset-2 ring-offset-background" : ""} ${game.revealed && question.correct !== i ? "opacity-45" : ""}`}
          disabled={!canAnswer || state.myAnswer !== null || busy}
          onClick={() => act(() => answer({ ...args, roundId: game.roundId, choice: i }))}>
          <span className="mr-3" aria-hidden="true">{shapes[i]}</span>{option}{game.revealed && question.correct === i ? " ✓ Correct" : ""}
        </button>)}
      </div>
      <p className="text-sm" aria-live="polite">{game.revealed ? me?.status === "risk" ? "Wrong answer. Sudden death is next!" : me?.status === "alive" ? "You survived!" : "Round complete." : state.myAnswer !== null ? "Answer locked in. Waiting for the reveal…" : seconds === 0 ? "Time’s up. Revealing answers…" : canAnswer ? "Pick one. Your first answer is final." : "Enjoy the show."}</p>
      {isHost && game.revealed && <Button className="w-full" disabled={busy} onClick={() => act(() => advance({ ...args, roundId: game.roundId, revealed: game.revealed }))}>Next round</Button>}
    </>}
    {game && <div className="border-t pt-4">
      <h3 className="mb-3 text-sm font-semibold">The cast</h3>
      <ul className="space-y-2">{game.players.map((p, i) => <li key={i} className="flex items-center justify-between gap-3 text-sm">
        <span>{p.name}{p.isMe ? " (you)" : ""}</span><span className="text-muted-foreground">{p.score.toLocaleString()} · {p.winner ? "Winner" : p.status === "out" ? "Spectating" : p.status === "risk" ? "At risk" : "Alive"}</span>
      </li>)}</ul>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
