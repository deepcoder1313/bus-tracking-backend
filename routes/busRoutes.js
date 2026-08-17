import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Bus from "../models/Bus.js";
import Driver from "../models/Driver.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import Route from "../models/Route.js";
import { getDistance } from "../utils/distance.js";
import { getETA } from "../utils/eta.js";
import { sendPushNotification } from "../services/notificationService.js";

const router = express.Router();

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* GET ALL BUSES */
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find();
    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ADD BUS */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const newBus = new Bus({
      busNo:  req.body.busNo,
      route:  req.body.route,
      status: req.body.status,
    });
    const savedBus = await newBus.save();
    res.status(201).json(savedBus);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/* UPDATE LOCATION — called by Driver App every 3-4 seconds */
router.put("/update-location", authMiddleware, async (req, res) => {
  console.log("req.driver =", req.driver);
  console.log("req.body =", req.body);

  try {
    // ── 1. Find driver and bus ──────────────────────────
    const driver = await Driver.findById(req.driver.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const bus = await Bus.findOne({ busNo: driver.assignedBus });
    if (!bus) return res.status(404).json({ message: "Assigned bus not found" });

    const { latitude, longitude, speed, heading, accuracy, timestamp } = req.body;

    // ── 2. Filter bad GPS ───────────────────────────────
    if (accuracy > 50) {
      return res.status(200).json({ message: "Ignored - poor GPS accuracy" });
    }

    if (bus.gpsTimestamp && timestamp < bus.gpsTimestamp) {
      return res.status(200).json({ message: "Ignored - old GPS packet" });
    }

    const distance = getDistanceInMeters(
      bus.latitude, bus.longitude, latitude, longitude
    );
    const timeDiff = (timestamp - (bus.gpsTimestamp || timestamp)) / 1000;
    const calculatedSpeed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0;

    if (calculatedSpeed > 120) {
      console.log("❌ Impossible GPS jump - ignored");
      return res.status(200).json({ message: "Ignored - impossible GPS jump" });
    }

    // ── 3. Update bus in MongoDB ────────────────────────
    bus.latitude     = latitude;
    bus.longitude    = longitude;
    bus.speed        = Math.round((speed ?? 0) * 3.6);
    bus.heading      = heading ?? 0;
    bus.accuracy     = accuracy ?? 0;
    bus.gpsTimestamp = timestamp;
    bus.lastGpsUpdate = new Date();
    bus.isOnline     = true;

    await bus.save();

    // ── 4. ✅ EMIT TO ALL CLIENTS — always, unconditionally ──
    const io = req.app.get("io");

    if (!io) {
      console.log("❌ io not found on app");
    } else {
      io.emit("busLocationUpdated", {
        _id:       bus._id,
        busNo:     bus.busNo,
        latitude:  bus.latitude,
        longitude: bus.longitude,
        speed:     bus.speed,
        heading:   bus.heading,
        status:    bus.status,
      });
      console.log(`📡 busLocationUpdated emitted to ${io.sockets.sockets.size} clients`);
    }

    // ── 5. Notifications (separate, non-blocking) ───────
    setImmediate(async () => {
      try {
        const route = await Route.findOne({ routeName: bus.route });
        const students = await Student.find({ assignedBus: bus.busNo });

        for (const student of students) {
          if (!student.pickupLatitude || !student.pickupLongitude) continue;

          const pickupDist = getDistance(
            latitude, longitude,
            student.pickupLatitude, student.pickupLongitude
          );
          const eta = getETA(pickupDist, bus.speed);

          console.log(`📍 ${student.name}: ${Math.round(pickupDist)}m, ETA: ${eta}min`);

          const parent = await Parent.findById(student.parentId);
          if (!parent?.expoPushToken) continue;

          // School arrival notification
          if (route?.schoolLatitude && route?.schoolLongitude) {
            const schoolDist = getDistance(
              latitude, longitude,
              route.schoolLatitude, route.schoolLongitude
            );
            if (schoolDist <= 100 && !student.schoolNotificationSent) {
              await sendPushNotification(
                parent.expoPushToken,
                "🏫 Reached School",
                `${student.name}'s bus has safely reached the school.`,
                { type: "school_reached", studentId: student._id }
              );
              student.schoolNotificationSent = true;
              await student.save();
              console.log(`🏫 School notification sent to ${parent.name}`);
            }
          }

          // Pickup arrival notification (within 500m)
          if (pickupDist <= 500 && !student.pickupNotificationSent) {
            await sendPushNotification(
              parent.expoPushToken,
              "📍 Bus Arriving",
              `${student.name}'s bus is ${Math.round(pickupDist)}m away — about ${eta} min.`,
              { type: "bus_arriving", studentId: student._id }
            );
            student.pickupNotificationSent = true;
            await student.save();
            console.log(`✅ Pickup notification sent to ${parent.name}`);
          }
        }
      } catch (notifErr) {
        console.log("Notification error (non-fatal):", notifErr.message);
      }
    });

    res.json({ message: "Location updated", bus });

  } catch (error) {
    console.log("update-location error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/* UPDATE BUS (admin) */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { busNo, route, status } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    bus.busNo  = busNo;
    bus.route  = route;
    bus.status = status;
    await bus.save();
    res.json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* DELETE BUS */
router.delete("/:id", async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ message: "Bus Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* GET BUS BY BUS NUMBER */
router.get("/busno/:busNo", async (req, res) => {
  try {
    const bus = await Bus.findOne({
      busNo: req.params.busNo,
    });

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found",
      });
    }

    res.json(bus);
  } catch (error) {
    console.error("Bus fetch error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;
