import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"

const availabilityPromise = SecureStore.isAvailableAsync ? SecureStore.isAvailableAsync() : Promise.resolve(false)

async function setItem(key: string, value: string) {
  const canSecure = await availabilityPromise
  if (canSecure) {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
  } else {
    await AsyncStorage.setItem(key, value)
  }
}

async function getItem(key: string) {
  const canSecure = await availabilityPromise
  if (canSecure) {
    return SecureStore.getItemAsync(key)
  }
  return AsyncStorage.getItem(key)
}

async function deleteItem(key: string) {
  const canSecure = await availabilityPromise
  if (canSecure) {
    await SecureStore.deleteItemAsync(key)
  } else {
    await AsyncStorage.removeItem(key)
  }
}

export const secureStorage = {
  setItem,
  getItem,
  deleteItem
}
