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
            className={twMerge("rounded-2xl bg-card border border-border", className)}
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
        <Text className={twMerge("text-sm text-muted-foreground mt-1", className)}>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
});

export default Card;
