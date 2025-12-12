import mongoose from "mongoose"

import { connectMongo } from "./db"
import { initializeInMemoryDatabase } from "./in-memory"

type MongooseCache = {
  conn: any
  promise: Promise<typeof mongoose> | null
}

type GlobalWithMongoose = typeof globalThis & {
  mongoose?: MongooseCache
  __inMemoryDbInitialized?: boolean
}

const globalWithMongoose = globalThis as GlobalWithMongoose

const cached: MongooseCache = globalWithMongoose.mongoose || { conn: null, promise: null }
if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = cached
}

export default async function dbConnect() {
  const hasUri = Boolean(process.env.MONGODB_URI)
  const seedInMemory = process.env.SEED_IN_MEMORY === "true"
  const allowFallback = process.env.NODE_ENV !== "production" || process.env.ALLOW_DB_FALLBACK === "true"

  // Explicit demo mode: always use the seeded in-memory DB
  if (seedInMemory) {
    if (!globalWithMongoose.__inMemoryDbInitialized) {
      await initializeInMemoryDatabase()
      globalWithMongoose.__inMemoryDbInitialized = true
      console.warn("[database] Running in demo mode with an in-memory data set because SEED_IN_MEMORY=true.")
    }

    if (!cached.conn) {
      cached.conn = { inMemory: true }
    }

    return cached.conn
  }

  // No Mongo URI provided: either fail or fall back to in-memory (only when explicitly allowed)
  if (!hasUri) {
    if (!allowFallback) {
      throw new Error("Add MONGODB_URI to .env.local (or set SEED_IN_MEMORY=true for demo mode)")
    }

    if (!globalWithMongoose.__inMemoryDbInitialized) {
      await initializeInMemoryDatabase()
      globalWithMongoose.__inMemoryDbInitialized = true
      console.warn("[database] MONGODB_URI missing. Using in-memory store for this session.")
    }
    cached.conn = cached.conn || { inMemory: true }
    return cached.conn
  }

  if (cached.conn) return cached.conn

  try {
    await connectMongo()
    cached.conn = mongoose.connection
    return cached.conn
  } catch (error) {
    cached.promise = null

    if (allowFallback) {
      console.error("[database] Failed to connect to MongoDB. Falling back to in-memory store.", error)
      await initializeInMemoryDatabase()
      globalWithMongoose.__inMemoryDbInitialized = true
      cached.conn = { inMemory: true }
      return cached.conn
    }

    throw error
  }
}
