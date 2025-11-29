"""Interactive user interface functions."""

from collections import defaultdict

from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt
from rich import box
from getch import getch

from config import PRESET_REGIONS
from api import search_city_bbox

console = Console()


def choose_region():
    """Interactive region selection using getch."""
    while True:
        console.print("\n[bold cyan]Choose region source:[/bold cyan]")
        console.print("1) Preset regions")
        console.print("2) Search city name (auto bounding box)")
        console.print("3) Enter bounding box manually")
        console.print("[yellow]Press 1, 2 or 3 [/yellow]")

        ch = getch()
        console.print(f"[green]You pressed:[/green] {ch}\n")

        if ch == "1":
            return _choose_preset_region()
        elif ch == "2":
            bbox = _search_city()
            if bbox:
                return bbox
        elif ch == "3":
            bbox = _enter_manual_bbox()
            if bbox:
                return bbox
        else:
            console.print("[red]Invalid key, please press 1, 2, or 3.[/red]")


def _choose_preset_region():
    """Display and select from preset regions."""
    table = Table(title="Preset Regions", box=box.ROUNDED)
    table.add_column("Key", justify="right")
    table.add_column("Name")
    
    for key, (name, _) in PRESET_REGIONS.items():
        table.add_row(key, name)
    console.print(table)
    console.print("[yellow]Press 1-9 to select [/yellow]")

    region_key = getch()
    console.print(f"[green]You pressed:[/green] {region_key}")

    if region_key not in PRESET_REGIONS:
        console.print("[red]Invalid key, please press 1-9[/red]")
        return None

    chosen_name, chosen_bbox = PRESET_REGIONS[region_key]
    console.print(f"[cyan]Chosen region:[/cyan] {chosen_name}")
    return chosen_bbox


def _search_city():
    """Search for a city and return its bounding box."""
    city = Prompt.ask("Enter city name")
    bbox = search_city_bbox(city)
    
    if not bbox:
        console.print("[red]City not found or error from Nominatim.[/red]")
        return None
        
    console.print(f"[cyan]Using bounding box from Nominatim for {city}[/cyan]")
    return bbox


def _enter_manual_bbox():
    """Manually enter bounding box coordinates."""
    console.print("Enter bounding box coordinates:")
    try:
        south = float(Prompt.ask("South latitude"))
        west = float(Prompt.ask("West longitude"))
        north = float(Prompt.ask("North latitude"))
        east = float(Prompt.ask("East longitude"))
        return (south, west, north, east)
    except ValueError:
        console.print("[red]Invalid number[/red]")
        return None


def choose_place(places):
    """Interactive place selection by category or search."""
    if not places:
        console.print("[red]No places available in this region.[/red]")
        return None

    while True:
        console.print("\n[bold cyan]Choose selection mode:[/bold cyan]")
        console.print("1) Browse by category")
        console.print("2) Search by name")
        console.print("[yellow]Press 1 or 2 [/yellow]")

        ch = getch()
        console.print(f"[green]You pressed:[/green] {ch}")

        if ch == "1":
            place = _browse_by_category(places)
            if place:
                return place
        elif ch == "2":
            place = _search_by_name(places)
            if place:
                return place
        else:
            console.print("[red]Invalid key, press 1 or 2.[/red]")


def _browse_by_category(places):
    """Browse places by category."""
    cats = defaultdict(list)
    for p in places:
        cats[p.category].append(p)

    # Show categories
    table = Table(title="Categories", box=box.ROUNDED)
    table.add_column("No", justify="right")
    table.add_column("Category")
    table.add_column("Count", justify="right")

    categories = sorted(cats.keys())
    for i, cat in enumerate(categories, start=1):
        table.add_row(str(i), cat, str(len(cats[cat])))
    console.print(table)

    # Select category
    idx = _get_selection_index(len(categories), "category")
    if idx is None:
        return None

    chosen_cat = categories[idx]
    subset = cats[chosen_cat]

    # Show places in category
    t2 = Table(title=f"Places in '{chosen_cat}'", box=box.ROUNDED)
    t2.add_column("No", justify="right")
    t2.add_column("Name")
    t2.add_column("Street")
    for i, p in enumerate(subset, start=1):
        t2.add_row(str(i), p.name, p.street or "-")
    console.print(t2)

    # Select place
    pidx = _get_selection_index(len(subset), "place", use_prompt=True)
    if pidx is None:
        return None

    return subset[pidx]


def _search_by_name(places):
    """Search places by name keyword."""
    term = Prompt.ask("Enter keyword to search").lower()
    matches = [p for p in places if term in p.name.lower()]

    if not matches:
        console.print("[red]No matches found.[/red]")
        return None

    table = Table(title=f"Search results for '{term}'", box=box.ROUNDED)
    table.add_column("No", justify="right")
    table.add_column("Name")
    table.add_column("Category")
    table.add_column("Street")

    for i, p in enumerate(matches, start=1):
        table.add_row(str(i), p.name, p.category, p.street or "-")
    console.print(table)

    pidx = _get_selection_index(len(matches), "place", use_prompt=True)
    if pidx is None:
        return None

    return matches[pidx]


def _get_selection_index(max_items, item_type, use_prompt=False):
    """Get a valid selection index from user input."""
    if not use_prompt and max_items <= 9:
        console.print(f"[yellow]Press 1-{max_items} to select [/yellow]")
        ch = getch()
        console.print(f"[green]You pressed:[/green] {ch}")
        
        if not ch.isdigit():
            console.print("[red]Invalid input, please press a number[/red]")
            return None
        idx = int(ch) - 1
    else:
        try:
            idx = int(Prompt.ask(f"Choose {item_type} number")) - 1
        except ValueError:
            console.print("[red]Invalid number[/red]")
            return None

    if not (0 <= idx < max_items):
        console.print("[red]Out of range[/red]")
        return None

    return idx

