function formatTransactionsMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatTransactionPaymentMode(transaction = {}) {
    if (Array.isArray(transaction.paymentBreakdown) && transaction.paymentBreakdown.length) {
        return transaction.paymentBreakdown
            .map((entry) => `${entry.modeLabel || entry.baseMode} (${formatTransactionsMoney(entry.amount)})`)
            .join(', ');
    }

    return transaction.paymentMode || '-';
}

let feeTransactionFilterTimer = null;

function renderTransactionDashboard(summary = {}) {
    const collected = document.getElementById('transactionsCollected');
    const outstanding = document.getElementById('transactionsOutstanding');
    const receipts = document.getElementById('transactionsReceipts');
    const balance = document.getElementById('transactionsBalance');

    if (!collected) {
        return;
    }

    collected.textContent = formatTransactionsMoney(summary.totalCollected || 0);
    outstanding.textContent = formatTransactionsMoney(summary.totalOutstanding || 0);
    receipts.textContent = summary.receiptCount || 0;
    balance.textContent = formatTransactionsMoney(summary.netBalance || 0);
}

function setupMonthFilter() {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const select = document.getElementById('filterMonth');
    select.innerHTML = `<option value="">All Months</option>${months.map((month) => `<option value="${month}">${month}</option>`).join('')}`;
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');

    if (!transactions.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center text-muted py-4">No transactions found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map((transaction) => `
        <tr>
            <td>${new Date(transaction.receiptDate || transaction.createdAt).toLocaleDateString('en-IN')}</td>
            <td>${transaction.admissionNo}</td>
            <td>${transaction.studentName}</td>
            <td>${transaction.className}${transaction.section ? ` - ${transaction.section}` : ''}</td>
            <td>${transaction.month}</td>
            <td>${(transaction.lineItems || []).map((item) => `${item.particular} (${formatTransactionsMoney(item.amount)})`).join(', ') || '-'}</td>
            <td>Rs. ${formatTransactionsMoney(transaction.paidAmount)}</td>
            <td>Rs. ${formatTransactionsMoney(transaction.dueAmount)}</td>
            <td>${formatTransactionPaymentMode(transaction)}</td>
            <td>${transaction.notes || '-'}</td>
            <td>${transaction.voucherNo || '-'}</td>

            <td>
                <a href="fee-receipt.html?id=${transaction._id}" target="_blank" class="btn btn-sm btn-outline-primary">
                    Print
                </a>
          
                <a href="fee-collection.html?receiptId=${transaction._id}" class="btn btn-sm btn-outline-secondary">
                    Edit
                </a>
            </td>
        </tr>
    `).join('');
}

async function loadTransactions(filters = {}) {
    const result = await API.fees.getTransactions(filters);

    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch transactions');
    }

    renderTransactionsTable(result.transactions || []);
}

async function loadTransactionDashboard() {
    const result = await API.fees.getDashboard();
    if (result?.success) {
        renderTransactionDashboard(result.summary || {});
    }
}

function getTransactionFilters() {
    return {
        admissionNo: document.getElementById('filterAdmissionNo').value.trim(),
        month: document.getElementById('filterMonth').value,
        className: document.getElementById('filterClassName').value.trim(),
        paymentMode: document.getElementById('filterPaymentMode').value,
        particular: document.getElementById('filterParticular').value.trim(),
        startDate: document.getElementById('filterStartDate').value,
        endDate: document.getElementById('filterEndDate').value
    };
}

function scheduleLiveTransactionFilter() {
    clearTimeout(feeTransactionFilterTimer);
    feeTransactionFilterTimer = setTimeout(async () => {
        try {
            await loadTransactions(getTransactionFilters());
        } catch (error) {
            console.error(error);
        }
    }, 250);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    setupMonthFilter();

    try {
        await Promise.all([
            loadTransactions(),
            loadTransactionDashboard()
        ]);
    } catch (error) {
        console.error(error);
        renderTransactionsTable([]);
    }

    document.getElementById('transactionFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await loadTransactions(getTransactionFilters());
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to fetch transactions');
        }
    });

    document.getElementById('filterParticular').addEventListener('input', scheduleLiveTransactionFilter);

    document.getElementById('resetFiltersBtn').addEventListener('click', async () => {
        document.getElementById('transactionFilterForm').reset();
        setupMonthFilter();
        try {
            await loadTransactions();
        } catch (error) {
            console.error(error);
        }
    });

    // Setup session dropdown and fee collection table
    setupSessionDropdown();
    document.getElementById('sessionDropdown').addEventListener('change', loadFeeCollectionData);
    document.getElementById('exportToExcelBtn').addEventListener('click', exportToExcel);
});

function setupSessionDropdown() {
    const dropdown = document.getElementById('sessionDropdown');
    const currentYear = new Date().getFullYear();
    const sessions = [];
    
    // Generate session options (e.g., 2023-24, 2024-25, 2025-26)
    for (let i = 0; i < 5; i++) {
        const startYear = currentYear - 2 + i;
        const endYear = startYear + 1;
        sessions.push(`${startYear}-${endYear}`);
    }
    
    dropdown.innerHTML = `<option value="">Select Session</option>` + 
        sessions.map(session => `<option value="${session}">${session}</option>`).join('');
}

async function loadFeeCollectionData() {
    const selectedSession = document.getElementById('sessionDropdown').value;
    const tbody = document.getElementById('feeCollectionTableBody');
    
    if (!selectedSession) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">Select a session to view fee collection data...</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center text-muted py-4">Loading fee collection data...</td>
        </tr>
    `;
    
    try {
        const result = await API.fees.getFeeCollectionBySession(selectedSession);
        if (result?.success) {
            renderFeeCollectionTable(result.feeCollectionData || []);
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger py-4">Unable to load fee collection data</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading fee collection data:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">Error loading fee collection data</td>
            </tr>
        `;
    }
}

function renderFeeCollectionTable(feeCollectionData) {
    const tbody = document.getElementById('feeCollectionTableBody');
    
    if (!feeCollectionData.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">No fee collection data available for this session</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = feeCollectionData.map((monthData) => `
        <tr>
            <td>${monthData.month || '-'}</td>
            <td>${monthData.tuitionFees > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.tuitionFees)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.tuitionFees)}</span>`}</td>
            <td>${monthData.transports > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.transports)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.transports)}</span>`}</td>
            <td>${monthData.admissionFees > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.admissionFees)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.admissionFees)}</span>`}</td>
            <td>${monthData.readmissionFees > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.readmissionFees)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.readmissionFees)}</span>`}</td>
            <td>${monthData.books > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.books)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.books)}</span>`}</td>
            <td>${monthData.uniform > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.uniform)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.uniform)}</span>`}</td>
            <td>${monthData.lateFine > 0 ? `<strong>Rs. ${formatTransactionsMoney(monthData.lateFine)}</strong>` : `<span style="color: #999;">Rs. ${formatTransactionsMoney(monthData.lateFine)}</span>`}</td>
        </tr>
    `).join('');
}

async function exportToExcel() {
    const selectedSession = document.getElementById('sessionDropdown').value;
    
    if (!selectedSession) {
        alert('Please select a session first');
        return;
    }
    
    try {
        // Show loading state
        const exportBtn = document.getElementById('exportToExcelBtn');
        const originalHtml = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exporting...';
        
        // Get fee collection summary data
        const summaryResult = await API.fees.getFeeCollectionBySession(selectedSession);
        
        // Get all transactions for the session
        const transactionsResult = await API.fees.getTransactions({ session: selectedSession });
        
        if (!summaryResult?.success || !transactionsResult?.success) {
            throw new Error('Failed to fetch data for export');
        }
        
        // Create Excel workbook with two sheets
        const workbook = XLSX.utils.book_new();
        
        // Sheet 1: Fee Collection Summary
        const summaryData = [
            ['Month', 'Tuition Fees Collection', 'Transports', 'Admission Fees', 'Re-admission', 'Books', 'Uniform', 'Late Fine'],
            ...(summaryResult.feeCollectionData || []).map(row => [
                row.month || '-',
                row.tuitionFees || 0,
                row.transports || 0,
                row.admissionFees || 0,
                row.readmissionFees || 0,
                row.books || 0,
                row.uniform || 0,
                row.lateFine || 0
            ])
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Fee Collection Summary');
        
        // Sheet 2: All Transactions
        const transactionsData = [
            ['Date', 'Admission No.', 'Student Name', 'Class', 'Section', 'Month', 'Particulars', 'Paid Amount', 'Due Amount', 'Payment Mode', 'Notes', 'Receipt No.', 'Voucher No.'],
            ...(transactionsResult.transactions || []).map(transaction => [
                new Date(transaction.receiptDate || transaction.createdAt).toLocaleDateString('en-IN'),
                transaction.admissionNo || '',
                transaction.studentName || '',
                transaction.className || '',
                transaction.section || '',
                transaction.month || '',
                (transaction.lineItems || []).map(item => `${item.particular}: Rs.${item.amount}`).join(', ') || '',
                transaction.paidAmount || 0,
                transaction.dueAmount || 0,
                formatTransactionPaymentMode(transaction),
                transaction.notes || '',
                transaction.receiptNo || '',
                transaction.voucherNo || ''
            ])
        ];
        
        const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'All Transactions');
        
        // Generate filename with session and date
        const filename = `Fee_Report_${selectedSession}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Download the Excel file
        XLSX.writeFile(workbook, filename);
        
        // Restore button state
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHtml;
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting to Excel: ' + error.message);
        
        // Restore button state
        const exportBtn = document.getElementById('exportToExcelBtn');
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-file-excel me-2"></i>Export';
    }
}
