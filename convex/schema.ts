import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { modeValidator, partyValidator } from "./partyModel"
import { gameValidator } from "./quizModel"

export default defineSchema({
  anonymousUsers: defineTable({
    createdAt: v.number(),
    currentRoomId: v.optional(v.union(v.id("rooms"), v.null())),
  }),
  rooms: defineTable({
    code: v.string(),
    name: v.string(),
    createdAt: v.number(),
    createdBy: v.id("anonymousUsers"),
    game: v.optional(gameValidator),
    mode: v.optional(modeValidator),
    partyGame: v.optional(partyValidator),
  })
    .index("by_code", ["code"])
    .index("by_createdBy", ["createdBy"])
    .index("by_createdAt", ["createdAt"]),
  roomMembers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("anonymousUsers"),
    joinedAt: v.number(),
    customName: v.optional(v.string()),
  })
    .index("by_roomId_and_userId", ["roomId", "userId"])
    .index("by_roomId", ["roomId"])
    .index("by_userId", ["userId"]),
})
