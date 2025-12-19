import React, { useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchWallet } from '../store/slices/walletSlice';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';

const HomeScreen = () => {
  const dispatch = useAppDispatch();
  const wallet = useAppSelector((state) => state.wallet);

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.heading}>Dashboard</Text>
      <View style={styles.grid}>
        <Card title="Total Balance" style={styles.card}>
          {wallet.loading ? <ActivityIndicator /> : <Text style={styles.value}>${wallet.summary.totalBalance}</Text>}
        </Card>
        <Card title="Current Balance" style={styles.card}>
          {wallet.loading ? <ActivityIndicator /> : <Text style={styles.value}>${wallet.summary.currentBalance}</Text>}
        </Card>
      </View>
      <View style={styles.grid}>
        <Card title="Total Withdraw" style={styles.card}>
          {wallet.loading ? <ActivityIndicator /> : <Text style={styles.value}>${wallet.summary.totalWithdraw}</Text>}
        </Card>
        <Card title="Pending Withdraw" style={styles.card}>
          {wallet.loading ? <ActivityIndicator /> : <Text style={styles.value}>${wallet.summary.pendingWithdraw}</Text>}
        </Card>
      </View>
      <Card title="Recent Activity">
        {wallet.loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.status}>Keep an eye on approvals and recent payouts.</Text>
            <Text style={styles.status}>Balances update automatically after reviews.</Text>
          </>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  card: {
    flex: 1
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text
  },
  status: {
    color: colors.text,
    marginBottom: spacing.sm
  }
});

export default HomeScreen;
