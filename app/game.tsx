import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Platform, KeyboardAvoidingView, useWindowDimensions, ScrollView } from 'react-native';
import { Ionicons } from '@/components/ui/Ionicons';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import QuestionCard from '@/components/QuestionCard';
import BetSelector from '@/components/BetSelector';
import Timer from '@/components/Timer';
import Logo from '@/components/Logo';
import { OpponentStatusList } from '@/components/OpponentStatusList';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useGame, GamePhase, Question, Difficulty, Player, GameSettings } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { generateQuestions, translateQuestions } from '@/services/questionService';
import { fetchRoomState, updateRoomQuestions, updatePlayerState } from '@/services/roomService';
import {
    subscribeToGame,
    fetchBets,
    submitBet,
    submitAnswer,
    fetchAnswers,
    fetchValidations,
    upsertValidation,
    updateRoomMeta,
    setRoomPhase,
    fetchFinalChoices,
    upsertFinalChoice,
    fetchFinalQuestion,
    upsertFinalQuestion,
    submitFinalAnswer,
    fetchFinalAnswers,
    fetchFinalValidations,
    upsertFinalValidation,
    setRoomPhaseIfCurrent,
} from '@/services/gameService';

type AnswerBoard = Record<string, { answer?: string; isCorrect?: boolean; hasAnswered: boolean }>;

function shallowEqualNumberRecord(a: Record<string, number>, b: Record<string, number>) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
        if (a[k] !== b[k]) return false;
    }
    return true;
}

function shallowEqualAnswerBoard(a: AnswerBoard, b: AnswerBoard) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
        const av = a[k];
        const bv = b[k];
        if (!bv) return false;
        if (av.hasAnswered !== bv.hasAnswered) return false;
        if ((av.answer || '') !== (bv.answer || '')) return false;
        if ((av.isCorrect ?? undefined) !== (bv.isCorrect ?? undefined)) return false;
    }
    return true;
}

