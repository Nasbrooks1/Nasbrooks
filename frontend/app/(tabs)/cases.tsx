import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Case } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const CATEGORIES = [
  { key: "all", label: "ALL", icon: "grid" as const },
  { key: "violent", label: "VIOLENT", icon: "warning" as const },
  { key: "financial", label: "FINANCIAL", icon: "cash" as const },
  { key: "drug", label: "DRUG", icon: "medkit" as const },
  { key: "cyber", label: "CYBER", icon: "hardware-chip" as const },
  { key: "corruption", label: "CORRUPTION", icon: "business" as const },
  { key: "organized", label: "ORGANIZED", icon: "people" as const },
  { key: "celebrity", label: "HIGH-PROFILE", icon: "star" as const },
];

export default function CaseLibrary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cases", category],
    queryFn: () => api.listCases(category),
  });

  return (
    <View style={styles.root} testID="case-library-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.eyebrow}>FEDERAL CASE LIBRARY</Text>
        <Text style={styles.title}>Choose Your Battle</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}
          style={styles.chipRow}
        >
          {CATEGORIES.map((c) => {
            const selected = c.key === category;
            return (
              <Pressable
                key={c.key}
                testID={`case-cat-${c.key}`}
                onPress={() => setCategory(c.key)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Ionicons name={c.icon} size={14} color={selected ? colors.onBrandPrimary : colors.brandPrimary} />
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : error ? (
        <Pressable style={styles.center} onPress={() => refetch()} testID="case-retry">
          <Text style={styles.errorText}>Failed to load cases. Tap to retry.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120, gap: spacing.md }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>No cases unlocked in this category yet.</Text>
            </View>
          }
          renderItem={({ item }) => <CaseCard c={item} onPress={() => router.push(`/case/${item.id}`)} />}
        />
      )}
    </View>
  );
}

function CaseCard({ c, onPress }: { c: Case; onPress: () => void }) {
  return (
    <Pressable
      testID={`case-card-${c.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {c.hero_image && <Image source={c.hero_image} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <LinearGradient
        colors={["rgba(10,11,14,0.35)", "rgba(10,11,14,0.85)", "rgba(10,11,14,0.98)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.caseNumber}>CASE #{c.case_number}</Text>
          <View style={styles.difficultyPill}>
            <Text style={styles.difficultyText}>{c.difficulty.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.caseTitle}>{c.title}</Text>
        {c.is_celebrity_inspired && (
          <View style={styles.fictionBadge}>
            <Ionicons name="warning-outline" size={12} color={colors.warning} />
            <Text style={styles.fictionBadgeText}>Fictionalized — inspired by public cases</Text>
          </View>
        )}
        <Text style={styles.chargesLabel} numberOfLines={2}>
          {c.charges.join(" • ")}
        </Text>
        <View style={styles.metaRow}>
          <Meta icon="document-text" label={`${c.evidence.length} evidence`} />
          <Meta icon="person" label={`${c.witnesses.length} witnesses`} />
        </View>
      </View>
    </Pressable>
  );
}

function Meta({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={12} color={colors.brandPrimary} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingBottom: spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700", paddingHorizontal: spacing.xl },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 32, fontWeight: "600", paddingHorizontal: spacing.xl, marginTop: spacing.xs },
  chipRow: { flexGrow: 0 },
  chip: {
    height: 36,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  chipLabelSelected: { color: colors.onBrandPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  errorText: { color: colors.error, fontFamily: fonts.text },
  muted: { color: colors.muted, fontFamily: fonts.text, textAlign: "center" },
  card: {
    height: 190,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardBody: { flex: 1, padding: spacing.lg, justifyContent: "flex-end", gap: spacing.xs },
  cardTopRow: { position: "absolute", top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  caseNumber: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  difficultyPill: { backgroundColor: "rgba(212,175,55,0.15)", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, borderColor: colors.brandPrimary, borderWidth: StyleSheet.hairlineWidth },
  difficultyText: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  caseTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 24, fontWeight: "600" },
  fictionBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  fictionBadgeText: { color: colors.warning, fontSize: 10, fontFamily: fonts.text, letterSpacing: 0.5 },
  chargesLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, marginTop: spacing.xs },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  metaText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11 },
});
