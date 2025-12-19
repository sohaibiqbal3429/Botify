import "server-only"

import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import type { NextRequest } from "next/server"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"
const SESSION_COOKIE_NAMES = [
  "auth-token", // legacy custom JWT cookie
  "next-auth.session-token", // NextAuth (http)
  "__Secure-next-auth.session-token", // NextAuth (https)
  "__Host-next-auth.session-token", // NextAuth (host-only https)
]

export const TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_MAX_AGE_SECONDS })
}

export function verifyToken(token: string): JWTPayload | null {
  const candidates: JWTPayload[] = []

  // Try HS256 first (legacy), then HS512 (NextAuth default)
  const algorithms: jwt.Algorithm[] = ["HS256", "HS512"]

  for (const algorithm of algorithms) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [algorithm] }) as jwt.JwtPayload
      const normalized = normalizePayload(decoded)
      if (normalized) {
        candidates.push(normalized)
      }
    } catch {
      // continue
    }
  }

  return candidates[0] ?? null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }

  for (const name of SESSION_COOKIE_NAMES) {
    const token = request.cookies.get(name)?.value
    if (token) return token
  }

  return null
}

export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyToken(token)
}

function normalizePayload(payload: jwt.JwtPayload): JWTPayload | null {
  const userId = payload.userId ?? payload.sub ?? payload.id ?? payload.user?.id
  const email = payload.email ?? payload.user?.email
  const role = payload.role ?? payload.user?.role ?? "user"

  if (!userId || !email) {
    return null
  }

  return {
    userId: String(userId),
    email: String(email),
    role: String(role),
  }
}
