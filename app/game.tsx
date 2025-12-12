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
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, GamePhase, Question, Difficulty, Player } from '@/contexts/GameContext';
import { generateQuestions } from '@/services/questionService';

type AnswerBoard = Record<string, { answer?: string; isCorrect?: boolean; hasAnswered: boolean }>;

export default function Game() {
    const router = useRouter();
    const { t } = useLanguage();
    const { gameState, setGameState, currentPlayer, apiKey } = useGame();

    const [phase, setPhase] = useState<GamePhase>('betting');
    const [selectedBet, setSelectedBet] = useState<number | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
    const [timerKey, setTimerKey] = useState(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [score, setScore] = useState(0);
    const [answerBoard, setAnswerBoard] = useState<AnswerBoard>({});
    const [isFinalRound, setIsFinalRound] = useState(false);
    const [finalChoices, setFinalChoices] = useState<Record<string, { wager: number | null; difficulty: Difficulty }>>({});
    const [finalMode, setFinalMode] = useState<'personalized' | 'shared'>('personalized');
    const [finalQuestion, setFinalQuestion] = useState<Question | null>(null);
    const [isLoadingFinal, setIsLoadingFinal] = useState(false);

    const loadingMessages = [
        { en: 'Brewing questions...', fr: 'Préparation des questions...', ar: 'جاري تحضير الأسئلة...' },
        { en: 'Consulting the AI oracle...', fr: "Consultation de l'oracle IA...", ar: 'استشارة أوراكل الذكاء الاصطناعي...' },
        { en: 'Making it fun...', fr: 'On rend ça fun...', ar: 'نجعلها ممتعة...' },
        { en: 'Almost ready!', fr: 'Presque prêt!', ar: 'تقريباً جاهز!' },
    ];

    const activePlayer: Player | undefined = useMemo(() => {
        if (!gameState) return undefined;
        return currentPlayer || gameState.players.find((p) => p.isHost) || gameState.players[0];
    }, [gameState, currentPlayer]);

    const activeQuestion = useMemo(() => {
        if (isFinalRound) return finalQuestion;
        return questions[currentQuestionIndex];
    }, [isFinalRound, finalQuestion, questions, currentQuestionIndex]);

    const totalQuestions = isFinalRound ? 1 : questions.length;
    const currentFinalChoice = activePlayer
        ? (finalChoices[activePlayer.id] || { wager: null, difficulty: 'medium' as Difficulty })
        : { wager: null, difficulty: 'medium' as Difficulty };
    const usedBetsForPlayer = activePlayer?.usedBets ?? [];
    const currentBetDisplay = isFinalRound ? currentFinalChoice.wager : activePlayer.currentBet ?? selectedBet ?? null;

    const resetForNewQuestion = () => {
        setSelectedAnswer(null);
        setShowCorrectAnswer(false);
        setTimerKey((prev) => prev + 1);
        const board: AnswerBoard = {};
        gameState?.players.forEach((p) => {
            board[p.id] = { hasAnswered: false };
        });
        setAnswerBoard(board);
    };

    useEffect(() => {
        if (!gameState) {
            router.replace('/');
            return;
        }

        const board: AnswerBoard = {};
        gameState.players.forEach((p) => {
            board[p.id] = { hasAnswered: false };
        });
        setAnswerBoard(board);

        const loadQuestions = async () => {
            setIsLoading(true);

            let messageIndex = 0;
            const messageInterval = setInterval(() => {
                const msg = loadingMessages[messageIndex % loadingMessages.length];
                setLoadingMessage(msg[gameState.settings.language] || msg.en);
                messageIndex++;
            }, 1500);

            try {
                const hostKey = gameState.hostApiKey || apiKey;
                if (!hostKey) {
                    Alert.alert(t('apiKey'), t('missingApiKeyHost'));
                    router.replace('/settings');
                    return;
                }

                const result = await generateQuestions(gameState.settings, hostKey);

                clearInterval(messageInterval);

                if (result.error) {
                    console.error('Question generation error:', result.error);
                    Alert.alert(t('loading'), result.error);
                    router.replace('/lobby');
                    return;
                }

                if (result.questions && result.questions.length > 0) {
                    setQuestions(result.questions);
                    setIsLoading(false);
                } else {
                    router.replace('/lobby');
                }
            } catch (error) {
                clearInterval(messageInterval);
                console.error('Error loading questions:', error);
                router.replace('/lobby');
            }
        };

        loadQuestions();
    }, []);

    if (!gameState || !activePlayer) return null;

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center p-4">
                <Logo size="lg" animated />
                <View className="mt-8 items-center max-w-2xl">
                    <ActivityIndicator size="large" color="#00D4AA" />
                    <Text className="text-2xl font-display font-bold text-foreground mt-4 text-center">
                        {loadingMessage || 'Loading...'}
                    </Text>
                    <Text className="text-muted-foreground mt-2 text-center">
                        AI is generating {gameState.settings.numberOfQuestions} questions about {gameState.settings.customTheme || t(gameState.settings.theme)}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const handleBetConfirm = () => {
        if (!selectedBet) return;

        setGameState((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                players: prev.players.map((p) => {
                    if (p.id !== activePlayer.id) return p;
                    const mergedUsed = Array.from(new Set([...(p.usedBets || []), selectedBet]));
                    return {
                        ...p,
                        currentBet: selectedBet,
                        usedBets: mergedUsed,
                    };
                }),
            };
        });

        setPhase('question');
        setTimerKey((prev) => prev + 1);
    };

    const handleAnswerSubmit = (answer: string) => {
        setSelectedAnswer(answer);
        setPhase('preview');

        setAnswerBoard((prev) => ({
            ...prev,
            [activePlayer.id]: { ...prev[activePlayer.id], answer, hasAnswered: true },
        }));

        setGameState((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                answers: {
                    ...prev.answers,
                    [activePlayer.id]: { playerId: activePlayer.id, answer },
                },
            };
        });
    };

    const handleTimerComplete = () => {
        if (phase === 'question') {
            setPhase('preview');
        }
    };

    const handleRevealAnswer = () => {
        if (!activeQuestion) return;
        setShowCorrectAnswer(true);
        setPhase('validation');

        setAnswerBoard((prev) => {
            const clone = { ...prev };
            Object.keys(clone).forEach((playerId) => {
                const entry = clone[playerId];
                if (entry.hasAnswered && entry.answer) {
                    clone[playerId] = {
                        ...entry,
                        isCorrect: entry.answer.trim().toLowerCase() === activeQuestion.correctAnswer.trim().toLowerCase(),
                    };
                }
            });
            return clone;
        });
    };

    const toggleValidation = (playerId: string, isCorrect: boolean) => {
        setAnswerBoard((prev) => ({
            ...prev,
            [playerId]: { ...prev[playerId], isCorrect },
        }));
    };

    const applyScores = () => {
        const wagerForPlayer = (playerId: string) => {
            if (isFinalRound) return finalChoices[playerId]?.wager || 0;
            const player = gameState?.players.find((p) => p.id === playerId);
            return player?.currentBet || 0;
        };

        setGameState((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                players: prev.players.map((p) => {
                    const entry = answerBoard[p.id];
                    const wager = wagerForPlayer(p.id);
                    if (!entry?.hasAnswered || entry.isCorrect === undefined || wager === 0) {
                        return { ...p, currentBet: undefined };
                    }

                    const delta = entry.isCorrect ? wager : isFinalRound ? -wager : 0;
                    return { ...p, score: p.score + delta, currentBet: undefined };
                }),
            };
        });

        const selfEntry = answerBoard[activePlayer.id];
        const selfWager = wagerForPlayer(activePlayer.id);
        if (selfEntry?.isCorrect !== undefined) {
            const delta = selfEntry.isCorrect ? selfWager : isFinalRound ? -selfWager : 0;
            setScore((prev) => prev + delta);
        }

        setPhase('scoring');
    };

    const handleNextQuestion = () => {
        if (isFinalRound) {
            router.replace('/results');
            return;
        }

        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
            setSelectedBet(null);
            resetForNewQuestion();
            setPhase('betting');
        } else {
            setIsFinalRound(true);
            resetForNewQuestion();
            setPhase('final-wager');
        }

        // Clear transient bets between questions so the next pick is clean.
        setGameState((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                players: prev.players.map((p) => ({ ...p, currentBet: undefined })),
            };
        });
    };

    const updateFinalChoice = (updates: Partial<{ wager: number | null; difficulty: Difficulty }>) => {
        setFinalChoices((prev) => ({
            ...prev,
            [activePlayer.id]: {
                wager: updates.wager ?? (prev[activePlayer.id]?.wager ?? null),
                difficulty: updates.difficulty ?? prev[activePlayer.id]?.difficulty ?? 'medium',
            },
        }));
    };

    const startFinalQuestion = async () => {
        if (!gameState) return;
        const choice = finalChoices[activePlayer.id] || { wager: null, difficulty: 'medium' as Difficulty };
        if (choice.wager === null) return;

        const keyToUse = finalMode === 'personalized'
            ? gameState.playerApiKeys?.[activePlayer.id] || apiKey
            : gameState.hostApiKey || apiKey;
        if (!keyToUse) {
            Alert.alert(t('apiKey'), t('missingApiKeyPersonal'));
            return;
        }

        setIsLoadingFinal(true);
        resetForNewQuestion();

        const finalSettings = {
            ...gameState.settings,
            numberOfQuestions: 1,
            difficulty: choice.difficulty,
            questionType: 'open-ended' as const,
        };

        const result = await generateQuestions(finalSettings, keyToUse);
        if (result.error) {
            Alert.alert(t('loading'), result.error);
            setIsLoadingFinal(false);
            return;
        }

        if (result.questions && result.questions.length > 0) {
            setFinalQuestion(result.questions[0]);
            setShowCorrectAnswer(false);
            setSelectedAnswer(null);
            setTimerKey((prev) => prev + 1);
            setPhase('question');
        } else {
            Alert.alert(t('loading'), t('generationFailed'));
            router.replace('/results');
        }
        setIsLoadingFinal(false);
    };

    const isCorrectAnswer = selectedAnswer?.toLowerCase().trim() === activeQuestion?.correctAnswer?.toLowerCase().trim();
    const viewerHasAnswered = answerBoard[activePlayer.id]?.hasAnswered;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-4 max-w-5xl w-full self-center pb-12"
            >
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6 pt-8">
                    <Logo size="sm" animated={false} />
                    <View className="flex-row items-center gap-4">
                        <Text className="text-sm text-muted-foreground">
                            {isFinalRound ? t('finalQuestion') : t('question')} {isFinalRound ? 1 : currentQuestionIndex + 1}/{totalQuestions}
                        </Text>
                        <View className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/30">
                            <Text className="text-primary font-bold">{score} pts</Text>
                        </View>
                    </View>
                </View>

                <View className="max-w-3xl mx-auto w-full space-y-6">
                    {/* Betting Phase */}
                    {phase === 'betting' && !isFinalRound && (
                        <View className="space-y-6">
                            <Card className="border-accent/30" style={{
                                shadowColor: '#FFCC00',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.3,
                                shadowRadius: 20,
                                elevation: 10,
                            }}>
                                <CardContent className="p-8">
                                    <BetSelector
                                        totalQuestions={totalQuestions}
                                        usedBets={usedBetsForPlayer}
                                        selectedBet={selectedBet}
                                        onSelectBet={setSelectedBet}
                                    />
                                </CardContent>
                            </Card>

                            <Button
                                variant="hero"
                                onPress={handleBetConfirm}
                                disabled={!selectedBet}
                                className="w-full"
                            >
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                        {t('confirm')} Bet
                                    </Text>
                                    <Text className="text-lg">🎲</Text>
                                </View>
                            </Button>
                        </View>
                    )}

                    {/* Final wager setup */}
                    {phase === 'final-wager' && (
                        <View className="space-y-4">
                            <Card>
                                <CardContent className="p-6 space-y-4">
                                    <Text className="text-2xl font-display font-bold text-center text-foreground">
                                        {t('finalWager')}
                                    </Text>
                                    <Text className="text-center text-muted-foreground">
                                        {t('finalWagerDesc')}
                                    </Text>

                                    <View className="flex-row justify-center gap-2">
                                        {(['personalized', 'shared'] as const).map((mode) => (
                                            <TouchableOpacity
                                                key={mode}
                                                onPress={() => setFinalMode(mode)}
                                                className={`flex-1 px-3 py-2 rounded-xl border ${finalMode === mode ? 'border-primary bg-primary/20' : 'border-border bg-muted'}`}
                                            >
                                                <Text className="text-center font-display font-semibold text-foreground">
                                                    {mode === 'personalized' ? t('personalFinal') : t('sharedFinal')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

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

                                    <View className="space-y-2">
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
                                </CardContent>
                            </Card>
                        </View>
                    )}

                    {/* Question Phase */}
                    {(phase === 'question' || phase === 'preview' || phase === 'validation' || phase === 'scoring') && activeQuestion && (
                        <View className="space-y-6">
                            {/* Timer */}
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
                                isAnswerPhase={phase === 'question'}
                                showCorrectAnswer={showCorrectAnswer}
                            />

                            {/* Answer Preview Phase */}
                            {phase === 'preview' && !showCorrectAnswer && (
                                <View className="space-y-3">
                                    <Card>
                                        <CardContent className="p-4 space-y-2">
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
                                </View>
                            )}

                            {/* Validation Phase */}
                            {phase === 'validation' && (
                                <Card>
                                    <CardContent className="p-4 space-y-3">
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
                                                    {entry?.hasAnswered && (
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

                                        <Button variant="hero" onPress={applyScores} className="w-full">
                                            <Text className="text-lg font-display font-bold text-primary-foreground">
                                                {t('applyScores')}
                                            </Text>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Scoring / progression */}
                            {phase === 'scoring' && (
                                <View className="items-center space-y-4">
                                    <Text className={`text-3xl font-display font-bold ${isCorrectAnswer ? 'text-neon-green' : 'text-destructive'}`}>
                                        {isCorrectAnswer
                                            ? `${t('correct')} ${isFinalRound ? '' : `+${currentBetDisplay ?? 0}`}`
                                            : isFinalRound
                                                ? `${t('incorrect')} -${currentFinalChoice.wager || 0}`
                                                : t('incorrect')}
                                    </Text>
                                    <Button variant="hero" onPress={handleNextQuestion} className="w-full">
                                        <Text className="text-lg font-display font-bold text-primary-foreground">
                                            {isFinalRound ? `${t('seeResults')} 🏆` : `${t('next')} ${t('question')} ➡️`}
                                        </Text>
                                    </Button>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
