import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getCachedJSON } from "@/lib/cache/server-cache"
import { getTasksForUser } from "@/lib/services/tasks"

const TASK_CACHE_SECONDS = Number(process.env.TASK_CACHE_SECONDS ?? 30)

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { value, hitLayer } = await getCachedJSON(`tasks:${userPayload.userId}`, TASK_CACHE_SECONDS, () =>
      getTasksForUser(userPayload.userId),
    )

    return NextResponse.json(
      { tasks: value },
      {
        headers: {
          "Cache-Control": `private, max-age=${TASK_CACHE_SECONDS}, stale-while-revalidate=${TASK_CACHE_SECONDS * 4}`,
          "X-Cache": hitLayer,
        },
      },
    )
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
