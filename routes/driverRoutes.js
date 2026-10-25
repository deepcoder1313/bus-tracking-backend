  import bcrypt from "bcryptjs";
  import express from "express";
  import jwt from "jsonwebtoken";
  import adminAuth from "../middleware/adminAuth.js";
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

const driverResponse = savedDriver.toObject();
delete driverResponse.password;

return res.status(201).json(driverResponse);
    

     
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

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

 const normalizedEmail = email.trim();

const driver = await Driver.findOne({
  email: {
    $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    $options: "i",
  },
});

console.log("Driver login lookup:", {
  emailNormalized: normalizedEmail,
  driverFound: !!driver,
});

    if (!driver) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      driver.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    const token = jwt.sign(
  {
    id: driver._id.toString(),
    role: "driver",
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    const driverObj = driver.toObject();
    delete driverObj.password;

    return res.json({
      message: "Login Successful",
      token,
      driver: driverObj,
    });
  } catch (error) {
    console.error("Driver login failed:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});


  router.put("/:id/password", async (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          message: "Password is required",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { password: hashedPassword },
        { new: true }
      ).select("-password");

      if (!driver) {
        return res.status(404).json({
          message: "Driver not found",
        });
      }

      res.json({
        message: "Password updated successfully",
        driver,
      });
    } catch (error) {
      console.log(error);

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