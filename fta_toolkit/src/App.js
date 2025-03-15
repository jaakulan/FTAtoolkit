import React, { useState, useEffect } from "react";
import { GoogleMap, LoadScript, Marker, Polyline } from "@react-google-maps/api";

const apiKey = process.env.REACT_APP_GOOGLE_API_KEY;
const libraries = ["places", "geometry"];
const mapContainerStyle = { width: "100%", height: "100vh" };
const center = { lat: 43.8561, lng: -79.337 };
const routeApiUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Function to generate distinct colors for polylines
const generateColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count; // Distribute hues evenly
    colors.push(`hsl(${hue}, 100%, 50%)`);
  }
  return colors;
};

const App = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [homeLocation, setHomeLocation] = useState(null);
  const [routeSegments, setRouteSegments] = useState([]);
  const [currentSegment, setCurrentSegment] = useState(0);

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
      const routesRequest = {
        origin: {
          location: {
            latLng: {
              latitude: homeLocation.lat,
              longitude: homeLocation.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: homeLocation.lat,
              longitude: homeLocation.lng
            }
          }
        },
        intermediates: waypoints.map(w => ({
          location: {
            latLng: {
              latitude: w.location.lat,
              longitude: w.location.lng
            }
          }
        })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false
        },
        languageCode: 'en-US',
        units: 'IMPERIAL'
      };

      const response = await fetch(routeApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.legs.steps.polyline.encodedPolyline'
        },
        body: JSON.stringify(routesRequest)
      });

      if (!response.ok) throw new Error('Route calculation failed');
      
      const data = await response.json();
      const { encoding } = await google.maps.importLibrary('geometry');

      // Process route into segments
      const legs = data.routes[0].legs;
      const colors = generateColors(legs.length); // Generate colors dynamically
      const segments = legs.map((leg, i) => {
        const segmentPath = [];
        for (const step of leg.steps) {
          const decodedPath = encoding.decodePath(step.polyline.encodedPolyline);
          segmentPath.push(...decodedPath);
        }
        return {
          path: segmentPath,
          color: colors[i],
          visible: true, // All segments are visible initially
          isActive: false // Initially grayed out
        };
      });

      setRouteSegments(segments);
      setCurrentSegment(0);

    } catch (error) {
      console.error("Route calculation error:", error);
      alert("Error calculating route. Please try again.");
    }
  };

  const advanceToNextSegment = () => {
    if (currentSegment < routeSegments.length) {
      setRouteSegments(prev =>
        prev.map((seg, i) =>
          i === currentSegment ? { ...seg, isActive: true } : seg
        )
      );
      setCurrentSegment(prev => prev + 1);
    }
  };

  const goBackToPreviousSegment = () => {
    if (currentSegment > 0) {
      setRouteSegments(prev =>
        prev.map((seg, i) =>
          i === currentSegment - 1 ? { ...seg, isActive: false } : seg
        )
      );
      setCurrentSegment(prev => prev - 1);
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
          <button 
            onClick={goBackToPreviousSegment}
            disabled={currentSegment <= 0}
          >
            Go Back
          </button>
          <button 
            onClick={advanceToNextSegment}
            disabled={currentSegment >= routeSegments.length}
          >
            Next School
          </button>
        </div>
        
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={12}
        >
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
                zIndex: index + 1
              }}
            />
          ))}
        </GoogleMap>
      </div>
    </LoadScript>
  );
};

export default App;