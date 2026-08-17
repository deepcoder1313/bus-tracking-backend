// routes/etaRoutes.js  ← NEW FILE
// Calculates real road-based ETA using OSRM on the server side
// This is more reliable than doing it in the mobile app
import express from "express";
import Bus from "../models/Bus.js";

const router = express.Router();

// GET /api/eta/:busNo?pickupLat=xx&pickupLng=xx
// Returns road-based ETA in minutes from bus → pickup point
router.get("/:busNo", async (req, res) => {
  try {
    const { pickupLat, pickupLng } = req.query;

    if (!pickupLat || !pickupLng) {
      return res.status(400).json({ message: "pickupLat and pickupLng required" });
    }

    // Get current bus position from MongoDB
    const bus = await Bus.findOne({ busNo: req.params.busNo });
    if (!bus) return res.status(404).json({ message: "Bus not found" });

    if (!bus.latitude || !bus.longitude) {
      return res.json({ etaMinutes: null, message: "Bus location not available yet" });
    }

    // Call OSRM — road-following route
    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${bus.longitude},${bus.latitude};${pickupLng},${pickupLat}` +
      `?overview=false`;

    const response = await fetch(url);
    const data     = await response.json();

    if (!data.routes?.[0]) {
      return res.json({ etaMinutes: null, message: "Route not found" });
    }

    const seconds    = data.routes[0].duration;   // OSRM gives seconds
    const meters     = data.routes[0].distance;   // OSRM gives meters
    const etaMinutes = Math.ceil(seconds / 60);

    res.json({
      etaMinutes,
      distanceMeters: Math.round(meters),
      busLat:  bus.latitude,
      busLng:  bus.longitude,
      busStatus: bus.status,
    });

  } catch (error) {
    console.log("ETA Error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
