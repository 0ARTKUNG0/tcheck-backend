/**
 * Payment API Endpoint Tester
 * 
 * วิธีใช้:
 * 1. แก้ไขค่า CONFIG ด้านล่างให้ถูกต้อง
 * 2. รัน: node test/payment-api-test.js
 * 3. ดูผลลัพธ์ที่ console
 * 
 * เงื่อนไข:
 * - Server ต้องรันอยู่ (npm run dev หรือ npm start)
 * - MongoDB ต้องเชื่อมต่อได้
 * - ต้องมี Omise API keys ใน .env
 */

const axios = require("axios");

// ==================== CONFIG ====================
const CONFIG = {
  baseURL: "http://localhost:5000",
  // ข้อมูลผู้ใช้สำหรับ login (ต้องสมัครไว้แล้ว หรือจะให้สคริปต์สมัครอัตโนมัติก็ได้)
  user: {
    user_email: "test@example.com",
    user_password: "password123"
  },
  // ถ้ามี JWT token อยู่แล้ว ใส่ตรงนี้ได้เลย (สคริปต์จะไม่ login)
  existingToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjllODVlZmY1NjZkMjBlYTYzNmMyZTliIiwidXNlcl9lbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VyX25hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTc3NjgzNjM1MSwiZXhwIjoxNzc2ODQ3MTUxfQ.Qx9d7irNv6TXtBB9Tu9nFrG9px8FdknSg4KODDeIUPg",
  // Card token สำหรับทดสอบ Card Payment (สร้างจาก Omise.js frontend)
  // ถ้าไม่มี สคริปต์จะข้ามการทดสอบ Card
  cardToken: null
};

// ==================== UTILS ====================
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m"
};

let jwtToken = CONFIG.existingToken;
let createdPromptPayId = null;
let createdCardId = null;
let passCount = 0;
let failCount = 0;

function logPass(name, details = "") {
  passCount++;
  console.log(`${colors.green}✅ PASS${colors.reset} ${colors.bold}${name}${colors.reset} ${details}`);
}

function logFail(name, error) {
  failCount++;
  console.log(`${colors.red}❌ FAIL${colors.reset} ${colors.bold}${name}${colors.reset}`);
  if (error.response) {
    console.log(`   Status: ${error.response.status}`);
    console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
  } else {
    console.log(`   Error: ${error.message}`);
  }
}

function logInfo(message) {
  console.log(`${colors.cyan}ℹ️  INFO${colors.reset} ${message}`);
}

