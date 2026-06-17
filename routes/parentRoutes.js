import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Parent from "../models/Parent.js";

const router = express.Router();

/* ===========================
   GET ALL PARENTS
=========================== */

router.get("/", async (req, res) => {
  try {
    const parents = await Parent.find().populate("studentId");

    res.json(parents);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* ===========================
   ADD PARENT
=========================== */

router.post("/", async (req, res) => {
  try {
    const existingParent = await Parent.findOne({
      email: req.body.email,
    });

    if (existingParent) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const parent = new Parent({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      studentId: req.body.studentId,
    });

    const savedParent = await parent.save();

    res.status(201).json(savedParent);
  } catch (error) {
  console.log("❌ Parent Save Error:", error);

  res.status(400).json({
    message: error.message,
    error,
  });
}
});

/* ===========================
   PARENT LOGIN
=========================== */

router.post("/login", async (req, res) => {
  try {
    console.log("📥 Body:", req.body);

    const { email, password } = req.body;

const parent = await Parent.findOne({
  email,
}).populate("studentId");
    console.log("👤 Parent Found:", parent);

    if (!parent) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      parent.password
    );

    console.log("🔑 Password Match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    const token = jwt.sign(
      {
        id: parent._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const parentObj = parent.toObject();

    delete parentObj.password;
    console.log("📤 Sending Parent:", JSON.stringify(parent, null, 2));

    res.json({
      message: "Login Successful",
      token,
      parent: parentObj,
    });

  } catch (error) {
    console.log("❌ Login Error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});
/* ===========================
   UPDATE PARENT
=========================== */

router.put("/:id", async (req, res) => {
  try {
    const updatedParent =
      await Parent.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(updatedParent);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* ===========================
   DELETE PARENT
=========================== */

router.delete("/:id", async (req, res) => {
  try {
    await Parent.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message: "Parent deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;