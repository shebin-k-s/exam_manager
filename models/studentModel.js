import mongoose from "mongoose"

const studentSchema = new mongoose.Schema({
    registerNumber: {
        type: String,
        required: [true, 'Register number is required'],
    },
    name: { 
        type: String,
        required: true 
    },
    department: { 
        type: String,
        required: true 
    },
    subject: { 
        type: String,
        required: true
    },
    classRoom: { 
        type: String,
        required: true
    },
    seatNumber: { 
        type: String,
        required: true
    },
    examDate: {
        type: String,
        required: true
    },
    session: {
        type: String,
        required: true,
        enum: ["Forenoon", "Afternoon"] 
    }
})

const Student = mongoose.model('Student', studentSchema)

export default Student