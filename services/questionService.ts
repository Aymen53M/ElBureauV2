import { Question, GameSettings } from '@/contexts/GameContext';

interface GenerateQuestionsResponse {
    questions?: Question[];
    error?: string;
    code?: string;
}

const languageNames: Record<string, string> = {
    en: 'English',
    fr: 'French',
    ar: 'Arabic',
};

/**
 * Calls Gemini directly with the player's provided API key.
 * This keeps the "your key, your content" promise: host key for shared rounds,
 * player key for personal/final rounds.
 */
// Google GenAI REST (v1beta) compatible model name.
// The Go sample provided uses "gemini-2.5-flash"; we mirror that here.
const MODEL = 'gemini-2.5-flash';

type GeminiErrorCode =
    | 'MISSING_API_KEY'
    | 'HTTP_429'
    | 'HTTP_500'
    | 'HTTP_400'
    | 'NO_CONTENT'
    | 'UNEXPECTED_ERROR'
    | 'PARSING_ERROR'
    | 'MODEL_UNAVAILABLE';

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;

/**
 * Retry fetch with exponential backoff and jitter.
 * Handles network errors and retryable HTTP status codes (429, 503, 5xx).
 */
async function retryFetch(url: string, init: RequestInit, attempt = 1): Promise<Response> {
    try {
        const response = await fetch(url, init);

        // Retry on 429 (rate limit) or 503 (overloaded) or 5xx server errors
        if ((response.status === 429 || response.status === 503 || response.status >= 500) && attempt < MAX_RETRIES) {
            const delay = calculateBackoffDelay(attempt);
            console.log(`Gemini returned ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
            await new Promise((r) => setTimeout(r, delay));
            return retryFetch(url, init, attempt + 1);
        }

        return response;
    } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
        const delay = calculateBackoffDelay(attempt);
        console.log(`Network error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, delay));
        return retryFetch(url, init, attempt + 1);
    }
}

/**
 * Calculate backoff delay with exponential increase and jitter.
 */
