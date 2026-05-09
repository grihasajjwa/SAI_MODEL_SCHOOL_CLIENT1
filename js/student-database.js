// Wait for the DOM to be fully loaded
function formattedDate(dateString) {
  if (!dateString) return dateString;
  
  // Handle Excel serial number format
  if (!isNaN(dateString) && dateString > 25569) {
    const date = new Date((dateString - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
  } else {
    // Try to parse it as a date string (handles dd-mm-yyyy, mm-dd-yyyy, etc.)
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toISOString().split('T')[0]; // Convert to "YYYY-MM-DD" for database
  }
}

// Function to collect fees for a student
function collectFees(studentId) {
    const feeCollectionUrl = `../pages/fee-collection.html?admissionNo=${studentId}`;
    window.open(feeCollectionUrl, '_blank');
}

function formatCurrency(amount) {
    const normalized = Number(amount || 0);
    return `Rs ${normalized.toLocaleString('en-IN', {
        minimumFractionDigits: normalized % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    })}`;
}

function formatDisplayDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function getApiOrigin() {
    try {
        return new URL(CONFIG.API_URL).origin;
    } catch (error) {
        return window.location.origin;
    }
}

function resolveStudentPhoto(photo) {
    if (!photo) return '../assets/images/logo.png';
    if (/^https?:\/\//i.test(photo)) return photo;
    return `${getApiOrigin()}${photo}`;
}

function openTransportPage(busNumber = '', route = '') {
    const selectedSession = document.getElementById('studentSessionFilter')?.value || document.getElementById('session')?.value || '';
    const params = new URLSearchParams();
    if (selectedSession) params.set('session', selectedSession);
    if (busNumber) params.set('bus', busNumber);
    if (route) params.set('route', route);
    window.location.href = `../pages/transport-usage.html?${params.toString()}`;
}

async function saveClassFromStudentDatabase() {
    try {
        const classId = document.getElementById('classId')?.value || '';
        const academicYear = document.getElementById('classAcademicYear')?.value.trim();
        const className = document.getElementById('classNameInput')?.value.trim();
        const section = document.getElementById('classSectionInput')?.value.trim() || 'A';
        const classTeacher = document.getElementById('classTeacherInput')?.value.trim();

        if (!academicYear || !className || !classTeacher) {
            alert('Please fill in all required class fields');
            return;
        }

        const response = await fetch(
            classId ? `${CONFIG.API_URL}/classes/${classId}` : `${CONFIG.API_URL}/classes`,
            {
                method: classId ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    academicYear,
                    className,
                    section,
                    classTeacher
                })
            }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || 'Failed to save class');
        }

        const activeSessionField = document.getElementById('session');
        if (activeSessionField && !activeSessionField.value) {
            activeSessionField.value = academicYear;
        }

        alert(classId ? 'Class updated successfully' : 'Class added successfully');
        const modalElement = document.getElementById('addClassModal');
        const modal = bootstrap.Modal.getInstance(modalElement) || bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.hide();
        resetClassForm();
        await loadClassOptions();
    } catch (error) {
        console.error('Save class error:', error);
        alert(`Failed to save class: ${error.message}`);
    }
}

function resetClassForm() {
    document.getElementById('classForm')?.reset();
    const classId = document.getElementById('classId');
    if (classId) classId.value = '';
    const academicYearInput = document.getElementById('classAcademicYear');
    const currentSession = document.getElementById('session')?.value
        || document.getElementById('studentSessionFilter')?.value
        || '';
    if (academicYearInput) {
        academicYearInput.value = currentSession;
    }
}

// Load available classes
let classes = [];

