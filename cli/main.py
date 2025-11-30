"""Real-World Route Planner with Multiple Pathfinding Algorithms."""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from api import fetch_overpass_data
from graph import parse_overpass_to_graph, build_graph, map_places_to_nearest_nodes
from routing import (
    dijkstra,
    astar,
    bidirectional_dijkstra,
    run_algorithm,
    build_google_maps_url,
)
from ui import choose_region, choose_place

console = Console()

# Define algorithms with their complexity information
# Format: (name, function, time_complexity, space_complexity, description)
ALGORITHMS = [
    (
        "Dijkstra",
        dijkstra,
        "O((V + E) log V)",
        "O(V)",
        "Classic shortest path. Explores all directions equally until target found.",
    ),
    (
        "A* (A-Star)",
        astar,
        "O((V + E) log V)*",
        "O(V)",
        "Heuristic-guided search. Uses straight-line distance to prioritize promising paths.",
    ),
    (
        "Bidirectional Dijkstra",
        bidirectional_dijkstra,
        "O((V + E) log V)",
        "O(V)",
        "Searches from both ends simultaneously, meeting in the middle.",
    ),
]


def main():
    console.print(
        "[bold magenta]🚗 Real-World Route Planner[/bold magenta]\n"
        "[dim]Comparing Dijkstra, A*, and Bidirectional Dijkstra algorithms[/dim]\n"
    )

    # 1) Pick region
    bbox = choose_region()
    console.print(f"[cyan]Using bounding box:[/cyan] {bbox}\n")

    # 2) Fetch map data
    data = fetch_overpass_data(bbox)
    if data is None:
        return

    # 3) Build graph + places
    node_coords, edges, places_raw = parse_overpass_to_graph(data)
    graph = build_graph(edges)
    graph_nodes = set(graph.keys())

    if not graph_nodes:
        console.print("[red]No road graph found in this region. Try a larger area.[/red]")
        return

    places = map_places_to_nearest_nodes(places_raw, graph_nodes, node_coords)
    if not places:
        console.print("[yellow]No named places mapped in this region, can't do place-based routing.[/yellow]")
        return

    # 4) Choose start & destination
    console.print("\n[bold green]Select START location[/bold green]")
    start = choose_place(places)
    if not start:
        return

    console.print("\n[bold green]Select DESTINATION location[/bold green]")
    dest = choose_place(places)
    if not dest:
        return

    console.print(
        f"\n[cyan]Computing shortest paths from[/cyan] [bold]{start.name}[/bold] "
        f"[cyan]to[/cyan] [bold]{dest.name}[/bold] ...\n"
    )

    # 5) Run all algorithms and collect results
    results = []
    for algo_name, algo_func, time_comp, space_comp, description in ALGORITHMS:
        result = run_algorithm(
            algo_name, algo_func, graph, start.nearest_node, dest.nearest_node, node_coords
        )
        # Add complexity info
        result["time_complexity"] = time_comp
        result["space_complexity"] = space_comp
        result["description"] = description
        # Generate Google Maps URL for each result
        if result["path"]:
            result["gmaps_url"] = build_google_maps_url(result["path"], node_coords)
            result["path_length"] = len(result["path"])
        else:
            result["gmaps_url"] = None
            result["path_length"] = 0
        results.append(result)

    # 6) Display algorithm theory/complexity
    display_complexity_table(results)

    # 7) Display performance comparison table
    display_performance_comparison(results, len(graph), sum(len(v) for v in graph.values()))

    # 8) Check if routes are different
    display_route_comparison(results)

    # 9) Display Google Maps links
    display_maps_links(results)


def display_complexity_table(results):
    """Display theoretical complexity and algorithm descriptions."""
    console.print(Panel.fit(
        "[bold]V[/bold] = number of vertices (road intersections)\n"
        "[bold]E[/bold] = number of edges (road segments)\n"
        "[dim]* A* has same worst-case but typically explores fewer nodes due to heuristic[/dim]",
        title="📚 Complexity Notation",
        border_style="blue",
    ))
    console.print()

    table = Table(
        title="📖 Algorithm Theory & Complexity",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
    )
    
    table.add_column("Algorithm", style="bold yellow")
    table.add_column("Time Complexity", justify="center")
    table.add_column("Space Complexity", justify="center")
    table.add_column("Description", style="dim")

    for r in results:
        table.add_row(
            r["name"],
            f"[green]{r['time_complexity']}[/green]",
            f"[blue]{r['space_complexity']}[/blue]",
            r["description"],
        )

    console.print(table)
    console.print()


