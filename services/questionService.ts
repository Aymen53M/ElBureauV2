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

const ALL_QUESTION_TYPES = ['multiple-choice', 'open-ended', 'true-false'] as const;
type ConcreteQuestionType = (typeof ALL_QUESTION_TYPES)[number];

function normalizeQuestionTypes(settings: GameSettings): ConcreteQuestionType[] {
    const raw = settings.questionType === 'mixed'
        ? (Array.isArray(settings.questionTypes) ? settings.questionTypes : [])
        : [settings.questionType];

    const cleaned = raw
        .filter((t): t is ConcreteQuestionType => (ALL_QUESTION_TYPES as readonly string[]).includes(t))
        .filter((t, idx, arr) => arr.indexOf(t) === idx);

    return cleaned.length ? cleaned : ['multiple-choice'];
}

function computeCounts(total: number, types: ConcreteQuestionType[]): Record<ConcreteQuestionType, number> {
    const counts: Record<ConcreteQuestionType, number> = {
        'multiple-choice': 0,
        'open-ended': 0,
        'true-false': 0,
    };

    if (types.length === 0) return counts;

    const base = Math.floor(total / types.length);
    const remainder = total % types.length;
    types.forEach((t, i) => {
        counts[t] = base + (i < remainder ? 1 : 0);
    });
    return counts;
}

function sumCounts(counts: Record<ConcreteQuestionType, number>): number {
    return (counts['multiple-choice'] || 0) + (counts['open-ended'] || 0) + (counts['true-false'] || 0);
}

function normalizeDifficulty(value: unknown, fallback: GameSettings['difficulty']): 'easy' | 'medium' | 'hard' {
    const v = typeof value === 'string' ? value.toLowerCase().trim() : '';
    if (v === 'easy' || v === 'medium' || v === 'hard') return v;
    if (fallback === 'easy' || fallback === 'medium' || fallback === 'hard') return fallback;
    return 'medium';
}

function normalizeTrueFalseAnswer(value: unknown): 'True' | 'False' | null {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (v === 'true') return 'True';
    if (v === 'false') return 'False';
    return null;
}

function parseGeminiJsonArray(content: string): unknown[] | null {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    }

    try {
        const parsed: any = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.questions)) return parsed.questions;
        return null;
    } catch {
        return null;
    }
}