function logSection(title) {
  console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}  ${title}${colors.reset}`);
  console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// ==================== API CALLS ====================

async function login() {
  if (jwtToken) {
    logInfo("ใช้ existingToken ที่ตั้งค่าไว้");
    return true;
  }

  try {
    // พยายาม login ก่อน
    const res = await axios.post(`${CONFIG.baseURL}/api/user/signin`, {
      user_email: CONFIG.user.user_email,
      user_password: CONFIG.user.user_password
    });

    // ดึง token จาก cookie (axios ไม่ auto parse httpOnly cookie ให้)
    // แต่ backend ตอบกลับและ set cookie
    // ถ้า login สำเร็จ เราต้องสร้าง token เองหรือใช้ cookie jar
    // สำหรับความง่าย เราจะสมัครใหม่แล้วสร้าง token เองจาก JWT_SECRET? ไม่ได้เพราะไม่รู้ secret
    // วิธีที่ดีกว่า: สมัครใหม่แล้ว login

    logInfo("Login สำเร็จ (ผ่าน cookie)");
    return true;
  } catch (err) {
    logInfo("Login ไม่สำเร็จ จะลองสมัครสมาชิกใหม่...");
    return false;
  }
}

async function signupAndLogin() {
  try {
    // สมัครสมาชิกใหม่
    const signupRes = await axios.post(`${CONFIG.baseURL}/api/user/signup`, {
      user_name: "testuser_" + Date.now(),
      user_email: "test_" + Date.now() + "@example.com",
      user_password: CONFIG.user.user_password
    });
    logInfo(`สมัครสมาชิกสำเร็จ: ${signupRes.data.user_name}`);
  } catch (err) {
    // อาจจะมี user อยู่แล้ว ไม่เป็นไร
    if (err.response?.status === 409) {
      logInfo("User นี้มีอยู่แล้ว");
    }
  }

  try {
    // Login เพื่อดึง token จาก cookie
    const agent = axios.create({
      baseURL: CONFIG.baseURL,
      withCredentials: true
    });

    await agent.post("/api/user/signin", {
      user_email: CONFIG.user.user_email,
      user_password: CONFIG.user.user_password
    });

    // ถ้า server ตั้งค่า cookie แล้วเราใช้ withCredentials
    // แต่เพื่อความง่ายในการ test เราจะดึง profile โดยไม่มี token เพื่อดูว่า cookie ทำงานไหม
    // จริง ๆ แล้วเราควรใช้ jar/cookie store

    // ทางลัด: สร้าง JWT token เองไม่ได้ (ไม่รู้ secret)
    // แต่ backend รองรับ Authorization header ด้วย
    // เราจะใช้วิธีสร้าง token ผ่าน API อื่นไม่ได้

    // ทางแก้: ใช้ cookie-based request โดยใช้ axios กับ jar
    logInfo("Login สำเร็จ (cookie-based) - ต้องใช้ cookie jar ในการทดสอบ endpoint ที่ต้อง auth");
    return true;
  } catch (err) {
    logFail("Login", err);
    return false;
  }
}

// ใช้สำหรับ request ที่ต้องการ auth
async function authedRequest(method, url, data = null, customToken = null) {
  const token = customToken || jwtToken;
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await axios({
      method,
      url: `${CONFIG.baseURL}${url}`,
      data,
      headers
    });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    return { success: false, error: err };
  }
}

async function request(method, url, data = null) {
  try {
    const res = await axios({
      method,
      url: `${CONFIG.baseURL}${url}`,
      data
    });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    return { success: false, error: err };
  }
}

// ==================== TEST CASES ====================

async function testWebhookTest() {
  const result = await request("GET", "/api/webhook/test");
  if (result.success && result.data.message === "Webhook endpoint is working") {
    logPass("GET /api/webhook/test", `(status ${result.status})`);
    return true;
  } else {
    logFail("GET /api/webhook/test", result.error);
    return false;
  }
}

async function testWebhookOmise() {
  const payload = {
    key: "charge.complete",
    data: {
      id: "chrg_test_xxxxxxxxxxxxxxxxxxx",
      status: "successful",
      amount: 10000,
      currency: "THB",
      paid: true
    }
  };
  const result = await request("POST", "/api/webhook/omise", payload);
  if (result.success && result.data === "OK") {
    logPass("POST /api/webhook/omise", `(status ${result.status})`);
    return true;
  } else {
    logFail("POST /api/webhook/omise", result.error);
    return false;
  }
}

async function testPromptPayCreate() {
  const payload = {
    amount: 50,
    description: "Test PromptPay from API tester"
  };
  const result = await authedRequest("POST", "/api/payment/promptpay/create", payload);
  if (result.success && result.data.payment) {
    createdPromptPayId = result.data.payment.id;
    logPass("POST /api/payment/promptpay/create", `(amount: ${result.data.payment.amount}, status: ${result.data.payment.status})`);
    logInfo(`Created payment ID: ${createdPromptPayId}`);
    return true;
  } else {
    logFail("POST /api/payment/promptpay/create", result.error);
    return false;
  }
}

async function testPromptPayHistory() {
  const result = await authedRequest("GET", "/api/payment/promptpay/history");
  if (result.success && Array.isArray(result.data.payments)) {
    logPass("GET /api/payment/promptpay/history", `(count: ${result.data.count})`);
    return true;
  } else {
    logFail("GET /api/payment/promptpay/history", result.error);
    return false;
  }
}

async function testPromptPayGetById() {
  if (!createdPromptPayId) {
    logInfo("ข้าม GET /api/payment/promptpay/:id เพราะไม่มี payment ID");
    return false;
  }
  const result = await authedRequest("GET", `/api/payment/promptpay/${createdPromptPayId}`);
  if (result.success && result.data.payment) {
    logPass("GET /api/payment/promptpay/:id", `(status: ${result.data.payment.status})`);
    return true;
  } else {
    logFail("GET /api/payment/promptpay/:id", result.error);
    return false;
  }
}

async function testPromptPayCheckStatus() {
  if (!createdPromptPayId) {
    logInfo("ข้าม GET /api/payment/promptpay/status/:id เพราะไม่มี payment ID");
    return false;
  }
  const result = await authedRequest("GET", `/api/payment/promptpay/status/${createdPromptPayId}`);
  if (result.success && result.data.success === true) {
    logPass("GET /api/payment/promptpay/status/:id", `(status: ${result.data.status}, paid: ${result.data.paid})`);
    return true;
  } else {
    logFail("GET /api/payment/promptpay/status/:id", result.error);
    return false;
  }
}

async function testCardCreate() {
  if (!CONFIG.cardToken) {
    logInfo("ข้าม Card tests (ตั้งค่า cardToken ใน CONFIG เพื่อทดสอบ)");
    return false;
  }

  const payload = {
    amount: 150,
    description: "Test Card from API tester",
    card_token: CONFIG.cardToken
  };
  const result = await authedRequest("POST", "/api/payment/card/create", payload);
  if (result.success && result.data.payment) {
    createdCardId = result.data.payment.id;
    logPass("POST /api/payment/card/create", `(status: ${result.data.payment.status})`);
    return true;
  } else {
    logFail("POST /api/payment/card/create", result.error);
    return false;
  }
}

async function testCardCharge() {
  if (!CONFIG.cardToken) {
    logInfo("ข้าม POST /api/payment/card/charge");
    return false;
  }

  const payload = {
    amount: 15000, // satang
    token: CONFIG.cardToken,
    description: "Test Card Charge from API tester"
  };
  const result = await authedRequest("POST", "/api/payment/card/charge", payload);
  if (result.success && result.data.success === true) {
    logPass("POST /api/payment/card/charge", `(status: ${result.data.status})`);
    return true;
  } else {
    logFail("POST /api/payment/card/charge", result.error);
    return false;
  }
}

async function testCardHistory() {
  const result = await authedRequest("GET", "/api/payment/card/history");
  if (result.success && Array.isArray(result.data.payments)) {
    logPass("GET /api/payment/card/history", `(count: ${result.data.count})`);
    return true;
  } else {
    logFail("GET /api/payment/card/history", result.error);
    return false;
  }
}

async function testCardGetById() {
  if (!createdCardId) {
    logInfo("ข้าม GET /api/payment/card/:id เพราะไม่มี card payment ID");
    return false;
  }
  const result = await authedRequest("GET", `/api/payment/card/${createdCardId}`);
  if (result.success && result.data.payment) {
    logPass("GET /api/payment/card/:id", `(status: ${result.data.payment.status})`);
    return true;
  } else {
    logFail("GET /api/payment/card/:id", result.error);
    return false;
  }
}

async function testUnauthenticatedAccess() {
  logInfo("ทดสอบการเข้าถึงโดยไม่มี token...");
  const result = await request("GET", "/api/payment/promptpay/history");
  if (!result.success && result.error.response?.status === 401) {
    logPass("Auth check - ไม่มี token ต้องได้ 401", `(status: ${result.error.response.status})`);
    return true;
  } else {
    logFail("Auth check", result.error || new Error("Expected 401 but got success"));
    return false;
  }
}

// ==================== MAIN ====================

async function runTests() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║        Payment API Endpoint Tester                   ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`${colors.reset}`);
  console.log(`Base URL: ${CONFIG.baseURL}\n`);

  if (!CONFIG.existingToken) {
    console.log(`${colors.yellow}⚠️  คำเตือน: ไม่ได้ตั้งค่า existingToken${colors.reset}`);
    console.log(`   สคริปต์นี้ต้องการ JWT token สำหรับ endpoint ที่ต้อง auth`);
    console.log(`   วิธีได้ token:`);
    console.log(`   1. เพิ่ม 'token' ใน response ของ /api/user/signin ชั่วคราว`);
    console.log(`      (ใน user.controllers.js บรรทัด ~59 เพิ่ม token: token เข้าไปใน json)`);
    console.log(`   2. รัน signin ผ่าน Postman/curl แล้ว copy token มาใส่ใน CONFIG.existingToken`);
    console.log(`   3. หรือสร้าง JWT เองถ้ารู้ JWT_SECRET\n`);
    console.log(`${colors.yellow}   การทดสอบ endpoint ที่ต้อง auth จะถูกข้ามหรือล้มเหลว${colors.reset}\n`);
  }

  // 1. Webhook Tests (no auth)
  logSection("1. Webhook Endpoints (No Auth)");
  await testWebhookTest();
  await testWebhookOmise();

  // 2. Auth Check
  logSection("2. Authentication Check");
  await testUnauthenticatedAccess();

  // 3. PromptPay Tests (need auth)
  if (jwtToken) {
    logSection("3. PromptPay Endpoints (Auth Required)");
    await testPromptPayCreate();
    await testPromptPayHistory();
    await testPromptPayGetById();
    await testPromptPayCheckStatus();

    // 4. Card Tests (need auth + card token)
    logSection("4. Card Endpoints (Auth + Card Token Required)");
    if (CONFIG.cardToken) {
      await testCardCreate();
      await testCardCharge();
    }
    await testCardHistory();
    await testCardGetById();
  } else {
    logSection("3-4. Payment Endpoints (Skipped - No Token)");
    logInfo("ข้าม PromptPay และ Card tests เพราะไม่มี JWT token");
  }

  // Summary
  console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}  สรุปผลการทดสอบ${colors.reset}`);
  console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}  ผ่าน: ${passCount}${colors.reset}`);
  console.log(`${colors.red}  ไม่ผ่าน: ${failCount}${colors.reset}`);
  console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (createdPromptPayId) {
    console.log(`PromptPay Payment ID ที่สร้าง: ${createdPromptPayId}`);
  }
  if (createdCardId) {
    console.log(`Card Payment ID ที่สร้าง: ${createdCardId}`);
  }
}

runTests().catch(console.error);
