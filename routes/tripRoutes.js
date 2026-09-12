// routes/tripRoutes.js
import express from "express";
import Trip    from "../models/Trip.js";
import Student from "../models/Student.js";
import Parent  from "../models/Parent.js";
import Driver  from "../models/Driver.js";
import Bus     from "../models/Bus.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { sendPushNotification } from "../services/notificationService.js";

const router = express.Router();

// ── Helper: reset all notification flags for a bus ──────
async function resetNotificationFlags(busNo) {
  await Student.updateMany(
    { assignedBus: busNo },
    {
      $set: {
        pickupNotificationSent:        false,
        pickupArrivedNotificationSent: false,
        schoolNotificationSent:        false,
      },
    }
  );
  console.log(`🔄 Notification flags reset for bus ${busNo}`);
}

// ── Helper: send notification to all parents of a bus ───
async function notifyParents(busNo, title, body, data = {}) {
  const students = await Student.find({ assignedBus: busNo });
  const notified = new Set(); // prevent duplicate sends to same parent

  for (const student of students) {
    if (!student.parentId) continue;

    // Skip if already notified this parent for this event
    const parentKey = student.parentId.toString();
    if (notified.has(parentKey)) continue;
    notified.add(parentKey);

    const parent = await Parent.findById(student.parentId);
    if (!parent?.expoPushToken) continue;

    await sendPushNotification(parent.expoPushToken, title, body, {
      ...data,
      busNo,
      studentId: student._id.toString(),
    });

    console.log(`✅ Notified ${parent.name} — ${title}`);
  }
}

// ── GET ALL TRIPS ────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driverId")
      .sort({ createdAt: -1 });
    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── START TRIP ───────────────────────────────────────────
router.post("/start", async (req, res) => {
  console.log("🚀 /trips/start called", req.body);
  try {
    const { driverId, busNo, tripType = "morning" } = req.body;

    if (!driverId || !busNo) {
      return res.status(400).json({ message: "driverId and busNo required" });
    }

    // ✅ 6. Reset notification flags for fresh trip
    await resetNotificationFlags(busNo);

    // Create trip
    const trip = new Trip({
      driverId,
      busNo,
      startTime: new Date(),
      tripType,
      status: "active",
    });
    await trip.save();

    // ✅ 1. Emit tripStarted to all socket clients (Parent App listens to this)
    const io = req.app.get("io");
    if (io) {
      io.emit("tripStarted", {
        tripId:    trip._id,
        busNo:     trip.busNo,
        driverId:  trip.driverId,
        tripType:  trip.tripType,
        startTime: trip.startTime,
      });
      console.log(`📡 tripStarted emitted to ${io.sockets.sockets.size} clients`);
    }

    res.status(201).json(trip);

    // ✅ Send notifications after responding (non-blocking)
    setImmediate(async () => {
      try {
        const isReturn = tripType === "return";
        await notifyParents(
          busNo,
          isReturn ? "🏠 Return Trip Started" : "🚌 Bus Trip Started",
          isReturn
            ? `Bus ${busNo} has started the return journey home.`
            : `Bus ${busNo} has started today's morning trip.`,
          { type: isReturn ? "return_trip_started" : "trip_started", screen: "map" }
        );
      } catch (e) {
        console.log("Trip start notification error:", e.message);
      }
    });

  } catch (error) {
    console.log("Start trip error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ── END TRIP ─────────────────────────────────────────────
router.put("/end", authMiddleware, async (req, res) => {
  console.log("🛑 /trips/end called, driver:", req.driver);
  try {
    const driver = await Driver.findById(req.driver.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const trip = await Trip.findOne({ driverId: driver._id, status: "active" });
    if (!trip) return res.status(404).json({ message: "No active trip found" });

    // End trip
    trip.status   = "completed";
    trip.endTime  = new Date();
    trip.duration = Math.round((trip.endTime - trip.startTime) / 60000);
    await trip.save();

    // Update bus status
    const bus = await Bus.findOne({ busNo: driver.assignedBus });
    if (bus) {
      bus.isOnline = false;
      bus.speed    = 0;
      await bus.save();
    }

    // ✅ 5. Emit tripEnded to all clients
    const io = req.app.get("io");
    if (io) {
      io.emit("tripEnded", {
        busNo:    bus?.busNo ?? driver.assignedBus,
        tripId:   trip._id,
        duration: trip.duration,
      });
      console.log(`📡 tripEnded emitted to ${io.sockets.sockets.size} clients`);
    }

    res.json({ message: "Trip ended successfully", trip });

    // ✅ 5. Send trip ended notification (non-blocking)
    setImmediate(async () => {
      try {
        const busNo = driver.assignedBus;
        await notifyParents(
          busNo,
          "🛑 Trip Ended",
          `Bus ${busNo}'s trip has ended. Duration: ${trip.duration} min.`,
          { type: "trip_ended", screen: "dashboard" }
        );
      } catch (e) {
        console.log("Trip end notification error:", e.message);
      }
    });

  } catch (error) {
    console.log("End trip error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ── STOP TRIP (old route kept for Driver App compatibility) ─
router.put("/stop/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    trip.endTime  = new Date();
    trip.duration = Math.round((trip.endTime - trip.startTime) / 60000);
    trip.status   = "completed";
    await trip.save();

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
