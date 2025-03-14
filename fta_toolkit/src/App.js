import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { defaultIcon, selectedIcon } from "./icons/mapIcons";
import "leaflet-routing-machine";
import polyline from "polyline";

const App = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [routeControl, setRouteControl] = useState(null);
  const [homeLocation, setHomeLocation] = useState(null); // New state for home location
  const [error, setError] = useState(null); // State for error handling
  const [directions, setDirections] = useState([]); // State to store turn-by-turn directions
  const [mapInstance, setMapInstance] = useState(null); // State to store the map instance
  const [activeTab, setActiveTab] = useState("schools"); // State to manage active tab

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
    if (!map) {
      console.error("Map instance is not valid.");
      alert("Map instance is not valid.");
      return;
    }

    if (!homeLocation) {
      alert("Please select a valid home location.");
      return;
    }

    if (selectedSchools.length < 2) {
      alert("Please select at least two schools.");
      return;
    }

    // Prepare waypoints for Routes API
    const waypoints = selectedSchools
      .map((school) => {
        if (school.lat && school.lng) {
          return {
            location: {
              latLng: {
                latitude: school.lat,
                longitude: school.lng,
              },
            },
          };
        } else {
          console.error(`Invalid coordinates for school: ${school.name}`);
          alert(`Invalid coordinates for school: ${school.name}`);
          return null;
        }
      })
      .filter((point) => point !== null);

    if (waypoints.length < 2) {
      alert("Not enough valid schools to calculate route.");
      return;
    }

    const start = {
      location: {
        latLng: {
          latitude: homeLocation.lat,
          longitude: homeLocation.lng,
        },
      },
    };
    const end = {
      location: {
        latLng: {
          latitude: homeLocation.lat,
          longitude: homeLocation.lng,
        },
      },
    };

    // Construct the Routes API request body
    const requestBody = {
      origin: start,
      destination: end,
      intermediates: waypoints,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE", // Optional: Use traffic data
    };

    const apiKey = "AIzaSyC5KE6TbxgSEw81fb554y_EGDBkaPRHNxQ"; // Replace with your Google API key
    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(`Failed to fetch route data: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error(`Error from Routes API: ${data.error.message}`);
        alert(`Error calculating route: ${data.error.message}`);
        return;
      }

      // Extract route geometry and waypoints
      const route = data.routes[0];
      const encodedPolyline = route.polyline.encodedPolyline;

      // Decode the polyline using the polyline library
      const latLngs = polyline.decode(encodedPolyline).map(([lat, lng]) => L.latLng(lat, lng));

      // Calculate total distance in kilometers
      const totalDistance = route.distanceMeters / 1000;
      setTotalDistance(totalDistance);

      // Extract turn-by-turn directions
      const steps = route.legs.flatMap((leg) => leg.steps);
      setDirections(steps.map((step) => step.instructions));

      // Remove existing route control if it exists
      if (routeControl) {
        routeControl.remove();
        setRouteControl(null); // Reset routeControl after removal
      }

      // Ensure latLngs is not empty
      if (latLngs.length === 0) {
        throw new Error("No valid route points found.");
      }

      // Add new route control to the map (without displaying directions on the map)
      const newRouteControl = L.Routing.control({
        waypoints: latLngs,
        routeWhileDragging: true,
        createMarker: () => null,
        show: false, // Hide the directions panel on the map
      });

      // Add the route control to the map without displaying the directions panel
      newRouteControl.addTo(map);

      setRouteControl(newRouteControl);
    } catch (error) {
      console.error("Error calculating route:", error);
      alert("Error calculating route. Please try again.");
    }
  };

  // Component to handle map interaction
  const MapWithRoutingControl = ({ setMapInstance }) => {
    const map = useMap();

    // Store the map instance in the parent component's state
    useEffect(() => {
      if (map) {
        setMapInstance(map);
      }
    }, [map, setMapInstance]);

    return null;
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: "300px", padding: "10px", background: "#f8f9fa", overflowY: "auto" }}>
        {/* Tabs for Schools and Directions */}
        <div style={{ display: "flex", marginBottom: "10px" }}>
          <button
            onClick={() => setActiveTab("schools")}
            style={{
              flex: 1,
              padding: "10px",
              background: activeTab === "schools" ? "#007bff" : "#ccc",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Schools
          </button>
          <button
            onClick={() => setActiveTab("directions")}
            style={{
              flex: 1,
              padding: "10px",
              background: activeTab === "directions" ? "#007bff" : "#ccc",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Directions
          </button>
        </div>

        {/* Schools Tab */}
        {activeTab === "schools" && (
          <>
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
                if (mapInstance) {
                  calculateRoute(mapInstance);
                  setActiveTab("directions"); // Switch to the Directions tab after calculation
                } else {
                  console.error("Map instance is not available.");
                  alert("Map instance is not available.");
                }
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
              disabled={!homeLocation || selectedSchools.length < 2} // Disable button if conditions aren't met
            >
              {"Calculate Route"}
            </button>
          </>
        )}

        {/* Directions Tab */}
        {activeTab === "directions" && (
          <div>
            <h2>Directions</h2>
            {directions.length > 0 ? (
              <ol>
                {directions.map((direction, index) => (
                  <li key={index}>{direction}</li>
                ))}
              </ol>
            ) : (
              <p>No directions available. Please calculate a route first.</p>
            )}
          </div>
        )}
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

        <MapWithRoutingControl setMapInstance={setMapInstance} />
      </MapContainer>
    </div>
  );
};

export default App;