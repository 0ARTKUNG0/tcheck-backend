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
            return res.status(201).json({message: "User created successfully"});
    } catch(error){
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}
