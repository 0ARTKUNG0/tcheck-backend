const User = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { logActivity } = require("../utils/logger.util.js");
const SALT = bcrypt.genSaltSync(10);
const JWT_SECRET = process.env.JWT_SECRET;

// JWKS client - ดึง Google public keys สำหรับ verify ID token signature
// (ใช้ jsonwebtoken + jwks-rsa แทน google-auth-library เพราะ compat issue กับ Node 24)
const googleJwksClient = jwksClient({
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    cache: true,
    cacheMaxAge: 60 * 60 * 1000  // cache 1 ชั่วโมง
});

function getGoogleKey(header, callback) {
    googleJwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
}

// Promise wrapper สำหรับ jwt.verify
function verifyGoogleIdToken(idToken) {
    return new Promise((resolve, reject) => {
        jwt.verify(idToken, getGoogleKey, {
            audience: process.env.GOOGLE_CLIENT_ID,
            issuer: ["https://accounts.google.com", "accounts.google.com"],
            algorithms: ["RS256"]
        }, (err, payload) => {
            if (err) return reject(err);
            resolve(payload);
        });
    });
}

// Cookie options สำหรับ cross-origin deployment (FE/BE คนละโดเมน)
const cookieOptions = {
    httpOnly: true,
    secure: true,      // production บน https
    sameSite: "none",  // FE/BE คนละโดเมน ต้องเป็น none
    path: "/",
    maxAge: 3 * 60 * 60 * 1000,
};

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

