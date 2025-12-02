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
        spaceNote: "High",
        description: "Classic shortest path. Explores all directions equally — visits many nodes, high memory."
    },
    {
        name: "A* (A-Star)",
        func: astar,
        timeComplexity: "O((V + E) log V)*",
        spaceComplexity: "O(V)*",
        spaceNote: "Medium",
        description: "Heuristic-guided. Explores fewer nodes than Dijkstra — lower memory in practice."
    },
    {
        name: "Bidirectional Dijkstra",
        func: bidirectionalDijkstra,
        timeComplexity: "O((V + E) log V)",
        spaceComplexity: "O(V + E)",
        spaceNote: "Highest",
        description: "Dual search from both ends. Needs reverse graph — highest memory overhead."
    }
];

/**
 * Dijkstra's algorithm - explores equally in all directions like water spreading
 */
export function dijkstra(graph, start, target, nodeCoords = null) {
    // dist: shortest known distance to each node
    // parent: tracks the path (who did we come from?)
    const dist = new Map([[start, 0]]);
    const parent = new Map([[start, null]]);
    
    // Priority queue: always process the closest node first
    const pq = new MinHeap();
    pq.push([0, start]); // [distance, nodeId]
    
    let nodesExplored = 0;
    const visitedOrder = [];
    let maxPqSize = 1;

    while (pq.size() > 0) {
        // Get the unvisited node with smallest distance
        const [curT, u] = pq.pop();

        // Skip if we already found a better path to this node
        if (curT > (dist.get(u) ?? Infinity)) {
            continue;
        }

        nodesExplored++;
        visitedOrder.push({ id: u, parent: parent.get(u) });

        // Found the target! Stop searching
        if (u === target) {
            break;
        }

        // Check all neighbors and update their distances
        const neighbors = graph.get(u) || [];
        for (const [v, w] of neighbors) { // v = neighbor, w = edge weight
            const nt = curT + w; // new potential distance
            
            // Found a shorter path to neighbor? Update it
            if (nt < (dist.get(v) ?? Infinity)) {
                dist.set(v, nt);
                parent.set(v, u);
                pq.push([nt, v]);
                maxPqSize = Math.max(maxPqSize, pq.size());
            }
        }
    }

    const estimatedMemoryKB = ((dist.size * 100) + (parent.size * 100) + (maxPqSize * 50)) / 1024;

    // No path found
    if (!dist.has(target)) {
        return { path: null, travelTime: null, nodesExplored, visitedOrder, estimatedMemoryKB };
    }

    // Walk backwards through parents to build the path
    const path = reconstructPath(parent, target);
    return { path, travelTime: dist.get(target), nodesExplored, visitedOrder, estimatedMemoryKB };
}

/**
 * A* algorithm - like Dijkstra but guided toward the target using a heuristic
 */
