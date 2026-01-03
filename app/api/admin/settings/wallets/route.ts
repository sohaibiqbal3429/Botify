import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { getWalletSettingsForAdmin } from "@/lib/services/app-settings"

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

async function requireAdminUser(request: NextRequest) {
  const session = getUserFromRequest(request)
  if (!session) {
    return null
  }

  await dbConnect()
  const user = await User.findById(session.userId).select({ role: 1, name: 1, email: 1 })

  if (!user || user.role !== "admin") {
    return null
  }

  return user
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) {
      return unauthorizedResponse()
    }

    const wallets = await getWalletSettingsForAdmin()
    return NextResponse.json({ wallets })
  } catch (error) {
    console.error("Failed to load wallet settings", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: "Editing wallet addresses has been disabled. Wallets are managed via environment variables." },
    { status: 405 },
  )
}