function normalizeAnswerText(raw: string): string {
    let s = (raw || '').trim().toLowerCase();
    try {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch {
        // noop
    }

    // Strip Arabic diacritics and tatweel
    s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');

    // Keep latin, digits, and Arabic letters; collapse separators
    s = s.replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ');

    // Remove common articles for latin languages
    s = s.replace(/\b(the|a|an|le|la|les|un|une|des|el|al)\b/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

function isAnswerCorrect(answer: string, question: Question): boolean {
    const a = (answer || '').trim();
    const c = (question.correctAnswer || '').trim();
    if (!a || !c) return false;

    if (question.type === 'multiple-choice' || question.type === 'true-false') {
        return a.toLowerCase() === c.toLowerCase();
    }

    const na = normalizeAnswerText(a);
    const nc = normalizeAnswerText(c);
    return !!na && !!nc && na === nc;
}

export default function Game() {
    const router = useRouter();
    const { t, isRTL, language } = useLanguage();
    const { gameState, setGameState, currentPlayer, apiKey, aiTemperature } = useGame();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const compactHeight = Platform.OS === 'web' ? 900 : 760;
    const isDesktopWeb = Platform.OS === 'web' && windowWidth >= 1024;
    const isCompact = windowHeight < compactHeight || isDesktopWeb;
    const isTightLayout = isCompact;

    const gameStateRef = React.useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const refreshInFlightRef = React.useRef(false);
    const lastQuestionsSignatureRef = React.useRef<string>('');
    const autoAdvanceInFlightRef = React.useRef(false);
    const timeoutAdvanceInFlightRef = React.useRef(false);
    const submitInFlightRef = React.useRef(false);
    const personalFinalGenerationInFlightRef = React.useRef(false);
    const roomQuestionsCountRef = React.useRef<number>(0);
    const questionsCountRef = React.useRef<number>(0);
    const questionsGenerationInFlightRef = React.useRef(false);
    const questionsGenerationCooldownUntilRef = React.useRef<number>(0);
    const questionsByLanguageRef = React.useRef<Record<string, Question[]>>({});

    const answerBoardScopeRef = React.useRef<
        | { kind: 'normal'; questionIndex: number }
        | { kind: 'final' }
        | null
    >(null);

    const [phase, setPhase] = useState<GamePhase>('question');
    const phaseRef = React.useRef<GamePhase>('question');
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);
    const [selectedBet, setSelectedBet] = useState<number | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const currentQuestionIndexRef = React.useRef(0);
    useEffect(() => {
        currentQuestionIndexRef.current = currentQuestionIndex;
    }, [currentQuestionIndex]);

    const [phaseStartedAt, setPhaseStartedAt] = useState<string | null>(null);
    const [timerKey, setTimerKey] = useState(0);
    const [questions, setQuestions] = useState<Question[]>([]);

    useEffect(() => {
        questionsCountRef.current = questions.length;
    }, [questions.length]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [answerBoard, setAnswerBoard] = useState<AnswerBoard>({});
    const [finalChoices, setFinalChoices] = useState<Record<string, { wager: number | null; difficulty: Difficulty }>>({});
    const [finalMode, setFinalMode] = useState<'personalized' | 'shared'>('shared');
    const [finalQuestion, setFinalQuestion] = useState<Question | null>(null);
    const [isLoadingFinal, setIsLoadingFinal] = useState(false);
    const [isGeneratingPersonalFinal, setIsGeneratingPersonalFinal] = useState(false);
    const [finalWagerDraft, setFinalWagerDraft] = useState(0);

    const [betsByPlayerId, setBetsByPlayerId] = useState<Record<string, number>>({});
    const [usedBetsForPlayer, setUsedBetsForPlayer] = useState<number[]>([]);

    const answerChangedAtRef = React.useRef<number>(0);
    const betChangedAtRef = React.useRef<number>(0);

    const selectedAnswerRef = React.useRef<string | null>(null);
    useEffect(() => {
        selectedAnswerRef.current = selectedAnswer;
        answerChangedAtRef.current = Date.now();
    }, [selectedAnswer]);

    useEffect(() => {
        betChangedAtRef.current = Date.now();
    }, [selectedBet]);

    const subscriptionRef = React.useRef<{ unsubscribe: () => void } | null>(null);

    const activePlayer: Player | undefined = useMemo(() => {
        if (!gameState) return undefined;
        if (currentPlayer?.id) {
            return gameState.players.find((p) => p.id === currentPlayer.id) || currentPlayer;
        }
        return gameState.players.find((p) => p.isHost) || gameState.players[0];
    }, [gameState, currentPlayer]);

    const activeQuestion = useMemo(() => {
        if (phase.startsWith('final')) return finalQuestion;
        if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return undefined;
        return questions[currentQuestionIndex];
    }, [phase, finalQuestion, questions, currentQuestionIndex]);

    const timePerQuestionSeconds = useMemo(() => {
        const raw = (gameState as any)?.settings?.timePerQuestion;
        const v = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(v) || v <= 0) return 30;
        // Safety clamp: this value should come from the Create slider (10..60).
        if (v > 120) return 30;
        return Math.round(v);
    }, [gameState]);

    const phaseEndsAtMs = useMemo(() => {
        if (!phaseStartedAt) return undefined;
        if (!(phase === 'question' || phase === 'final-question')) return undefined;
        const started = new Date(phaseStartedAt).getTime();
        if (!Number.isFinite(started)) return undefined;
        return started + timePerQuestionSeconds * 1000;
    }, [phase, phaseStartedAt, timePerQuestionSeconds]);

    useEffect(() => {
        if (!gameState?.roomCode) return;
        if (!(phase === 'question' || phase === 'final-question')) return;
        if (typeof phaseEndsAtMs !== 'number' || !Number.isFinite(phaseEndsAtMs)) return;

        const hostId = gameState?.hostId;
        const isHostNow = !!currentPlayer?.id && !!hostId && currentPlayer.id === hostId;
        if (!isHostNow) return;

        const fromPhase = phase;
        const toPhase = phase === 'question' ? 'preview' : 'final-validation';
        const roomCode = gameState.roomCode;

        const runAdvance = () => {
            if (timeoutAdvanceInFlightRef.current) return;
            timeoutAdvanceInFlightRef.current = true;
            setRoomPhaseIfCurrent({ roomCode, fromPhase, toPhase })
                .catch((err) => {
                    console.error('Failed to advance on timeout', err);
                })
                .finally(() => {
                    timeoutAdvanceInFlightRef.current = false;
                });
        };

        const msRemaining = phaseEndsAtMs - Date.now();
        if (msRemaining <= 0) {
            runAdvance();
            return;
        }

        const timeoutId = setTimeout(runAdvance, msRemaining + 80);
        return () => clearTimeout(timeoutId);
    }, [currentPlayer?.id, gameState?.hostId, gameState?.roomCode, phase, phaseEndsAtMs]);

    const isFinalRound = phase.startsWith('final');
    const totalQuestions = isFinalRound ? 1 : questions.length;
    const currentFinalChoice = activePlayer
        ? (finalChoices[activePlayer.id] || { wager: null, difficulty: 'medium' as Difficulty })
        : { wager: null, difficulty: 'medium' as Difficulty };
    const currentBetDisplay = isFinalRound
        ? currentFinalChoice.wager
        : (betsByPlayerId[activePlayer?.id || ''] ?? selectedBet ?? null);

    const difficultyVote = useMemo(() => {
        const counts = { easy: 0, medium: 0, hard: 0 } as Record<'easy' | 'medium' | 'hard', number>;
        (gameState?.players || []).forEach((p) => {
            const raw = finalChoices[p.id]?.difficulty || 'medium';
            const d = (raw === 'easy' || raw === 'hard' ? raw : 'medium') as 'easy' | 'medium' | 'hard';
            counts[d] += 1;
        });
        const entries = (Object.entries(counts) as Array<['easy' | 'medium' | 'hard', number]>);
        let best: 'easy' | 'medium' | 'hard' = 'medium';
        let bestCount = -1;
        let tie = false;
        for (const [d, c] of entries) {
            if (c > bestCount) {
                best = d;
                bestCount = c;
                tie = false;
            } else if (c === bestCount) {
                tie = true;
            }
        }
        return { counts, selected: (tie ? 'medium' : best) as Difficulty };
    }, [finalChoices, gameState?.players]);

    const isHost = !!currentPlayer?.id && !!gameState?.hostId && currentPlayer.id === gameState.hostId;
    const showCorrectAnswer =
        phase === 'validation' ||
        phase === 'scoring' ||
        phase === 'final-validation' ||
        phase === 'final-scoring';

    useEffect(() => {
        if (
            (phase === 'question') ||
            (phase === 'final-question')
        ) {
            setSelectedAnswer(null);
            setSelectedBet(null);
        }
    }, [currentQuestionIndex, phase]);

    useEffect(() => {
        if (phase === 'question' || phase === 'final-question') {
            setTimerKey((prev) => prev + 1);
        }
    }, [phase, currentQuestionIndex]);

    useEffect(() => {
        if (phase !== 'final-wager') return;
        if (!activePlayer?.id) return;
        const saved = finalChoices[activePlayer.id]?.wager;
        const allowedWagers = [0, 10, 20];
        const next = typeof saved === 'number' && Number.isFinite(saved) && allowedWagers.includes(saved) ? saved : 0;
        setFinalWagerDraft((prev) => (prev === next ? prev : next));
    }, [activePlayer?.id, finalChoices, phase]);

    useEffect(() => {
        if (!(phase === 'question' || phase === 'final-question')) return;
        setPhaseStartedAt((prev) => prev || new Date().toISOString());
    }, [phase]);

    const handleSubmit = async () => {
        if (!gameState?.roomCode || !activePlayer?.id) return;
        if (submitInFlightRef.current) return;

        const answer = (selectedAnswer || '').trim();
        if (!answer) return;

        try {
            submitInFlightRef.current = true;

            if (phase.startsWith('final')) {
                await submitFinalAnswer({ roomCode: gameState.roomCode, playerId: activePlayer.id, answer });
                return;
            }

            const resolveSmallestUnusedBet = (total: number, used: number[]) => {
                if (!Number.isFinite(total) || total <= 0) return null;
                for (let i = 1; i <= total; i++) {
                    if (!used.includes(i)) return i;
                }
                return null;
            };

            const persistedBet = betsByPlayerId[activePlayer.id];
            let betValue = typeof persistedBet === 'number' && Number.isFinite(persistedBet)
                ? persistedBet
                : (typeof selectedBet === 'number' && Number.isFinite(selectedBet) ? selectedBet : null);

            if (typeof betValue === 'number' && usedBetsForPlayer.includes(betValue)) {
                betValue = null;
            }

            if (typeof betValue !== 'number' || !Number.isFinite(betValue) || betValue <= 0) {
                const total =
                    questions.length ||
                    roomQuestionsCountRef.current ||
                    gameState.settings.numberOfQuestions ||
                    0;
                const smallest = resolveSmallestUnusedBet(total, usedBetsForPlayer || []);
                if (!smallest) {
                    Alert.alert(t('placeBet'), t('betAlreadyUsed'));
                    return;
                }
                betValue = smallest;
                setSelectedBet(smallest);
            }

            await submitBet({
                roomCode: gameState.roomCode,
                questionIndex: currentQuestionIndex,
                playerId: activePlayer.id,
                betValue,
            });
            await submitAnswer({
                roomCode: gameState.roomCode,
                questionIndex: currentQuestionIndex,
                playerId: activePlayer.id,
                answer,
            });

            setAnswerBoard((prev) => {
                const existing = prev[activePlayer.id];
                if (existing?.hasAnswered && (existing.answer || '') === answer) return prev;
                return {
                    ...prev,
                    [activePlayer.id]: {
                        ...existing,
                        hasAnswered: true,
                        answer,
                    },
                };
            });

            const nextUsed = Array.from(new Set([...(usedBetsForPlayer || []), betValue])).sort((a, b) => a - b);
            setUsedBetsForPlayer(nextUsed);
            await updatePlayerState({
                roomCode: gameState.roomCode,
                playerId: activePlayer.id,
                patch: {
                    used_bets: nextUsed,
                },
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit';
            const msgLower = msg.toLowerCase();
            const duplicateBet =
                msgLower.includes('unique') && (msgLower.includes('bet_value') || msgLower.includes('bets'));
            if (duplicateBet) {
                Alert.alert(t('placeBet'), t('betAlreadyUsed'));
            } else {
                Alert.alert('Supabase', msg);
            }
        } finally {
            submitInFlightRef.current = false;
        }
    };

    useEffect(() => {
        if (!gameState?.roomCode || !activePlayer?.id) return;
        if (phase !== 'question') return;
        if (!activeQuestion || activeQuestion.type === 'open-ended') {
            // Open-ended: only auto-submit when the bet was chosen after the latest typing.
            if (betChangedAtRef.current <= answerChangedAtRef.current) return;
        }

        const answer = (selectedAnswer || '').trim();
        if (!answer) return;

        const bet = typeof selectedBet === 'number' && Number.isFinite(selectedBet) ? selectedBet : null;
        if (!bet || bet <= 0) return;

        const already = !!answerBoard[activePlayer.id]?.hasAnswered;
        if (already) return;
        if (submitInFlightRef.current) return;

        handleSubmit().catch(() => undefined);
    }, [activePlayer?.id, activeQuestion, answerBoard, gameState?.roomCode, phase, selectedAnswer, selectedBet]);

    useEffect(() => {
        if (!isSupabaseConfigured || !gameState?.roomCode) return;

        let cancelled = false;
        let refreshQueued = false;
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;
        let generationCooldownTimer: ReturnType<typeof setTimeout> | null = null;
        const debounceMs = Platform.OS === 'web' ? 240 : 60;

        const scheduleRefresh = () => {
            refreshQueued = true;
            if (refreshTimer) return;
            refreshTimer = setTimeout(() => {
                refreshTimer = null;
                if (!refreshQueued) return;
                refreshQueued = false;
                refresh().catch(() => undefined);
            }, debounceMs);
        };

        const refresh = async () => {
            if (refreshInFlightRef.current) return;
            refreshInFlightRef.current = true;
            try {
                const roomCode = gameState.roomCode;

                let includeQuestions =
                    lastQuestionsSignatureRef.current === '' ||
                    roomQuestionsCountRef.current === 0 ||
                    questionsCountRef.current === 0 ||
                    currentQuestionIndexRef.current >= questionsCountRef.current;

                let roomState = await fetchRoomState(roomCode, { includeQuestions });

                const rawIndexFirst: any = (roomState.room as any).current_question_index;
                const parsedIndexFirst = typeof rawIndexFirst === 'number' ? rawIndexFirst : Number(rawIndexFirst);
                const nextIndexFirst = Number.isFinite(parsedIndexFirst) ? parsedIndexFirst : 0;
                const shouldRefetchQuestions = !includeQuestions && (questionsCountRef.current === 0 || nextIndexFirst >= questionsCountRef.current);
                if (shouldRefetchQuestions) {
                    includeQuestions = true;
                    roomState = await fetchRoomState(roomCode, { includeQuestions: true });
                }

                const decodeRoomQuestions = (field: any, settings: GameSettings) => {
                    const baseLanguage: Language = (settings.language as any) || 'en';
                    let resolvedBase: Language = baseLanguage;
                    let byLanguageRaw: Record<string, any[]> = {};

                    if (Array.isArray(field)) {
                        byLanguageRaw[resolvedBase] = field;
                    } else if (field && typeof field === 'object') {
                        const maybeBase = (field as any)?.baseLanguage;
                        if (typeof maybeBase === 'string' && (maybeBase === 'en' || maybeBase === 'fr' || maybeBase === 'ar')) {
                            resolvedBase = maybeBase as Language;
                        }
                        const by = (field as any)?.byLanguage;
                        if (by && typeof by === 'object' && !Array.isArray(by)) {
                            Object.keys(by).forEach((k) => {
                                const v = (by as any)[k];
                                if (Array.isArray(v)) {
                                    byLanguageRaw[k] = v;
                                }
                            });
                        }
                    }

                    return { baseLanguage: resolvedBase, byLanguageRaw };
                };

                const questionsField = includeQuestions ? (roomState.room as any).questions : null;
                const decoded = includeQuestions ? decodeRoomQuestions(questionsField, roomState.room.settings) : null;
                const questionsRaw = includeQuestions
                    ? (decoded?.byLanguageRaw?.[language] ||
                        decoded?.byLanguageRaw?.[roomState.room.settings.language] ||
                        decoded?.byLanguageRaw?.[decoded?.baseLanguage || roomState.room.settings.language] ||
                        decoded?.byLanguageRaw?.en ||
                        decoded?.byLanguageRaw?.fr ||
                        decoded?.byLanguageRaw?.ar ||
                        [])
                    : null;
                const nextPhase = roomState.room.phase as GamePhase;
                const phaseChanged = phaseRef.current !== nextPhase;
                const rawQuestionIndex: any = (roomState.room as any).current_question_index;
                const parsedQuestionIndex = typeof rawQuestionIndex === 'number'
                    ? rawQuestionIndex
                    : Number(rawQuestionIndex);
                const nextQuestionIndex = Number.isFinite(parsedQuestionIndex) ? parsedQuestionIndex : 0;
                const questionIndexChanged = currentQuestionIndexRef.current !== nextQuestionIndex;

                const serverPhaseStartedAt = (roomState.room as any)?.phase_started_at;
                const serverFinalMode = (roomState.room as any)?.final_mode;
                const resolvedFinalMode = serverFinalMode === 'personalized' ? 'personalized' : 'shared';
                const meta: any = {
                    phase: nextPhase,
                    currentQuestionIndex: nextQuestionIndex,
                    phaseStartedAt: typeof serverPhaseStartedAt === 'string'
                        ? serverPhaseStartedAt
                        : ((phaseChanged || questionIndexChanged) ? new Date().toISOString() : null),
                    finalMode: resolvedFinalMode,
                    questions: questionsRaw,
                    questionsByLanguageRaw: decoded?.byLanguageRaw || null,
                    questionsBaseLanguage: decoded?.baseLanguage || roomState.room.settings.language,
                };

                const baseRaw = meta.questionsByLanguageRaw && typeof meta.questionsBaseLanguage === 'string'
                    ? meta.questionsByLanguageRaw[meta.questionsBaseLanguage]
                    : null;
                const loadedCount = Array.isArray(baseRaw)
                    ? baseRaw.length
                    : (Array.isArray(meta.questions) ? meta.questions.length : 0);
                if (loadedCount > 0 && roomQuestionsCountRef.current !== loadedCount) {
                    roomQuestionsCountRef.current = loadedCount;
                }
                const normalCount = roomQuestionsCountRef.current || loadedCount || roomState.room.settings.numberOfQuestions || 0;

                // Guard: if DB says final-wager but we still have remaining normal questions, auto-correct back.
                if (
                    meta.phase === 'final-wager' &&
                    normalCount > 0 &&
                    meta.currentQuestionIndex < normalCount - 1 &&
                    currentPlayer?.id === roomState.room.host_player_id
                ) {
                    await updateRoomMeta({
                        roomCode,
                        patch: {
                            phase: 'question',
                            phase_started_at: new Date().toISOString(),
                        },
                    });
                    return;
                }

                const normalizeQuestions = (raw: any[], settings: GameSettings): Question[] => {
                    const desiredType = settings.questionType;
                    return (Array.isArray(raw) ? raw : []).map((q: any, index: number) => {
                        const correctAnswer = typeof q?.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
                        const text = typeof q?.text === 'string' ? q.text.trim() : '';
                        const hint = typeof q?.hint === 'string' ? q.hint.trim() : undefined;
                        const difficulty = (q?.difficulty || settings.difficulty || 'medium') as Difficulty;
                        const id = typeof q?.id === 'string' ? q.id : `q-${index}`;

                        let options: string[] | undefined = Array.isArray(q?.options)
                            ? (q.options as unknown[])
                                .map((o) => (typeof o === 'string' ? o.trim() : ''))
                                .filter((o) => o.length > 0)
                            : undefined;

                        let type = desiredType;

                        if (desiredType === 'multiple-choice') {
                            if (options && correctAnswer) {
                                if (!options.includes(correctAnswer)) {
                                    options = [correctAnswer, ...options];
                                }
                                options = Array.from(new Set(options)).slice(0, 4);
                            }
                            if (!options || options.length < 2) {
                                type = 'open-ended';
                                options = undefined;
                            }
                        } else {
                            options = undefined;
                        }

                        return {
                            id,
                            text,
                            type,
                            options,
                            correctAnswer,
                            hint,
                            difficulty,
                        };
                    });
                };

                if (cancelled) return;

                setPhase((prev) => (prev === (meta.phase as GamePhase) ? prev : (meta.phase as GamePhase)));
                setCurrentQuestionIndex((prev) => (prev === meta.currentQuestionIndex ? prev : meta.currentQuestionIndex));
                setPhaseStartedAt((prev) => {
                    if (typeof meta.phaseStartedAt === 'string') {
                        return prev === meta.phaseStartedAt ? prev : meta.phaseStartedAt;
                    }
                    if (meta.phaseStartedAt === null) return prev;
                    return prev;
                });
                setFinalMode((prev) => (prev === meta.finalMode ? prev : meta.finalMode));

                if (includeQuestions) {
                    const rawByLang = meta.questionsByLanguageRaw && typeof meta.questionsByLanguageRaw === 'object'
                        ? meta.questionsByLanguageRaw
                        : null;
                    const normalizedByLang: Record<string, Question[]> = {};
                    if (rawByLang) {
                        Object.keys(rawByLang).forEach((k) => {
                            normalizedByLang[k] = normalizeQuestions(rawByLang[k], roomState.room.settings);
                        });
                    }

                    const selected = Array.isArray(meta.questions) ? meta.questions : [];
                    const normalizedSelected = normalizeQuestions(selected, roomState.room.settings);

                    const display =
                        normalizedByLang[language] ||
                        normalizedByLang[roomState.room.settings.language] ||
                        normalizedByLang[meta.questionsBaseLanguage] ||
                        normalizedSelected;

                    const typeSig = display.map((q) => `${q.type}:${q.options?.length || 0}`).join('|');
                    const signature = `${roomState.room.settings.questionType}:${display.length}:${typeSig}:${language}`;
                    if (signature !== lastQuestionsSignatureRef.current) {
                        lastQuestionsSignatureRef.current = signature;
                        setQuestions(display);
                    }

                    if (Object.keys(normalizedByLang).length > 0) {
                        questionsByLanguageRef.current = normalizedByLang;
                    }

                    if (display.length > 0) {
                        setIsLoading(false);
                    } else {
                        setIsLoading(true);
                    }
                }

                setGameState((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        roomCode: roomState.room.room_code,
                        hostId: roomState.room.host_player_id,
                        settings: roomState.room.settings,
                        phase: meta.phase as any,
                        players: roomState.players,
                    };
                });

                if (meta.phase === 'results') {
                    router.replace('/results');
                    return;
                }

                // Ensure normal questions exist (generated once by host).
                // IMPORTANT: only attempt generation if we actually fetched questions from the DB (includeQuestions).
                // When includeQuestions=false, meta.questions is null (unknown), so do not treat it as "missing".
                const fetchedQuestionsEmpty = includeQuestions && Array.isArray(meta.questions) && meta.questions.length === 0;
                if (fetchedQuestionsEmpty && (currentPlayer?.id === roomState.room.host_player_id)) {
                    if (Date.now() < questionsGenerationCooldownUntilRef.current) {
                        const remainingMs = questionsGenerationCooldownUntilRef.current - Date.now();
                        const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
                        setLoadingMessage(`Gemini is busy. Retrying in ${seconds}s.`);

                        if (!generationCooldownTimer) {
                            generationCooldownTimer = setTimeout(() => {
                                generationCooldownTimer = null;
                                if (cancelled) return;
                                scheduleRefresh();
                            }, Math.max(250, remainingMs + 80));
                        }
                        return;
                    }
                    if (questionsGenerationInFlightRef.current) {
                        setLoadingMessage(t('generatingQuestions'));
                        return;
                    }
                    const hostKey = gameState.hostApiKey || apiKey;
                    if (!hostKey) {
                        setLoadingMessage(t('missingApiKeyHost'));
                        return;
                    }

                    questionsGenerationInFlightRef.current = true;
                    setLoadingMessage(t('generatingQuestions'));
                    const baseLang = (roomState.room.settings.language as Language) || 'en';
                    const result = await generateQuestions(roomState.room.settings, hostKey, { temperature: aiTemperature });
                    questionsGenerationInFlightRef.current = false;
                    if (cancelled) return;
                    if (result.error) {
                        if (result.code === 'RATE_LIMITED' && (result as any).retryAfterMs) {
                            const retryAfterMs = Number((result as any).retryAfterMs);
                            questionsGenerationCooldownUntilRef.current = Date.now() + Math.max(1000, retryAfterMs);
                            setLoadingMessage(result.error);
                            return;
                        }

                        if (result.code === 'SERVICE_UNAVAILABLE' && (result as any).retryAfterMs) {
                            const retryAfterMs = Number((result as any).retryAfterMs);
                            questionsGenerationCooldownUntilRef.current = Date.now() + Math.max(1000, retryAfterMs);
                            setLoadingMessage(result.error);
                            return;
                        }

                        questionsGenerationCooldownUntilRef.current = Date.now() + 60_000;
                        if (result.code === 'QUOTA_EXCEEDED') {
                            Alert.alert(t('aiQuotaExceededTitle'), t('aiQuotaExceededDesc'), [
                                { text: t('cancel'), style: 'cancel', onPress: () => router.replace('/lobby') },
                                { text: t('goToSettings'), onPress: () => router.push('/settings') },
                            ]);
                            return;
                        }
                        if (result.code === 'INVALID_API_KEY') {
                            Alert.alert(t('aiInvalidApiKeyTitle'), t('aiInvalidApiKeyDesc'), [
                                { text: t('cancel'), style: 'cancel', onPress: () => router.replace('/lobby') },
                                { text: t('goToSettings'), onPress: () => router.push('/settings') },
                            ]);
                            return;
                        }

                        Alert.alert(t('loading'), result.error);
                        router.replace('/lobby');
                        return;
                    }
                    if (result.questions && result.questions.length > 0) {
                        const baseQuestions = result.questions;
                        const languagesInRoom = Array.from(
                            new Set(
                                (roomState.players || [])
                                    .map((p) => p.language)
                                    .filter((l): l is Language => l === 'en' || l === 'fr' || l === 'ar')
                            )
                        );
                        const targets = languagesInRoom.filter((l) => l !== baseLang);
                        const byLanguage: Record<string, Question[]> = {
                            [baseLang]: baseQuestions,
                        };

                        for (const targetLanguage of targets) {
                            const tr = await translateQuestions({
                                sourceQuestions: baseQuestions,
                                sourceLanguage: baseLang,
                                targetLanguage,
                                apiKey: hostKey,
                                temperature: aiTemperature,
                            });
                            if (!tr?.error && tr?.questions?.length) {
                                byLanguage[targetLanguage] = tr.questions;
                            }
                            if (tr?.code === 'RATE_LIMITED' || tr?.code === 'SERVICE_UNAVAILABLE') {
                                break;
                            }
                        }

                        await updateRoomQuestions({
                            roomCode,
                            questions: {
                                baseLanguage: baseLang,
                                byLanguage,
                            },
                        });
                        // Force the next refresh to re-fetch questions from the DB.
                        lastQuestionsSignatureRef.current = '';
                        roomQuestionsCountRef.current = 0;
                        return;
                    }
                }

                if (fetchedQuestionsEmpty && currentPlayer?.id !== roomState.room.host_player_id) {
                    setLoadingMessage(t('waitingForHost'));
                }

                // Load gameplay state for current phase
                if (!currentPlayer?.id) return;

                if (!meta.phase.startsWith('final')) {
                    const shouldFetchValidations =
                        meta.phase === 'validation' ||
                        meta.phase === 'scoring';

                    const [bets, answers, validations] = await Promise.all([
                        fetchBets({ roomCode, questionIndex: meta.currentQuestionIndex }),
                        fetchAnswers({ roomCode, questionIndex: meta.currentQuestionIndex }),
                        shouldFetchValidations
                            ? fetchValidations({ roomCode, questionIndex: meta.currentQuestionIndex })
                            : Promise.resolve([] as { player_id: string; is_correct: boolean }[]),
                    ] as const);

                    const betMap: Record<string, number> = {};
                    bets.forEach((b) => {
                        betMap[b.player_id] = b.bet_value;
                    });
                    setBetsByPlayerId((prev) => (shallowEqualNumberRecord(prev, betMap) ? prev : betMap));

                    const meFromRoom = roomState.players.find((p) => p.id === currentPlayer.id);
                    const nextUsed = Array.from(new Set([...(meFromRoom?.usedBets || [])])).sort((a, b) => a - b);
                    setUsedBetsForPlayer((prev) => {
                        if (prev.length !== nextUsed.length) return nextUsed;
                        for (let i = 0; i < prev.length; i++) {
                            if (prev[i] !== nextUsed[i]) return nextUsed;
                        }
                        return prev;
                    });

                    const answerMap: Record<string, string> = {};
                    answers.forEach((a) => {
                        answerMap[a.player_id] = a.answer;
                    });
                    const validationMap: Record<string, boolean> = {};
                    validations.forEach((v) => {
                        validationMap[v.player_id] = v.is_correct;
                    });

                    const board: AnswerBoard = {};
                    roomState.players.forEach((p) => {
                        const ans = answerMap[p.id];
                        const hasAnswered = typeof ans === 'string' && ans.length > 0;
                        board[p.id] = {
                            hasAnswered,
                            answer: hasAnswered ? ans : undefined,
                            isCorrect: validationMap[p.id],
                        };
                    });
                    setAnswerBoard((prev) => (shallowEqualAnswerBoard(prev, board) ? prev : board));
                    answerBoardScopeRef.current = { kind: 'normal', questionIndex: meta.currentQuestionIndex };
                    const serverAnswer = answerMap[currentPlayer.id];
                    if (typeof serverAnswer === 'string') {
                        const serverTrimmed = serverAnswer.trim();
                        const local = selectedAnswerRef.current;
                        const localTrimmed = (local || '').trim();
                        const shouldSync = serverTrimmed.length > 0 || localTrimmed.length === 0;
                        if (shouldSync) {
                            setSelectedAnswer(serverAnswer);
                        }
                    }

                    const serverBet = betMap[currentPlayer.id];
                    if (typeof serverBet === 'number') {
                        setSelectedBet(serverBet);
                    }
                } else {
                    const shouldFetchFinalValidations =
                        meta.phase === 'final-validation' ||
                        meta.phase === 'final-scoring';

                    const [choices, myQuestion, finalAnswers, finalValidations] = await Promise.all([
                        fetchFinalChoices(roomCode),
                        fetchFinalQuestion({ roomCode, playerId: currentPlayer.id }),
                        fetchFinalAnswers(roomCode),
                        shouldFetchFinalValidations
                            ? fetchFinalValidations(roomCode)
                            : Promise.resolve([] as { player_id: string; is_correct: boolean }[]),
                    ] as const);

                    const nextChoices: Record<string, { wager: number | null; difficulty: Difficulty }> = {};
                    choices.forEach((c) => {
                        const wager = typeof c.wager === 'number' ? c.wager : null;
                        const difficulty = (c.difficulty as Difficulty) || 'medium';
                        nextChoices[c.player_id] = { wager, difficulty };
                    });
                    setFinalChoices((prev) => {
                        const aKeys = Object.keys(prev);
                        const bKeys = Object.keys(nextChoices);
                        if (aKeys.length !== bKeys.length) return nextChoices;
                        for (const k of bKeys) {
                            const av = prev[k];
                            const bv = nextChoices[k];
                            if (!av || !bv) return nextChoices;
                            if (av.wager !== bv.wager || av.difficulty !== bv.difficulty) return nextChoices;
                        }
                        return prev;
                    });

                    setFinalQuestion(myQuestion);

                    const ansMap: Record<string, string> = {};
                    finalAnswers.forEach((a) => {
                        ansMap[a.player_id] = a.answer;
                    });
                    const valMap: Record<string, boolean> = {};
                    finalValidations.forEach((v) => {
                        valMap[v.player_id] = v.is_correct;
                    });

                    const board: AnswerBoard = {};
                    roomState.players.forEach((p) => {
                        const ans = ansMap[p.id];
                        const hasAnswered = typeof ans === 'string' && ans.length > 0;
                        board[p.id] = {
                            hasAnswered,
                            answer: hasAnswered ? ans : undefined,
                            isCorrect: valMap[p.id],
                        };
                    });
                    setAnswerBoard((prev) => (shallowEqualAnswerBoard(prev, board) ? prev : board));
                    answerBoardScopeRef.current = { kind: 'final' };
                    const serverAnswer = ansMap[currentPlayer.id];
                    if (typeof serverAnswer === 'string') {
                        const serverTrimmed = serverAnswer.trim();
                        const local = selectedAnswerRef.current;
                        const localTrimmed = (local || '').trim();
                        const shouldSync = serverTrimmed.length > 0 || localTrimmed.length === 0;
                        if (shouldSync) {
                            setSelectedAnswer(serverAnswer);
                        }
                    }
                }
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setIsLoading(false);
            } finally {
                refreshInFlightRef.current = false;
                if (refreshQueued) {
                    scheduleRefresh();
                }
            }
        };

        refresh();
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToGame({ roomCode: gameState.roomCode, onChange: scheduleRefresh });

        let pollTimeout: ReturnType<typeof setTimeout> | null = null;
        const schedulePoll = () => {
            const web = Platform.OS === 'web';
            const hostId = gameStateRef.current?.hostId;
            const isHostNow = !!currentPlayer?.id && !!hostId && currentPlayer.id === hostId;
            const p = phaseRef.current;
            const isActivePhase =
                p === 'question' ||
                p === 'preview' ||
                p === 'validation' ||
                p === 'scoring' ||
                p === 'final-wager' ||
                p === 'final-question' ||
                p === 'final-validation' ||
                p === 'final-scoring';

            const pollMs = web ? (isHostNow || isActivePhase ? 2500 : 12000) : 2500;
            pollTimeout = setTimeout(() => {
                scheduleRefresh();
                schedulePoll();
            }, pollMs);
        };
        schedulePoll();
        return () => {
            cancelled = true;
            if (pollTimeout) {
                clearTimeout(pollTimeout);
                pollTimeout = null;
            }
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }
            if (generationCooldownTimer) {
                clearTimeout(generationCooldownTimer);
                generationCooldownTimer = null;
            }
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
        };
    }, [apiKey, currentPlayer?.id, gameState?.roomCode, gameState?.hostApiKey, gameState?.playerApiKeys, language, router, setGameState, t]);

    useEffect(() => {
        if (!gameState?.roomCode) return;
        if (autoAdvanceInFlightRef.current) return;

        if (phase === 'question') {
            const scope = answerBoardScopeRef.current;
            if (!scope || scope.kind !== 'normal' || scope.questionIndex !== currentQuestionIndex) {
                return;
            }
        }

        if (phase === 'final-question') {
            const scope = answerBoardScopeRef.current;
            if (!scope || scope.kind !== 'final') {
                return;
            }
        }

        const allAnswered = gameState.players.every((p) => !!answerBoard[p.id]?.hasAnswered);
        if (!allAnswered) return;

        if (phase === 'question') {
            autoAdvanceInFlightRef.current = true;
            setRoomPhaseIfCurrent({ roomCode: gameState.roomCode, fromPhase: 'question', toPhase: 'preview' })
                .catch((err) => {
                    console.error('Failed to auto-advance to preview', err);
                })
                .finally(() => {
                    autoAdvanceInFlightRef.current = false;
                });
        }

        if (phase === 'final-question') {
            autoAdvanceInFlightRef.current = true;
            setRoomPhaseIfCurrent({ roomCode: gameState.roomCode, fromPhase: 'final-question', toPhase: 'final-validation' })
                .catch((err) => {
                    console.error('Failed to auto-advance to final-validation', err);
                })
                .finally(() => {
                    autoAdvanceInFlightRef.current = false;
                });
        }
    }, [answerBoard, currentQuestionIndex, gameState?.players, gameState?.roomCode, phase]);

    if (!gameState || !activePlayer) {
        return (
            <SafeAreaView className="flex-1 bg-background relative">
                <ScreenBackground variant="game" />
                <View className="flex-1 w-full items-center justify-center p-4">
                    <ActivityIndicator size="large" color="#C17F59" />
                    <Text className="text-base text-foreground mt-4 font-bold font-sans">{t('loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (isLoading) {
        const isHostLoading = !!currentPlayer && (currentPlayer.isHost || currentPlayer.id === gameState.hostId);
        const isWaitingForHostLoading = loadingMessage === t('waitingForHost');
        const showGenerationDetail =
            loadingMessage === '' ||
            loadingMessage === t('generatingQuestions') ||
            isWaitingForHostLoading;
        return (
            <SafeAreaView className="flex-1 bg-background relative">
                <ScreenBackground variant="game" />
                <View className="flex-1 w-full items-center justify-center px-4">
                    <Logo size={isCompact ? 'md' : 'lg'} animated />
                    <View className={`mt-6 w-full max-w-xl items-center bg-white ${isCompact ? 'p-5' : 'p-6'} rounded-lg border-2 border-foreground shadow-[4px_4px_0px_#2B1F17] transform rotate-1`}>
                        <ActivityIndicator size="large" color="#C17F59" />
                        <Text className={`${isCompact ? 'text-xl mt-3' : 'text-2xl mt-4'} font-display font-bold text-foreground text-center`}>
                            {loadingMessage || t('loading')}
                        </Text>
                        {(isHostLoading || isWaitingForHostLoading) && showGenerationDetail && (
                            <Text className={`${isCompact ? 'text-sm mt-2' : 'text-base mt-2'} text-muted-foreground text-center font-sans w-full px-2`}>
                                {t('generatingQuestions')} {gameState.settings.numberOfQuestions} {t('questionsAbout')} {gameState.settings.customTheme || t(gameState.settings.theme)}
                            </Text>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const handleAnswerSubmit = async (answer: string) => {
        if (!gameState?.roomCode || !activePlayer?.id) return;
        setSelectedAnswer(answer);
    };

    const handleTimerComplete = () => {
        if (!gameState?.roomCode) return;
        const hostId = gameState?.hostId;
        const isHostNow = !!currentPlayer?.id && !!hostId && currentPlayer.id === hostId;
        if (!isHostNow) return;
        if (phase === 'question') {
            setRoomPhaseIfCurrent({ roomCode: gameState.roomCode, fromPhase: 'question', toPhase: 'preview' }).catch((err) => {
                console.error('Failed to advance on timer (question->preview)', err);
            });
        }
        if (phase === 'final-question') {
            setRoomPhaseIfCurrent({ roomCode: gameState.roomCode, fromPhase: 'final-question', toPhase: 'final-validation' }).catch((err) => {
                console.error('Failed to advance on timer (final-question->final-validation)', err);
            });
        }
    };

    const handleRoundTimerComplete = () => {
        handleSubmit().catch(() => undefined);
        handleTimerComplete();
    };

    const handleRevealAnswer = async () => {
        if (!isHost || !gameState?.roomCode || !activeQuestion) return;

        // Auto-validate based on exact match; host can override via toggles.
        try {
            if (!phase.startsWith('final')) {
                const answers = await fetchAnswers({ roomCode: gameState.roomCode, questionIndex: currentQuestionIndex });
                const answerMap: Record<string, string> = {};
                answers.forEach((a) => {
                    answerMap[a.player_id] = a.answer;
                });
                await Promise.all(
                    gameState.players.map((p) => {
                        const a = (answerMap[p.id] || '').trim();
                        const langKey = (p.language || gameState.settings.language || 'en') as any;
                        const qForPlayer =
                            questionsByLanguageRef.current?.[langKey]?.[currentQuestionIndex] ||
                            questionsByLanguageRef.current?.[gameState.settings.language]?.[currentQuestionIndex] ||
                            activeQuestion;
                        const isCorrect = a ? isAnswerCorrect(a, qForPlayer) : false;
                        return upsertValidation({
                            roomCode: gameState.roomCode,
                            questionIndex: currentQuestionIndex,
                            playerId: p.id,
                            isCorrect,
                            validatedBy: currentPlayer?.id,
                        });
                    })
                );
                await setRoomPhase({ roomCode: gameState.roomCode, phase: 'validation' });
            } else {
                const answers = await fetchFinalAnswers(gameState.roomCode);
                const answerMap: Record<string, string> = {};
                answers.forEach((a) => {
                    answerMap[a.player_id] = a.answer;
                });

                const questionsForPlayers = await Promise.all(
                    gameState.players.map((p) => fetchFinalQuestion({ roomCode: gameState.roomCode, playerId: p.id }))
                );
                const questionByPlayerId: Record<string, Question | null> = {};
                gameState.players.forEach((p, idx) => {
                    questionByPlayerId[p.id] = questionsForPlayers[idx] || null;
                });

                await Promise.all(
                    gameState.players.map((p) => {
                        const a = (answerMap[p.id] || '').trim();
                        const qForPlayer = questionByPlayerId[p.id] || activeQuestion;
                        const isCorrect = a ? isAnswerCorrect(a, qForPlayer) : false;
                        return upsertFinalValidation({
                            roomCode: gameState.roomCode,
                            playerId: p.id,
                            isCorrect,
                            validatedBy: currentPlayer?.id,
                        });
                    })
                );
                await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-validation' });
            }
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to reveal');
        }
    };

    const toggleValidation = async (playerId: string, isCorrect: boolean) => {
        if (!isHost || !gameState?.roomCode) return;
        try {
            if (!phase.startsWith('final')) {
                await upsertValidation({
                    roomCode: gameState.roomCode,
                    questionIndex: currentQuestionIndex,
                    playerId,
                    isCorrect,
                    validatedBy: currentPlayer?.id,
                });
            } else {
                await upsertFinalValidation({
                    roomCode: gameState.roomCode,
                    playerId,
                    isCorrect,
                    validatedBy: currentPlayer?.id,
                });
            }
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to validate');
        }
    };

    const applyScores = async () => {
        if (!isHost || !gameState?.roomCode) return;

        try {
            if (!phase.startsWith('final')) {
                const [bets, validations] = await Promise.all([
                    fetchBets({ roomCode: gameState.roomCode, questionIndex: currentQuestionIndex }),
                    fetchValidations({ roomCode: gameState.roomCode, questionIndex: currentQuestionIndex }),
                ]);
                const betMap: Record<string, number> = {};
                bets.forEach((b) => {
                    betMap[b.player_id] = b.bet_value;
                });
                const valMap: Record<string, boolean> = {};
                validations.forEach((v) => {
                    valMap[v.player_id] = v.is_correct;
                });

                await Promise.all(
                    gameState.players.map(async (p) => {
                        const wager = betMap[p.id] || 0;
                        const correct = valMap[p.id];
                        const delta = correct ? wager : 0;
                        const nextUsed = Array.from(new Set([...(p.usedBets || []), ...(wager ? [wager] : [])]));
                        await updatePlayerState({
                            roomCode: gameState.roomCode,
                            playerId: p.id,
                            patch: {
                                score: p.score + delta,
                                used_bets: nextUsed,
                            },
                        });
                    })
                );

                await setRoomPhase({ roomCode: gameState.roomCode, phase: 'scoring' });
                return;
            }

            const [choices, validations] = await Promise.all([
                fetchFinalChoices(gameState.roomCode),
                fetchFinalValidations(gameState.roomCode),
            ]);

            const wagerMap: Record<string, number> = {};
            choices.forEach((c) => {
                wagerMap[c.player_id] = c.wager;
            });
            const valMap: Record<string, boolean> = {};
            validations.forEach((v) => {
                valMap[v.player_id] = v.is_correct;
            });

            await Promise.all(
                gameState.players.map(async (p) => {
                    const wager = wagerMap[p.id] || 0;
                    const correct = valMap[p.id];
                    const delta = correct ? wager : -wager;
                    await updatePlayerState({
                        roomCode: gameState.roomCode,
                        playerId: p.id,
                        patch: {
                            score: p.score + delta,
                        },
                    });
                })
            );

            await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-scoring' });
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to score');
        }
    };

    const handleNextQuestion = async () => {
        if (!isHost || !gameState?.roomCode) return;

        if (phase === 'final-scoring') {
            await setRoomPhase({ roomCode: gameState.roomCode, phase: 'results' });
            return;
        }

        if (phase.startsWith('final')) {
            return;
        }

        const normalCount =
            questions.length ||
            roomQuestionsCountRef.current ||
            gameState.settings.numberOfQuestions ||
            0;
        if (!normalCount) {
            Alert.alert(t('loading'), t('loading'));
            return;
        }

        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < normalCount) {
            await updateRoomMeta({
                roomCode: gameState.roomCode,
                patch: {
                    current_question_index: nextIndex,
                    phase: 'question',
                    phase_started_at: new Date().toISOString(),
                },
            });
            setTimerKey((prev) => prev + 1);
            return;
        }

        await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-wager' });
    };

    const collectPriorCorrectAnswers = (preferredLanguage?: Language) => {
        const keys = new Set<string>();
        const rawAnswers: string[] = [];

        const addQuestions = (qs: Question[] | undefined) => {
            (qs || []).forEach((q) => {
                const raw = (q?.correctAnswer || '').trim();
                if (raw) rawAnswers.push(raw);
                const k = normalizeAnswerText(raw);
                if (k) keys.add(k);
            });
        };

        if (preferredLanguage && questionsByLanguageRef.current?.[preferredLanguage]) {
            addQuestions(questionsByLanguageRef.current[preferredLanguage]);
        }
        addQuestions(questions);
        Object.values(questionsByLanguageRef.current || {}).forEach((qs) => addQuestions(qs));

        const dedupRaw = Array.from(new Set(rawAnswers.map((a) => a.trim()).filter(Boolean)));
        return { keys, raw: dedupRaw };
    };

    const generateUniqueFinalQuestion = async (args: {
        finalSettings: GameSettings;
        apiKey: string;
        priorAnswerKeys: Set<string>;
        priorRawAnswers: string[];
        maxAttempts?: number;
    }): Promise<Question> => {
        const maxAttempts = typeof args.maxAttempts === 'number' && args.maxAttempts > 0 ? args.maxAttempts : 3;
        const forbidden = (args.priorRawAnswers || []).slice(0, 20);
        const extraRules = forbidden.length
            ? `Do NOT reuse the same correctAnswer as any earlier question in the game. Avoid these exact answers (case-insensitive): ${forbidden
                .map((a) => `"${a.replace(/\"/g, '"')}"`)
                .join(', ')}.`
            : 'Do NOT reuse the same correctAnswer as any earlier question in the game.';

        let last: Question | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const result = await generateQuestions(args.finalSettings, args.apiKey, { extraRules, temperature: aiTemperature });
            if (result.error || !result.questions?.length) {
                throw new Error(result.error || t('generationFailed'));
            }

            const q = result.questions[0];
            last = q;
            const ansKey = normalizeAnswerText((q?.correctAnswer || '').trim());
            if (!ansKey) continue;
            if (!args.priorAnswerKeys.has(ansKey)) {
                return q;
            }
        }

        throw new Error(t('generationFailed'));
    };

    const updateFinalChoice = async (updates: Partial<{ wager: number | null; difficulty: Difficulty }>) => {
        if (!gameState?.roomCode || !activePlayer?.id) return;
        const next = {
            wager: updates.wager ?? (finalChoices[activePlayer.id]?.wager ?? null),
            difficulty: updates.difficulty ?? finalChoices[activePlayer.id]?.difficulty ?? 'medium',
        };
        setFinalChoices((prev) => ({ ...prev, [activePlayer.id]: next }));

        const shouldPersist = typeof updates.wager !== 'undefined' || typeof updates.difficulty !== 'undefined';
        if (!shouldPersist) return;

        const allowedWagers = [0, 10, 20];
        const resolvedWager = typeof next.wager === 'number' && Number.isFinite(next.wager) ? next.wager : finalWagerDraft;
        const wagerToPersist = allowedWagers.includes(resolvedWager) ? resolvedWager : 0;

        let startedPersonalGeneration = false;
        try {
            await upsertFinalChoice({
                roomCode: gameState.roomCode,
                playerId: activePlayer.id,
                wager: wagerToPersist,
                difficulty: next.difficulty,
                mode: finalMode,
            });

            // For personalized finals, generate the player's question using their own key.
            // We only generate on explicit wager submission to avoid re-generating on every difficulty tap.
            if (finalMode === 'personalized' && typeof updates.wager !== 'undefined') {
                const myKey = ((gameState.playerApiKeys?.[activePlayer.id] || apiKey) || '').trim();
                if (!myKey) {
                    Alert.alert(t('apiKey'), t('missingApiKeyPersonal'), [
                        { text: t('cancel'), style: 'cancel' },
                        { text: t('goToSettings'), onPress: () => router.push('/settings') },
                    ]);
                    return;
                }

                if (personalFinalGenerationInFlightRef.current) return;
                personalFinalGenerationInFlightRef.current = true;
                startedPersonalGeneration = true;
                setIsGeneratingPersonalFinal(true);

                const finalSettings = {
                    ...gameState.settings,
                    numberOfQuestions: 1,
                    difficulty: next.difficulty,
                    questionType: gameState.settings.questionType,
                    language: activePlayer.language || gameState.settings.language || 'en',
                };

                const prior = collectPriorCorrectAnswers(activePlayer.language || (gameState.settings.language as any) || language);
                try {
                    const q = await generateUniqueFinalQuestion({
                        finalSettings,
                        apiKey: myKey,
                        priorAnswerKeys: prior.keys,
                        priorRawAnswers: prior.raw,
                        maxAttempts: 3,
                    });
                    await upsertFinalQuestion({
                        roomCode: gameState.roomCode,
                        playerId: activePlayer.id,
                        question: q,
                    });
                    setFinalQuestion(q);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : t('generationFailed');
                    Alert.alert(t('loading'), msg);
                    return;
                }
            }
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to save final choice');
        } finally {
            if (startedPersonalGeneration) {
                personalFinalGenerationInFlightRef.current = false;
                setIsGeneratingPersonalFinal(false);
            }
        }
    };

    const startFinalQuestion = async () => {
        if (!isHost || !gameState?.roomCode) return;

        const [choicesFromDb] = await Promise.all([
            fetchFinalChoices(gameState.roomCode),
        ]);
        const choiceMap: Record<string, { wager: number; difficulty: Difficulty; mode: string }> = {};
        choicesFromDb.forEach((c) => {
            choiceMap[c.player_id] = {
                wager: c.wager,
                difficulty: (c.difficulty as Difficulty) || 'medium',
                mode: c.mode,
            };
        });

        const missingWagers = gameState.players.filter((p) => {
            const c = choiceMap[p.id];
            return !c || typeof c.wager !== 'number' || !Number.isFinite(c.wager) || c.mode !== finalMode;
        });
        if (missingWagers.length > 0) {
            Alert.alert(t('finalWager'), t('waitingForWagers'));
            return;
        }

        if (finalMode === 'personalized') {
            const missingKeys = gameState.players.filter((p) => !p.hasApiKey);
            if (missingKeys.length > 0) {
                Alert.alert(
                    t('finalWager'),
                    `${t('playersMissingKeys')}\n${missingKeys.map((p) => p.name).join(', ')}`
                );
                return;
            }

            const finalQuestions = await Promise.all(
                gameState.players.map((p) => fetchFinalQuestion({ roomCode: gameState.roomCode, playerId: p.id }))
            );
            const missingQuestions = gameState.players.filter((p, idx) => !finalQuestions[idx]);
            if (missingQuestions.length > 0) {
                Alert.alert(t('finalWager'), t('waitingForWagers'));
                return;
            }

            await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-question' });
            setTimerKey((prev) => prev + 1);
            return;
        }

        // Calculate voted difficulty (shared mode)
        const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
        Object.values(finalChoices).forEach((c) => {
            if (c.difficulty && counts[c.difficulty] !== undefined) {
                counts[c.difficulty]++;
            }
        });
        const votedDifficulty = (Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b)) as Difficulty) || 'medium';

        const hostKey = (gameState.hostApiKey || apiKey || '').trim();
        if (!hostKey) {
            Alert.alert(t('apiKey'), t('missingApiKeyHost'));
            return;
        }

        setIsLoadingFinal(true);
        const finalSettings = {
            ...gameState.settings,
            numberOfQuestions: 1,
            difficulty: votedDifficulty,
            questionType: gameState.settings.questionType,
        };

        const prior = collectPriorCorrectAnswers((gameState.settings.language as any) || language);
        let q: Question;
        let questionsByLang: Record<string, Question> = {};

        try {
            q = await generateUniqueFinalQuestion({
                finalSettings,
                apiKey: hostKey,
                priorAnswerKeys: prior.keys,
                priorRawAnswers: prior.raw,
                maxAttempts: 3,
            });
            questionsByLang[finalSettings.language] = q;

            // Translate for other languages
            const baseLang = finalSettings.language;
            const uniqueLangs = Array.from(new Set(gameState.players.map(p => p.language || 'en')));
            const targets = uniqueLangs.filter(l => l !== baseLang);

            for (const targetLang of targets) {
                const tr = await translateQuestions({
                    sourceQuestions: [q],
                    sourceLanguage: baseLang as Language,
                    targetLanguage: targetLang as Language,
                    apiKey: hostKey,
                    temperature: aiTemperature,
                });
                if (tr?.questions && tr.questions.length > 0) {
                    questionsByLang[targetLang] = tr.questions[0];
                }
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : t('generationFailed');
            Alert.alert(t('loading'), msg);
            setIsLoadingFinal(false);
            return;
        }

        await Promise.all(
            gameState.players.map((p) => {
                const pLang = p.language || 'en';
                const questionForPlayer = questionsByLang[pLang] || questionsByLang[finalSettings.language] || q;
                return upsertFinalQuestion({ roomCode: gameState.roomCode, playerId: p.id, question: questionForPlayer });
            })
        );
        setIsLoadingFinal(false);

        await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-question' });
        setTimerKey((prev) => prev + 1);
    };

    const isCorrectAnswer = !!answerBoard[activePlayer.id]?.isCorrect;
    const viewerHasAnswered = answerBoard[activePlayer.id]?.hasAnswered;
    const showLocalPreviewWhileQuestion = phase === 'question' && !!viewerHasAnswered;
    return (
        <SafeAreaView className="flex-1 bg-background relative">
            <ScreenBackground variant="game" />
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <View
                        className={`${isDesktopWeb ? 'px-10 py-4' : (isCompact ? 'p-3' : 'p-7')} w-full flex-1 ${isTightLayout ? 'space-y-4' : 'space-y-10'}`}
                    >
                        {/* Header */}
                        <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between ${isTightLayout ? 'mb-2 pt-2' : 'mb-9 pt-12'} z-50`}>
                            <Logo size="sm" animated={false} />
                            {(phase === 'validation' || phase === 'scoring' || phase === 'final-scoring' || phase === 'final-validation' || phase === 'reveal') && (
                                <View className="px-5 py-2.5 rounded-lg bg-white border-2 border-foreground shadow-[2px_2px_0px_#2B1F17]">
                                    <Text className="text-primary font-display font-bold text-lg">{activePlayer.score} pts</Text>
                                </View>
                            )}
                        </View>

                        <View className={isDesktopWeb ? 'max-w-7xl mx-auto w-full flex-1' : 'w-full flex-1'}>
                            <View className={isDesktopWeb ? 'flex-row gap-8 flex-1' : 'flex-1'}>
                                <View className={isDesktopWeb ? 'flex-1 min-w-0' : 'flex-1'}>
                                    {/* Opponent Status (Visible when not in lobby/results) */}
                                    {!isDesktopWeb && phase !== 'lobby' && phase !== 'results' && phase !== 'question' && (
                                        <View className={isCompact ? 'mb-2' : 'mb-4'}>
                                            <OpponentStatusList
                                                players={gameState.players}
                                                currentPlayerId={activePlayer.id}
                                                showScores={true}
                                                showBets={
                                                    phase === 'reveal' ||
                                                    phase === 'scoring' ||
                                                    phase === 'validation' ||
                                                    phase === 'final-scoring' ||
                                                    phase === 'final-validation'
                                                }
                                                compact={isCompact}
                                            />
                                        </View>
                                    )}

                                    <View className={`${isDesktopWeb ? 'w-full' : 'max-w-3xl mx-auto w-full'} ${isTightLayout ? 'space-y-4' : 'space-y-10'} flex-1`}>
                                        {/* Unified Round Screen (Bet + Answer) */}
                                        {!isFinalRound && phase === 'question' && activeQuestion && (
                                            <View className={isTightLayout ? 'space-y-4' : 'space-y-8'}>
                                                {/* Question + answers (always visible) */}
                                                <QuestionCard
                                                    question={activeQuestion}
                                                    questionNumber={currentQuestionIndex + 1}
                                                    totalQuestions={totalQuestions}
                                                    selectedAnswer={selectedAnswer}
                                                    onSelectAnswer={handleAnswerSubmit}
                                                    isAnswerPhase={true}
                                                    density={isTightLayout ? 'compact' : 'default'}
                                                    disabled={!!viewerHasAnswered}
                                                    headerAccessory={
                                                        <Timer
                                                            key={timerKey}
                                                            seconds={timePerQuestionSeconds}
                                                            onComplete={handleRoundTimerComplete}
                                                            endsAt={phaseEndsAtMs}
                                                            size={isDesktopWeb ? 'xs' : 'xxs'}
                                                        />
                                                    }
                                                    showCorrectAnswer={false}
                                                    hintsEnabled={gameState.settings.hintsEnabled}
                                                />

                                                {!showLocalPreviewWhileQuestion && (
                                                    <>
                                                        {/* Bet selection (no confirm; submitting answer commits the bet) */}
                                                        <Card className="border-2 border-foreground bg-white rounded-lg overflow-hidden transform rotate-1">
                                                            <CardContent className={`${isTightLayout ? 'p-4 space-y-3' : 'p-9 space-y-6'}`}>
                                                                <View className="items-center">
                                                                    <View className="px-5 py-2.5 rounded-lg bg-accent/10 border-2 border-accent">
                                                                        <Text className="text-accent font-display font-bold text-lg">
                                                                            {t('yourBet')}: {(betsByPlayerId[activePlayer.id] ?? selectedBet ?? 0)} {t('points')}
                                                                        </Text>
                                                                    </View>
                                                                </View>

                                                                <BetSelector
                                                                    totalQuestions={totalQuestions}
                                                                    usedBets={usedBetsForPlayer}
                                                                    selectedBet={selectedBet}
                                                                    onSelectBet={setSelectedBet}
                                                                    showHeader={false}
                                                                    density={isTightLayout ? 'compact' : 'default'}
                                                                    variant={totalQuestions > 12 ? 'stepper' : 'grid'}
                                                                />

                                                                <View className="items-center">
                                                                    <Text className="text-sm text-foreground/60 text-center font-bold font-sans">
                                                                        {t('betDescription')}
                                                                    </Text>
                                                                </View>
                                                            </CardContent>
                                                        </Card>
                                                    </>
                                                )}

                                                {showLocalPreviewWhileQuestion && (
                                                    <View className={isCompact ? 'space-y-3' : 'space-y-5'}>
                                                        <Card className="rounded-lg border-2 border-foreground bg-white transform rotate-1">
                                                            <CardContent className={isCompact ? 'p-3 space-y-2' : 'p-5 space-y-3'}>
                                                                <Text className="text-lg font-display font-semibold text-foreground">
                                                                    {t('answerPreview')}
                                                                </Text>
                                                                {gameState.players.map((player) => {
                                                                    const entry = answerBoard[player.id];
                                                                    return (
                                                                        <View key={player.id} className={`flex-row justify-between items-center ${isCompact ? 'py-2' : 'py-3'} border-b border-black/5 last:border-0`}>
                                                                            <Text className="font-semibold text-foreground">{player.name}</Text>
                                                                            <Text className="text-sm text-muted-foreground bg-white/50 px-2 py-1 rounded-md overflow-hidden max-w-[50%]" numberOfLines={1}>
                                                                                {entry?.hasAnswered ? entry.answer : t('waitingForAnswer')}
                                                                            </Text>
                                                                        </View>
                                                                    );
                                                                })}
                                                            </CardContent>
                                                        </Card>
                                                        <View className={`items-center bg-white ${isCompact ? 'p-3' : 'p-4'} rounded-lg border-2 border-foreground mx-auto transform -rotate-1`}>
                                                            <ActivityIndicator size="small" color="#4A3B32" />
                                                            <Text className="text-muted-foreground font-bold font-sans mt-2">{t('waiting')}</Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        {/* Final Wager Phase */}
                                        {isFinalRound && phase === 'final-wager' && (
                                            <View className={`${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                                                <Card className={`border-2 border-foreground bg-white rounded-lg ${isCompact ? 'p-4' : 'p-5'}`}>
                                                    <View className="mb-4">
                                                        <Text className="text-xl font-display font-bold text-center mb-2">{t('finalMode')}</Text>
                                                        <View className="flex-row gap-2 justify-center">
                                                            <TouchableOpacity
                                                                onPress={() => setFinalMode('personalized')}
                                                                className={`px-4 py-2 rounded-full border-2 ${finalMode === 'personalized' ? 'bg-primary border-foreground' : 'bg-transparent border-transparent'}`}
                                                            >
                                                                <Text className={`font-bold ${finalMode === 'personalized' ? 'text-white' : 'text-foreground'}`}>{t('personalFinal')}</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => setFinalMode('shared')}
                                                                className={`px-4 py-2 rounded-full border-2 ${finalMode === 'shared' ? 'bg-primary border-foreground' : 'bg-transparent border-transparent'}`}
                                                            >
                                                                <Text className={`font-bold ${finalMode === 'shared' ? 'text-white' : 'text-foreground'}`}>{t('sharedFinal')}</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>

                                                    {finalMode === 'shared' && (
                                                        <View className="mb-4">
                                                            <Text className="font-bold mb-2">{t('chooseDifficulty')}:</Text>
                                                            <View className="flex-row justify-between gap-2">
                                                                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
                                                                    const voteCount = Object.values(finalChoices).filter(c => c.difficulty === d).length;
                                                                    const isSelected = (finalChoices[activePlayer.id]?.difficulty || 'medium') === d;
                                                                    return (
                                                                        <TouchableOpacity
                                                                            key={d}
                                                                            onPress={() => updateFinalChoice({ difficulty: d })}
                                                                            className={`flex-1 p-2 border-2 rounded-lg items-center ${isSelected ? 'bg-accent border-foreground' : 'bg-white border-foreground/20'}`}
                                                                        >
                                                                            <Text className="font-bold capitalize">{t(d)}</Text>
                                                                            {voteCount > 0 && <Text className="text-xs">{voteCount} votes</Text>}
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </View>
                                                        </View>
                                                    )}

                                                    <Text className="font-bold mb-2">{t('yourBet')} ({t('optional')}):</Text>
                                                    <View className="flex-row gap-2 justify-center mb-4">
                                                        <TouchableOpacity onPress={() => updateFinalChoice({ wager: 0 })} className={`p-3 border-2 rounded ${finalChoices[activePlayer.id]?.wager === 0 ? 'bg-muted border-foreground' : 'border-dashed'}`}>
                                                            <Text className="font-bold">No Bet</Text>
                                                        </TouchableOpacity>
                                                        {[10, 20].map((amt) => (
                                                            <TouchableOpacity
                                                                key={amt}
                                                                onPress={() => updateFinalChoice({ wager: amt })}
                                                                className={`p-3 border-2 rounded ${finalChoices[activePlayer.id]?.wager === amt ? 'bg-accent border-foreground' : 'border-foreground/20'}`}
                                                            >
                                                                <Text className="font-bold">{amt} pts</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>

                                                    {isHost && (
                                                        <Button onPress={startFinalQuestion} variant="hero">
                                                            <Text className="text-white font-bold">{t('startFinal')}</Text>
                                                        </Button>
                                                    )}
                                                    {!isHost && (
                                                        <Text className="text-center italic mt-4">{t('waitingForHost')}</Text>
                                                    )}
                                                </Card>

                                                {finalMode === 'personalized' && !((apiKey || '').trim()) && (
                                                    <View className="items-center space-y-2 bg-destructive/10 p-4 rounded-2xl border border-destructive/20 mt-2">
                                                        <Ionicons name="warning" size={24} color="#B3261E" />
                                                        <Text className="text-sm text-foreground/80 text-center font-medium">{t('missingApiKeyPersonal')}</Text>
                                                        <Button variant="outline" size="sm" onPress={() => router.push('/settings')} className="border-destructive/30 text-destructive">
                                                            <Text className="font-display font-bold text-destructive">{t('goToSettings')}</Text>
                                                        </Button>
                                                    </View>
                                                )}

                                                <Button
                                                    variant="hero"
                                                    onPress={() => updateFinalChoice({ wager: finalWagerDraft })}
                                                    disabled={finalMode === 'personalized' && !((apiKey || '').trim())}
                                                    className="w-full mt-2"
                                                >
                                                    <Text className="font-display font-bold text-primary-foreground text-lg">
                                                        {isGeneratingPersonalFinal ? t('loading') : t('submit')}
                                                    </Text>
                                                </Button>
                                            </View>
                                        )}

                                        {/* Question Phase */}
                                        {
                                            (phase === 'preview' || phase === 'validation' || phase === 'scoring' || phase === 'final-question' || phase === 'final-validation' || phase === 'final-scoring') && activeQuestion && (
                                                <View className={isCompact ? 'space-y-4' : 'space-y-8'}>
                                                    {/* Your Bet Display */}
                                                    <View className="items-center">
                                                        <View className="px-5 py-2 rounded-lg bg-accent/10 border-2 border-accent transform -rotate-1">
                                                            <Text className="text-accent font-display font-bold">
                                                                {t('yourBet')}: {currentBetDisplay ?? 0} {t('points')}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    {/* Question Card */}
                                                    <QuestionCard
                                                        question={activeQuestion}
                                                        questionNumber={isFinalRound ? 1 : currentQuestionIndex + 1}
                                                        totalQuestions={totalQuestions}
                                                        selectedAnswer={selectedAnswer}
                                                        onSelectAnswer={handleAnswerSubmit}
                                                        isAnswerPhase={phase === 'final-question'}
                                                        density={isCompact ? 'compact' : 'default'}
                                                        headerAccessory={
                                                            phase === 'final-question' ? (
                                                                <Timer
                                                                    key={timerKey}
                                                                    seconds={timePerQuestionSeconds}
                                                                    onComplete={handleRoundTimerComplete}
                                                                    endsAt={phaseEndsAtMs}
                                                                    size="xxs"
                                                                />
                                                            ) : null
                                                        }
                                                        showCorrectAnswer={showCorrectAnswer}
                                                        hintsEnabled={gameState.settings.hintsEnabled}
                                                    />

                                                    {phase === 'final-question' && (
                                                        <Button
                                                            variant="hero"
                                                            onPress={handleSubmit}
                                                            disabled={!selectedAnswer?.trim() || !!answerBoard[activePlayer.id]?.hasAnswered}
                                                            className="w-full shadow-xl shadow-primary/25"
                                                        >
                                                            <Text className="text-lg font-display font-bold text-primary-foreground">
                                                                {t('submit')}
                                                            </Text>
                                                        </Button>
                                                    )}

                                                    {/* Answer Preview Phase */}
                                                    {phase === 'preview' && !showCorrectAnswer && (
                                                        <View className={isCompact ? 'space-y-3' : 'space-y-5'}>
                                                            <Card className="rounded-lg border-2 border-foreground bg-white transform rotate-1">
                                                                <CardContent className={isCompact ? 'p-3 space-y-2' : 'p-5 space-y-3'}>
                                                                    <Text className="text-lg font-display font-semibold text-foreground">
                                                                        {t('answerPreview')}
                                                                    </Text>
                                                                    {!viewerHasAnswered && (
                                                                        <View className="p-4 rounded-lg bg-white border-2 border-dashed border-foreground/30">
                                                                            <Text className="text-sm text-foreground/70 font-medium italic text-center">
                                                                                {t('submitToSee')}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                    {viewerHasAnswered && gameState.players.map((player) => {
                                                                        const entry = answerBoard[player.id];
                                                                        return (
                                                                            <View key={player.id} className={`flex-row justify-between items-center ${isCompact ? 'py-2' : 'py-3'} border-b border-black/5 last:border-0`}>
                                                                                <Text className="font-semibold text-foreground">{player.name}</Text>
                                                                                <Text className="text-sm text-muted-foreground bg-white/50 px-2 py-1 rounded-md overflow-hidden max-w-[50%]" numberOfLines={1}>
                                                                                    {entry?.hasAnswered ? entry.answer : t('waitingForAnswer')}
                                                                                </Text>
                                                                            </View>
                                                                        );
                                                                    })}
                                                                </CardContent>
                                                            </Card>
                                                            {isHost && (
                                                                <Button
                                                                    variant="secondary"
                                                                    size="lg"
                                                                    onPress={handleRevealAnswer}
                                                                    className="w-full shadow-lg shadow-secondary/20"
                                                                >
                                                                    <View className="flex-row items-center gap-2">
                                                                        <Text className="font-display font-bold text-secondary-foreground text-lg">
                                                                            {t('revealNow')}
                                                                        </Text>
                                                                        <Text>🎯</Text>
                                                                    </View>
                                                                </Button>
                                                            )}
                                                        </View>
                                                    )}

                                                    {phase === 'preview' && !showCorrectAnswer && !isHost && viewerHasAnswered && (
                                                        <View className={`items-center bg-white ${isCompact ? 'p-3' : 'p-4'} rounded-lg border-2 border-foreground mx-auto transform -rotate-1`}>
                                                            <ActivityIndicator size="small" color="#4A3B32" />
                                                            <Text className="text-muted-foreground font-bold font-sans mt-2">{t('waitingForHost')}</Text>
                                                        </View>
                                                    )}

                                                    {/* Validation Phase */}
                                                    {(phase === 'validation' || phase === 'final-validation') && (
                                                        <Card className="rounded-lg border-2 border-foreground bg-white transform rotate-1">
                                                            <CardContent className={isCompact ? 'p-3 space-y-3' : 'p-5 space-y-4'}>
                                                                <Text className="text-lg font-display font-semibold text-foreground">
                                                                    {t('hostValidation')}
                                                                </Text>
                                                                {gameState.players.map((player) => {
                                                                    const entry = answerBoard[player.id];
                                                                    return (
                                                                        <View key={player.id} className={`flex-row items-center justify-between ${isCompact ? 'py-2' : 'py-3'} border-b border-black/5 last:border-0`}>
                                                                            <View className="flex-1 mr-4">
                                                                                <Text className="font-semibold text-foreground">{player.name}</Text>
                                                                                <Text className="text-sm text-foreground/80 font-medium mt-0.5">
                                                                                    {entry?.answer || t('waitingForAnswer')}
                                                                                </Text>
                                                                            </View>
                                                                            {isHost && entry?.hasAnswered && (
                                                                                <View className="flex-row gap-2">
                                                                                    <TouchableOpacity
                                                                                        onPress={() => toggleValidation(player.id, true)}
                                                                                        className={`px-3 py-2 rounded-lg border-2 ${entry.isCorrect ? 'border-success bg-success/20' : 'border-transparent bg-muted/20'}`}
                                                                                    >
                                                                                        <Ionicons name="checkmark" size={20} color={entry.isCorrect ? '#4A7A68' : '#A0A0A0'} />
                                                                                    </TouchableOpacity>
                                                                                    <TouchableOpacity
                                                                                        onPress={() => toggleValidation(player.id, false)}
                                                                                        className={`px-3 py-2 rounded-lg border-2 ${entry.isCorrect === false ? 'border-destructive bg-destructive/20' : 'border-transparent bg-muted/20'}`}
                                                                                    >
                                                                                        <Ionicons name="close" size={20} color={entry.isCorrect === false ? '#B3261E' : '#A0A0A0'} />
                                                                                    </TouchableOpacity>
                                                                                </View>
                                                                            )}
                                                                            {(!isHost) && (
                                                                                <View className={`px-3 py-1.5 rounded-lg ${entry?.isCorrect === true ? 'bg-success/20' : (entry?.isCorrect === false ? 'bg-destructive/20' : 'bg-muted')}`}>
                                                                                    {entry?.isCorrect === true && <Ionicons name="checkmark-circle" size={20} color="#4A7A68" />}
                                                                                    {entry?.isCorrect === false && <Ionicons name="close-circle" size={20} color="#B3261E" />}
                                                                                    {entry?.isCorrect === undefined && <ActivityIndicator size="small" color="#999" />}
                                                                                </View>
                                                                            )}
                                                                        </View>
                                                                    );
                                                                })}

                                                                {isHost && (
                                                                    <Button variant="hero" onPress={applyScores} className="w-full mt-2 shadow-xl shadow-primary/20">
                                                                        <Text className="text-lg font-display font-bold text-primary-foreground">
                                                                            {t('applyScores')}
                                                                        </Text>
                                                                    </Button>
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Scoring / progression */}
                                                    {(phase === 'scoring' || phase === 'final-scoring') && (
                                                        <View className={isCompact ? 'items-center space-y-4' : 'items-center space-y-6'}>
                                                            <View className={`${isCompact ? 'p-4' : 'p-6'} rounded-lg border-2 ${isCorrectAnswer ? 'bg-success/10 border-success' : 'bg-destructive/10 border-destructive'} items-center w-full transform -rotate-1`}>
                                                                {isCorrectAnswer ? (
                                                                    <Ionicons name="trophy" size={isCompact ? 36 : 48} color="#4A7A68" />
                                                                ) : (
                                                                    <Ionicons name="alert-circle" size={isCompact ? 36 : 48} color="#B3261E" />
                                                                )}
                                                                <Text className={`${isCompact ? 'text-2xl mt-2' : 'text-3xl mt-4'} font-display font-bold ${isCorrectAnswer ? 'text-success' : 'text-destructive'}`}>
                                                                    {isCorrectAnswer
                                                                        ? `${t('correct')} ${isFinalRound ? '' : `+${currentBetDisplay ?? 0}`}`
                                                                        : isFinalRound
                                                                            ? `${t('incorrect')} -${currentFinalChoice.wager || 0}`
                                                                            : t('incorrect')}
                                                                </Text>
                                                            </View>

                                                            {isHost ? (
                                                                <Button variant="hero" onPress={handleNextQuestion} className="w-full shadow-xl shadow-primary/20">
                                                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                                                        {isFinalRound ? `${t('seeResults')} 🏆` : `${t('next')} ${t('question')} ➡️`}
                                                                    </Text>
                                                                </Button>
                                                            ) : (
                                                                <View className="items-center bg-white p-4 rounded-lg border-2 border-foreground">
                                                                    <ActivityIndicator size="small" color="#4A3B32" />
                                                                    <Text className="text-muted-foreground font-bold font-sans mt-2">{t('waitingForHost')}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                            )
                                        }
                                    </View>
                                </View>

                                {isDesktopWeb && phase !== 'lobby' && phase !== 'results' && (
                                    <View className="w-[320px] shrink-0">
                                        <OpponentStatusList
                                            players={gameState.players}
                                            currentPlayerId={activePlayer.id}
                                            showScores={true}
                                            showBets={
                                                phase === 'reveal' ||
                                                phase === 'scoring' ||
                                                phase === 'validation' ||
                                                phase === 'final-scoring' ||
                                                phase === 'final-validation'
                                            }
                                            compact={isCompact}
                                            orientation="vertical"
                                        />
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
