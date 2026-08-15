import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAnonymousUserId, saveAnonymousUserId } from "@/lib/anonymous-user"
import { api } from "../../../convex/_generated/api"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useNavigate } from "react-router"

export default function Home() {
  const navigate = useNavigate()
  const createRoom = useMutation(api.rooms.create)
  const [roomCode, setRoomCode] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreateRoom() {
    setIsCreating(true)
    setError(null)

    try {
      const result = await createRoom({
        anonymousUserId: getAnonymousUserId(),
      })
      saveAnonymousUserId(result.anonymousUserId)
      navigate(`/choose/${result.room.roomCode}`)
    } catch {
      setError("Unable to create a room. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  function handleJoinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedRoomCode = roomCode.trim().toUpperCase()

    if (!normalizedRoomCode) {
      setError("Enter a room code to join.")
      return
    }

    navigate(`/choose/${normalizedRoomCode}`)
  }

  return (
    <main className="flex flex-col items-center gap-5">
      <h1 className="text-2xl">
        KARPPA.PARTY
      </h1>
      <Button onClick={handleCreateRoom} disabled={isCreating}>
        {isCreating ? "Creating room…" : "Create Room"}
      </Button>

      <form className="flex flex-col gap-3" onSubmit={handleJoinRoom}>
        <Input
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value)}
          placeholder="Enter room code"
          aria-label="Room code"
        />
        <Button type="submit">
          Join Room
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </main>
  )
}
