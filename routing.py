"""Routing algorithms and URL generation."""

import heapq


def dijkstra(graph, start, target):
    """Find shortest path using Dijkstra's algorithm.
    
    Returns:
        tuple: (path as list of node IDs, total time in minutes) or (None, None) if no path
    """
    dist = {start: 0.0}
    parent = {start: None}
    pq = [(0.0, start)]

    while pq:
        cur_t, u = heapq.heappop(pq)
        if u == target:
            break
        if cur_t > dist.get(u, float("inf")):
            continue
        for v, w in graph[u]:
            nt = cur_t + w
            if nt < dist.get(v, float("inf")):
                dist[v] = nt
                parent[v] = u
                heapq.heappush(pq, (nt, v))

    if target not in dist:
        return None, None

    # Reconstruct path
    path = []
    cur = target
    while cur is not None:
        path.append(cur)
        cur = parent[cur]
    path.reverse()
    
    return path, dist[target]


def build_google_maps_url(path, node_coords):
    """Build a Google Maps directions URL from a path."""
    if not path:
        return None
        
    coords = [node_coords[nid] for nid in path if nid in node_coords]
    if len(coords) < 2:
        return None

    origin = coords[0]
    dest = coords[-1]
    waypoints = coords[1:-1]

    base = "https://www.google.com/maps/dir/?api=1"
    url = f"{base}&origin={origin[0]},{origin[1]}&destination={dest[0]},{dest[1]}"

    if waypoints:
        # Google Maps limits waypoints, take first 10
        subset = waypoints[:10]
        wp_str = "|".join(f"{lat},{lon}" for lat, lon in subset)
        url += f"&waypoints={wp_str}"

    return url