def display_performance_comparison(results, num_vertices, num_edges):
    """Display actual performance metrics."""
    console.print(f"[dim]Graph size: V = {num_vertices:,} vertices, E = {num_edges:,} edges[/dim]\n")

    table = Table(
        title="⚡ Performance Comparison (Actual Execution)",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
    )
    
    table.add_column("Algorithm", style="bold yellow")
    table.add_column("Travel Time", justify="right", style="green")
    table.add_column("Nodes Explored", justify="right")
    table.add_column("Exec Time (ms)", justify="right")
    table.add_column("Path Nodes", justify="right")
    table.add_column("Status", justify="center")

    for r in results:
        if r["path"]:
            travel_time = f"{r['travel_time']:.1f} min"
            path_status = "[green]✔ Found[/green]"
            path_nodes = str(r["path_length"])
        else:
            travel_time = "-"
            path_status = "[red]✘ No Path[/red]"
            path_nodes = "-"

        table.add_row(
            r["name"],
            travel_time,
            f"{r['nodes_explored']:,}",
            f"{r['exec_time_ms']:.2f}",
            path_nodes,
            path_status,
        )

    console.print(table)
    console.print()

    # Find best algorithm by execution time (among those that found a path)
    successful = [r for r in results if r["path"]]
    if successful:
        fastest = min(successful, key=lambda x: x["exec_time_ms"])
        least_nodes = min(successful, key=lambda x: x["nodes_explored"])
        
        console.print(f"[bold green]⚡ Fastest execution:[/bold green] {fastest['name']} ({fastest['exec_time_ms']:.2f} ms)")
        console.print(f"[bold green]🎯 Fewest nodes explored:[/bold green] {least_nodes['name']} ({least_nodes['nodes_explored']:,} nodes)")
        
        # Calculate efficiency improvement
        if len(successful) > 1:
            dijkstra_result = next((r for r in successful if r["name"] == "Dijkstra"), None)
            if dijkstra_result:
                for r in successful:
                    if r["name"] != "Dijkstra" and dijkstra_result["nodes_explored"] > 0:
                        reduction = (1 - r["nodes_explored"] / dijkstra_result["nodes_explored"]) * 100
                        if reduction > 0:
                            console.print(
                                f"[cyan]📊 {r['name']} explored {reduction:.1f}% fewer nodes than Dijkstra[/cyan]"
                            )
        console.print()


def display_route_comparison(results):
    """Compare if algorithms found different routes."""
    successful = [r for r in results if r["path"]]
    
    if len(successful) < 2:
        return
    
    console.print(Panel.fit(
        "[bold]Route Analysis[/bold]",
        title="🛣️ Do Algorithms Find Different Routes?",
        border_style="magenta",
    ))
    
    # Check if all paths are identical
    paths = [tuple(r["path"]) for r in successful]
    unique_paths = set(paths)
    
    # Check travel times
    travel_times = [f"{r['travel_time']:.4f}" for r in successful]
    same_time = len(set(travel_times)) == 1
    
    if len(unique_paths) == 1:
        console.print("[green]✓ All algorithms found the EXACT SAME route![/green]")
        console.print(f"  Path has {successful[0]['path_length']} nodes, travel time: {successful[0]['travel_time']:.1f} min")
    else:
        console.print(f"[yellow]⚠ Algorithms found {len(unique_paths)} DIFFERENT routes![/yellow]")
        if same_time:
            console.print("[blue]  However, all routes have the same optimal travel time.[/blue]")
            console.print("[dim]  (Multiple optimal paths exist in the road network)[/dim]")
        else:
            console.print("[red]  Routes have different travel times - some may be suboptimal.[/red]")
        
        # Show path differences
        console.print("\n[bold]Route details:[/bold]")
        for r in successful:
            console.print(f"  • {r['name']}: {r['path_length']} nodes, {r['travel_time']:.2f} min")
    
    console.print()


def display_maps_links(results):
    """Display Google Maps links for each algorithm's path."""
    console.print("\n[bold magenta]📍 Google Maps Links[/bold magenta]")
    console.print("[dim]Click to visualize each algorithm's route:[/dim]\n")

    table = Table(box=box.SIMPLE, show_header=True, header_style="bold")
    table.add_column("Algorithm", style="cyan")
    table.add_column("Est. Time", justify="right")
    table.add_column("Google Maps Link")

    for r in results:
        if r["gmaps_url"]:
            travel_time = f"{r['travel_time']:.1f} min"
            link = f"[link={r['gmaps_url']}][blue underline]Open in Google Maps[/blue underline][/link]"
        else:
            travel_time = "-"
            link = "[red]No path found[/red]"

        table.add_row(r["name"], travel_time, link)

    console.print(table)
    
    # Also print raw URLs for easy copying
    console.print("\n[dim]Raw URLs (for copying):[/dim]")
    for r in results:
        if r["gmaps_url"]:
            console.print(f"[yellow]{r['name']}:[/yellow]")
            console.print(f"  {r['gmaps_url']}\n")


if __name__ == "__main__":
    main()
