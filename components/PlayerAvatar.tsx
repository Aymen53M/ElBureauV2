import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface PlayerAvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isHost?: boolean;
    isReady?: boolean;
    showName?: boolean;
    className?: string;
}

const avatarColors = [
    '#C17F59', // Terracotta
    '#D4AF37', // Gold
    '#8C7B70', // Warm Grey
    '#4A7A68', // Sage
    '#E3C8A8', // Sand
    '#A0522D', // Sienna
    '#4A3B32', // Deep Brown
    '#B3261E'  // Deep Red
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
            case 'xl': return { container: 'w-28 h-28', text: 'text-4xl', badge: 'text-xl' };
        }
    };

    const sizes = getSizeClasses();

    return (
        <View className={twMerge("items-center", className)}>
            <View className="relative">
                <View
                    className={`rounded-full items-center justify-center ${sizes.container} border-2 ${isReady ? 'border-success' : 'border-foreground'} ${isReady ? 'bg-success/20' : ''}`}
                    style={[
                        { backgroundColor },
                    ]}
                >
                    <Text className={`font-display font-bold text-white ${sizes.text}`}>
                        {getInitials()}
                    </Text>
                </View>

                {/* Host badge */}
                {isHost && (
                    <View className="absolute -top-1 -right-1 bg-accent rounded-full w-6 h-6 items-center justify-center border border-white">
                        <Text className="text-xs">👑</Text>
                    </View>
                )}

                {/* Ready indicator */}
                {isReady && (
                    <View className="absolute -bottom-1 -right-1 bg-success rounded-full w-5 h-5 items-center justify-center border-2 border-background">
                        <Text className="text-xs text-white">✓</Text>
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

// styles removed
const styles = StyleSheet.create({});

export default PlayerAvatar;
