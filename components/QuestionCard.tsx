import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Card, CardContent } from '@/components/ui/Card';
import { Question } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getShadowStyle } from '@/lib/styles';

interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    totalQuestions: number;
    selectedAnswer: string | null;
    onSelectAnswer: (answer: string) => void;
    isAnswerPhase: boolean;
    headerAccessory?: React.ReactNode;
    density?: 'default' | 'compact';
    showCorrectAnswer?: boolean;
    hintsEnabled?: boolean;
    disabled?: boolean;
    disabledMessage?: string;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    questionNumber,
    totalQuestions,
    selectedAnswer,
    onSelectAnswer,
    isAnswerPhase,
    headerAccessory,
    density = 'default',
    showCorrectAnswer = false,
    hintsEnabled = false,
    disabled = false,
    disabledMessage,
}) => {
    const { t } = useLanguage();
    const [showHint, setShowHint] = React.useState(false);

    const isCompact = density === 'compact';

    React.useEffect(() => {
        setShowHint(false);
    }, [question.id]);

    const getDifficultyColor = () => {
        switch (question.difficulty) {
            case 'easy': return 'bg-success/20 text-success';
            case 'medium': return 'bg-accent/20 text-accent';
            case 'hard': return 'bg-destructive/20 text-destructive';
            default: return 'bg-primary/20 text-primary';
        }
    };

    const hasHint = hintsEnabled && question.hint && question.hint.trim().length > 0;

    return (
        <Card className="rounded-lg border-2 border-foreground bg-white" style={styles.cardShadow}>
            <CardContent className={`${isCompact ? 'p-5 space-y-5' : 'p-7 space-y-7'}`}>
                {/* Question header */}
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold text-muted-foreground font-sans">
                            {t('question')} {questionNumber}/{totalQuestions}
                        </Text>
                        {headerAccessory}
                    </View>
                    <View className={`px-3 py-1 rounded-full border-2 border-foreground/10 ${getDifficultyColor()}`}>
                        <Text className="text-xs font-semibold font-sans">
                            {t(question.difficulty)}
                        </Text>
                    </View>
                </View>

                {/* Question text */}
                <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-medium text-center text-foreground leading-tight`}>
                    {question.text}
                </Text>

                {/* Hint section */}
                {hasHint && isAnswerPhase && !showCorrectAnswer && (
                    <View className="items-center">
                        {!showHint ? (
                            <TouchableOpacity
                                onPress={() => setShowHint(true)}
                                className="px-4 py-2 rounded-lg bg-accent/10 border-2 border-accent/20"
                            >
                                <Text className="text-accent font-semibold text-sm font-sans">
                                    💡 {t('showHint')}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="p-3 rounded-lg bg-accent/5 border-2 border-accent/20 w-full transform -rotate-1">
                                <Text className="text-xs text-accent font-semibold mb-1 font-sans">{t('hint')}:</Text>
                                <Text className="text-foreground text-center font-display">{question.hint}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Answer options */}
                {isAnswerPhase && (
                    <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                        {disabled && !!disabledMessage && (
                            <View className="items-center">
                                <Text className="text-muted-foreground text-sm italic text-center font-sans">
                                    {disabledMessage}
                                </Text>
                            </View>
                        )}
                        {question.type === 'multiple-choice' && question.options && (
                            <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                                {question.options.map((option, index) => {
                                    const isSelected = selectedAnswer === option;
                                    const isCorrect = showCorrectAnswer && option === question.correctAnswer;
                                    const isWrong = showCorrectAnswer && isSelected && option !== question.correctAnswer;

                                    const isDisabled = showCorrectAnswer || disabled;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => !isDisabled && onSelectAnswer(option)}
                                            disabled={isDisabled}
                                            className={`flex-row items-center ${isCompact ? 'p-3 rounded-lg' : 'p-4 rounded-lg'} border-2 ${isCorrect
                                                ? 'border-success bg-success/20'
                                                : isWrong
                                                    ? 'border-destructive bg-destructive/20'
                                                    : isSelected && !showCorrectAnswer
                                                        ? 'border-foreground bg-primary/20' // Selected but not confirmed correct/wrong yet
                                                        : 'border-foreground/20 bg-transparent'
                                                }`}
                                        >
                                            <View className={`${isCompact ? 'w-7 h-7 rounded-full' : 'w-8 h-8 rounded-full'} bg-white items-center justify-center mr-3 border-2 border-foreground/20`}>
                                                <Text className="font-bold text-foreground font-display">
                                                    {String.fromCharCode(65 + index)}
                                                </Text>
                                            </View>
                                            <Text className={`flex-1 font-display ${isCompact ? 'text-sm' : 'text-base'} ${isCorrect ? 'text-success font-bold' : isWrong ? 'text-destructive font-bold' : 'text-foreground'
                                                }`}>
                                                {option}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {question.type === 'true-false' && (
                            <View className="flex-row justify-center gap-4">
                                {(['True', 'False'] as const).map((option) => {
                                    const isSelected = selectedAnswer === option;
                                    const isCorrect = showCorrectAnswer && option === question.correctAnswer;
                                    const isWrong = showCorrectAnswer && isSelected && option !== question.correctAnswer;

                                    const label = option === 'True' ? t('trueOption') : t('falseOption');

                                    const isDisabled = showCorrectAnswer || disabled;

                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            onPress={() => !isDisabled && onSelectAnswer(option)}
                                            disabled={isDisabled}
                                            className={`${isCompact ? 'w-28 py-3 rounded-lg' : 'w-32 py-4 rounded-lg'} items-center border-2 ${isCorrect
                                                ? 'border-success bg-success/20'
                                                : isWrong
                                                    ? 'border-destructive bg-destructive/20'
                                                    : isSelected && !showCorrectAnswer
                                                        ? 'border-foreground bg-primary/20'
                                                        : 'border-foreground/20 bg-transparent'
                                                }`}
                                        >
                                            <Text className={`font-display font-bold ${isCompact ? 'text-base' : 'text-lg'} ${isCorrect ? 'text-success' : isWrong ? 'text-destructive' : 'text-foreground'
                                                }`}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {question.type === 'open-ended' && !showCorrectAnswer && (
                            <View className="flex-row gap-3">
                                <TextInput
                                    value={selectedAnswer ?? ''}
                                    onChangeText={(text) => {
                                        if (disabled || showCorrectAnswer) return;
                                        onSelectAnswer(text);
                                    }}
                                    editable={!disabled}
                                    placeholder={t('answer') + '...'}
                                    placeholderTextColor="#8C7B70"
                                    className={`flex-1 ${isCompact ? 'h-11 text-sm' : 'h-12'} px-4 rounded-lg border-2 border-foreground bg-white text-foreground font-display`}
                                />
                            </View>
                        )}
                    </View>
                )}

                {/* Correct answer reveal */}
                {showCorrectAnswer && (
                    <View className="p-4 rounded-lg bg-success/10 border-2 border-success/30 items-center transform rotate-1">
                        <Text className="text-sm text-foreground/70 mb-1 font-sans">{t('correctAnswer')}</Text>
                        <Text className="text-xl font-display font-bold text-success">
                            {question.correctAnswer}
                        </Text>
                    </View>
                )}
            </CardContent>
        </Card>
    );
};

const styles = StyleSheet.create({
    cardShadow: {
        ...getShadowStyle('#2B1F17', { width: 4, height: 4 }, 1, 0),
        elevation: 8,
    },
});

export default QuestionCard;
