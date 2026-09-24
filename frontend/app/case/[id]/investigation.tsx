import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Clue } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const ACTIONS: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "witnesses", label: "Interview\nWitnesses", icon: "people" },
  { key: "phone", label: "Phone\nRecords", icon: "call" },
  { key: "surveillance", label: "Review\nSurveillance", icon: "videocam" },
  { key: "documents", label: "Examine\nDocuments", icon: "document-text" },
  { key: "financial", label: "Financial\nRecords", icon: "cash" },
  { key: "forensic", label: "Forensic\nEvidence", icon: "flask" },
];

const DESK = "https://images.pexels.com/photos/8382083/pexels-photo-8382083.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Investigation() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, role = "prosecutor" } = useLocalSearchParams<{ id: string; role?: string }>();
  const { data: c } = useQuery({ queryKey: ["case", id], queryFn: () => api.getCase(id) });
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const cluesByAction = useMemo(() => {
    const map: Record<string, Clue[]> = {};
    (c?.clues || []).forEach((cl) => {
      (map[cl.action] ||= []).push(cl);
    });
    return map;
  }, [c]);

  const discoveredClues: Clue[] = useMemo(
    () => Array.from(opened).flatMap((k) => cluesByAction[k] || []),
    [opened, cluesByAction],
  );

  const toggle = (k: string) => {
    setOpened((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const totalClues = c?.clues.length || 0;

  return (
    <View style={styles.root} testID="investigation-screen">
      <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(10,11,14,0.7)", "rgba(10,11,14,0.94)", "rgba(10,11,14,1)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 80, paddingHorizontal: spacing.xl, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>PRE-TRIAL · INVESTIGATION</Text>
        <Text style={styles.title}>The Case File</Text>
        <Text style={styles.sub}>{c?.title}. Every folder you open surfaces a clue that unlocks a specific cross-examination question at trial.</Text>

        <View style={styles.progress}>
          <Text style={styles.progressLabel}>CLUES DISCOVERED</Text>
          <Text style={styles.progressValue}>{discoveredClues.length} / {totalClues}</Text>
        </View>

        <View style={styles.grid}>
          {ACTIONS.map((a) => {
            const on = opened.has(a.key);
            const clues = cluesByAction[a.key] || [];
            const isExpanded = on;
            return (
              <Pressable
                key={a.key}
                testID={`invest-${a.key}`}
                onPress={() => toggle(a.key)}
                style={({ pressed }) => [
                  styles.folder,
                  on && styles.folderOn,
                  isExpanded && { width: "100%" },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.folderIcon, on && styles.folderIconOn]}>
                  <Ionicons name={a.icon} size={22} color={on ? colors.onBrandPrimary : colors.brandPrimary} />
                </View>
                <Text style={styles.folderLabel}>{a.label}</Text>
                {clues.length > 0 && (
                  <View style={styles.clueCountPill}>
                    <Text style={styles.clueCountText}>{clues.length} clue{clues.length > 1 ? "s" : ""}</Text>
                  </View>
                )}
                {isExpanded && clues.length > 0 && (
                  <View style={styles.clueList}>
                    {clues.map((cl) => (
                      <View key={cl.id} style={styles.clueRow} testID={`clue-${cl.id}`}>
                        <Ionicons name="sparkles" size={12} color={colors.brandPrimary} />
                        <Text style={styles.clueText}>{cl.label}</Text>
                      </View>
                    ))}
                    <Text style={styles.clueHint}>Unlocks {clues.length} cross-exam question{clues.length > 1 ? "s" : ""} in the courtroom.</Text>
                  </View>
                )}
                {on && !isExpanded && (
                  <View style={styles.checkPill}>
                    <Ionicons name="checkmark" size={12} color={colors.onBrandPrimary} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable onPress={() => router.back()} style={[styles.back, { top: insets.top + spacing.md }]} testID="invest-back">
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </Pressable>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          testID="invest-proceed"
          onPress={() =>
            router.push({
              pathname: "/case/[id]/courtroom",
              params: {
                id,
                role,
                clues: discoveredClues.map((c) => c.id).join(","),
              },
            })
          }
          style={styles.primaryBtn}
        >
          <Ionicons name="hammer" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.primaryText}>PROCEED TO TRIAL</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  back: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(20,22,28,0.6)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 36, fontWeight: "600", marginTop: spacing.xs },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13, marginTop: spacing.sm, lineHeight: 19 },
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, padding: spacing.md, backgroundColor: "rgba(20,22,28,0.7)", borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brandPrimary },
  progressLabel: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  progressValue: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  folder: { width: "47%", minHeight: 170, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: "rgba(20,22,28,0.85)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  folderOn: { borderColor: colors.brandPrimary },
  folderIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  folderIconOn: { backgroundColor: colors.brandPrimary },
  folderLabel: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, fontWeight: "700", lineHeight: 18 },
  clueCountPill: { alignSelf: "flex-start", backgroundColor: "rgba(212,175,55,0.15)", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  clueCountText: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  clueList: { marginTop: spacing.sm, gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  clueRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  clueText: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
  clueHint: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, marginTop: spacing.xs, fontStyle: "italic" },
  checkPill: { position: "absolute", top: spacing.md, right: spacing.md, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: "rgba(10,11,14,0.95)", borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { height: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
});