export function astar(graph, start, target, nodeCoords) {
    if (!nodeCoords.has(target) || !nodeCoords.has(start)) {
        return { path: null, travelTime: null, nodesExplored: 0, visitedOrder: [], estimatedMemoryKB: 0 };
    }

    const [targetLat, targetLon] = nodeCoords.get(target);
    
    // Heuristic: "how far do I think I am from the target?"
    // Uses straight-line distance, converted to travel time at 60 km/h
    const heuristic = (node) => {
        if (!nodeCoords.has(node)) return 0;
        const [lat, lon] = nodeCoords.get(node);
        const distKm = haversine(lat, lon, targetLat, targetLon);
        return distKm / (60 / 60.0); // km to minutes
    };

    // gScore: actual cost from start to this node
    // fScore: gScore + heuristic (total estimated cost to target)
    const gScore = new Map([[start, 0]]);
    const fScore = new Map([[start, heuristic(start)]]);
    const parent = new Map([[start, null]]);
    
    // Priority queue sorted by fScore (lower = more promising)
    const pq = new MinHeap();
    pq.push([fScore.get(start), 0, start]); // [fScore, gScore, nodeId]
    
    let nodesExplored = 0;
    const visitedOrder = [];
    let maxPqSize = 1;

    while (pq.size() > 0) {
        // Get node with lowest f-score (most promising)
        const [_, curG, u] = pq.pop();

        // Skip outdated entries
        if (curG > (gScore.get(u) ?? Infinity)) {
            continue;
        }

        nodesExplored++;
        visitedOrder.push({ id: u, parent: parent.get(u) });

        // Found target!
        if (u === target) {
            break;
        }

        // Explore neighbors
        const neighbors = graph.get(u) || [];
        for (const [v, w] of neighbors) {
            const tentativeG = gScore.get(u) + w; // actual cost to neighbor
            
            // Found better path to neighbor?
            if (tentativeG < (gScore.get(v) ?? Infinity)) {
                gScore.set(v, tentativeG);
                const f = tentativeG + heuristic(v); // actual + estimated remaining
                fScore.set(v, f);
                parent.set(v, u);
                pq.push([f, tentativeG, v]);
                maxPqSize = Math.max(maxPqSize, pq.size());
            }
        }
    }

    const estimatedMemoryKB = ((gScore.size * 100) + (fScore.size * 100) + (parent.size * 100) + (maxPqSize * 70)) / 1024;

    if (!gScore.has(target)) {
        return { path: null, travelTime: null, nodesExplored, visitedOrder, estimatedMemoryKB };
    }

    const path = reconstructPath(parent, target);
    return { path, travelTime: gScore.get(target), nodesExplored, visitedOrder, estimatedMemoryKB };
}

/**
 * Bidirectional Dijkstra - searches from BOTH ends and meets in the middle
 */
