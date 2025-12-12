import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Question } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    totalQuestions: number;
    selectedAnswer: string | null;
    onSelectAnswer: (answer: string) => void;
    isAnswerPhase: boolean;
    showCorrectAnswer?: boolean;
    hintsEnabled?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    questionNumber,
    totalQuestions,
    selectedAnswer,
    onSelectAnswer,
    isAnswerPhase,
    showCorrectAnswer = false,
    hintsEnabled = false,
}) => {
    const { t } = useLanguage();
    const [openEndedAnswer, setOpenEndedAnswer] = React.useState('');
    const [showHint, setShowHint] = React.useState(false);

    React.useEffect(() => {
        setOpenEndedAnswer('');
        setShowHint(false);
    }, [question.id]);

    const handleOpenEndedSubmit = () => {
        if (openEndedAnswer.trim()) {
            onSelectAnswer(openEndedAnswer.trim());
        }
    };

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
            <CardContent className="p-7 space-y-7">
                {/* Question header */}
                <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-muted-foreground">
                        {t('question')} {questionNumber}/{totalQuestions}
                    </Text>
                    <View className={`px-3 py-1 rounded-full ${getDifficultyColor()}`}>
                        <Text className="text-xs font-semibold">
                            {t(question.difficulty)}
                        </Text>
                    </View>
                </View>

                {/* Question text */}
                <Text className="text-2xl font-display font-bold text-center text-foreground leading-tight">
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
                    <View className="space-y-3">
                        {question.type === 'multiple-choice' && question.options && (
                            <View className="space-y-3">
                                {question.options.map((option, index) => {
                                    const isSelected = selectedAnswer === option;
                                    const isCorrect = showCorrectAnswer && option === question.correctAnswer;
                                    const isWrong = showCorrectAnswer && isSelected && option !== question.correctAnswer;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => !showCorrectAnswer && onSelectAnswer(option)}
                                            disabled={showCorrectAnswer}
                                            className={`flex-row items-center p-4 rounded-xl border-2 ${isCorrect
                                                ? 'border-neon-green bg-neon-green/20'
                                                : isWrong
                                                    ? 'border-destructive bg-destructive/20'
                                                    : isSelected && !showCorrectAnswer
                                                        ? 'border-primary bg-primary/20'
                                                        : 'border-primary/30 bg-card'
                                                }`}
                                        >
                                            <View className="w-8 h-8 rounded-lg bg-muted items-center justify-center mr-3">
                                                <Text className="font-bold text-foreground">
                                                    {String.fromCharCode(65 + index)}
                                                </Text>
                                            </View>
                                            <Text className={`flex-1 text-base ${isCorrect ? 'text-neon-green' : isWrong ? 'text-destructive' : 'text-foreground'
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

                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            onPress={() => !showCorrectAnswer && onSelectAnswer(option)}
                                            disabled={showCorrectAnswer}
                                            className={`w-32 py-4 rounded-xl items-center border-2 ${isCorrect
                                                ? 'border-neon-green bg-neon-green/20'
                                                : isWrong
                                                    ? 'border-destructive bg-destructive/20'
                                                    : isSelected && !showCorrectAnswer
                                                        ? 'border-primary bg-primary/20'
                                                        : 'border-primary/30 bg-card'
                                                }`}
                                        >
                                            <Text className={`font-display font-bold text-lg ${isCorrect ? 'text-neon-green' : isWrong ? 'text-destructive' : 'text-foreground'
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
                                    value={openEndedAnswer}
                                    onChangeText={setOpenEndedAnswer}
                                    placeholder={t('answer') + '...'}
                                    placeholderTextColor="#8FA3B8"
                                    className="flex-1 h-12 px-4 rounded-xl border border-border bg-input text-foreground"
                                />
                                <Button
                                    onPress={handleOpenEndedSubmit}
                                    disabled={!openEndedAnswer.trim()}
                                >
                                    <Text className="font-display font-bold text-primary-foreground">
                                        {t('submit')}
                                    </Text>
                                </Button>
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
        shadowColor: '#00D4AA',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
});

export default QuestionCard;
