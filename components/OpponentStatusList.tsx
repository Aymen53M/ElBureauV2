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
}

export const OpponentStatusList: React.FC<OpponentStatusListProps> = ({
    players,
    currentPlayerId,
    showBets = false,
    showScores = true,
    compact = false,
}) => {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-2 py-2"
        >
            {sortedPlayers.map((player) => {
                const isMe = player.id === currentPlayerId;
                const bet = player.currentBet;

                return (
                    <View
                        key={player.id}
                        className={twMerge(
                            "rounded-lg border-2 p-3 min-w-[100px] items-center bg-white shadow-sm",
                            isMe ? "border-primary bg-primary/5" : "border-foreground/20"
                        )}
                    >
                        <Text className="font-display font-bold text-foreground mb-1" numberOfLines={1}>
                            {player.name} {isMe && "(You)"}
                        </Text>

                        <View className="flex-row items-center gap-3">
                            {showScores && (
                                <View className="items-center">
                                    <Text className="text-xs text-muted-foreground uppercase font-bold">Score</Text>
                                    <Text className="text-lg font-display text-primary">{player.score}</Text>
                                </View>
                            )}

                            {showBets && typeof bet !== 'undefined' && bet !== null && (
                                <View className="items-center border-l border-foreground/10 pl-3">
                                    <Text className="text-xs text-muted-foreground uppercase font-bold">Bet</Text>
                                    <Text className="text-lg font-display text-accent">{bet}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
};
