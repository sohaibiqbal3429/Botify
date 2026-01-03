// @ts-nocheck
import { type FilterQuery } from "mongoose"

import dbConnect from "@/lib/mongodb"
import AppSettingAudit, { type IAppSettingAudit } from "@/models/AppSettingAudit"

const WALLET_DESCRIPTORS = [
  {
    id: "bep20_primary",
    key: "wallet.address.1",
    label: "BEP20 (Address 1)",
    network: "BEP20",
    envKeys: ["WALLET_ADDRESS_1"],
  },
  {
    id: "bep20_secondary",
    key: "wallet.address.2",
    label: "BEP20 (Address 2)",
    network: "BEP20",
    envKeys: ["WALLET_ADDRESS_2"],
  },
  {
    id: "trc20",
    key: "wallet.address.3",
    label: "TRC20",
    network: "TRC20",
    envKeys: ["WALLET_ADDRESS_3"],
  },
] as const

const CACHE_TTL_MS = 60_000

interface WalletDescriptor {
  id: (typeof WALLET_DESCRIPTORS)[number]["id"]
  key: string
  label: string
  network: string
  envKeys: readonly string[]
}

interface WalletSettingAdminRecord {
  id: string
  key: string
  label: string
  network: string
  address: string
  source: "env" | "unset"
  updatedAt: string | null
  updatedBy: null
}

interface WalletSettingPublicRecord {
  id: string
  label: string
  network: string
  address: string
}

interface WalletSettingsSnapshot {
  admin: WalletSettingAdminRecord[]
  public: WalletSettingPublicRecord[]
}

let walletCache: { snapshot: WalletSettingsSnapshot; expiresAt: number } | null = null

function readEnvFallback(keys: readonly string[]): string | "" {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ""
}

function normalizeAddress(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function computeAdminRecord(descriptor: WalletDescriptor, value: string): WalletSettingAdminRecord {
  const address = normalizeAddress(value)
  const source: "env" | "unset" = address ? "env" : "unset"
  return {
    id: descriptor.id,
    key: descriptor.key,
    label: descriptor.label,
    network: descriptor.network,
    address,
    source,
    updatedAt: null,
    updatedBy: null,
  }
}

function computePublicRecords(adminRecords: WalletSettingAdminRecord[]): WalletSettingPublicRecord[] {
  return adminRecords
    .filter((record) => record.address)
    .map((record) => ({
      id: record.id,
      label: record.label,
      network: record.network,
      address: record.address,
    }))
}

async function loadWalletSettingsSnapshot(): Promise<WalletSettingsSnapshot> {
  const now = Date.now()
  if (walletCache && walletCache.expiresAt > now) {
    return walletCache.snapshot
  }

  const adminRecords = getWalletSettingsFromEnv()
  const snapshot: WalletSettingsSnapshot = {
    admin: adminRecords,
    public: computePublicRecords(adminRecords),
  }

  walletCache = { snapshot, expiresAt: now + CACHE_TTL_MS }
  return snapshot
}

export function invalidateWalletSettingsCache() {
  walletCache = null
}

export async function getWalletSettingsForAdmin(): Promise<WalletSettingAdminRecord[]> {
  const snapshot = await loadWalletSettingsSnapshot()
  return snapshot.admin
}

export async function getPublicWalletAddresses(): Promise<WalletSettingPublicRecord[]> {
  const snapshot = await loadWalletSettingsSnapshot()
  return snapshot.public
}

export function getWalletSettingsFromEnv(): WalletSettingAdminRecord[] {
  return WALLET_DESCRIPTORS.map((descriptor) => {
    const fallback = readEnvFallback(descriptor.envKeys)
    return computeAdminRecord(descriptor, fallback)
  })
}

export async function findAuditEntries(
  filter: FilterQuery<IAppSettingAudit>,
): Promise<IAppSettingAudit[]> {
  await dbConnect()
  return AppSettingAudit.find(filter).sort({ changedAt: -1 }).exec()
}

export type { WalletSettingAdminRecord, WalletSettingPublicRecord }
