import React, { useEffect, useState } from "react"
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { BalanceCard } from "../components/BalanceCard"
import { Loading } from "../components/Loading"
import { palette, spacing } from "../constants/theme"
import { fetchTeamRewards, fetchTeamStructure } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function ReferralsScreen() {
  const [rewards, setRewards] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [rewardsResponse, teamResponse] = await Promise.all([fetchTeamRewards(), fetchTeamStructure(1, 50)])
      setRewards(rewardsResponse)
      setTeam(teamResponse.items || [])
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Referrals error", payload.message || "Unable to load network crew.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <Text style={styles.title}>Network Crew</Text>
      <Text style={styles.subtitle}>Referral stats, hierarchy, and rewards.</Text>

      {loading ? <Loading message="Loading referrals..." /> : null}

      <View style={styles.grid}>
        <BalanceCard title="Available Rewards" value={`$${rewards?.available?.toFixed(2) ?? "0.00"}`} />
        <BalanceCard title="Claimed Total" value={`$${rewards?.claimedTotal?.toFixed(2) ?? "0.00"}`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Crew members</Text>
        <View style={{ gap: spacing.sm }}>
          {team.map((member) => (
            <View key={member._id} style={styles.row}>
              <View>
                <Text style={styles.memberName}>{member.name || "Unnamed"}</Text>
                <Text style={styles.meta}>Level {member.level ?? 0}</Text>
              </View>
              <Text style={styles.meta}>Deposits: ${member.depositTotal ?? 0}</Text>
            </View>
          ))}
          {team.length === 0 && !loading ? <Text style={styles.meta}>No referrals yet.</Text> : null}
        </View>
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
  grid: {
    gap: spacing.md
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
  },
  row: {
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  memberName: {
    color: palette.text,
    fontWeight: "700"
  },
  meta: {
    color: palette.muted
  }
})
