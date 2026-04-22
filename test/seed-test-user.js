/**
 * Seed test user and generate JWT token
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

require("dotenv").config();

async function seed() {
  const MONGODB_URL = process.env.MONGODB_URL;
  const JWT_SECRET = process.env.JWT_SECRET;

  await mongoose.connect(MONGODB_URL);

  const User = require("../models/user.model.js");

  // Clear existing test user
  await User.deleteOne({ user_email: "test@example.com" });

  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync("password123", salt);

  const user = new User({
    user_name: "testuser",
    user_email: "test@example.com",
    user_password: hashPassword,
    user_role: "user-free"
  });

  await user.save();

  console.log("JWT_SECRET length:", JWT_SECRET.length);
  console.log("JWT_SECRET value:", JSON.stringify(JWT_SECRET));

  const token = jwt.sign(
    { user_id: user._id, user_email: user.user_email, user_name: user.user_name },
    JWT_SECRET,
    { expiresIn: "3h" }
  );

  console.log("\n=== TEST USER CREATED ===");
  console.log("User ID:", user._id.toString());
  console.log("Email:", user.user_email);
  console.log("Password:", "password123");
  console.log("\n=== JWT TOKEN ===");
  console.log(token);
  console.log("\n=== COPY THIS TO CONFIG.existingToken ===\n");

  // Save token to file for testing
  const fs = require("fs");
  fs.writeFileSync("test/test-token.txt", token);
  console.log("Token saved to test/test-token.txt");

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
