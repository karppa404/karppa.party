import type { Id } from "../../convex/_generated/dataModel"

const COOKIE_NAME = "karppa_anonymous_user_id"

export function getAnonymousUserId(): Id<"anonymousUsers"> | undefined {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))

  if (!cookie) {
    return undefined
  }

  return decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) as Id<"anonymousUsers">
}

export function saveAnonymousUserId(userId: Id<"anonymousUsers">) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(userId)}; Path=/; Max-Age=31536000; SameSite=Lax`
}
