import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import ModePicker from "./ModePicker"
import Quiz from "./Quiz"
import RaceGame from "./RaceGame"
import { Button } from "@/components/ui/button"
export type RoomArgs = { roomId: Id<"rooms">; anonymousUserId: Id<"anonymousUsers"> }
export default function GameRoom(args: RoomArgs) {
  const state = useQuery(api.games.state, args)
  const selectMode = useMutation(api.games.selectMode)
  const start = useMutation(api.games.start)
  const startTrivia = useMutation(api.quiz.start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn() } catch (e) { setError(e instanceof Error ? e.message : "Try again.") } finally { setBusy(false) } }
  if (!state) return <p>Getting the party ready…</p>
  const started = state.mode === "trivia" ? state.triviaStarted : !!state.game
  const ended = state.mode === "trivia" ? state.triviaEnded : state.game?.phase === "results"
  return <div className="w-full space-y-5 text-left">
    {!started ? <>
      <div><p className="eyebrow">THE LOBBY</p><h2 className="party-title">Pick your party.</h2><p className="party-muted">{state.isHost ? "Choose a game. Your friends bring the competition." : "The host is choosing your next game."}</p></div>
      <ModePicker value={state.mode} disabled={!state.isHost || busy} onChange={mode => act(() => selectMode({ ...args, mode }))} />
      <div className="lobby-roster"><span className="eyebrow">{state.members.length} IN THE ROOM</span><div className="player-chips">{state.members.map((name, i) => <span key={i}>{name}</span>)}</div></div>
      <p className="party-muted text-sm">{state.mode === "songle" ? "Host the music on one device with shared speakers. The host is the DJ; everyone else guesses. 60 seconds per song." : state.mode === "wordle" ? "Same word, separate guesses. Six tries and two minutes per round. First solve earns 1,000 points." : "Wrong answers send you to sudden death. Survive to reach the final."}</p>
      {state.isHost ? <Button className="party-button w-full" disabled={busy || (state.mode === "songle" && state.members.length < 2)} onClick={() => act(() => state.mode === "trivia" ? startTrivia(args) : start(args))}>{state.mode === "songle" && state.members.length < 2 ? "Waiting for a player…" : `Let’s play ${({ songle: "Songle", wordle: "Wordle", trivia: "Pop Trivia" })[state.mode]}`}</Button> : <p className="waiting-note">Waiting for the host to start…</p>}
    </> : state.mode === "trivia" ? <Quiz {...args} /> : <RaceGame {...args} />}
    {ended && state.isHost && <Button className="w-full" variant="outline" disabled={busy} onClick={() => act(() => selectMode({ ...args, mode: state.mode }))}>Choose another game</Button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>
}
