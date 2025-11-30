"""Routing algorithms and URL generation."""

import heapq
import time

from geo import haversine


def dijkstra(graph, start, target, node_coords=None):
    """Find shortest path using Dijkstra's algorithm.
    
    Args:
        graph: Adjacency list graph
        start: Start node ID
        target: Target node ID
        node_coords: Not used, kept for consistent interface
    
    Returns:
        tuple: (path, total_time, nodes_explored) or (None, None, 0) if no path
    """
    dist = {start: 0.0}
    parent = {start: None}
    pq = [(0.0, start)]
    nodes_explored = 0

    while pq:
        cur_t, u = heapq.heappop(pq)
        nodes_explored += 1
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
        return None, None, nodes_explored

    # Reconstruct path
    path = _reconstruct_path(parent, target)
    return path, dist[target], nodes_explored


def astar(graph, start, target, node_coords):
    """Find shortest path using A* algorithm with haversine heuristic.
    
    A* uses f(n) = g(n) + h(n) where:
    - g(n) = actual cost from start to n
    - h(n) = heuristic estimate from n to target (straight-line distance)
    
    Args:
        graph: Adjacency list graph
        start: Start node ID
        target: Target node ID
        node_coords: Dict mapping node IDs to (lat, lon) tuples
    
    Returns:
        tuple: (path, total_time, nodes_explored) or (None, None, 0) if no path
    """
    if target not in node_coords or start not in node_coords:
        return None, None, 0
    
    target_lat, target_lon = node_coords[target]
    
    def heuristic(node):
        """Estimate time to target using straight-line distance at ~60 km/h."""
        if node not in node_coords:
            return 0
        lat, lon = node_coords[node]
        dist_km = haversine(lat, lon, target_lat, target_lon)
        # Convert to minutes assuming 60 km/h average speed (optimistic)
        return dist_km / (60 / 60.0)
    
    g_score = {start: 0.0}
    f_score = {start: heuristic(start)}
    parent = {start: None}
    # Priority queue: (f_score, g_score_tiebreaker, node)
    pq = [(f_score[start], 0.0, start)]
    nodes_explored = 0
    
    while pq:
        _, cur_g, u = heapq.heappop(pq)
        nodes_explored += 1
        
        if u == target:
            break
            
        if cur_g > g_score.get(u, float("inf")):
            continue
            
        for v, w in graph[u]:
            tentative_g = g_score[u] + w
            if tentative_g < g_score.get(v, float("inf")):
                g_score[v] = tentative_g
                f = tentative_g + heuristic(v)
                f_score[v] = f
                parent[v] = u
                heapq.heappush(pq, (f, tentative_g, v))
    
    if target not in g_score:
        return None, None, nodes_explored
    
    path = _reconstruct_path(parent, target)
    return path, g_score[target], nodes_explored


def bidirectional_dijkstra(graph, start, target, node_coords=None):
    """Find shortest path using Bidirectional Dijkstra's algorithm.
    
    Searches from both start and target simultaneously, meeting in the middle.
    Often faster than standard Dijkstra for point-to-point queries.
    
    Args:
        graph: Adjacency list graph
        start: Start node ID
        target: Target node ID
        node_coords: Not used, kept for consistent interface
    
    Returns:
        tuple: (path, total_time, nodes_explored) or (None, None, 0) if no path
    """
    # Build reverse graph
    reverse_graph = {}
    for u in graph:
        for v, w in graph[u]:
            if v not in reverse_graph:
                reverse_graph[v] = []
            reverse_graph[v].append((u, w))
    
    # Forward search from start
    dist_f = {start: 0.0}
    parent_f = {start: None}
    pq_f = [(0.0, start)]
    
    # Backward search from target
    dist_b = {target: 0.0}
    parent_b = {target: None}
    pq_b = [(0.0, target)]
    
    best_path_cost = float("inf")
    meeting_node = None
    nodes_explored = 0
    
    # Settled nodes
    settled_f = set()
    settled_b = set()
    
    while pq_f or pq_b:
        # Expand forward
        if pq_f:
            cur_t, u = heapq.heappop(pq_f)
            nodes_explored += 1
            
            if cur_t <= dist_f.get(u, float("inf")):
                settled_f.add(u)
                
                # Check if we found a better path through this node
                if u in dist_b:
                    path_cost = dist_f[u] + dist_b[u]
                    if path_cost < best_path_cost:
                        best_path_cost = path_cost
                        meeting_node = u
                
                for v, w in graph.get(u, []):
                    nt = cur_t + w
                    if nt < dist_f.get(v, float("inf")):
                        dist_f[v] = nt
                        parent_f[v] = u
                        heapq.heappush(pq_f, (nt, v))
        
        # Expand backward
        if pq_b:
            cur_t, u = heapq.heappop(pq_b)
            nodes_explored += 1
            
            if cur_t <= dist_b.get(u, float("inf")):
                settled_b.add(u)
                
                # Check if we found a better path through this node
                if u in dist_f:
                    path_cost = dist_f[u] + dist_b[u]
                    if path_cost < best_path_cost:
                        best_path_cost = path_cost
                        meeting_node = u
                
                for v, w in reverse_graph.get(u, []):
                    nt = cur_t + w
                    if nt < dist_b.get(v, float("inf")):
                        dist_b[v] = nt
                        parent_b[v] = u
                        heapq.heappush(pq_b, (nt, v))
        
        # Termination: if min in both queues exceeds best found path
        min_f = pq_f[0][0] if pq_f else float("inf")
        min_b = pq_b[0][0] if pq_b else float("inf")
        if min_f + min_b >= best_path_cost:
            break
    
    if meeting_node is None:
        return None, None, nodes_explored
    
    # Reconstruct path: start -> meeting_node -> target
    path_to_meeting = _reconstruct_path(parent_f, meeting_node)
    path_from_meeting = _reconstruct_path(parent_b, meeting_node)
    path_from_meeting.reverse()
    
    # Combine paths (meeting node appears in both, so skip duplicate)
    full_path = path_to_meeting + path_from_meeting[1:]
    
    return full_path, best_path_cost, nodes_explored


def _reconstruct_path(parent, target):
    """Reconstruct path from parent pointers."""
    path = []
    cur = target
    while cur is not None:
        path.append(cur)
        cur = parent[cur]
    path.reverse()
    return path


def run_algorithm(name, func, graph, start, target, node_coords):
    """Run an algorithm and measure execution time.
    
    Returns:
        dict: Results including path, time, nodes explored, and execution time
    """
    start_time = time.perf_counter()
    path, travel_time, nodes_explored = func(graph, start, target, node_coords)
    exec_time = (time.perf_counter() - start_time) * 1000  # Convert to ms
    
    return {
        "name": name,
        "path": path,
        "travel_time": travel_time,
        "nodes_explored": nodes_explored,
        "exec_time_ms": exec_time,
    }


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

