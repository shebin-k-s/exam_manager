import bcrypt from 'bcrypt'
import Jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";


export const signupAdmin = async (req, res) => {
    const { fullName, email, password } = req.body

    console.log(req.body);

    try {

        let existingUser = await Admin.findOne({ email })

        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" })
        }
        const hashedPassword = bcrypt.hashSync(password, 10);

        const newUser = new Admin({
            email,
            fullName,
            password: hashedPassword
        });


        await newUser.save();

        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        console.log(error);
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(", ") });
        }
        return res.status(500).json({ message: "Internal server error" })
    }
}

export const login = async (req, res) => {

    const { email, password } = req.body;

    try {

        if (!email || !password) {
            return res.status(404).json({ message: email ? "Password is required" : "Email is required" })
        }

        let user = await Admin.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Email doesn't exist" })
        }
        const isPasswordCorrect = bcrypt.compareSync(password, user.password);
        if (!isPasswordCorrect) {

            return res.status(401).json({ message: "Incorrect Password" })
        } else {
            const token = Jwt.sign({ userId: user._id, role: "Admin" }, process.env.JWT_TOKEN);
            return res.status(200).json({
                message: "Login Successfull",
                token: token,
                fullName: user.fullName,
                email: user.email
            })
        }


    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(", ") });
        }
        return res.status(500).json({ message: "Internal server error" })

    }
}