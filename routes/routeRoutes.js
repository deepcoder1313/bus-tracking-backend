import express from "express";
import Route from "../models/Route.js";

const router = express.Router();

// GET ALL ROUTES

router.get("/", async (req, res) => {
  try {
    const routes = await Route.find();

    res.json(routes);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ADD ROUTE

router.post("/", async (req, res) => {
  try {
    const newRoute = new Route({
      routeName: req.body.routeName,
      source: req.body.source,
      destination: req.body.destination,
      distance: req.body.distance,
    });

    const savedRoute = await newRoute.save();

    res.status(201).json(savedRoute);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// UPDATE ROUTE

router.put("/:id", async (req, res) => {
  try {
    const updatedRoute = await Route.findByIdAndUpdate(
      req.params.id,
      {
        routeName: req.body.routeName,
        source: req.body.source,
        destination: req.body.destination,
        distance: req.body.distance,
      },
      { new: true }
    );

    res.json(updatedRoute);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// DELETE ROUTE

router.delete("/:id", async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);

    res.json({
      message: "Route deleted successfully",
    });
  } catch (error) {
  console.log("POST ERROR:", error);

  res.status(400).json({
    message: error.message,
    stack: error.stack,
  });
}
});

export default router;