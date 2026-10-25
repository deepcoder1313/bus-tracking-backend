import express from "express";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Parent from "../models/Parent.js";
import parentAuth from "../middleware/parentAuth.js";
import { sendPushNotification } from "../services/notificationService.js";
import adminAuth from "../middleware/adminAuth.js";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
const router = express.Router();

/* ===========================
   GET ALL PARENTS
=========================== */

router.get("/", adminAuth, async (req, res) => {
  try {
    const parents = await Parent.find()
      .select("-password -passwordResetTokenHash -passwordResetExpiresAt")
      .populate("studentId");

    res.json(parents);
  } catch (error) {
    res.status(500).json({
      message: "Unable to fetch parents",
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
    


const { email, password } = req.body;

const normalizedEmail =
  typeof email === "string" ? email.trim() : "";

const parent = await Parent.findOne({
  email: {
    $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    $options: "i",
  },
}).populate("studentId");

console.log("Parent login lookup:", {
  email: normalizedEmail,
  parentFound: !!parent,
});


console.log("Parent login lookup:", {
  parentFound: !!parent,
});

console.log("Parent login lookup:", {
  emailNormalized: normalizedEmail,
  parentFound: !!parent,
});
    

    if (!parent) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      parent.password
    );

 

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid Email or Password",
      });
    } 

const token = jwt.sign(
  {
    id: parent._id.toString(),
    role: "parent",
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d",
  }
);


    const parentObj = parent.toObject();

    delete parentObj.password;


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
   FORGOT PASSWORD
=========================== */

router.post("/forgot-password", async (req, res) => {
  const genericMessage =
    "If an account exists for that email, reset instructions will be sent.";

  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim()
        : "";

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const parent = await Parent.findOne({
      email: {
        $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    // Use the same response whether the email exists or not.
    if (!parent) {
      return res.json({ message: genericMessage });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const resetBaseUrl = process.env.PARENT_APP_RESET_URL;

    if (!smtpHost || !smtpUser || !smtpPass || !resetBaseUrl) {
      console.error("Password reset email configuration is incomplete");

      return res.status(503).json({
        message: "Password reset email service is not configured",
      });
    }

    // Random token is emailed; only its SHA-256 hash is stored.
    const resetToken = crypto.randomBytes(32).toString("hex");

    parent.passwordResetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    parent.passwordResetExpiresAt =
      new Date(Date.now() + 15 * 60 * 1000);

    // Save only reset fields; do not modify the current password.
    parent.markModified("passwordResetTokenHash");
    parent.markModified("passwordResetExpiresAt");
    await parent.save();

    const resetUrl = new URL(resetBaseUrl);
    resetUrl.searchParams.set("token", resetToken);
    resetUrl.searchParams.set("email", parent.email);

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 465),
        secure: process.env.SMTP_SECURE !== "false",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpUser,
        to: parent.email,
        subject: "Reset your Parent App password",
        text: [
          "We received a request to reset your password.",
          "",
          `Open this link in the Parent App: ${resetUrl.toString()}`,
          "",
          "This link expires in 15 minutes and can only be used once.",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
      });
    } catch (emailError) {
      // Invalidate the token if sending failed.
      parent.passwordResetTokenHash = undefined;
      parent.passwordResetExpiresAt = undefined;
      await parent.save();

      console.error("Password reset email failed:", emailError.message);

      return res.status(503).json({
        message: "Unable to send reset email. Please try again later.",
      });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      message: "Unable to process password reset",
    });
  }
});


/* ===========================
   RESET PASSWORD
=========================== */

router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (
      typeof email !== "string" ||
      typeof token !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        message: "Email, token, and new password are required",
      });
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({
        message: "Password must be between 8 and 128 characters",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const parent = await Parent.findOne({
      email: {
        $regex: `^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (
      !parent ||
      !parent.passwordResetTokenHash ||
      !parent.passwordResetExpiresAt ||
      parent.passwordResetExpiresAt.getTime() <= Date.now() ||
      parent.passwordResetTokenHash !== tokenHash
    ) {
      return res.status(400).json({
        message: "Reset link is invalid or expired. Request a new one.",
      });
    }

    // Assigning password and using save() triggers the existing bcrypt hook.
    parent.password = newPassword;
    parent.passwordResetTokenHash = undefined;
    parent.passwordResetExpiresAt = undefined;

    await parent.save();

    return res.json({
      message: "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      message: "Unable to reset password",
    });
  }
});

router.post("/test-push", parentAuth, async (req, res) => {
  try {
    const parent = await Parent.findById(req.parent.id);

    if (!parent) {
      return res.status(404).json({
        message: "Parent not found",
      });
    }

    if (!parent.expoPushToken) {
      return res.status(400).json({
        message: "Parent has no Expo push token",
      });
    }


    await sendPushNotification(
      parent.expoPushToken,
      "🚌 Test Notification",
      "Background push notifications are working!",
      {
        type: "test",
      }
    );

    res.json({
      message: "Test notification sent",
    });

  } catch (error) {
    console.log("❌ Test push error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});






 router.put(
  "/push-token",
  parentAuth,
  async (req, res) => {



    try {

      const { expoPushToken } = req.body;


      const parent = await Parent.findById(
        req.parent.id
      );



      if (!parent) {
        return res.status(404).json({
          message: "Parent not found",
        });
      }

      parent.expoPushToken = expoPushToken;

      await parent.save();

      res.json({
        message: "Push Token Saved",
      });

    } catch (error) {

      res.status(500).json({
        message: error.message,
      });

    }

  }
);

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