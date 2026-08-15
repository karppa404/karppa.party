import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function generateRoomCode() {
  return Array.from(
    { length: 6 },
    () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
  ).join("")
}

const roomValidator = v.object({
  roomId: v.id("rooms"),
  roomCode: v.string(),
  name: v.string(),
  createdAt: v.number(),
})

export const create = mutation({
  args: {
    anonymousUserId: v.optional(v.id("anonymousUsers")),
  },
  returns: v.object({
    room: roomValidator,
    anonymousUserId: v.id("anonymousUsers"),
  }),
  handler: async (ctx, args) => {
    const existingUser = args.anonymousUserId
      ? await ctx.db.get("anonymousUsers", args.anonymousUserId)
      : null
    const anonymousUserId =
      existingUser?._id ??
      (await ctx.db.insert("anonymousUsers", { createdAt: Date.now() }))

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const roomCode = generateRoomCode()
      const existingRoom = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", roomCode))
        .unique()

      if (existingRoom) {
        continue
      }

      const createdAt = Date.now()
      const name = `Room ${roomCode}`
      const roomId = await ctx.db.insert("rooms", {
        code: roomCode,
        name,
        createdAt,
        createdBy: anonymousUserId,
      })

      await ctx.db.insert("roomMembers", {
        roomId,
        userId: anonymousUserId,
        joinedAt: createdAt,
      })

      return {
        room: { roomId, roomCode, name, createdAt },
        anonymousUserId,
      }
    }

    throw new Error("Unable to generate a unique room code. Please try again.")
  },
})

export const getByCode = query({
  args: { roomCode: v.string() },
  returns: v.union(roomValidator, v.null()),
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .unique()

    if (!room) {
      return null
    }

    return {
      roomId: room._id,
      roomCode: room.code,
      name: room.name,
      createdAt: room.createdAt,
    }
  },
})

export const join = mutation({
  args: {
    roomCode: v.string(),
    anonymousUserId: v.optional(v.id("anonymousUsers")),
  },
  returns: v.union(
    v.object({
      room: roomValidator,
      anonymousUserId: v.id("anonymousUsers"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .unique()

    if (!room) {
      return null
    }

    const existingUser = args.anonymousUserId
      ? await ctx.db.get("anonymousUsers", args.anonymousUserId)
      : null
    const anonymousUserId =
      existingUser?._id ??
      (await ctx.db.insert("anonymousUsers", { createdAt: Date.now() }))

    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_roomId_and_userId", (q) =>
        q.eq("roomId", room._id).eq("userId", anonymousUserId),
      )
      .unique()

    if (!membership) {
      await ctx.db.insert("roomMembers", {
        roomId: room._id,
        userId: anonymousUserId,
        joinedAt: Date.now(),
      })
    }

    return {
      room: {
        roomId: room._id,
        roomCode: room.code,
        name: room.name,
        createdAt: room.createdAt,
      },
      anonymousUserId,
    }
  },
})
