// Main application logic

import { PRESET_REGIONS } from './config.js';
import { searchCityBbox, fetchOverpassData } from './api.js';
import { parseOverpassToGraph, buildGraph, mapPlacesToNearestNodes, groupPlacesByCategory } from './graph.js';
import { ALGORITHMS, runAlgorithm } from './routing.js';

// Application state
const state = {
    bbox: null,
    nodeCoords: null,
    graph: null,
    places: [],
    categories: null,
    startPlace: null,
    destPlace: null,
    results: []
};

// DOM Elements
const elements = {
    // Tabs
    regionTabs: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    
    // Preset
    presetGrid: document.getElementById('preset-grid'),
    
    // Search
    citySearch: document.getElementById('city-search'),
    searchCityBtn: document.getElementById('search-city-btn'),
    
    // Manual
    bboxSouth: document.getElementById('bbox-south'),
    bboxWest: document.getElementById('bbox-west'),
    bboxNorth: document.getElementById('bbox-north'),
    bboxEast: document.getElementById('bbox-east'),
    manualBboxBtn: document.getElementById('manual-bbox-btn'),
    
    // Selected region
    selectedRegion: document.getElementById('selected-region'),
    regionValue: document.getElementById('region-value'),
    
    // Loading
    loadingSection: document.getElementById('loading-section'),
    loadingText: document.getElementById('loading-text'),
    progressInfo: document.getElementById('progress-info'),
    
    // Places
    stepPlaces: document.getElementById('step-places'),
    graphStats: document.getElementById('graph-stats'),
    startCategory: document.getElementById('start-category'),
    startPlace: document.getElementById('start-place'),
    startSearch: document.getElementById('start-search'),
    startSearchResults: document.getElementById('start-search-results'),
    startSelected: document.getElementById('start-selected'),
    destCategory: document.getElementById('dest-category'),
    destPlace: document.getElementById('dest-place'),
    destSearch: document.getElementById('dest-search'),
    destSearchResults: document.getElementById('dest-search-results'),
    destSelected: document.getElementById('dest-selected'),
    computeBtn: document.getElementById('compute-btn'),
    
    // Results
    stepResults: document.getElementById('step-results'),
    theoryTable: document.getElementById('theory-table').querySelector('tbody'),
    graphSizeInfo: document.getElementById('graph-size-info'),
    performanceTable: document.getElementById('performance-table').querySelector('tbody'),
    analysisPanel: document.getElementById('analysis-panel'),
    routeComparison: document.getElementById('route-comparison'),
    mapsGrid: document.getElementById('maps-grid'),
    mapTabs: document.getElementById('map-tabs'),
    routeMap: document.getElementById('route-map'),
    resetBtn: document.getElementById('reset-btn')
};

// Leaflet map instance
let leafletMap = null;
let routeLayer = null;
let markersLayer = null;

// Initialize app
function init() {
    renderPresetRegions();
    setupEventListeners();
}

// Render preset regions
function renderPresetRegions() {
    elements.presetGrid.innerHTML = '';
    
    for (const [key, region] of Object.entries(PRESET_REGIONS)) {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.dataset.key = key;
        card.innerHTML = `
            <span class="key">${key}</span>
            <span class="name">${region.name}</span>
        `;
        card.addEventListener('click', () => selectPresetRegion(key));
        elements.presetGrid.appendChild(card);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    elements.regionTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // City search
    elements.searchCityBtn.addEventListener('click', handleCitySearch);
    elements.citySearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCitySearch();
    });
    
    // Manual bbox
    elements.manualBboxBtn.addEventListener('click', handleManualBbox);
    
    // Place selection
    elements.startCategory.addEventListener('change', () => handleCategoryChange('start'));
    elements.destCategory.addEventListener('change', () => handleCategoryChange('dest'));
    elements.startPlace.addEventListener('change', () => handlePlaceSelect('start'));
    elements.destPlace.addEventListener('change', () => handlePlaceSelect('dest'));
    
    // Place search
    elements.startSearch.addEventListener('input', () => handlePlaceSearch('start'));
    elements.destSearch.addEventListener('input', () => handlePlaceSearch('dest'));
    
    // Compute button
    elements.computeBtn.addEventListener('click', computeRoutes);
    
    // Reset button
    elements.resetBtn.addEventListener('click', resetApp);
}

