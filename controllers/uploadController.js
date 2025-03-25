import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import Student from "../models/studentModel.js";

export const uploadExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded!" });

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const studentsData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log("Extracted Students:", studentsData.length);

        // Extract students data
        const students = studentsData.map(student => {
            const studentField = student["Student"];
            const match = studentField ? studentField.match(/\((.*?)\)/) : null;

            return {
                registerNumber: match ? match[1] : null,
                name: studentField ? studentField.split(" (")[0] : "Unknown",
                department: student["Branch Name"],
                exam: student["Course"],
                examDate: student["Exam Date"],
                session: student["Session"]
            };
        }).filter(student => student.registerNumber);

        console.log("Valid Students After Filtering:", students.length);

        // Sort students based on registerNumber
        students.sort((a, b) => a.registerNumber.localeCompare(b.registerNumber));

        console.log("Students After Sorting:", students.length);

        // Group students by Exam Date and Session
        const groupedByDateSession = {};
        students.forEach(student => {
            const key = `${student.examDate}-${student.session}`;
            if (!groupedByDateSession[key]) groupedByDateSession[key] = [];
            groupedByDateSession[key].push(student);
        });

        const columns = ["A", "B", "C", "D", "E", "F"];
        const maxRows = 6;
        const maxSeatsPerClass = maxRows * columns.length;

        const seatAssignments = [];

        for (const key in groupedByDateSession) {
            let rowCounter = 1;
            let classCounter = 101;
            const studentsInGroup = groupedByDateSession[key];

            // Group students by department (branch)
            const groupedByDepartment = {};
            studentsInGroup.forEach(student => {
                if (!groupedByDepartment[student.department]) groupedByDepartment[student.department] = [];
                groupedByDepartment[student.department].push(student);
            });

            // Get the list of departments
            const departments = Object.keys(groupedByDepartment);

            if (departments.length > 6) {
                console.warn(`Warning: More than 6 departments (${departments.length}) found for ${key}. Only first 6 will be seated.`);
            }

            // Assign each department to a specific column (up to 6 departments)
            const departmentToColumnMap = {};
            departments.slice(0, 6).forEach((dept, index) => {
                departmentToColumnMap[dept] = columns[index];
            });

            // Assign seats column-wise by department
            const columnStudents = {};
            columns.forEach(col => {
                columnStudents[col] = [];
            });

            // Distribute students to their respective columns based on department
            Object.entries(departmentToColumnMap).forEach(([dept, col]) => {
                columnStudents[col] = groupedByDepartment[dept];
            });

            // Find the maximum number of students in any column
            const maxStudentsInColumn = Math.max(...Object.values(columnStudents).map(arr => arr.length));

            // Assign seats row by row, taking one student from each column
            for (let row = 1; row <= maxStudentsInColumn; row++) {
                columns.forEach(col => {
                    if (columnStudents[col].length >= row) {
                        const student = columnStudents[col][row - 1];
                        const seat = `${col}${rowCounter}`;
                        const classRoom = `Room ${classCounter}`;

                        seatAssignments.push({
                            registerNumber: student.registerNumber,
                            name: student.name,
                            department: student.department,
                            classRoom,
                            seatNumber: seat,
                            subject: student.exam,
                            examDate: student.examDate,
                            session: student.session
                        });

                        console.log(`Assigned ${student.registerNumber} to Seat ${seat} in ${classRoom}`);
                    }
                });

                rowCounter++;

                // Move to next classroom if current one is full
                if (rowCounter > maxRows) {
                    rowCounter = 1;
                    classCounter++;
                }
            }
        }

        console.log("Total Seat Assignments:", seatAssignments.length);
        if (seatAssignments.length > 0) {
            await Student.insertMany(seatAssignments);
            console.log("Inserted into DB:", seatAssignments.length);
        }
        // Generate Excel Output
        // const outputWorkbook = xlsx.utils.book_new();
        // const outputWorksheet = xlsx.utils.json_to_sheet(seatAssignments);
        // xlsx.utils.book_append_sheet(outputWorkbook, outputWorksheet, "Seat Assignments");

        // const outputPath = "seat_assignments.xlsx";
        // xlsx.writeFile(outputWorkbook, outputPath);

        // res.download(outputPath, "seat_assignments.xlsx", (err) => {
        //     if (err) {
        //         console.error("Error sending file:", err);
        //         res.status(500).json({ error: "Error sending file" });
        //     } else {
        //         // fs.unlinkSync(outputPath); // Delete the file after download
        //     }
        // });

        return res.status(201).json({
            message: "Excel file processed successfully!",
        });

    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: error.message });
    }
};