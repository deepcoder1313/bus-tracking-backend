import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        message: "Origin and destination are required",
      });
    }

    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin}` +
      `&destination=${destination}` +
      `&mode=driving` +
      `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);

    res.json(response.data);

  } catch (error) {
    console.log(error);
    console.log(process.env.GOOGLE_MAPS_API_KEY);

    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;