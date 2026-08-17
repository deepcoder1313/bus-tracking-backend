
import express from "express";
import http from "http";
import { Server } from "socket.io";

import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

import fetch from "node-fetch";
import adminRoutes from "./routes/adminRoutes.js";
import busRoutes from "./routes/busRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import parentRoutes from "./routes/parentRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
// At top with imports:
import DRoutes from "./routes/DRoutes.js";
import directionsRoutes from "./routes/directionsRoutes.js";
import etaRoutes from "./routes/etaRoutes.js";

// With other app.use() lines:




global.fetch = fetch;




dotenv.config();

// ---------------- CONNECT DATABASE ----------------

connectDB();

// ---------------- EXPRESS APP ----------------

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/buses", busRoutes);

app.use("/api/drivers", driverRoutes);

app.use("/api/routes", routeRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/parents", parentRoutes);


app.use("/api/students", studentRoutes);

app.use("/api/trips", tripRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/eta", etaRoutes);
app.use("/api/driver", DRoutes);
app.use("/api/directions", directionsRoutes);



// ---------------- HTTP SERVER ----------------

const server = http.createServer(app);


// ---------------- SOCKET.IO ----------------

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Make io available in routes later
app.set("io", io);

// Listen for client connections
io.on("connection", (socket) => {

  
  console.log("✅ Client Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client Disconnected:", socket.id);
  });
socket.on(
    "joinParentRoom",
    (parentId)=>{

        socket.join(
            `parent_${parentId}`
        );

        console.log(
            `✅ Parent Joined Room: parent_${parentId}`
        );

    }
);

});

// ---------------- MIDDLEWARE ----------------


// ---------------- TEST ROUTE ----------------

app.get("/", (req, res) => {
  res.send("🚍 Bus Tracking Backend Running");
});

// ---------------- API ROUTES ----------------


// ---------------- SERVER ----------------

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

