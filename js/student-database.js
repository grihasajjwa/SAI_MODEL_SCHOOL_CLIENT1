// Wait for the DOM to be fully loaded
function formattedDate(excelDate) {
  if (!isNaN(excelDate) && excelDate > 25569) {
    // Convert Excel serial to JS Date
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
  } else {
    // Try to parse it as a normal date string
    const date = new Date(excelDate);
    if (isNaN(date)) return excelDate;
    return date.toISOString().split('T')[0];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!Auth.isAuthenticated()) {
            window.location.href = '../login.html';
            return;
        }
                 
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

        // Initialize transport facility toggle
        document.getElementById('transportFacility').addEventListener('change', (e) => {
            const transportDetails = document.querySelector('.transport-details');
            transportDetails.classList.toggle('d-none', e.target.value === 'no');
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
            document.getElementById('contactNo').value = student.contactNo;
            document.getElementById('address').value = student.address;
             document.getElementById('rollNo').value = student.rollNo;

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
                dob: formattedDate(document.getElementById('dob').value),
                gender: gender,
                admissionDate: formattedDate(document.getElementById('admissionDate').value),
                class: document.getElementById('class').value,
                section: document.getElementById('section').value,
                 rollNo: document.getElementById('rollNo').value,
                contactNo: document.getElementById('contactNo').value,
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
                url = `${CONFIG.API_URL}/student/${document.getElementById('admissionNo').value}`;
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
                    alert(buttonId === 'updateBtn' ? 'Student updated successfully!' : 'Student added successfully!');
                    document.getElementById('studentForm').reset();
                    document.getElementById('studentId').value = '';
                    document.getElementById('updateBtn').innerHTML = '<i class="fas fa-save"></i> Save Student';
                    document.getElementById('cancelBtn').style.display = 'none';
                    location.reload();
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
                location.reload(); // Refresh the page to show new students
            } catch (error) {
                console.error('Import error:', error);
                alert(error.message || 'Error importing students');
            } finally {
                importBtn.disabled = false;
                importBtn.innerHTML = originalBtnText;
            }
        });

        // Function to update statistics cards
        function updateStatistics(data) {
            //console.log('Raw data All Students:', data);

            // Total Students
            const totalStudents = data.length;
            document.getElementById('totalStudents').textContent = totalStudents;

            // Gender Distribution
            const maleCount = data.filter(student => student.gender === 'Male').length;
            const femaleCount = data.filter(student => student.gender === 'Female').length;
            document.getElementById('maleCount').textContent = maleCount;
            document.getElementById('femaleCount').textContent = femaleCount;

            // Transport Usage
            const busUsers = data.filter(student => student.transport?.required);
            //console.log('Bus users:', busUsers);  // bus student
            
            const busCounts = {};
            let totalTransportFees = 0;
            
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

            console.log('Total transport fees:', totalTransportFees);

            const busCountList = document.getElementById('busCountList');
            busCountList.innerHTML = '';
            Object.entries(busCounts).forEach(([bus, count]) => {
                const p = document.createElement('p');
                p.className = 'card-text mb-0';
                p.textContent = `${bus}: ${count}`;
                busCountList.appendChild(p);
            });

            // Fees Calculation
            const tuitionFees = totalStudents * 1200; // ₹1200 per student
            document.getElementById('tuitionFeesInCard').textContent = tuitionFees.toLocaleString();
            document.getElementById('transportFeesInCard').textContent = totalTransportFees.toLocaleString();
        }

        // Initialize DataTable
        const table = $('#studentTable').DataTable({
            processing: true,
            columns: [
                { data: 'studentId', title: 'Student ID' },
                { data: 'name', title: 'Student Name' },
                { data: 'fatherName', title: "Father's Name" },
                { data: 'class', title: 'Class' },
                { data: 'contactNo', title: 'Contact' },
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
                                <button class="btn btn-sm btn-primary promote-btn disabled-btn" data-student='${JSON.stringify(row)}' title="Promote">
                                    <i class="fas fa-level-up-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-info edit-btn disabled-btn" data-student='${JSON.stringify(row)}'>
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger delete-btn disabled-btn" data-id="${row.studentId}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ]
        });

        // Load initial data and update statistics
        try {
            const response = await fetch(`${CONFIG.API_URL}/student`, {
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
                updateStatistics(data.students);
            } else {
                console.error('Invalid data format:', data);
            }
        } catch (error) {
            console.error('Error loading students:', error);
            alert('Error loading students: ' + error.message);
        }

        // Update statistics whenever table data changes
        table.on('draw', () => {
            updateStatistics(table.data().toArray());
        });

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
                
                // Get unique class names using Set
                const uniqueClasses = [...new Set(classData.map(cls => cls.className))];
                
                // Filter out any invalid classes (not in sequence) and sort them
                classes = uniqueClasses
                    .filter(cls => getClassIndex(cls) !== -1)
                    .sort((a, b) => getClassIndex(a) - getClassIndex(b));

                // Populate the main class dropdown
                const classSelect = document.querySelector('#class');
                if (classSelect) {
                    classSelect.innerHTML = '<option value="">Select Class</option>';
                    classes.forEach(cls => {
                        const option = document.createElement('option');
                        option.value = cls;
                        option.textContent = cls;
                        classSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Error loading classes:', error);
                alert('Error loading classes. Please try again.');
            }
        }

        // Call loadClassOptions when the page loads
        loadClassOptions();

        // Handle promote button clicks
        $(document).on('click', '.promote-btn', function() {
            const student = JSON.parse(this.dataset.student);
            const currentClass = student.class;
            
            // Get the index of current class in the sequence
            const currentClassIndex = getClassIndex(currentClass);
            
            // Clear and populate the new class dropdown with only higher classes
            const newClassSelect = document.getElementById('newClass');
            newClassSelect.innerHTML = '<option value="">Select Class</option>';
            
            // Get available higher classes (they are already sorted due to the sort in loadClassOptions)
            const higherClasses = classes.filter(cls => getClassIndex(cls) > currentClassIndex);
            
            // Add the higher classes to the dropdown
            higherClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = cls;
                newClassSelect.appendChild(option);
            });

            // Store student ID for promotion
            newClassSelect.dataset.studentId = student.studentId;
            
            // Show modal
            promotionModal.show();
        });

        // Handle promote confirmation
        document.getElementById('promoteBtn').addEventListener('click', async () => {
            const newClass = document.getElementById('newClass').value;
            const newSession = document.getElementById('newSession').value;
            const studentId = document.getElementById('newClass').dataset.studentId;

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
                    body: JSON.stringify({ newClass, newSession })
                });

                const data = await response.json();
                if (data.success) {
                    alert('Student promoted successfully');
                    promotionModal.hide();
                    location.reload();
                } else {
                    alert(data.message || 'Error promoting student');
                }
            } catch (error) {
                console.error('Promotion error:', error);
                alert('Error promoting student');
            }
        });

        // Handle delete button clicks
        $(document).on('click', '.delete-btn', async function() {
            if (!confirm('Are you sure you want to delete this student?')) return;
            
            const studentId = this.dataset.id;
            try {
                const response = await fetch(`${CONFIG.API_URL}/student/${studentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                });

                const data = await response.json();
                if (data.success) {
                    alert('Student deleted successfully');
                    location.reload();
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
            document.querySelectorAll(".hide-unhide").forEach(element => element.remove());
    
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

