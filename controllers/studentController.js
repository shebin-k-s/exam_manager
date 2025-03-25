import Student from "../models/studentModel.js";

export const findSeatByRollNumber = async (req, res) => {
    try {
        const { registerNumber,examDate } = req.body;
        console.log(req.params);

        const student = await Student.find({ registerNumber, examDate });
        if (!student || student.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }
        
        console.log(student);

        res.status(200).json(student);
    } catch (error) {
        console.log(error);

        res.status(500).json({ message: "Server error", error: error.message });
    }
};