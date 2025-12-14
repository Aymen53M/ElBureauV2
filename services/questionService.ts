import { Question, GameSettings } from '@/contexts/GameContext';

interface GenerateQuestionsResponse {
    questions?: Question[];
    error?: string;
    code?: string;
}

function normalizeTrueFalseAnswer(raw: string): 'True' | 'False' | '' {
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === 'vrai' || v === 'صح' || v === 'صحيح' || v === 'نعم' || v === 'oui' || v === 'yes') return 'True';
    if (v === 'false' || v === 'faux' || v === 'خطأ' || v === 'خاطئ' || v === 'لا' || v === 'non' || v === 'no') return 'False';
    return '';
}

function extractQuestionsArray(parsed: any): any[] | null {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
    return null;
}

function sanitizeDifficulty(raw: any, fallback: 'easy' | 'medium' | 'hard'): 'easy' | 'medium' | 'hard' {
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (v === 'easy' || v === 'medium' || v === 'hard') return v;
    return fallback;
}

function normalizeOptions(rawOptions: any): string[] {
    if (!Array.isArray(rawOptions)) return [];
    const cleaned = (rawOptions as unknown[])
        .map((o) => (typeof o === 'string' ? o.trim() : ''))
        .filter((o) => o.length > 0);
    return Array.from(new Set(cleaned));
}

