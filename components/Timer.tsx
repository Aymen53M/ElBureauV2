import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface TimerProps {
    seconds: number;
    onComplete?: () => void;
    isPaused?: boolean;
    size?: 'sm' | 'md' | 'lg';
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
    }, [seconds]);

    const isWarning = seconds <= 10 && seconds > 5;
    const isCritical = seconds <= 5;
    const progress = (seconds / initialSeconds) * 100;

    const sizeConfig = {
        sm: { container: 64, stroke: 6, text: 'text-xl', radius: 27 },
        md: { container: 96, stroke: 8, text: 'text-3xl', radius: 40 },
        lg: { container: 128, stroke: 10, text: 'text-4xl', radius: 54 },
    };

    const config = sizeConfig[size];
    const circumference = 2 * Math.PI * config.radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const getColor = () => {
        if (isCritical) return '#EB3B3B';
        if (isWarning) return '#FFCC00';
        return '#00D4AA';
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
                    stroke="#212D3D"
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
                className={`font-display font-bold ${config.text}`}
                style={[
                    { color: getColor() },
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
        textShadowColor: '#EB3B3B',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
});

export default Timer;
