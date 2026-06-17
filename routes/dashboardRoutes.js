import express from "express";
import Bus from "../models/Bus.js";
import Driver from "../models/Driver.js";
import Route from "../models/Route.js";

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const totalBuses = await Bus.countDocuments();
    const totalDrivers = await Driver.countDocuments();
    const totalRoutes = await Route.countDocuments();

    res.json({
      totalBuses,
      totalDrivers,
      totalRoutes,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;