import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { defaultIcon, selectedIcon } from "./icons/mapIcons";
import "leaflet-routing-machine";

const App = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [routeControl, setRouteControl] = useState(null);
  const [homeLocation, setHomeLocation] = useState(null); // New state for home location
  const [error, setError] = useState(null); // State for error handling
  const [isLoading, setIsLoading] = useState(false); // State to manage loading status

  // Fetch schools data only once
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await fetch("/data/eastSchools/eastschools.json");
        if (!response.ok) {
          throw new Error("Failed to fetch schools data");
        }
        const data = await response.json();
        setSchools(data);
      } catch (error) {
        setError(error.message);
        console.error("Error loading schools data:", error);
      }
    };

    fetchSchools();
  }, []); // Empty dependency array ensures this runs only once

  const toggleSchoolSelection = (school) => {
    setSelectedSchools((prevSelected) =>
      prevSelected.some((s) => s.name === school.name)
        ? prevSelected.filter((s) => s.name !== school.name)
        : [...prevSelected, school]
    );
  };

  const selectHomeLocation = (school) => {
    // Set the home location but keep the other selected schools
    setHomeLocation(school);
    setSelectedSchools((prevSelected) =>
      prevSelected.some((s) => s.name === school.name)
        ? prevSelected
        : [...prevSelected, school]
    );
  };

  const calculateRoute = async (map) => {
    if (!homeLocation) {
      alert("Please select a valid home location.");
      return;
    }

    if (selectedSchools.length < 2) {
      alert("Please select at least two schools.");
      return;
    }

    const routePoints = selectedSchools
      .map((school) => {
        if (school.lng && school.lat) {
          return `${school.lng},${school.lat}`;
        } else {
          console.error(`Invalid coordinates for school: ${school.name}`);
          return null;
        }
      })
      .filter((point) => point !== null);

    if (routePoints.length < 2) {
      alert("Not enough valid coordinates to calculate route.");
      return;
    }

    const start = `${homeLocation.lng},${homeLocation.lat}`;
    const end = `${homeLocation.lng},${homeLocation.lat}`;
    const waypoints = routePoints.filter((point) => point !== start).join(";");

    // Set loading state to true before API call
    setIsLoading(true);

    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://api.openrouteservice.org/v2/directions/driving-car?api_key=5b3ce3597851110001cf6248e2f9108060834fe98e30f896774f5ddb&start=${start}&waypoints=${waypoints}&end=${end}`
        );
        if (response.status === 429) {
          throw new Error("Rate limit exceeded");
        }
        const data = await response.json();

        if (data.error) {
          console.error(`Error from API: ${data.error.message}`);
          return;
        }

        const routeGeoJSON = data.features[0].geometry.coordinates;
        const latLngs = routeGeoJSON.map(([lng, lat]) => [lat, lng]);

        // Add route control to the map
        if (routeControl) {
          routeControl.remove();
        }

        const newRouteControl = L.Routing.control({
          waypoints: latLngs.map((point) => L.latLng(point)),
          routeWhileDragging: true,
          createMarker: () => null,
        }).addTo(map);

        setRouteControl(newRouteControl);

        // Set total distance in kilometers
        const totalDistance = data.features[0].properties.segments[0].distance / 1000;
        setTotalDistance(totalDistance);
      } catch (error) {
        console.error("Error calculating route:", error);
      } finally {
        setIsLoading(false); // Reset loading state after API call
      }
    };

    fetchRoute();
  };

  const MapWithRoutingControl = ({ onCalculateRoute }) => {
    const map = useMap();

    // Pass the map instance to the parent component
    useEffect(() => {
      if (map) {
        onCalculateRoute(map);
      }
    }, [map, onCalculateRoute]);

    return null;
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: "300px", padding: "10px", background: "#f8f9fa", overflowY: "auto" }}>
        <h2>Select Home Location</h2>
        {error && <div style={{ color: "red" }}>{error}</div>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {schools.map((school) => (
            <li
              key={school.name}
              style={{
                margin: "5px 0",
                cursor: "pointer",
                fontWeight: homeLocation && homeLocation.name === school.name ? "bold" : "normal",
              }}
              onClick={() => selectHomeLocation(school)}
            >
              {homeLocation && homeLocation.name === school.name ? "🏠" : "⚫"} {school.name}
            </li>
          ))}
        </ul>

        <h2>Select Schools to Include in Route</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {schools.map((school) => (
            <li
              key={school.name}
              style={{
                margin: "5px 0",
                cursor: "pointer",
                fontWeight: selectedSchools.some((s) => s.name === school.name) ? "bold" : "normal",
              }}
              onClick={() => toggleSchoolSelection(school)}
            >
              {selectedSchools.some((s) => s.name === school.name) ? "✔️" : "⚫"} {school.name}
            </li>
          ))}
        </ul>

        {totalDistance && (
          <div>
            <h4>Total Distance: {totalDistance.toFixed(2)} km</h4>
          </div>
        )}

        {/* Calculate Route button */}
        <button
          onClick={() => {
            const map = document.querySelector(".leaflet-container")._leaflet_map;
            calculateRoute(map);
          }}
          style={{
            padding: "10px",
            background: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "16px",
            marginTop: "10px",
          }}
          disabled={isLoading || !homeLocation || selectedSchools.length < 2} // Disable button if conditions aren't met
        >
          {isLoading ? "Calculating..." : "Calculate Route"}
        </button>
      </div>

      <MapContainer center={[43.898527, -79.240531]} zoom={13} style={{ flex: 1 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {schools.map((school) => (
          <Marker
            key={school.name}
            position={[school.lat, school.lng]}
            icon={homeLocation && homeLocation.name === school.name ? selectedIcon : defaultIcon}
            eventHandlers={{
              click: () => toggleSchoolSelection(school),
            }}
          >
            <Tooltip direction="top" opacity={1} permanent={false}>
              {school.name}
            </Tooltip>
          </Marker>
        ))}

        <MapWithRoutingControl onCalculateRoute={(map) => calculateRoute(map)} />
      </MapContainer>
    </div>
  );
};

export default App;