const { MongoMemoryServer } = require("mongodb-memory-server");

async function start() {
  console.log("Starting in-memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log("MongoDB running at:", uri);

  process.env.MONGODB_URL = uri;
  process.env.PORT = process.env.PORT || "5000";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret123";
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  process.env.BASE_URL = process.env.BASE_URL || "http://localhost:3000";

  console.log("Starting server...\n");
  require("../index.js");
}

start().catch(err => {
  console.error("Failed to start:", err);
  process.exit(1);
});
