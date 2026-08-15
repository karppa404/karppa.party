import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  anonymousUsers: defineTable({
    createdAt: v.number(),
  }),
  rooms: defineTable({
    code: v.string(),
    name: v.string(),
    createdAt: v.number(),
    createdBy: v.id("anonymousUsers"),
  })
    .index("by_code", ["code"])
    .index("by_createdBy", ["createdBy"]),
  roomMembers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("anonymousUsers"),
    joinedAt: v.number(),
  })
    .index("by_roomId_and_userId", ["roomId", "userId"])
    .index("by_userId", ["userId"]),
})
