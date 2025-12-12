import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'fr' | 'ar';

interface Translations {
    [key: string]: {
        en: string;
        fr: string;
        ar: string;
    };
}

export const translations: Translations = {
    // Navigation & Common
    home: { en: 'Home', fr: 'Accueil', ar: 'الرئيسية' },
    settings: { en: 'Settings', fr: 'Paramètres', ar: 'الإعدادات' },
    play: { en: 'Play', fr: 'Jouer', ar: 'العب' },
    back: { en: 'Back', fr: 'Retour', ar: 'رجوع' },
    createRoom: { en: 'Create Room', fr: 'Créer une Salle', ar: 'إنشاء غرفة' },
    joinRoom: { en: 'Join Room', fr: 'Rejoindre une Salle', ar: 'انضم لغرفة' },
    howToPlay: { en: 'How to Play', fr: 'Comment Jouer', ar: 'كيف تلعب' },
    save: { en: 'Save', fr: 'Sauvegarder', ar: 'حفظ' },
    cancel: { en: 'Cancel', fr: 'Annuler', ar: 'إلغاء' },
    confirm: { en: 'Confirm', fr: 'Confirmer', ar: 'تأكيد' },
    next: { en: 'Next', fr: 'Suivant', ar: 'التالي' },
    submit: { en: 'Submit', fr: 'Soumettre', ar: 'إرسال' },

    // Home Page
    tagline: { en: 'The Ultimate AI Quiz Party!', fr: 'Le Quiz Party IA Ultime!', ar: 'حفلة الأسئلة الذكية!' },
    createRoom: { en: 'Create Room', fr: 'Créer une Salle', ar: 'إنشاء غرفة' },
    joinRoom: { en: 'Join Room', fr: 'Rejoindre une Salle', ar: 'انضم لغرفة' },
    howToPlay: { en: 'How to Play', fr: 'Comment Jouer', ar: 'كيف تلعب' },

    // Settings
    apiKey: { en: 'Gemini API Key', fr: 'Clé API Gemini', ar: 'مفتاح API جيميني' },
    apiKeyPlaceholder: { en: 'Enter your Gemini API key...', fr: 'Entrez votre clé API Gemini...', ar: 'أدخل مفتاح API جيميني...' },
    apiKeyDesc: { en: 'Required to host games. Get your key from Google AI Studio.', fr: 'Requis pour héberger des jeux. Obtenez votre clé depuis Google AI Studio.', ar: 'مطلوب لاستضافة الألعاب. احصل على مفتاحك من Google AI Studio.' },
    apiKeyCta: { en: 'Get your API key from Google AI Studio', fr: 'Récupérez votre clé sur Google AI Studio', ar: 'احصل على مفتاحك من Google AI Studio' },
    hostingRuleTitle: { en: 'Hosting rule', fr: "Règle d’hébergement", ar: 'قاعدة الاستضافة' },
    hostingRuleDesc: { en: 'To host or trigger personalized finals, each player must save their own Gemini API key. Shared rounds use the host’s key; personal finals use the player’s key.', fr: 'Pour héberger ou lancer une finale personnalisée, chaque joueur doit enregistrer sa propre clé Gemini. Les manches partagées utilisent la clé de l’hôte ; les finales personnelles utilisent la clé du joueur.', ar: 'لاستضافة لعبة أو تشغيل النهائي الشخصي، يجب على كل لاعب حفظ مفتاح جيميني الخاص به. الجولات المشتركة تستخدم مفتاح المضيف؛ النهائيات الشخصية تستخدم مفتاح اللاعب.' },
    setupRequired: { en: 'Setup Required', fr: 'Configuration requise', ar: 'الإعداد مطلوب' },
    setupRequiredDesc: { en: 'Please set your name and Gemini API key in settings.', fr: 'Veuillez définir votre nom et votre clé Gemini dans les paramètres.', ar: 'يرجى ضبط اسمك ومفتاح جيميني في الإعدادات.' },
    goToSettings: { en: 'Go to Settings', fr: 'Aller aux paramètres', ar: 'اذهب للإعدادات' },
    playerName: { en: 'Player Name', fr: 'Nom du Joueur', ar: 'اسم اللاعب' },
    playerNamePlaceholder: { en: 'Enter your name...', fr: 'Entrez votre nom...', ar: 'أدخل اسمك...' },
    language: { en: 'Language', fr: 'Langue', ar: 'اللغة' },
    savedSuccessfully: { en: 'Settings saved!', fr: 'Paramètres sauvegardés!', ar: 'تم حفظ الإعدادات!' },

    // Room
    roomCode: { en: 'Room Code', fr: 'Code de la Salle', ar: 'رمز الغرفة' },
    enterRoomCode: { en: 'Enter room code...', fr: 'Entrez le code de la salle...', ar: 'أدخل رمز الغرفة...' },
    waiting: { en: 'Waiting for players...', fr: 'En attente des joueurs...', ar: 'في انتظار اللاعبين...' },
    players: { en: 'Players', fr: 'Joueurs', ar: 'اللاعبين' },
    startGame: { en: 'Start Game', fr: 'Démarrer le Jeu', ar: 'بدء اللعبة' },
    host: { en: 'Host', fr: 'Hôte', ar: 'المضيف' },
    notReadyTitle: { en: 'Not Ready', fr: 'Pas prêt', ar: 'غير جاهز' },
    notReadyDesc: { en: 'All players must be ready to start.', fr: 'Tous les joueurs doivent être prêts pour commencer.', ar: 'يجب أن يكون جميع اللاعبين جاهزين للبدء.' },

    // Game Setup
    theme: { en: 'Theme', fr: 'Thème', ar: 'الموضوع' },
    customTheme: { en: 'Custom Theme', fr: 'Thème Personnalisé', ar: 'موضوع مخصص' },
    difficulty: { en: 'Difficulty', fr: 'Difficulté', ar: 'الصعوبة' },
    easy: { en: 'Easy', fr: 'Facile', ar: 'سهل' },
    medium: { en: 'Medium', fr: 'Moyen', ar: 'متوسط' },
    hard: { en: 'Hard', fr: 'Difficile', ar: 'صعب' },
    mixed: { en: 'Mixed', fr: 'Mixte', ar: 'مختلط' },
    numberOfQuestions: { en: 'Number of Questions', fr: 'Nombre de Questions', ar: 'عدد الأسئلة' },
    questionType: { en: 'Question Type', fr: 'Type de Question', ar: 'نوع السؤال' },
    multipleChoice: { en: 'Multiple Choice', fr: 'Choix Multiple', ar: 'اختيار متعدد' },
    openEnded: { en: 'Open Ended', fr: 'Réponse Libre', ar: 'إجابة مفتوحة' },
    trueFalse: { en: 'True/False', fr: 'Vrai/Faux', ar: 'صح/خطأ' },

    // Gameplay
    question: { en: 'Question', fr: 'Question', ar: 'سؤال' },
    placeBet: { en: 'Place Your Bet', fr: 'Placez Votre Pari', ar: 'ضع رهانك' },
    betDescription: { en: 'Choose wisely! Each number can only be used once.', fr: 'Choisissez bien! Chaque nombre ne peut être utilisé qu\'une fois.', ar: 'اختر بحكمة! كل رقم يمكن استخدامه مرة واحدة فقط.' },
    answer: { en: 'Your Answer', fr: 'Votre Réponse', ar: 'إجابتك' },
    timeLeft: { en: 'Time Left', fr: 'Temps Restant', ar: 'الوقت المتبقي' },
    correctAnswer: { en: 'Correct Answer', fr: 'Bonne Réponse', ar: 'الإجابة الصحيحة' },
    yourBet: { en: 'Your Bet', fr: 'Votre Pari', ar: 'رهانك' },
    points: { en: 'Points', fr: 'Points', ar: 'نقاط' },
    score: { en: 'Score', fr: 'Score', ar: 'النتيجة' },
    answerPreview: { en: 'Answers preview (submitted only)', fr: 'Aperçu des réponses (soumissions)', ar: 'معاينة الإجابات المرسلة' },
    waitingForAnswer: { en: 'Waiting...', fr: 'En attente...', ar: 'بانتظار الإجابة...' },
    revealNow: { en: 'Reveal correct answer', fr: 'Révéler la réponse', ar: 'أظهر الإجابة الصحيحة' },
    hostValidation: { en: 'Host validation', fr: 'Validation de l’hôte', ar: 'تحقق المضيف' },
    markCorrect: { en: 'Correct', fr: 'Correct', ar: 'صحيح' },
    markIncorrect: { en: 'Incorrect', fr: 'Incorrect', ar: 'خاطئ' },
    applyScores: { en: 'Apply scores', fr: 'Appliquer les scores', ar: 'تطبيق الدرجات' },
    finalWager: { en: 'Final wager round', fr: 'Manche de mise finale', ar: 'جولة الرهان الأخيرة' },
    finalWagerDesc: { en: 'Risk 0, 10, or 20 points. Correct wins, wrong loses.', fr: 'Misez 0, 10 ou 20 points. Bonne réponse gagne, mauvaise perd.', ar: 'اختر 0 أو 10 أو 20 نقطة. الصحيح يكسب والخطأ يخسر.' },
    personalFinal: { en: 'Personalized', fr: 'Personnalisée', ar: 'شخصية' },
    sharedFinal: { en: 'Shared question', fr: 'Question partagée', ar: 'سؤال مشترك' },
    submitToSee: { en: 'Submit your answer to preview others.', fr: 'Soumettez votre réponse pour voir celles des autres.', ar: 'قدّم إجابتك لرؤية إجابات الآخرين.' },
    missingApiKeyHost: { en: 'Host needs a Gemini key saved to start the game.', fr: 'L’hôte doit enregistrer une clé Gemini pour démarrer la partie.', ar: 'يجب على المضيف حفظ مفتاح جيميني لبدء اللعبة.' },
    missingApiKeyPersonal: { en: 'Save your Gemini key in settings to generate your final question.', fr: 'Enregistrez votre clé Gemini dans les paramètres pour générer votre question finale.', ar: 'احفظ مفتاح جيميني في الإعدادات لإنشاء سؤالك النهائي.' },
    generationFailed: { en: 'Could not generate a final question. Returning to results.', fr: 'Impossible de générer la question finale. Retour aux résultats.', ar: 'تعذر إنشاء السؤال النهائي. سيتم العودة للنتائج.' },
    chooseDifficulty: { en: 'Choose your difficulty', fr: 'Choisissez la difficulté', ar: 'اختر مستوى الصعوبة' },
    startFinal: { en: 'Start final question', fr: 'Lancer la question finale', ar: 'ابدأ السؤال النهائي' },
    finalQuestion: { en: 'Final Question', fr: 'Question Finale', ar: 'السؤال النهائي' },
    loading: { en: 'Loading...', fr: 'Chargement...', ar: 'جار التحميل...' },

    // Results
    gameOver: { en: 'Game Over!', fr: 'Fin du Jeu!', ar: 'انتهت اللعبة!' },
    winner: { en: 'Winner', fr: 'Gagnant', ar: 'الفائز' },
    finalStandings: { en: 'Final Standings', fr: 'Classement Final', ar: 'الترتيب النهائي' },
    playAgain: { en: 'Play Again', fr: 'Rejouer', ar: 'العب مجدداً' },
    seeResults: { en: 'See Results', fr: 'Voir les résultats', ar: 'عرض النتائج' },

    // Themes
    movies: { en: 'Movies', fr: 'Films', ar: 'أفلام' },
    sports: { en: 'Sports', fr: 'Sports', ar: 'رياضة' },
    science: { en: 'Science', fr: 'Science', ar: 'علوم' },
    popCulture: { en: 'Pop Culture', fr: 'Culture Pop', ar: 'ثقافة شعبية' },
    geography: { en: 'Geography', fr: 'Géographie', ar: 'جغرافيا' },
    history: { en: 'History', fr: 'Histoire', ar: 'تاريخ' },
    music: { en: 'Music', fr: 'Musique', ar: 'موسيقى' },
    gaming: { en: 'Gaming', fr: 'Jeux Vidéo', ar: 'ألعاب' },

    // Misc
    copied: { en: 'Copied!', fr: 'Copié!', ar: 'تم النسخ!' },
    ready: { en: 'Ready!', fr: 'Prêt!', ar: 'جاهز!' },
    notReady: { en: 'Not Ready', fr: 'Pas Prêt', ar: 'غير جاهز' },
    correct: { en: 'Correct!', fr: 'Correct!', ar: 'صحيح!' },
    incorrect: { en: 'Incorrect!', fr: 'Incorrect!', ar: 'خاطئ!' },
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
    isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('en');
    const [isLoaded, setIsLoaded] = useState(false);

    const isRTL = language === 'ar';

    useEffect(() => {
        // Load saved language
        const loadLanguage = async () => {
            try {
                const saved = await AsyncStorage.getItem('elbureau-language');
                if (saved && ['en', 'fr', 'ar'].includes(saved)) {
                    setLanguageState(saved as Language);
                }
            } catch (error) {
                console.error('Failed to load language:', error);
            } finally {
                setIsLoaded(true);
            }
        };
        loadLanguage();
    }, []);

    useEffect(() => {
        if (isLoaded) {
            // Save language preference
            AsyncStorage.setItem('elbureau-language', language);

            // Handle RTL layout
            if (I18nManager.isRTL !== isRTL) {
                I18nManager.forceRTL(isRTL);
                // Note: RTL changes may require app restart
            }
        }
    }, [language, isRTL, isLoaded]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
    };

    const t = (key: string): string => {
        return translations[key]?.[language] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
