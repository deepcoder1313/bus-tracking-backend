// routes/tripRoutes.js
import express from "express";
import Trip    from "../models/Trip.js";
import Student from "../models/Student.js";
import Parent  from "../models/Parent.js";
import Driver  from "../models/Driver.js";
import Bus     from "../models/Bus.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminAuth from "../middleware/adminAuth.js";
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
router.get("/", adminAuth, async (req, res) => {
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
  try {
    const { busNo, tripType } = req.body;
    const driverId = req.driver.id;

    // Validate required fields first
    if (!busNo || !tripType) {
      return res.status(400).json({
        message: "busNo and tripType are required",
      });
    }

    // Verify authenticated driver
    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    // Verify assigned bus
    if (String(driver.assignedBus) !== String(busNo)) {
      return res.status(403).json({
        message: "You can only start a trip for your assigned bus",
      });
    }

    // Prevent duplicate active trips for this driver
    const existingTrip = await Trip.findOne({
      driverId,
      status: "active",
    });

    if (existingTrip) {
      return res.status(400).json({
        message: "Driver already has an active trip",
        tripId: existingTrip._id,
      });
    }

    // Create trip
    const trip = await Trip.create({
      driverId,
      busNo,
      tripType,
      startTime: new Date(),
      endTime: null,
      duration: 0,
      status: "active",
    });

    // Notify connected clients only after successful creation
    const io = req.app.get("io");

    if (io) {
      io.emit("tripStarted", {
        busNo: trip.busNo,
        tripId: trip._id,
        tripType: trip.tripType,
      });
    }

    return res.status(201).json(trip);
  } catch (error) {
    console.error("Start trip failed:", error.message);

    return res.status(500).json({
      message: "Unable to start trip",
    });
  }
});


// ── END TRIP ─────────────────────────────────────────────
// ── END TRIP ─────────────────────────────────────────────
router.put("/end", authMiddleware, async (req, res) => {
  

  try {
    const driver = await Driver.findById(req.driver.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found"
      });
    }

    const { tripId } = req.body;

  

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

     
    } 
    
    // ─────────────────────────────────────────────
    // Fallback for old Driver App code
    // ─────────────────────────────────────────────
    else {
      trip = await Trip.findOne({
        driverId: driver._id,
        status: "active"
      }).sort({ startTime: -1 });

   
    }

    if (!trip) {
      return res.status(404).json({
        message: "No active trip found"
      });
    }



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
     bus.gpsTimestamp = null;
  bus.speed = 0;
  bus.isOnline = false;
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

    
    }

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────

    

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
  console.error("End trip failed:", error.message);

  return res.status(500).json({
    message: "Unable to end trip",
  });
}
});

// ── STOP TRIP (old route kept for Driver App compatibility) ─
router.put("/stop/:id", authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (String(trip.driverId) !== String(req.driver.id)) {
  return res.status(403).json({
    message: "You can only end your own trip",
  });
}

if (trip.status !== "active") {
  return res.status(400).json({
    message: "Trip is not active",
  });
}

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
