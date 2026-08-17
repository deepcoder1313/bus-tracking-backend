import mongoose from "mongoose";

const busSchema = new mongoose.Schema(
  {
    busNo: {
      type: String,
      required: true,
    },

    route: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Active", "Maintenance", "Offline"],
      default: "Active",
    },

    // 📍 Current Position
    latitude: {
      type: Number,
      default: 0,
    },

    longitude: {
      type: Number,
      default: 0,
    },

    // 🚍 GPS Speed (km/h)
    speed: {
      type: Number,
      default: 0,
    },

    // 🧭 Direction (0–360°)
    heading: {
      type: Number,
      default: 0,
    },

    // 🎯 GPS Accuracy (meters)
    accuracy: {
      type: Number,
      default: 0,
    },

    // 🕒 Driver GPS timestamp
    gpsTimestamp: {
      type: Number,
      default: 0,
    },

    // 🕒 Last valid update saved on server
    lastGpsUpdate: {
      type: Date,
      default: Date.now,
    },

    // 📶 Online status
    isOnline: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Bus", busSchema);