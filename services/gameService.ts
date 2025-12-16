import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Difficulty, Question } from '@/contexts/GameContext';

type RoomMetaRow = {
    room_code: string;
    phase: string;
    current_question_index: number;
    phase_started_at: string;
    final_mode: string;
    questions: unknown;
};

type BetRow = {
    room_code: string;
    question_index: number;
    player_id: string;
    bet_value: number;
};

type AnswerRow = {
    room_code: string;
    question_index: number;
    player_id: string;
    answer: string;
};

type ValidationRow = {
    room_code: string;
    question_index: number;
    player_id: string;
    is_correct: boolean;
};

type FinalChoiceRow = {
    room_code: string;
    player_id: string;
    wager: number;
    difficulty: string;
    mode: string;
};

type FinalQuestionRow = {
    room_code: string;
    player_id: string;
    question: unknown;
};

type FinalAnswerRow = {
    room_code: string;
    player_id: string;
    answer: string;
};

type FinalValidationRow = {
    room_code: string;
    player_id: string;
    is_correct: boolean;
};

function requireSupabase() {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error('SUPABASE_NOT_CONFIGURED');
    }
    return supabase;
}

export type GameMeta = {
    roomCode: string;
    phase: string;
    currentQuestionIndex: number;
    phaseStartedAt: string;
    finalMode: 'shared' | 'personalized';
    questions: Question[];
};

export async function fetchGameMeta(roomCode: string): Promise<GameMeta> {
    const client = requireSupabase();
    const normalized = roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_rooms')
        .select('room_code, phase, current_question_index, phase_started_at, final_mode, questions')
        .eq('room_code', normalized)
        .single();

    const missingColumn = (msg?: string) =>
        (msg || '').toLowerCase().includes('current_question_index') ||
        (msg || '').toLowerCase().includes('phase_started_at') ||
        (msg || '').toLowerCase().includes('final_mode') ||
        (msg || '').toLowerCase().includes('questions');

    if ((error && missingColumn(error.message)) || !data) {
        const { data: fallback, error: fallbackError } = await client
            .from('elbureau_rooms')
            .select('room_code, phase')
            .eq('room_code', normalized)
            .single();

        if (fallbackError || !fallback) {
            throw new Error(fallbackError?.message || 'ROOM_NOT_FOUND');
        }

        const row = fallback as any;
        return {
            roomCode: row.room_code,
            phase: row.phase,
            currentQuestionIndex: 0,
            phaseStartedAt: new Date().toISOString(),
            finalMode: 'shared',
            questions: [],
        };
    }

    if (error) {
        const msg = (error as any)?.message as string | undefined;
        throw new Error(msg || 'FAILED_TO_FETCH_GAME_META');
    }

    const row = data as unknown as RoomMetaRow;
    return {
        roomCode: row.room_code,
        phase: row.phase,
        currentQuestionIndex: row.current_question_index ?? 0,
        phaseStartedAt: row.phase_started_at,
        finalMode: (row.final_mode === 'personalized' ? 'personalized' : 'shared') as 'shared' | 'personalized',
        questions: (Array.isArray(row.questions) ? (row.questions as Question[]) : []) as Question[],
    };
}

export async function updateRoomMeta(args: {
    roomCode: string;
    patch: Partial<Pick<RoomMetaRow, 'phase' | 'current_question_index' | 'phase_started_at' | 'final_mode' | 'questions'>>;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const tryUpdate = async (patch: any) => client
        .from('elbureau_rooms')
        .update(patch)
        .eq('room_code', roomCode);

    let patch: any = { ...args.patch };
    let { error } = await tryUpdate(patch);

    if (error) {
        const msg = (error.message || '').toLowerCase();
        const maybeRemove = (key: keyof RoomMetaRow) => {
            if (key in patch) {
                const next = { ...patch };
                delete next[key];
                patch = next;
            }
        };

        // Backwards-compatible: older deployments may not have these columns yet.
        if (msg.includes('phase_started_at')) maybeRemove('phase_started_at');
        if (msg.includes('current_question_index')) maybeRemove('current_question_index');
        if (msg.includes('final_mode')) maybeRemove('final_mode');
        if (msg.includes('questions')) maybeRemove('questions');

        if (Object.keys(patch).length > 0) {
            ({ error } = await tryUpdate(patch));
        }
    }

    if (error) {
        throw new Error(error.message);
    }
}

export async function setRoomPhase(args: {
    roomCode: string;
    phase: string;
    phaseStartedAt?: string;
}): Promise<void> {
    await updateRoomMeta({
        roomCode: args.roomCode,
        patch: {
            phase: args.phase,
            phase_started_at: args.phaseStartedAt || new Date().toISOString(),
        },
    });
}

export async function setRoomPhaseIfCurrent(args: {
    roomCode: string;
    fromPhase: string;
    toPhase: string;
    phaseStartedAt?: string;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const patch: any = {
        phase: args.toPhase,
        phase_started_at: args.phaseStartedAt || new Date().toISOString(),
    };

    // Backwards-compatible: if the column doesn't exist yet, updateRoomMeta will handle stripping it.
    // But here we want the phase guard, so we keep the direct update and fall back on column removal.
    let { error } = await client
        .from('elbureau_rooms')
        .update(patch)
        .eq('room_code', roomCode)
        .eq('phase', args.fromPhase);

    if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('phase_started_at')) {
            delete patch.phase_started_at;
            ({ error } = await client
                .from('elbureau_rooms')
                .update(patch)
                .eq('room_code', roomCode)
                .eq('phase', args.fromPhase));
        }
    }

    if (error) {
        throw new Error(error.message);
    }
}

