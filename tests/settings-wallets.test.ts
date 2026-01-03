import assert from "node:assert/strict"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"
process.env.APP_SETTINGS_ENCRYPTION_KEY = "unit-test-secret"
process.env.WALLET_ADDRESS_1 = "0x1111111111111111111111111111111111111111"
process.env.WALLET_ADDRESS_2 = "0x2222222222222222222222222222222222222222"
process.env.WALLET_ADDRESS_3 = "TNDh9bU1Wq6sLwVh5C3p2zYb8wQ7rNs5tR"

import {
  getPublicWalletAddresses,
  getWalletSettingsFromEnv,
  invalidateWalletSettingsCache,
} from "@/lib/services/app-settings"
import dbConnect from "@/lib/mongodb"

async function resetState() {
  await dbConnect()
  invalidateWalletSettingsCache()
}

test("public wallet addresses fall back to environment defaults", async () => {
  await resetState()

  const wallets = await getPublicWalletAddresses()
  assert.equal(wallets.length, 3)
  assert.equal(wallets[0]?.address, process.env.WALLET_ADDRESS_1)
  assert.equal(wallets[1]?.address, process.env.WALLET_ADDRESS_2)
  assert.equal(wallets[2]?.address, process.env.WALLET_ADDRESS_3)
})

test("admin fallback wallets expose environment values", () => {
  const wallets = getWalletSettingsFromEnv()
  assert.equal(wallets.length, 3)
  assert.equal(wallets[0]?.address, process.env.WALLET_ADDRESS_1)
  assert.equal(wallets[1]?.address, process.env.WALLET_ADDRESS_2)
  assert.equal(wallets[2]?.address, process.env.WALLET_ADDRESS_3)
  wallets.forEach((wallet) => {
    assert.equal(wallet.source, wallet.address ? "env" : "unset")
    assert.equal(wallet.updatedAt, null)
    assert.equal(wallet.updatedBy, null)
  })
})
