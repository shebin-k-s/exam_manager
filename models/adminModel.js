import mongoose from "mongoose"

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: 6
    },
})



const Admin = mongoose.model('Admin', adminSchema)

export default Admin