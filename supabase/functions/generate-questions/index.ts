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

    // Build question type instructions
    let questionTypeInstructions = '';
    if (questionType === 'multiple-choice') {
      questionTypeInstructions = 'Each question must have exactly 4 options with one correct answer.';
    } else if (questionType === 'true-false') {
      questionTypeInstructions = 'Each question must be a statement that is either True or False.';
    } else {
      questionTypeInstructions = 'Each question should have a short, clear answer (1-3 words typically).';
    }

    // Build difficulty instructions for mixed mode
    let difficultyInstructions = difficultyDescriptions[difficulty];
    if (difficulty === 'mixed') {
      difficultyInstructions = `Include approximately equal amounts of easy, medium, and hard questions. Vary the difficulty throughout.`;
    }

    const systemPrompt = `You are a quiz game question generator for a fun party game called ElBureau.
Generate engaging, accurate, and entertaining trivia questions.
All questions and answers MUST be in ${languageNames[language]}.
Ensure all facts are accurate and answers are unambiguous.
Always respond with raw JSON only (no markdown, no explanations).
${language === 'ar' ? 'Use proper Arabic grammar and diacritics where appropriate.' : ''}`;

    const userPrompt = `Generate ${numberOfQuestions} ${questionType} trivia questions about "${themeDesc}".

Requirements:
- Difficulty: ${difficultyInstructions}
- ${questionTypeInstructions}
- All content must be in ${languageNames[language]}
- Questions should be fun and engaging for a party game
- Avoid controversial or offensive topics
- Each question must have a clear, unambiguous correct answer

Return the response as a valid JSON array with this exact structure and nothing else:
[
  {
    "text": "The question text",
    "type": "${questionType}",
    ${questionType === 'multiple-choice' ? '"options": ["Option A", "Option B", "Option C", "Option D"],' : ''}
    "correctAnswer": "The correct answer",
    "hint": "A helpful hint (optional)",
    "difficulty": "easy" | "medium" | "hard"
  }
]

IMPORTANT: Return ONLY the JSON array, no markdown, no explanation, just valid JSON.`;

    console.log('Calling Gemini generateContent...');

    const maxRetries = 3;
    const baseDelay = 700;

    const callGateway = async (attempt = 1): Promise<Response> => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/google/${'gemini-2.5-flash'}:generateContent?key=${GEMINI_API_KEY}`, {
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
            },
          }),
        });
        if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          return callGateway(attempt + 1);
        }
        return res;
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        return callGateway(attempt + 1);
      }
    };

    const response = await callGateway();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini HTTP error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.',
          code: 'RATE_LIMIT'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Billing or quota issue. Check your Gemini quota/billing.',
          code: 'BILLING'
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini response received');

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content = parts.find((p: any) => p.text)?.text;
    if (!content) {
      console.error('No content in Gemini response:', data);
      throw new Error('No content in Gemini response');
    }

    // Parse the JSON response
    let questions: Question[];
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      // Add IDs to questions
      questions = parsed.map((q: any, index: number) => ({
        id: `q-${Date.now()}-${index}`,
        text: q.text,
        type: q.type || questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        hint: q.hint,
        difficulty: q.difficulty || difficulty,
      }));
      
      console.log(`Successfully generated ${questions.length} questions`);
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
