// Confirming a future plan is not the same as having visited the destination.
export const visitedPlaces = places => places.filter(p => !p.id.startsWith('planned-'));
export const countVisitedPlaces = places => visitedPlaces(places).length;
export const countVisitedCountries = places => new Set(visitedPlaces(places).map(p=>p.country.trim().toLowerCase()).filter(Boolean)).size;
