"""Real-World Route Planner using Dijkstra + OSM + Overpass."""

from rich.console import Console

from api import fetch_overpass_data
from graph import parse_overpass_to_graph, build_graph, map_places_to_nearest_nodes
from routing import dijkstra, build_google_maps_url
from ui import choose_region, choose_place

console = Console()


def main():
    console.print("[bold magenta]🚗 Real-World Route Planner (Dijkstra + OSM + Overpass)[/bold magenta]\n")

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
        f"\n[cyan]Computing shortest path from[/cyan] [bold]{start.name}[/bold] "
        f"[cyan]to[/cyan] [bold]{dest.name}[/bold] ..."
    )

    # 5) Run Dijkstra
    path, total_time = dijkstra(graph, start.nearest_node, dest.nearest_node)
    if not path:
        console.print("[red]No path found between these places.[/red]")
        return

    console.print(f"[green]✔ Estimated travel time: {total_time:.1f} minutes[/green]")

    # 6) Google Maps link
    gmaps_url = build_google_maps_url(path, node_coords)
    if gmaps_url:
        console.print(f"\n[bold yellow]📍 [link={gmaps_url}]Click here to open route in Google Maps[/link][/bold yellow]")
    else:
        console.print("[red]Could not generate Google Maps URL.[/red]")


if __name__ == "__main__":
    main()