const SignUp = async (req, res) => {
    const {user_name, user_email, user_password} = req.body;

    if(!user_name || !user_email || !user_password){
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "All fields are required"
        });
    }

    // ป้องกัน NoSQL injection: ต้องเป็น string เท่านั้น
    if (typeof user_name !== "string" || typeof user_email !== "string" || typeof user_password !== "string") {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Invalid input format"
        });
    }

    if (!isValidEmail(user_email)) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Invalid email format"
        });
    }

    if (user_password.length < 6) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Password must be at least 6 characters"
        });
    }

    try{
        const normalizedEmail = user_email.toLowerCase().trim();
        const hashPassword = bcrypt.hashSync(user_password, SALT);
        const user = new User({
            user_name,
            user_email: normalizedEmail,
            user_password: hashPassword
        });
        await user.save();
        // Log activity สำหรับ admin dashboard
        logActivity({ user_id: user._id, user_name: user.user_name, type: "user_signup" });
        const token = jwt.sign({user_id: user._id,user_email: user.user_email, user_name: user.user_name}, JWT_SECRET, {expiresIn: "3h"});
        res.cookie("token", token, cookieOptions);
        return res.status(201).json({message: "User created successfully", user_name: user.user_name, user_role: user.user_role, user_email: user.user_email});
    } catch(error){
        if (error.code === 11000) {
            return res.status(409).json({
                code: "DUPLICATE_EMAIL",
                message: "Email already exists"
            });
        }
        console.log(error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
}

const SignIn = async (req, res) => {
    const {user_name, user_email, user_password} = req.body;

    if((!user_email && !user_name) || !user_password){
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Email or username and password are required"
        });
    }

    // ป้องกัน NoSQL injection: ถ้ามีค่า ต้องเป็น string เท่านั้น
    if (
        (user_email !== undefined && typeof user_email !== "string") ||
        (user_name !== undefined && typeof user_name !== "string") ||
        typeof user_password !== "string"
    ) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Invalid input format"
        });
    }

    try{
        const query = user_email
            ? { user_email: user_email.toLowerCase().trim() }
            : { user_name };
        const user = await User.findOne(query);
        if(!user){
            return res.status(401).json({
                code: "NOT_FOUND",
                message: "User not found"
            });
        }
        const isPasswordMatch = bcrypt.compareSync(user_password, user.user_password);
        if(!isPasswordMatch){
            return res.status(401).json({
                code: "INVALID_PASSWORD",
                message: "Invalid password"
            });
        }
        const token = jwt.sign({user_id: user._id,user_email: user.user_email, user_name: user.user_name}, JWT_SECRET, {expiresIn: "3h"});
        res.cookie("token", token, cookieOptions);
        return res.status(200).json({message: "User signed in successfully", user_name: user.user_name, user_role: user.user_role, user_email: user.user_email});
    } catch(error){
        console.log(error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
}

const signOut = async (req, res) => {
    try {
        // res.clearCookie("token", cookieOptions);
        res.clearCookie("token", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
        });
        return res.status(200).json({message: "User signed out successfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
}

const getUserProfile = async (req, res) => {
    try{
        return res.status(200).json({ user: req.user });
    } catch(error){
        console.log(error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
}

const updateUsername = async (req, res) => {
    const {user_name} = req.body;
    if(!user_name){
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Username is required"
        });
    }
    // ป้องกัน NoSQL injection: ต้องเป็น string เท่านั้น
    if (typeof user_name !== "string") {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Invalid input format"
        });
    }
    try{
        const user = await User.findById(req.user._id);
        if(!user){
            return res.status(404).json({
                code: "NOT_FOUND",
                message: "User not found"
            });
        }
        user.user_name = user_name;
        await user.save();
        return res.status(200).json({message: "Username updated successfully", user_name});
    } catch(error){
        console.log(error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
}

const checkToken = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('remaining_tokens');
        if (!user) {
            return res.status(404).json({
                code: "NOT_FOUND",
                message: "User not found"
            });
        }
        return res.status(200).json({
            remaining_tokens: user.remaining_tokens
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
}

/**
 * POST /api/user/google-signin
 * รับ Google ID token (credential) จาก frontend แล้ว verify + sign in/sign up
 *
 * Flow:
 *  1. Verify credential กับ Google (เช็คลายเซ็น + audience)
 *  2. หา user จาก google_id → ถ้าเจอ = sign in
 *  3. ถ้าไม่เจอ → หาด้วย email
 *     - เจอ user เดิม (local auth) → link account (set google_id, auth_provider)
 *     - ไม่เจอ → สร้าง user ใหม่ (auth_provider = "google", ไม่มี password)
 *  4. Issue JWT + set cookie แบบเดียวกับ SignIn ปกติ
 */
const googleSignIn = async (req, res) => {
    const { credential } = req.body;

    if (!credential || typeof credential !== "string") {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Google credential is required"
        });
    }

    try {
        // Step 1: Verify Google ID token (ลายเซ็น, expiry, audience, issuer)
        let payload;
        try {
            payload = await verifyGoogleIdToken(credential);
        } catch (verifyError) {
            console.warn("[googleSignIn] Token verification failed:", verifyError.message);
            return res.status(401).json({
                code: "INVALID_GOOGLE_TOKEN",
                message: "Invalid or expired Google credential",
                debug: process.env.NODE_ENV === "production" ? undefined : verifyError.message
            });
        }

        // Google guarantees these fields ถ้า verify ผ่านแล้ว
        const { sub: googleId, email, name, picture, email_verified } = payload;

        // ป้องกันกรณีพิเศษที่ email ยังไม่ verified ใน Google
        if (!email_verified) {
            return res.status(403).json({
                code: "EMAIL_NOT_VERIFIED",
                message: "Google email is not verified"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Step 2: หา user จาก google_id ก่อน
        let user = await User.findOne({ google_id: googleId });
        let isNewUser = false;

        if (!user) {
            // Step 3: ไม่เจอด้วย google_id → หาด้วย email (Option A: auto-link)
            user = await User.findOne({ user_email: normalizedEmail });

            if (user) {
                // Existing local user - link Google account
                user.google_id = googleId;
                user.auth_provider = "google";
                if (!user.profile_picture && picture) {
                    user.profile_picture = picture;
                }
                await user.save();
                console.log(`[googleSignIn] Linked Google to existing account: ${normalizedEmail}`);
            } else {
                // ไม่เจอเลย - สร้าง user ใหม่
                user = new User({
                    user_name: name || normalizedEmail.split("@")[0],
                    user_email: normalizedEmail,
                    google_id: googleId,
                    auth_provider: "google",
                    profile_picture: picture || null
                    // ไม่ set user_password - schema ไม่ required แล้ว
                });
                await user.save();
                isNewUser = true;
                // Log activity สำหรับ admin dashboard
                logActivity({
                    user_id: user._id,
                    user_name: user.user_name,
                    type: "user_signup",
                    metadata: { auth_provider: "google" }
                });
                console.log(`[googleSignIn] Created new Google user: ${normalizedEmail}`);
            }
        }

        // Step 4: เช็ค banned/deleted ก่อน issue token
        if (user.is_deleted) {
            return res.status(401).json({
                code: "ACCOUNT_DELETED",
                message: "This account has been deleted"
            });
        }
        if (user.is_banned) {
            return res.status(403).json({
                code: "ACCOUNT_BANNED",
                message: "Your account has been banned. Please contact support."
            });
        }

        // Step 5: Issue JWT + set cookie (เหมือน SignIn ปกติ)
        const token = jwt.sign(
            { user_id: user._id, user_email: user.user_email, user_name: user.user_name },
            JWT_SECRET,
            { expiresIn: "3h" }
        );
        res.cookie("token", token, cookieOptions);

        return res.status(200).json({
            message: isNewUser ? "Account created and signed in successfully" : "User signed in successfully",
            user_name: user.user_name,
            user_role: user.user_role,
            user_email: user.user_email,
            profile_picture: user.profile_picture,
            auth_provider: user.auth_provider,
            is_new_user: isNewUser
        });
    } catch (error) {
        // E11000 - หาก race condition ระหว่าง findOne กับ save
        if (error.code === 11000) {
            return res.status(409).json({
                code: "DUPLICATE_EMAIL",
                message: "Email already exists with different auth method"
            });
        }
        console.error("[googleSignIn] Error:", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
};

module.exports = {
    SignUp,
    SignIn,
    signOut,
    getUserProfile,
    updateUsername,
    checkToken,
    googleSignIn
}