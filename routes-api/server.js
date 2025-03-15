const express = require("express");
const cors = require("cors");
const axios = require("axios"); // ✅ Import axios
require("dotenv").config();

const app = express();
const port = 3001;

// ✅ Allow CORS for frontend
app.use(cors({ origin: "http://localhost:3000" }));

// ✅ Middleware to parse JSON
app.use(express.json());

// ✅ Load API Key
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("⚠️ Missing GOOGLE_API_KEY in .env file");
  process.exit(1); // Exit if API key is not found
}

// ✅ Route to handle route optimization request
app.post("/calculate-route", async (req, res) => {
  const { origin, destination, waypoints } = req.body;

  console.log("Received Request Body:", req.body);  // Add this line to log incoming data

  // Validate if origin and destination exist
  if (!origin || !destination) {
    return res.status(400).json({ error: "Origin and destination are required" });
  }

  const googleRoutesUrl = `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`;

  try {
    // Format waypoints
    const formattedWaypoints = waypoints?.map((wp) => ({
      location: { latLng: { latitude: wp.location.lat, longitude: wp.location.lng } },
    })) || [];

    const response = await axios.post(
      googleRoutesUrl,
      {
        origin: {
          location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
        },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        intermediates: formattedWaypoints, // Use the correctly formatted waypoints
        travelMode: "DRIVE",
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs",
        },
      }
    );

    if (!response.data.routes || response.data.routes.length === 0) {
      return res.status(500).json({ error: "No routes found" });
    }

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching route:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to calculate route" });
  }
});




// ✅ Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
