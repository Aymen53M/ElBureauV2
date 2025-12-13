import React from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Pressable, Alert } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { usePathname, useRouter } from 'expo-router';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    animated?: boolean;
    className?: string;
    goHomeOnPress?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'lg', animated = true, className }) => {
    const router = useRouter();
    const pathname = usePathname();
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
    }, [animated, animatedValue]);

    const sizePx = (() => {
        switch (size) {
            case 'sm':
                return { w: 110, h: 44 };
            case 'md':
                return { w: 160, h: 64 };
            case 'lg':
                return { w: 220, h: 88 };
            case 'xl':
                return { w: 280, h: 112 };
        }
    })();

    const enableHomeNav = (size === 'sm' && !animated);

    const handlePress = () => {
        if (!enableHomeNav) return;
        if (pathname === '/') return;
        Alert.alert('Go Home?', 'Do you want to leave this screen and go to Home?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go Home', onPress: () => router.replace('/') },
        ]);
    };

    const logoSource = require('../assets/Flowting Logo.png');

    return (
        <Pressable
            onPress={handlePress}
            className={twMerge('relative', className)}
            accessibilityRole={enableHomeNav ? 'button' : undefined}
        >
            {/* Glow effect behind */}
            <View className="absolute inset-0" style={styles.glow}>
                <Image
                    source={logoSource}
                    style={[{ width: sizePx.w, height: sizePx.h, opacity: 0.55 }, styles.glowImage]}
                    resizeMode="contain"
                />
            </View>

            {/* Main logo */}
            <Animated.View style={animated ? { transform: [{ translateY: animatedValue }] } : undefined}>
                <Image
                    source={logoSource}
                    style={{ width: sizePx.w, height: sizePx.h }}
                    resizeMode="contain"
                />

                {/* Sparkle decorations */}
                <Text style={styles.hiddenSparkle}> </Text>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    glow: {
        opacity: 0.4,
    },
    glowImage: {
        shadowColor: '#C97B4C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
    },
    hiddenSparkle: {
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0,
    },
});

export default Logo;
