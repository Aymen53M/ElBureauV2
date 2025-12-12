import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface PlayerAvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg';
    isHost?: boolean;
    isReady?: boolean;
    showName?: boolean;
    className?: string;
}

const avatarColors = [
    '#00D4AA', '#F06543', '#FFCC00', '#FF66AA',
    '#8B5CF6', '#00FFFF', '#00FF88', '#FF8C42'
];

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
    name,
    size = 'md',
    isHost = false,
    isReady = false,
    showName = true,
    className = '',
}) => {
    // Generate consistent color based on name
    const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;
    const backgroundColor = avatarColors[colorIndex];

    const getInitials = () => {
        return name.slice(0, 2).toUpperCase();
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return { container: 'w-10 h-10', text: 'text-sm', badge: 'text-xs' };
            case 'md': return { container: 'w-14 h-14', text: 'text-lg', badge: 'text-sm' };
            case 'lg': return { container: 'w-20 h-20', text: 'text-2xl', badge: 'text-base' };
        }
    };

    const sizes = getSizeClasses();

    return (
        <View className={twMerge("items-center", className)}>
            <View className="relative">
                {/* Avatar circle */}
                <View
                    className={`rounded-full items-center justify-center ${sizes.container}`}
                    style={[
                        { backgroundColor },
                        isReady && styles.readyShadow,
                    ]}
                >
                    <Text className={`font-display font-bold text-background ${sizes.text}`}>
                        {getInitials()}
                    </Text>
                </View>

                {/* Host badge */}
                {isHost && (
                    <View className="absolute -top-1 -right-1 bg-accent rounded-full w-6 h-6 items-center justify-center">
                        <Text className="text-xs">👑</Text>
                    </View>
                )}

                {/* Ready indicator */}
                {isReady && (
                    <View className="absolute -bottom-1 -right-1 bg-neon-green rounded-full w-5 h-5 items-center justify-center border-2 border-background">
                        <Text className="text-xs">✓</Text>
                    </View>
                )}
            </View>

            {/* Name */}
            {showName && (
                <Text className={`mt-2 font-display font-semibold text-foreground ${sizes.badge}`}>
                    {name}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    readyShadow: {
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
});

export default PlayerAvatar;
