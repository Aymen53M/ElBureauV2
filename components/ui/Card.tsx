import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    style?: any;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style }) => {
    return (
        <View
            className={twMerge("rounded-lg bg-card border-2 border-foreground animate-slide-in", className)}
            style={[styles.card, style]}
        >
            {children}
        </View>
    );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <View className={twMerge("p-6 pb-3", className)}>
            {children}
        </View>
    );
};

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <View className={twMerge("p-6 pt-0", className)}>
            {children}
        </View>
    );
};

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => {
    return (
        <Text className={twMerge("text-2xl font-display font-semibold text-foreground", className)}>
            {children}
        </Text>
    );
};

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => {
    return (
        <Text className={twMerge("text-sm text-muted-foreground mt-1 font-sans", className)}>
            {children}
        </Text>
    );
};

export const CardFooter: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <View className={twMerge("flex-row items-center p-6 pt-0", className)}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        shadowColor: '#2B1F17',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1, // Hard shadow
        shadowRadius: 0,
        elevation: 6,
    },
});

export default Card;
