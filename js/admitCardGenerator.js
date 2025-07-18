class AdmitCardGenerator {
    constructor() {
        this.studentsData = [];
        this.dataTable = null;
        this.academicYear = '2024-2025'; // Default value
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeDataTable();
        this.initializeAcademicYear();
    }

    setupEventListeners() {
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', this.handleFileUpload.bind(this));
        }
    }

    initializeDataTable() {
        this.dataTable = $('#studentsTable').DataTable({
            pageLength: 10,
            ordering: true,
            searching: true
        });
    }

    initializeAcademicYear() {
        const yearSelect = document.getElementById('academicYear');
        if (yearSelect) {
            // Set initial value
            this.academicYear = yearSelect.value;
            
            // Add change listener
            yearSelect.addEventListener('change', (e) => {
                this.academicYear = e.target.value;
            });
        }
    }

    async handleFileUpload(e) {
        e.preventDefault();
        const fileInput = document.getElementById('excelFile');
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a file');
            return;
        }

        try {
            this.studentsData = await ExcelProcessor.processExcelFile(file);
            this.updateTable();
            this.generateClassButtons();
        } catch (error) {
            console.error('File Upload Error:', error);
            alert('Error processing file: ' + error);
        }
    }

    updateTable() {
        if (!this.dataTable) {
            console.error('DataTable not initialized');
            return;
        }

        this.dataTable.clear();
        this.dataTable.rows.add(this.studentsData.map(student => [
            student.admissionNo,
            student.studentName,
            student.fatherName,
            student.class,
            student.section,
            student.rollNo
        ]));
        this.dataTable.draw();
    }

    generateClassButtons() {
        // Get unique combinations of class and section
        const classAndSections = [...new Set(this.studentsData.map(student => {
            const className = student.class.toUpperCase().trim();
            return `${className}-${student.section}`;
        }))].sort();

        const buttonContainer = document.getElementById('classButtons');
        if (!buttonContainer) return;

        buttonContainer.innerHTML = `
            <div class="mb-3">
                <button class="btn btn-primary me-2 mb-2" onclick="admitCardGenerator.generateAllAdmitCards()">
                    Generate All Admit Cards
                </button>
            </div>
            <div class="class-section-buttons">
                ${classAndSections.map(classSection => {
                    const [className, section] = classSection.split('-');
                    return `
                        <button class="btn btn-secondary me-2 mb-2" 
                                data-class="${className}" 
                                data-section="${section}">
                            Class ${className}-${section}
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        // Add click handlers for class-section buttons
        buttonContainer.querySelectorAll('.class-section-buttons button').forEach(button => {
            button.onclick = async (event) => {
                try {
                    const academicYear = document.getElementById('academicYear');
                    const academicYearValue = academicYear.value;
                    
                    if (!academicYearValue || academicYearValue === 'Please Select Academic Year') {
                        alert('Please select an academic year before generating admit cards');
                        return;
                    }

                    const btn = event.target;
                    const originalText = btn.textContent;
                    const className = btn.dataset.class;
                    const section = btn.dataset.section;
                    
                    console.log('Generating for:', className, section, 'Academic Year:', academicYearValue);
                    
                    const classStudents = this.studentsData.filter(student => 
                        student.class.toUpperCase().trim() === className &&
                        student.section === section
                    );

                    if (classStudents.length === 0) {
                        alert('No students found in this class section');
                        return;
                    }

                    btn.disabled = true;
                    btn.textContent = 'Generating...';

                    await PDFGenerator.generateClassAdmitCards(
                        classStudents, 
                        `${className}-${section}`,
                        academicYearValue
                    );
                    
                    btn.disabled = false;
                    btn.textContent = originalText;
                } catch (error) {
                    console.error('Error generating class admit cards:', error);
                    alert('Error generating admit cards. Please try again.');
                    
                    const btn = event.target;
                    btn.disabled = false;
                    btn.textContent = `Class ${btn.dataset.class}-${btn.dataset.section}`;
                }
            };
        });
    }

    // Add method to generate all admit cards
    async generateAllAdmitCards() {
        try {
            const academicYear = document.getElementById('academicYear');
            const academicYearValue = academicYear.value;
            
            if (!academicYearValue || academicYearValue === 'Please Select Academic Year') {
                alert('Please select an academic year before generating admit cards');
                return;
            }

            const button = document.querySelector('#classButtons button');
            const originalText = button.textContent;
            
            if (this.studentsData.length === 0) {
                alert('No students data available');
                return;
            }

            button.disabled = true;
            button.textContent = 'Generating All...';

            await PDFGenerator.generateClassAdmitCards(
                this.studentsData, 
                'all',
                academicYearValue
            );
            
            button.disabled = false;
            button.textContent = originalText;
        } catch (error) {
            console.error('Error generating all admit cards:', error);
            alert('Error generating admit cards. Please try again.');
            
            const button = document.querySelector('#classButtons button');
            button.disabled = false;
            button.textContent = 'Generate All Admit Cards';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new AdmitCardGenerator();
    } catch (error) {
        console.error('Initialization Error:', error);
        alert('Error initializing application: ' + error.message);
    }
}); 
