import express from "express";
import Student from "../models/Student.js";

const router = express.Router();

// ================= GET ALL STUDENTS =================

router.get("/", async (req, res) => {
  try {
    const students = await Student.find().populate("assignedBus");

    res.json(students);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ================= ADD STUDENT =================
router.post("/", async (req, res) => {
  console.log("📥 Body Received:", req.body);

  try {
    const student = new Student({
      name: req.body.name,
      className: req.body.className,
      rollNo: req.body.rollNo,
      parentName: req.body.parentName,
      parentId: req.body.parentId,
      parentPhone: req.body.parentPhone,
      address: req.body.address,
      assignedBus: req.body.assignedBus,
      pickupPoint: req.body.pickupPoint,
    });

    const savedStudent = await student.save();

    res.status(201).json(savedStudent);
  }
  
  catch (error) {
  console.log("❌ Full Error:", error);

  res.status(400).json({
    success: false,
    message: error.message,
    errors: error.errors,
  });
}
});
// ================= UPDATE STUDENT =================

router.put("/:id", async (req, res) => {
  try {
    const updatedStudent =
      await Student.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(updatedStudent);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ================= DELETE STUDENT =================

router.delete("/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);

    res.json({
      message: "Student deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;