export async function submitBet(args: {
    roomCode: string;
    questionIndex: number;
    playerId: string;
    betValue: number;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_bets').upsert(
        {
            room_code: roomCode,
            question_index: args.questionIndex,
            player_id: args.playerId,
            bet_value: args.betValue,
        },
        { onConflict: 'room_code,question_index,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchBets(args: {
    roomCode: string;
    questionIndex: number;
}): Promise<BetRow[]> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_bets')
        .select('room_code, question_index, player_id, bet_value')
        .eq('room_code', roomCode)
        .eq('question_index', args.questionIndex);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as BetRow[];
}

export async function fetchPlayerBets(args: {
    roomCode: string;
    playerId: string;
}): Promise<BetRow[]> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_bets')
        .select('room_code, question_index, player_id, bet_value')
        .eq('room_code', roomCode)
        .eq('player_id', args.playerId);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as BetRow[];
}

export async function submitAnswer(args: {
    roomCode: string;
    questionIndex: number;
    playerId: string;
    answer: string;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_answers').upsert(
        {
            room_code: roomCode,
            question_index: args.questionIndex,
            player_id: args.playerId,
            answer: args.answer,
        },
        { onConflict: 'room_code,question_index,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchAnswers(args: {
    roomCode: string;
    questionIndex: number;
}): Promise<AnswerRow[]> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_answers')
        .select('room_code, question_index, player_id, answer')
        .eq('room_code', roomCode)
        .eq('question_index', args.questionIndex);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as AnswerRow[];
}

export async function upsertValidation(args: {
    roomCode: string;
    questionIndex: number;
    playerId: string;
    isCorrect: boolean;
    validatedBy?: string;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_validations').upsert(
        {
            room_code: roomCode,
            question_index: args.questionIndex,
            player_id: args.playerId,
            is_correct: args.isCorrect,
            validated_by: args.validatedBy ?? null,
            validated_at: new Date().toISOString(),
        },
        { onConflict: 'room_code,question_index,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchValidations(args: {
    roomCode: string;
    questionIndex: number;
}): Promise<ValidationRow[]> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_validations')
        .select('room_code, question_index, player_id, is_correct')
        .eq('room_code', roomCode)
        .eq('question_index', args.questionIndex);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as ValidationRow[];
}

