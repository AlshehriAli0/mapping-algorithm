// API interactions with Overpass and Nominatim

/**
 * Search for a city and get its bounding box using Nominatim
 * @param {string} cityName - Name of the city to search
 * @returns {Promise<[number, number, number, number] | null>} Bounding box [south, west, north, east] or null
 */
export async function searchCityBbox(cityName) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', cityName);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    try {
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'AlgoRoutingStudentProject/1.0'
            }
        });

        if (!resp.ok) {
            throw new Error(`HTTP error: ${resp.status}`);
        }

        const results = await resp.json();
        
        if (!results || results.length === 0) {
            return null;
        }

        // Nominatim bbox: [south, north, west, east]
        const bbox = results[0].boundingbox;
        const [south, north, west, east] = bbox.map(parseFloat);
        return [south, west, north, east];
    } catch (error) {
        console.error('Error contacting Nominatim:', error);
        return null;
    }
}

/**
 * Fetch roads and named places from Overpass API
 * @param {[number, number, number, number]} bbox - Bounding box [south, west, north, east]
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object | null>} Overpass JSON response or null
 */
export async function fetchOverpassData(bbox, onProgress = null) {
    const [south, west, north, east] = bbox;
    
    const query = `
    [out:json][timeout:60];
    (
      way["highway"](${south},${west},${north},${east});
      node["name"](${south},${west},${north},${east});
    );
    (._;>;);
    out body;
    `;

    const url = 'https://overpass-api.de/api/interpreter';

    try {
        if (onProgress) onProgress('Querying Overpass API...');
        
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'AlgoRoutingStudentProject/1.0'
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!resp.ok) {
            throw new Error(`HTTP error: ${resp.status}`);
        }

        if (onProgress) onProgress('Parsing response...');
        const data = await resp.json();
        return data;
    } catch (error) {
        console.error('Error contacting Overpass API:', error);
        return null;
    }
}
