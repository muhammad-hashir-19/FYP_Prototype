/**
 * RASTA Leaflet Map Module
 * Interactive GIS mapping & spatial plotting of detected potholes in society area.
 * Uses official free OpenStreetMap tiles (No API key required).
 */

class RASTAMap {
  constructor(elementId) {
    this.elementId = elementId;
    this.map = null;
    this.markersLayer = null;
    this.trajectoryLayer = null;
    this.isInitialized = false;

    // Picker Map properties
    this.pickerMap = null;
    this.startMarker = null;
    this.endMarker = null;
    this.pickerRouteLine = null;
    this.clickState = 'start'; // 'start' or 'end'
  }

  init(centerLat = 31.4805, centerLng = 74.3070, zoom = 15) {
    if (this.isInitialized || !document.getElementById(this.elementId)) return;

    if (typeof L === 'undefined') {
      console.error('Leaflet library not loaded.');
      return;
    }

    this.map = L.map(this.elementId, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: true
    });

    // Official Free OpenStreetMap Tile Layer (No API Key Required!)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.trajectoryLayer = L.layerGroup().addTo(this.map);
    this.isInitialized = true;

    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 200);
  }

  // Interactive Route Picker Map on Tab 1 (Upload Page)
  initPickerMap(elementId, startGps, endGps, onLocationChange) {
    if (this.pickerMap || !document.getElementById(elementId)) return;

    this.pickerMap = L.map(elementId, {
      center: [startGps.lat, startGps.lng],
      zoom: 15,
      zoomControl: true
    });

    // Official Free OpenStreetMap Tile Layer (No API Key Required!)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.pickerMap);

    this.updatePickerMarkers(startGps, endGps);

    // Click on map to update Start Pin (1st click) and End Pin (2nd click)
    this.pickerMap.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (this.clickState === 'start') {
        startGps.lat = lat;
        startGps.lng = lng;
        this.clickState = 'end';
      } else {
        endGps.lat = lat;
        endGps.lng = lng;
        this.clickState = 'start';
      }
      this.updatePickerMarkers(startGps, endGps);
      if (onLocationChange) onLocationChange(startGps, endGps);
    });

    setTimeout(() => {
      if (this.pickerMap) this.pickerMap.invalidateSize();
    }, 300);
  }

  updatePickerMarkers(startGps, endGps) {
    if (!this.pickerMap) return;

    if (this.startMarker) this.pickerMap.removeLayer(this.startMarker);
    if (this.endMarker) this.pickerMap.removeLayer(this.endMarker);
    if (this.pickerRouteLine) this.pickerMap.removeLayer(this.pickerRouteLine);

    // Start Pin (Blue)
    this.startMarker = L.circleMarker([startGps.lat, startGps.lng], {
      radius: 11,
      fillColor: '#E2793D',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1
    }).bindPopup('<b>📍 Video Start Point (00:00)</b>').addTo(this.pickerMap);

    // End Pin (Red)
    this.endMarker = L.circleMarker([endGps.lat, endGps.lng], {
      radius: 11,
      fillColor: '#1C2024',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1
    }).bindPopup('<b>🏁 Video End Point (Endpoint)</b>').addTo(this.pickerMap);

    // Route line
    this.pickerRouteLine = L.polyline([
      [startGps.lat, startGps.lng],
      [endGps.lat, endGps.lng]
    ], {
      color: '#E2793D',
      weight: 4,
      dashArray: '6, 6'
    }).addTo(this.pickerMap);

    const bounds = L.latLngBounds([
      [startGps.lat, startGps.lng],
      [endGps.lat, endGps.lng]
    ]);
    this.pickerMap.fitBounds(bounds, { padding: [30, 30] });
  }

  // OpenStreetMap Nominatim Geocoding API Search
  searchMapLocation(query, onSearchResult) {
    if (!query) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    fetch(url, {
      headers: {
        'User-Agent': 'RASTA-Pothole-Detection-App'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);

          if (this.pickerMap) {
            this.pickerMap.setView([lat, lng], 16);
          }
          if (onSearchResult) onSearchResult(lat, lng, first.display_name);
        } else {
          alert(`Location "${query}" not found on OpenStreetMap. Try specifying city name (e.g. "${query}, Lahore")`);
        }
      })
      .catch(err => console.error("Geocoding API error:", err));
  }

  plotPotholes(potholes) {
    if (!this.map) return;
    this.clearLayers();

    if (!potholes || potholes.length === 0) return;

    const bounds = [];
    const points = [];

    potholes.forEach(ph => {
      bounds.push([ph.lat, ph.lng]);
      points.push([ph.lat, ph.lng]);

      const color = ph.severity === 'HIGH' ? '#E24B4A' : (ph.severity === 'MEDIUM' ? '#EF9F27' : '#639922');

      const marker = L.circleMarker([ph.lat, ph.lng], {
        radius: 11,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      });

      L.circle([ph.lat, ph.lng], {
        radius: 3.0,
        color: color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.15
      }).addTo(this.markersLayer);

      const popupHtml = `
        <div style="font-family: 'Inter', sans-serif; width: 220px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color: ${color}; font-family: 'Outfit'; font-size: 14px;">POTHOLE #${ph.id}</strong>
            <span style="background:rgba(0,0,0,0.1); padding:2px 6px; border-radius:4px; font-size:10px;">${ph.severity}</span>
          </div>
          ${ph.thumbUrl ? `<img src="${ph.thumbUrl}" style="width:100%; height:95px; object-fit:cover; border-radius:6px; margin-bottom:8px; border:1px solid #334155;"/>` : ''}
          <div style="font-size: 11px; line-height: 1.5; color: #cbd5e1;">
            <div><strong>Confidence:</strong> ${(ph.confidence * 100).toFixed(0)}%</div>
            <div><strong>Area:</strong> ${ph.estimatedAreaCm2} cm² (${ph.depthCm}cm deep)</div>
            <div><strong>Latitude:</strong> ${ph.lat.toFixed(6)}</div>
            <div><strong>Longitude:</strong> ${ph.lng.toFixed(6)}</div>
            <div style="margin-top:6px; font-weight:600; color:${color}; font-size:10px;">${ph.recommendation}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.addTo(this.markersLayer);
    });

    if (points.length >= 2) {
      const polyline = L.polyline(points, {
        color: '#E2793D',
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 6'
      }).addTo(this.trajectoryLayer);

      this.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } else if (bounds.length > 0) {
      this.map.setView(bounds[0], 16);
    }
  }

  clearLayers() {
    if (this.markersLayer) this.markersLayer.clearLayers();
    if (this.trajectoryLayer) this.trajectoryLayer.clearLayers();
  }
}

window.RASTAMap = RASTAMap;
