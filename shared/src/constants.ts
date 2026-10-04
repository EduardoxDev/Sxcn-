export const APP_NAME = 'Scxn';
export const APP_VERSION = '1.0.0';

/**
 * Room-code alphabet. Visually ambiguous glyphs are removed: 0/O, 1/I/L.
 * 31 symbols, 8 characters → ~8.5e11 combinations.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_GROUP = 4;
export const ROOM_CODE_LENGTH = ROOM_CODE_GROUP * 2;

export const NAME_MAX_LENGTH = 24;
export const DEFAULT_MAX_PARTICIPANTS = 8;
/** Hard ceiling — a P2P mesh does not scale past this for screen video. */
export const ABSOLUTE_MAX_PARTICIPANTS = 12;

/** Upper bounds for relayed signaling payloads. */
export const MAX_SDP_LENGTH = 32_000;
export const MAX_CANDIDATE_LENGTH = 1_024;
