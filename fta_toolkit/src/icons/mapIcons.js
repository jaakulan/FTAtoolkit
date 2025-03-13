import L from "leaflet";

export const defaultIcon = new L.Icon({
  iconUrl: "/icons/default-marker.png", // Store this in `public/icons/`
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export const selectedIcon = new L.Icon({
  iconUrl: "/icons/selected-marker.png", // Store this in `public/icons/`
  iconSize: [30, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});