async function fetchGeminiJsonText(args: {
    apiKey: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
}): Promise<{ ok: true; content: string } | { ok: false; error: string; code: GeminiErrorCode }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await retryFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.apiKey },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: args.systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: args.userPrompt }] }],
            safetySettings: [
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
            generationConfig: {
                temperature: args.temperature,
                topP: 0.9,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        console.error('Gemini error', response.status, body);

        const bodyLower = body.toLowerCase();
        const looksLikeQuota =
            bodyLower.includes('quota') ||
            bodyLower.includes('resource_exhausted') ||
            bodyLower.includes('exhausted') ||
            bodyLower.includes('exceeded') ||
            bodyLower.includes('insufficient quota');

        const looksLikeInvalidKey =
            bodyLower.includes('api key') && (bodyLower.includes('invalid') || bodyLower.includes('not valid') || bodyLower.includes('expired'));

        if ((response.status === 429 || response.status === 403) && looksLikeQuota) {
            return {
                ok: false,
                code: 'QUOTA_EXCEEDED',
                error: 'Gemini API quota exceeded for this key. Please update your API key in Settings.',
            };
        }

        if ((response.status === 401 || response.status === 403) && (looksLikeInvalidKey || bodyLower.includes('api_key_invalid') || bodyLower.includes('permission'))) {
            return {
                ok: false,
                code: 'INVALID_API_KEY',
                error: 'Invalid Gemini API key or missing access. Please update your API key in Settings.',
            };
        }

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
        return { ok: false, error, code };
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content: string | undefined = parts.find((p: any) => p.text)?.text;

    if (!content) {
        return { ok: false, error: 'Gemini returned no content', code: 'NO_CONTENT' };
    }

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
    }

    return { ok: true, content: cleaned };
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
    | 'INVALID_API_KEY'
    | 'QUOTA_EXCEEDED'
    | 'HTTP_429'
    | 'HTTP_500'
    | 'HTTP_400'
    | 'NO_CONTENT'
    | 'UNEXPECTED_ERROR'
    | 'PARSING_ERROR'
    | 'INVALID_RESPONSE'
    | 'MODEL_UNAVAILABLE';

const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;

/**
 * Retry fetch with exponential backoff and jitter.
 * Handles network errors and retryable HTTP status codes (429, 503, 5xx).
 */
async function retryFetch(url: string, init: RequestInit, attempt = 1): Promise<Response> {
    try {
        const response = await fetch(url, init);

        // Retry on 429 (rate limit) or 503 (overloaded) or 5xx server errors
        if ((response.status === 429 || response.status === 503 || response.status >= 500) && attempt < MAX_RETRIES) {
            if (response.status === 429) {
                try {
                    const body = await response.clone().text();
                    const bodyLower = body.toLowerCase();
                    const isQuota =
                        bodyLower.includes('quota') ||
                        bodyLower.includes('resource_exhausted') ||
                        bodyLower.includes('exceeded');
                    // If quota is exhausted, do not retry automatically (each retry consumes more quota).
                    if (isQuota) {
                        return response;
                    }
                } catch {
                    // ignore
                }
            }

            const retryAfter = response.headers.get('retry-after');
            const retryAfterMs = retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : 0;
            const delay = Math.max(calculateBackoffDelay(attempt), retryAfterMs);
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
                return 'Each question must be "multiple-choice" and must include "options" with exactly 4 unique strings. "correctAnswer" MUST be exactly one of the 4 options.';
            case 'true-false':
                return 'Each question must be "true-false". Do NOT include "options". "correctAnswer" MUST be exactly "True" or "False" (these exact English tokens).';
            case 'open-ended':
            default:
                return 'Each question must be "open-ended". Do NOT include "options". Provide a short, clear "correctAnswer" (usually 1-4 words).';
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

    const toneLine = opts?.tone ? `- Tone: ${opts.tone}` : '';

    const buildUserPrompt = (extraRules?: string) => `Generate ${settings.numberOfQuestions} ${settings.questionType} trivia questions about "${themeDescription}".

Requirements:
- Difficulty: ${difficultyInstructions}
- ${questionTypeInstructions}
- Language: ${languageLabel}
- Do not mix question types. Every item must have "type": "${settings.questionType}".
- Do not include extra keys besides: text, type, options (only for multiple-choice), correctAnswer, hint (optional), difficulty.
${toneLine}
- Keep answers unambiguous, factually correct, and culturally safe.
- Add light fun where appropriate, but keep answers concise.
${extraRules ? `\n${extraRules}\n` : ''}

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

    try {
        const systemPrompt = buildSystemPrompt();
        const desiredType = settings.questionType;
        const fallbackDifficulty: 'easy' | 'medium' | 'hard' = settings.difficulty === 'easy' || settings.difficulty === 'hard' ? settings.difficulty : 'medium';

        const prompt = buildUserPrompt();
        const fetched = await fetchGeminiJsonText({ apiKey, systemPrompt, userPrompt: prompt, temperature: 0.7 });
        if (!fetched.ok) {
            return { error: fetched.error, code: fetched.code };
        }

        let parsed: any;
        try {
            parsed = JSON.parse(fetched.content);
        } catch (parseErr) {
            console.error('Gemini parse error', parseErr, fetched.content);
            return { error: 'AI response was not valid JSON. Please try again.', code: 'PARSING_ERROR' };
        }

        const rawQuestions = extractQuestionsArray(parsed);
        if (!rawQuestions) {
            return { error: 'AI response was not an array of questions. Please try again.', code: 'INVALID_RESPONSE' };
        }

        if (rawQuestions.length < settings.numberOfQuestions) {
            return { error: 'AI returned too few questions. Please try again.', code: 'INVALID_RESPONSE' };
        }

        const normalized: Question[] = [];
        const problems: string[] = [];

        for (let i = 0; i < settings.numberOfQuestions; i++) {
            const q = rawQuestions[i];
            const text = typeof q?.text === 'string' ? q.text.trim() : '';
            const hint = typeof q?.hint === 'string' ? q.hint.trim() : undefined;
            let correctAnswer = typeof q?.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
            let options: string[] | undefined;

            if (!text) problems.push(`q[${i}].text missing`);

            if (desiredType === 'multiple-choice') {
                const deduped = normalizeOptions(q?.options);
                if (correctAnswer) {
                    options = [correctAnswer, ...deduped].map((s) => s.trim()).filter((s) => s.length > 0);
                    options = Array.from(new Set(options));
                } else {
                    options = deduped;
                }

                if (!options || options.length !== 4) {
                    problems.push(`q[${i}].options must have exactly 4 items`);
                } else if (!correctAnswer || !options.includes(correctAnswer)) {
                    problems.push(`q[${i}].correctAnswer must be one of the 4 options`);
                }
            } else if (desiredType === 'true-false') {
                const normalizedAnswer = correctAnswer ? normalizeTrueFalseAnswer(correctAnswer) : '';
                if (!normalizedAnswer) {
                    problems.push(`q[${i}].correctAnswer must be "True" or "False"`);
                }
                correctAnswer = normalizedAnswer;
                options = undefined;
            } else {
                options = undefined;
                if (!correctAnswer) problems.push(`q[${i}].correctAnswer missing`);
            }

            const difficulty = sanitizeDifficulty(q?.difficulty, fallbackDifficulty);

            normalized.push({
                id: `q-${Date.now()}-${i}`,
                text,
                type: desiredType,
                options,
                correctAnswer,
                hint,
                difficulty: difficulty as any,
            });
        }

        if (problems.length > 0) {
            return { error: 'AI returned invalid questions. Please try again.', code: 'INVALID_RESPONSE' };
        }

        return { questions: normalized };
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    try {
        const response = await retryFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