// Switch tabs
function switchTab(tabId) {
    // If a region is already selected, reset the process when switching selection methods
    if (state.bbox) {
        resetApp();
    }

    elements.regionTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    elements.tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
}

// Select preset region
function selectPresetRegion(key) {
    const region = PRESET_REGIONS[key];
    if (!region) return;
    
    // Update UI
    document.querySelectorAll('.preset-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.key === key);
    });
    
    state.bbox = region.bbox;
    showSelectedRegion(`${region.name} [${region.bbox.join(', ')}]`);
    loadMapData();
}

// Handle city search
async function handleCitySearch() {
    const city = elements.citySearch.value.trim();
    if (!city) return;
    
    showLoading('Searching for city...');
    
    const bbox = await searchCityBbox(city);
    
    if (!bbox) {
        hideLoading();
        alert('City not found. Please try another name.');
        return;
    }
    
    state.bbox = bbox;
    showSelectedRegion(`${city} [${bbox.join(', ')}]`);
    loadMapData();
}

// Handle manual bbox
function handleManualBbox() {
    const south = parseFloat(elements.bboxSouth.value);
    const west = parseFloat(elements.bboxWest.value);
    const north = parseFloat(elements.bboxNorth.value);
    const east = parseFloat(elements.bboxEast.value);
    
    if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
        alert('Please enter valid numbers for all coordinates.');
        return;
    }
    
    state.bbox = [south, west, north, east];
    showSelectedRegion(`Custom [${state.bbox.join(', ')}]`);
    loadMapData();
}

// Show selected region
function showSelectedRegion(text) {
    elements.regionValue.textContent = text;
    elements.selectedRegion.style.display = 'flex';
}

// Show/hide loading
function showLoading(text) {
    elements.loadingSection.style.display = 'flex';
    elements.loadingText.textContent = text;
    elements.progressInfo.textContent = '';
}

function updateProgress(text) {
    elements.progressInfo.textContent = text;
}

function hideLoading() {
    elements.loadingSection.style.display = 'none';
}

// Load map data
async function loadMapData() {
    showLoading('Fetching map data from Overpass API...');
    
    const data = await fetchOverpassData(state.bbox, updateProgress);
    
    if (!data) {
        hideLoading();
        alert('Error fetching map data. Please try again or choose a different region.');
        return;
    }
    
    updateProgress('Building road graph...');
    const { nodeCoords, edges, placesRaw } = parseOverpassToGraph(data, updateProgress);
    
    state.nodeCoords = nodeCoords;
    const graph = buildGraph(edges);
    state.graph = graph;
    
    const graphNodes = new Set(graph.keys());
    
    if (graphNodes.size === 0) {
        hideLoading();
        alert('No road graph found in this region. Try a larger area.');
        return;
    }
    
    updateProgress('Mapping places to road network...');
    const places = mapPlacesToNearestNodes(placesRaw, graphNodes, nodeCoords, updateProgress);
    
    if (places.length === 0) {
        hideLoading();
        alert('No named places found in this region. Try a different area.');
        return;
    }
    
    state.places = places;
    state.categories = groupPlacesByCategory(places);
    
    // Reset selection state for new region
    state.startPlace = null;
    state.destPlace = null;
    state.results = [];
    
    // Reset UI for selection
    elements.startSelected.style.display = 'none';
    elements.destSelected.style.display = 'none';
    elements.startPlace.innerHTML = '<option value="">-- Select Place --</option>';
    elements.startPlace.disabled = true;
    elements.destPlace.innerHTML = '<option value="">-- Select Place --</option>';
    elements.destPlace.disabled = true;
    elements.startSearch.value = '';
    elements.destSearch.value = '';
    
    updateComputeButton();

    hideLoading();
    showPlacesSection(graphNodes.size, edges.length);
}

