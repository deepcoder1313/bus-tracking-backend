
import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { origin, destination } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!origin || !destination) {
      return res.status(400).json({
        message: "Origin and destination are required",
      });
    }

    if (!apiKey) {
      console.error("Directions API configuration is missing");

      return res.status(500).json({
        message: "Directions service is not configured",
      });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin,
          destination,
          mode: "driving",
          key: apiKey,
        },
        timeout: 15000,
      }
    );

    // Log Google's status, never the API key.
    console.log("Google Directions status:", response.data.status);

    if (response.data.status !== "OK") {
      console.error(
        "Google Directions error:",
        response.data.status,
        response.data.error_message || ""
      );
    }

    // Preserve the response structure expected by the driver app.
    return res.json(response.data);
  } catch (error) {
    console.error(
      "Directions request failed:",
      error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message
    );

    return res.status(500).json({
      message: "Failed to fetch directions",
    });
  }
});

export default router;
