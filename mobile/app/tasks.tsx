import React, { useEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native"
import { Button } from "../components/Button"
import { Loading } from "../components/Loading"
import { palette, radii, spacing } from "../constants/theme"
import { claimReward, fetchTasks } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const response = await fetchTasks()
      setTasks(response.tasks || [])
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Tasks error", payload.message || "Unable to load tasks.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleClaim = async (id: string) => {
    try {
      setClaimingId(id)
      await claimReward(id)
      await load()
      Alert.alert("Reward claimed", "Task reward added to your account.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Claim failed", payload.message || "Unable to claim reward.")
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>Complete missions to earn rewards.</Text>

      {loading ? <Loading message="Loading tasks..." /> : null}

      <View style={{ gap: spacing.sm }}>
        {tasks.map((task) => (
          <View key={task._id} style={styles.card}>
            <Text style={styles.cardTitle}>{task.title}</Text>
            {task.description ? <Text style={styles.cardBody}>{task.description}</Text> : null}
            <Text style={styles.cardMeta}>Reward: ${task.reward ?? 0}</Text>
            <Button
              label={task.completed ? "Completed" : "Claim"}
              onPress={() => handleClaim(task._id)}
              disabled={task.completed}
              loading={claimingId === task._id}
            />
          </View>
        ))}
        {tasks.length === 0 && !loading ? <Text style={styles.cardBody}>No tasks available.</Text> : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: palette.muted
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.sm
  },
  cardTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
  },
  cardBody: {
    color: palette.muted
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 12
  }
})
