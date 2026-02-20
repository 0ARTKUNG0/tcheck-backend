const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const userRouter = require("./router/user.router");

dotenv.config();

const app = express();
const PORT = process.env.PORT;
const MONGODB_URL = process.env.MONGODB_URL;

app.use(express.json());

const allowedOrigins = [process.env.BASE_URL];

app.use(cors({
    origin: function (origin, callback) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-access-token"],
    credentials: true
}));

app.use(cookieParser());

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/api/user", userRouter);

if(!MONGODB_URL){
    console.error("MongoDB URL is missing. Please set it in your .env file.");
    process.exit(1);
}else{
    mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log("Connected to MongoDB successfully");
    })
    .catch((err) => {
        console.error("MongoDB connection error", err.message);
    });
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});