import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { serializeUser } from "@/lib/serializers/user"
import { PROFILE_AVATAR_VALUES } from "@/lib/constants/avatars"
import User from "@/models/User"

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  avatar: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || PROFILE_AVATAR_VALUES.includes(value), {
      message: "Select a valid avatar option",
    }),
})

export async function PATCH(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsedBody = profileUpdateSchema.parse(await request.json())

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    user.name = parsedBody.name
    if (parsedBody.avatar) {
      user.profileAvatar = parsedBody.avatar
    }

    await user.save()

    return NextResponse.json({
      message: "Profile updated successfully.",
      user: serializeUser(user),
    })
  } catch (error) {
    console.error("Profile update error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
