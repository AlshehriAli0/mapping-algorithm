// Graph building and place mapping from OSM data

import { haversine } from './geo.js';
import { 
    ROAD_SPEED, 
    POPULAR_AMENITY, 
    POPULAR_SHOP, 
    POPULAR_LEISURE, 
    POPULAR_TOURISM 
} from './config.js';

/**
 * Place object representing a named location
 * @typedef {Object} Place
 * @property {string} id - OSM node ID
 * @property {string} name - Place name
 * @property {string} category - Place category
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {string | null} nearestNode - Nearest road node ID
 * @property {string} street - Street/location info
 */

/**
 * Parse Overpass JSON into nodes, edges, and named places
 * @param {object} data - Overpass JSON response
 * @param {function} onProgress - Progress callback
 * @returns {{ nodeCoords: Map, edges: Array, placesRaw: Array }}
 */
export function parseOverpassToGraph(data, onProgress = null) {
    if (!data || !data.elements) {
        return { nodeCoords: new Map(), edges: [], placesRaw: [] };
    }

    const elements = data.elements;
    
    // Extract node coordinates
    if (onProgress) onProgress('Extracting node coordinates...');
    const nodeCoords = new Map();
    for (const el of elements) {
        if (el.type === 'node') {
            nodeCoords.set(String(el.id), [el.lat, el.lon]);
        }
    }

    const edges = [];
    const placesRaw = [];

    if (onProgress) onProgress('Processing ways and places...');
    
    for (const el of elements) {
        if (el.type === 'way') {
            const wayEdges = processWay(el, nodeCoords);
            edges.push(...wayEdges);
        } else if (el.type === 'node') {
            const place = extractPlace(el, nodeCoords);
            if (place) {
                placesRaw.push(place);
            }
        }
    }

    return { nodeCoords, edges, placesRaw };
}

/**
 * Process a single way element into edges
 * @param {object} el - Way element
 * @param {Map} nodeCoords - Node coordinates map
 * @returns {Array} Array of edges [u, v, time]
 */
function processWay(el, nodeCoords) {
    const tags = el.tags || {};
    const highway = tags.highway;
    
    if (!highway || !(highway in ROAD_SPEED)) {
        return [];
    }

    const oneway = tags.oneway || 'no';
    const speed = ROAD_SPEED[highway] || 40;
    const nodes = (el.nodes || []).map(String);
    const edges = [];

    for (let i = 0; i < nodes.length - 1; i++) {
        const u = nodes[i];
        const v = nodes[i + 1];
        
        if (!nodeCoords.has(u) || !nodeCoords.has(v)) {
            continue;
        }

        const [lat1, lon1] = nodeCoords.get(u);
        const [lat2, lon2] = nodeCoords.get(v);
        const distKm = haversine(lat1, lon1, lat2, lon2);
        const timeMin = distKm / (speed / 60.0);

        if (oneway === 'yes') {
            edges.push([u, v, timeMin]);
        } else if (oneway === '-1') {
            edges.push([v, u, timeMin]);
        } else {
            edges.push([u, v, timeMin]);
            edges.push([v, u, timeMin]);
        }
    }

    return edges;
}

/**
 * Extract place info from a node if it's a popular category
 * @param {object} el - Node element
 * @param {Map} nodeCoords - Node coordinates map
 * @returns {object | null} Place info or null
 */
function extractPlace(el, nodeCoords) {
    const nid = String(el.id);
    const tags = el.tags || {};
    const name = tags.name;
    
    if (!name) {
        return null;
    }

    let category = null;
    if (tags.amenity && POPULAR_AMENITY.has(tags.amenity)) {
        category = tags.amenity;
    } else if (tags.shop && POPULAR_SHOP.has(tags.shop)) {
        category = `shop:${tags.shop}`;
    } else if (tags.leisure && POPULAR_LEISURE.has(tags.leisure)) {
        category = tags.leisure;
    } else if (tags.tourism && POPULAR_TOURISM.has(tags.tourism)) {
        category = tags.tourism;
    }

    if (category && nodeCoords.has(nid)) {
        const [lat, lon] = nodeCoords.get(nid);
        const location = 
            tags['addr:street'] ||
            tags['addr:district'] ||
            tags['addr:suburb'] ||
            tags['addr:neighbourhood'] ||
            tags['addr:neighborhood'] ||
            tags['addr:city'] ||
            '';
        
        return {
            id: nid,
            name,
            category,
            lat,
            lon,
            nearestNode: null,
            street: location
        };
    }
    
    return null;
}

/**
 * Build adjacency list graph from edges
 * @param {Array} edges - Array of edges [u, v, time]
 * @returns {Map} Adjacency list graph
 */
export function buildGraph(edges) {
    const graph = new Map();
    
    for (const [u, v, t] of edges) {
        if (!graph.has(u)) {
            graph.set(u, []);
        }
        graph.get(u).push([v, t]);
    }
    
    return graph;
}

/**
 * Map places to nearest road nodes
 * @param {Array} placesRaw - Raw places array
 * @param {Set} graphNodes - Set of graph node IDs
 * @param {Map} nodeCoords - Node coordinates map
 * @param {function} onProgress - Progress callback
 * @returns {Array} Array of Place objects with nearestNode set
 */
export function mapPlacesToNearestNodes(placesRaw, graphNodes, nodeCoords, onProgress = null) {
    const graphList = Array.from(graphNodes);
    
    if (graphList.length === 0) {
        return [];
    }

    const mapped = [];
    const total = placesRaw.length;

    for (let i = 0; i < placesRaw.length; i++) {
        const place = placesRaw[i];
        
        if (onProgress && i % 50 === 0) {
            onProgress(`Mapping places... ${Math.round((i / total) * 100)}%`);
        }

        let bestNode = null;
        let bestDist = Infinity;

        for (const nid of graphList) {
            const [nlat, nlon] = nodeCoords.get(nid);
            const d = haversine(place.lat, place.lon, nlat, nlon);
            if (d < bestDist) {
                bestDist = d;
                bestNode = nid;
            }
        }

        mapped.push({
            ...place,
            nearestNode: bestNode
        });
    }

    return mapped;
}

/**
 * Group places by category
 * @param {Array} places - Array of Place objects
 * @returns {Map} Map of category -> places array
 */
export function groupPlacesByCategory(places) {
    const categories = new Map();
    
    for (const place of places) {
        if (!categories.has(place.category)) {
            categories.set(place.category, []);
        }
        categories.get(place.category).push(place);
    }
    
    return categories;
}
