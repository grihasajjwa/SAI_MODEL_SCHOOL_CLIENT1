// Global variables
let dataTable;
const currentAcademicYear = '2024-2025';

// Add caching mechanism
const classCache = new Map();
const marksCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    await Navbar.loadNavbar();
    loadClasses();
});

// Make functions globally accessible
window.showStudents = showStudents;
window.generateRanks = generateRanks;

// Function to load classes with optimized performance
async function loadClasses() {
    try {
        document.body.classList.add('loading');
        const container = document.getElementById('classCardsContainer');
        
        // Check cache first
        const cachedClasses = classCache.get('all-classes');
        if (cachedClasses && (Date.now() - cachedClasses.timestamp < CACHE_EXPIRY)) {
            renderClassCards(cachedClasses.data);
            document.body.classList.remove('loading');
            return;
        }

        const response = await fetch(`${CONFIG.API_URL}/classes`, {
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch classes');
        }

        const classes = await response.json();
        
        // Get sections and student counts for each class
        const classData = {};
        const classPromises = classes.map(async (cls) => {
            try {
                // Fetch sections for this class
                const sectionsResponse = await fetch(`${CONFIG.API_URL}/sections/${cls.className}`, {
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                });
                
                if (!sectionsResponse.ok) {
                    throw new Error(`Failed to fetch sections for class ${cls.className}`);
                }
                
                const sections = await sectionsResponse.json();
                let totalStudents = 0;

                // Fetch students for each section in parallel
                const sectionData = await Promise.all(sections.map(async (section) => {
                    try {
                        const cacheKey = `${cls.className}-${section}`;
                        const cachedStudents = classCache.get(cacheKey);
                        
                        if (cachedStudents && (Date.now() - cachedStudents.timestamp < CACHE_EXPIRY)) {
                            totalStudents += cachedStudents.data.length;
                            return { section, count: cachedStudents.data.length };
                        }

                        const studentsResponse = await fetch(
                            `${CONFIG.API_URL}/students/class/${cls.className}/${section}`, {
                            headers: {
                                'Authorization': `Bearer ${Auth.getToken()}`
                            }
                        });
                        
                        if (studentsResponse.ok) {
                            const students = await studentsResponse.json();
                            const count = Array.isArray(students) ? students.length : 0;
                            totalStudents += count;
                            
                            // Cache the students data
                            classCache.set(cacheKey, {
                                data: students,
                                timestamp: Date.now()
                            });
                            
                            return { section, count };
                        }
                        return { section, count: 0 };
                    } catch (error) {
                        console.warn(`Error fetching students for ${cls.className}-${section}:`, error);
                        return { section, count: 0 };
                    }
                }));

                classData[cls.className] = {
                    sections: sectionData,
                    totalStudents
                };
            } catch (error) {
                console.warn(`Error processing class ${cls.className}:`, error);
                classData[cls.className] = {
                    sections: [],
                    totalStudents: 0
                };
            }
        });

        await Promise.all(classPromises);
        
        // Cache the results
        classCache.set('all-classes', {
            data: classData,
            timestamp: Date.now()
        });

        renderClassCards(classData);
        document.body.classList.remove('loading');
    } catch (error) {
        console.error('Error loading classes:', error);
        const container = document.getElementById('classCardsContainer');
        container.innerHTML = '<div class="alert alert-danger">Error loading classes. Please try again.</div>';
        document.body.classList.remove('loading');
    }
}

// Render class cards with optimized DOM operations
function renderClassCards(classData) {
    const container = document.getElementById('classCardsContainer');
    const fragment = document.createDocumentFragment();

    Object.entries(classData)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([className, data]) => {
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            card.innerHTML = `
                <div class="card class-card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="card-title mb-0">Class ${className}</h5>
                    </div>
                    <div class="card-body">
                        <p class="card-text">Total Students: ${data.totalStudents}</p>
                        <div class="mt-3">
                            ${data.sections.map(section => `
                                <button class="btn btn-outline-primary me-2 mb-2" 
                                        onclick="window.location.href='class-marksheet.html?class=${className}&section=${section.section}'">
                                    Section ${section.section}
                                    <span class="badge bg-primary ms-1">${section.count}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });

    container.innerHTML = '';
    container.appendChild(fragment);
}

