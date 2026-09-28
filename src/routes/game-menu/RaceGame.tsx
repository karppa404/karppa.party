import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery } from "convex/react"
import { Music2, Trophy, Headphones } from "lucide-react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RoomArgs } from "./GameRoom"
export default function RaceGame(args: RoomArgs) {
  const state = useQuery(api.games.state, args)
  if (!state?.game) return <p>Loading round…</p>
  return <Round key={state.game.roundId} {...args} state={state} />
}
type State = NonNullable<ReturnType<typeof useQuery<typeof api.games.state>>>
function Round({ state, ...args }: RoomArgs & { state: State }) {
  const game = state.game!
  const begin = useMutation(api.games.beginRound), next = useMutation(api.games.next), guess = useMutation(api.games.guess), start = useMutation(api.games.start)
  const [now, setNow] = useState(Date.now()), [text, setText] = useState(""), [artist, setArtist] = useState("")
  const [error, setError] = useState(""), [busy, setBusy] = useState(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  const me = game.players.find(p => p.isMe), songle = game.mode === "songle"
  const seconds = Math.min(songle ? 60 : 120, Math.max(0, Math.ceil((game.deadline - now) / 1000)))
  const active = game.phase === "playing" && seconds > 0 && !!me && !me.finished
  const podium = [...game.players].sort((a, b) => b.score - a.score)
  const winners = podium.filter(p => p.score === podium[0]?.score && p.score > 0)
  const roundArgs = { ...args, roundId: game.roundId }
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn() } catch (e) { setError(e instanceof Error ? e.message : "Try again.") } finally { setBusy(false) } }
  function submit(e: FormEvent) { e.preventDefault(); act(async () => { await guess({ ...roundArgs, text, ...(songle ? { artist } : {}) }); setText("") }) }
  return <section className="race-game space-y-5">
    <div className="round-heading"><span className="eyebrow">{songle ? "SONGLE" : "WORDLE"} <span className="party-muted">/ ROUND {game.round + 1} OF 5</span></span><span className="timer" role="timer">{game.phase === "playing" ? `${seconds}s` : game.phase === "ready" ? "GET READY" : "FINISHED"}</span></div>
    {game.phase === "results" ? <div className="result-banner"><Trophy size={42} /><p className="eyebrow">THAT’S A WRAP</p><h2 className="party-title">{winners.length ? `${winners.map(p => p.name).join(" & ")} ${winners.length === 1 ? "wins!" : "win!"}` : "A tough crowd!"}</h2><p className="party-muted">{state.isHost ? "Same friends. Fresh competition. Play again?" : "Stay in the room for the next game."}</p></div> : <div><h2 className="party-title">{songle ? "Name that song." : "Find your five."}</h2><p className="party-muted">{songle ? "The sooner you know, the more you score." : "One word. Six guesses. Beat your friends to it."}</p></div>}
    {songle && state.isHost && game.phase !== "results" && <div className="space-y-3"><iframe className="youtube-player" title="Songle host music player" src={`https://www.youtube.com/embed/${game.videoId}?playsinline=1&start=${game.videoStart}&rel=0`} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /><p className="party-muted text-sm">DJ: tap play, wait through any ads, then start the round when the music is audible. Keep your screen facing away from players.</p><a className="text-sm underline" href={`https://www.youtube.com/watch?v=${game.videoId}&t=${game.videoStart}s`} target="_blank" rel="noreferrer">Player unavailable? Open on YouTube</a></div>}
    {songle && !state.isHost && <div className="listening-card"><div className="record"><Music2 size={35} /></div><div><Headphones size={18} /><strong>{game.phase === "ready" ? "The DJ is cueing it up…" : "Listen to the host’s speakers"}</strong><span>1st correct: 1,000 pts · artist: +250</span></div></div>}
    {game.phase === "ready" && <div className="waiting-note">{state.isHost ? <><p>{songle ? "Music playing? Open guessing for everyone." : "Ready for a two-minute word race?"}</p><Button className="party-button mt-3 w-full" disabled={busy} onClick={() => act(() => begin(roundArgs))}>Start round {game.round + 1}</Button></> : "Waiting for the host to start the round…"}</div>}
    {!me && !(songle && state.isHost) && <p className="waiting-note">You’re spectating this game. You’ll join the next one.</p>}
    {!songle && me && game.phase !== "results" && <div className="word-board" aria-label="Your Wordle guesses">{Array.from({ length: 6 }, (_, row) => <div className="word-row" key={row}>{Array.from({ length: 5 }, (_, col) => { const guess = game.guesses[row]; const letter = guess?.word[col] ?? (row === game.guesses.length ? text[col] : ""); return <span key={col} className={`word-tile ${guess?.marks[col] ?? ""}`} aria-label={letter ? `${letter}: ${guess?.marks[col] ?? "not submitted"}` : "empty"}>{letter}</span> })}</div>)}</div>}
    {me && game.phase === "playing" && <form className="space-y-3" onSubmit={submit}>
      {active && <>{(!songle || !me.solved) && <label className="block text-sm font-semibold">{songle ? "Song title" : "Your guess"}<Input className="mt-2" aria-label={songle ? "Song title" : "Your guess"} value={text} onChange={e => setText(songle ? e.target.value : e.target.value.replace(/[^a-z]/gi, "").toLowerCase())} placeholder={songle ? "I know this one…" : "Five-letter word"} maxLength={songle ? 120 : 5} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>}
      {songle && !me.artistCorrect && <label className="block text-sm font-semibold">Artist <span className="party-muted">+250 bonus</span><Input className="mt-2" aria-label="Artist" value={artist} onChange={e => setArtist(e.target.value)} placeholder="Who’s singing?" maxLength={120} autoComplete="off" /></label>}
      <Button type="submit" className="party-button w-full" disabled={busy || (!songle && text.length !== 5)}>{busy ? "Checking…" : songle ? "Send my guess" : "Lock in guess"}</Button></>}
      <p aria-live="polite" className="text-sm">{me.finished ? `Round complete! +${me.roundScore} points. Waiting for the others…` : seconds === 0 ? "Time’s up. Revealing…" : songle ? game.lastGuess : `${game.guesses.length} / 6 guesses used`}</p>
    </form>}
    {game.solution && <div className="answer-reveal"><span className="eyebrow">THE ANSWER</span><strong>{game.solution}</strong>{me && <span>+{me.roundScore} points this round</span>}</div>}
    {state.isHost && game.phase === "reveal" && <Button className="party-button w-full" disabled={busy} onClick={() => act(() => next(roundArgs))}>Next round</Button>}
    {state.isHost && game.phase === "results" && <Button className="party-button w-full" disabled={busy} onClick={() => act(() => start(args))}>Play again</Button>}
    <div className="scoreboard"><div className="round-heading"><h3 className="eyebrow">LEADERBOARD</h3><span className="party-muted text-xs">FASTEST GETS THE MOST</span></div>{podium.map((p, i) => <div className="score-row" key={p.name + i}><span className="score-rank">{i + 1}</span><span className="grow">{p.name}{p.isMe && <small> YOU</small>}<span className="score-status">{p.solved ? "Solved ✓" : p.finished ? "Out of guesses" : "In the race"}</span></span><strong>{p.score.toLocaleString()}</strong></div>)}</div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
  </section>
}
