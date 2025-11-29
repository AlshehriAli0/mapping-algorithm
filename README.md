# Route Planner

A route planning application that finds the shortest path between locations using **Dijkstra's algorithm** on real-world road network data from **OpenStreetMap (OSM)**.

Built as a project for the Algorithms course to demonstrate practical applications of graph algorithms, priority queues, and parallel processing.

---

## Table of Contents

- [Project Overview](#project-overview)
- [How It Works](#how-it-works)
- [Algorithms Used](#algorithms-used)
  - [Dijkstra's Algorithm](#dijkstras-algorithm)
  - [Priority Queue (Binary Heap)](#priority-queue-binary-heap)
- [Data Source: OpenStreetMap](#data-source-openstreetmap)
  - [What is OSM?](#what-is-osm)
  - [Fetching Data via Overpass API](#fetching-data-via-overpass-api)
  - [Data Cleaning and Graph Construction](#data-cleaning-and-graph-construction)
- [Multithreading](#multithreading)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)

---

## Project Overview

This application allows users to:

1. Select a geographic region (preset cities or custom bounding box)
2. Choose a starting location and destination from real points of interest
3. Compute the optimal route using Dijkstra's algorithm
4. View estimated travel time and open the route in Google Maps

The project demonstrates how theoretical graph algorithms translate to real-world applications like GPS navigation systems.

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
│  Output route   │◀────│ Run Dijkstra's   │◀────│  Build weighted │
│  + Google Maps  │     │    algorithm     │     │      graph      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Step-by-Step Process

1. **Region Selection**: User picks a city/area to navigate within
2. **Data Fetching**: Query the Overpass API for road network and points of interest
3. **Data Cleaning**: Filter relevant roads, extract coordinates, calculate edge weights
4. **Graph Construction**: Build an adjacency list representation of the road network
5. **Place Mapping**: Map points of interest to nearest road nodes (parallelized)
6. **Route Computation**: Apply Dijkstra's algorithm to find shortest path
7. **Output**: Display travel time and generate Google Maps URL

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

**Why Dijkstra?**
- All edge weights (travel times) are positive
- We need the optimal path, not just any path
- Efficient for sparse graphs like road networks

**Implementation** (`routing.py`):

```python
def dijkstra(graph, start, target):
    dist = {start: 0.0}
    parent = {start: None}
    pq = [(0.0, start)]  # Priority queue: (distance, node)

    while pq:
        cur_t, u = heapq.heappop(pq)  # Get minimum distance node
        if u == target:
            break
        if cur_t > dist.get(u, float("inf")):
            continue  # Skip outdated entries
        for v, w in graph[u]:
            nt = cur_t + w
            if nt < dist.get(v, float("inf")):
                dist[v] = nt
                parent[v] = u
                heapq.heappush(pq, (nt, v))
    
    # Reconstruct path by following parent pointers
    ...
```

### Priority Queue (Binary Heap)

A **priority queue** is an abstract data type where each element has a priority, and elements are served in order of priority (not insertion order).

**Implementation:** We use Python's `heapq` module, which implements a **binary min-heap**.

**Binary Heap Properties:**
- Complete binary tree stored in an array
- Parent is always smaller than children (min-heap)
- Root is always the minimum element

**Operations:**
| Operation | Time Complexity |
|-----------|-----------------|
| Insert (heappush) | O(log n) |
| Extract Min (heappop) | O(log n) |
| Peek Min | O(1) |

**Why use a priority queue in Dijkstra?**
- We need to repeatedly find the unvisited node with minimum distance
- Without priority queue: O(V) per extraction → O(V²) total
- With priority queue: O(log V) per extraction → O((V+E) log V) total

This is a significant improvement for large road networks with thousands of nodes.

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

```python
time_minutes = distance_km / (speed_kmh / 60)
```

Where:
- **Distance**: Calculated using the Haversine formula (accounts for Earth's curvature)
- **Speed**: Realistic average speed based on road type (already accounts for traffic, lights, and typical delays)

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
The final graph is stored as an **adjacency list**:

```python
graph = {
    "node_123": [("node_456", 2.5), ("node_789", 1.8)],  # (neighbor, travel_time)
    "node_456": [("node_123", 2.5), ("node_999", 3.2)],
    ...
}
```

This representation is memory-efficient for sparse graphs (road networks typically have low average degree).

---

## Multithreading

### What is Multithreading?

**Multithreading** (or multiprocessing) allows a program to execute multiple tasks concurrently by utilizing multiple CPU cores. Instead of processing items one-by-one, we can process many simultaneously.

### Why We Need It

After building the road graph, we need to map each point of interest (restaurant, hospital, etc.) to its nearest road node. This involves:

- For each of N places
- Compare against M road nodes
- Calculate distance using Haversine formula

This is O(N × M) distance calculations. For a city like Riyadh with ~5,000 places and ~50,000 road nodes, that's **250 million calculations**!

### Our Implementation

We use Python's `multiprocessing.Pool` to parallelize the place mapping:

```python
from multiprocessing import Pool, cpu_count

def map_places_to_nearest_nodes(places_raw, graph_nodes, node_coords):
    num_workers = min(cpu_count(), num_places, 8)  # Use available CPU cores
    
    with Pool(processes=num_workers, initializer=_init_worker, ...) as pool:
        # Distribute places across workers
        for result in pool.imap(_find_nearest_node, places_raw, chunksize=...):
            mapped.append(result)
```

**How it works:**

1. **Worker Initialization**: Each worker process receives a copy of the graph nodes and coordinates
2. **Task Distribution**: Places are divided into chunks and distributed to workers
3. **Parallel Execution**: Each worker independently finds nearest nodes for its places
4. **Result Collection**: Results are gathered as they complete

**Performance:**

| CPU Cores | Speedup |
|-----------|---------|
| 1 (sequential) | 1x |
| 4 | ~3.5x |
| 8 | ~6-7x |

The speedup isn't perfectly linear due to overhead from process creation and inter-process communication.

---

## Project Structure

```
algo-project/
├── main.py       # Entry point - orchestrates the workflow
├── config.py     # Configuration constants (speeds, presets, categories)
├── geo.py        # Geographic utilities (Haversine distance formula)
├── api.py        # External API interactions (Overpass, Nominatim)
├── graph.py      # Graph construction and place mapping
├── routing.py    # Dijkstra's algorithm and URL generation
├── ui.py         # Interactive user interface
├── requirements.txt
└── venv/         # Virtual environment
```

| Module | Purpose |
|--------|---------|
| `config.py` | All tunable parameters in one place |
| `geo.py` | Haversine formula for geographic distance |
| `api.py` | HTTP requests to OSM services |
| `graph.py` | Parse OSM data, build adjacency list, parallel place mapping |
| `routing.py` | Dijkstra implementation, Google Maps URL builder |
| `ui.py` | Terminal-based interactive menus |
| `main.py` | High-level workflow orchestration |

---

## How to Run

### Prerequisites

- Python 3.8 or higher
- Internet connection (for fetching OSM data)

### Installation

1. **Clone or download the project**

2. **Create and activate virtual environment**
   ```bash
   cd algo-project
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install requests rich getch
   ```

### Running the Application

```bash
python main.py
```

### Usage

1. **Select region source:**
   - Press `1` for preset regions (Al Khobar, Dammam, Riyadh, etc.)
   - Press `2` to search by city name
   - Press `3` to enter custom bounding box coordinates

2. **Wait for data to load** (may take 10-30 seconds depending on region size)

3. **Select START location:**
   - Press `1` to browse by category (restaurants, hospitals, etc.)
   - Press `2` to search by name

4. **Select DESTINATION location** (same process)

5. **View results:**
   - Estimated travel time in minutes
   - Clickable link to open route in Google Maps

### Example Session

```
🚗 Real-World Route Planner (Dijkstra + OSM + Overpass)

Choose region source:
1) Preset regions
2) Search city name (auto bounding box)
3) Enter bounding box manually
Press 1, 2 or 3: 1

Preset Regions:
┌─────┬──────────────────────────┐
│ Key │ Name                     │
├─────┼──────────────────────────┤
│ 1   │ Al Khobar (Full City)    │
│ 2   │ Dammam (Full City)       │
│ ... │ ...                      │
└─────┴──────────────────────────┘
Press 1-9 to select: 1

Querying Overpass API... this may take a few seconds
✔ Nodes: 45,231, edges: 98,456, named places: 1,247

Select START location
Choose selection mode:
1) Browse by category
2) Search by name
Press 1 or 2: 2
Enter keyword to search: starbucks
...

Computing shortest path from Starbucks Corniche to King Fahd Hospital...
✔ Estimated travel time: 12.3 minutes

📍 Click here to open route in Google Maps
```


