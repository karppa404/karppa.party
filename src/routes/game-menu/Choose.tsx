import { Button } from "@/components/ui/button"
import { getAnonymousUserId, saveAnonymousUserId } from "@/lib/anonymous-user"
import { api } from "../../../convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { Link, useParams } from "react-router"

export default function Choose() {
  const { roomCode = "" } = useParams()
  const normalizedRoomCode = roomCode.trim().toUpperCase()
  const room = useQuery(api.rooms.getByCode, { roomCode: normalizedRoomCode })
  const joinRoom = useMutation(api.rooms.join)
  const [isJoining, setIsJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoinRoom() {
    setIsJoining(true)
    setError(null)

    try {
      const result = await joinRoom({
        roomCode: normalizedRoomCode,
        anonymousUserId: getAnonymousUserId(),
      })

      if (!result) {
        setError("This room doesn't exist.")
        return
      }

      saveAnonymousUserId(result.anonymousUserId)
      setJoined(true)
    } catch {
      setError("Unable to join this room. Please try again.")
    } finally {
      setIsJoining(false)
    }
  }

  if (room === undefined) {
    return <main className="text-center">Looking for room…</main>
  }

  if (room === null) {
    return (
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl">Room not found</h1>
        <p>This room doesn't exist.</p>
        <Link to="/">Return home</Link>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">Room code</p>
      <h1 className="text-3xl font-semibold tracking-widest">{room.roomCode}</h1>
      <p>{room.name}</p>
      <Button onClick={handleJoinRoom} disabled={isJoining || joined}>
        {joined ? "Joined" : isJoining ? "Joining…" : "Join Room"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </main>
  )
}
