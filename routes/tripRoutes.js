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
// ── START TRIP ───────────────────────────────────────────
// ── START TRIP ───────────────────────────────────────────
router.post("/start", authMiddleware, async (req, res) => {
  console.log("🚀 /trips/start CALLED");
  console.log("📦 BODY:", req.body);
  console.log("👨‍✈️ DRIVER FROM TOKEN:", req.driver);

  try {
    const { driverId, busNo, tripType } = req.body;

    console.log("🔍 START TRIP DATA:", {
      driverId,
      busNo,
      tripType,
    });

    if (!driverId || !busNo || !tripType) {
      console.log("❌ Missing trip data");

      return res.status(400).json({
        message: "driverId, busNo and tripType are required",
      });
    }

    // Check existing active trip
    console.log("🔎 Checking active trip...");

    const existingTrip = await Trip.findOne({
      driverId,
      status: "active",
    });

    console.log("🔎 EXISTING ACTIVE TRIP:", existingTrip);

    if (existingTrip) {
      console.log("❌ DRIVER ALREADY HAS ACTIVE TRIP");

      return res.status(400).json({
        message: "Driver already has an active trip",
        tripId: existingTrip._id,
      });
    }

    console.log("🆕 Creating new trip...");

    const trip = await Trip.create({
      driverId,
      busNo,
      tripType,
      startTime: new Date(),
      endTime: null,
      duration: 0,
      status: "active",
    });

    console.log("✅ NEW TRIP CREATED:", trip);

    return res.status(201).json(trip);

  } catch (error) {
    console.log("❌ START TRIP ERROR:", error);
    console.log("❌ ERROR MESSAGE:", error.message);
    console.log("❌ ERROR STACK:", error.stack);

    return res.status(500).json({
      message: error.message,
    });
  }
});

// ── END TRIP ─────────────────────────────────────────────
// ── END TRIP ─────────────────────────────────────────────
router.put("/end", authMiddleware, async (req, res) => {
  console.log("🛑 /trips/end called, driver:", req.driver);
  console.log("🎯 REQUEST BODY:", req.body);

  try {
    const driver = await Driver.findById(req.driver.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found"
      });
    }

    const { tripId } = req.body;

    console.log("🎯 TRIP ID RECEIVED:", tripId);

    let trip;

    // ─────────────────────────────────────────────
    // If frontend sends tripId, END THAT EXACT TRIP
    // ─────────────────────────────────────────────
    if (tripId) {
      trip = await Trip.findOne({
        _id: tripId,
        driverId: driver._id,
        status: "active"
      });

      console.log("🎯 TRIP FOUND BY ID:", trip?._id);
    } 
    
    // ─────────────────────────────────────────────
    // Fallback for old Driver App code
    // ─────────────────────────────────────────────
    else {
      trip = await Trip.findOne({
        driverId: driver._id,
        status: "active"
      }).sort({ startTime: -1 });

      console.log("⚠️ NO TRIP ID PROVIDED");
      console.log("🎯 USING LATEST ACTIVE TRIP:", trip?._id);
    }

    if (!trip) {
      return res.status(404).json({
        message: "No active trip found"
      });
    }

    console.log("🎯 ENDING EXACT TRIP:", {
      id: trip._id,
      tripType: trip.tripType,
      busNo: trip.busNo,
      status: trip.status
    });

    // ─────────────────────────────────────────────
    // END TRIP
    // ─────────────────────────────────────────────

    trip.status = "completed";
    trip.endTime = new Date();

    trip.duration = Math.round(
      (trip.endTime - trip.startTime) / 60000
    );

    await trip.save();

    // ─────────────────────────────────────────────
    // UPDATE BUS
    // ─────────────────────────────────────────────

    const bus = await Bus.findOne({
      busNo: driver.assignedBus
    });

    if (bus) {
      bus.isOnline = false;
      bus.speed = 0;

      await bus.save();
    }

    // ─────────────────────────────────────────────
    // SOCKET.IO
    // ─────────────────────────────────────────────

    const io = req.app.get("io");

    if (io) {
      io.emit("tripEnded", {
        busNo: bus?.busNo ?? driver.assignedBus,
        tripId: trip._id,
        tripType: trip.tripType,
        duration: trip.duration
      });

      console.log(
        `📡 tripEnded emitted → ${io.sockets.sockets.size} clients`
      );
    }

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────

    console.log("✅ TRIP ENDED SUCCESSFULLY:", {
      id: trip._id,
      tripType: trip.tripType,
      duration: trip.duration
    });

    res.json({
      message: "Trip ended successfully",
      trip
    });

    // ─────────────────────────────────────────────
    // NOTIFICATION
    // ─────────────────────────────────────────────

    setImmediate(async () => {
      try {
        const busNo = driver.assignedBus;

        await notifyParents(
          busNo,
          "🛑 Trip Ended",
          `Bus ${busNo}'s ${trip.tripType} trip has ended. Duration: ${trip.duration} min.`,
          {
            type: "trip_ended",
            screen: "dashboard",
            tripType: trip.tripType
          }
        );

      } catch (e) {
        console.log(
          "Trip end notification error:",
          e.message
        );
      }
    });

  } catch (error) {

    console.log("❌ END TRIP ERROR:", error);

    res.status(500).json({
      message: error.message
    });
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
    
console.log("✅ TRIP SUCCESSFULLY COMPLETED:", {
  tripId: trip._id,
  driverId: trip.driverId,
  busNo: trip.busNo,
  tripType: trip.tripType,
  status: trip.status,
  startTime: trip.startTime,
  endTime: trip.endTime,
  duration: trip.duration,
});
    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
