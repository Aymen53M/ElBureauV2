import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface TimerProps {
    seconds: number;
    onComplete?: () => void;
    isPaused?: boolean;
    size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
}

const Timer: React.FC<TimerProps> = ({
    seconds: initialSeconds,
    onComplete,
    isPaused = false,
    size = 'md',
}) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const shakeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onComplete?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused, onComplete, initialSeconds]);

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
    const progress = (seconds / initialSeconds) * 100;

    const sizeConfig = {
        xxs: { container: 34, stroke: 4, radius: 14, fontSize: 12, lineHeight: 12 },
        xs: { container: 44, stroke: 5, radius: 18, fontSize: 16, lineHeight: 16 },
        sm: { container: 64, stroke: 6, radius: 27, fontSize: 22, lineHeight: 22 },
        md: { container: 96, stroke: 8, radius: 40, fontSize: 32, lineHeight: 32 },
        lg: { container: 128, stroke: 10, radius: 54, fontSize: 40, lineHeight: 40 },
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
                style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
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
            <Text
                className="font-display font-bold"
                style={[
                    { color: getColor() },
                    {
                        width: config.container,
                        textAlign: 'center',
                        textAlignVertical: 'center',
                        includeFontPadding: false,
                        fontSize: config.fontSize,
                        lineHeight: config.lineHeight,
                    },
                    isCritical && styles.glowText,
                ]}
            >
                {seconds}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    glowText: {
        textShadowColor: '#B3261E',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
});

export default Timer;
