import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { GameSettings, Player } from '@/contexts/GameContext';

type RoomRow = {
    room_code: string;
    host_player_id: string;
    settings: GameSettings;
    phase: string;
};

type RoomPlayerRow = {
    room_code: string;
    player_id: string;
    name: string;
    score: number;
    is_host: boolean;
    is_ready: boolean;
    has_api_key: boolean;
    used_bets: number[];
    avatar: string | null;
};

export type RoomState = {
    room: RoomRow;
    players: Player[];
};

function requireSupabase() {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error('SUPABASE_NOT_CONFIGURED');
    }
    return supabase;
}

function toPlayer(row: RoomPlayerRow): Player {
    return {
        id: row.player_id,
        name: row.name,
        score: row.score,
        isHost: row.is_host,
        isReady: row.is_ready,
        usedBets: row.used_bets || [],
        hasApiKey: row.has_api_key,
        avatar: row.avatar || undefined,
    };
}

export async function fetchRoomState(roomCode: string): Promise<RoomState> {
    const client = requireSupabase();
    const normalized = roomCode.toUpperCase();

    const { data: room, error: roomError } = await client
        .from('elbureau_rooms')
        .select('room_code, host_player_id, settings, phase')
        .eq('room_code', normalized)
        .single();

    if (roomError || !room) {
        throw new Error(roomError?.message || 'ROOM_NOT_FOUND');
    }

    const { data: playerRows, error: playersError } = await client
        .from('elbureau_room_players')
        .select('room_code, player_id, name, score, is_host, is_ready, has_api_key, used_bets, avatar')
        .eq('room_code', normalized);

    if (playersError) {
        throw new Error(playersError.message);
    }

    const players = (playerRows || [])
        .map((r) => toPlayer(r as RoomPlayerRow))
        .sort((a, b) => (a.isHost === b.isHost ? 0 : a.isHost ? -1 : 1));

    return { room: room as RoomRow, players };
}

export async function createRoom(args: {
    roomCode: string;
    hostPlayer: Player;
    settings: GameSettings;
}): Promise<RoomState> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error: insertRoomError } = await client.from('elbureau_rooms').insert({
        room_code: roomCode,
        host_player_id: args.hostPlayer.id,
        settings: args.settings,
        phase: 'lobby',
    });

    if (insertRoomError) {
        throw new Error(insertRoomError.message);
    }

    const { error: insertHostError } = await client.from('elbureau_room_players').upsert({
        room_code: roomCode,
        player_id: args.hostPlayer.id,
        name: args.hostPlayer.name,
        score: args.hostPlayer.score,
        is_host: true,
        is_ready: args.hostPlayer.isReady,
        has_api_key: args.hostPlayer.hasApiKey,
        used_bets: args.hostPlayer.usedBets || [],
        avatar: args.hostPlayer.avatar ?? null,
    }, { onConflict: 'room_code,player_id' });

    if (insertHostError) {
        throw new Error(insertHostError.message);
    }

    return fetchRoomState(roomCode);
}

export async function leaveRoom(args: {
    roomCode: string;
    playerId: string;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client
        .from('elbureau_room_players')
        .delete()
        .eq('room_code', roomCode)
        .eq('player_id', args.playerId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function joinRoom(args: {
    roomCode: string;
    player: Player;
}): Promise<RoomState> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { data: room, error: roomError } = await client
        .from('elbureau_rooms')
        .select('room_code, host_player_id')
        .eq('room_code', roomCode)
        .single();

    if (roomError || !room) {
        throw new Error('ROOM_NOT_FOUND');
    }

    const isHost = (room as any)?.host_player_id === args.player.id;

    const { error: insertPlayerError } = await client.from('elbureau_room_players').upsert({
        room_code: roomCode,
        player_id: args.player.id,
        name: args.player.name,
        score: args.player.score,
        is_host: isHost,
        is_ready: args.player.isReady,
        has_api_key: args.player.hasApiKey,
        used_bets: args.player.usedBets || [],
        avatar: args.player.avatar ?? null,
    }, { onConflict: 'room_code,player_id' });

    if (insertPlayerError) {
        throw new Error(insertPlayerError.message);
    }

    return fetchRoomState(roomCode);
}

export async function updatePlayerState(args: {
    roomCode: string;
    playerId: string;
    patch: Partial<Pick<RoomPlayerRow, 'is_ready' | 'score' | 'used_bets' | 'name' | 'has_api_key' | 'avatar'>>;
}): Promise<void> {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const { error } = await client
        .from('elbureau_room_players')
        .update(args.patch)
        .eq('room_code', roomCode)
        .eq('player_id', args.playerId);

    if (error) {
        throw new Error(error.message);
    }
}

export function subscribeToRoom(args: {
    roomCode: string;
    onRoomChange: () => void;
}): { unsubscribe: () => void } {
    const client = requireSupabase();
    const roomCode = args.roomCode.toUpperCase();

    const channel = client
        .channel(`db-room:${roomCode}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_rooms', filter: `room_code=eq.${roomCode}` },
            () => args.onRoomChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'elbureau_room_players', filter: `room_code=eq.${roomCode}` },
            () => args.onRoomChange()
        )
        .subscribe();

    return {
        unsubscribe: () => {
            client.removeChannel(channel);
        },
    };
}
