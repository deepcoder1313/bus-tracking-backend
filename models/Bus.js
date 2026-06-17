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

    latitude: {
      type: Number,
      default: 0,
    },

    longitude: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);
const Bus = mongoose.model("Bus", busSchema);

export default Bus;