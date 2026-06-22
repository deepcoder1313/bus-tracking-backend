import express from "express";
import Bus from "../models/Bus.js";
import Driver from "../models/Driver.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import Trip from "../models/Trip.js";

const router = express.Router();

/* Dashboard Stats */
router.get("/stats", async (req, res) => {
  try {
    const totalBuses = await Bus.countDocuments();
    const totalDrivers = await Driver.countDocuments();
    const totalStudents = await Student.countDocuments();
    const totalParents = await Parent.countDocuments();
    const totalTrips = await Trip.countDocuments();

    const activeBuses = await Bus.countDocuments({
      status: "Active",
    });

    res.json({
      totalBuses,
      totalDrivers,
      totalStudents,
      totalParents,
      totalTrips,
      activeBuses,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* Recent Trips */
router.get("/recent-trips", async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driverId")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json(trips);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* Bus Status */
router.get("/bus-status", async (req, res) => {
  try {
    const active = await Bus.countDocuments({
      status: "Active",
    });

    const maintenance = await Bus.countDocuments({
      status: "Maintenance",
    });

    const offline = await Bus.countDocuments({
      status: "Offline",
    });

    res.json({
      active,
      maintenance,
      offline,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;