// Function to show students with optimized loading
async function showStudents(className, section) {
    try {
        document.body.classList.add('loading');
        console.group(`Loading students for Class ${className} Section ${section}`);
        
        // Hide class cards and show student list
        document.querySelector('.class-cards').style.display = 'none';
        document.querySelector('.student-list').style.display = 'block';
        document.querySelector('.back-to-classes').style.display = 'block';

        // Update header
        document.getElementById('selectedClassHeader').textContent = `Class ${className} Section ${section} - Students`;

        // Check cache for students
        const cacheKey = `${className}-${section}`;
        const cachedStudents = classCache.get(cacheKey);
        let students;
        
        if (cachedStudents && (Date.now() - cachedStudents.timestamp < CACHE_EXPIRY)) {
            students = cachedStudents.data;
        } else {
            const response = await fetch(`${CONFIG.API_URL}/students/class/${className}/${section}`, {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch students');
            }

            students = await response.json();
            classCache.set(cacheKey, {
                data: students,
                timestamp: Date.now()
            });
        }
        
        // Load marks for each student in parallel
        const studentsWithMarks = await Promise.all(students.map(async student => {
            try {
                // Check marks cache
                const marksCacheKey = `marks-${student.studentId}`;
                const cachedMarks = marksCache.get(marksCacheKey);
                
                if (cachedMarks && (Date.now() - cachedMarks.timestamp < CACHE_EXPIRY)) {
                    return { ...student, marks: cachedMarks.data };
                }

                const marksResponse = await fetch(`${CONFIG.API_URL}/marks/${student.studentId}`, {
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                });
                
                if (marksResponse.ok) {
                    const marksData = await marksResponse.json();
                    marksCache.set(marksCacheKey, {
                        data: marksData.marks,
                        timestamp: Date.now()
                    });
                    return { ...student, marks: marksData.marks };
                }
                return student;
            } catch (error) {
                console.error(`Error fetching marks for student ${student.studentId}:`, error);
                return student;
            }
        }));

        // Initialize or update DataTable
        if (dataTable) {
            dataTable.destroy();
        }

        // Initialize DataTable with performance optimizations
        dataTable = $('#studentTable').DataTable({
            processing: true,
            order: [[8, 'asc']], // Sort by rank by default
            deferRender: true,
            pageLength: 25,
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                 '<"row"<"col-sm-12"tr>>' +
                 '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
            language: {
                processing: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>'
            },
            columns: [
                { data: 'studentId' },
                { data: 'name' },
                { data: 'fatherName' },
                { 
                    data: 'marks',
                    render: function(data) {
                        if (!data || !data.length) return '-';
                        let total = 0, maxTotal = 0;
                        data.forEach(subject => {
                            if (subject.pt1) {
                                total += (subject.pt1.written || 0) + (subject.pt1.oral || 0);
                                maxTotal += 100;
                            }
                        });
                        return maxTotal > 0 ? (total / maxTotal * 100).toFixed(2) + '%' : '-';
                    }
                },
                { 
                    data: 'marks',
                    render: function(data) {
                        if (!data || !data.length) return '-';
                        let total = 0, maxTotal = 0;
                        data.forEach(subject => {
                            if (subject.hy) {
                                total += (subject.hy.written || 0) + (subject.hy.oral || 0);
                                maxTotal += 100;
                            }
                        });
                        return maxTotal > 0 ? (total / maxTotal * 100).toFixed(2) + '%' : '-';
                    }
                },
                { 
                    data: 'marks',
                    render: function(data) {
                        if (!data || !data.length) return '-';
                        let total = 0, maxTotal = 0;
                        data.forEach(subject => {
                            if (subject.pt2) {
                                total += (subject.pt2.written || 0) + (subject.pt2.oral || 0);
                                maxTotal += 100;
                            }
                        });
                        return maxTotal > 0 ? (total / maxTotal * 100).toFixed(2) + '%' : '-';
                    }
                },
                { 
                    data: 'marks',
                    render: function(data) {
                        if (!data || !data.length) return '-';
                        let total = 0, maxTotal = 0;
                        data.forEach(subject => {
                            if (subject.final) {
                                total += (subject.final.written || 0) + (subject.final.oral || 0);
                                maxTotal += 100;
                            }
                        });
                        return maxTotal > 0 ? (total / maxTotal * 100).toFixed(2) + '%' : '-';
                    }
                },
                { 
                    data: 'marks',
                    render: function(data) {
                        if (!data || !data.length) return '-';
                        const examTypes = ['pt1', 'hy', 'pt2', 'final'];
                        const percentages = [];

                        examTypes.forEach(examType => {
                            let total = 0, maxTotal = 0;
                            data.forEach(subject => {
                                if (subject[examType]) {
                                    total += (subject[examType].written || 0) + (subject[examType].oral || 0);
                                    maxTotal += 100;
                                }
                            });
                            if (maxTotal > 0) {
                                percentages.push((total / maxTotal) * 100);
                            }
                        });

                        return percentages.length > 0 
                            ? (percentages.reduce((a, b) => a + b) / percentages.length).toFixed(2) + '%' 
                            : '-';
                    }
                },
                { 
                    data: 'rank',
                    render: function(data) {
                        if (!data) return '-';
                        const suffix = getSuffix(data);
                        return `${data}${suffix}`;
                    }
                },
                {
                    data: null,
                    render: function(data) {
                        const params = new URLSearchParams({
                            studentId: data._id,
                            className: className,
                            section: section,
                            studentName: data.name,
                            admissionNo: data.studentId,
                            fatherName: data.fatherName,
                            gender: data.gender,
                            contactNo: data.contactNo,
                            rank: data.rank || ''
                        });

                        if (data.dob) {
                            try {
                                const dobDate = new Date(data.dob);
                                if (!isNaN(dobDate.getTime())) {
                                    const day = dobDate.getDate().toString().padStart(2, '0');
                                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    const month = months[dobDate.getMonth()];
                                    const year = dobDate.getFullYear();
                                    params.set('dob', `${day}-${month}-${year}`);
                                }
                            } catch (error) {
                                console.error('Error formatting DOB:', error);
                            }
                        }

                        return `
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-primary me-1" onclick="window.location.href='marksheet-template.html?${params.toString()}'">
                                    <i class="fas fa-edit"></i> Marks
                                </button>
                                <button class="btn btn-sm btn-success" onclick="window.open('marksheet-template.html?${params.toString()}&print=true', '_blank')">
                                    <i class="fas fa-print"></i> Print
                                </button>
                            </div>
                        `;
                    }
                }
            ]
        });
        
        // Update table with student data
        dataTable.clear().rows.add(studentsWithMarks).draw();
        document.body.classList.remove('loading');
        console.groupEnd();

    } catch (error) {
        console.error('Error loading students:', error);
        console.groupEnd();
        document.body.classList.remove('loading');
        alert('Error loading students. Please try again.');
    }
}

// Function to generate and update ranks
async function generateRanks() {
    try {
        document.body.classList.add('loading');
        const students = dataTable.data().toArray();
        
        if (!students || students.length === 0) {
            alert('No students found to rank!');
            document.body.classList.remove('loading');
            return;
        }

        // Get current class and section from header
        const headerText = document.getElementById('selectedClassHeader').textContent;
        const match = headerText.match(/Class (\w+) Section (\w+)/);
        if (!match) {
            alert('Error: Could not determine current class and section');
            document.body.classList.remove('loading');
            return;
        }

        const [, className, section] = match;
        console.group('Rank Generation Process');

        // Calculate overall percentages and sort
        const studentsWithRanks = students.map(student => {
            let overallPercentage = 0;
            let validPercentages = [];

            if (student.marks && student.marks.length > 0) {
                ['pt1', 'hy', 'pt2', 'final'].forEach(examType => {
                    let total = 0, maxTotal = 0;
                    student.marks.forEach(subject => {
                        if (subject[examType]) {
                            total += (subject[examType].written || 0) + (subject[examType].oral || 0);
                            maxTotal += 100;
                        }
                    });
                    if (maxTotal > 0) {
                        validPercentages.push((total / maxTotal) * 100);
                    }
                });

                if (validPercentages.length > 0) {
                    overallPercentage = validPercentages.reduce((a, b) => a + b) / validPercentages.length;
                }
            }

            return { ...student, overallPercentage };
        }).sort((a, b) => b.overallPercentage - a.overallPercentage);

        // Assign ranks with ties handling
        let currentRank = 1;
        let currentPercentage = -1;
        let sameRankCount = 0;

        studentsWithRanks.forEach((student, index) => {
            if (student.overallPercentage === 0) {
                student.sectionRank = null;
            } else if (student.overallPercentage === currentPercentage) {
                student.sectionRank = currentRank;
                sameRankCount++;
            } else {
                currentRank = index + 1;
                student.sectionRank = currentRank;
                currentPercentage = student.overallPercentage;
                sameRankCount = 0;
            }
        });

        // Update ranks in parallel
        await Promise.all(studentsWithRanks.map(async (student) => {
            if (student._id && student.sectionRank) {
                try {
                    const response = await fetch(`${CONFIG.API_URL}/students/${student._id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${Auth.getToken()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ rank: student.sectionRank })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Failed to update rank for student ${student._id}`);
                    }
                } catch (error) {
                    console.error(`Error updating rank for student ${student._id}:`, error);
                }
            }
        }));

        // Refresh student data
        const response = await fetch(`${CONFIG.API_URL}/students/class/${className}/${section}`, {
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch updated student data');
        }

        const updatedStudents = await response.json();
        dataTable.clear().rows.add(updatedStudents).draw();
        
        console.groupEnd();
        document.body.classList.remove('loading');
        alert('Ranks generated and updated successfully!');

    } catch (error) {
        console.error('Error generating ranks:', error);
        console.groupEnd();
        document.body.classList.remove('loading');
        alert('Error generating ranks. Please try again.');
    }
}

// Helper function to get rank suffix
function getSuffix(rank) {
    if (!rank) return '';
    if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
    switch (rank % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Handle back button click
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.back-to-classes').addEventListener('click', () => {
        document.querySelector('.class-cards').style.display = 'block';
        document.querySelector('.student-list').style.display = 'none';
        document.querySelector('.back-to-classes').style.display = 'none';
    });
});