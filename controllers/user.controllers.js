const User = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SALT = bcrypt.genSaltSync(10);
const JWT_SECRET = process.env.JWT_SECRET;

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
            const token = jwt.sign({user_id: user._id,user_email: user.user_email, user_name: user.user_name}, JWT_SECRET, {expiresIn: "3h"});
            res.cookie("token", token, cookieOptions);
            await user.save();
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

module.exports = {
    SignUp,
    SignIn,
    signOut,
    getUserProfile,
    updateUsername,
    checkToken
}