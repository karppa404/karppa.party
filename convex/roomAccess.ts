import type { QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
export async function memberRoom(ctx: QueryCtx, roomId: Id<"rooms">, userId: Id<"anonymousUsers">) {
  const room = await ctx.db.get("rooms", roomId)
  const member = await ctx.db.query("roomMembers").withIndex("by_roomId_and_userId", q => q.eq("roomId", roomId).eq("userId", userId)).unique()
  if (!room || !member) throw new Error("Join this room first.")
  return room
}
