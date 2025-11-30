# PathFinder — Route Planner

A web-based route planning application that finds the shortest path between locations using multiple graph algorithms on real-world road network data from **OpenStreetMap (OSM)**.

Built as a project for the Algorithms course to demonstrate practical applications of graph algorithms, priority queues, and heuristic search.

---

## Table of Contents

- [Project Overview](#project-overview)
- [How It Works](#how-it-works)
- [Algorithms Used](#algorithms-used)
  - [Dijkstra's Algorithm](#dijkstras-algorithm)
  - [A* (A-Star) Algorithm](#a-a-star-algorithm)
  - [Bidirectional Dijkstra](#bidirectional-dijkstra)
  - [Priority Queue (Binary Heap)](#priority-queue-binary-heap)
- [Data Source: OpenStreetMap](#data-source-openstreetmap)
  - [What is OSM?](#what-is-osm)
  - [Fetching Data via Overpass API](#fetching-data-via-overpass-api)
  - [Data Cleaning and Graph Construction](#data-cleaning-and-graph-construction)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)

---

## Project Overview

This web application allows users to:

1. Select a geographic region (preset cities or custom bounding box)
2. Choose a starting location and destination from real points of interest
3. Compute optimal routes using **three different algorithms**
4. **Compare algorithm performance** (execution time, nodes explored)
5. Visualize routes on an **interactive map**
6. Open routes in Google Maps

The project demonstrates how theoretical graph algorithms translate to real-world applications like GPS navigation systems, and allows side-by-side comparison of different algorithmic approaches.

---

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User selects   │────▶│  Fetch OSM data  │────▶│  Parse & clean  │
│     region      │     │  via Overpass    │     │     raw data    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Display map &  │◀────│ Run 3 algorithms │◀────│  Build weighted │
│   comparison    │     │   + compare      │     │      graph      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Step-by-Step Process

1. **Region Selection**: User picks a city/area via presets, city search, or manual coordinates
2. **Data Fetching**: Query the Overpass API for road network and points of interest
3. **Data Cleaning**: Filter relevant roads, extract coordinates, calculate edge weights
4. **Graph Construction**: Build an adjacency list representation of the road network
5. **Place Mapping**: Map points of interest to nearest road nodes
6. **Route Computation**: Run Dijkstra, A*, and Bidirectional Dijkstra algorithms
7. **Analysis**: Compare algorithm performance metrics
8. **Visualization**: Display routes on interactive Leaflet map with Google Maps links

---

## Algorithms Used

### Dijkstra's Algorithm

Dijkstra's algorithm finds the shortest path from a source node to all other nodes in a weighted graph with non-negative edge weights.

**How it works:**

1. Initialize distances: source = 0, all others = ∞
2. Use a priority queue to always process the node with minimum distance
3. For each neighbor of current node, check if going through current node offers a shorter path
4. If yes, update the distance and add to priority queue
5. Repeat until destination is reached

**Time Complexity:** O((V + E) log V) with a binary heap priority queue
- V = number of vertices (road intersections)
- E = number of edges (road segments)

**Implementation** (`js/routing.js`):

```javascript
export function dijkstra(graph, start, target, nodeCoords = null) {
    const dist = new Map([[start, 0]]);
    const parent = new Map([[start, null]]);
    const pq = new MinHeap();
    pq.push([0, start]);

    while (pq.size() > 0) {
        const [curT, u] = pq.pop();
        if (u === target) break;
        if (curT > (dist.get(u) ?? Infinity)) continue;

        for (const [v, w] of graph.get(u) || []) {
            const nt = curT + w;
            if (nt < (dist.get(v) ?? Infinity)) {
                dist.set(v, nt);
                parent.set(v, u);
                pq.push([nt, v]);
            }
        }
    }
    // Reconstruct path...
}
```

### A* (A-Star) Algorithm

A* is an informed search algorithm that uses a **heuristic** to guide the search toward the goal, potentially exploring fewer nodes than Dijkstra.

**How it works:**

1. Like Dijkstra, but prioritizes by `f(n) = g(n) + h(n)`
   - `g(n)` = actual cost from start to node n
   - `h(n)` = estimated cost from n to goal (heuristic)
2. We use **straight-line distance** (Haversine) as the heuristic
3. The heuristic must be *admissible* (never overestimate) to guarantee optimal paths

**Why A* can be faster:**
- The heuristic focuses exploration toward the destination
- In road networks, straight-line distance is a good estimate
- Can explore significantly fewer nodes than blind Dijkstra search

**Time Complexity:** O((V + E) log V)* — same worst-case, but typically faster in practice

### Bidirectional Dijkstra

Bidirectional search runs two simultaneous searches: one forward from the start, one backward from the goal, meeting in the middle.

**How it works:**

1. Maintain two priority queues and two distance maps
2. Alternate expanding nodes from each direction
3. When searches meet, we've found a candidate path
4. Continue until we can prove no better path exists

**Why it's efficient:**
- Search space grows as πr² from each end
- Two smaller searches (radius r/2 each) explore less area than one large search (radius r)
- Theoretically explores ~half the nodes of standard Dijkstra

**Time Complexity:** O((V + E) log V) — same worst-case, but explores fewer nodes on average

### Priority Queue (Binary Heap)

A **priority queue** is essential for efficient shortest-path algorithms. We implement a **binary min-heap** in JavaScript.

**Binary Heap Properties:**
- Complete binary tree stored in an array
- Parent is always smaller than children (min-heap)
- Root is always the minimum element

**Operations:**
| Operation | Time Complexity |
|-----------|-----------------|
| Insert (push) | O(log n) |
| Extract Min (pop) | O(log n) |
| Peek Min | O(1) |

**Why use a priority queue?**
- We need to repeatedly find the unvisited node with minimum distance
- Without priority queue: O(V) per extraction → O(V²) total
- With priority queue: O(log V) per extraction → O((V+E) log V) total

---

## Data Source: OpenStreetMap

### What is OSM?

**OpenStreetMap (OSM)** is a collaborative, open-source project that creates a free editable geographic database of the world. Think of it as "Wikipedia for maps."

Key characteristics:
- **Crowdsourced**: Contributed by millions of volunteers worldwide
- **Open Data**: Free to use under the Open Database License (ODbL)
- **Comprehensive**: Contains roads, buildings, points of interest, and more
- **Structured**: Data is stored as nodes, ways, and relations with tags

### Fetching Data via Overpass API

The **Overpass API** is a read-only API for querying OSM data. It allows complex spatial queries without downloading the entire OSM database.

**Our query fetches:**
1. **Ways with "highway" tag**: Road segments (motorways, primary roads, residential streets, etc.)
2. **Nodes with "name" tag**: Named places (restaurants, hospitals, banks, etc.)

```
[out:json][timeout:25];
(
  way["highway"](south,west,north,east);    // All roads in bounding box
  node["name"](south,west,north,east);      // All named places
);
(._;>;);  // Include all referenced nodes
out body;
```

### Data Cleaning and Graph Construction

Raw OSM data requires significant processing before it can be used for routing:

#### 1. Node Extraction
```
Raw OSM Node → {id: "123456", lat: 26.2842, lon: 50.2081, tags: {...}}
```
We extract coordinates for each node to build our coordinate lookup table.

#### 2. Road Filtering
Not all "highway" tags are routable roads. We filter to keep only:
- `motorway`, `trunk`, `primary`, `secondary`, `tertiary`
- `residential`, `service`, `unclassified`, `living_street`

We exclude: footpaths, cycleways, construction zones, private roads.

#### 3. Edge Weight Calculation
For each road segment, we calculate travel time (not just distance):

```javascript
timeMinutes = distanceKm / (speedKmh / 60);
```

Where:
- **Distance**: Calculated using the Haversine formula (accounts for Earth's curvature)
- **Speed**: Realistic average speed based on road type

#### 4. One-Way Road Handling
OSM tags indicate road directionality:
- `oneway=yes`: Add edge A→B only
- `oneway=-1`: Add edge B→A only
- Otherwise: Add both A→B and B→A (bidirectional)

#### 5. Place Categorization
We extract points of interest from popular categories:
- **Amenities**: restaurants, hospitals, banks, mosques, pharmacies
- **Shops**: supermarkets, malls, electronics stores
- **Leisure**: parks, playgrounds
- **Tourism**: attractions, museums

#### 6. Graph Representation
The final graph is stored as an **adjacency list** using JavaScript Maps:

```javascript
const graph = new Map([
    ["node_123", [["node_456", 2.5], ["node_789", 1.8]]],  // (neighbor, travel_time)
    ["node_456", [["node_123", 2.5], ["node_999", 3.2]]],
    // ...
]);
```

This representation is memory-efficient for sparse graphs (road networks typically have low average degree).

---

## Project Structure

```
algo-project/
├── index.html          # Main HTML page
├── style.css           # Styles and theming
├── js/
│   ├── app.js          # Main application logic & UI
│   ├── api.js          # Overpass & Nominatim API calls
│   ├── config.js       # Preset regions, speeds, categories
│   ├── geo.js          # Haversine distance formula
│   ├── graph.js        # Graph construction & place mapping
│   ├── routing.js      # Dijkstra, A*, Bidirectional algorithms
│   └── utils.js        # MinHeap priority queue implementation
├── cli/                # Legacy Python CLI version
│   ├── main.py
│   ├── config.py
│   ├── geo.py
│   ├── api.py
│   ├── graph.py
│   ├── routing.py
│   ├── ui.py
│   └── requirements.txt
└── README.md
```

| Module | Purpose |
|--------|---------|
| `index.html` | Application structure and UI layout |
| `style.css` | Modern styling with CSS variables |
| `app.js` | Main controller, event handling, state management |
| `api.js` | HTTP requests to OSM services |
| `config.js` | All tunable parameters in one place |
| `geo.js` | Haversine formula for geographic distance |
| `graph.js` | Parse OSM data, build adjacency list |
| `routing.js` | Algorithm implementations + Google Maps URL builder |
| `utils.js` | MinHeap data structure |

---

## How to Run

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for fetching OSM data and map tiles)

### Running Locally

1. **Clone or download the project**

2. **Serve the files with any HTTP server:**
   ```bash
   # Using Python
   cd algo-project
   python3 -m http.server 8000
   
   # Using Node.js (npx)
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

   > **Note:** Opening `index.html` directly (via `file://`) won't work due to ES module restrictions. You need an HTTP server.

### Usage

1. **Select region source:**
   - Click a **preset region** (Al Khobar, Dammam, Riyadh, etc.)
   - **Search** for any city by name
   - Enter **custom bounding box** coordinates

2. **Wait for data to load** (may take 10-30 seconds depending on region size)

3. **Select START location:**
   - Browse by category (restaurants, hospitals, etc.)
   - Or search by name

4. **Select DESTINATION location** (same process)

5. **Click "Run Algorithms"** to compute routes

6. **View results:**
   - Algorithm complexity comparison table
   - Performance metrics (execution time, nodes explored)
   - Analysis of which algorithm performed best
   - Interactive map showing the route
   - Links to open each route in Google Maps

### Example Output

After running the algorithms, you'll see:

- **Complexity Table**: Theoretical time/space complexity for each algorithm
- **Performance Table**: Actual execution time, nodes explored, path length
- **Analysis Cards**: Which algorithm was fastest, most efficient, optimization gains
- **Route Map**: Interactive Leaflet map with the computed path
- **Google Maps Links**: Open any algorithm's route externally

