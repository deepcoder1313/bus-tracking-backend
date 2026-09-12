import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("🔐 AUTH HEADER:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No Bearer token");
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    console.log("🔑 TOKEN RECEIVED:", {
      exists: !!token,
      length: token?.length,
    });

    console.log("🔐 JWT SECRET EXISTS:", !!process.env.JWT_SECRET);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    console.log("✅ JWT VERIFIED:", decoded);

    req.driver = decoded;

    next();

  } catch (error) {

    console.log("❌ JWT VERIFY ERROR:", error.name);
    console.log("❌ JWT VERIFY MESSAGE:", error.message);

    return res.status(401).json({
      message: "Invalid token",
    });
  }
};

export default authMiddleware;