export function bidirectionalDijkstra(graph, start, target, nodeCoords = null) {
    // Build reverse graph (flip all edges: A→B becomes B→A)
    // Needed so backward search can follow edges "backwards"
    const reverseGraph = new Map();
    let reverseGraphEdges = 0;
    for (const [u, neighbors] of graph) {
        for (const [v, w] of neighbors) {
            if (!reverseGraph.has(v)) {
                reverseGraph.set(v, []);
            }
            reverseGraph.get(v).push([u, w]);
            reverseGraphEdges++;
        }
    }

    // === FORWARD SEARCH (from start) ===
    const distF = new Map([[start, 0]]);
    const parentF = new Map([[start, null]]);
    const pqF = new MinHeap();
    pqF.push([0, start]);

    // === BACKWARD SEARCH (from target) ===
    const distB = new Map([[target, 0]]);
    const parentB = new Map([[target, null]]);
    const pqB = new MinHeap();
    pqB.push([0, target]);

    let bestPathCost = Infinity;  // best complete path found so far
    let meetingNode = null;       // where the two searches met
    let nodesExplored = 0;
    const visitedOrder = [];
    let maxPqFSize = 1;
    let maxPqBSize = 1;

    const settledF = new Set();   // nodes fully processed by forward search
    const settledB = new Set();   // nodes fully processed by backward search

    // Alternate between forward and backward expansion
    while (pqF.size() > 0 || pqB.size() > 0) {
        
        // --- Expand one node forward ---
        if (pqF.size() > 0) {
            const [curT, u] = pqF.pop();

            if (curT > (distF.get(u) ?? Infinity)) {
                // Stale entry, skip
            } else {
                nodesExplored++;
                visitedOrder.push({ id: u, side: 'start', parent: parentF.get(u) });
                settledF.add(u);

                // Check: did backward search already reach this node?
                if (distB.has(u)) {
                    const pathCost = distF.get(u) + distB.get(u);
                    if (pathCost < bestPathCost) {
                        bestPathCost = pathCost;
                        meetingNode = u; // searches met here!
                    }
                }

                // Expand neighbors (forward direction)
                const neighbors = graph.get(u) || [];
                for (const [v, w] of neighbors) {
                    const nt = curT + w;
                    if (nt < (distF.get(v) ?? Infinity)) {
                        distF.set(v, nt);
                        parentF.set(v, u);
                        pqF.push([nt, v]);
                        maxPqFSize = Math.max(maxPqFSize, pqF.size());
                    }
                }
            }
        }

        // --- Expand one node backward ---
        if (pqB.size() > 0) {
            const [curT, u] = pqB.pop();

            if (curT > (distB.get(u) ?? Infinity)) {
                // Stale entry, skip
            } else {
                nodesExplored++;
                visitedOrder.push({ id: u, side: 'end', parent: parentB.get(u) });
                settledB.add(u);

                // Check: did forward search already reach this node?
                if (distF.has(u)) {
                    const pathCost = distF.get(u) + distB.get(u);
                    if (pathCost < bestPathCost) {
                        bestPathCost = pathCost;
                        meetingNode = u;
                    }
                }

                // Expand neighbors (using REVERSE graph)
                const neighbors = reverseGraph.get(u) || [];
                for (const [v, w] of neighbors) {
                    const nt = curT + w;
                    if (nt < (distB.get(v) ?? Infinity)) {
                        distB.set(v, nt);
                        parentB.set(v, u);
                        pqB.push([nt, v]);
                        maxPqBSize = Math.max(maxPqBSize, pqB.size());
                    }
                }
            }
        }

        // Stop when we can't find a better path
        // (both queues' minimums add up to more than best found)
        const minF = pqF.size() > 0 ? pqF.heap[0][0] : Infinity;
        const minB = pqB.size() > 0 ? pqB.heap[0][0] : Infinity;
        if (minF + minB >= bestPathCost) {
            break;
        }
    }

    // Memory estimate
    const reverseGraphMem = reverseGraphEdges * 50;
    const forwardMem = (distF.size * 100) + (parentF.size * 100) + (settledF.size * 50) + (maxPqFSize * 50);
    const backwardMem = (distB.size * 100) + (parentB.size * 100) + (settledB.size * 50) + (maxPqBSize * 50);
    const estimatedMemoryKB = (reverseGraphMem + forwardMem + backwardMem) / 1024;

    if (meetingNode === null) {
        return { path: null, travelTime: null, nodesExplored, visitedOrder, estimatedMemoryKB };
    }

    // Build final path: start → meeting → target
    const pathToMeeting = reconstructPath(parentF, meetingNode);   // start to meeting
    const pathFromMeeting = reconstructPath(parentB, meetingNode); // meeting to target (reversed)
    pathFromMeeting.reverse();

    // Combine (skip duplicate meeting node)
    const fullPath = pathToMeeting.concat(pathFromMeeting.slice(1));

    return { path: fullPath, travelTime: bestPathCost, nodesExplored, visitedOrder, estimatedMemoryKB };
}

/**
 * Reconstruct path by walking backwards through parent pointers
 * Example: if parent = {C→B, B→A, A→null}, and target=C
 *          we get: C → B → A, then reverse to: A → B → C
 */
function reconstructPath(parent, target) {
    const path = [];
    let cur = target;
    while (cur !== null) {
        path.push(cur);
        cur = parent.get(cur); // go to previous node
    }
    path.reverse(); // flip from [target→start] to [start→target]
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
    const { path, travelTime, nodesExplored, visitedOrder, estimatedMemoryKB } = algo.func(graph, start, target, nodeCoords);
    const execTime = performance.now() - startTime;

    return {
        name: algo.name,
        path,
        travelTime,
        nodesExplored,
        visitedOrder,
        estimatedMemoryKB: estimatedMemoryKB || 0,
        execTimeMs: execTime,
        timeComplexity: algo.timeComplexity,
        spaceComplexity: algo.spaceComplexity,
        spaceNote: algo.spaceNote,
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