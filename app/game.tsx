import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import QuestionCard from '@/components/QuestionCard';
import BetSelector from '@/components/BetSelector';
import Timer from '@/components/Timer';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, GamePhase, Question, Difficulty, Player, GameSettings } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { generateQuestions } from '@/services/questionService';
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
    const { t, isRTL } = useLanguage();
    const { gameState, setGameState, currentPlayer, apiKey } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const gameStateRef = React.useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const refreshInFlightRef = React.useRef(false);
    const lastQuestionsSignatureRef = React.useRef<string>('');
    const autoAdvanceInFlightRef = React.useRef(false);
    const submitInFlightRef = React.useRef(false);
    const roomQuestionsCountRef = React.useRef<number>(0);
    const questionsGenerationInFlightRef = React.useRef(false);
    const questionsGenerationCooldownUntilRef = React.useRef<number>(0);

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
    const [phaseStartedAt, setPhaseStartedAt] = useState<string | null>(null);
    const [clockSkewMs, setClockSkewMs] = useState<number>(0);
    const [timerKey, setTimerKey] = useState(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [answerBoard, setAnswerBoard] = useState<AnswerBoard>({});
    const [finalChoices, setFinalChoices] = useState<Record<string, { wager: number | null; difficulty: Difficulty }>>({});
    const [finalMode, setFinalMode] = useState<'personalized' | 'shared'>('shared');
    const [finalQuestion, setFinalQuestion] = useState<Question | null>(null);
    const [isLoadingFinal, setIsLoadingFinal] = useState(false);

    const [betsByPlayerId, setBetsByPlayerId] = useState<Record<string, number>>({});
    const [usedBetsForPlayer, setUsedBetsForPlayer] = useState<number[]>([]);

    const selectedAnswerRef = React.useRef<string | null>(null);
    useEffect(() => {
        selectedAnswerRef.current = selectedAnswer;
    }, [selectedAnswer]);

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
        return started + timePerQuestionSeconds * 1000 - (clockSkewMs || 0);
    }, [clockSkewMs, phase, phaseStartedAt, timePerQuestionSeconds]);

    const isFinalRound = phase.startsWith('final');
    const totalQuestions = isFinalRound ? 1 : questions.length;
    const currentFinalChoice = activePlayer
        ? (finalChoices[activePlayer.id] || { wager: null, difficulty: 'medium' as Difficulty })
        : { wager: null, difficulty: 'medium' as Difficulty };
    const currentBetDisplay = isFinalRound
        ? currentFinalChoice.wager
        : (betsByPlayerId[activePlayer?.id || ''] ?? selectedBet ?? null);

    const isHost = !!currentPlayer?.id && !!gameState?.hostId && currentPlayer.id === gameState.hostId;
    const showCorrectAnswer =
        phase === 'validation' ||
        phase === 'scoring' ||
        phase === 'final-validation' ||
        phase === 'final-scoring';

    useEffect(() => {
        if (!phase.startsWith('final') && phase === 'question') {
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

            const betValue = betsByPlayerId[activePlayer.id] ?? selectedBet;
            if (!betValue) return;

            if (usedBetsForPlayer.includes(betValue)) {
                Alert.alert(t('placeBet'), t('betAlreadyUsed'));
                return;
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
        if (!isSupabaseConfigured || !gameState?.roomCode) return;

        let cancelled = false;
        let refreshQueued = false;
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;
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

                const includeQuestions = lastQuestionsSignatureRef.current === '' || roomQuestionsCountRef.current === 0;
                const roomState = await fetchRoomState(roomCode, { includeQuestions });

                const receivedAtMs = Date.now();

                const serverUpdatedAt = (roomState.room as any)?.updated_at;
                if (typeof serverUpdatedAt === 'string') {
                    const serverUpdatedAtMs = new Date(serverUpdatedAt).getTime();
                    if (Number.isFinite(serverUpdatedAtMs)) {
                        const nextSkew = serverUpdatedAtMs - receivedAtMs;
                        setClockSkewMs((prev) => (Math.abs(prev - nextSkew) > 1000 ? nextSkew : prev));
                    }
                }
                const questionsRaw = includeQuestions
                    ? (Array.isArray(roomState.room.questions) ? roomState.room.questions : [])
                    : null;
                const nextPhase = roomState.room.phase as GamePhase;
                const phaseChanged = phaseRef.current !== nextPhase;
                const serverPhaseStartedAt = (roomState.room as any)?.phase_started_at;
                const meta: any = {
                    phase: nextPhase,
                    currentQuestionIndex: roomState.room.current_question_index ?? 0,
                    phaseStartedAt: typeof serverPhaseStartedAt === 'string'
                        ? serverPhaseStartedAt
                        : (phaseChanged ? new Date().toISOString() : null),
                    finalMode: 'shared' as const,
                    questions: questionsRaw,
                };

                const loadedCount = Array.isArray(meta.questions) ? meta.questions.length : 0;
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
                    if (Array.isArray(meta.questions) && meta.questions.length > 0) {
                        const normalized = normalizeQuestions(meta.questions, roomState.room.settings);
                        const typeSig = normalized.map((q) => `${q.type}:${q.options?.length || 0}`).join('|');
                        const signature = `${roomState.room.settings.questionType}:${normalized.length}:${typeSig}`;
                        if (signature !== lastQuestionsSignatureRef.current) {
                            lastQuestionsSignatureRef.current = signature;
                            setQuestions(normalized);
                        }
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
                        setLoadingMessage(t('generatingQuestions'));
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
                    const result = await generateQuestions(roomState.room.settings, hostKey);
                    questionsGenerationInFlightRef.current = false;
                    if (cancelled) return;
                    if (result.error) {
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
                        await updateRoomQuestions({ roomCode, questions: result.questions });
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
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
        };
    }, [apiKey, currentPlayer?.id, gameState?.roomCode, gameState?.hostApiKey, gameState?.playerApiKeys, router, setGameState, t]);

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
            <SafeAreaView className="flex-1 bg-background items-center justify-center p-4">
                <ScreenBackground variant="game" />
                <ActivityIndicator size="large" color="#C97B4C" />
                <Text className="text-base text-muted-foreground mt-4">{t('loading')}</Text>
            </SafeAreaView>
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center p-4">
                <ScreenBackground variant="game" />
                <Logo size="lg" animated />
                <View className="mt-8 items-center max-w-2xl">
                    <ActivityIndicator size="large" color="#C97B4C" />
                    <Text className="text-2xl font-display font-bold text-foreground mt-4 text-center">
                        {loadingMessage || 'Loading...'}
                    </Text>
                    <Text className="text-muted-foreground mt-2 text-center">
                        {t('generatingQuestions')} {gameState.settings.numberOfQuestions} {t('questionsAbout')} {gameState.settings.customTheme || t(gameState.settings.theme)}
                    </Text>
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
                await Promise.all(
                    answers.map((a) =>
                        upsertValidation({
                            roomCode: gameState.roomCode,
                            questionIndex: currentQuestionIndex,
                            playerId: a.player_id,
                            isCorrect: isAnswerCorrect(a.answer, activeQuestion),
                            validatedBy: currentPlayer?.id,
                        })
                    )
                );
                await setRoomPhase({ roomCode: gameState.roomCode, phase: 'validation' });
            } else {
                const answers = await fetchFinalAnswers(gameState.roomCode);
                await Promise.all(
                    answers.map((a) =>
                        upsertFinalValidation({
                            roomCode: gameState.roomCode,
                            playerId: a.player_id,
                            isCorrect: isAnswerCorrect(a.answer, activeQuestion),
                            validatedBy: currentPlayer?.id,
                        })
                    )
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

    const updateFinalChoice = async (updates: Partial<{ wager: number | null; difficulty: Difficulty }>) => {
        if (!gameState?.roomCode || !activePlayer?.id) return;
        const next = {
            wager: updates.wager ?? (finalChoices[activePlayer.id]?.wager ?? null),
            difficulty: updates.difficulty ?? finalChoices[activePlayer.id]?.difficulty ?? 'medium',
        };
        setFinalChoices((prev) => ({ ...prev, [activePlayer.id]: next }));

        if (next.wager === null) return;
        try {
            await upsertFinalChoice({
                roomCode: gameState.roomCode,
                playerId: activePlayer.id,
                wager: next.wager,
                difficulty: next.difficulty,
                mode: finalMode,
            });
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to save final choice');
        }
    };

    const startFinalQuestion = async () => {
        if (!isHost || !gameState?.roomCode) return;

        const missingWagers = gameState.players.filter((p) => {
            const choice = finalChoices[p.id];
            return choice?.wager === null || typeof choice?.wager !== 'number';
        });
        if (missingWagers.length > 0) {
            Alert.alert(t('finalWager'), t('waitingForWagers'));
            return;
        }

        const hostChoice = finalChoices[currentPlayer?.id || ''] || { wager: null, difficulty: 'medium' as Difficulty };
        if (hostChoice.wager === null) {
            Alert.alert(t('finalWager'), t('finalWagerDesc'));
            return;
        }

        const hostKey = gameState.hostApiKey || apiKey;
        if (!hostKey) {
            Alert.alert(t('apiKey'), t('missingApiKeyHost'));
            return;
        }

        setIsLoadingFinal(true);
        const finalSettings = {
            ...gameState.settings,
            numberOfQuestions: 1,
            difficulty: hostChoice.difficulty,
            questionType: 'open-ended' as const,
        };
        const result = await generateQuestions(finalSettings, hostKey);
        if (result.error || !result.questions?.length) {
            if (result.code === 'QUOTA_EXCEEDED') {
                Alert.alert(t('aiQuotaExceededTitle'), t('aiQuotaExceededDesc'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('goToSettings'), onPress: () => router.push('/settings') },
                ]);
            } else if (result.code === 'INVALID_API_KEY') {
                Alert.alert(t('aiInvalidApiKeyTitle'), t('aiInvalidApiKeyDesc'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('goToSettings'), onPress: () => router.push('/settings') },
                ]);
            } else {
                Alert.alert(t('loading'), result.error || t('generationFailed'));
            }
            setIsLoadingFinal(false);
            return;
        }

        await Promise.all(
            gameState.players.map((p) => upsertFinalQuestion({ roomCode: gameState.roomCode, playerId: p.id, question: result.questions![0] }))
        );
        setIsLoadingFinal(false);

        await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-question' });
        setTimerKey((prev) => prev + 1);
    };

    const isCorrectAnswer = !!answerBoard[activePlayer.id]?.isCorrect;
    const viewerHasAnswered = answerBoard[activePlayer.id]?.hasAnswered;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="game" />
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View
                    className={`${isCompact ? 'p-4' : 'p-7'} max-w-5xl w-full self-center flex-1 ${isCompact ? 'space-y-6' : 'space-y-10'}`}
                >
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between ${isCompact ? 'mb-4 pt-4' : 'mb-9 pt-12'}`}>
                    <Logo size="sm" animated={false} />
                    <View className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/30">
                        <Text className="text-primary font-bold">{activePlayer.score} pts</Text>
                    </View>
                </View>

                <View className={`max-w-3xl mx-auto w-full ${isCompact ? 'space-y-6' : 'space-y-10'} flex-1`}>
                    {/* Unified Round Screen (Bet + Answer) */}
                    {!isFinalRound && phase === 'question' && activeQuestion && (
                        <View className={isCompact ? 'space-y-5' : 'space-y-8'}>
                            {/* Question + answers (always visible) */}
                            <QuestionCard
                                question={activeQuestion}
                                questionNumber={currentQuestionIndex + 1}
                                totalQuestions={totalQuestions}
                                selectedAnswer={selectedAnswer}
                                onSelectAnswer={handleAnswerSubmit}
                                isAnswerPhase={true}
                                density={isCompact ? 'compact' : 'default'}
                                headerAccessory={
                                    <Timer
                                        key={timerKey}
                                        seconds={timePerQuestionSeconds}
                                        onComplete={handleRoundTimerComplete}
                                        endsAt={phaseEndsAtMs}
                                        size="xxs"
                                    />
                                }
                                showCorrectAnswer={false}
                                hintsEnabled={gameState.settings.hintsEnabled}
                            />

                            {!((betsByPlayerId[activePlayer.id] ?? selectedBet) || 0) && (
                                <View className="items-center">
                                    <Text className="text-muted-foreground text-sm italic text-center">
                                        {t('placeBetFirst') || 'Choose your bet below to confirm your answer'}
                                    </Text>
                                </View>
                            )}

                            {/* Bet selection (no confirm; submitting answer commits the bet) */}
                            <Card className="border-accent/30 rounded-3xl" style={{
                                shadowColor: '#D4A72C',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.3,
                                shadowRadius: 20,
                                elevation: 10,
                            }}>
                                <CardContent className={`${isCompact ? 'p-6 space-y-4' : 'p-9 space-y-6'}`}>
                                    <View className="items-center">
                                        <View className="px-4 py-2 rounded-full bg-accent/20">
                                            <Text className="text-accent font-display font-bold">
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
                                        density={isCompact ? 'compact' : 'default'}
                                        variant="grid"
                                    />

                                    <View className="items-center">
                                        <Text className="text-sm text-muted-foreground text-center">
                                            {t('betDescription')}
                                        </Text>
                                    </View>
                                </CardContent>
                            </Card>

                            <Button
                                variant="hero"
                                onPress={handleSubmit}
                                disabled={!selectedAnswer?.trim() || !((betsByPlayerId[activePlayer.id] ?? selectedBet) || 0) || !!answerBoard[activePlayer.id]?.hasAnswered}
                                className="w-full"
                            >
                                <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                    {t('submit')}
                                </Text>
                            </Button>
                        </View>
                    )}

                    {/* Final wager setup */}
                    {phase === 'final-wager' && (
                        <View className="space-y-6">
                            <Card className="rounded-3xl">
                                <CardContent className="p-7 space-y-5">
                                    <Text className="text-2xl font-display font-bold text-center text-foreground">
                                        {t('finalWager')}
                                    </Text>
                                    <Text className="text-center text-muted-foreground">
                                        {t('finalWagerDesc')}
                                    </Text>

                                    {isHost ? (
                                        <View className="items-center">
                                            <Text className="text-muted-foreground">
                                                {t('finalMode')}: {t('sharedFinal')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View className="items-center">
                                            <Text className="text-muted-foreground">
                                                {t('finalMode')}: {t('sharedFinal')}
                                            </Text>
                                        </View>
                                    )}

                                    <View className="flex-row justify-center gap-3">
                                        {[0, 10, 20].map((w) => (
                                            <TouchableOpacity
                                                key={w}
                                                onPress={() => updateFinalChoice({ wager: w })}
                                                className={`px-4 py-3 rounded-xl border-2 ${currentFinalChoice.wager === w ? 'border-accent bg-accent/20' : 'border-border bg-muted'}`}
                                            >
                                                <Text className="font-display font-bold text-foreground">{w} {t('points')}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View className="space-y-3">
                                        <Text className="text-center font-semibold text-foreground">{t('chooseDifficulty')}</Text>
                                        <View className="flex-row justify-center gap-2">
                                            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                                                <TouchableOpacity
                                                    key={d}
                                                    onPress={() => updateFinalChoice({ difficulty: d })}
                                                    className={`px-4 py-2 rounded-xl border ${currentFinalChoice.difficulty === d ? 'border-primary bg-primary/20' : 'border-border bg-muted'}`}
                                                >
                                                    <Text className="font-display font-semibold text-foreground">{t(d)}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {isHost ? (
                                        <Button
                                            variant="hero"
                                            disabled={currentFinalChoice.wager === null || isLoadingFinal}
                                            onPress={startFinalQuestion}
                                            className="w-full"
                                        >
                                            <Text className="text-lg font-display font-bold text-primary-foreground">
                                                {isLoadingFinal ? t('loading') : t('startFinal')}
                                            </Text>
                                        </Button>
                                    ) : (
                                        <View className="items-center">
                                            <Text className="text-muted-foreground">{t('waitingForHost')}</Text>
                                        </View>
                                    )}
                                </CardContent>
                            </Card>
                        </View>
                    )}

                    {/* Question Phase */}
                    {(phase === 'preview' || phase === 'validation' || phase === 'scoring' || phase === 'final-question' || phase === 'final-validation' || phase === 'final-scoring') && activeQuestion && (
                        <View className={isCompact ? 'space-y-5' : 'space-y-8'}>
                            {/* Your Bet Display */}
                            <View className="items-center">
                                <View className="px-4 py-2 rounded-full bg-accent/20">
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
                                isAnswerPhase={phase === 'final-question' || (phase === 'preview' && !showCorrectAnswer && !answerBoard[activePlayer.id]?.hasAnswered)}
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

                            {phase === 'preview' && !showCorrectAnswer && !isFinalRound && !answerBoard[activePlayer.id]?.hasAnswered && (
                                <View className={isCompact ? 'space-y-4' : 'space-y-6'}>
                                    <Card className="border-accent/30 rounded-3xl">
                                        <CardContent className={isCompact ? 'p-6 space-y-4' : 'p-9 space-y-6'}>
                                            <View className="items-center">
                                                <View className="px-4 py-2 rounded-full bg-accent/20">
                                                    <Text className="text-accent font-display font-bold">
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
                                                density={isCompact ? 'compact' : 'default'}
                                                variant="grid"
                                            />
                                        </CardContent>
                                    </Card>

                                    <Button
                                        variant="hero"
                                        onPress={handleSubmit}
                                        disabled={!selectedAnswer?.trim() || !((betsByPlayerId[activePlayer.id] ?? selectedBet) || 0) || !!answerBoard[activePlayer.id]?.hasAnswered}
                                        className="w-full"
                                    >
                                        <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                            {t('submit')}
                                        </Text>
                                    </Button>
                                </View>
                            )}

                            {phase === 'final-question' && (
                                <Button
                                    variant="hero"
                                    onPress={handleSubmit}
                                    disabled={!selectedAnswer?.trim() || !!answerBoard[activePlayer.id]?.hasAnswered}
                                    className="w-full"
                                >
                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                        {t('submit')}
                                    </Text>
                                </Button>
                            )}

                            {/* Answer Preview Phase */}
                            {phase === 'preview' && !showCorrectAnswer && (
                                <View className="space-y-5">
                                    <Card className="rounded-3xl">
                                        <CardContent className="p-5 space-y-3">
                                            <Text className="text-lg font-display font-semibold text-foreground">
                                                {t('answerPreview')}
                                            </Text>
                                            {!viewerHasAnswered && (
                                                <View className="p-3 rounded-lg bg-muted/40 border border-border/40">
                                                    <Text className="text-sm text-muted-foreground">
                                                        {t('submitToSee')}
                                                    </Text>
                                                </View>
                                            )}
                                            {(viewerHasAnswered || isHost) && gameState.players.map((player) => {
                                                const entry = answerBoard[player.id];
                                                return (
                                                    <View key={player.id} className="flex-row justify-between items-center py-2 border-b border-border/40">
                                                        <Text className="font-semibold text-foreground">{player.name}</Text>
                                                        <Text className="text-sm text-muted-foreground">
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
                                            className="w-full"
                                        >
                                            <View className="flex-row items-center gap-2">
                                                <Text className="font-display font-bold text-secondary-foreground">
                                                    {t('revealNow')}
                                                </Text>
                                                <Text>🎯</Text>
                                            </View>
                                        </Button>
                                    )}
                                </View>
                            )}

                            {phase === 'preview' && !showCorrectAnswer && !isHost && viewerHasAnswered && (
                                <View className="items-center">
                                    <Text className="text-muted-foreground">{t('waitingForHost')}</Text>
                                </View>
                            )}

                            {/* Validation Phase */}
                            {(phase === 'validation' || phase === 'final-validation') && (
                                <Card className="rounded-3xl">
                                    <CardContent className="p-5 space-y-4">
                                        <Text className="text-lg font-display font-semibold text-foreground">
                                            {t('hostValidation')}
                                        </Text>
                                        {gameState.players.map((player) => {
                                            const entry = answerBoard[player.id];
                                            return (
                                                <View key={player.id} className="flex-row items-center justify-between py-2 border-b border-border/40">
                                                    <View className="flex-1">
                                                        <Text className="font-semibold text-foreground">{player.name}</Text>
                                                        <Text className="text-sm text-muted-foreground">
                                                            {entry?.answer || t('waitingForAnswer')}
                                                        </Text>
                                                    </View>
                                                    {isHost && entry?.hasAnswered && (
                                                        <View className="flex-row gap-2">
                                                            <TouchableOpacity
                                                                onPress={() => toggleValidation(player.id, true)}
                                                                className={`px-3 py-2 rounded-lg border ${entry.isCorrect ? 'border-neon-green bg-neon-green/20' : 'border-border bg-muted'}`}
                                                            >
                                                                <Text className="text-neon-green font-semibold">{t('markCorrect')}</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => toggleValidation(player.id, false)}
                                                                className={`px-3 py-2 rounded-lg border ${entry.isCorrect === false ? 'border-destructive bg-destructive/20' : 'border-border bg-muted'}`}
                                                            >
                                                                <Text className="text-destructive font-semibold">{t('markIncorrect')}</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}

                                        {isHost && (
                                            <Button variant="hero" onPress={applyScores} className="w-full">
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
                                <View className="items-center space-y-4">
                                    <Text className={`text-3xl font-display font-bold ${isCorrectAnswer ? 'text-neon-green' : 'text-destructive'}`}>
                                        {isCorrectAnswer
                                            ? `${t('correct')} ${isFinalRound ? '' : `+${currentBetDisplay ?? 0}`}`
                                            : isFinalRound
                                                ? `${t('incorrect')} -${currentFinalChoice.wager || 0}`
                                                : t('incorrect')}
                                    </Text>
                                    {isHost ? (
                                        <Button variant="hero" onPress={handleNextQuestion} className="w-full">
                                            <Text className="text-lg font-display font-bold text-primary-foreground">
                                                {isFinalRound ? `${t('seeResults')} 🏆` : `${t('next')} ${t('question')} ➡️`}
                                            </Text>
                                        </Button>
                                    ) : (
                                        <Text className="text-muted-foreground">{t('waitingForHost')}</Text>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
