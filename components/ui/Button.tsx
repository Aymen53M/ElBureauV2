import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { twMerge } from 'tailwind-merge';

interface ButtonProps {
    variant?: 'default' | 'hero' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'game' | 'bet' | 'betActive' | 'betUsed' | 'destructive';
    size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon' | 'bet';
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    className?: string;
}

const Button: React.FC<ButtonProps> = ({
    variant = 'default',
    size = 'default',
    children,
    onPress,
    disabled = false,
    className = '',
}) => {
    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return 'h-10 px-4 rounded-lg';
            case 'lg': return 'h-14 px-8 rounded-2xl';
            case 'xl': return 'h-16 px-10 rounded-2xl';
            case 'icon': return 'h-12 w-12 rounded-xl';
            case 'bet': return 'h-14 w-14 rounded-xl';
            default: return 'h-12 px-6 rounded-xl';
        }
    };

    const getVariantClasses = () => {
        switch (variant) {
            case 'default': return 'bg-primary';
            case 'secondary': return 'bg-secondary';
            case 'outline': return 'bg-transparent border-2 border-primary';
            case 'ghost': return 'bg-transparent';
            case 'accent': return 'bg-accent';
            case 'destructive': return 'bg-destructive';
            case 'game': return 'bg-card border-2 border-primary/30';
            case 'bet': return 'bg-muted border-2 border-border';
            case 'betActive': return 'bg-accent border-2 border-accent';
            case 'betUsed': return 'bg-muted/50 border-2 border-border/50';
            case 'hero': return ''; // Uses gradient
            default: return 'bg-primary';
        }
    };

    const baseClasses = `items-center justify-center ${getSizeClasses()} ${getVariantClasses()}`;
    const mergedClasses = twMerge(baseClasses, className);

    if (variant === 'hero') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled}
                activeOpacity={0.8}
                style={[disabled && styles.disabled]}
            >
                <LinearGradient
                    colors={['#6B3F23', '#C97B4C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className={twMerge(`h-16 px-10 rounded-2xl items-center justify-center`, className)}
                    style={styles.heroShadow}
                >
                    {children}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            className={mergedClasses}
            style={[
                variant === 'default' && styles.primaryShadow,
                variant === 'secondary' && styles.secondaryShadow,
                variant === 'accent' && styles.accentShadow,
                variant === 'betActive' && styles.accentShadow,
                disabled && styles.disabled,
            ]}
        >
            {children}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    heroShadow: {
        shadowColor: '#C97B4C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    primaryShadow: {
        shadowColor: '#6B3F23',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 8,
    },
    secondaryShadow: {
        shadowColor: '#C83A32',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 8,
    },
    accentShadow: {
        shadowColor: '#D4A72C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 8,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Button;
