
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Bus from "../models/Bus.js";
import Driver from "../models/Driver.js";

const router = express.Router();

/* GET ALL BUSES */
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find();
    res.json(buses);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* ADD BUS */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const newBus = new Bus({
  busNo: req.body.busNo,
  route: req.body.route,
  status: req.body.status,
});

    const savedBus = await newBus.save();

    res.status(201).json(savedBus);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

router.put("/update-location", authMiddleware, async (req, res) => {
  console.log("req.driver =", req.driver);
console.log("req.body =", req.body);
  try {
    const driver = await Driver.findById(req.driver.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    const bus = await Bus.findOne({
      busNo: driver.assignedBus,
    });

    if (!bus) {
      return res.status(404).json({
        message: "Assigned bus not found",
      });
    }

    bus.latitude = req.body.latitude;
    bus.longitude = req.body.longitude;

    await bus.save();
const io = req.app.get("io");

console.log("📡 Emitting busLocationUpdated:", bus);


io.emit("busLocationUpdated", bus);

    res.json({
      message: "Location updated",
      bus,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});




router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { busNo, route, status } = req.body;

    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found",
      });
    }

    bus.busNo = busNo;
    bus.route = route;
    bus.status = status;

    await bus.save();

    res.json(bus);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});


/* UPDATE BUS */




/* DELETE BUS */
router.delete("/:id", async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);

    res.json({
      message: "Bus Deleted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
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
    res.status(500).json({
      message: error.message,
    });
  }
});


export default router;

