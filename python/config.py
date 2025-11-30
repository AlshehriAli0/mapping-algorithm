"""Configuration constants for the route planner."""

from collections import namedtuple

# Named tuple for places
Place = namedtuple("Place", ["id", "name", "category", "lat", "lon", "nearest_node", "street"])

# Realistic average speeds (km/h) - accounting for traffic, lights, acceleration/deceleration
ROAD_SPEED = {
    "motorway": 85,
    "trunk": 70,
    "primary": 45,
    "secondary": 35,
    "tertiary": 30,
    "residential": 20,
    "service": 15,
    "unclassified": 25,
    "living_street": 10,
}

# Intersection delay in minutes (~9 seconds average per intersection)
INTERSECTION_DELAY = 0.15

# Popular place categories to extract from OSM
POPULAR_AMENITY = {
    "restaurant", "cafe", "fast_food", "university", "hospital",
    "clinic", "bank", "atm", "place_of_worship", "mosque", "pharmacy",
}
POPULAR_SHOP = {
    "supermarket", "mall", "convenience", "clothes", "electronics", "bakery",
}
POPULAR_LEISURE = {"park", "playground"}
POPULAR_TOURISM = {"attraction", "museum"}

# Preset regions for quick selection
PRESET_REGIONS = {
    "1": ("Al Khobar (Full City)",     (26.17, 50.13, 26.38, 50.28)),
    "2": ("Dammam (Full City)",        (26.35, 49.95, 26.55, 50.15)),
    "3": ("Dhahran (Full City)",       (26.24, 50.08, 26.35, 50.18)),
    "4": ("Eastern Province Coast",    (26.15, 50.05, 26.55, 50.30)),
    "5": ("Riyadh (Full City)",        (24.55, 46.55, 24.90, 46.90)),
    "6": ("Jeddah (Full City)",        (21.40, 39.10, 21.75, 39.30)),
    "7": ("Khobar Corniche (Small)",   (26.27, 50.20, 26.31, 50.24)),
    "8": ("Dammam Downtown (Small)",   (26.41, 50.07, 26.45, 50.12)),
    "9": ("Riyadh Center (Small)",     (24.68, 46.64, 24.74, 46.72)),
}

# HTTP headers for API requests
USER_AGENT = {"User-Agent": "AlgoRoutingStudentProject/1.0 (contact: example@example.com)"}

