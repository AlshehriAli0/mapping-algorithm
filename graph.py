"""Graph building and place mapping from OSM data."""

from collections import defaultdict
from multiprocessing import Pool, cpu_count

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn

from config import (
    Place,
    ROAD_SPEED,
    INTERSECTION_DELAY,
    POPULAR_AMENITY,
    POPULAR_SHOP,
    POPULAR_LEISURE,
    POPULAR_TOURISM,
)
from geo import haversine

console = Console()

# Module-level variables for worker processes
_graph_list = None
_node_coords = None


def parse_overpass_to_graph(data):
    """Convert Overpass JSON into nodes, edges (time-weighted), and named places."""
    if data is None or "elements" not in data:
        console.print("[red]No data from Overpass.[/red]")
        return {}, [], []

    elements = data["elements"]

    # Extract node coordinates and tags
    node_coords = {}
    for el in elements:
        if el.get("type") == "node":
            nid = str(el["id"])
            node_coords[nid] = (el.get("lat"), el.get("lon"))

    edges = []
    named_places_raw = []

    console.print("[yellow]Processing ways and named places...[/yellow]")

    for el in elements:
        if el.get("type") == "way":
            edges.extend(_process_way(el, node_coords))
        elif el.get("type") == "node":
            place = _extract_place(el, node_coords)
            if place:
                named_places_raw.append(place)

    console.print(
        f"[green]✔ Nodes: {len(node_coords)}, edges: {len(edges)}, "
        f"named places: {len(named_places_raw)}[/green]\n"
    )
    return node_coords, edges, named_places_raw


def _process_way(el, node_coords):
    """Process a single way element into edges."""
    tags = el.get("tags", {})
    highway = tags.get("highway")
    
    if not highway or highway not in ROAD_SPEED:
        return []

    oneway = tags.get("oneway", "no")
    speed = ROAD_SPEED.get(highway, 40)
    nds = [str(nid) for nid in el.get("nodes", [])]
    edges = []

    for i in range(len(nds) - 1):
        u, v = nds[i], nds[i + 1]
        if u not in node_coords or v not in node_coords:
            continue
            
        lat1, lon1 = node_coords[u]
        lat2, lon2 = node_coords[v]
        dist_km = haversine(lat1, lon1, lat2, lon2)
        time_min = dist_km / (speed / 60.0) + INTERSECTION_DELAY

        if oneway == "yes":
            edges.append((u, v, time_min))
        elif oneway == "-1":
            edges.append((v, u, time_min))
        else:
            edges.append((u, v, time_min))
            edges.append((v, u, time_min))

    return edges


def _extract_place(el, node_coords):
    """Extract place info from a node if it's a popular category."""
    nid = str(el["id"])
    tags = el.get("tags", {})
    name = tags.get("name")
    
    if not name:
        return None

    category = None
    if tags.get("amenity") in POPULAR_AMENITY:
        category = tags["amenity"]
    elif tags.get("shop") in POPULAR_SHOP:
        category = f"shop:{tags['shop']}"
    elif tags.get("leisure") in POPULAR_LEISURE:
        category = tags["leisure"]
    elif tags.get("tourism") in POPULAR_TOURISM:
        category = tags["tourism"]

    if category and nid in node_coords:
        lat, lon = node_coords[nid]
        return (nid, name, category, lat, lon)
    return None


def build_graph(edges):
    """Build adjacency list graph from edges."""
    graph = defaultdict(list)
    for u, v, t in edges:
        graph[u].append((v, t))
    return graph


def _init_worker(graph_list, node_coords):
    """Initialize worker process with shared data."""
    global _graph_list, _node_coords
    _graph_list = graph_list
    _node_coords = node_coords


def _find_nearest_node(place_data):
    """Worker function to find nearest graph node for a single place."""
    pid, name, cat, plat, plon = place_data
    best_node = None
    best_dist = float("inf")
    
    for nid in _graph_list:
        nlat, nlon = _node_coords[nid]
        d = haversine(plat, plon, nlat, nlon)
        if d < best_dist:
            best_dist = d
            best_node = nid
            
    return Place(pid, name, cat, plat, plon, best_node)


def map_places_to_nearest_nodes(places_raw, graph_nodes, node_coords):
    """Map places to nearest road nodes using parallel processing."""
    graph_list = list(graph_nodes)
    if not graph_list:
        console.print("[red]No road nodes in graph![/red]")
        return []

    num_places = len(places_raw)
    num_workers = min(cpu_count(), num_places, 8)

    console.print(
        f"[yellow]Mapping {num_places} places to nearest road nodes "
        f"using {num_workers} workers...[/yellow]"
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console,
    ) as progress:
        task = progress.add_task("Mapping places...", total=num_places)

        with Pool(
            processes=num_workers,
            initializer=_init_worker,
            initargs=(graph_list, node_coords),
        ) as pool:
            mapped = []
            chunksize = max(1, num_places // (num_workers * 4))
            for result in pool.imap(_find_nearest_node, places_raw, chunksize=chunksize):
                mapped.append(result)
                progress.update(task, advance=1)

    console.print(f"[green]✔ Places mapped: {len(mapped)}[/green]\n")
    return mapped

