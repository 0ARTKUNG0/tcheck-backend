const dotenv = require("dotenv");
dotenv.config();

const requiredEnvVars = ["PORT", "MONGODB_URL", "JWT_SECRET", "BASE_URL", "NODE_ENV"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(", ")}`);
    console.error("Please check your .env file.");
    console.error("\nRequired variables:");
    requiredEnvVars.forEach(v => {
        const status = process.env[v] ? "✓" : "✗";
        console.error(`  ${status} ${v}`);
    });
    process.exit(1);
}

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

// Routers
const userRouter = require("./router/user.router");
const documentRouter = require("./router/document.router");
const grammarRouter = require("./router/grammar.router");
const toneRouter = require("./router/tone.router");
const promptpayRouter = require("./router/promptpay.router");
const cardRouter = require("./router/card.router");
const webhookRouter = require("./router/webhook.router");

// Services
const { initializeCronJobs } = require("./services/cron.service");

const PORT = process.env.PORT;
const MONGODB_URL = process.env.MONGODB_URL;

const app = express();
app.set("trust proxy", 1);

app.use(express.json());

const allowedOrigins = [process.env.BASE_URL, "http://localhost:5173"];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // ใช้ custom error เพื่อให้ error handler จับได้ถูกประเภท
            const err = new Error("Not allowed by CORS");
            err.code = "CORS_NOT_ALLOWED";
            callback(err);
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-access-token"],
    credentials: true
}));

app.use(cookieParser());

// Serve static files for QR codes and uploads
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.json({ message: "tcheck API is running" });
});

// Mount routers
app.use("/api/user", userRouter);
app.use("/api/docs", documentRouter);
app.use("/api/grammar", grammarRouter);
app.use("/api/tone", toneRouter);
app.use("/api/payment/promptpay", promptpayRouter);
app.use("/api/payment/card", cardRouter);
app.use("/api/webhook", webhookRouter);

// Global error handler - ดัก error ทุกตัวก่อนตอบ client
// ต้องอยู่ท้ายสุดหลัง router ทั้งหมด
app.use((err, req, res, next) => {
    // CORS error - origin ไม่ได้รับอนุญาต
    if (err && err.code === "CORS_NOT_ALLOWED") {
        return res.status(403).json({
            code: "CORS_NOT_ALLOWED",
            message: "Origin not allowed"
        });
    }

    // JSON parse error (body ไม่ใช่ JSON ที่ถูกต้อง)
    if (err && err.type === "entity.parse.failed") {
        return res.status(400).json({
            code: "INVALID_JSON",
            message: "Request body is not valid JSON"
        });
    }

    // Error อื่นๆ ที่ไม่คาดคิด - log แต่ไม่เปิดเผย detail ให้ client
    console.error("[UNHANDLED ERROR]", err);
    return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
    });
});

mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log("Connected to MongoDB successfully");

        // Initialize cron jobs for daily token reset
        initializeCronJobs();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err.message);
        console.error("Server not started. Please check your MongoDB connection.");
        process.exit(1);
    });
