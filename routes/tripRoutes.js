import express from "express";
import Trip from "../models/Trip.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import { sendPushNotification } from "../services/notificationService.js";
import Driver from "../models/Driver.js";
import Bus from "../models/Bus.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


/* START TRIP */

router.post("/start", async (req, res) => {
   console.log("🚀 /trips/start called");
  console.log(req.body);
  try {
    const {
    driverId,
    busNo,
    tripType,
} = req.body;


 console.log("1");
    // Create Trip
const trip = new Trip({
  driverId,
  busNo,
  startTime: new Date(),
  tripType,
  status: "active",
});
console.log("1");
    await trip.save();
console.log("1");
    if (tripType === "return") {

    console.log(
        "🏠 Return Trip Started"
    );

}
const io = req.app.get("io");

if (io) {
  io.emit("tripStarted", {
    tripId: trip._id,
    busNo: trip.busNo,
    driverId: trip.driverId,
    tripType: trip.tripType,
    startTime: trip.startTime,
  });
}
console.log("🔔 TRIP STARTED BROADCAST:", {
  busNo: trip.busNo,
  driverId: trip.driverId,
});
    // ----------------------------
    // Send Trip Started Notification
    // ----------------------------
    console.log("🚌 Start Trip API Called");

    console.log("Bus:", busNo);

    const students = await Student.find({
      assignedBus: busNo,
    });
    console.log("Finding students...");
    console.log("Students:", students.length);
    console.log("Students Found:", students.length);

  for (const student of students) {

  console.log("---------------------");
  console.log("Student:", student.name);
  console.log("Parent ID:", student.parentId);

  if (!student.parentId) {
    console.log("❌ No Parent ID");
    continue;
  }

  const parent = await Parent.findById(student.parentId);

  console.log("Parent:", parent);

  if (!parent) {
    console.log("❌ Parent Not Found");
    continue;
  }

  console.log("Push Token:", parent.expoPushToken);

  if (!parent.expoPushToken) {
    console.log("❌ No Push Token");
    continue;
  }

  console.log("🚀 Sending Notification");

const title =
  tripType === "return"
    ? "🏠 Return Trip Started"
    : "🚌 Trip Started";

const body =
  tripType === "return"
    ? `Your child's bus ${busNo} has started the return journey.`
    : `Your child's bus ${busNo} has started today's trip.`;

await sendPushNotification(
  parent.expoPushToken,
  title,
  body,
  {
    type:
      tripType === "return"
        ? "return_trip"
        : "trip_started",
    busNo,
  }
);

  console.log("✅ Notification request completed");
}

await Student.updateMany(
  { assignedBus: busNo },
  {
    pickupNotificationSent: false,
    schoolNotificationSent: false,
  }
);
    res.status(201).json(trip);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }


});


/* STOP TRIP */


router.put("/end", authMiddleware, async (req, res) => {
    console.log("🛑 END TRIP API CALLED");
  console.log("Driver:", req.driver);
  try {
    const driver = await Driver.findById(req.driver.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

const trip = await Trip.findOne({
  driverId: driver._id,
  status: "active",
});

if (!trip) {
  return res.status(404).json({
    message: "No active trip found",
  });
}

trip.status = "completed";
trip.endTime = new Date();

trip.duration = Math.round(
  (trip.endTime - trip.startTime) / 60000
);

await trip.save();

   

    const bus = await Bus.findOne({
      busNo: driver.assignedBus,
    });

    if (bus) {
      bus.isOnline = false;
      bus.speed = 0;

      await bus.save();
    }

    const io = req.app.get("io");

    io.emit("tripEnded", {
      busNo: bus.busNo,
    });

    res.json({
      message: "Trip Ended Successfully",
      trip,
    });

  } catch (error) {
    console.log(error);

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