// Show places section
function showPlacesSection(numNodes, numEdges) {
    elements.stepPlaces.style.display = 'block';
    
    // Show graph stats
    elements.graphStats.innerHTML = `
        <strong>${numNodes.toLocaleString()}</strong> road intersections • 
        <strong>${numEdges.toLocaleString()}</strong> road segments • 
        <strong>${state.places.length.toLocaleString()}</strong> named places
    `;
    
    // Populate category dropdowns
    populateCategoryDropdowns();
    
    // Scroll to places section
    elements.stepPlaces.scrollIntoView({ behavior: 'smooth' });
}

// Populate category dropdowns
function populateCategoryDropdowns() {
    const categories = Array.from(state.categories.keys()).sort();
    
    const optionsHtml = categories.map(cat => {
        const count = state.categories.get(cat).length;
        return `<option value="${cat}">${cat} (${count})</option>`;
    }).join('');
    
    elements.startCategory.innerHTML = '<option value="">-- Select Category --</option>' + optionsHtml;
    elements.destCategory.innerHTML = '<option value="">-- Select Category --</option>' + optionsHtml;
}

// Handle category change
function handleCategoryChange(type) {
    const categorySelect = type === 'start' ? elements.startCategory : elements.destCategory;
    const placeSelect = type === 'start' ? elements.startPlace : elements.destPlace;
    
    const category = categorySelect.value;
    
    if (!category) {
        placeSelect.innerHTML = '<option value="">-- Select Place --</option>';
        placeSelect.disabled = true;
        return;
    }
    
    const places = state.categories.get(category) || [];
    const optionsHtml = places.map((p, i) => 
        `<option value="${i}">${p.name}${p.street ? ` (${p.street})` : ''}</option>`
    ).join('');
    
    placeSelect.innerHTML = '<option value="">-- Select Place --</option>' + optionsHtml;
    placeSelect.disabled = false;
}

// Handle place select
function handlePlaceSelect(type) {
    const categorySelect = type === 'start' ? elements.startCategory : elements.destCategory;
    const placeSelect = type === 'start' ? elements.startPlace : elements.destPlace;
    const selectedDiv = type === 'start' ? elements.startSelected : elements.destSelected;
    
    const category = categorySelect.value;
    const placeIndex = placeSelect.value;
    
    if (!category || placeIndex === '') {
        if (type === 'start') state.startPlace = null;
        else state.destPlace = null;
        selectedDiv.style.display = 'none';
        updateComputeButton();
        return;
    }
    
    const places = state.categories.get(category) || [];
    const place = places[parseInt(placeIndex)];
    
    if (type === 'start') state.startPlace = place;
    else state.destPlace = place;
    
    selectedDiv.style.display = 'block';
    selectedDiv.innerHTML = `
        <div class="place-name">✓ ${place.name}</div>
        <div class="place-info">${place.category}${place.street ? ` • ${place.street}` : ''}</div>
    `;
    
    updateComputeButton();
}

// Handle place search
function handlePlaceSearch(type) {
    const searchInput = type === 'start' ? elements.startSearch : elements.destSearch;
    const resultsDiv = type === 'start' ? elements.startSearchResults : elements.destSearchResults;
    
    const term = searchInput.value.toLowerCase().trim();
    
    if (term.length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    const matches = state.places
        .filter(p => p.name.toLowerCase().includes(term))
        .slice(0, 10);
    
    if (matches.length === 0) {
        resultsDiv.innerHTML = '<p class="hint">No matches found</p>';
        return;
    }
    
    resultsDiv.innerHTML = matches.map((p, i) => `
        <div class="search-result-item" data-index="${state.places.indexOf(p)}" data-type="${type}">
            <div class="name">${p.name}</div>
            <div class="details">${p.category}${p.street ? ` • ${p.street}` : ''}</div>
        </div>
    `).join('');
    
    // Add click handlers
    resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const place = state.places[index];
            selectPlaceFromSearch(type, place);
            resultsDiv.innerHTML = '';
            searchInput.value = '';
        });
    });
}

