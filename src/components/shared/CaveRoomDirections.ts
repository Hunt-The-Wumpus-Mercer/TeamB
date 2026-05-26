
// define cave room directions that a user can navigate or shoot
export const CaveRoomDirections = {
    NORTH: 'north',
    NORTHEAST: 'northeast',
    SOUTHEAST: 'southeast',
    SOUTH: 'south',
    SOUTHWEST: 'southwest',
    NORTHWEST: 'northwest'
};

export type CaveRoomDirections = typeof CaveRoomDirections[keyof typeof CaveRoomDirections];