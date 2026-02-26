const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const userRouter = require("./router/user.router");
const documentRouter = require("./router/document.router");

// Validate required environment variables
const requiredEnvVars = ["PORT", "MONGODB_URL", "JWT_SECRET", "BASE_URL", "NODE_ENV"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    console.error("Please check your .env file.");
    process.exit(1);
}

const PORT = process.env.PORT;
const MONGODB_URL = process.env.MONGODB_URL;

const app = express();

app.use(express.json());

const allowedOrigins = [process.env.BASE_URL];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like Postman, mobile apps, curl)
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

app.get("/", (req, res) => {
    res.json({ message: "tcheck API is running" });
});

app.use("/api/user", userRouter);
app.use("/api/docs", documentRouter);

// Connect to MongoDB and start server only after successful connection
mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log("Connected to MongoDB successfully");

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
