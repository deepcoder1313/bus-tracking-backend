import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const parentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    },

    // ✅ NEW
    expoPushToken: {
      type: String,
      default: "",
    },

    resetPasswordTokenHash: {
      type: String,
      default: undefined,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      default: undefined,
      select: false,
    },

    passwordResetTokenHash: {
  type: String,
  select: false,
},
passwordResetExpiresAt: {
  type: Date,
  select: false,
},

  },
  {
    timestamps: true,
  },
);

// Hash password before saving
parentSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

export default mongoose.model("Parent", parentSchema);