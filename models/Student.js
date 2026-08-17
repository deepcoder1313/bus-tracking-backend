import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    className: {
      type: String,
      required: true,
    },

    rollNo: {
      type: String,
      required: true,
    },

    parentName: {
      type: String,
      required: true,
    },

    parentPhone: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

assignedBus: {
  type: String,
  default: "",
},
    pickupPoint: {
      type: String,
      default: "",
    },
    pickupLatitude: {
  type: Number,
  default: 0,
},

pickupLongitude: {
  type: Number,
  default: 0,
},

    // Link to Parent model
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
     },
   
        pickupNotificationSent: {
  type: Boolean,
  default: false,
},

parentId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Parent",
  default: null,
},
schoolNotificationSent: {
  type: Boolean,
  default: false,
},
pickupNotificationSent: {
  type: Boolean,
  default: false,
},

  },
  {
    timestamps: true,
  }
);

const Student = mongoose.model("Student", studentSchema);

export default Student;