import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapViewProps } from "../../types/MapTypes";

/** Parse a "lat, lng" string into a coordinate tuple, or undefined if invalid. */
function parseCoords(value: string | undefined): [number, number] | undefined {
  if (!value) {
    return undefined;
  }
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length !== 2) {
    return undefined;
  }
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (isNaN(lat) || isNaN(lng)) {
    return undefined;
  }
  return [lat, lng];
}

export function MapView({ entries, schema, communicator }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Find the first coordinates column
  const coordCol = schema.find((c) => c.type === "coordinates");

  useEffect(() => {
    if (!containerRef.current || !coordCol) {
      return;
    }

    // Collect entries with valid coordinates
    const pins: { title: string; relativePath: string; latlng: [number, number] }[] = [];
    for (const entry of entries) {
      const coords = parseCoords(entry.properties[coordCol.name]);
      if (coords) {
        pins.push({ title: entry.title, relativePath: entry.relativePath, latlng: coords });
      }
    }

    // Initialize map (or reuse existing)
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        attributionControl: true,
        zoomControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Add markers
    for (const pin of pins) {
      const marker = L.circleMarker(pin.latlng, {
        radius: 8,
        color: "var(--vscode-charts-blue, #1a73e8)",
        fillColor: "var(--vscode-charts-blue, #1a73e8)",
        fillOpacity: 0.7,
        weight: 2,
      }).addTo(map);

      marker.bindPopup(`<strong>${pin.title}</strong>`);
      marker.on("dblclick", () => {
        communicator.sendOpenEntry(pin.relativePath);
      });
    }

    // Fit bounds to show all markers
    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map((p) => p.latlng));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      // Default world view
      map.setView([20, 0], 2);
    }

    // Force a resize in case the container was hidden when map was created
    setTimeout(() => map.invalidateSize(), 100);
  }, [entries, coordCol, communicator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!coordCol) {
    return (
      <div className="map-view-empty">
        <p>No coordinates column found in the schema.</p>
        <p>Add a column of type <strong>coordinates</strong> to enable the map view.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="map-view-container" />;
}
