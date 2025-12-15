import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Animated, View, Platform } from 'react-native';
import Svg, { Circle } from '@/components/ui/Svg';

interface TimerProps {
    seconds: number;
    onComplete?: () => void;
    isPaused?: boolean;
    endsAt?: number;
    size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
}

const Timer: React.FC<TimerProps> = ({
    seconds: initialSeconds,
    onComplete,
    isPaused = false,
    endsAt,
    size = 'md',
}) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const shakeAnim = React.useRef(new Animated.Value(0)).current;
    const completedRef = React.useRef(false);
    const rafRef = React.useRef<number | null>(null);

    const endsAtRef = React.useRef<number | undefined>(endsAt);
    const initialSecondsRef = React.useRef<number>(initialSeconds);
    const onCompleteRef = React.useRef<typeof onComplete>(onComplete);

    useEffect(() => {
        endsAtRef.current = endsAt;
    }, [endsAt]);

    useEffect(() => {
        initialSecondsRef.current = initialSeconds;
    }, [initialSeconds]);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    const computeSecondsLeft = React.useCallback((nowMs?: number) => {
        const nextEndsAt = endsAtRef.current;
        const nextInitial = initialSecondsRef.current;
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        if (typeof nextEndsAt === 'number' && Number.isFinite(nextEndsAt)) {
            const diffMs = nextEndsAt - now;
            return Math.max(0, Math.min(nextInitial, Math.ceil(diffMs / 1000)));
        }
        return Math.max(0, nextInitial);
    }, []);

    useEffect(() => {
        completedRef.current = false;
        setSeconds(computeSecondsLeft());
    }, [computeSecondsLeft, endsAt, initialSeconds]);

    useEffect(() => {
        if (isPaused) return;

        const nextEndsAt = endsAtRef.current;
        const canUseRaf =
            Platform.OS === 'web' &&
            typeof nextEndsAt === 'number' &&
            Number.isFinite(nextEndsAt) &&
            typeof requestAnimationFrame === 'function' &&
            typeof cancelAnimationFrame === 'function';

        if (canUseRaf) {
            let lastValue = -1;
            const tick = () => {
                const next = computeSecondsLeft();
                if (next !== lastValue) {
                    lastValue = next;
                    setSeconds(next);
                    if (next <= 0 && !completedRef.current) {
                        completedRef.current = true;
                        onCompleteRef.current?.();
                    }
                }
                rafRef.current = requestAnimationFrame(tick);
            };

            tick();

            return () => {
                if (rafRef.current != null) {
                    cancelAnimationFrame(rafRef.current);
                }
                rafRef.current = null;
            };
        }

        const interval = setInterval(() => {
            setSeconds((prev) => {
                const next = typeof nextEndsAt === 'number' && Number.isFinite(nextEndsAt)
                    ? computeSecondsLeft()
                    : Math.max(0, prev - 1);

                if (next <= 0 && !completedRef.current) {
                    completedRef.current = true;
                    onCompleteRef.current?.();
                }

                return next;
            });
        }, 500);

        return () => clearInterval(interval);
    }, [isPaused]);

    // Shake animation when critical
    useEffect(() => {
        if (seconds <= 5 && seconds > 0) {
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start();
        }
    }, [seconds, shakeAnim]);

    const isWarning = seconds <= 10 && seconds > 5;
    const isCritical = seconds <= 5;
    const safeInitial = initialSeconds > 0 ? initialSeconds : 1;
    const progress = (seconds / safeInitial) * 100;

    const sizeConfig = {
        xxs: { container: 34, stroke: 4, radius: 14, fontSize: 14, lineHeight: 16 },
        xs: { container: 44, stroke: 5, radius: 18, fontSize: 18, lineHeight: 20 },
        sm: { container: 64, stroke: 6, radius: 27, fontSize: 28, lineHeight: 30 },
        md: { container: 96, stroke: 8, radius: 40, fontSize: 42, lineHeight: 44 },
        lg: { container: 128, stroke: 10, radius: 54, fontSize: 56, lineHeight: 58 },
    };

    const config = sizeConfig[size];
    const circumference = 2 * Math.PI * config.radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const getColor = () => {
        if (isCritical) return '#B3261E';
        if (isWarning) return '#D4A72C';
        return '#C97B4C';
    };

    return (
        <Animated.View
            style={[
                { width: config.container, height: config.container },
                { transform: [{ translateX: shakeAnim }] }
            ]}
            className="items-center justify-center"
        >
            <Svg
                width={config.container}
                height={config.container}
                style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
            >
                {/* Background circle */}
                <Circle
                    cx={config.container / 2}
                    cy={config.container / 2}
                    r={config.radius}
                    stroke="#E2CFBC"
                    strokeWidth={config.stroke}
                    fill="transparent"
                />
                {/* Progress circle */}
                <Circle
                    cx={config.container / 2}
                    cy={config.container / 2}
                    r={config.radius}
                    stroke={getColor()}
                    strokeWidth={config.stroke}
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                />
            </Svg>

            {/* Time display */}
            <View
                pointerEvents="none"
                style={[
                    styles.timeTextContainer,
                    { width: config.container, height: config.container },
                ]}
            >
                <Text
                    className="font-display font-bold"
                    style={[
                        { color: getColor() },
                        {
                            textAlign: 'center',
                            includeFontPadding: false,
                            fontSize: config.fontSize,
                            lineHeight: config.lineHeight,
                            ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : null),
                        },
                        isCritical && styles.glowText,
                    ]}
                >
                    {seconds}
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    timeTextContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowText: {
        textShadowColor: '#B3261E',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
});

export default Timer;
