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

sourceLatitude: {
  type: Number,
  default: 0,
},

sourceLongitude: {
  type: Number,
  default: 0,
},

destination: {
  type: String,
  required: true,
},

destinationLatitude: {
  type: Number,
  default: 0,
},

destinationLongitude: {
  type: Number,
  default: 0,
},

    distance: {
      type: String,
      required: true,
    },

    stops: [stopSchema],
  },
  {
    timestamps: true,
  }
);

const Route = mongoose.model("Route", routeSchema);

export default Route;