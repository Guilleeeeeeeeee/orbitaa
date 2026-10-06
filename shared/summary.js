// Confirming a future plan is not the same as having visited the destination.
export const countVisitedPlaces = places => places.filter(p => !p.id.startsWith('planned-')).length;
