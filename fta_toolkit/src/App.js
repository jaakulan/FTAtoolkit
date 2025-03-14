import React, { useState, useEffect } from "react";
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from "@react-google-maps/api";

const apiKey = process.env.google_api_key;; // Replace with your actual API key
const libraries = ["places"];
const mapContainerStyle = { width: "100%", height: "100vh" };
const center = { lat: 43.8561, lng: -79.337 };

const App = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [homeLocation, setHomeLocation] = useState(null);
  const [directions, setDirections] = useState(null);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await fetch("/data/eastSchools/eastschools.json");
        if (!response.ok) throw new Error("Failed to fetch schools data");
        const data = await response.json();
        setSchools(data);
      } catch (error) {
        console.error("Error loading schools data:", error);
      }
    };
    fetchSchools();
  }, []);

  const toggleSchoolSelection = (school) => {
    setSelectedSchools((prev) =>
      prev.some((s) => s.name === school.name)
        ? prev.filter((s) => s.name !== school.name)
        : [...prev, school]
    );
  };

  const selectHomeLocation = (school) => {
    setHomeLocation(school);
    if (!selectedSchools.some((s) => s.name === school.name)) {
      setSelectedSchools((prev) => [...prev, school]);
    }
  };

  const calculateRoute = async () => {
    if (!homeLocation || selectedSchools.length < 2) {
      alert("Select at least two schools and a home location.");
      return;
    }

    const waypoints = selectedSchools
      .filter((s) => s.name !== homeLocation.name)
      .map((s) => ({ location: { lat: s.lat, lng: s.lng } }));

    try {
      const response = await fetch(
        `https://routes.googleapis.com/v1/optimizedRoutes:compute?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: { lat: homeLocation.lat, lng: homeLocation.lng },
            destination: { lat: homeLocation.lat, lng: homeLocation.lng },
            waypoints: waypoints,
            travelMode: "DRIVE",
            routeModifiers: { traffic: true },
            optimizationStrategy: "FASTEST",
          }),
        }
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        setDirections(data.routes[0]);
      } else {
        console.error("No route found", data);
        alert("Error calculating route. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      alert("Error calculating route. Please try again.");
    }
  };

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <div style={{ display: "flex" }}>
        <div style={{ width: "300px", padding: "10px", background: "#f8f9fa", overflowY: "auto" }}>
          <h2>Select Home Location</h2>
          <ul>
            {schools.map((school) => (
              <li key={school.name} onClick={() => selectHomeLocation(school)}>
                {homeLocation?.name === school.name ? "🏠" : "⚫"} {school.name}
              </li>
            ))}
          </ul>
          <h2>Select Schools to Include in Route</h2>
          <ul>
            {schools.map((school) => (
              <li key={school.name} onClick={() => toggleSchoolSelection(school)}>
                {selectedSchools.some((s) => s.name === school.name) ? "✔️" : "⚫"} {school.name}
              </li>
            ))}
          </ul>
          <button onClick={calculateRoute}>Calculate Route</button>
        </div>
        <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={12}>
          {schools.map((school) => (
            <Marker key={school.name} position={{ lat: school.lat, lng: school.lng }} />
          ))}
          {directions && (
            <DirectionsRenderer
              directions={{
                routes: [
                  {
                    overview_path: directions.legs[0].steps.map((step) => ({
                      lat: step.end_location.lat(),
                      lng: step.end_location.lng(),
                    })),
                  },
                ],
              }}
            />
          )}
        </GoogleMap>
      </div>
    </LoadScript>
  );
};

export default App;
