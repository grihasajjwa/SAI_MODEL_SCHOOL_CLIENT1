
  document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    //Navbar.loadNavbar();

    const tableBody = document.getElementById('feedbackTableBody');
    const totalEntries = document.getElementById('totalEntries');
    const averageRating = document.getElementById('averageRating');
    const categoryFilter = document.getElementById('categoryFilter');
    const ratingFilter = document.getElementById('ratingFilter');
    const pagination = document.getElementById('pagination');
    const exportExcel = document.getElementById('exportExcel');
    let currentPage = 1;

    // Show/hide loading spinner
    const setLoading = (show) => {
        const spinner = document.getElementById('pageSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    };

    async function loadFeedback() {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            queryParams.append('page', currentPage);
            queryParams.append('limit', 10);

            const category = categoryFilter.value;
            const minRating = ratingFilter.value;

            if (category) queryParams.append('category', category);
            if (minRating) queryParams.append('minRating', minRating);

            const response = await fetch(`${CONFIG.API_URL}/all-feedback?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch feedback');
            }

            const data = await response.json();
            
            // Clear existing table
            tableBody.innerHTML = '';

            // Add feedback entries
            data.feedback.forEach(feedback => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${feedback.submittedAt ? new Date(feedback.submittedAt).toLocaleDateString() : 'N/A'}</td>
                    <td>${feedback.parentName}</td>
                    <td>${feedback.studentName}</td>
                    <td>${feedback.class}</td>
                    <td>${feedback.category}</td>
                    <td>
                        <div class="rating-display">
                            ${Array(5).fill(0).map((_, i) => 
                                `<i class="fas fa-star ${i < feedback.rating ? 'text-warning' : 'text-muted'}"></i>`
                            ).join('')}
                        </div>
                    </td>
                    <td>${feedback.feedback}</td>
                `;
                tableBody.appendChild(row);
            });

            // Update stats
            totalEntries.textContent = data.pagination.total;
            
            // Update pagination
            const totalPages = data.pagination.pages;
            let paginationHtml = '';
            
            // Previous button
            paginationHtml += `
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
                </li>
            `;
            
            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            }
            
            // Next button
            paginationHtml += `
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
                </li>
            `;
            
            pagination.innerHTML = paginationHtml;

            // Add click handlers to pagination
            pagination.querySelectorAll('.page-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const newPage = parseInt(e.target.dataset.page);
                    if (newPage && newPage !== currentPage && newPage > 0 && newPage <= totalPages) {
                        currentPage = newPage;
                        loadFeedback();
                    }
                });
            });

        } catch (error) {
            console.error('Error loading feedback:', error);
            alert('Failed to load feedback. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Load feedback stats
    async function loadStats() {
        try {
            // const response = await fetch(`${CONFIG.API_URL}/feedback-stats`, {
            //     headers: {
            //         'Authorization': `Bearer ${Auth.getToken()}`
            //     }
            // });
           const response = await fetch(`${CONFIG.API_URL}/feedback-stats`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch statistics');
            }

            const stats = await response.json();
            averageRating.textContent = stats.averageRating;
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // Export to Excel function
    async function exportToExcel() {
        try {
            setLoading(true);
            exportExcel.disabled = true;
            
            // Get all feedback without pagination
            const queryParams = new URLSearchParams();
            queryParams.append('limit', 1000); // Get more records for export
            
            const category = categoryFilter.value;
            const minRating = ratingFilter.value;

            if (category) queryParams.append('category', category);
            if (minRating) queryParams.append('minRating', minRating);

            const response = await fetch(`${CONFIG.API_URL}/all-feedback?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch feedback data');
            }

            const data = await response.json();
            
            // Prepare Excel data
            const workbook = XLSX.utils.book_new();
            
            // Convert feedback data to Excel format
            const excelData = data.feedback.map(item => ({
                'Date': item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A',
                'Parent Name': item.parentName,
                'Student Name': item.studentName,
                'Class': item.class,
                'Category': item.category,
                'Rating': item.rating,
                'Feedback': item.feedback,
                'Suggestions': item.suggestions || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            
            // Add column widths
            const columnWidths = [
                { wch: 12 }, // Date
                { wch: 20 }, // Parent Name
                { wch: 20 }, // Student Name
                { wch: 10 }, // Class
                { wch: 15 }, // Category
                { wch: 8 },  // Rating
                { wch: 40 }, // Feedback
                { wch: 40 }  // Suggestions
            ];
            worksheet['!cols'] = columnWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Feedback');

            // Generate Excel file
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `feedback_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export feedback. Please try again.');
        } finally {
            setLoading(false);
            exportExcel.disabled = false;
        }
    }

    // Initial load
    loadFeedback();
    loadStats();

    // Add filter event listeners
    categoryFilter.addEventListener('change', () => {
        currentPage = 1;
        loadFeedback();
    });

    ratingFilter.addEventListener('change', () => {
        currentPage = 1;
        loadFeedback();
    });

    // Add export button event listener
    exportExcel.addEventListener('click', exportToExcel);
});
