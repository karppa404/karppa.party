import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000
const ROOM_BATCH_SIZE = 25
const MEMBER_BATCH_SIZE = 100

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

const currentRoomValidator = v.object({
  room: roomValidator,
  customName: v.union(v.string(), v.null()),
})

function isRoomExpired(createdAt: number) {
  return createdAt <= Date.now() - ROOM_LIFETIME_MS
}

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
      (await ctx.db.insert("anonymousUsers", {
        createdAt: Date.now(),
        currentRoomId: null,
      }))

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
      await ctx.db.patch(anonymousUserId, { currentRoomId: roomId })

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

    if (!room || isRoomExpired(room.createdAt)) {
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

export const getCurrentRoom = query({
  args: { anonymousUserId: v.optional(v.id("anonymousUsers")) },
  returns: v.union(currentRoomValidator, v.null()),
  handler: async (ctx, args) => {
    if (!args.anonymousUserId) {
      return null
    }

    const user = await ctx.db.get("anonymousUsers", args.anonymousUserId)
    if (!user?.currentRoomId) {
      return null
    }

    const room = await ctx.db.get("rooms", user.currentRoomId)
    if (!room || isRoomExpired(room.createdAt)) {
      return null
    }

    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_roomId_and_userId", (q) =>
        q.eq("roomId", room._id).eq("userId", user._id),
      )
      .unique()

    return {
      room: {
        roomId: room._id,
        roomCode: room.code,
        name: room.name,
        createdAt: room.createdAt,
      },
      customName: membership?.customName ?? null,
    }
  },
})

export const join = mutation({
  args: {
    roomCode: v.string(),
    anonymousUserId: v.optional(v.id("anonymousUsers")),
    customName: v.optional(v.string()),
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

    if (!room || isRoomExpired(room.createdAt)) {
      return null
    }

    const existingUser = args.anonymousUserId
      ? await ctx.db.get("anonymousUsers", args.anonymousUserId)
      : null
    const anonymousUserId =
      existingUser?._id ??
      (await ctx.db.insert("anonymousUsers", {
        createdAt: Date.now(),
        currentRoomId: null,
      }))
    const customName = args.customName?.trim()

    if (customName && customName.length > 40) {
      throw new Error("Custom names must be 40 characters or fewer.")
    }

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
        ...(customName ? { customName } : {}),
      })
    } else if (customName) {
      await ctx.db.patch(membership._id, { customName })
    }

    await ctx.db.patch(anonymousUserId, { currentRoomId: room._id })

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

export const leave = mutation({
  args: {
    roomCode: v.string(),
    anonymousUserId: v.optional(v.id("anonymousUsers")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!args.anonymousUserId) {
      return false
    }

    const [user, room] = await Promise.all([
      ctx.db.get("anonymousUsers", args.anonymousUserId),
      ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", args.roomCode))
        .unique(),
    ])

    if (!user || !room) {
      return false
    }

    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_roomId_and_userId", (q) =>
        q.eq("roomId", room._id).eq("userId", user._id),
      )
      .unique()

    if (membership) {
      await ctx.db.delete(membership._id)
    }

    if (user.currentRoomId === room._id) {
      await ctx.db.patch(user._id, { currentRoomId: null })
    }

    return Boolean(membership)
  },
})

export const deleteExpired = internalMutation({
  args: {},
  returns: v.object({
    deletedRooms: v.number(),
    deletedMemberships: v.number(),
    roomsWithRemainingMembers: v.number(),
  }),
  handler: async (ctx) => {
    const expiryTime = Date.now() - ROOM_LIFETIME_MS
    const expiredRooms = await ctx.db
      .query("rooms")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", expiryTime))
      .take(ROOM_BATCH_SIZE)

    let deletedRooms = 0
    let deletedMemberships = 0
    let roomsWithRemainingMembers = 0

    for (const room of expiredRooms) {
      const members = await ctx.db
        .query("roomMembers")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
        .take(MEMBER_BATCH_SIZE + 1)

      for (const member of members.slice(0, MEMBER_BATCH_SIZE)) {
        await ctx.db.delete(member._id)
        deletedMemberships += 1
      }

      if (members.length > MEMBER_BATCH_SIZE) {
        roomsWithRemainingMembers += 1
        continue
      }

      await ctx.db.delete(room._id)
      deletedRooms += 1
    }

    return { deletedRooms, deletedMemberships, roomsWithRemainingMembers }
  },
})
