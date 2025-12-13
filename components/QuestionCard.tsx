import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Card, CardContent } from '@/components/ui/Card';
import { Question } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';

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
            case 'easy': return 'bg-neon-green/20 text-neon-green';
            case 'medium': return 'bg-accent/20 text-accent';
            case 'hard': return 'bg-destructive/20 text-destructive';
            default: return 'bg-primary/20 text-primary';
        }
    };

    const hasHint = hintsEnabled && question.hint && question.hint.trim().length > 0;

    return (
        <Card className="border-primary/30 rounded-3xl" style={styles.cardShadow}>
            <CardContent className={`${isCompact ? 'p-5 space-y-5' : 'p-7 space-y-7'}`}>
                {/* Question header */}
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold text-muted-foreground">
                            {t('question')} {questionNumber}/{totalQuestions}
                        </Text>
                        {headerAccessory}
                    </View>
                    <View className={`px-3 py-1 rounded-full ${getDifficultyColor()}`}>
                        <Text className="text-xs font-semibold">
                            {t(question.difficulty)}
                        </Text>
                    </View>
                </View>

                {/* Question text */}
                <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-center text-foreground leading-tight`}>
                    {question.text}
                </Text>

                {/* Hint section */}
                {hasHint && isAnswerPhase && !showCorrectAnswer && (
                    <View className="items-center">
                        {!showHint ? (
                            <TouchableOpacity
                                onPress={() => setShowHint(true)}
                                className="px-4 py-2 rounded-full bg-accent/20 border border-accent/30"
                            >
                                <Text className="text-accent font-semibold text-sm">
                                    💡 {t('showHint')}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="p-3 rounded-xl bg-accent/10 border border-accent/30 w-full">
                                <Text className="text-xs text-accent font-semibold mb-1">{t('hint')}:</Text>
                                <Text className="text-foreground text-center">{question.hint}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Answer options */}
                {isAnswerPhase && (
                    <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                        {disabled && !!disabledMessage && (
                            <View className="items-center">
                                <Text className="text-muted-foreground text-sm italic text-center">
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
                                            className={`flex-row items-center ${isCompact ? 'p-3 rounded-lg' : 'p-4 rounded-xl'} border-2 ${isCorrect
                                                ? 'border-neon-green bg-neon-green/20'
                                                : isWrong
                                                    ? 'border-destructive bg-destructive/20'
                                                    : isSelected && !showCorrectAnswer
                                                        ? 'border-primary bg-primary/20'
                                                        : 'border-primary/30 bg-card'
                                                }`}
                                        >
                                            <View className={`${isCompact ? 'w-7 h-7 rounded-md' : 'w-8 h-8 rounded-lg'} bg-muted items-center justify-center mr-3`}>
                                                <Text className="font-bold text-foreground">
                                                    {String.fromCharCode(65 + index)}
                                                </Text>
                                            </View>
                                            <Text className={`flex-1 ${isCompact ? 'text-sm' : 'text-base'} ${isCorrect ? 'text-neon-green' : isWrong ? 'text-destructive' : 'text-foreground'
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
                                {['True', 'False'].map((option) => {
                                    const isSelected = selectedAnswer === option;
                                    const isCorrect = showCorrectAnswer && option === question.correctAnswer;
                                    const isWrong = showCorrectAnswer && isSelected && option !== question.correctAnswer;

                                    const isDisabled = showCorrectAnswer || disabled;

                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            onPress={() => !isDisabled && onSelectAnswer(option)}
                                            disabled={isDisabled}
                                            className={`${isCompact ? 'w-28 py-3 rounded-lg' : 'w-32 py-4 rounded-xl'} items-center border-2 ${isCorrect
                                                ? 'border-neon-green bg-neon-green/20'
                                                : isWrong
                                                    ? 'border-destructive bg-destructive/20'
                                                    : isSelected && !showCorrectAnswer
                                                        ? 'border-primary bg-primary/20'
                                                        : 'border-primary/30 bg-card'
                                                }`}
                                        >
                                            <Text className={`font-display font-bold ${isCompact ? 'text-base' : 'text-lg'} ${isCorrect ? 'text-neon-green' : isWrong ? 'text-destructive' : 'text-foreground'
                                                }`}>
                                                {option}
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
                                    placeholderTextColor="#7B6657"
                                    className={`flex-1 ${isCompact ? 'h-11 text-sm' : 'h-12'} px-4 rounded-xl border border-border bg-input text-foreground`}
                                />
                            </View>
                        )}
                    </View>
                )}

                {/* Correct answer reveal */}
                {showCorrectAnswer && (
                    <View className="p-4 rounded-xl bg-neon-green/10 border border-neon-green/30 items-center">
                        <Text className="text-sm text-muted-foreground mb-1">{t('correctAnswer')}</Text>
                        <Text className="text-xl font-display font-bold text-neon-green">
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
        shadowColor: '#C97B4C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
});

export default QuestionCard;
