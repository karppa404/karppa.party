import GameRoom from "./GameRoom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAnonymousUserId, saveAnonymousUserId } from "@/lib/anonymous-user"
import { api } from "../../../convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"

export default function Choose() {
  const { roomCode = "" } = useParams()
  const normalizedRoomCode = roomCode.trim().toUpperCase()
  const navigate = useNavigate()
  const room = useQuery(api.rooms.getByCode, { roomCode: normalizedRoomCode })
  const currentRoom = useQuery(api.rooms.getCurrentRoom, {
    anonymousUserId: getAnonymousUserId(),
  })
  const joinRoom = useMutation(api.rooms.join)
  const leaveRoom = useMutation(api.rooms.leave)
  const [customName, setCustomName] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoinRoom() {
    setIsJoining(true)
    setError(null)

    try {
      const trimmedCustomName = customName.trim()
      const result = await joinRoom({
        roomCode: normalizedRoomCode,
        anonymousUserId: getAnonymousUserId(),
        ...(trimmedCustomName ? { customName: trimmedCustomName } : {}),
      })

      if (!result) {
        setError("This room doesn't exist.")
        return
      }

      saveAnonymousUserId(result.anonymousUserId)
    } catch {
      setError("Unable to join this room. Please try again.")
    } finally {
      setIsJoining(false)
    }
  }

  async function handleLeaveRoom() {
    setIsLeaving(true)
    setError(null)

    try {
      await leaveRoom({
        roomCode: normalizedRoomCode,
        anonymousUserId: getAnonymousUserId(),
      })
      navigate("/", { replace: true })
    } catch {
      setError("Unable to leave this room. Please try again.")
    } finally {
      setIsLeaving(false)
    }
  }

  if (room === undefined) {
    return <main className="text-center">Looking for room…</main>
  }

  if (room === null) {
    return (
      <main className="flex w-full flex-col items-center gap-4 px-4 py-8 text-center">
        <h1 className="text-2xl">Room not found</h1>
        <p>This room doesn't exist.</p>
        <Link to="/">Return home</Link>
      </main>
    )
  }

  const isCurrentRoom = currentRoom?.room.roomCode === room.roomCode

  return (
    <main className="flex w-full flex-col items-center gap-4 px-4 py-8 text-center">
      <p className="eyebrow">KARPPA.PARTY · ROOM CODE</p>
      <h1 className="text-3xl font-semibold tracking-widest">{room.roomCode}</h1>

      {isCurrentRoom ? (
        <>
          <p className="text-sm text-muted-foreground">
            Joined as {currentRoom.customName ?? "Anonymous"}
          </p>
          <GameRoom roomId={room.roomId} anonymousUserId={getAnonymousUserId()!} />
          <Button variant="outline" onClick={handleLeaveRoom} disabled={isLeaving}>
            {isLeaving ? "Leaving…" : "Leave Room"}
          </Button>
        </>
      ) : (
        <>
          <Input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Your name (optional)"
            aria-label="Your name"
            maxLength={40}
          />
          <Button onClick={handleJoinRoom} disabled={isJoining}>
            {isJoining ? "Joining…" : "Join Room"}
          </Button>
        </>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </main>
  )
}
