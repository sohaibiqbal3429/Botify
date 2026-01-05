import { useEffect } from "react"
import { Redirect } from "expo-router"
import { useAuth } from "../hooks/useAuth"

export default function Index() {
  const { user, loading } = useAuth()

  useEffect(() => {}, [user, loading])

  if (loading) return null
  if (user) return <Redirect href="/dashboard" />
  return <Redirect href="/login" />
}
