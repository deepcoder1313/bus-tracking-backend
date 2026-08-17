import express from "express";

import Student from "../models/Student.js";
import Driver from "../models/Driver.js";
import Bus from "../models/Bus.js";

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {

    const totalStudents = await Student.countDocuments();

    const totalDrivers = await Driver.countDocuments();

    const totalBuses = await Bus.countDocuments();

    const activeDrivers =
      await Driver.countDocuments({
        status: "Active",
      });

    const activeTrips =
      await Bus.countDocuments({
        status: "Active",
      });

    const offlineBuses =
      await Bus.countDocuments({
        status: "Offline",
      });

    res.json({
      totalStudents,
      totalDrivers,
      totalBuses,
      activeDrivers,
      activeTrips,
      offlineBuses,
    });

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });

  }
});

export default router;