import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import Student from "../models/studentModel.js";
import PDFDocument from "pdfkit";
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
        const existingRecordsCount = {};

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

                        // Track records by key for reporting
                        const recordKey = `${student.examDate}-${student.session}`;
                        if (!existingRecordsCount[recordKey]) existingRecordsCount[recordKey] = 0;
                        existingRecordsCount[recordKey]++;

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

        console.log("Total Seat Assignments Prepared:", seatAssignments.length);
        
        if (seatAssignments.length > 0) {
            // Create operations for bulkWrite
            const operations = [];
            let newRecordsCount = 0;
            let updatedRecordsCount = 0;
            
            for (const assignment of seatAssignments) {
                // Create a unique filter to find existing records
                const filter = {
                    registerNumber: assignment.registerNumber,
                    examDate: assignment.examDate,
                    session: assignment.session
                };
                
                // Use updateOne with upsert to either update existing or insert new
                operations.push({
                    updateOne: {
                        filter: filter,
                        update: { $set: assignment },
                        upsert: true
                    }
                });
            }
            
            // Execute bulk operations
            if (operations.length > 0) {
                const bulkResult = await Student.bulkWrite(operations);
                
                console.log("BulkWrite Result:", {
                    insertedCount: bulkResult.insertedCount,
                    modifiedCount: bulkResult.modifiedCount,
                    upsertedCount: bulkResult.upsertedCount
                });
                
                return res.status(201).json({
                    message: "Excel file processed successfully!",
                    stats: {
                        totalProcessed: seatAssignments.length,
                        newRecords: bulkResult.upsertedCount,
                        updatedRecords: bulkResult.modifiedCount,
                        unchanged: seatAssignments.length - (bulkResult.upsertedCount + bulkResult.modifiedCount)
                    }
                });
            }
        }

        return res.status(201).json({
            message: "Excel file processed, but no valid records found.",
            stats: {
                totalProcessed: 0,
                newRecords: 0,
                updatedRecords: 0
            }
        });

    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: error.message });
    }
};


