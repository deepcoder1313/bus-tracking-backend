import mongoose from "mongoose";

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  latitude: {
    type: Number,
    required: true,
  },

  longitude: {
    type: Number,
    required: true,
  },

  order: {
    type: Number,
    default: 0,
  }
});

const routeSchema = new mongoose.Schema(
  {
    routeName: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      required: true,
    },

    destination: {
      type: String,
      required: true,
    },

    distance: {
      type: String,
      required: true,
    },

    startLatitude: {
      type: Number,
      default: 0,
    },

    startLongitude: {
      type: Number,
      default: 0,
    },

    schoolLatitude: {
      type: Number,
      default: 0,
    },

    schoolLongitude: {
      type: Number,
      default: 0,
    },
    

    stops: [stopSchema],


    schoolName: {
  type: String,
  default: "",
},

schoolLatitude: {
  type: Number,
  default: 0,
},

schoolLongitude: {
  type: Number,
  default: 0,
},
  },

  
  {
    timestamps: true,
  }
);

export default mongoose.model("Route", routeSchema);