export async function upsertFinalChoice(args: {
    roomCode: string;
    playerId: string;
    wager: number;
    difficulty: Difficulty;
    mode: 'shared' | 'personalized';
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_final_choices').upsert(
        {
            room_code: roomCode,
            player_id: args.playerId,
            wager: args.wager,
            difficulty: args.difficulty,
            mode: args.mode,
        },
        { onConflict: 'room_code,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchFinalChoices(roomCode: string): Promise<FinalChoiceRow[]> {
    const client = requireSupabase();
    const normalized = roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_final_choices')
        .select('room_code, player_id, wager, difficulty, mode')
        .eq('room_code', normalized);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as FinalChoiceRow[];
}

export async function upsertFinalQuestion(args: {
    roomCode: string;
    playerId: string;
    question: Question;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_final_questions').upsert(
        {
            room_code: roomCode,
            player_id: args.playerId,
            question: args.question,
        },
        { onConflict: 'room_code,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchFinalQuestion(args: {
    roomCode: string;
    playerId: string;
}): Promise<Question | null> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_final_questions')
        .select('room_code, player_id, question')
        .eq('room_code', roomCode)
        .eq('player_id', args.playerId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    const row = data as unknown as FinalQuestionRow | null;
    const q = row?.question;
    if (q && typeof q === 'object') {
        return q as Question;
    }
    return null;
}

export async function submitFinalAnswer(args: {
    roomCode: string;
    playerId: string;
    answer: string;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_final_answers').upsert(
        {
            room_code: roomCode,
            player_id: args.playerId,
            answer: args.answer,
        },
        { onConflict: 'room_code,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchFinalAnswers(roomCode: string): Promise<FinalAnswerRow[]> {
    const client = requireSupabase();
    const normalized = roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_final_answers')
        .select('room_code, player_id, answer')
        .eq('room_code', normalized);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as FinalAnswerRow[];
}

export async function upsertFinalValidation(args: {
    roomCode: string;
    playerId: string;
    isCorrect: boolean;
    validatedBy?: string;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client.from('elbureau_final_validations').upsert(
        {
            room_code: roomCode,
            player_id: args.playerId,
            is_correct: args.isCorrect,
            validated_by: args.validatedBy ?? null,
            validated_at: new Date().toISOString(),
        },
        { onConflict: 'room_code,player_id' }
    );

    if (error) {
        throw new Error(error.message);
    }
}

export async function fetchFinalValidations(roomCode: string): Promise<FinalValidationRow[]> {
    const client = requireSupabase();
    const normalized = roomCode.toUpperCase();

    const { data, error } = await client
        .from('elbureau_final_validations')
        .select('room_code, player_id, is_correct')
        .eq('room_code', normalized);

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as unknown as FinalValidationRow[];
}

export async function resetGameplayForRoom(args: {
    roomCode: string;
    keepQuestions?: boolean;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const deletionQueries = [
        client.from('elbureau_bets').delete().eq('room_code', roomCode),
        client.from('elbureau_answers').delete().eq('room_code', roomCode),
        client.from('elbureau_validations').delete().eq('room_code', roomCode),
        client.from('elbureau_final_choices').delete().eq('room_code', roomCode),
        client.from('elbureau_final_questions').delete().eq('room_code', roomCode),
        client.from('elbureau_final_answers').delete().eq('room_code', roomCode),
        client.from('elbureau_final_validations').delete().eq('room_code', roomCode),
    ];

    for (const q of deletionQueries) {
        const res: any = await q;
        if (res?.error) {
            const msg = String(res.error.message || '').toLowerCase();
            const missingTable = msg.includes('does not exist') || msg.includes('42p01');
            if (missingTable) {
                continue;
            }
            throw new Error(res.error.message || 'Failed to reset gameplay');
        }
    }

    const patch: any = {
        phase: 'question',
        current_question_index: 0,
        phase_started_at: new Date().toISOString(),
        final_mode: 'shared',
    };
    if (!args.keepQuestions) {
        patch.questions = [];
    }

    const stripMissingColumns = (msg: string) => {
        let changed = false;
        if (msg.includes('phase_started_at') && 'phase_started_at' in patch) {
            delete patch.phase_started_at;
            changed = true;
        }
        if (msg.includes('final_mode') && 'final_mode' in patch) {
            delete patch.final_mode;
            changed = true;
        }
        if (msg.includes('current_question_index') && 'current_question_index' in patch) {
            delete patch.current_question_index;
            changed = true;
        }
        if (msg.includes('questions') && 'questions' in patch) {
            delete patch.questions;
            changed = true;
        }
        return changed;
    };

    let { error: resetRoomError } = await client
        .from('elbureau_rooms')
        .update(patch)
        .eq('room_code', roomCode);

    for (let attempt = 0; resetRoomError && attempt < 4; attempt++) {
        const msg = String(resetRoomError.message || '').toLowerCase();
        if (!stripMissingColumns(msg)) break;
        ({ error: resetRoomError } = await client
            .from('elbureau_rooms')
            .update(patch)
            .eq('room_code', roomCode));
    }

    if (resetRoomError) {
        throw new Error(resetRoomError.message);
    }
}

export function subscribeToGame(args: {
    roomCode: string;
    onChange: () => void;
}): { unsubscribe: () => void } {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const channel = client
        .channel(`db-game:${roomCode}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_rooms', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_room_players', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_bets', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_answers', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_validations', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_final_choices', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_final_questions', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_final_answers', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_final_validations', filter: `room_code=eq.${roomCode}` },
            () => args.onChange()
        )
        .subscribe();

    return {
        unsubscribe: () => {
            client.removeChannel(channel);
        },
    };
}