export const downloadSeatAllocation = async (req, res) => {
    try {
        const { examDate, session } = req.query;

        if (!examDate || !session) {
            return res.status(400).json({ message: "examDate and session are required" });
        }

        const students = await Student.find({ examDate, session });

        if (!students || students.length === 0) {
            return res.status(404).json({ message: "No seat allocation found for this date and session" });
        }

        // Group students by classroom
        const groupedByClassroom = {};
        students.forEach(student => {
            if (!groupedByClassroom[student.classRoom]) {
                groupedByClassroom[student.classRoom] = {};
            }
            groupedByClassroom[student.classRoom][student.seatNumber] = student.registerNumber;
        });

        // PDF generation
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            bufferPages: true
        });
        
        const buffers = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => {
            const pdfBuffer = Buffer.concat(buffers);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Seat_Allocation_${examDate}_${session}.pdf`);
            res.send(pdfBuffer);
        });

        // Add title
        doc.fontSize(16).text(`Seat Allocation - ${examDate} [${session}]`, { align: "center" });
        doc.moveDown(1);

        const columns = ["A", "B", "C", "D", "E", "F"];
        const maxRows = 6;

        // Define table dimensions
        const tableMargin = 50;
        const cellWidth = 80;
        const cellHeight = 30;
        const headerHeight = 30;
        const tableHeight = maxRows * cellHeight;
        const rowNumberWidth = 30;
        
        // Calculate page height limits
        const pageHeight = doc.page.height;
        const footerHeight = 20;
        
        // Track current Y position
        let currentY = doc.y;
        let currentPage = 1;
        
        // Function to draw a table for a classroom
        const drawClassroomTable = (classRoom, seatMap) => {
            // Check if there's enough space for the table + headers + margins
            const neededHeight = tableHeight + headerHeight + 50;
            
            if (currentY + neededHeight > pageHeight - doc.page.margins.bottom - footerHeight) {
                // Add page number to current page
                doc.fontSize(10)
                   .text(`Page ${currentPage}`, 
                          doc.page.width / 2, 
                          pageHeight - doc.page.margins.bottom - 15, 
                          { align: 'center' });
                
                // Add a new page
                doc.addPage();
                currentPage++;
                currentY = doc.page.margins.top;
                
                // Add title to new page
                doc.fontSize(16)
                   .text(`Seat Allocation - ${examDate} [${session}] (continued)`, 
                          { align: "center" });
                doc.moveDown(1);
                currentY = doc.y;
            }
            
            // Add classroom header with proper spacing
            doc.fontSize(14)
               .text(classRoom, { align: 'center', underline: true });
            
            // Move down after the title
            currentY = doc.y + 15;
            
            // Define table areas
            const headerY = currentY;
            const tableStartY = headerY + headerHeight;
            const tableWidth = columns.length * cellWidth;
            
            // Draw column headers (A-F)
            for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                const x = tableMargin + (colIndex * cellWidth);
                
                // Draw a column header cell
                doc.rect(
                    x, 
                    headerY, 
                    cellWidth, 
                    headerHeight
                ).stroke();
                
                // Add centered column header text
                doc.fontSize(14)
                   .text(
                      columns[colIndex],
                      x,
                      headerY + 10,
                      { width: cellWidth, align: 'center' }
                   );
            }
            
            // Draw row numbers (1-6) on the left side
            for (let row = 0; row < maxRows; row++) {
                const y = tableStartY + (row * cellHeight);
                
                // Draw row number cell
                doc.rect(
                    tableMargin - rowNumberWidth, 
                    y, 
                    rowNumberWidth, 
                    cellHeight
                ).stroke();
                
                // Add centered row number text
                doc.fontSize(14)
                   .text(
                      (row + 1).toString(),
                      tableMargin - rowNumberWidth,
                      y + 10,
                      { width: rowNumberWidth, align: 'center' }
                   );
            }
            
            // Draw the main table
            doc.rect(
                tableMargin, 
                tableStartY, 
                tableWidth, 
                tableHeight
            ).stroke();
            
            // Draw horizontal divider lines
            for (let rowIndex = 1; rowIndex < maxRows; rowIndex++) {
                const y = tableStartY + (rowIndex * cellHeight);
                doc.moveTo(tableMargin, y)
                   .lineTo(tableMargin + tableWidth, y)
                   .stroke();
            }
            
            // Draw vertical divider lines
            for (let colIndex = 1; colIndex < columns.length; colIndex++) {
                const x = tableMargin + (colIndex * cellWidth);
                doc.moveTo(x, tableStartY)
                   .lineTo(x, tableStartY + tableHeight)
                   .stroke();
            }
            
            // Add seat assignments
            for (let row = 0; row < maxRows; row++) {
                for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                    const col = columns[colIndex];
                    const x = tableMargin + (colIndex * cellWidth);
                    const y = tableStartY + (row * cellHeight);
                    
                    const seat = `${col}${row + 1}`;
                    const regNumber = seatMap[seat] || "---";
                    
                    doc.fontSize(10)
                       .text(
                          regNumber,
                          x,
                          y + 10,
                          { width: cellWidth, align: 'center' }
                       );
                }
            }
            
            // Move Y position for next table
            currentY = tableStartY + tableHeight + 40;
            doc.y = currentY;
        };
        
        // Draw tables for all classrooms
        for (const [classRoom, seatMap] of Object.entries(groupedByClassroom)) {
            drawClassroomTable(classRoom, seatMap);
        }
        
        // Add final page number
        doc.fontSize(10)
           .text(`Page ${currentPage}`, 
                  doc.page.width / 2, 
                  pageHeight - doc.page.margins.bottom - 15, 
                  { align: 'center' });
        
        doc.end();

    } catch (error) {
        console.error("Error generating seat layout PDF:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}