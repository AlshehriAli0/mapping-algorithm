"""API interactions with Overpass and Nominatim."""

import requests
from rich.console import Console

from config import USER_AGENT

console = Console()


def search_city_bbox(city_name):
    """Use Nominatim to get a bounding box for a city name."""
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": city_name, "format": "json", "limit": 1}
    
    try:
        resp = requests.get(url, headers=USER_AGENT, params=params, timeout=20)
        resp.raise_for_status()
        results = resp.json()
    except Exception as e:
        console.print(f"[red]Error contacting Nominatim: {e}[/red]")
        return None

    if not results:
        return None

    # Nominatim bbox: [south, north, west, east]
    bbox = results[0]["boundingbox"]
    south, north, west, east = map(float, bbox)
    return (south, west, north, east)


def fetch_overpass_data(bbox):
    """Fetch roads + named places from Overpass API for a bounding box."""
    south, west, north, east = bbox
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({south},{west},{north},{east});
      node["name"]({south},{west},{north},{east});
    );
    (._;>;);
    out body;
    """
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        console.print("[yellow]Querying Overpass API... this may take a few seconds[/yellow]")
        resp = requests.post(url, headers=USER_AGENT, data={"data": query}, timeout=60)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        console.print(f"[red]Error contacting Overpass API: {e}[/red]")
        return None

