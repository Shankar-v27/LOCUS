import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { colors, fonts, hairline, monoNumeric, monoNumericBold, spacing } from '@/theme';
import type { ProfileOverride, RuntimePolicyDecision } from '@/services/adaptiveRuntimePolicy';

export interface RuntimePanelProps {
  decision: RuntimePolicyDecision;
  override: ProfileOverride;
  onSelectOverride: (override: ProfileOverride) => void;
  memoryText: string;
  batteryText: string;
}

export function RuntimePanel({
  decision,
  override,
  onSelectOverride,
  memoryText,
  batteryText,
}: RuntimePanelProps) {
  const { profile, preloadAI, integrityMode, reason } = decision;

  const profileColor =
    profile === 'HIGH_PERFORMANCE'
      ? colors.trusted
      : profile === 'BALANCED'
      ? colors.caution
      : '#FF9500';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LOCUS RUNTIME • ADAPTIVE EDGE</Text>
        <View style={[styles.badge, { borderColor: profileColor }]}>
          <Text style={[styles.badgeText, { color: profileColor }]}>{profile.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        {/* Metric Grid */}
        <View style={styles.row}>
          <Text style={styles.kvKey}>PROFILE</Text>
          <Text style={[styles.kvVal, { color: profileColor }]}>{profile.replace('_', ' ')}</Text>
          <Text style={styles.kvSep}>│</Text>
          <Text style={styles.kvKey}>MEMORY</Text>
          <Text style={styles.kvVal}>{memoryText}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.kvKey}>BATTERY</Text>
          <Text style={styles.kvVal}>{batteryText}</Text>
          <Text style={styles.kvSep}>│</Text>
          <Text style={styles.kvKey}>THERMAL</Text>
          <Text style={styles.kvVal}>N/A</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.kvKey}>INTEGRITY</Text>
          <Text style={[styles.kvVal, { color: colors.trusted }]}>{integrityMode}</Text>
          <Text style={styles.kvSep}>│</Text>
          <Text style={styles.kvKey}>AI MODE</Text>
          <Text style={[styles.kvVal, { color: preloadAI ? colors.trusted : colors.caution }]}>
            {preloadAI ? 'PRELOADED' : 'ON-DEMAND'}
          </Text>
        </View>

        {/* Reason / Subtitle */}
        <Text style={styles.reasonText} numberOfLines={2}>
          {reason}
        </Text>

        {/* Demo / Developer Selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>DEMO PROFILE OVERRIDE:</Text>
          <View style={styles.buttonsRow}>
            {(['AUTO', 'HIGH_PERFORMANCE', 'BALANCED', 'LOW_POWER'] as const).map((mode) => {
              const active = override === mode;
              const label =
                mode === 'AUTO'
                  ? 'AUTO'
                  : mode === 'HIGH_PERFORMANCE'
                  ? 'HIGH'
                  : mode === 'BALANCED'
                  ? 'BALANCED'
                  : 'LOW PWR';

              return (
                <Pressable
                  key={mode}
                  style={[styles.btn, active && styles.btnActive]}
                  onPress={() => onSelectOverride(mode)}
                >
                  <Text style={[styles.btnText, active && styles.btnTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Profile adapts optional workloads. Integrity engine remains active on all profiles.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.panelBg,
  },
  headerTitle: {
    ...monoNumericBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  badge: {
    borderWidth: hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  badgeText: {
    ...monoNumericBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  panel: {
    backgroundColor: colors.panelSurface,
    borderTopWidth: hairline,
    borderTopColor: colors.chrome,
    borderBottomWidth: hairline,
    borderBottomColor: colors.chrome,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kvKey: {
    ...monoNumeric,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
    width: 68,
  },
  kvVal: {
    ...monoNumericBold,
    fontSize: 11,
    color: colors.textPrimary,
    flex: 1,
  },
  kvSep: {
    color: colors.chrome,
    marginHorizontal: spacing.xs,
    fontSize: 10,
  },
  reasonText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectorContainer: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: hairline,
    borderTopColor: colors.chrome,
    gap: spacing.xs,
  },
  selectorLabel: {
    ...monoNumeric,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  btn: {
    flex: 1,
    borderWidth: hairline,
    borderColor: colors.chrome,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelBg,
  },
  btnActive: {
    borderColor: colors.trusted,
    backgroundColor: 'rgba(0, 217, 163, 0.12)',
  },
  btnText: {
    ...monoNumeric,
    fontSize: 9,
    color: colors.textMuted,
  },
  btnTextActive: {
    ...monoNumericBold,
    color: colors.trusted,
  },
  disclaimer: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
