import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
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
import { useGame, GamePhase, Question, Difficulty, Player } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { generateQuestions } from '@/services/questionService';
import { fetchRoomState, updateRoomQuestions, updatePlayerState } from '@/services/roomService';
import {
    fetchGameMeta,
    subscribeToGame,
    fetchBets,
    fetchPlayerBets,
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
} from '@/services/gameService';

type AnswerBoard = Record<string, { answer?: string; isCorrect?: boolean; hasAnswered: boolean }>;

export default function Game() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const { gameState, setGameState, currentPlayer, apiKey } = useGame();

    const gameStateRef = React.useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const refreshInFlightRef = React.useRef(false);
    const lastQuestionsSignatureRef = React.useRef<string>('');
    const autoAdvanceInFlightRef = React.useRef(false);

    const [phase, setPhase] = useState<GamePhase>('betting');
    const [selectedBet, setSelectedBet] = useState<number | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
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
        if (!isSupabaseConfigured || !gameState?.roomCode) return;

        let cancelled = false;

        const refresh = async () => {
            if (refreshInFlightRef.current) return;
            refreshInFlightRef.current = true;
            try {
                const roomCode = gameState.roomCode;

                const [roomState, meta] = await Promise.all([
                    fetchRoomState(roomCode),
                    fetchGameMeta(roomCode),
                ]);

                if (cancelled) return;

                setPhase((prev) => (prev === (meta.phase as GamePhase) ? prev : (meta.phase as GamePhase)));
                setCurrentQuestionIndex((prev) => (prev === meta.currentQuestionIndex ? prev : meta.currentQuestionIndex));
                setFinalMode((prev) => (prev === meta.finalMode ? prev : meta.finalMode));

                if (Array.isArray(meta.questions) && meta.questions.length > 0) {
                    const signature = `${meta.questions.length}:${(meta.questions as any)?.[0]?.id || ''}:${(meta.questions as any)?.[meta.questions.length - 1]?.id || ''}`;
                    if (signature !== lastQuestionsSignatureRef.current) {
                        lastQuestionsSignatureRef.current = signature;
                        setQuestions(meta.questions as Question[]);
                    }
                    setIsLoading(false);
                } else {
                    setIsLoading(true);
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
                if ((!meta.questions || meta.questions.length === 0) && (currentPlayer?.id === roomState.room.host_player_id)) {
                    const hostKey = gameState.hostApiKey || apiKey;
                    if (!hostKey) {
                        setLoadingMessage(t('missingApiKeyHost'));
                        return;
                    }

                    setLoadingMessage(t('generatingQuestions'));
                    const result = await generateQuestions(roomState.room.settings, hostKey);
                    if (cancelled) return;
                    if (result.error) {
                        Alert.alert(t('loading'), result.error);
                        router.replace('/lobby');
                        return;
                    }
                    if (result.questions && result.questions.length > 0) {
                        await updateRoomQuestions({ roomCode, questions: result.questions });
                        return;
                    }
                }

                if ((!meta.questions || meta.questions.length === 0) && currentPlayer?.id !== roomState.room.host_player_id) {
                    setLoadingMessage('Waiting for host...');
                }

                // Load gameplay state for current phase
                if (!currentPlayer?.id) return;

                if (!meta.phase.startsWith('final')) {
                    const [bets, myBets, answers, validations] = await Promise.all([
                        fetchBets({ roomCode, questionIndex: meta.currentQuestionIndex }),
                        fetchPlayerBets({ roomCode, playerId: currentPlayer.id }),
                        fetchAnswers({ roomCode, questionIndex: meta.currentQuestionIndex }),
                        fetchValidations({ roomCode, questionIndex: meta.currentQuestionIndex }),
                    ]);

                    const betMap: Record<string, number> = {};
                    bets.forEach((b) => {
                        betMap[b.player_id] = b.bet_value;
                    });
                    setBetsByPlayerId(betMap);
                    setUsedBetsForPlayer(Array.from(new Set(myBets.map((b) => b.bet_value))).sort((a, b) => a - b));

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
                    setAnswerBoard(board);
                    setSelectedAnswer(answerMap[currentPlayer.id] ?? null);
                    setSelectedBet(betMap[currentPlayer.id] ?? null);
                } else {
                    const [choices, myQuestion, finalAnswers, finalValidations] = await Promise.all([
                        fetchFinalChoices(roomCode),
                        fetchFinalQuestion({ roomCode, playerId: currentPlayer.id }),
                        fetchFinalAnswers(roomCode),
                        fetchFinalValidations(roomCode),
                    ]);

                    const nextChoices: Record<string, { wager: number | null; difficulty: Difficulty }> = {};
                    choices.forEach((c) => {
                        const wager = typeof c.wager === 'number' ? c.wager : null;
                        const difficulty = (c.difficulty as Difficulty) || 'medium';
                        nextChoices[c.player_id] = { wager, difficulty };
                    });
                    setFinalChoices(nextChoices);

                    setFinalQuestion(myQuestion);

                    // Personalized final: generate own question if missing.
                    if (meta.phase === 'final-question' && meta.finalMode === 'personalized' && !myQuestion) {
                        const choice = nextChoices[currentPlayer.id];
                        if (!choice || choice.wager === null) {
                            return;
                        }
                        const keyToUse = gameState.playerApiKeys?.[currentPlayer.id] || apiKey;
                        if (!keyToUse) {
                            setLoadingMessage(t('missingApiKeyPersonal'));
                            return;
                        }

                        setIsLoadingFinal(true);
                        const finalSettings = {
                            ...roomState.room.settings,
                            numberOfQuestions: 1,
                            difficulty: choice.difficulty,
                            questionType: 'open-ended' as const,
                        };
                        const result = await generateQuestions(finalSettings, keyToUse);
                        if (!cancelled && result.questions && result.questions.length > 0) {
                            await upsertFinalQuestion({ roomCode, playerId: currentPlayer.id, question: result.questions[0] });
                        }
                        setIsLoadingFinal(false);
                    }

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
                    setAnswerBoard(board);
                    setSelectedAnswer(ansMap[currentPlayer.id] ?? null);
                }
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setIsLoading(false);
            } finally {
                refreshInFlightRef.current = false;
            }
        };

        refresh();
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToGame({ roomCode: gameState.roomCode, onChange: refresh });

        const poll = setInterval(refresh, 2000);
        return () => {
            cancelled = true;
            clearInterval(poll);
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
        };
    }, [apiKey, currentPlayer?.id, gameState?.roomCode, gameState?.hostApiKey, gameState?.playerApiKeys, router, setGameState, t]);

    useEffect(() => {
        if (!isHost || !gameState?.roomCode) return;
        if (autoAdvanceInFlightRef.current) return;

        const allAnswered = gameState.players.every((p) => !!answerBoard[p.id]?.hasAnswered);
        if (!allAnswered) return;

        if (phase === 'question') {
            autoAdvanceInFlightRef.current = true;
            setRoomPhase({ roomCode: gameState.roomCode, phase: 'preview' })
                .catch(() => undefined)
                .finally(() => {
                    autoAdvanceInFlightRef.current = false;
                });
        }

        if (phase === 'final-question') {
            autoAdvanceInFlightRef.current = true;
            setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-validation' })
                .catch(() => undefined)
                .finally(() => {
                    autoAdvanceInFlightRef.current = false;
                });
        }
    }, [answerBoard, gameState?.players, gameState?.roomCode, isHost, phase]);

    if (!gameState || !activePlayer) return null;

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

    const handleBetConfirm = async () => {
        if (!gameState?.roomCode || !activePlayer?.id || !selectedBet) return;

        try {
            await submitBet({
                roomCode: gameState.roomCode,
                questionIndex: currentQuestionIndex,
                playerId: activePlayer.id,
                betValue: selectedBet,
            });
        } catch (err) {
            Alert.alert(t('placeBet'), err instanceof Error ? err.message : t('betAlreadyUsed'));
            return;
        }

        if (isHost) {
            const bets = await fetchBets({ roomCode: gameState.roomCode, questionIndex: currentQuestionIndex });
            if (bets.length < gameState.players.length) {
                Alert.alert(t('waiting'), t('waitingForPlayers'));
                return;
            }
            await setRoomPhase({ roomCode: gameState.roomCode, phase: 'question' });
            setTimerKey((prev) => prev + 1);
        }
    };

    const handleAnswerSubmit = async (answer: string) => {
        if (!gameState?.roomCode || !activePlayer?.id) return;
        setSelectedAnswer(answer);

        try {
            if (phase.startsWith('final')) {
                await submitFinalAnswer({ roomCode: gameState.roomCode, playerId: activePlayer.id, answer });
            } else {
                await submitAnswer({ roomCode: gameState.roomCode, questionIndex: currentQuestionIndex, playerId: activePlayer.id, answer });
            }
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to submit');
        }
    };

    const handleTimerComplete = () => {
        if (!isHost || !gameState?.roomCode) return;
        if (phase === 'question') {
            setRoomPhase({ roomCode: gameState.roomCode, phase: 'preview' }).catch(() => undefined);
        }
        if (phase === 'final-question') {
            setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-validation' }).catch(() => undefined);
        }
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
                            isCorrect: a.answer.trim().toLowerCase() === activeQuestion.correctAnswer.trim().toLowerCase(),
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
                            isCorrect: a.answer.trim().toLowerCase() === activeQuestion.correctAnswer.trim().toLowerCase(),
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

        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < questions.length) {
            await updateRoomMeta({
                roomCode: gameState.roomCode,
                patch: {
                    current_question_index: nextIndex,
                    phase: 'betting',
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

        const hostChoice = finalChoices[currentPlayer?.id || ''] || { wager: null, difficulty: 'medium' as Difficulty };
        if (finalMode === 'shared' && hostChoice.wager === null) {
            Alert.alert(t('finalWager'), t('finalWagerDesc'));
            return;
        }

        if (finalMode === 'shared') {
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
                Alert.alert(t('loading'), result.error || t('generationFailed'));
                setIsLoadingFinal(false);
                return;
            }

            await Promise.all(
                gameState.players.map((p) => upsertFinalQuestion({ roomCode: gameState.roomCode, playerId: p.id, question: result.questions![0] }))
            );
            setIsLoadingFinal(false);
        }

        await setRoomPhase({ roomCode: gameState.roomCode, phase: 'final-question' });
        setTimerKey((prev) => prev + 1);
    };

    const isCorrectAnswer = !!answerBoard[activePlayer.id]?.isCorrect;
    const viewerHasAnswered = answerBoard[activePlayer.id]?.hasAnswered;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="game" />
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-7 max-w-5xl w-full self-center pb-16 space-y-10"
            >
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between mb-9 pt-12`}>
                    <Logo size="sm" animated={false} />
                    <View className="flex-row items-center gap-4">
                        <Text className="text-sm text-muted-foreground">
                            {isFinalRound ? t('finalQuestion') : t('question')} {isFinalRound ? 1 : currentQuestionIndex + 1}/{totalQuestions}
                        </Text>
                        <View className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/30">
                            <Text className="text-primary font-bold">{activePlayer.score} pts</Text>
                        </View>
                    </View>
                </View>

                <View className="max-w-3xl mx-auto w-full space-y-10">
                    {/* Unified Round Screen (Bet + Answer) */}
                    {!isFinalRound && (phase === 'betting' || phase === 'question') && activeQuestion && (
                        <View className="space-y-8">
                            {/* Timer (answering only) */}
                            {phase === 'question' && (
                                <View className="items-center">
                                    <Timer
                                        key={timerKey}
                                        seconds={gameState.settings.timePerQuestion}
                                        onComplete={handleTimerComplete}
                                        size="lg"
                                    />
                                </View>
                            )}

                            {/* Bet selection / bet summary */}
                            {phase === 'betting' ? (
                                <View className="space-y-6">
                                    <Card className="border-accent/30 rounded-3xl" style={{
                                        shadowColor: '#D4A72C',
                                        shadowOffset: { width: 0, height: 0 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 20,
                                        elevation: 10,
                                    }}>
                                        <CardContent className="p-9 space-y-6">
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
                                            />

                                            <Button
                                                variant="hero"
                                                onPress={handleBetConfirm}
                                                disabled={!selectedBet}
                                                className="w-full"
                                            >
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                                        {t('confirm')} {selectedBet ? `${selectedBet} ${t('points')}` : t('bet')}
                                                    </Text>
                                                    <Text className="text-lg">🎲</Text>
                                                </View>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </View>
                            ) : (
                                <View className="items-center">
                                    <View className="px-4 py-2 rounded-full bg-accent/20">
                                        <Text className="text-accent font-display font-bold">
                                            {t('yourBet')}: {currentBetDisplay ?? 0} {t('points')}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Question + answers (always visible; disabled during betting) */}
                            <QuestionCard
                                question={activeQuestion}
                                questionNumber={currentQuestionIndex + 1}
                                totalQuestions={totalQuestions}
                                selectedAnswer={selectedAnswer}
                                onSelectAnswer={handleAnswerSubmit}
                                isAnswerPhase={true}
                                disabled={phase === 'betting'}
                                disabledMessage={
                                    phase === 'betting'
                                        ? (betsByPlayerId[activePlayer.id] || selectedBet ? (t('waitingForPlayers') || 'Waiting for other players...') : (t('placeBetFirst') || 'Select and confirm your bet to start answering'))
                                        : undefined
                                }
                                showCorrectAnswer={false}
                                hintsEnabled={gameState.settings.hintsEnabled}
                            />
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
                                        <View className="flex-row justify-center gap-2">
                                            {(['personalized', 'shared'] as const).map((mode) => (
                                                <TouchableOpacity
                                                    key={mode}
                                                    onPress={async () => {
                                                        if (!gameState?.roomCode) return;
                                                        setFinalMode(mode);
                                                        try {
                                                            await updateRoomMeta({
                                                                roomCode: gameState.roomCode,
                                                                patch: { final_mode: mode },
                                                            });
                                                        } catch (err) {
                                                            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to update final mode');
                                                        }
                                                    }}
                                                    className={`flex-1 px-3 py-2 rounded-xl border ${finalMode === mode ? 'border-primary bg-primary/20' : 'border-border bg-muted'}`}
                                                >
                                                    <Text className="text-center font-display font-semibold text-foreground">
                                                        {mode === 'personalized' ? t('personalFinal') : t('sharedFinal')}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : (
                                        <View className="items-center">
                                            <Text className="text-muted-foreground">
                                                {t('finalMode')}: {finalMode === 'personalized' ? t('personalFinal') : t('sharedFinal')}
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
                                            <Text className="text-muted-foreground">Waiting for host...</Text>
                                        </View>
                                    )}
                                </CardContent>
                            </Card>
                        </View>
                    )}

                    {/* Question Phase */}
                    {(phase === 'preview' || phase === 'validation' || phase === 'scoring' || phase === 'final-question' || phase === 'final-validation' || phase === 'final-scoring') && activeQuestion && (
                        <View className="space-y-8">
                            {/* Timer */}
                            {phase === 'final-question' && (
                                <View className="items-center">
                                    <Timer
                                        key={timerKey}
                                        seconds={gameState.settings.timePerQuestion}
                                        onComplete={handleTimerComplete}
                                        size="lg"
                                    />
                                </View>
                            )}

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
                                isAnswerPhase={phase === 'final-question'}
                                showCorrectAnswer={showCorrectAnswer}
                                hintsEnabled={gameState.settings.hintsEnabled}
                            />

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
                                            {viewerHasAnswered && gameState.players.map((player) => {
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

                            {phase === 'preview' && !showCorrectAnswer && !isHost && (
                                <View className="items-center">
                                    <Text className="text-muted-foreground">Waiting for host...</Text>
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
                                        <Text className="text-muted-foreground">Waiting for host...</Text>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
