import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuestionRequest {
  theme: string;
  customTheme?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  numberOfQuestions: number;
  questionType: 'multiple-choice' | 'open-ended' | 'true-false';
  language: 'en' | 'fr' | 'ar';
}

interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'open-ended' | 'true-false';
  options?: string[];
  correctAnswer: string;
  hint?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const themeDescriptions: Record<string, Record<string, string>> = {
  movies: { en: 'movies and cinema', fr: 'films et cinéma', ar: 'الأفلام والسينما' },
  sports: { en: 'sports and athletics', fr: 'sports et athlétisme', ar: 'الرياضة' },
  science: { en: 'science and technology', fr: 'science et technologie', ar: 'العلوم والتكنولوجيا' },
  popCulture: { en: 'pop culture and celebrities', fr: 'culture pop et célébrités', ar: 'الثقافة الشعبية والمشاهير' },
  geography: { en: 'geography and world places', fr: 'géographie et lieux du monde', ar: 'الجغرافيا وأماكن العالم' },
  history: { en: 'history and historical events', fr: 'histoire et événements historiques', ar: 'التاريخ والأحداث التاريخية' },
  music: { en: 'music and artists', fr: 'musique et artistes', ar: 'الموسيقى والفنانين' },
  gaming: { en: 'video games and gaming culture', fr: 'jeux vidéo et culture gaming', ar: 'ألعاب الفيديو وثقافة الألعاب' },
};

const languageNames: Record<string, string> = {
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
};

const difficultyDescriptions: Record<string, string> = {
  easy: 'easy questions that most people would know',
  medium: 'moderately challenging questions',
  hard: 'difficult questions that require specialized knowledge',
  mixed: 'a mix of easy, medium, and hard questions',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme, customTheme, difficulty, numberOfQuestions, questionType, language }: QuestionRequest = await req.json();

    console.log('Generating questions with params:', { theme, customTheme, difficulty, numberOfQuestions, questionType, language });

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Build the theme description
    const themeDesc = theme === 'custom' && customTheme
      ? customTheme
      : themeDescriptions[theme]?.[language] || theme;

    const languageLabel = languageNames[language] || 'English';

    const systemPrompt = `You are a quiz game question generator for a fun party game called ElBureau.
Generate engaging, accurate, and entertaining trivia questions.
All questions and answers MUST be in ${languageLabel}.
Ensure all facts are accurate and answers are unambiguous.
${language === 'ar' ? 'Use proper Arabic grammar and diacritics where appropriate.' : ''}`;

    const userPrompt = `Generate ${numberOfQuestions} ${questionType} trivia questions about "${themeDesc}".

Requirements:
- Difficulty: ${difficulty === 'mixed' ? 'Mix of easy, medium, and hard' : difficultyDescriptions[difficulty]}
- ${questionType === 'multiple-choice' ? 'Each question must have exactly 4 options with one clear correct answer.' : questionType === 'true-false' ? 'Statement must be clearly True or False.' : 'Short, clear answer.'}
- All content must be in ${languageLabel}
- Questions should be fun and engaging for a party game
- Avoid controversial or offensive topics
- Each question must have a clear, unambiguous correct answer

Return a JSON array where each object matches the schema.`;

    // Define the response schema explicitly
    const responseSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          type: { type: "STRING", enum: ["multiple-choice", "open-ended", "true-false"] },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctAnswer: { type: "STRING" },
          hint: { type: "STRING" },
          difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] }
        },
        required: ["text", "type", "correctAnswer", "difficulty"]
      }
    };

    console.log('Calling Gemini generateContent...');

    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];

    const callGateway = async (modelIndex = 0, retryCount = 0): Promise<Response> => {
      const currentModel = models[modelIndex];
      const maxRetriesPerModel = 1; // Quick failover to next model

      try {
        console.log(`Trying model: ${currentModel} (attempt ${retryCount + 1})`);

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/google/${currentModel}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
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
              responseSchema: responseSchema
            },
          }),
        });

        if (res.ok) return res;

        // processing error logic
        const status = res.status;
        console.warn(`Model ${currentModel} failed with status ${status}`);

        // If 429 (Rate Limit) or 5xx (Server Error), try next model or retry same
        if (status === 429 || status >= 500) {
          if (retryCount < maxRetriesPerModel) {
            // Retry same model
            const delay = 1000 * Math.pow(2, retryCount);
            await new Promise(r => setTimeout(r, delay));
            return callGateway(modelIndex, retryCount + 1);
          } else if (modelIndex < models.length - 1) {
            // Move to next model
            console.log(`Falling back to next model from ${currentModel}`);
            return callGateway(modelIndex + 1, 0);
          }
        }

        // If it's a client error (400, 403, 404), might simply be that model doesn't exist or bad request.
        // If 404 (Not Found), definitely try next model.
        if (status === 404 && modelIndex < models.length - 1) {
          console.log(`Model ${currentModel} not found (404), falling back...`);
          return callGateway(modelIndex + 1, 0);
        }

        return res; // Return the error response if we can't handle it

      } catch (err) {
        console.error(`Error calling ${currentModel}:`, err);
        if (modelIndex < models.length - 1) {
          return callGateway(modelIndex + 1, 0);
        }
        throw err;
      }
    };

    const response = await callGateway();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini HTTP error data:', errorText);
      throw new Error(`Gemini error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini response received');

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content = parts.find((p: any) => p.text)?.text;
    if (!content) {
      throw new Error('No content in Gemini response');
    }

    // With responseSchema, content SHOULD be valid JSON string already
    let questions: Question[];
    try {
      const parsed = JSON.parse(content);
      // The schema returns specific structure, but we might get an object wrapping the array or just the array depending on how Gemini handles the root 'ARRAY' type.
      // Usually it returns the array directly if schema type is ARRAY.
      const rawList = Array.isArray(parsed) ? parsed : (parsed.questions || []); // Fallback just in case

      questions = rawList.map((q: any, index: number) => ({
        id: `q-${Date.now()}-${index}`,
        text: q.text,
        type: q.type || questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        hint: q.hint,
        difficulty: q.difficulty || difficulty,
      }));

    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Content:', content);
      throw new Error('Failed to parse question data from AI');
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-questions function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
