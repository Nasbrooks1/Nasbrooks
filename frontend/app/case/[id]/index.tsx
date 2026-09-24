import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function CaseBrief() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, role = "prosecutor" } = useLocalSearchParams<{ id: string; role?: string }>();
  const { data: c, isLoading } = useQuery({ queryKey: ["case", id], queryFn: () => api.getCase(id) });

  if (isLoading || !c) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="case-brief-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {c.hero_image && <Image source={c.hero_image} style={StyleSheet.absoluteFill} contentFit="cover" />}
          <LinearGradient
            colors={["rgba(10,11,14,0.35)", "rgba(10,11,14,0.85)", "rgba(10,11,14,1)"]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable onPress={() => router.back()} style={[styles.back, { top: insets.top + spacing.md }]} testID="brief-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={styles.heroBody}>
            <Text style={styles.caseNumber}>CASE #{c.case_number}</Text>
            <Text style={styles.title}>{c.title}</Text>
            {c.is_celebrity_inspired && (
              <View style={styles.disclaimer}>
                <Ionicons name="warning" size={14} color={colors.warning} />
                <Text style={styles.disclaimerText}>Fictional case inspired by public federal prosecutions. All names and facts invented.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          <Section title="Synopsis">
            <Text style={styles.body}>{c.synopsis}</Text>
          </Section>

          <Section title="Charges">
            <View style={{ gap: spacing.sm }}>
              {c.charges.map((ch) => (
                <View key={ch} style={styles.chargeRow}>
                  <Ionicons name="document-text" size={16} color={colors.brandPrimary} />
                  <Text style={styles.chargeText}>{ch}</Text>
                </View>
              ))}
            </View>
          </Section>

          {c.judge && (
            <Section title="Presiding Judge">
              <View style={styles.judgeCard} testID="judge-card">
                <View style={styles.judgeIcon}>
                  <Ionicons name="hammer" size={20} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.judgeName}>{c.judge.name}</Text>
                  <Text style={styles.judgePersonality}>{c.judge.personality.toUpperCase()}</Text>
                  <Text style={styles.judgeTagline}>{c.judge.tagline}</Text>
                </View>
              </View>
            </Section>
          )}

          <Section title="Evidence Inventory">
            <View style={styles.statGrid}>
              <StatTile n={c.evidence.length} label="Evidence Items" icon="folder" />
              <StatTile n={c.witnesses.length} label="Witnesses" icon="person" />
              <StatTile n={c.charges.length} label="Charges" icon="hammer" />
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {c.evidence.map((e) => (
                <View key={e.id} style={styles.evidenceRow}>
                  <View style={styles.evidenceIcon}>
                    <Ionicons name="documents" size={16} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evidenceLabel}>{e.label}</Text>
                    <Text style={styles.evidenceSummary} numberOfLines={2}>{e.summary}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          testID="btn-investigate"
          onPress={() => router.push({ pathname: "/case/[id]/investigation", params: { id, role } })}
          style={styles.secondaryBtn}
        >
          <Ionicons name="search" size={18} color={colors.brandPrimary} />
          <Text style={styles.secondaryText}>INVESTIGATE</Text>
        </Pressable>
        <Pressable
          testID="btn-enter-courtroom"
          onPress={() => router.push({ pathname: "/case/[id]/courtroom", params: { id, role } })}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryText}>ENTER COURTROOM</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

function StatTile({ n, label, icon }: { n: number; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 340, overflow: "hidden" },
  back: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(20,22,28,0.6)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, zIndex: 2 },
  heroBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl },
  caseNumber: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 34, fontWeight: "600", marginTop: spacing.xs, lineHeight: 38 },
  disclaimer: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.md, padding: spacing.md, backgroundColor: "rgba(139,35,35,0.15)", borderRadius: radius.md, borderColor: colors.warning, borderWidth: StyleSheet.hairlineWidth },
  disclaimerText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, lineHeight: 16 },
  sectionTitle: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2.5, fontWeight: "700" },
  body: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 14, lineHeight: 22 },
  chargeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chargeText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 13, flex: 1 },
  statGrid: { flexDirection: "row", gap: spacing.md },
  statTile: { flex: 1, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", gap: 4 },
  statNum: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 26, fontWeight: "600" },
  statLabel: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, letterSpacing: 1, fontWeight: "700", textAlign: "center" },
  evidenceRow: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center" },
  evidenceIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  evidenceLabel: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 13, fontWeight: "700" },
  evidenceSummary: { color: colors.muted, fontFamily: fonts.text, fontSize: 11, marginTop: 2 },
  judgeCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brandPrimary, alignItems: "center" },
  judgeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  judgeName: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, fontWeight: "600" },
  judgePersonality: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700", marginTop: 2 },
  judgeTagline: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, marginTop: 4, lineHeight: 17 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  primaryBtn: { flex: 1.4, height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  secondaryBtn: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  secondaryText: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
