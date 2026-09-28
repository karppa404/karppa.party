import ModePicker from "./ModePicker"
import type { Mode } from "../../../convex/partyModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAnonymousUserId, saveAnonymousUserId } from "@/lib/anonymous-user"
import { api } from "../../../convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router"

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("songle")
  const selectMode = useMutation(api.games.selectMode)
  const createRoom = useMutation(api.rooms.create)
  const currentRoom = useQuery(api.rooms.getCurrentRoom, {
    anonymousUserId: getAnonymousUserId(),
  })
  const [roomCode, setRoomCode] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentRoom) {
      navigate(`/choose/${currentRoom.room.roomCode}`, { replace: true })
    }
  }, [currentRoom, navigate])

  async function handleCreateRoom() {
    setIsCreating(true)
    setError(null)

    try {
      const result = await createRoom({
        anonymousUserId: getAnonymousUserId(),
      })
      saveAnonymousUserId(result.anonymousUserId)
      await selectMode({ roomId: result.room.roomId, anonymousUserId: result.anonymousUserId, mode })
      navigate(`/choose/${result.room.roomCode}`)
    } catch {
      setError("Unable to create a room. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedRoomCode = roomCode.trim().toUpperCase()

    if (!normalizedRoomCode) {
      setError("Enter a room code to join.")
      return
    }

    navigate(`/choose/${normalizedRoomCode}`)
  }

  return (
    <main className="home-page w-full space-y-6 px-5 py-9">
      <div className="brand-line"><span className="brand-mark">k.</span><span>KARPPA.PARTY</span><span className="live-pill">LET’S PLAY</span></div>
      <div><p className="eyebrow mb-3">GOOD FRIENDS. FRIENDLY RIVALRIES.</p><h1 className="home-title">Your people.<br />Your <span>party.</span></h1><p className="party-muted mt-3">One room. Three ways to steal the show.</p></div>
      <ModePicker value={mode} onChange={setMode} disabled={isCreating} />
      <Button className="party-button w-full" onClick={handleCreateRoom} disabled={isCreating}>{isCreating ? "Creating room…" : "Create a room →"}</Button>
      <form className="join-form" onSubmit={handleJoinRoom}>
        <label htmlFor="room-code" className="eyebrow">ALREADY INVITED?</label><div className="flex gap-2 mt-2"><Input id="room-code" value={roomCode} onChange={event => setRoomCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" aria-label="Room code" maxLength={6} autoComplete="off" /><Button type="submit" variant="outline">Join room</Button></div>
      </form>
      <p className="party-muted text-center text-xs">No downloads. Just a room code and your best guess.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </main>
  )
}
