class Dashboard {
    static async getClassStatistics() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/classes/statistics`, {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching class statistics:', error);
            return [];
        }
    }

    static createClassCard(classData) {
        const col = document.createElement('div');
        col.className = 'col-md-4 col-lg-3 mb-4';
        
        col.innerHTML = `
            <div class="card class-card" onclick="Dashboard.showClassDetails('${classData.name}')">
                <div class="card-header bg-primary text-white">
                    <h5 class="card-title mb-0">${classData.name}</h5>
                </div>
                <div class="card-body">
                    <div class="stats-container">
                        <div class="stat-item">
                            <i class="fas fa-users"></i>
                            <div class="stat-label">Total Students</div>
                            <div class="stat-value">${classData.totalStudents}</div>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-male"></i>
                            <div class="stat-label">Male</div>
                            <div class="stat-value">${classData.maleStudents}</div>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-female"></i>
                            <div class="stat-label">Female</div>
                            <div class="stat-value">${classData.femaleStudents}</div>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-bus"></i>
                            <div class="stat-label">Transport</div>
                            <div class="stat-value">${classData.transportStudents}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return col;
    }

    static async renderDashboard() {
        const classCardsContainer = document.getElementById('classCards');
        if (!classCardsContainer) return;

        const statistics = await this.getClassStatistics();
        classCardsContainer.innerHTML = '';

        statistics.forEach(classData => {
            const card = this.createClassCard(classData);
            classCardsContainer.appendChild(card);
        });
    }

    static async showClassDetails(className) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/students/class/${className}`, {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });
            const students = await response.json();
            
            // Create modal to show student list
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'classDetailsModal';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${className} - Student List</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Father's Name</th>
                                        <th>Contact</th>
                                        <th>Transport</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${students.map(student => `
                                        <tr>
                                            <td>${student.studentId}</td>
                                            <td>${student.name}</td>
                                            <td>${student.fatherName}</td>
                                            <td>${student.contactNo}</td>
                                            <td>${student.transportOpted ? 'Yes' : 'No'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
            
            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });
        } catch (error) {
            console.error('Error fetching class details:', error);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('classCards')) {
        Dashboard.renderDashboard();
    }
});
