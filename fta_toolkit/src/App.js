import React, { useState, useEffect } from "react";
import { GoogleMap, LoadScript, Marker, Polyline } from "@react-google-maps/api";

const apiKey = process.env.REACT_APP_GOOGLE_API_KEY;
const libraries = ["places", "geometry"];
const mapContainerStyle = { width: "100%", height: "100vh" };
const center = { lat: 43.8561, lng: -79.337 };

const App = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [homeLocation, setHomeLocation] = useState(null);
  const [routeSegments, setRouteSegments] = useState([]);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [distanceOption, setDistanceOption] = useState("inputtedDistance");

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
      .map((s) => ({
        location: {
          latLng: {
            latitude: s.lat,
            longitude: s.lng,
          },
        },
      }));

    try {
      const routesRequest = {
        origin: {
          location: {
            latLng: {
              latitude: homeLocation.lat,
              longitude: homeLocation.lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: homeLocation.lat,
              longitude: homeLocation.lng,
            },
          },
        },
        intermediates: waypoints,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: true,
          avoidHighways: false,
          avoidFerries: false,
        },
        languageCode: "en-US",
        units: "IMPERIAL",
      };

      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.legs.steps.polyline.encodedPolyline",
        },
        body: JSON.stringify(routesRequest),
      });

      if (!response.ok) throw new Error("Route calculation failed");

      const data = await response.json();

      const legs = data.routes[0].legs;
      const colors = generateColors(legs.length);  // Generate colors for the segments
      const segments = legs.map((leg, i) => {
        const segmentPath = [];
        let segmentDistance = 0;

        for (const step of leg.steps) {
          const decodedPath = window.google.maps.geometry.encoding.decodePath(step.polyline.encodedPolyline);
          segmentPath.push(...decodedPath);
          for (let j = 0; j < decodedPath.length - 1; j++) {
            const pointA = decodedPath[j];
            const pointB = decodedPath[j + 1];
            segmentDistance += window.google.maps.geometry.spherical.computeDistanceBetween(pointA, pointB);
          }
        }

        return {
          path: segmentPath,
          color: colors[i],
          distance: segmentDistance,
          visible: true,
          isActive: false,
        };
      });

      setRouteSegments(segments);
      setCurrentSegment(0);
      setTotalDistance(segments.reduce((acc, seg) => acc + seg.distance, 0));

    } catch (error) {
      console.error("Route calculation error:", error);
      alert("Error calculating route. Please try again.");
    }
  };

  const advanceToNextSegment = () => {
    if (currentSegment < routeSegments.length) {
      setRouteSegments((prev) =>
        prev.map((seg, i) =>
          i === currentSegment ? { ...seg, isActive: true } : seg
        )
      );
      setCurrentSegment((prev) => prev + 1);
      updateTotalDistance();
    }
  };

  const goBackToPreviousSegment = () => {
    if (currentSegment > 0) {
      setRouteSegments((prev) =>
        prev.map((seg, i) =>
          i === currentSegment - 1 ? { ...seg, isActive: false } : seg
        )
      );
      setCurrentSegment((prev) => prev - 1);
      updateTotalDistance();
    }
  };

  const updateTotalDistance = () => {
    const activeSegments = routeSegments.slice(0, currentSegment + 1);
    const total = activeSegments.reduce((acc, seg) => acc + seg.distance, 0);
    setTotalDistance(total);
  };

  const generateColors = (num) => {
    const colors = [];
    for (let i = 0; i < num; i++) {
      // Generate a random color in hex format
      const color = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
      colors.push(color);
    }
    return colors;
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
          <div style={{ marginBottom: "10px" }}>
            <select
              value={distanceOption}
              onChange={(e) => setDistanceOption(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="inputtedDistance">Inputted Distance</option>
              <option value="minDistance">Min Distance</option>
              <option value="maxDistance">Max Distance</option>
            </select>
          </div>
          <button onClick={calculateRoute} style={{ width: "100%", marginBottom: "10px" }}>
            Calculate Route
          </button>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={goBackToPreviousSegment} disabled={currentSegment <= 0}>
              Go Back
            </button>
            <button onClick={advanceToNextSegment} disabled={currentSegment >= routeSegments.length}>
              Next School
            </button>
          </div>
          <h3>Total Distance: {(totalDistance/1000).toFixed(3)} km</h3>
        </div>

        <GoogleMap mapContainerStyle={{ width: "100%", minheight: "100vh" }} center={center} zoom={12}>
          {schools.map((school) => (
            <Marker key={school.name} position={{ lat: school.lat, lng: school.lng }} />
          ))}
          {routeSegments.map((segment, index) => (
            <Polyline
              key={index}
              path={segment.path}
              options={{
                strokeColor: segment.isActive ? segment.color : "#CCCCCC", // Gray if not active
                strokeOpacity: 1.0,
                strokeWeight: 4,
                zIndex: index + 1,
              }}
            />
          ))}
        </GoogleMap>
      </div>
    </LoadScript>
  );
};

export default App;

