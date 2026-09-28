import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.cron("delete expired rooms", "*/15 * * * *", internal.rooms.deleteExpired, {})

export default crons