function calculateBackoffDelay(attempt: number): number {
    // Base exponential backoff: 1s, 2s, 4s, 8s, 16s...
    const exponentialDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    // Add random jitter (0-25% of the delay) to prevent thundering herd
    const jitter = Math.random() * 0.25 * exponentialDelay;
    // Cap at max delay
    return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

export async function generateQuestions(
    settings: GameSettings,
    apiKey?: string,
    opts?: { tone?: string }
): Promise<GenerateQuestionsResponse> {
    if (!apiKey) {
        return { error: 'Missing Gemini API key', code: 'MISSING_API_KEY' };
    }

    const languageLabel = languageNames[settings.language] || 'English';

    const buildSystemPrompt = () => {
        const base = `You are the AI question writer for the multiplayer party quiz "ElBureau".
Write energetic, game-show style trivia that is accurate, unambiguous, and fun.
Always respond with strict JSON only — no markdown, code fences, or prose.
All output MUST be in ${languageLabel}.
Keep wording concise for mobile UI.`;
        if (settings.language === 'ar') {
            return `${base}\nUse natural Modern Standard Arabic with correct directionality.`;
        }
        return base;
    };

    const questionTypeInstructions = (() => {
        switch (settings.questionType) {
            case 'multiple-choice':
                return 'Each question must include exactly 4 options with one correct answer.';
            case 'true-false':
                return 'Write a statement that is clearly True or False.';
            case 'open-ended':
            default:
                return 'Provide questions with short, clear answers (usually 1-4 words).';
        }
    })();

    const difficultyInstructions = (() => {
        switch (settings.difficulty) {
            case 'easy': return 'Keep it easy and broadly known.';
            case 'hard': return 'Challenging questions that test experts.';
            case 'mixed': return 'Mix of easy, medium, and hard across the set.';
            case 'medium':
            default: return 'Moderately challenging party-friendly questions.';
        }
    })();

    const themeDescription = settings.theme === 'custom'
        ? settings.customTheme || 'custom theme'
        : settings.theme;

    const userPrompt = `Generate ${settings.numberOfQuestions} ${settings.questionType} trivia questions about "${themeDescription}".

Requirements:
- Difficulty: ${difficultyInstructions}
- ${questionTypeInstructions}
- Language: ${languageLabel}
- Keep answers unambiguous, factually correct, and culturally safe.
- Add light fun where appropriate, but keep answers concise.

Return ONLY a valid JSON array with this exact shape (no extra text):
[
  {
    "text": "Question text",
    "type": "${settings.questionType}",
    ${settings.questionType === 'multiple-choice' ? '"options": ["Option A", "Option B", "Option C", "Option D"],' : ''}
    "correctAnswer": "Correct answer text",
    "hint": "Optional short hint",
    "difficulty": "easy" | "medium" | "hard"
  }
]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    try {
        const response = await retryFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
                contents: [
                    { role: 'user', parts: [{ text: userPrompt }] },
                ],
                safetySettings: [
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                ],
                generationConfig: {
                    temperature: 0.8,
                    topP: 0.9,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            console.error('Gemini error', response.status, body);
            const notFound = response.status === 404;
            const code: GeminiErrorCode =
                response.status === 429 ? 'HTTP_429' :
                    response.status >= 500 ? 'HTTP_500' :
                        notFound ? 'MODEL_UNAVAILABLE' : 'HTTP_400';
            const error =
                response.status === 429
                    ? 'Gemini is busy. Retried multiple times but rate limit persists. Try again soon.'
                    : notFound
                        ? 'Model not available for this key. Ensure Gemini 1.5/2.0 access.'
                        : 'Failed to generate questions after retries. Check your Gemini key or try again.';
            return { error, code };
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const content: string | undefined = parts.find((p: any) => p.text)?.text;

        if (!content) {
            return { error: 'Gemini returned no content', code: 'NO_CONTENT' };
        }

        // Clean potential markdown fencing
        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
        }

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('Gemini parse error', parseErr, cleaned);
            return { error: 'Received unparseable response from Gemini.', code: 'PARSING_ERROR' };
        }

        const questions: Question[] = parsed.map((q: any, index: number) => ({
            id: `q-${Date.now()}-${index}`,
            text: q.text,
            type: q.type || settings.questionType,
            options: q.options,
            correctAnswer: q.correctAnswer,
            hint: q.hint,
            difficulty: q.difficulty || settings.difficulty || 'medium',
        }));

        return { questions };
    } catch (err) {
        console.error('Unexpected error generating questions:', err);
        return {
            error: err instanceof Error ? err.message : 'An unexpected error occurred',
            code: 'UNEXPECTED_ERROR'
        };
    }
}

/**
 * Generates a fun narrative highlight of the game for the results screen.
 * Uses the host's API key to generate personalized game commentary.
 */
export interface GameHighlightsData {
    winner: { name: string; score: number };
    players: { name: string; score: number; isHost: boolean }[];
    theme: string;
    totalQuestions: number;
    language: 'en' | 'fr' | 'ar';
}

interface HighlightsResponse {
    highlights?: string;
    error?: string;
}

export async function generateGameHighlights(
    data: GameHighlightsData,
    apiKey?: string
): Promise<HighlightsResponse> {
    if (!apiKey) {
        return { error: 'Missing API key' };
    }

    const languageLabel = languageNames[data.language] || 'English';
    const playerList = data.players
        .map((p, i) => `${i + 1}. ${p.name}: ${p.score} points${p.isHost ? ' (Host)' : ''}`)
        .join('\n');

    const systemPrompt = `You are a fun, energetic game show host commentator for "ElBureau" party quiz game.
Write a short, entertaining highlight summary of the game results.
Be playful, use emojis sparingly, and make it feel like a real game show wrap-up.
Write in ${languageLabel}. Keep it to 2-3 sentences max.`;

    const userPrompt = `The quiz game just ended! Here are the results:

Theme: ${data.theme}
Total Questions: ${data.totalQuestions}

Final Standings:
${playerList}

Winner: ${data.winner.name} with ${data.winner.score} points!

Write a fun, brief highlight commentary (2-3 sentences) celebrating the game. Make it feel exciting and party-like!`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    try {
        const response = await retryFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [
                    { role: 'user', parts: [{ text: userPrompt }] },
                ],
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    maxOutputTokens: 200,
                },
            }),
        });

        if (!response.ok) {
            return { error: 'Failed to generate highlights' };
        }

        const responseData = await response.json();
        const parts = responseData?.candidates?.[0]?.content?.parts || [];
        const content: string | undefined = parts.find((p: any) => p.text)?.text;

        if (!content) {
            return { error: 'No highlights generated' };
        }

        return { highlights: content.trim() };
    } catch (err) {
        console.error('Error generating highlights:', err);
        return { error: 'Failed to generate highlights' };
    }
}
