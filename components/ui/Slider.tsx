import React from 'react';
import { View } from 'react-native';

type SliderProps = {
    value: number;
    onValueChange: (value: number) => void;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
};

export default function Slider({
    value,
    onValueChange,
    minimumValue = 0,
    maximumValue = 1,
    step,
}: SliderProps) {
    return (
        <View style={{ width: '100%' } as any}>
            <input
                type="range"
                value={String(value)}
                min={String(minimumValue)}
                max={String(maximumValue)}
                step={typeof step === 'number' ? String(step) : undefined}
                onChange={(e) => {
                    const next = Number((e.target as HTMLInputElement).value);
                    onValueChange(next);
                }}
                className="w-full h-4 bg-muted/20 rounded-lg appearance-none cursor-pointer border-2 border-foreground/20 accent-primary"
            />
        </View>
    );
}