// Select place from search
function selectPlaceFromSearch(type, place) {
    const selectedDiv = type === 'start' ? elements.startSelected : elements.destSelected;
    
    if (type === 'start') state.startPlace = place;
    else state.destPlace = place;
    
    selectedDiv.style.display = 'block';
    selectedDiv.innerHTML = `
        <div class="place-name">✓ ${place.name}</div>
        <div class="place-info">${place.category}${place.street ? ` • ${place.street}` : ''}</div>
    `;
    
    updateComputeButton();
}

// Update compute button state
function updateComputeButton() {
    elements.computeBtn.disabled = !(state.startPlace && state.destPlace);
}

// Compute routes
function computeRoutes() {
    if (!state.startPlace || !state.destPlace) return;
    
    showLoading('Computing shortest paths...');
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
        const results = [];
        
        for (const algo of ALGORITHMS) {
            updateProgress(`Running ${algo.name}...`);
            const result = runAlgorithm(
                algo,
                state.graph,
                state.startPlace.nearestNode,
                state.destPlace.nearestNode,
                state.nodeCoords
            );
            results.push(result);
        }
        
        state.results = results;
        hideLoading();
        showResults();
    }, 50);
}

// Show results
function showResults() {
    elements.stepResults.style.display = 'block';
    
    // Theory table
    elements.theoryTable.innerHTML = state.results.map(r => {
        const spaceClass = r.spaceNote === 'Highest' ? 'space-high' : 
                          r.spaceNote === 'High' ? 'space-medium' : 'space-low';
        return `
            <tr>
                <td class="algo-name">${r.name}</td>
                <td class="complexity time-complexity">${r.timeComplexity}</td>
                <td class="complexity space-complexity">
                    <span class="space-badge ${spaceClass}">${r.spaceNote}</span>
                    <span class="space-formula">${r.spaceComplexity}</span>
                </td>
                <td class="description">${r.description}</td>
            </tr>
        `;
    }).join('');
    
    // Graph size info
    const numVertices = state.graph.size;
    const numEdges = Array.from(state.graph.values()).reduce((sum, arr) => sum + arr.length, 0);
    elements.graphSizeInfo.textContent = `Graph size: V = ${numVertices.toLocaleString()} vertices, E = ${numEdges.toLocaleString()} edges`;
    
    // Performance table
    elements.performanceTable.innerHTML = state.results.map(r => `
        <tr>
            <td class="algo-name">${r.name}</td>
            <td class="num">${r.path ? `${r.travelTime.toFixed(1)} min` : '-'}</td>
            <td class="num">${r.nodesExplored.toLocaleString()}</td>
            <td class="num">${r.execTimeMs.toFixed(2)}</td>
            <td class="num">${r.path ? r.pathLength : '-'}</td>
            <td class="${r.path ? 'status-found' : 'status-notfound'}">
                ${r.path ? '✔ Found' : '✘ No Path'}
            </td>
        </tr>
    `).join('');
    
    // Analysis
    renderAnalysis();
    
    // Route comparison
    renderRouteComparison();
    
    // Maps links
    renderMapsLinks();
    
    // Map embed
    renderMapEmbed();
    
    // Scroll to results
    elements.stepResults.scrollIntoView({ behavior: 'smooth' });
}