function validateAndNormalizeQuestions(args: {
    raw: unknown[];
    allowedTypes: ConcreteQuestionType[];
    settings: GameSettings;
}): Question[] {
    const allowedSet = new Set(args.allowedTypes);
    const out: Question[] = [];

    for (let i = 0; i < args.raw.length; i++) {
        const q: any = args.raw[i];
        const text = typeof q?.text === 'string' ? q.text.trim() : '';
        const hint = typeof q?.hint === 'string' ? q.hint.trim() : undefined;
        const difficulty = normalizeDifficulty(q?.difficulty, args.settings.difficulty);

        if (!text) continue;

        const rawType = typeof q?.type === 'string' ? q.type.trim() : '';
        const type = allowedSet.has(rawType as ConcreteQuestionType) ? (rawType as ConcreteQuestionType) : null;
        if (!type) continue;

        if (type === 'multiple-choice') {
            const correctAnswer = typeof q?.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
            if (!correctAnswer) continue;
            if (!Array.isArray(q?.options)) continue;
            let options = (q.options as unknown[])
                .map((o) => (typeof o === 'string' ? o.trim() : ''))
                .filter((o) => o.length > 0);
            options = Array.from(new Set(options));

            // Ensure correctAnswer is always part of options, then trim to exactly 4.
            if (!options.includes(correctAnswer)) {
                options = [correctAnswer, ...options];
            }
            const rest = options.filter((o) => o !== correctAnswer);
            options = [correctAnswer, ...rest].slice(0, 4);

            if (options.length !== 4) continue;

            out.push({
                id: `q-${Date.now()}-${i}`,
                text,
                type: 'multiple-choice',
                options,
                correctAnswer,
                hint,
                difficulty,
            });
            continue;
        }

        if (type === 'true-false') {
            const tf = normalizeTrueFalseAnswer(q?.correctAnswer);
            if (!tf) continue;
            out.push({
                id: `q-${Date.now()}-${i}`,
                text,
                type: 'true-false',
                correctAnswer: tf,
                hint,
                difficulty,
            });
            continue;
        }

        // open-ended
        const correctAnswer = typeof q?.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
        if (!correctAnswer) continue;
        out.push({
            id: `q-${Date.now()}-${i}`,
            text,
            type: 'open-ended',
            correctAnswer,
            hint,
            difficulty,
        });
    }

    // De-dupe by (type + text)
    const seen = new Set<string>();
    return out.filter((q) => {
        const key = `${q.type}|${q.text}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

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

    const allowedTypes = normalizeQuestionTypes(settings);
    const desiredCounts = computeCounts(settings.numberOfQuestions, allowedTypes);

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

    const buildUserPrompt = (counts: Record<ConcreteQuestionType, number>, avoidTexts: string[] = []) => {
        const total = sumCounts(counts);
        const distribution = allowedTypes
            .filter((t) => (counts[t] || 0) > 0)
            .map((t) => `- ${t}: ${counts[t]}`)
            .join('\n');

        const avoidBlock = avoidTexts.length
            ? `\nDo NOT repeat any of these questions:\n${avoidTexts.map((t) => `- ${t}`).join('\n')}\n`
            : '';

        return `Generate ${total} trivia questions about "${themeDescription}".\n\nRequirements:\n- Difficulty: ${difficultyInstructions}\n- Language: ${languageLabel}\n- Keep answers unambiguous, factually correct, and culturally safe.\n- Keep wording concise for mobile UI.\n\nQuestion types (generate exactly these counts):\n${distribution}${avoidBlock}\nHard rules:\n- Allowed "type" values: ${allowedTypes.join(', ')}\n- Return ONLY JSON (no markdown / no prose).\n- Each item MUST match the schema for its type:\n  - multiple-choice: type="multiple-choice", options: exactly 4 distinct strings, correctAnswer must be one of the options.\n  - true-false: type="true-false", correctAnswer must be exactly "True" or "False" (no options).\n  - open-ended: type="open-ended", correctAnswer is short and clear (no options).\n\nReturn ONLY a JSON array of objects.`;
    };

    const userPrompt = buildUserPrompt(desiredCounts);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    try {
        const callOnce = async (prompt: string) => {
            const response = await retryFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
                    contents: [
                        { role: 'user', parts: [{ text: prompt }] },
                    ],
                    safetySettings: [
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                    ],
                    generationConfig: {
                        temperature: 0.6,
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
                return { error, code } as const;
            }

            const data = await response.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const content: string | undefined = parts.find((p: any) => p.text)?.text;
            if (!content) {
                return { error: 'Gemini returned no content', code: 'NO_CONTENT' as const };
            }
            return { content } as const;
        };

        const first = await callOnce(userPrompt);
        if ('error' in first) return { error: first.error, code: first.code };

        const rawFirst = parseGeminiJsonArray(first.content);
        if (!rawFirst) {
            return { error: 'Received unparseable response from Gemini.', code: 'PARSING_ERROR' };
        }

        let validated = validateAndNormalizeQuestions({ raw: rawFirst, allowedTypes, settings });

        const pickToCounts = (qs: Question[], counts: Record<ConcreteQuestionType, number>) => {
            const byType: Record<ConcreteQuestionType, Question[]> = {
                'multiple-choice': [],
                'open-ended': [],
                'true-false': [],
            };
            qs.forEach((q) => {
                if (q.type === 'multiple-choice') byType['multiple-choice'].push(q);
                if (q.type === 'open-ended') byType['open-ended'].push(q);
                if (q.type === 'true-false') byType['true-false'].push(q);
            });

            const picked: Question[] = [];
            const missing: Record<ConcreteQuestionType, number> = { ...counts };
            (Object.keys(missing) as ConcreteQuestionType[]).forEach((k) => {
                if (!allowedTypes.includes(k)) missing[k] = 0;
            });

            allowedTypes.forEach((t) => {
                const need = missing[t] || 0;
                if (need <= 0) return;
                const take = Math.min(need, byType[t].length);
                picked.push(...byType[t].slice(0, take));
                missing[t] = need - take;
            });

            return { picked, missing };
        };

        let { picked, missing } = pickToCounts(validated, desiredCounts);

        if (sumCounts(missing) > 0) {
            const avoid = picked.map((q) => q.text).slice(0, 20);
            const fillPrompt = buildUserPrompt(missing, avoid);
            const second = await callOnce(fillPrompt);
            if (!('error' in second)) {
                const rawSecond = parseGeminiJsonArray(second.content);
                if (rawSecond) {
                    const secondValidated = validateAndNormalizeQuestions({ raw: rawSecond, allowedTypes, settings });
                    validated = [...picked, ...secondValidated];
                    ({ picked, missing } = pickToCounts(validated, desiredCounts));
                }
            }
        }

        if (picked.length < settings.numberOfQuestions) {
            return {
                error: 'The AI did not generate enough valid questions for the selected modes. Please try again.',
                code: 'PARSING_ERROR',
            };
        }

        return { questions: picked.slice(0, settings.numberOfQuestions) };
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
