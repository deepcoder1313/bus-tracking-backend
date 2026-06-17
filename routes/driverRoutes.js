import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import Driver from "../models/Driver.js";

const router = express.Router();


// GET ALL DRIVERS
router.get("/", async (req, res) => {
  try {
   const drivers = await Driver.find().select("-password");
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ADD DRIVER

router.post("/", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newDriver = new Driver({
      name: req.body.name,
      phone: req.body.phone,
      license: req.body.license,
      assignedBus: req.body.assignedBus,
      email: req.body.email,
      password: hashedPassword,
    });

    const savedDriver = await newDriver.save();
    

    res.status(201).json(savedDriver);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});


// DRIVER LOGIN


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find driver by email
    const driver = await Driver.findOne({ email });

    if (!driver) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(
      password,
      driver.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: driver._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const driverObj = driver.toObject();
delete driverObj.password;


    res.json({
      message: "Login Successful",
      token,
      driver : driverObj,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});


// UPDATE DRIVER
router.put("/:id", async (req, res) => {
  try {
    const updatedDriver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        phone: req.body.phone,
        license: req.body.license,
        assignedBus: req.body.assignedBus,
      },
      { new: true }
    );

    res.json(updatedDriver);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE DRIVER
router.delete("/:id", async (req, res) => {
  try {
    await Driver.findByIdAndDelete(req.params.id);

    res.json({
      message: "Driver deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;