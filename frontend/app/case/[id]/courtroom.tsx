import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Witness } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Line = { id: string; speaker: string; role: "judge" | "lawyer" | "witness" | "system"; text: string };

const DIRECT_QUESTIONS = [
  "Please state your name and occupation for the record.",
  "Walk the jury through what happened that night.",
  "How can you be certain of what you saw?",
  "Was anyone else present at the time?",
  "Did you preserve chain of custody?",
];

const CROSS_QUESTIONS_BASE = [
  "Isn't it true you have a cooperation agreement with the government?",
  "You didn't actually see the transaction take place, did you?",
];

const OBJECTIONS = ["Hearsay", "Relevance", "Speculation", "Leading", "Foundation", "Asked and Answered", "Argumentative"] as const;

export default function Courtroom() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, role = "prosecutor", clues: cluesParam } = useLocalSearchParams<{ id: string; role?: string; clues?: string }>();
  const { data: c } = useQuery({ queryKey: ["case", id], queryFn: () => api.getCase(id) });

  const unlockedClueIds = useMemo(() => new Set((cluesParam || "").split(",").filter(Boolean)), [cluesParam]);
  const unlockedCrossQuestions = useMemo(
    () => (c?.clues || []).filter((cl) => unlockedClueIds.has(cl.id)).map((cl) => cl.unlocks_question),
    [c, unlockedClueIds],
  );

  const [phase, setPhase] = useState<"opening" | "direct" | "cross">("opening");
  const [witnessIdx, setWitnessIdx] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showObjections, setShowObjections] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const [streamingLineId, setStreamingLineId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    objections_won: 0,
    objections_lost: 0,
    evidence_introduced: 0,
    witnesses_examined: 0,
    contradictions_exposed: 0,
    motions_granted: 0,
    motions_denied: 0,
  });
  const listRef = useRef<FlatList<Line>>(null);

  const witnesses: Witness[] = c?.witnesses || [];
  const currentWitness = witnesses[witnessIdx];

  // Lazy-load portrait for current witness
  const portraitQ = useQuery({
    queryKey: ["portrait", c?.id, currentWitness?.id],
    queryFn: () => api.getWitnessPortrait(c!.id, currentWitness!.id),
    enabled: !!c && !!currentWitness,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Seed opening lines once case loads
  useEffect(() => {
    if (c && lines.length === 0) {
      setLines([
        { id: "l0", speaker: "COURT CRIER", role: "system", text: "All rise. This court is now in session." },
        { id: "l1", speaker: "JUDGE", role: "judge", text: `Ladies and gentlemen of the jury, we begin ${c.title}. Counsel, opening statements.` },
      ]);
    }
  }, [c, lines.length]);

  const pushLine = useCallback((line: Omit<Line, "id">) => {
    const withId = { ...line, id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    setLines((l) => [...l, withId]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return withId.id;
  }, []);

  const beginTestimony = useCallback(() => {
    if (!currentWitness) return;
    pushLine({ speaker: "BAILIFF", role: "system", text: `The government calls ${currentWitness.name} to the stand.` });
    pushLine({ speaker: "JUDGE", role: "judge", text: `${currentWitness.name}, please be sworn in. Counsel, you may proceed.` });
    setPhase("direct");
  }, [currentWitness, pushLine]);

  const streamWitnessReply = useCallback(async (question: string) => {
    if (!c || !currentWitness) return;
    setBusy(true);
    // Push placeholder line we will fill token by token
    const lineId = pushLine({ speaker: currentWitness.name.toUpperCase(), role: "witness", text: "" });
    setStreamingLineId(lineId);

    let full = "";
    try {
      for await (const chunk of api.witnessStream({
        case_id: c.id,
        witness_id: currentWitness.id,
        question,
        is_cross_examination: phase === "cross",
        mood: "neutral",
      })) {
        full += chunk;
        setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, text: full } : l)));
        listRef.current?.scrollToEnd({ animated: true });
      }
    } catch {
      // Fallback to non-streaming
      try {
        const resp = await api.witnessRespond({
          case_id: c.id,
          witness_id: currentWitness.id,
          question,
          is_cross_examination: phase === "cross",
          mood: "neutral",
        });
        full = resp.text;
        // Reveal word by word (typewriter fallback)
        const words = full.split(/(\s+)/);
        let cur = "";
        for (const w of words) {
          cur += w;
          setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, text: cur } : l)));
          await new Promise((r) => setTimeout(r, 60));
        }
        if (resp.contradicted) {
          pushLine({ speaker: "COURT", role: "system", text: "⚡ The witness's answer contradicts prior testimony." });
          setStats((s) => ({ ...s, contradictions_exposed: s.contradictions_exposed + 1 }));
        }
      } catch {
        setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, text: "[Witness unresponsive.]" } : l)));
      }
    } finally {
      // Heuristic contradiction detection on streamed text
      const low = full.toLowerCase();
      const contradicted = ["i was wrong", "i misspoke", "i mis-spoke", "i don't recall", "actually,", "correction"].some((k) => low.includes(k));
      if (contradicted && phase === "cross") {
        pushLine({ speaker: "COURT", role: "system", text: "⚡ Contradiction exposed on cross-examination." });
        setStats((s) => ({ ...s, contradictions_exposed: s.contradictions_exposed + 1 }));
      }
      setStreamingLineId(null);
      setBusy(false);
    }
  }, [c, currentWitness, phase, pushLine]);

  const askQuestion = useCallback(
    async (q: string) => {
      setShowQuestions(false);
      setCustomQuestion("");
      setLastQuestion(q);
      pushLine({ speaker: role === "defense" ? "DEFENSE" : "PROSECUTION", role: "lawyer", text: q });
      await streamWitnessReply(q);
    },
    [pushLine, role, streamWitnessReply],
  );

  const raiseObjection = useCallback(
    async (type: string) => {
      setShowObjections(false);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      pushLine({ speaker: role === "defense" ? "PROSECUTION" : "DEFENSE", role: "lawyer", text: `Objection — ${type}.` });
      setBusy(true);
      try {
        const ruling = await api.objectionRule({ objection_type: type, question: lastQuestion, case_id: c?.id });
        pushLine({ speaker: "JUDGE", role: "judge", text: `${ruling.ruling.toUpperCase()}. ${ruling.reasoning}` });
        const won = ruling.ruling === "sustained";
        setStats((s) => ({
          ...s,
          objections_won: s.objections_won + (won ? 1 : 0),
          objections_lost: s.objections_lost + (won ? 0 : 1),
        }));
      } catch {
        pushLine({ speaker: "JUDGE", role: "judge", text: "Overruled. The court has already ruled." });
        setStats((s) => ({ ...s, objections_lost: s.objections_lost + 1 }));
      } finally {
        setBusy(false);
      }
    },
    [lastQuestion, pushLine, role],
  );

  const introduceEvidence = useCallback(() => {
    if (!c) return;
    const nextIdx = stats.evidence_introduced;
    const item = c.evidence[nextIdx];
    if (!item) {
      pushLine({ speaker: "COURT", role: "system", text: "All exhibits have been introduced." });
      return;
    }
    pushLine({ speaker: role === "defense" ? "DEFENSE" : "PROSECUTION", role: "lawyer", text: `Your Honor, the government moves to admit Exhibit ${nextIdx + 1}: ${item.label}.` });
    pushLine({ speaker: "JUDGE", role: "judge", text: `Received. Exhibit ${nextIdx + 1} is admitted.` });
    setStats((s) => ({ ...s, evidence_introduced: s.evidence_introduced + 1 }));
  }, [c, pushLine, role, stats.evidence_introduced]);

  const goVerdict = useCallback(() => {
    router.replace({
      pathname: "/case/[id]/verdict",
      params: {
        id: id!,
        role,
        stats: JSON.stringify(stats),
        transcript: JSON.stringify(lines.map((l) => ({ speaker: l.speaker, role: l.role, text: l.text }))),
      },
    });
  }, [id, lines, role, router, stats]);

  const nextPhase = useCallback(() => {
    if (phase === "opening") {
      pushLine({ speaker: role === "defense" ? "DEFENSE" : "PROSECUTION", role: "lawyer", text: "May it please the court, the evidence will show..." });
      pushLine({ speaker: "JUDGE", role: "judge", text: "Very well. Call your first witness." });
      beginTestimony();
    } else if (phase === "direct") {
      setPhase("cross");
      pushLine({ speaker: "JUDGE", role: "judge", text: "Cross-examination." });
    } else {
      setStats((s) => ({ ...s, witnesses_examined: s.witnesses_examined + 1 }));
      if (witnessIdx + 1 < witnesses.length) {
        setWitnessIdx((i) => i + 1);
        setPhase("direct");
        setTimeout(() => beginTestimony(), 100);
      } else {
        goVerdict();
      }
    }
  }, [beginTestimony, goVerdict, phase, pushLine, role, witnessIdx, witnesses.length]);

  const speakerTitle = useMemo(() => {
    if (phase === "opening") return "Judge presiding";
    return currentWitness ? `${currentWitness.name} — ${currentWitness.role}` : "";
  }, [currentWitness, phase]);

  const questionOptions = useMemo(() => {
    if (phase === "cross") {
      return [...unlockedCrossQuestions, ...CROSS_QUESTIONS_BASE];
    }
    return DIRECT_QUESTIONS;
  }, [phase, unlockedCrossQuestions]);

  if (!c) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="courtroom-screen">
      <View style={[styles.topPanel, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topHeaderRow}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="court-back">
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.caseLine}>CASE #{c.case_number} · {phase.toUpperCase()}</Text>
            <Text style={styles.caseTitle} numberOfLines={1}>{c.title}</Text>
          </View>
          <Pressable onPress={goVerdict} style={styles.iconBtn} testID="court-verdict">
            <Ionicons name="hammer" size={18} color={colors.brandPrimary} />
          </Pressable>
        </View>

        <View style={styles.speakerCard}>
          <View style={styles.speakerAvatar}>
            {phase !== "opening" && portraitQ.data?.data_url ? (
              <Image
                source={portraitQ.data.data_url}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                testID="witness-portrait"
              />
            ) : phase !== "opening" && portraitQ.isPending ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              <Ionicons name={phase === "opening" ? "hammer" : "person"} size={40} color={colors.brandPrimary} />
            )}
          </View>
          <Text style={styles.speakerName}>{speakerTitle}</Text>
          {c.judge && phase === "opening" && (
            <Text style={styles.judgeSub}>Presiding: {c.judge.name} · {c.judge.personality}</Text>
          )}
          <View style={styles.pill}>
            <View style={[styles.pillDot, { backgroundColor: busy ? colors.warning : colors.success }]} />
            <Text style={styles.pillText}>{busy ? "TESTIFYING…" : "ON THE STAND"}</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 240, gap: spacing.md }}
        renderItem={({ item }) => <TranscriptLine line={item} typing={item.id === streamingLineId} />}
      />

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {Platform.OS !== "web" && <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,11,14,0.9)" }]} />
        <View style={styles.actionRow}>
          <ActionBtn testID="act-question" icon="chatbubble-ellipses" label="ASK" onPress={() => setShowQuestions(true)} disabled={phase === "opening" || busy} />
          <ActionBtn testID="act-evidence" icon="documents" label="EVIDENCE" onPress={introduceEvidence} disabled={busy} />
          <ActionBtn testID="act-objection" icon="hand-left" label="OBJECTION" onPress={() => setShowObjections(true)} highlight disabled={busy || phase === "opening"} />
        </View>
        <Pressable testID="act-next-phase" onPress={nextPhase} style={styles.nextBtn} disabled={busy}>
          <Text style={styles.nextText}>
            {phase === "opening" ? "BEGIN TESTIMONY" : phase === "direct" ? "CROSS-EXAMINE" : witnessIdx + 1 < witnesses.length ? "NEXT WITNESS" : "TO DELIBERATION"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {/* Question sheet with custom input */}
      <Modal visible={showQuestions} transparent animationType="fade" onRequestClose={() => setShowQuestions(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowQuestions(false)} testID="question-backdrop">
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Ask a Question</Text>
              <Text style={styles.modalSub}>{phase === "direct" ? "Direct examination" : "Cross-examination"}{phase === "cross" && unlockedCrossQuestions.length > 0 ? ` · ${unlockedCrossQuestions.length} unlocked from investigation` : ""}</Text>

              <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                {questionOptions.map((q, i) => {
                  const isUnlocked = phase === "cross" && i < unlockedCrossQuestions.length;
                  return (
                    <Pressable key={q} testID={`ask-opt-${i}`} style={[styles.modalOption, isUnlocked && styles.modalOptionUnlocked]} onPress={() => askQuestion(q)}>
                      {isUnlocked && (
                        <View style={styles.unlockedBadge}>
                          <Ionicons name="sparkles" size={10} color={colors.brandPrimary} />
                          <Text style={styles.unlockedBadgeText}>FROM INVESTIGATION</Text>
                        </View>
                      )}
                      <Text style={styles.modalOptionText}>{q}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.customRow}>
                <TextInput
                  testID="custom-question-input"
                  value={customQuestion}
                  onChangeText={setCustomQuestion}
                  placeholder="Type your own question…"
                  placeholderTextColor={colors.muted}
                  style={styles.customInput}
                  multiline
                  onSubmitEditing={() => customQuestion.trim() && askQuestion(customQuestion.trim())}
                />
                <Pressable
                  testID="custom-question-send"
                  disabled={!customQuestion.trim()}
                  onPress={() => askQuestion(customQuestion.trim())}
                  style={[styles.sendBtn, !customQuestion.trim() && { opacity: 0.4 }]}
                >
                  <Ionicons name="send" size={16} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Objection overlay */}
      <Modal visible={showObjections} transparent animationType="fade" onRequestClose={() => setShowObjections(false)}>
        {Platform.OS !== "web" && <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,11,14,0.85)" }]} />
        <View style={styles.objectionSheet} pointerEvents="box-none">
          <Text style={styles.objTitle}>OBJECTION!</Text>
          <Text style={styles.objSub}>Choose your grounds. The judge will rule.</Text>
          <View style={styles.objGrid}>
            {OBJECTIONS.map((o) => (
              <Pressable key={o} testID={`obj-${o}`} style={styles.objBtn} onPress={() => raiseObjection(o)}>
                <Text style={styles.objBtnText}>{o.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setShowObjections(false)} style={styles.objCancel} testID="obj-cancel">
            <Text style={styles.objCancelText}>Withdraw</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function TranscriptLine({ line, typing }: { line: Line; typing?: boolean }) {
  const isJudge = line.role === "judge";
  const isSystem = line.role === "system";
  const isLawyer = line.role === "lawyer";
  const color = isJudge ? colors.brandPrimary : isSystem ? colors.muted : isLawyer ? colors.info : colors.onSurface;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={[tStyles.speaker, { color }]}>{line.speaker}</Text>
        {typing && <View style={tStyles.typingDot} />}
      </View>
      <Text style={[tStyles.text, isSystem && { fontStyle: "italic", color: colors.muted }]}>
        {line.text}
        {typing && line.text.length === 0 ? "…" : ""}
      </Text>
    </View>
  );
}

const tStyles = StyleSheet.create({
  speaker: { fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  text: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
});

function ActionBtn({
  testID, icon, label, onPress, highlight, disabled,
}: { testID: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; highlight?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        highlight && styles.actionBtnPrimary,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Ionicons name={icon} size={18} color={highlight ? colors.onBrandPrimary : colors.brandPrimary} />
      <Text style={[styles.actionLabel, highlight && { color: colors.onBrandPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topPanel: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: colors.surface },
  topHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  caseLine: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  caseTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, fontWeight: "600", marginTop: 2 },
  speakerCard: { alignItems: "center", padding: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  speakerAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.brandPrimary, overflow: "hidden" },
  speakerName: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 18, fontWeight: "600", textAlign: "center" },
  judgeSub: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textAlign: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, overflow: "hidden" },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1, height: 54, borderRadius: radius.md, backgroundColor: "rgba(30,33,42,0.9)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 2 },
  actionBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  actionLabel: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  nextBtn: { marginTop: spacing.sm, height: 42, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  nextText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: spacing.xxl, borderTopWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: "600" },
  modalSub: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginTop: 4 },
  modalOption: { padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modalOptionUnlocked: { borderColor: colors.brandPrimary, backgroundColor: "rgba(212,175,55,0.1)" },
  unlockedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  unlockedBadgeText: { color: colors.brandPrimary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5, fontFamily: fonts.text },
  modalOptionText: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  customRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  customInput: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brandPrimary, color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, backgroundColor: colors.surfaceTertiary },
  sendBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  objectionSheet: { flex: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.md },
  objTitle: { color: colors.brandPrimary, fontFamily: fonts.display, fontSize: 48, fontWeight: "700", textAlign: "center", letterSpacing: 2 },
  objSub: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 13, textAlign: "center" },
  objGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  objBtn: { width: "48%", height: 60, borderRadius: radius.md, backgroundColor: "rgba(20,22,28,0.95)", borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  objBtnText: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, textAlign: "center" },
  objCancel: { alignSelf: "center", padding: spacing.md, marginTop: spacing.md },
  objCancelText: { color: colors.muted, fontFamily: fonts.text, fontSize: 13 },
});
