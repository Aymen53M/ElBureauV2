import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import PlayerAvatar from '@/components/PlayerAvatar';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Player } from '@/contexts/GameContext';

const demoPlayers: Player[] = [
    { id: '1', name: 'Alex', score: 45, isHost: true, isReady: true, usedBets: [], hasApiKey: true },
    { id: '2', name: 'Sam', score: 38, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
    { id: '3', name: 'Jordan', score: 32, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
    { id: '4', name: 'Taylor', score: 28, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
];

const CONFETTI_COLORS = ['#C17F59', '#D4AF37', '#98684D', '#4A7A68', '#D9822B', '#E6C9A8', '#B3261E'];
const CONFETTI_COUNT = 50;

interface ConfettiPiece {
    id: number;
    x: number;
    delay: number;
    duration: number;
    color: string;
    size: number;
    rotation: number;
}

const ConfettiAnimation: React.FC<{ show: boolean }> = ({ show }) => {
    const { height: screenHeight } = Dimensions.get('window');

    const confettiPieces = useMemo<ConfettiPiece[]>(() =>
        Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 2000,
            duration: 3000 + Math.random() * 2000,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            size: 8 + Math.random() * 8,
            rotation: Math.random() * 360,
        })), []
    );

    const animations = useRef(
        confettiPieces.map(() => new Animated.Value(0))
    ).current;

    useEffect(() => {
        if (show) {
            confettiPieces.forEach((piece, index) => {
                const animate = () => {
                    animations[index].setValue(0);
                    Animated.timing(animations[index], {
                        toValue: 1,
                        duration: piece.duration,
                        delay: piece.delay,
                        useNativeDriver: true,
                    }).start(() => {
                        // Reset and repeat
                        if (show) animate();
                    });
                };
                animate();
            });
        }
    }, [show, animations, confettiPieces]);

    if (!show) return null;

    return (
        <View className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
            {confettiPieces.map((piece, index) => {
                const translateY = animations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, screenHeight + 50],
                });
                const translateX = animations[index].interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [0, 15, 0, -15, 0],
                });
                const rotate = animations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${piece.rotation + 720}deg`],
                });
                const opacity = animations[index].interpolate({
                    inputRange: [0, 0.1, 0.9, 1],
                    outputRange: [0, 1, 1, 0],
                });

                return (
                    <Animated.View
                        key={piece.id}
                        style={[
                            styles.confetti,
                            {
                                left: `${piece.x}%`,
                                width: piece.size,
                                height: piece.size,
                                borderRadius: piece.size / 2,
                                backgroundColor: piece.color,
                                transform: [{ translateY }, { translateX }, { rotate }],
                                opacity,
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
};

export default function Results() {
    const router = useRouter();
    const { t } = useLanguage();
    const { gameState, setGameState } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const [showConfetti, setShowConfetti] = useState(false);
    const [revealedRanks, setRevealedRanks] = useState<number[]>([]);
    const [highlights] = useState<string | null>(null);
    const [isLoadingHighlights] = useState(false);
    const [view, setView] = useState<'podium' | 'rankings' | 'highlights'>('podium');
    const [rankPage, setRankPage] = useState(0);

    const players = gameState?.players.length
        ? [...gameState.players].sort((a, b) => b.score - a.score)
        : demoPlayers;
    const winner = players[0];

    useEffect(() => {
        const top = Math.min(4, players.length);
        const revealSequence = Array.from({ length: top }, (_, i) => top - 1 - i);

        const timer1 = setTimeout(() => setRevealedRanks(revealSequence.slice(0, 1)), 500);
        const timer2 = setTimeout(() => setRevealedRanks(revealSequence.slice(0, 2)), 1000);
        const timer3 = setTimeout(() => setRevealedRanks(revealSequence.slice(0, 3)), 1500);
        const timer4 = setTimeout(() => {
            setRevealedRanks(Array.from({ length: players.length }, (_, i) => i));
            setShowConfetti(true);
        }, 2000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [players.length]);

    useEffect(() => {
        setRankPage(0);
    }, [view, players.length, isCompact]);

    // Generate AI highlights when confetti starts
    useEffect(() => {
        if (!showConfetti || highlights || isLoadingHighlights) return;
    }, [showConfetti, highlights, isLoadingHighlights]);

    const handlePlayAgain = () => {
        setGameState(null);
        router.replace('/');
    };

    const getRankEmoji = (rank: number) => {
        switch (rank) {
            case 0: return '🥇';
            case 1: return '🥈';
            case 2: return '🥉';
            default: return `#${rank + 1}`;
        }
    };

    const ranksPerPage = isCompact ? 4 : 6;
    const totalRankPages = Math.max(1, Math.ceil(players.length / ranksPerPage));
    const clampedRankPage = Math.min(rankPage, totalRankPages - 1);
    const rankStart = clampedRankPage * ranksPerPage;
    const rankEnd = Math.min(players.length, rankStart + ranksPerPage);
    const visiblePlayers = players.slice(rankStart, rankEnd);

    const TabButton: React.FC<{ id: 'podium' | 'rankings' | 'highlights'; label: string; icon: string }> = ({
        id,
        label,
        icon,
    }) => (
        <TouchableOpacity
            onPress={() => setView(id)}
            className={`flex-1 ${isCompact ? 'py-1.5' : 'py-2.5'} rounded-xl transition-all ${view === id
                ? 'bg-primary shadow-lg shadow-primary/20'
                : 'bg-transparent'
                }`}
        >
            <View className="flex-row items-center justify-center gap-2">
                <Text className={isCompact ? 'text-base' : 'text-lg'}>{icon}</Text>
                {!isCompact && (
                    <Text className={`font-display font-bold ${view === id ? 'text-primary-foreground' : 'text-foreground/60'}`}>
                        {label}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-background relative">
            <ScreenBackground variant="game" />
            {/* Animated Confetti */}
            <ConfettiAnimation show={showConfetti} />

            <View className={`flex-1 ${isCompact ? 'p-4' : 'p-6'} max-w-5xl w-full self-center`}>
                {/* Header */}
                <View className={`items-center ${isCompact ? 'pt-2' : 'pt-6'} ${isCompact ? 'mb-3' : 'mb-8'}`}>
                    <Logo size={isCompact ? 'sm' : 'md'} animated={false} />
                </View>

                {/* Title + Tabs */}
                <View className={isCompact ? 'space-y-3' : 'space-y-6'}>
                    <View className="items-center">
                        <Text className={`${isCompact ? 'text-4xl' : 'text-5xl'} font-display font-bold text-primary ${isCompact ? 'mb-1' : 'mb-2'}`} style={{
                            textShadowColor: 'rgba(193, 127, 89, 0.2)',
                            textShadowOffset: { width: 0, height: 2 },
                            textShadowRadius: 4,
                        }}>
                            {t('gameOver')}
                        </Text>
                        {!isCompact && (
                            <Text className="text-foreground/70 text-lg font-medium">{t('finalStandings')}</Text>
                        )}
                    </View>

                    <View className="flex-row gap-3 bg-white/30 p-1.5 rounded-2xl border border-white/40 self-center">
                        <TabButton id="podium" label={t('winner')} icon="🏆" />
                        <TabButton id="rankings" label={t('finalStandings')} icon="📋" />
                        <TabButton id="highlights" label={t('gameHighlights')} icon="✨" />
                    </View>
                </View>

                {/* Content */}
                <View className="flex-1 justify-center mt-4">
                    {view === 'podium' && (
                        <Card className="border-2 border-foreground bg-white rounded-lg transform rotate-1" style={styles.winnerCard}>
                            <CardContent className={`${isCompact ? 'p-6' : 'p-10'} items-center`}>
                                <View className="mb-6 p-6 rounded-full bg-accent/10 border-2 border-accent/20">
                                    <Ionicons name="trophy" size={isCompact ? 56 : 80} color="#D4AF37" />
                                </View>
                                <Text className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 font-sans">{t('winner')}</Text>
                                <View className={isCompact ? 'items-center mb-4' : 'items-center mb-6'}>
                                    <PlayerAvatar name={winner.name} size={isCompact ? 'lg' : 'xl'} showName={false} />
                                </View>
                                <Text className={`${isCompact ? 'text-3xl' : 'text-4xl'} font-display font-bold text-foreground mb-2`}>
                                    {winner.name}
                                </Text>
                                <View className="flex-row items-baseline gap-2">
                                    <Text className={`${isCompact ? 'text-5xl' : 'text-6xl'} font-display font-bold text-primary`}>
                                        {winner.score}
                                    </Text>
                                    <Text className="text-xl font-bold text-primary/60 font-sans">{t('points')}</Text>
                                </View>
                            </CardContent>
                        </Card>
                    )}

                    {view === 'rankings' && (
                        <View className={isCompact ? 'space-y-3' : 'space-y-4'}>
                            {visiblePlayers.map((player, offset) => {
                                const index = rankStart + offset;
                                const isWinner = index === 0;
                                return (
                                    <View
                                        key={player.id}
                                        style={[{ opacity: revealedRanks.includes(index) ? 1 : 0 }]}
                                    >
                                        <Card className={`rounded-lg border-2 ${isWinner
                                            ? 'bg-accent/10 border-accent/30'
                                            : 'bg-white border-foreground/20'
                                            }`}>
                                            <CardContent className={`${isCompact ? 'p-3' : 'p-4'} flex-row items-center gap-4`}>
                                                <Text className={`${isCompact ? 'text-3xl w-12' : 'text-4xl w-14'} text-center font-display`}>
                                                    {getRankEmoji(index)}
                                                </Text>
                                                <PlayerAvatar
                                                    name={player.name}
                                                    size={isCompact ? 'sm' : 'md'}
                                                    isHost={player.isHost}
                                                    showName={false}
                                                />
                                                <View className="flex-1">
                                                    <Text className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold ${isWinner ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {player.name}
                                                    </Text>
                                                    {player.isHost && (
                                                        <Text className="text-xs font-semibold text-primary/70 uppercase tracking-wide font-sans">({t('host')})</Text>
                                                    )}
                                                </View>
                                                <View className="items-end bg-white/50 px-3 py-1.5 rounded-lg border-2 border-foreground/10">
                                                    <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold ${isWinner ? 'text-accent' : 'text-primary'}`}>
                                                        {player.score}
                                                    </Text>
                                                    {!isCompact && (
                                                        <Text className="text-xs font-bold text-muted-foreground font-sans">{t('points')}</Text>
                                                    )}
                                                </View>
                                            </CardContent>
                                        </Card>
                                    </View>
                                );
                            })}

                            {totalRankPages > 1 && (
                                <View className="flex-row items-center justify-center gap-6 mt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onPress={() => setRankPage((p) => Math.max(0, p - 1))}
                                        disabled={clampedRankPage === 0}
                                        className="rounded-lg border-2 border-foreground/20 text-foreground"
                                    >
                                        <Ionicons name="arrow-back" size={20} color="#2B1F17" />
                                    </Button>
                                    <Text className="text-sm font-bold text-muted-foreground font-sans">
                                        {t('page')} {clampedRankPage + 1} / {totalRankPages}
                                    </Text>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onPress={() => setRankPage((p) => Math.min(totalRankPages - 1, p + 1))}
                                        disabled={clampedRankPage >= totalRankPages - 1}
                                        className="rounded-lg border-2 border-foreground/20 text-foreground"
                                    >
                                        <Ionicons name="arrow-forward" size={20} color="#2B1F17" />
                                    </Button>
                                </View>
                            )}
                        </View>
                    )}

                    {view === 'highlights' && (
                        <Card className="border-2 border-foreground bg-white rounded-lg h-full transform -rotate-1">
                            <CardContent className={isCompact ? 'p-6' : 'p-8'}>
                                <View className="flex-row items-center gap-3 mb-6 border-b-2 border-foreground/10 pb-4">
                                    <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center border border-primary/20">
                                        <Text className="text-xl">✨</Text>
                                    </View>
                                    <Text className="font-display font-bold text-2xl text-foreground">
                                        {t('gameHighlights')}
                                    </Text>
                                </View>
                                {isLoadingHighlights ? (
                                    <View className="flex-row items-center gap-3 py-8 justify-center">
                                        <ActivityIndicator size="small" color="#C17F59" />
                                        <Text className="text-muted-foreground font-medium text-lg font-sans">
                                            {t('generatingHighlights')}
                                        </Text>
                                    </View>
                                ) : highlights ? (
                                    <Text className="text-foreground/80 leading-relaxed text-lg font-medium font-sans">
                                        {highlights}
                                    </Text>
                                ) : (
                                    <View className="items-center py-10 opacity-60">
                                        <Ionicons name="flash-off" size={48} color="#999" />
                                        <Text className="text-muted-foreground text-center mt-4 italic font-medium font-sans">
                                            {t('highlightsError')}
                                        </Text>
                                    </View>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </View>

                {/* Actions */}
                <View className={`flex-row gap-4 ${isCompact ? 'pt-4' : 'pt-8'}`}>
                    <Button
                        variant="hero"
                        onPress={handlePlayAgain}
                        className="flex-1 shadow-none"
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="refresh" size={24} color="#FFF8EF" />
                            <Text className="font-display font-bold text-primary-foreground text-lg">
                                {t('playAgain')}
                            </Text>
                        </View>
                    </Button>

                    <Button
                        variant="secondary"
                        onPress={() => router.replace('/')}
                        className="flex-1 shadow-none border-2 border-foreground"
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="home" size={24} color="#2B1F17" />
                            <Text className="font-display font-bold text-foreground text-lg">
                                {t('home')}
                            </Text>
                        </View>
                    </Button>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    winnerCard: {
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    confetti: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        top: -20,
    },
});
