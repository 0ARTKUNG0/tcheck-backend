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
const userRouter = require("./router/user.router");
const documentRouter = require("./router/document.router");
const grammarRouter = require("./router/grammar.router");
const paymentRouter = require("./router/payment.router");
const { initializeCronJobs } = require("./services/cron.service");

const PORT = process.env.PORT;
const MONGODB_URL = process.env.MONGODB_URL;

const app = express();
app.set("trust proxy", 1);

app.use(express.json());

const allowedOrigins = [process.env.BASE_URL];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
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

app.use("/api/user", userRouter);
app.use("/api/docs", documentRouter);
app.use("/api/grammar", grammarRouter);
app.use("/api/payment", paymentRouter);

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



