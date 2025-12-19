import { NextResponse, type NextRequest } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { serializeUser } from "@/lib/serializers/user"
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils/otp"
import User from "@/models/User"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Phone verification is disabled. Email-only login is active." }, { status: 400 })
  } catch (error) {
    console.error("Profile verification error:", error)
    return NextResponse.json({ error: "Failed to verify profile" }, { status: 500 })
  }
}
