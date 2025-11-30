// Routing algorithms and URL generation

import { MinHeap } from './utils.js';
import { haversine } from './geo.js';

/**
 * Algorithm definitions with complexity information
 */
export const ALGORITHMS = [
    {
        name: "Dijkstra",
        func: dijkstra,
        timeComplexity: "O((V + E) log V)",
        spaceComplexity: "O(V)",
        description: "Classic shortest path. Explores all directions equally until target found."
    },
    {
        name: "A* (A-Star)",
        func: astar,
        timeComplexity: "O((V + E) log V)*",
        spaceComplexity: "O(V)",
        description: "Heuristic-guided search. Uses straight-line distance to prioritize promising paths."
    },
    {
        name: "Bidirectional Dijkstra",
        func: bidirectionalDijkstra,
        timeComplexity: "O((V + E) log V)",
        spaceComplexity: "O(V)",
        description: "Searches from both ends simultaneously, meeting in the middle."
    }
];

/**
 * Dijkstra's algorithm for shortest path
 * @param {Map} graph - Adjacency list graph
 * @param {string} start - Start node ID
 * @param {string} target - Target node ID
 * @param {Map} nodeCoords - Node coordinates (not used, kept for consistent interface)
 * @returns {{ path: Array | null, travelTime: number | null, nodesExplored: number }}
 */
export function dijkstra(graph, start, target, nodeCoords = null) {
    const dist = new Map([[start, 0]]);
    const parent = new Map([[start, null]]);
    const pq = new MinHeap();
    pq.push([0, start]);
    let nodesExplored = 0;

    while (pq.size() > 0) {
        const [curT, u] = pq.pop();
        nodesExplored++;
        
        if (u === target) {
            break;
        }
        
        if (curT > (dist.get(u) ?? Infinity)) {
            continue;
        }

        const neighbors = graph.get(u) || [];
        for (const [v, w] of neighbors) {
            const nt = curT + w;
            if (nt < (dist.get(v) ?? Infinity)) {
                dist.set(v, nt);
                parent.set(v, u);
                pq.push([nt, v]);
            }
        }
    }

    if (!dist.has(target)) {
        return { path: null, travelTime: null, nodesExplored };
    }

    const path = reconstructPath(parent, target);
    return { path, travelTime: dist.get(target), nodesExplored };
}

/**
 * A* algorithm with haversine heuristic
 * @param {Map} graph - Adjacency list graph
 * @param {string} start - Start node ID
 * @param {string} target - Target node ID
 * @param {Map} nodeCoords - Node coordinates map
 * @returns {{ path: Array | null, travelTime: number | null, nodesExplored: number }}
 */
export function astar(graph, start, target, nodeCoords) {
    if (!nodeCoords.has(target) || !nodeCoords.has(start)) {
        return { path: null, travelTime: null, nodesExplored: 0 };
    }

    const [targetLat, targetLon] = nodeCoords.get(target);
    
    // Heuristic: estimate time using straight-line distance at 60 km/h
    const heuristic = (node) => {
        if (!nodeCoords.has(node)) return 0;
        const [lat, lon] = nodeCoords.get(node);
        const distKm = haversine(lat, lon, targetLat, targetLon);
        return distKm / (60 / 60.0); // Convert to minutes
    };

    const gScore = new Map([[start, 0]]);
    const fScore = new Map([[start, heuristic(start)]]);
    const parent = new Map([[start, null]]);
    const pq = new MinHeap();
    pq.push([fScore.get(start), 0, start]);
    let nodesExplored = 0;

    while (pq.size() > 0) {
        const [_, curG, u] = pq.pop();
        nodesExplored++;

        if (u === target) {
            break;
        }

        if (curG > (gScore.get(u) ?? Infinity)) {
            continue;
        }

        const neighbors = graph.get(u) || [];
        for (const [v, w] of neighbors) {
            const tentativeG = gScore.get(u) + w;
            if (tentativeG < (gScore.get(v) ?? Infinity)) {
                gScore.set(v, tentativeG);
                const f = tentativeG + heuristic(v);
                fScore.set(v, f);
                parent.set(v, u);
                pq.push([f, tentativeG, v]);
            }
        }
    }

    if (!gScore.has(target)) {
        return { path: null, travelTime: null, nodesExplored };
    }

    const path = reconstructPath(parent, target);
    return { path, travelTime: gScore.get(target), nodesExplored };
}

/**
 * Bidirectional Dijkstra's algorithm
 * @param {Map} graph - Adjacency list graph
 * @param {string} start - Start node ID
 * @param {string} target - Target node ID
 * @param {Map} nodeCoords - Node coordinates (not used)
 * @returns {{ path: Array | null, travelTime: number | null, nodesExplored: number }}
 */
