// routes/studentRoutes.js
import express from "express";
import Student from "../models/Student.js";

const router = express.Router();

// GET ALL STUDENTS
router.get("/", async (req, res) => {
  try {
    const students = await Student.find()
     .populate("parentId")
     .populate("assignedBus"); 
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ADD STUDENT  ← FIX: now saves pickupLatitude + pickupLongitude
router.post("/", async (req, res) => {
  console.log("📥 Incoming Body:", req.body);
  try {
    const student = new Student({
  name: req.body.name,
  className: req.body.className,
  rollNo: req.body.rollNo,

  // ✅ New
  parentId: req.body.parentId,

  parentName: req.body.parentName,
  parentPhone: req.body.parentPhone,

  address: req.body.address,

  assignedBus: req.body.assignedBus,

  pickupPoint: req.body.pickupPoint,

  pickupLatitude: req.body.pickupLatitude || 0,
  pickupLongitude: req.body.pickupLongitude || 0,
});


    const saved = await student.save();
    res.status(201).json(saved);
  } catch (error) {
    console.log("❌ Student Save Error:", error);
    res.status(400).json({ message: error.message });
  }
});

// UPDATE STUDENT  ← FIX: req.body passthrough already includes coords
router.put("/:id", async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,   // includes pickupLatitude + pickupLongitude if sent
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE STUDENT
router.delete("/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