// Define the class sequence
const classSequence = ['PRE', 'L.K.G', 'U.K.G', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Function to get class index from the sequence
function getClassIndex(className) {
    return classSequence.indexOf(className);
}

// Function to load all classes from API
async function loadClassOptions() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/classes`, {
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch classes');
        }

        const classData = await response.json();
        console.log('Classes data from API:', classData);

        const uniqueClasses = [...new Set(classData.map(cls => cls.className))];
        console.log('Unique classes:', uniqueClasses);

        classes = uniqueClasses.sort((a, b) => a.localeCompare(b));
        console.log('Sorted classes:', classes);

        const classSelect = document.querySelector('#class');
        const currentClassValue = classSelect?.value || '';
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Select Class</option>';
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = cls;
                classSelect.appendChild(option);
            });
            if (currentClassValue && classes.includes(currentClassValue)) {
                classSelect.value = currentClassValue;
            }
            console.log('Class dropdown populated with', classes.length, 'options');
        } else {
            console.error('Class dropdown not found');
        }

        const bulkFromClass = document.getElementById('bulkFromClass');
        const bulkToClass = document.getElementById('bulkToClass');
        if (bulkFromClass && bulkToClass) {
            const currentBulkFromValue = bulkFromClass.value;
            const currentBulkToValue = bulkToClass.value;
            bulkFromClass.innerHTML = '<option value="">Select Class</option>';
            bulkToClass.innerHTML = '<option value="">Select Class</option>';
            classes.forEach(cls => {
                bulkFromClass.appendChild(new Option(cls, cls));
                bulkToClass.appendChild(new Option(cls, cls));
            });
            if (currentBulkFromValue && classes.includes(currentBulkFromValue)) {
                bulkFromClass.value = currentBulkFromValue;
            }
            if (currentBulkToValue && classes.includes(currentBulkToValue)) {
                bulkToClass.value = currentBulkToValue;
            }
        }
    } catch (error) {
        console.error('Error loading classes:', error);
        alert('Error loading classes. Please try again.');
    }
}

async function viewStudentDetails(admissionNo, session = '') {
    try {
        const [studentResponse, feeResponse] = await Promise.all([
            fetch(`${CONFIG.API_URL}/student/${encodeURIComponent(admissionNo)}?session=${encodeURIComponent(session)}`, {
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
            }),
            fetch(`${CONFIG.API_URL}/fees/student/${encodeURIComponent(admissionNo)}?session=${encodeURIComponent(session)}`, {
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
            })
        ]);

        const studentPayload = await studentResponse.json();
        if (!studentResponse.ok || !studentPayload.success) {
            throw new Error(studentPayload.message || 'Failed to fetch student details');
        }

        const student = studentPayload.student;
        const feePayload = feeResponse.ok ? await feeResponse.json() : { summary: null };
        const feeSummary = feePayload?.summary || {};

        document.getElementById('detailStudentName').textContent = student.name || '-';
        document.getElementById('detailStudentId').textContent = student.studentId || '-';
        document.getElementById('detailClassSection').textContent = `${student.class || '-'} / ${student.section || '-'}`;
        document.getElementById('detailSession').textContent = student.session || '-';
        document.getElementById('detailFatherName').textContent = student.fatherName || '-';
        document.getElementById('detailMotherName').textContent = student.motherName || '-';
        document.getElementById('detailGender').textContent = student.gender || '-';
        document.getElementById('detailDob').textContent = formatDisplayDate(student.dob);
        document.getElementById('detailAdmissionDate').textContent = formatDisplayDate(student.admissionDate);
        document.getElementById('detailContactNo').textContent = student.contactNo || '-';
        document.getElementById('detailRollNo').textContent = student.rollNo || '-';
        document.getElementById('detailAddress').textContent = student.address || '-';
        document.getElementById('detailTuitionFee').textContent = formatCurrency(student.tuitionFee || 0);
        document.getElementById('detailTransportFee').textContent = formatCurrency(student.transport?.fees || 0);
        document.getElementById('detailOutstandingDue').textContent = formatCurrency(feeSummary.totalOutstanding || 0);
        document.getElementById('detailTransportRequired').textContent = student.transport?.required ? 'Yes' : 'No';
        document.getElementById('detailTransportRoute').textContent = student.transport?.required
            ? [student.transport.busNumber || '-', student.transport.route || '-'].join(' / ')
            : '-';
        document.getElementById('detailPickupPoint').textContent = student.transport?.pickupPoint || '-';
        document.getElementById('detailPickupOrder').textContent = student.transport?.pickupOrder || '-';
        document.getElementById('detailTotalPaid').textContent = formatCurrency(feeSummary.totalPaid || 0);
        document.getElementById('detailTotalCharges').textContent = formatCurrency(feeSummary.totalCharges || 0);
        document.getElementById('detailPreviousDue').textContent = formatCurrency(feeSummary.previousDueAmount || 0);
        document.getElementById('detailLastReceipt').textContent = feeSummary.lastReceiptDate ? formatDisplayDate(feeSummary.lastReceiptDate) : '-';

        const photoElement = document.getElementById('detailStudentPhoto');
        photoElement.src = resolveStudentPhoto(student.photo);
        photoElement.onerror = () => {
            photoElement.src = '../assets/images/logo.png';
        };

        const collectButton = document.getElementById('detailCollectFeesBtn');
        collectButton.onclick = () => collectFees(student.studentId);

        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('studentDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Student detail error:', error);
        alert(`Failed to load student details: ${error.message}`);
    }
}

window.viewStudentDetails = viewStudentDetails;
window.openTransportPage = openTransportPage;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!Auth.isAuthenticated()) {
            Auth.redirectToLogin();
            return;
        }

        // Handle show/hide actions checkbox
        const showActionsCheckbox = document.getElementById('showActions');
        showActionsCheckbox.addEventListener('change', updateButtonVisibility);
        
        // Initial button visibility setup
        updateButtonVisibility();
                 
        // Sync admission number with student ID
        const admissionNoInput = document.getElementById('admissionNo');
        const studentIdInput = document.getElementById('studentId');
        
        admissionNoInput.addEventListener('input', function() {
            studentIdInput.value = this.value;
        });

        document.getElementById('updateBtn').style.display = 'none';
        document.getElementById('cancelBtn').style.display = 'none';

        // Initialize promotion modal
        const promotionModal = new bootstrap.Modal(document.getElementById('promotionModal'));
        
        // Initialize session management modal
        const sessionModal = new bootstrap.Modal(document.getElementById('sessionModal'));
        const addClassModal = new bootstrap.Modal(document.getElementById('addClassModal'));
        const bulkPromotionModal = new bootstrap.Modal(document.getElementById('bulkPromotionModal'));

        document.getElementById('saveClassBtn')?.addEventListener('click', saveClassFromStudentDatabase);
        document.getElementById('addClassModal')?.addEventListener('show.bs.modal', resetClassForm);
        document.getElementById('addClassModal')?.addEventListener('hidden.bs.modal', resetClassForm);

        // Initialize transport facility toggle
        document.getElementById('transportFacility').addEventListener('change', (e) => {
            const transportDetails = document.querySelector('.transport-details');
            transportDetails.classList.toggle('d-none', e.target.value === 'no');
        });

        document.getElementById('transportUsageCard')?.addEventListener('click', () => openTransportPage());
        document.getElementById('transportUsageCard')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openTransportPage();
            }
        });

        // Handle edit button clicks
        $(document).on('click', '.edit-btn', function() {
            // Show update button
            document.getElementById('updateBtn').style.display = 'inline-block';
            document.getElementById('submitBtnSave').style.display = 'none';
            // Hide cancel button
            document.getElementById('cancelBtn').style.display = 'none';
            const student = JSON.parse($(this).attr('data-student'));
            
            // Populate form fields with student data
            document.getElementById('studentId').value = student.studentId;
            document.getElementById('admissionNo').value = student.studentId;
            document.getElementById('studentName').value = student.name;
            document.getElementById('fatherName').value = student.fatherName;
            document.getElementById('motherName').value = student.motherName || '';
            document.getElementById('dob').value = student.dob ? student.dob.split('T')[0] : '';
            
            // Ensure gender is properly set
            const genderSelect = document.getElementById('gender');
            if (student.gender) {
                genderSelect.value = student.gender;
            } else {
                genderSelect.value = 'Male'; // Default to Male if no gender is set
            }
            
            document.getElementById('admissionDate').value = student.admissionDate ? student.admissionDate.split('T')[0] : '';
            document.getElementById('class').value = student.class;
            document.getElementById('section').value = student.section || '';
            document.getElementById('session').value = student.session || '';
            document.getElementById('contactNo').value = student.contactNo;
            document.getElementById('tuitionFee').value = student.tuitionFee || 0;
            document.getElementById('address').value = student.address;
             document.getElementById('rollNo').value = student.rollNo;
            document.getElementById('studentForm').dataset.originalSession = student.session || '';

            // Handle transport facility
            const transportFacility = document.getElementById('transportFacility');
            transportFacility.value = student.transport?.required ? 'yes' : 'no';
            
            // Show/hide transport details based on selection
            const transportDetails = document.querySelector('.transport-details');
            if (student.transport?.required) {
                transportDetails.classList.remove('d-none');
                document.getElementById('busNumber').value = student.transport.busNumber || '';
                document.getElementById('transportFees').value = student.transport.fees || '';
                document.getElementById('transportStartDate').value = student.transport.startDate ? student.transport.startDate.split('T')[0] : '';
                document.getElementById('pickupPoint').value = student.transport.pickupPoint || '';
                document.getElementById('route').value = student.transport.route || '';
            } else {
                transportDetails.classList.add('d-none');
            }

            // Update submit button text and show cancel button
            document.getElementById('updateBtn').innerHTML = '<i class="fas fa-save"></i> Update Student';
            document.getElementById('cancelBtn').style.display = 'inline-block';
            
            // Scroll to form
            document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
        });
       
        // Handle form submission
        document.getElementById('studentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const buttonId = e.submitter.id; // Get the ID of the clicked button
            console.log(buttonId); // Debugging: Check which button was clicked
            const isTransportRequired = document.getElementById('transportFacility').value === 'yes';
            
            // Get gender value and ensure it's not empty
            const gender = document.getElementById('gender').value;
            if (!gender) {
                alert('Please select a gender');
                return;
            }
          if (!document.getElementById('session').value) {
                     alert('Please select a session');
                return;
                }
            const formData = {
                studentId: document.getElementById('admissionNo').value, // Always use admissionNo for studentId
                name: document.getElementById('studentName').value,
                fatherName: document.getElementById('fatherName').value,
                motherName: document.getElementById('motherName').value,
                dob: formattedDate(document.getElementById('dob').value),
                gender: gender,
                admissionDate: formattedDate(document.getElementById('admissionDate').value),
                class: document.getElementById('class').value,
                section: document.getElementById('section').value,
                rollNo: document.getElementById('rollNo').value,
                contactNo: document.getElementById('contactNo').value,
                tuitionFee: Number(document.getElementById('tuitionFee').value || 0),
                address: document.getElementById('address').value,
                session: document.getElementById('session').value,
                transport: {
                    required: isTransportRequired,
                    busNumber: isTransportRequired ? document.getElementById('busNumber').value : null,
                    fees: isTransportRequired ? document.getElementById('transportFees').value : null,
                    startDate: isTransportRequired ? document.getElementById('transportStartDate').value : null,
                    pickupPoint: isTransportRequired ? document.getElementById('pickupPoint').value : null,
                    route: isTransportRequired ? document.getElementById('route').value : null
                }
            };
                    let url = `${CONFIG.API_URL}/student`;
            let method = 'POST';

            if (buttonId === 'updateBtn') {
                const originalSession = document.getElementById('studentForm').dataset.originalSession || formData.session;
                url = `${CONFIG.API_URL}/student/${document.getElementById('admissionNo').value}?session=${encodeURIComponent(originalSession)}`;
                method = 'PUT';
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Error updating student');
                }

                if (data.success) {
                    const photoFile = document.getElementById('studentPhoto').files?.[0];
                    if (photoFile) {
                        await uploadStudentPhoto(formData.studentId, formData.session, photoFile);
                    }
                    const selectedSessionAfterSave = formData.session;
                    alert(buttonId === 'updateBtn' ? 'Student updated successfully!' : 'Student added successfully!');
                    document.getElementById('studentForm').reset();
                    document.getElementById('studentId').value = '';
                    delete document.getElementById('studentForm').dataset.originalSession;
                    document.getElementById('updateBtn').innerHTML = '<i class="fas fa-save"></i> Save Student';
                    document.getElementById('cancelBtn').style.display = 'none';
                    if (document.getElementById('session')) {
                        document.getElementById('session').value = selectedSessionAfterSave;
                    }
                    await loadStudentsTableBySession();
                } else {
                    throw new Error(data.message || 'Error updating student');
                }
            } catch (error) {
                console.error('Update error:', error);
                alert('Error updating student: ' + error.message);
            }
        });

        // Add event listener for cancel button
        document.getElementById('cancelBtn').addEventListener('click', function() {
            // Reset the form
            document.getElementById('studentForm').reset();
            document.getElementById('studentId').value = '';
            document.getElementById('tuitionFee').value = 0;
            delete document.getElementById('studentForm').dataset.originalSession;

            // Hide transport details
            document.querySelector('.transport-details').classList.add('d-none');

            // Hide cancel button and reset submit button text
            this.style.display = 'none';
            document.getElementById('updateBtn').style.display = 'none';
            document.getElementById('submitBtnSave').style.display = 'inline-block';          
        });

        // Handle import form submission
        document.getElementById('importForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const importBtn = e.target.querySelector('button[type="submit"]');
            const originalBtnText = importBtn.innerHTML;
            
            try {
                importBtn.disabled = true;
                importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';

                const file = document.getElementById('excelFile').files[0];
                const session = document.getElementById('session').value;

                if (!file) {
                    throw new Error('Please select a file to import');
                }
                if (!session) {
                    throw new Error('Please select a session');
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('session', session);

                const response = await fetch(`${CONFIG.API_URL}/student/import`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    },
                    body: formData
                });

                const result = await response.json();
                console.log(result);
                
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to import students');
                }
                
                alert(`Successfully imported ${result.importedCount} students!`);
                await loadStudentsTableBySession();
            } catch (error) {
                console.error('Import error:', error);
                alert(error.message || 'Error importing students');
            } finally {
                importBtn.disabled = false;
                importBtn.innerHTML = originalBtnText;
            }
        });

        // Function to update button visibility based on checkbox
        function updateButtonVisibility() {
            const showActions = document.getElementById('showActions').checked;
            const buttons = document.querySelectorAll('.edit-btn, .delete-btn, .promote-btn, .camera-btn');
            
            buttons.forEach(button => {
                if (showActions) {
                    button.classList.add('disabled-btn');
                    button.disabled = true;
                } else {
                    button.classList.remove('disabled-btn');
                    button.disabled = false;
                }
            });
        }


      function safeSet(id, value) {
          const el = document.getElementById(id);
          if (el) {
              el.textContent = value;
          } else {
              console.warn("Missing element:", id);
          }
      }
        // Function to update statistics cards
        function updateStatistics(data) {
            //console.log('Raw data All Students:', data);
          // console.log("Stats updating with:", data.length, "students");
          if (!Array.isArray(data)) {
    console.warn("Invalid data for stats");
    return;
}

console.log("Stats updating with:", data.length, "students");

            // Total Students
            const totalStudents = data.length;
            // document.getElementById('totalStudents').textContent = totalStudents;
            safeSet('totalStudents', totalStudents);

            // Gender Distribution
            const maleCount = data.filter(student => student.gender === 'Male').length;
            const femaleCount = data.filter(student => student.gender === 'Female').length;
            // document.getElementById('maleCount').textContent = maleCount;
          safeSet('maleCount', maleCount);
            // document.getElementById('femaleCount').textContent = femaleCount;
          safeSet('femaleCount', femaleCount);

            // Transport Usage
            const busUsers = data.filter(student => student.transport?.required);
            //console.log('Bus users:', busUsers);  // bus student
            
            const busCounts = {};
            let totalTransportFees = 0;
            let totalTuitionFees = 0;
            
            busUsers.forEach(student => {
              //  console.log('Processing student:', student.name, 'Transport:', student.transport);
                
                if (student.transport?.busNumber) {
                    busCounts[student.transport.busNumber] = (busCounts[student.transport.busNumber] || 0) + 1;
                }
                
                // Calculate transport fees - check both fee and fees properties
                const transportFee = student.transport?.fees || student.transport?.fee || 0;
                if (transportFee) {
                    const fee = parseFloat(transportFee);
                  //  console.log('Adding fee:', fee, 'for student:', student.name);
                    if (!isNaN(fee)) {
                        totalTransportFees += fee;
                    }
                }
            });

            data.forEach(student => {
                const tuitionFee = Number(student.tuitionFee || 0);
                if (!isNaN(tuitionFee)) {
                    totalTuitionFees += tuitionFee;
                }
            });

            console.log('Total transport fees:', totalTransportFees);

            // const busCountList = document.getElementById('busCountList');
            // busCountList.innerHTML = '';
          const busCountList = document.getElementById('busCountList');
if (!busCountList) {
    console.warn("busCountList not found");
    return;
}

busCountList.innerHTML = '';
            Object.entries(busCounts).forEach(([bus, count]) => {
                const p = document.createElement('p');
                p.className = 'card-text mb-0';
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'text-white text-decoration-none bus-summary-link';
                link.dataset.bus = bus;
                link.textContent = `${bus}: ${count}`;
                p.appendChild(link);
                busCountList.appendChild(p);
            });

            if (Object.keys(busCounts).length === 0) {
                busCountList.innerHTML = '<p class="card-text mb-0">No transport students</p>';
            }

            // Fees Calculation
            // document.getElementById('tuitionFeesInCard').textContent = totalTuitionFees.toLocaleString('en-IN');
            // document.getElementById('transportFeesInCard').textContent = totalTransportFees.toLocaleString('en-IN');
            // document.getElementById('combinedFeesInCard').textContent = (totalTuitionFees + totalTransportFees).toLocaleString('en-IN');
       safeSet('tuitionFeesInCard', totalTuitionFees.toLocaleString('en-IN'));
safeSet('transportFeesInCard', totalTransportFees.toLocaleString('en-IN'));
safeSet('combinedFeesInCard', (totalTuitionFees + totalTransportFees).toLocaleString('en-IN'));
        
        }

        // Initialize DataTable
        console.log('Initializing DataTable...');
        const tableElement = document.getElementById('studentTable');
        console.log('Table element found:', !!tableElement);
        
        if (!tableElement) {
            console.error('Student table element not found!');
            return;
        }
        
        let table; // Declare table variable in outer scope
        
        try {
            table = $('#studentTable').DataTable({
                processing: true,
                columns: [
                    { data: 'studentId', title: 'Student ID' },
                    { data: 'name', title: 'Student Name' },
                    { data: 'fatherName', title: "Father's Name" },
                    { data: 'motherName', title: "Mother's Name", render: function(data) { return data || '-'; } },
                    { data: 'class', title: 'Class' },
                    { data: 'session', title: 'Session' },
                    { data: 'contactNo', title: 'Contact' },
                    { data: 'rollNo', title: 'Roll No', render: function(data) { return data || '-'; } },
                    {
                        data: 'tuitionFee',
                        title: 'Tuition Fee',
                        render: function(data) {
                            return formatCurrency(data || 0);
                        }
                    },
                    { 
                        data: null,
                        title: 'Transport',
                        render: function(data, type, row) {
                            if (!row.transport?.required) return 'No';
                            return `Yes ${row.transport.busNumber ? `(Bus: ${row.transport.busNumber})` : ''}`;
                        }
                    },
                    {
                        data: null,
                        title: 'Actions',
                        orderable: false,
                        render: function(data, type, row) {
                            return `
                                <div class="d-flex gap-1">
                                    <button class="btn btn-sm btn-outline-primary" onclick="viewStudentDetails('${row.studentId}', '${row.session || ''}')" title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                   
                                    <button class="btn btn-sm btn-primary promote-btn disabled-btn" data-student='${JSON.stringify(row)}' title="Promote">
                                        <i class="fas fa-level-up-alt"></i>
                                    </button>
                                    <button class="btn btn-sm btn-info edit-btn disabled-btn" data-student='${JSON.stringify(row)}'>
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-secondary camera-btn disabled-btn" data-id="${row.studentId}" data-session="${row.session || ''}" title="Camera Upload">
                                        <i class="fas fa-camera"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger delete-btn disabled-btn" data-id="${row.studentId}" data-session="${row.session || ''}" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `;
                        }
                    }
                ]
            });
            console.log('DataTable initialized successfully!');
        } catch (error) {
            console.error('Error initializing DataTable:', error);
            alert('Error initializing student table: ' + error.message);
            return;
        }

        async function loadStudentsTableBySession() {
            try {
                const selectedSession = document.getElementById('studentSessionFilter')?.value || '';
                const url = selectedSession
                    ? `${CONFIG.API_URL}/student?session=${encodeURIComponent(selectedSession)}`
                    : `${CONFIG.API_URL}/student`;
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (data.success && Array.isArray(data.students)) {
                    table.clear().rows.add(data.students).draw();
                    // updateStatistics(data.students);
                    setTimeout(() => {
                        updateButtonVisibility();
                    }, 100);
                } else {
                    console.error('Invalid data format:', data);
                }
            } catch (error) {
                console.error('Error loading students:', error);
                alert('Error loading students: ' + error.message);
            }
        }

        // Update statistics whenever table data changes
        // table.on('draw', () => {
        //     updateStatistics(table.data().toArray());
        //     updateButtonVisibility(); // Maintain button visibility on pagination
        // });
      table.on('draw', () => {
    try {
        updateStatistics(table.data().toArray());
    } catch (err) {
        console.error("Stats error:", err);
    }
});

        $(document).on('click', '.bus-summary-link', function(event) {
            event.preventDefault();
            event.stopPropagation();
            openTransportPage(this.dataset.bus || '');
        });

        // Call loadClassOptions when the page loads
        loadClassOptions();
        document.getElementById('studentSessionFilter')?.addEventListener('change', loadStudentsTableBySession);
        document.getElementById('session')?.addEventListener('change', () => {
            const academicYearInput = document.getElementById('classAcademicYear');
            if (academicYearInput && !document.getElementById('classId')?.value) {
                academicYearInput.value = document.getElementById('session').value || '';
            }
        });

        // Handle promote button clicks
        $(document).on('click', '.promote-btn', function() {
            const student = JSON.parse(this.dataset.student);
            const currentClass = student.class;
            
            // Clear and populate the new class dropdown with classes that come after current class alphabetically
            const newClassSelect = document.getElementById('newClass');
            newClassSelect.innerHTML = '<option value="">Select Class</option>';
            
            // Get available higher classes (sorted alphabetically)
            const higherClasses = classes.filter(cls => cls.localeCompare(currentClass) > 0);
            
            // Add the higher classes to the dropdown
            higherClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = cls;
                newClassSelect.appendChild(option);
            });

            // Store student ID for promotion
            newClassSelect.dataset.studentId = student.studentId;
            newClassSelect.dataset.currentSession = student.session || '';
            
            // Show modal
            promotionModal.show();
        });

        // Handle promote confirmation
        document.getElementById('promoteBtn').addEventListener('click', async () => {
            const newClass = document.getElementById('newClass').value;
            const newSession = document.getElementById('newSession').value;
            const studentId = document.getElementById('newClass').dataset.studentId;
            const currentSession = document.getElementById('newClass').dataset.currentSession;

            if (!newClass || !newSession) {
                alert('Please select both class and session');
                return;
            }

            try {
                const response = await fetch(`${CONFIG.API_URL}/student/${studentId}/promote`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ newClass, newSession, currentSession })
                });

                const data = await response.json();
                if (data.success) {
                    alert('Student promoted successfully');
                    promotionModal.hide();
                    await loadStudentsTableBySession();
                } else {
                    alert(data.message || 'Error promoting student');
                }
            } catch (error) {
                console.error('Promotion error:', error);
                alert('Error promoting student');
            }
        });

        async function uploadStudentPhoto(studentId, session, photoFile) {
            const fd = new FormData();
            fd.append('photo', photoFile);
            fd.append('session', session);
            const uploadResponse = await fetch(`${CONFIG.API_URL}/student/${encodeURIComponent(studentId)}/photo?session=${encodeURIComponent(session || '')}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                },
                body: fd
            });
            const uploadData = await uploadResponse.json();
            if (!uploadResponse.ok || !uploadData.success) {
                throw new Error(uploadData.message || 'Photo upload failed');
            }
            return uploadData;
        }

        async function loadSessionsForBulkPromotion() {
            try {
                const response = await fetch(`${CONFIG.API_URL}/sessions`, {
                    headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
                });
                if (!response.ok) return;
                const payload = await response.json();
                const sessions = (payload.sessions || []).map(s => s.name || s);
                const bulkCurrentSession = document.getElementById('bulkPreviousSession');
                const bulkNewSession = document.getElementById('bulkNewSession');
                if (!bulkCurrentSession || !bulkNewSession) return;

                const currentValue = bulkCurrentSession.value;
                const newValue = bulkNewSession.value;

                bulkCurrentSession.innerHTML = '<option value="">Select Session</option>';
                bulkNewSession.innerHTML = '<option value="">Select Session</option>';
                sessions.forEach(session => {
                    bulkCurrentSession.appendChild(new Option(session, session));
                    bulkNewSession.appendChild(new Option(session, session));
                });

                if (currentValue) bulkCurrentSession.value = currentValue;
                if (newValue) bulkNewSession.value = newValue;
            } catch (err) {
                console.error('Error loading sessions for bulk promotion:', err);
            }
        }

        document.getElementById('bulkPromoteBtn')?.addEventListener('click', async () => {
            const payload = {
                currentSession: document.getElementById('bulkPreviousSession').value,
                newSession: document.getElementById('bulkNewSession').value,
                fromClass: document.getElementById('bulkFromClass').value,
                fromSection: document.getElementById('bulkFromSection').value.trim(),
                toClass: document.getElementById('bulkToClass').value,
                toSection: document.getElementById('bulkToSection').value.trim()
            };

            if (!payload.currentSession || !payload.newSession || !payload.fromClass || !payload.toClass) {
                alert('Please select previous/new session and from/to class.');
                return;
            }

            try {
                const res = await fetch(`${CONFIG.API_URL}/student/promote-bulk`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || 'Bulk promotion failed');
                }

                alert(`Bulk promotion done. Created: ${result.summary?.created || 0}, Updated: ${result.summary?.updated || 0}`);
                bulkPromotionModal.hide();
                await loadStudentsTableBySession();
            } catch (err) {
                console.error('Bulk promotion error:', err);
                alert(`Error in bulk promotion: ${err.message}`);
            }
        });

        loadSessionsForBulkPromotion();

        // Per-row camera upload
        const rowPhotoCaptureInput = document.getElementById('rowPhotoCaptureInput');
        $(document).on('click', '.camera-btn', function() {
            const studentId = this.dataset.id;
            const studentSession = this.dataset.session || document.getElementById('session')?.value || '';
            if (!studentId) return;
            rowPhotoCaptureInput.dataset.studentId = studentId;
            rowPhotoCaptureInput.dataset.session = studentSession;
            rowPhotoCaptureInput.value = '';
            rowPhotoCaptureInput.click();
        });

        rowPhotoCaptureInput?.addEventListener('change', async function() {
            const file = this.files?.[0];
            if (!file) return;
            const studentId = this.dataset.studentId;
            const studentSession = this.dataset.session || '';
            try {
                await uploadStudentPhoto(studentId, studentSession, file);
                alert('Photo uploaded successfully');
            } catch (error) {
                console.error('Row photo upload error:', error);
                alert(`Photo upload failed: ${error.message}`);
            } finally {
                this.value = '';
            }
        });

        // Handle delete button clicks
        $(document).on('click', '.delete-btn', async function() {
            if (!confirm('Are you sure you want to delete this student?')) return;
            
            const studentId = this.dataset.id;
            const studentSession = this.dataset.session;
            try {
                const response = await fetch(`${CONFIG.API_URL}/student/${studentId}?session=${encodeURIComponent(studentSession || '')}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                });

                const data = await response.json();
                if (data.success) {
                    alert('Student deleted successfully');
                    await loadStudentsTableBySession();
                } else {
                    alert(data.message || 'Error deleting student');
                }
            } catch (error) {
                console.error('Delete error:', error);
                alert('Error deleting student');
            }
        });
    } catch (error) {
        console.error('Initialization error:', error);
    }
    // Retrieve user data from localStorage
        const userData = JSON.parse(localStorage.getItem("skyview_user"));
    
        // Check if user data exists and role is not "admin"
        if (userData && userData.role !== "admin") {
            // Remove all elements with class "hide-unhide"
            // document.querySelectorAll(".hide-unhide").forEach(element => element.remove());
          document.querySelectorAll(".hide-unhide").forEach(element => {
    element.style.display = "none";
});
    
            // Disable all buttons with class "disable-btn"
            document.querySelectorAll(".disabled-btn").forEach(button => {
                button.disabled = true;
                button.classList.add("disabled"); // Optionally add a 'disabled' CSS class
        });
        }
});

// Function to download students data
async function downloadStudentsData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/download-students/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download students data');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students_data.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading students data: ' + error.message);
    }
}
