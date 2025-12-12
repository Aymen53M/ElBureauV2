import React from 'react';
import { TextInput, View, TextInputProps, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface InputProps extends TextInputProps {
    className?: string;
    containerClassName?: string;
}

const Input: React.FC<InputProps> = ({
    className = '',
    containerClassName = '',
    ...props
}) => {
    return (
        <View className={twMerge("w-full", containerClassName)}>
            <TextInput
                className={twMerge(
                    "h-12 w-full rounded-xl border border-border bg-input px-4 text-base text-foreground",
                    className
                )}
                placeholderTextColor="#8FA3B8"
                style={styles.input}
                {...props}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    input: {
        fontFamily: 'Rubik',
    },
});

export default Input;
