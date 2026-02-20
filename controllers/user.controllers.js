const User = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie-parser");
const SALT = bcrypt.genSaltSync(10);
const JWT_SECRET = process.env.JWT_SECRET;

const SignUp = async (req, res) => {
    const {user_name, user_email, user_password, user_role, user_tier} = req.body;
        //check all field is filled
        if(!user_name || !user_email || !user_password){
            return res.status(400).json({message: "All fields are required"});
        }
        //check if user email is already exists
        const emailalreadyexists = await User.findOne({user_email});
        if(emailalreadyexists){
            return res.status(401).json({message: "Email already exists"});
        }
        try{
            //hash password
            const hashPassword = bcrypt.hashSync(user_password, SALT);
            //create new user 
            const user = new User({
                user_name,
                user_email,
                user_password: hashPassword,
                user_role: user_role || "user",
                user_tier: user_tier || "user-free"
            });
            const token = jwt.sign({user_id: user._id}, JWT_SECRET, {expiresIn: "1h"});
            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 1000
            });
            await user.save();
            return res.status(201).json({message: "User created successfully", user});
    } catch(error){
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}

const SignIn = async (req, res) => {
    const {user_email, user_password} = req.body;
    if(!user_email || !user_password){
        return res.status(400).json({message: "All fields are required"});
    }
    try{
        const user = await User.findOne({user_email});
        if(!user){
            return res.status(401).json({message: "User not found"});
        }
        const isPasswordMatch = bcrypt.compareSync(user_password, user.user_password);
        if(!isPasswordMatch){
            return res.status(401).json({message: "Invalid password"});
        }
        const token = jwt.sign({user_id: user._id}, JWT_SECRET, {expiresIn: "1h"});
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 1000
        });
        return res.status(200).json({message: "User signed in successfully", user});
    } catch(error){
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}

const signOut = async (req, res) => {
    try {
        res.clearCookie("token");
        return res.status(200).json({message: "User signed out successfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
} 
//update User username
const updateUsername = async (req, res) => {
    const {user_name} = req.body;
    if(!user_name){
        return res.status(400).json({message: "Username is required"});
    }
    try{
        const user = await User.findById(req.user.user_id);
        if(!user){
            return res.status(401).json({message: "User not found"});
        }
        user.user_name = user_name;
        await user.save();
        return res.status(200).json({message: "Username updated successfully", user});
    } catch(error){
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}

module.exports = {
    SignUp,
    SignIn,
    signOut,
    updateUsername
}