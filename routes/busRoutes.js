// routes/busRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Bus    from "../models/Bus.js";
import Driver from "../models/Driver.js";
import Student from "../models/Student.js";
import Parent  from "../models/Parent.js";
import Route   from "../models/Route.js";
import { getDistance } from "../utils/distance.js";
import { getETA }      from "../utils/eta.js";
import adminAuth from "../middleware/adminAuth.js";
import { sendPushNotification } from "../services/notificationService.js";
import parentAuth from "../middleware/parentAuth.js";
import jwt from "jsonwebtoken";





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

router.get("/", adminAuth, async (req, res) => {
  try {
    const buses = await Bus.find();
    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ADD BUS */
router.post("/", adminAuth, async (req, res) => {
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
  try {
    const driver = await Driver.findById(req.driver.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const bus = await Bus.findOne({ busNo: driver.assignedBus });
    if (!bus) return res.status(404).json({ message: "Assigned bus not found" });

    const { latitude, longitude, speed, heading, accuracy, timestamp } = req.body;

    // ── Filter bad GPS ──────────────────────────────────
    if (accuracy > 50) {
      return res.status(200).json({ message: "Ignored - poor GPS accuracy" });
    }
    if (bus.gpsTimestamp && timestamp < bus.gpsTimestamp) {
      return res.status(200).json({ message: "Ignored - old GPS packet" });
    }

 // ── GPS jump protection ───────────────────────────────

let calcSpeed = 0;

// Only calculate GPS jump if we already have a valid
// previous GPS location AND previous timestamp.
//
// First GPS point after starting tracking should always
// establish the driver's current location.
// ── GPS JUMP VALIDATION ─────────────────────────────

const isSimulation =
    process.env.ALLOW_SIMULATION === "true" &&
    req.headers["x-simulation"] === "true";

const hasPreviousGPS =
    bus.latitude != null &&
    bus.longitude != null &&
    bus.gpsTimestamp != null;

console.log("🧪 SIMULATION CHECK:", {
    allowSimulation: process.env.ALLOW_SIMULATION,
    header: req.headers["x-simulation"],
    isSimulation,
});

if (hasPreviousGPS && !isSimulation) {
    const moveDist = getDistanceInMeters(
        bus.latitude,
        bus.longitude,
        latitude,
        longitude
    );

    const timeDiff = (timestamp - bus.gpsTimestamp) / 1000;

    const calcSpeed =
        timeDiff > 0
            ? (moveDist / timeDiff) * 3.6
            : 0;

    if (calcSpeed > 120) {
        return res.status(200).json({
            message: "Ignored - impossible GPS jump"
        });
    }
}

    // ── Update bus ──────────────────────────────────────
    bus.latitude      = latitude;
    bus.longitude     = longitude;
    bus.speed         = Math.round((speed ?? 0) * 3.6);
    bus.heading       = heading ?? 0;
    bus.accuracy      = accuracy ?? 0;
    bus.gpsTimestamp  = timestamp;
    bus.lastGpsUpdate = new Date();
    bus.isOnline      = true;
    await bus.save();

    // ── ✅ EMIT — always, unconditionally, right after save ──
    const io = req.app.get("io");
    if (io) {
      io.emit("busLocationUpdated", {
        _id:       bus._id,
        busNo:     bus.busNo,
        latitude:  bus.latitude,
        longitude: bus.longitude,
        speed:     bus.speed,
        heading:   bus.heading,
        status:    bus.status,
      });
      console.log(`📡 busLocationUpdated → ${io.sockets.sockets.size} clients`);
    }

    res.json({ message: "Location updated", bus });

    // ── Notifications (non-blocking, after response) ────
    setImmediate(async () => {
      try {
        const route    = await Route.findOne({ routeName: bus.route });
        const students = await Student.find({ assignedBus: bus.busNo });
        const notifiedParents = new Set();

        for (const student of students) {
          if (!student.pickupLatitude || !student.pickupLongitude) continue;

          const parent = await Parent.findById(student.parentId);
          if (!parent?.expoPushToken) continue;

          const parentKey  = parent._id.toString();
          const pickupDist = getDistance(
            latitude, longitude,
            student.pickupLatitude, student.pickupLongitude
          );
const eta = getETA(pickupDist, bus.speed);

let etaText;

if (pickupDist <= 50) {
  etaText = "arriving now";
} else if (eta !== null) {
  etaText = `about ${eta} min`;
} else {
  etaText = "ETA unavailable";
}

console.log("📍 PICKUP ETA:", {
  student: student.name,
  distance: Math.round(pickupDist),
  speed: bus.speed,
  eta,
  etaText,
});

          // ✅ 2. Bus Arriving — within 500m, not already sent
          // ✅ 7. Prevent duplicates with pickupNotificationSent flag
          if (
            pickupDist <= 500 &&
            !student.pickupNotificationSent &&
            !notifiedParents.has(parentKey + "_arriving")
          ) {
            notifiedParents.add(parentKey + "_arriving");
       await sendPushNotification(
  parent.expoPushToken,
  "📍 Bus Arriving",
  `${student.name}'s bus is ${Math.round(pickupDist)}m away — ${etaText}. Please be ready.`,
  {
    type: "bus_arriving",
    studentId: student._id,
  }
);
            student.pickupNotificationSent = true;
            await student.save();
            console.log(`✅ Arriving notification → ${parent.name}`);
          }

          // Bus at pickup — within 100m
          if (
            pickupDist <= 100 &&
            !student.pickupArrivedNotificationSent &&
            !notifiedParents.has(parentKey + "_arrived")
          ) {
            notifiedParents.add(parentKey + "_arrived");
            await sendPushNotification(
              parent.expoPushToken,
              "🚌 Bus is Here!",
              `Bus is at ${student.pickupPoint || "your pickup point"}. Board now!`,
              { type: "bus_arrived", screen: "map", studentId: student._id.toString() }
            );
            student.pickupArrivedNotificationSent = true;
            await student.save();
            console.log(`✅ Arrived notification → ${parent.name}`);
          }

          // ✅ 3. Reached School — within 100m of school
          if (
            route?.schoolLatitude &&
            route?.schoolLongitude &&
            !student.schoolNotificationSent &&
            !notifiedParents.has(parentKey + "_school")
          ) {
            const schoolDist = getDistance(
              latitude, longitude,
              route.schoolLatitude, route.schoolLongitude
            );
            if (schoolDist <= 100) {
              notifiedParents.add(parentKey + "_school");
              await sendPushNotification(
                parent.expoPushToken,
                "🏫 Reached School",
                `${student.name}'s bus has safely arrived at school.`,
                { type: "school_reached", screen: "dashboard", studentId: student._id.toString() }
              );
              student.schoolNotificationSent = true;
              await student.save();
              console.log(`✅ School notification → ${parent.name}`);
            }
          }
        }
      } catch (e) {
        console.log("Notification error (non-fatal):", e.message);
      }
    });

  } catch (error) {
    console.log("update-location error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/* UPDATE BUS (admin) */
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    bus.busNo  = req.body.busNo;
    bus.route  = req.body.route;
    bus.status = req.body.status;
    await bus.save();
    res.json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* DELETE BUS */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ message: "Bus Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* GET BUS BY BUS NUMBER */ 

/* GET BUS BY BUS NUMBER — AUTHORIZED USERS ONLY */

/* GET BUS BY BUS NUMBER — AUTHENTICATED AND AUTHORIZED */

/* GET BUS BY BUS NUMBER */

/* GET BUS BY BUS NUMBER — authenticated access only */
router.get("/busno/:busNo", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server authentication configuration error",
      });
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !decoded.role) {
      return res.status(403).json({
        message: "Invalid user credentials",
      });
    }

    const requestedBusNo = req.params.busNo;
    let allowedBusNo = null;

    if (decoded.role === "admin") {
      allowedBusNo = requestedBusNo;
    } else if (decoded.role === "driver") {
      const driver = await Driver.findById(decoded.id)
        .select("assignedBus");

      if (!driver) {
        return res.status(403).json({
          message: "Driver account not found",
        });
      }

      allowedBusNo = driver.assignedBus;
    } else if (decoded.role === "parent") {
      const parent = await Parent.findById(decoded.id)
        .select("studentId");

      if (!parent || !parent.studentId) {
        return res.status(403).json({
          message: "No student is linked to this parent",
        });
      }

      const student = await Student.findById(parent.studentId)
        .select("assignedBus");

      if (!student || !student.assignedBus) {
        return res.status(403).json({
          message: "No bus is assigned to this student",
        });
      }

      allowedBusNo = student.assignedBus;
    } else {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    if (String(allowedBusNo) !== String(requestedBusNo)) {
      return res.status(403).json({
        message: "You are not authorized to access this bus",
      });
    }

    const bus = await Bus.findOne({ busNo: requestedBusNo });

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found",
      });
    }

    // Preserve the existing GPS data.
    return res.json(bus);
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    console.error("Bus lookup error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve bus information",
    });
  }
});



export default router;