// Render analysis
function renderAnalysis() {
    const successful = state.results.filter(r => r.path);
    
    if (successful.length === 0) {
        elements.analysisPanel.innerHTML = '<p style="text-align:center; color: var(--text-muted);">No paths found between the selected locations.</p>';
        return;
    }
    
    const fastest = successful.reduce((a, b) => a.execTimeMs < b.execTimeMs ? a : b);
    const leastNodes = successful.reduce((a, b) => a.nodesExplored < b.nodesExplored ? a : b);
    
    let html = `
        <div class="stat-card speed">
            <div class="icon-wrapper">⚡</div>
            <div class="stat-content">
                <div class="stat-label">Fastest Execution</div>
                <div class="stat-value">${fastest.name}</div>
                <div class="stat-sub">${fastest.execTimeMs.toFixed(2)} ms</div>
            </div>
        </div>
        <div class="stat-card efficiency">
            <div class="icon-wrapper">🎯</div>
            <div class="stat-content">
                <div class="stat-label">Most Efficient</div>
                <div class="stat-value">${leastNodes.name}</div>
                <div class="stat-sub">${leastNodes.nodesExplored.toLocaleString()} nodes explored</div>
            </div>
        </div>
    `;
    
    // Calculate efficiency vs Dijkstra
    const dijkstraResult = successful.find(r => r.name === 'Dijkstra');
    if (dijkstraResult) {
        // Find the best improvement over Dijkstra (excluding Dijkstra itself)
        let bestReduction = 0;
        let bestAlgo = null;

        for (const r of successful) {
            if (r.name !== 'Dijkstra' && dijkstraResult.nodesExplored > 0) {
                const reduction = (1 - r.nodesExplored / dijkstraResult.nodesExplored) * 100;
                if (reduction > bestReduction) {
                    bestReduction = reduction;
                    bestAlgo = r;
                }
            }
        }

        if (bestAlgo && bestReduction > 0) {
            html += `
                <div class="stat-card comparison">
                    <div class="icon-wrapper">📊</div>
                    <div class="stat-content">
                        <div class="stat-label">Optimization Gain</div>
                        <div class="stat-value">${bestReduction.toFixed(1)}% <span style="font-size: 0.8em; color: var(--text-muted);">Better</span></div>
                        <div class="stat-sub">${bestAlgo.name} vs Dijkstra</div>
                    </div>
                </div>
            `;
        }
    }
    
    elements.analysisPanel.innerHTML = html;
}

// Render route comparison
function renderRouteComparison() {
    const successful = state.results.filter(r => r.path);
    
    if (successful.length < 2) {
        elements.routeComparison.style.display = 'none';
        return;
    }
    
    elements.routeComparison.style.display = 'block';
    
    // Check if all paths are identical
    const paths = successful.map(r => r.path.join(','));
    const uniquePaths = new Set(paths);
    
    // Check travel times
    const travelTimes = successful.map(r => r.travelTime.toFixed(4));
    const sameTime = new Set(travelTimes).size === 1;
    
    let html = '<h4>🛣️ Route Analysis</h4>';
    
    if (uniquePaths.size === 1) {
        html += `
            <p class="same-route">✓ All algorithms found the EXACT SAME route!</p>
            <p class="route-detail">Path has ${successful[0].pathLength} nodes, travel time: ${successful[0].travelTime.toFixed(1)} min</p>
        `;
    } else {
        html += `<p class="diff-route">⚠ Algorithms found ${uniquePaths.size} DIFFERENT routes!</p>`;
        if (sameTime) {
            html += `<p class="route-detail">However, all routes have the same optimal travel time.</p>`;
            html += `<p class="route-detail" style="color: var(--text-muted);">(Multiple optimal paths exist in the road network)</p>`;
        } else {
            html += `<p class="route-detail" style="color: var(--error);">Routes have different travel times - some may be suboptimal.</p>`;
        }
        html += '<div style="margin-top: 0.75rem;">';
        for (const r of successful) {
            html += `<p class="route-detail">• ${r.name}: ${r.pathLength} nodes, ${r.travelTime.toFixed(2)} min</p>`;
        }
        html += '</div>';
    }
    
    elements.routeComparison.innerHTML = html;
}

// Render maps links
function renderMapsLinks() {
    elements.mapsGrid.innerHTML = state.results.map(r => `
        <div class="map-card">
            <div class="algo-name">${r.name}</div>
            <div class="travel-time">${r.path ? `${r.travelTime.toFixed(1)} min` : 'No path'}</div>
            ${r.gmapsUrl ? `
                <a href="${r.gmapsUrl}" target="_blank" rel="noopener noreferrer">
                    🗺️ Open in Google Maps
                </a>
            ` : '<span style="color: var(--error);">No path found</span>'}
        </div>
    `).join('');
}

