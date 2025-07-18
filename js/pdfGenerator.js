const examRoutines = {
    'NURSERY-A': [
        { subject: 'BENGALI (W+O)', date: '03-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'MATH (W+O)', date: '04-03-2025', day: 'Tuesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'ENGLISH (W+O)', date: '05-03-2025', day: 'Wednesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'DRAWING', date: '06-03-2025', day: 'Thursday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'RHYMES (O)', date: '07-03-2025', day: 'Friday', timing: '10:30 AM to 12:30 PM' }
    ],
    'NURSERY-B': [
        // Different schedule for NURSERY-B if needed
    ],
    'LKG-A': [
        { subject: 'ENGLISH (W+O)', date: '03-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'BENGALI (W+O)', date: '04-03-2025', day: 'Tuesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'MATH (W+O)', date: '05-03-2025', day: 'Wednesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'GK (O)', date: '06-03-2025', day: 'Thursday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'RHYMES (O)', date: '07-03-2025', day: 'Friday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'DRAWING', date: '08-03-2025', day: 'Saturday', timing: '10:30 AM to 12:30 PM' }
    ],
    'LKG-B': [
        { subject: 'MATH (W+O)', date: '03-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'ENGLISH (W+O)', date: '04-03-2025', day: 'Tuesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'BENGALI (W+O)', date: '05-03-2025', day: 'Wednesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'GK (O)', date: '06-03-2025', day: 'Thursday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'RHYMES (O)', date: '07-03-2025', day: 'Friday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'DRAWING', date: '08-03-2025', day: 'Saturday', timing: '10:30 AM to 12:30 PM' }
    ],
    'UKG-A': [
        { subject: 'MATH (W+O)', date: '03-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'EVS (W+O)', date: '04-03-2025', day: 'Tuesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'ENGLISH (W+O)', date: '05-03-2025', day: 'Wednesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'BENGALI / HINDI [W+O]', date: '06-03-2025', day: 'Thursday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'GK (W+O)', date: '07-03-2025', day: 'Friday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'CURSIVE (W)', date: '08-03-2025', day: 'Saturday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'DRAWING', date: '10-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' }
    ],
    'UKG-B': [
        // Different schedule for UKG-B if needed
    ],
    'CLASS-I': [
        { subject: 'MATH', date: '03-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'ENGLISH-I (Gra)', date: '04-03-2025', day: 'Tuesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'ENGLISH-II (Lit)', date: '05-03-2025', day: 'Wednesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'EVS', date: '06-03-2025', day: 'Thursday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'BENGALI (Gra) / HINDI(Gra)', date: '07-03-2025', day: 'Friday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'BENGALI (Lit) / HINDI(Lit)', date: '08-03-2025', day: 'Saturday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'COMPUTER', date: '10-03-2025', day: 'Monday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'GK & CURSIVE', date: '11-03-2025', day: 'Tuesday', timing: '10:30 AM to 12:30 PM' },
        { subject: 'DRAWING / M.V', date: '12-03-2025', day: 'Wednesday', timing: '10:30 AM to 12:30 PM' }
    ]
};

function getExamSchedule(className, section) {
    // Normalize class name format
    let normalizedClassName = className.toUpperCase();
    if (!normalizedClassName.startsWith('CLASS-')) {
        // For classes like NURSERY, LKG, UKG
        normalizedClassName = normalizedClassName.trim();
    }
    
    // Combine class and section to match the examRoutines key
    const classKey = `${normalizedClassName}-${section}`;
    console.log('Looking for routine with key:', classKey);
    console.log('Available routines:', Object.keys(examRoutines));
    
    // Try to find the exact class-section routine
    const routine = examRoutines[classKey];
    
    if (!routine) {
        console.warn(`No routine found for ${classKey}`);
        // If no exact match, try to find a class-only routine
        if (examRoutines[normalizedClassName]) {
            console.log(`Found routine for ${normalizedClassName}`);
            return examRoutines[normalizedClassName];
        }
        console.warn(`Using default CLASS-I routine`);
        return examRoutines['CLASS-I']; // Default routine
    }
    
    console.log(`Found routine for ${classKey}`);
    return routine;
}

class PDFGenerator {
    static async generateClassAdmitCards(students, className, academicYear = '2023-2024') {
        try {
            // Split students into chunks of 10
            const chunkSize = 10;
            const studentChunks = [];
            
            for (let i = 0; i < students.length; i += chunkSize) {
                studentChunks.push(students.slice(i, i + chunkSize));
            }

            console.log(`Processing ${students.length} students in ${studentChunks.length} chunks`);

            // Process each chunk
            for (let i = 0; i < studentChunks.length; i++) {
                const chunk = studentChunks[i];
                console.log(`Processing chunk ${i + 1}/${studentChunks.length}`);

                const backgroundText = 'SKYVIEW PUBLIC SCHOOL ';
                const repeats = 1000;
                const backgroundPattern = Array(repeats).fill(backgroundText).map(text => 
                    `<span>${text}</span>`
                ).join('');

                const admitCardHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
                        <style>
                            body {
                                margin: 0;
                                padding: 0;
                                font-family: 'Roboto Mono', monospace;
                                font-size: 90%;
                            }
                            .admit-card {
                                width: 20.5cm;
                                height: 29.7cm;
                                margin: 0;
                                padding: 0 2px;
                                box-sizing: border-box;
                                position: relative;
                                font-family: 'Roboto Mono', monospace;
                                z-index: 1;
                                background: rgba(255, 255, 255, 0.9);
                            }
                            .border-box {
                                position: absolute;
                                top: 5px;
                                left: 8px;
                                right: 15px;
                                height: 720px;
                                // height: calc(100% - 150px);
                                border: 1px solid #000;
                                pointer-events: none;
                                z-index: -1;
                            }
                            .header {
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-bottom: 12px;
                                text-align: center;
                                margin-top: 0;
                            }
                            .school-info {
                                text-align: center;
                            }
                            .school-name {
                                font-family: 'Playfair Display', serif;
                                font-size: 24px;
                                font-weight: 700;
                                color: navy;
                                margin: 0;
                                margin-bottom: 3px;
                                padding-top: 5px;
                                letter-spacing: 1px;
                                text-transform: uppercase;
                            }
                            .school-type {
                                font-family: 'Consolas', monospace;
                                font-size: 12px;
                                margin: 3px 0;
                            }
                            .exam-title {
                                font-size: 16px;
                                font-weight: bold;
                                margin: 3px 0;
                                font-family: 'Consolas', monospace;
                            }
                            .admit-label {
                                background: #000;
                                color: #fff;
                                padding: 3px 12px;
                                display: inline-block;
                                margin: 5px 0;
                                font-size: 14px;
                                font-family: 'Consolas', monospace;
                            }
                            .student-info {
                                margin: 12px 0;
                                line-height: 1.4;
                                font-size: 14px;
                                font-family: 'Consolas', monospace;
                            }
                            .student-info p {
                                margin: 5px 0;
                            }
                            .exam-schedule {
                                width: 100%;
                                border-collapse: collapse;
                                margin: 12px 0;
                                font-size: 13px;
                                font-family: 'Consolas', monospace;
                            }
                            .exam-schedule th, .exam-schedule td {
                                border: 1px solid #000;
                                padding: 5px;
                                text-align: center;
                                font-family: 'Consolas', monospace;
                            }
                            .exam-schedule th {
                                background-color: #f0f0f0;
                                font-weight: bold;
                            }
                            .signatures {
                                display: grid;
                                grid-template-columns: repeat(5, 1fr);
                                gap: 8px;
                                margin-top: 15px;
                                font-size: 12px;
                                font-family: 'Consolas', monospace;
                            }
                            .signature-box {
                                border: 1px solid #000;
                                padding: 5px;
                                text-align: center;
                                height: 60px;
                                font-family: 'Consolas', monospace;
                                position: relative;
                            }
                            .principal-signature {
                                position: absolute;
                                bottom: 25px;
                                left: 50%;
                                transform: translateX(-50%);
                                width: 80px;
                                height: auto;
                            }
                            .signature-label {
                                position: absolute;
                                bottom: 5px;
                                left: 0;
                                right: 0;
                                text-align: center;
                            }
                            .instructions {
                                margin-top: 12px;
                                font-size: 12px;
                                font-family: 'Consolas', monospace;
                                position: relative;
                                z-index: 1;
                                padding-bottom: 15px;
                            }
                            .instructions strong {
                                font-size: 13px;
                            }
                            .instructions ul {
                                margin: 3px 0;
                                padding-left: 20px;
                            }
                            .instructions li {
                                margin: 2px 0;
                            }
                            .instructions li:last-child {
                                border-bottom: none;
                                padding-bottom: 0;
                            }
                            .content-wrapper {
                                position: relative;
                                padding-bottom: 2px;
                            }
                            @media print {
                                body { 
                                    margin: 0;
                                    padding: 0;
                                    font-family: 'Consolas', monospace;
                                    size: portrait;
                                }
                                .admit-card {
                                    margin: 0;
                                    padding: 0 25px;
                                }
                                .border-box {
                                    height: calc(100% - 150px);
                                }
                                .instructions {
                                    border-bottom: 1px solid #000;
                                }
                            }

                            /* Background Watermark */
                            .background-text {
                                position: absolute;
                                top: 0%;
                                left: 10%;
                                width: 500%;
                                height: 500%;
                                display: flex;
                                flex-wrap: wrap;
                                opacity: 0.1;
                                overflow: hidden;
                                pointer-events: none;
                                z-index: 0;
                                transform: translate(-50%, -50%) rotate(-45deg);
                                transform-origin: center;
                                margin: 0 auto;
                                padding: 100%;
                            }

                            .background-text span {
                                font-size: 14px;
                                padding: 2px;
                                white-space: nowrap;
                                color: #000080;
                                line-height: 1;
                                text-align: center;
                            }
                        </style>
                    </head>
                    <body>
                        ${chunk.map(student => `
                            <div class="admit-card">
                                <div class="border-box"></div>
                                <div class="content-wrapper">
                                    <div class="background-text">
                                        ${backgroundPattern}
                                    </div>
                                    
                                    <div class="header">
                                        <div class="school-info">
                                            <h1 class="school-name">SKYVIEW PUBLIC SCHOOL</h1>
                                            <p class="school-type">An English Medium School based on CBSE Curriculum</p>
                                            <p class="exam-title">ANNUAL EXAMINATION- ${academicYear}</p>
                                            <div class="admit-label">ADMIT CARD</div>
                                        </div>
                                    </div>

                                    <div class="student-info">
                                        <p><strong>Student's Name:</strong> ${student.studentName || ''}</p>
                                        <p><strong>Father's / Guardian's Name:</strong> ${student.fatherName || ''}</p>
                                        <p><strong>Admission No.:</strong> ${student.admissionNo || ''}&nbsp;&nbsp;&nbsp;<strong>Class:</strong> ${student.class || ''}-${student.section || ''}&nbsp;&nbsp;&nbsp;<strong>Roll No.:</strong> ${student.rollNo || ''}</p>
                                    </div>

                                    <table class="exam-schedule">
                                        <tr>
                                            <th>Subject</th>
                                            <th>Examination Date</th>
                                            <th>Day</th>
                                            <th>Timing</th>
                                            <th>Teacher's Signature</th>
                                        </tr>
                                        ${getExamSchedule(student.class, student.section).map(exam => `
                                            <tr>
                                                <td>${exam.subject}</td>
                                                <td>${exam.date}</td>
                                                <td>${exam.day}</td>
                                                <td>${exam.timing}</td>
                                                <td></td>
                                            </tr>
                                        `).join('')}
                                    </table>

                                    <div class="signatures">
                                        <div class="signature-box">
                                            <span class="signature-label">Date of Issue</span>
                                        </div>
                                        <div class="signature-box">
                                            <span class="signature-label">Signature of Guardian</span>
                                        </div>
                                        <div class="signature-box">
                                            <span class="signature-label">Signature of Class Teacher</span>
                                        </div>
                                        <div class="signature-box">
                                            <span class="signature-label">Exam In-Charge</span>
                                        </div>
                                        <div class="signature-box">
                                            <img src="../assets/images/principal-signature.png" class="principal-signature" alt="Principal's Signature">
                                            <span class="signature-label">Principal</span>
                                        </div>
                                    </div>

                                    <div class="instructions">
                                        <strong>INSTRUCTIONS:</strong>
                                        <ul>
                                            <li>Students must bring the Admit Card. Students will not be allowed to enter the examination hall without admit card.</li>
                                            <li>Students must bring exam board, pencil, eraser, sharpener and colour box according to the examination schedule.</li>
                                            <li>Students must bring their lunch and water bottle.</li>
                                        </ul>
                                    </div>
                                </div>
                                
                                <div class="notes" style="margin-top: 10px; font-size: 10px; display: none;">
                                    <p style="margin: 2px 0;">N.B :</p>
                                    <p style="margin: 2px 0;">1. The School will be dissolved at 01:00 pm.</p>
                                    <p style="margin: 2px 0;">2. Pre Holi Celebration is on 12-03-2025 at 1:00 pm</p>
                                </div>
                            </div>
                            ${i < studentChunks.length - 1 ? '<div style="page-break-after: none;"></div>' : ''}
                        `).join('')}
                    </body>
                    </html>
                `;

                const container = document.createElement('div');
                container.innerHTML = admitCardHTML;

                // Generate PDF for this chunk
                const opt = {
                    margin: [0, 0, 0, 0],
                    filename: `admit_cards_class_${className}_part${i + 1}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2,
                        useCORS: true,
                        logging: true,
                        allowTaint: true,
                        backgroundColor: null
                    },
                    jsPDF: { 
                        unit: 'mm', 
                        format: 'a4',
                        orientation: 'portrait'
                    }
                };

                // Generate and save this chunk
                await html2pdf().set(opt).from(container).save();
                
                // Wait a bit before processing next chunk
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            console.error('Error generating class admit cards:', error);
            throw error;
        }
    }

    static async generateAdmitCard(student, academicYear = '2023-2024') {
        try {
            // Create background text pattern
            const backgroundText = 'SKYVIEW PUBLIC SCHOOL ';
            const repeats = 1000;
            const backgroundPattern = Array(repeats).fill(backgroundText).map(text => 
                `<span>${text}</span>`
            ).join('');

            const admitCardHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: 'Roboto Mono', monospace;
                        }
                        .admit-card {
                            width: 20.5cm;
                            height: 29.7cm;
                            margin: 0;
                            padding: 0 2px;
                            box-sizing: border-box;
                            font-family: Arial, sans-serif;
                        }
                        .header {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-bottom: 20px;
                            text-align: center;
                        }
                        .school-info {
                            text-align: center;
                        }
                        .school-name {
                            font-size: 24px;
                            font-weight: bold;
                            color: navy;
                            margin: 0;
                        }
                        .school-type {
                            font-size: 14px;
                            margin: 5px 0;
                        }
                        .exam-title {
                            font-size: 16px;
                            font-weight: bold;
                            margin: 5px 0;
                        }
                        .admit-label {
                            background: #000;
                            color: #fff;
                            padding: 5px 15px;
                            display: inline-block;
                            margin: 10px 0;
                        }
                        .student-info {
                            margin: 15px 0;
                            line-height: 1.6;
                        }
                        .exam-schedule {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 15px 0;
                        }
                        .exam-schedule th, .exam-schedule td {
                            border: 1px solid #000;
                            padding: 8px;
                            text-align: center;
                        }
                        .exam-schedule th {
                            background-color: #f0f0f0;
                        }
                        .signatures {
                            display: grid;
                            grid-template-columns: repeat(5, 1fr);
                            gap: 10px;
                            margin-top: 20px;
                        }
                        .signature-box {
                            border: 1px solid #000;
                            padding: 10px;
                            text-align: center;
                            font-size: 12px;
                            height: 50px;
                        }
                        .instructions {
                            margin-top: 15px;
                            font-size: 12px;
                        }
                        .instructions ul {
                            margin: 0;
                            padding-left: 20px;
                        }
                        @media print {
                            body { margin: 0; }
                            .admit-card {
                                border: none;
                                margin: 0;
                                padding: 0 25px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="admit-card">
                        <div class="background-text">
                            ${backgroundPattern}
                        </div>
                        
                        <div class="header">
                            <div class="school-info">
                                <h1 class="school-name">SKYVIEW PUBLIC SCHOOL</h1>
                                <p class="school-type">An English Medium School based on CBSE Curriculum</p>
                                <p class="exam-title">ANNUAL EXAMINATION- ${academicYear}</p>
                                <div class="admit-label">ADMIT CARD</div>
                            </div>
                        </div>

                        <div class="student-info">
                            <p><strong>Student's Name:</strong> ${student.studentName || ''}</p>
                            <p><strong>Father's / Guardian's Name:</strong> ${student.fatherName || ''}</p>
                            <p><strong>Admission No.:</strong> ${student.admissionNo || ''}&nbsp;&nbsp;&nbsp;<strong>Class:</strong> ${student.class || ''}-${student.section || ''}&nbsp;&nbsp;&nbsp;<strong>Roll No.:</strong> ${student.rollNo || ''}</p>
                        </div>

                        <table class="exam-schedule">
                            <tr>
                                <th>Subject</th>
                                <th>Examination Date</th>
                                <th>Day</th>
                                <th>Timing</th>
                                <th>Teacher's Signature</th>
                            </tr>
                            ${getExamSchedule(student.class, student.section).map(exam => `
                                <tr>
                                    <td>${exam.subject}</td>
                                    <td>${exam.date}</td>
                                    <td>${exam.day}</td>
                                    <td>${exam.timing}</td>
                                    <td></td>
                                </tr>
                            `).join('')}
                        </table>

                        <div class="signatures">
                            <div class="signature-box">Date of Issue</div>
                            <div class="signature-box">Signature of Guardian</div>
                            <div class="signature-box">Signature of Class Teacher</div>
                            <div class="signature-box">Exam In-Charge</div>
                            <div class="signature-box">Principal</div>
                        </div>

                        <div class="instructions">
                            <strong>INSTRUCTIONS:</strong>
                            <ul>
                                <li>Students must bring the Admit Card. Students will not be allowed to enter the examination hall without admit card.</li>
                                <li>Students must bring exam board, pencil, eraser, sharpener and colour box according to the examination schedule.</li>
                                <li>Students must bring their lunch and water bottle.</li>
                            </ul>
                        </div>

                        <div class="notes" style="margin-top: 10px; font-size: 10px; display: none;">
                            <p style="margin: 2px 0;">N.B :</p>
                            <p style="margin: 2px 0;">1. The School will be dissolved at 01:00 pm.</p>
                            <p style="margin: 2px 0;">2. Pre Holi Celebration is on 12-03-2025 at 1:00 pm</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // Create a temporary container
            const container = document.createElement('div');
            container.innerHTML = admitCardHTML;

            // Configure PDF options
            const opt = {
                margin: [0, 0, 0, 0],
                filename: `admit_card_${student.admissionNo}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2,
                    useCORS: true,
                    logging: true
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: [210, 148.5], // A5 size
                    orientation: 'landscape'
                }
            };

            // Generate PDF
            await html2pdf().set(opt).from(container).save();

        } catch (error) {
            console.error('Error generating admit card:', error);
            alert('Error generating admit card. Please try again.');
        }
    }
}

// Initialize DataTable
let studentsTable = null;

function initializeDataTable(data) {
    console.log('Initializing DataTable with data:', data);

    if (studentsTable) {
        studentsTable.destroy();
    }

    studentsTable = $('#studentsTable').DataTable({
        data: data,
        columns: [
            { data: 'admissionNo' },
            { data: 'studentName' },
            { data: 'fatherName' },
            { data: 'class' },
            { data: 'section' },
            { data: 'rollNo' },
            {
                data: null,
                defaultContent: '<button class="btn btn-primary btn-sm generate-admit-card">Generate PDF</button>',
                orderable: false,
                searchable: false
            }
        ],
        responsive: true
    });

    // Remove any existing click handlers
    $('#studentsTable').off('click', '.generate-admit-card');
    
    // Add click handler for generate button
    $('#studentsTable').on('click', '.generate-admit-card', function() {
        const button = this;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Generating...';

        const rowData = studentsTable.row($(this).closest('tr')).data();
        if (rowData) {
            PDFGenerator.generateAdmitCard(rowData)
                .finally(() => {
                    button.disabled = false;
                    button.textContent = originalText;
                });
        }
    });
} 
