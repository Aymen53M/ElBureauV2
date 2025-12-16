import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Player } from '@/contexts/GameContext';
import { twMerge } from 'tailwind-merge';

interface OpponentStatusListProps {
    players: Player[];
    currentPlayerId: string;
    showBets?: boolean;
    showScores?: boolean;
    compact?: boolean;
    orientation?: 'horizontal' | 'vertical';
}

export const OpponentStatusList: React.FC<OpponentStatusListProps> = ({
    players,
    currentPlayerId,
    showBets = false,
    showScores = true,
    compact = false,
    orientation = 'horizontal',
}) => {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const isVertical = orientation === 'vertical';

    return (
        <ScrollView
            horizontal={!isVertical}
            showsHorizontalScrollIndicator={!isVertical ? false : undefined}
            showsVerticalScrollIndicator={isVertical ? false : undefined}
            contentContainerClassName={twMerge(
                compact ? 'gap-2 px-1 py-1' : 'gap-3 px-2 py-2',
                isVertical ? 'flex-col' : 'flex-row'
            )}
        >
            {sortedPlayers.map((player) => {
                const isMe = player.id === currentPlayerId;
                const bet = player.currentBet;

                return (
                    <View
                        key={player.id}
                        className={twMerge(
                            compact
                                ? `rounded-lg border-2 p-2 ${isVertical ? 'w-full' : 'min-w-[86px]'} items-center bg-white shadow-sm`
                                : `rounded-lg border-2 p-3 ${isVertical ? 'w-full' : 'min-w-[100px]'} items-center bg-white shadow-sm`,
                            isMe ? "border-primary bg-primary/5" : "border-foreground/20"
                        )}
                    >
                        <Text className={twMerge('font-display font-bold text-foreground', compact ? 'mb-0.5 text-sm' : 'mb-1')} numberOfLines={1}>
                            {player.name} {isMe && "(You)"}
                        </Text>

                        <View className={twMerge('flex-row items-center', compact ? 'gap-2' : 'gap-3')}>
                            {showScores && (
                                <View className="items-center">
                                    <Text className={twMerge('text-muted-foreground uppercase font-bold', compact ? 'text-[10px]' : 'text-xs')}>Score</Text>
                                    <Text className={twMerge('font-display text-primary', compact ? 'text-base' : 'text-lg')}>{player.score}</Text>
                                </View>
                            )}

                            {showBets && typeof bet !== 'undefined' && bet !== null && (
                                <View className={twMerge('items-center border-l border-foreground/10', compact ? 'pl-2' : 'pl-3')}>
                                    <Text className={twMerge('text-muted-foreground uppercase font-bold', compact ? 'text-[10px]' : 'text-xs')}>Bet</Text>
                                    <Text className={twMerge('font-display text-accent', compact ? 'text-base' : 'text-lg')}>{bet}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
};