// Render map embed using Leaflet
function renderMapEmbed() {
    const successful = state.results.filter(r => r.path);
    
    if (successful.length === 0) {
        elements.mapTabs.innerHTML = '';
        if (leafletMap) {
            leafletMap.remove();
            leafletMap = null;
        }
        return;
    }
    
    // Create tabs
    elements.mapTabs.innerHTML = successful.map((r, i) => `
        <button class="map-tab-btn ${i === 0 ? 'active' : ''}" data-index="${i}">
            ${r.name}
        </button>
    `).join('');
    
    // Add click handlers
    elements.mapTabs.querySelectorAll('.map-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.mapTabs.querySelectorAll('.map-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const result = successful[parseInt(btn.dataset.index)];
            displayRouteOnMap(result.path);
        });
    });
    
    // Initialize or reset map
    initLeafletMap();
    
    // Show first result
    displayRouteOnMap(successful[0].path);
}

// Initialize Leaflet map
function initLeafletMap() {
    // Destroy existing map if any
    if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
    }
    
    // Create new map
    leafletMap = L.map(elements.routeMap, {
        zoomControl: true
    });
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);
    
    // Create layer groups for route and markers
    routeLayer = L.layerGroup().addTo(leafletMap);
    markersLayer = L.layerGroup().addTo(leafletMap);
}

// Display route on the Leaflet map
function displayRouteOnMap(path) {
    if (!leafletMap || !path || path.length < 2) return;
    
    // Clear existing route and markers
    routeLayer.clearLayers();
    markersLayer.clearLayers();
    
    // Get coordinates for all nodes in the path
    const coords = path
        .filter(nid => state.nodeCoords.has(nid))
        .map(nid => {
            const [lat, lon] = state.nodeCoords.get(nid);
            return [lat, lon];
        });
    
    if (coords.length < 2) return;
    
    // Draw the route polyline
    const routeLine = L.polyline(coords, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
    }).addTo(routeLayer);
    
    // Add start marker (green)
    const startCoord = coords[0];
    const startMarker = L.marker(startCoord, {
        icon: L.divIcon({
            className: 'route-marker start-marker',
            html: '<div class="marker-pin start"><span>A</span></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        })
    }).addTo(markersLayer);
    startMarker.bindPopup(`<strong>Start:</strong> ${state.startPlace?.name || 'Start Point'}`);
    
    // Add end marker (red)
    const endCoord = coords[coords.length - 1];
    const endMarker = L.marker(endCoord, {
        icon: L.divIcon({
            className: 'route-marker end-marker',
            html: '<div class="marker-pin end"><span>B</span></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        })
    }).addTo(markersLayer);
    endMarker.bindPopup(`<strong>Destination:</strong> ${state.destPlace?.name || 'End Point'}`);
    
    // Fit map to show the entire route with padding
    leafletMap.fitBounds(routeLine.getBounds(), {
        padding: [50, 50]
    });
}

// Reset app
function resetApp() {
    // Clean up Leaflet map
    if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
        routeLayer = null;
        markersLayer = null;
    }
    
    // Reset state
    state.bbox = null;
    state.nodeCoords = null;
    state.graph = null;
    state.places = [];
    state.categories = null;
    state.startPlace = null;
    state.destPlace = null;
    state.results = [];
    
    // Reset UI
    elements.selectedRegion.style.display = 'none';
    elements.stepPlaces.style.display = 'none';
    elements.stepResults.style.display = 'none';
    
    // Reset forms
    elements.citySearch.value = '';
    elements.bboxSouth.value = '';
    elements.bboxWest.value = '';
    elements.bboxNorth.value = '';
    elements.bboxEast.value = '';
    
    elements.startCategory.value = '';
    elements.startPlace.value = '';
    elements.startPlace.disabled = true;
    elements.startSearch.value = '';
    elements.startSearchResults.innerHTML = '';
    elements.startSelected.style.display = 'none';
    
    elements.destCategory.value = '';
    elements.destPlace.value = '';
    elements.destPlace.disabled = true;
    elements.destSearch.value = '';
    elements.destSearchResults.innerHTML = '';
    elements.destSelected.style.display = 'none';
    
    elements.computeBtn.disabled = true;
    
    // Remove preset selection
    document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('selected'));
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
