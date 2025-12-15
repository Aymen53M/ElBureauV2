import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from '@/components/ui/LinearGradient';
import { twMerge } from 'tailwind-merge';
import { audioService } from '@/services/audioService';
import { useGame } from '@/contexts/GameContext';


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
    const { soundEnabled } = useGame();

    const handlePress = (e: any) => {
        if (!disabled && soundEnabled) {
            audioService.setEnabled(soundEnabled);
            audioService.play('click');
        }
        onPress?.();
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return 'h-10 px-4 rounded-none';
            case 'lg': return 'h-14 px-8 rounded-none';
            case 'xl': return 'h-16 px-10 rounded-none';
            case 'icon': return 'h-12 w-12 rounded-none';
            case 'bet': return 'h-14 w-14 rounded-none';
            default: return 'h-12 px-6 rounded-none';
        }
    };

    const getVariantClasses = () => {
        switch (variant) {
            case 'default': return 'bg-primary border-2 border-foreground text-primary-foreground';
            case 'secondary': return 'bg-secondary border-2 border-foreground text-secondary-foreground';
            case 'outline': return 'bg-transparent border-2 border-foreground text-foreground';
            case 'ghost': return 'bg-transparent border-0';
            case 'accent': return 'bg-accent border-2 border-foreground text-accent-foreground';
            case 'destructive': return 'bg-destructive border-2 border-foreground text-destructive-foreground';
            case 'game': return 'bg-card border-2 border-foreground text-card-foreground';
            case 'bet': return 'bg-muted border-2 border-foreground text-muted-foreground';
            case 'betActive': return 'bg-accent border-2 border-foreground text-accent-foreground';
            case 'betUsed': return 'bg-muted/50 border-2 border-foreground/50 text-muted-foreground';
            case 'hero': return 'bg-[#C17F59] border-2 border-foreground text-white';
            default: return 'bg-primary border-2 border-foreground text-primary-foreground';
        }
    };

    const baseClasses = `items-center justify-center font-display ${getSizeClasses()} ${getVariantClasses()} rounded-lg`;

    // Custom style for the sketchy border radius since Tailwind class might be too long/complex to repeat
    // Actually we defined rounded-lg in tailwind config, so 'rounded-lg' should work!

    const mergedClasses = twMerge(baseClasses, className);

    // Hero variant no longer needs LinearGradient, just standard button with hero styling
    if (variant === 'hero') {
        return (
            <TouchableOpacity
                onPress={handlePress}
                disabled={disabled}
                activeOpacity={0.8}
                className={twMerge(mergedClasses, "active:scale-95 transition-transform duration-100")}
                style={[styles.sketchyShadow, disabled && styles.disabled]}
            >
                {children}
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.7}
            className={twMerge(mergedClasses, "active:scale-95 transition-transform duration-100")}
            style={[
                variant !== 'ghost' && styles.sketchyShadow,
                disabled && styles.disabled,
            ]}
        >
            {children}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    sketchyShadow: {
        shadowColor: '#2B1F17',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 0, // Elevation doesn't support hard shadows well on Android without tricks, but web is priority
        // For web, box-shadow is handled by tailwind/CSS usually, but RN styles need this.
        // We can inject a web-specific style or class if needed, but shadow* props map to box-shadow on web.
    },
    disabled: {
        opacity: 0.5,
        shadowOffset: { width: 1, height: 1 },
        transform: [{ translateY: 2 }, { translateX: 2 }], // "Pressed" look
    },
});

export default Button;
