// Configuration constants

export const ROAD_SPEED = {
    "motorway": 85,
    "trunk": 70,
    "primary": 45,
    "secondary": 35,
    "tertiary": 30,
    "residential": 20,
    "service": 15,
    "unclassified": 25,
    "living_street": 10,
};

export const POPULAR_AMENITY = new Set([
    "restaurant", "cafe", "fast_food", "university", "hospital",
    "clinic", "bank", "atm", "place_of_worship", "mosque", "pharmacy",
]);

export const POPULAR_SHOP = new Set([
    "supermarket", "mall", "convenience", "clothes", "electronics", "bakery",
]);

export const POPULAR_LEISURE = new Set(["park", "playground"]);
export const POPULAR_TOURISM = new Set(["attraction", "museum"]);

export const PRESET_REGIONS = {
    "1": { name: "Al Khobar (Full City)",     bbox: [26.17, 50.13, 26.38, 50.28] },
    "2": { name: "Dammam (Full City)",        bbox: [26.35, 49.95, 26.55, 50.15] },
    "3": { name: "Dhahran (Full City)",       bbox: [26.24, 50.08, 26.35, 50.18] },
    "4": { name: "Eastern Province Coast",    bbox: [26.15, 50.05, 26.55, 50.30] },
    "5": { name: "Riyadh (Full City)",        bbox: [24.55, 46.55, 24.90, 46.90] },
    "6": { name: "Jeddah (Full City)",        bbox: [21.40, 39.10, 21.75, 39.30] },
    "7": { name: "Khobar Corniche (Small)",   bbox: [26.27, 50.20, 26.31, 50.24] },
    "8": { name: "Dammam Downtown (Small)",   bbox: [26.41, 50.07, 26.45, 50.12] },
    "9": { name: "Riyadh Center (Small)",     bbox: [24.68, 46.64, 24.74, 46.72] },
};