export function bidirectionalDijkstra(graph, start, target, nodeCoords = null) {
    // Build reverse graph
    const reverseGraph = new Map();
    for (const [u, neighbors] of graph) {
        for (const [v, w] of neighbors) {
            if (!reverseGraph.has(v)) {
                reverseGraph.set(v, []);
            }
            reverseGraph.get(v).push([u, w]);
        }
    }

    // Forward search from start
    const distF = new Map([[start, 0]]);
    const parentF = new Map([[start, null]]);
    const pqF = new MinHeap();
    pqF.push([0, start]);

    // Backward search from target
    const distB = new Map([[target, 0]]);
    const parentB = new Map([[target, null]]);
    const pqB = new MinHeap();
    pqB.push([0, target]);

    let bestPathCost = Infinity;
    let meetingNode = null;
    let nodesExplored = 0;

    const settledF = new Set();
    const settledB = new Set();

    while (pqF.size() > 0 || pqB.size() > 0) {
        // Expand forward
        if (pqF.size() > 0) {
            const [curT, u] = pqF.pop();
            nodesExplored++;

            if (curT <= (distF.get(u) ?? Infinity)) {
                settledF.add(u);

                // Check if we found a better path through this node
                if (distB.has(u)) {
                    const pathCost = distF.get(u) + distB.get(u);
                    if (pathCost < bestPathCost) {
                        bestPathCost = pathCost;
                        meetingNode = u;
                    }
                }

                const neighbors = graph.get(u) || [];
                for (const [v, w] of neighbors) {
                    const nt = curT + w;
                    if (nt < (distF.get(v) ?? Infinity)) {
                        distF.set(v, nt);
                        parentF.set(v, u);
                        pqF.push([nt, v]);
                    }
                }
            }
        }

        // Expand backward
        if (pqB.size() > 0) {
            const [curT, u] = pqB.pop();
            nodesExplored++;

            if (curT <= (distB.get(u) ?? Infinity)) {
                settledB.add(u);

                // Check if we found a better path through this node
                if (distF.has(u)) {
                    const pathCost = distF.get(u) + distB.get(u);
                    if (pathCost < bestPathCost) {
                        bestPathCost = pathCost;
                        meetingNode = u;
                    }
                }

                const neighbors = reverseGraph.get(u) || [];
                for (const [v, w] of neighbors) {
                    const nt = curT + w;
                    if (nt < (distB.get(v) ?? Infinity)) {
                        distB.set(v, nt);
                        parentB.set(v, u);
                        pqB.push([nt, v]);
                    }
                }
            }
        }

        // Termination: if min in both queues exceeds best found path
        const minF = pqF.size() > 0 ? pqF.heap[0][0] : Infinity;
        const minB = pqB.size() > 0 ? pqB.heap[0][0] : Infinity;
        if (minF + minB >= bestPathCost) {
            break;
        }
    }

    if (meetingNode === null) {
        return { path: null, travelTime: null, nodesExplored };
    }

    // Reconstruct path: start -> meetingNode -> target
    const pathToMeeting = reconstructPath(parentF, meetingNode);
    const pathFromMeeting = reconstructPath(parentB, meetingNode);
    pathFromMeeting.reverse();

    // Combine paths (meeting node appears in both, so skip duplicate)
    const fullPath = pathToMeeting.concat(pathFromMeeting.slice(1));

    return { path: fullPath, travelTime: bestPathCost, nodesExplored };
}

/**
 * Reconstruct path from parent pointers
 * @param {Map} parent - Parent map
 * @param {string} target - Target node
 * @returns {Array} Path from start to target
 */
function reconstructPath(parent, target) {
    const path = [];
    let cur = target;
    while (cur !== null) {
        path.push(cur);
        cur = parent.get(cur);
    }
    path.reverse();
    return path;
}

/**
 * Run an algorithm and measure execution time
 * @param {object} algo - Algorithm definition
 * @param {Map} graph - Graph
 * @param {string} start - Start node
 * @param {string} target - Target node
 * @param {Map} nodeCoords - Node coordinates
 * @returns {object} Results
 */
export function runAlgorithm(algo, graph, start, target, nodeCoords) {
    const startTime = performance.now();
    const { path, travelTime, nodesExplored } = algo.func(graph, start, target, nodeCoords);
    const execTime = performance.now() - startTime;

    return {
        name: algo.name,
        path,
        travelTime,
        nodesExplored,
        execTimeMs: execTime,
        timeComplexity: algo.timeComplexity,
        spaceComplexity: algo.spaceComplexity,
        description: algo.description,
        pathLength: path ? path.length : 0,
        gmapsUrl: path ? buildGoogleMapsUrl(path, nodeCoords) : null
    };
}

/**
 * Build a Google Maps directions URL from a path
 * @param {Array} path - Array of node IDs
 * @param {Map} nodeCoords - Node coordinates
 * @returns {string | null} Google Maps URL or null
 */
export function buildGoogleMapsUrl(path, nodeCoords) {
    if (!path || path.length < 2) {
        return null;
    }

    const coords = path
        .filter(nid => nodeCoords.has(nid))
        .map(nid => nodeCoords.get(nid));

    if (coords.length < 2) {
        return null;
    }

    const origin = coords[0];
    const dest = coords[coords.length - 1];
    const waypoints = coords.slice(1, -1);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${dest[0]},${dest[1]}`;

    if (waypoints.length > 0) {
        // Google Maps limits waypoints, take first 10
        const subset = waypoints.slice(0, 10);
        const wpStr = subset.map(([lat, lon]) => `${lat},${lon}`).join('|');
        url += `&waypoints=${wpStr}`;
    }

    return url;
}

/**
 * Build a static map embed URL (using OpenStreetMap)
 * @param {Array} path - Array of node IDs  
 * @param {Map} nodeCoords - Node coordinates
 * @returns {string | null} Embed URL or null
 */
export function buildMapEmbedUrl(path, nodeCoords) {
    if (!path || path.length < 2) {
        return null;
    }

    const coords = path
        .filter(nid => nodeCoords.has(nid))
        .map(nid => nodeCoords.get(nid));

    if (coords.length < 2) {
        return null;
    }

    // Calculate center and bounds
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    for (const [lat, lon] of coords) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Use OpenStreetMap embed
    const bbox = `${minLon - 0.01},${minLat - 0.01},${maxLon + 0.01},${maxLat + 0.01}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centerLat},${centerLon}`;
}
