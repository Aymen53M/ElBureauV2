import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    animated?: boolean;
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'lg', animated = true, className }) => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (animated) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(animatedValue, {
                        toValue: -10,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(animatedValue, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [animated]);

    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return { text: 'text-2xl', sparkle1: 'text-sm', sparkle2: 'text-xs' };
            case 'md': return { text: 'text-4xl', sparkle1: 'text-base', sparkle2: 'text-sm' };
            case 'lg': return { text: 'text-5xl', sparkle1: 'text-lg', sparkle2: 'text-base' };
            case 'xl': return { text: 'text-6xl', sparkle1: 'text-xl', sparkle2: 'text-lg' };
        }
    };

    const sizes = getSizeClasses();

    return (
        <View className={twMerge("relative", className)}>
            {/* Glow effect behind */}
            <View className="absolute inset-0" style={styles.glow}>
                <Text className={`font-display font-bold text-primary ${sizes.text}`} style={styles.glowText}>
                    ElBureau
                </Text>
            </View>

            {/* Main logo */}
            <Animated.View
                style={animated ? { transform: [{ translateY: animatedValue }] } : undefined}
            >
                <View className="flex-row items-center">
                    <Text className={`font-display font-bold text-primary ${sizes.text}`}>
                        El
                    </Text>
                    <Text className={`font-display font-bold text-foreground ${sizes.text}`}>
                        Bureau
                    </Text>
                </View>

                {/* Sparkle decorations */}
                <Text className={`absolute -top-2 -right-4 text-accent ${sizes.sparkle1}`}>✦</Text>
                <Text className={`absolute -bottom-1 -left-3 text-secondary ${sizes.sparkle2}`}>✦</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    glow: {
        opacity: 0.4,
    },
    glowText: {
        textShadowColor: '#00D4AA',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
});

export default Logo;
