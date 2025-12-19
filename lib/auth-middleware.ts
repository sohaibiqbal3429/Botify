import type { NextRequest } from "next/server"

export interface MiddlewareJWTPayload {
  userId: string
  email: string
  role: string
}

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"
const SESSION_COOKIE_NAMES = [
  "auth-token", // legacy custom JWT cookie
  "next-auth.session-token", // NextAuth (http)
  "__Secure-next-auth.session-token", // NextAuth (https)
  "__Host-next-auth.session-token", // NextAuth (host-only https)
]

type SupportedAlg = "HS256" | "HS512"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const keyCache: Partial<Record<SupportedAlg, CryptoKey>> = {}

function base64UrlToUint8Array(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = base64.length % 4
  if (padding === 2) {
    base64 += "=="
  } else if (padding === 3) {
    base64 += "="
  } else if (padding === 1) {
    base64 += "==="
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const bytes = base64UrlToUint8Array(segment)
    const json = decoder.decode(bytes)
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch (error) {
    console.warn("[auth] Failed to decode JWT segment", error)
  }
  return null
}

async function getSigningKey(alg: SupportedAlg): Promise<CryptoKey> {
  if (keyCache[alg]) {
    return keyCache[alg]!
  }

  const key = await crypto.subtle.importKey("raw", encoder.encode(JWT_SECRET), {
    name: "HMAC",
    hash: alg === "HS512" ? "SHA-512" : "SHA-256",
  }, false, ["sign", "verify"])

  keyCache[alg] = key
  return key
}

async function verifySignature(data: string, signatureSegment: string, alg: SupportedAlg): Promise<boolean> {
  try {
    const key = await getSigningKey(alg)
    const signature = base64UrlToUint8Array(signatureSegment)
    return crypto.subtle.verify("HMAC", key, signature, encoder.encode(data))
  } catch (error) {
    console.warn(`[auth] Failed to verify JWT signature (${alg})`, error)
    return false
  }
}

async function verifyToken(token: string): Promise<MiddlewareJWTPayload | null> {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts
  const header = decodeJsonSegment(headerSegment)
  const payload = decodeJsonSegment(payloadSegment)
  if (!payload) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === "number" ? payload.exp : undefined
  const nbf = typeof payload.nbf === "number" ? payload.nbf : undefined

  if ((exp && now >= exp) || (nbf && now < nbf)) {
    return null
  }

  const algorithmsToTry: SupportedAlg[] = []
  const headerAlg = typeof header?.alg === "string" ? header.alg : undefined
  if (headerAlg === "HS512" || headerAlg === "HS256") {
    algorithmsToTry.push(headerAlg)
  } else {
    algorithmsToTry.push("HS256", "HS512")
  }

  const data = `${headerSegment}.${payloadSegment}`
  let valid = false
  for (const alg of algorithmsToTry) {
    const verified = await verifySignature(data, signatureSegment, alg)
    if (verified) {
      valid = true
      break
    }
  }

  if (!valid) {
    return null
  }

  const userId = payload.userId ?? payload.sub ?? payload.id
  const email = payload.email ?? (payload as any)?.user?.email
  const role = payload.role ?? (payload as any)?.user?.role ?? "user"

  if (typeof userId === "string" && typeof email === "string" && typeof role === "string") {
    return { userId, email, role }
  }

  return null
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

export async function getUserFromRequest(request: NextRequest): Promise<MiddlewareJWTPayload | null> {
  const token = getTokenFromRequest(request)
  if (!token) {
    return null
  }

  return verifyToken(token)
}
