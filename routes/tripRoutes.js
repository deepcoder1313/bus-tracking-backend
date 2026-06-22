import express from "express";
import Trip from "../models/Trip.js";

const router = express.Router();

/* START TRIP */

router.post("/start", async (req, res) => {
  try {
    const { driverId, busNo } = req.body;

    const trip = new Trip({
      driverId,
      busNo,
      startTime: new Date(),
    });

    await trip.save();

    res.status(201).json(trip);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* STOP TRIP */

router.put("/stop/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }

    trip.endTime = new Date();

    const duration =
      (trip.endTime - trip.startTime) / 1000 / 60;

    trip.duration = Math.round(duration);

    await trip.save();

    res.json(trip);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* GET ALL TRIPS */

router.get("/", async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driverId")
      .sort({ createdAt: -1 });

    res.json(trips);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;