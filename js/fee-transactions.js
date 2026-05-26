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
let feeCollectionParticulars = [];
let feeCollectionRows = [];
let visibleFeeCollectionParticulars = new Set();
let transactionSessionFilter = '';
let feeTransactionRows = [];
let feeTransactionCurrentPage = 1;

function escapeTransactionsHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getTransactionKeywords(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}

function transactionKeywordMatch(value = '', keywords = []) {
    const haystack = String(value || '').toLowerCase();
    return keywords.every((keyword) => haystack.includes(keyword));
}

function getInitialTransactionFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
        session: params.get('session') || '',
        month: params.get('month') || '',
        particular: params.get('particular') || '',
        admissionNo: params.get('admissionNo') || '',
        studentName: params.get('studentName') || '',
        className: params.get('className') || ''
    };
}

function isClickedAmountDetailMode() {
    const filters = getInitialTransactionFiltersFromUrl();
    return Boolean(filters.session || filters.month || filters.particular);
}

function applyInitialTransactionFilters() {
    const filters = getInitialTransactionFiltersFromUrl();
    transactionSessionFilter = filters.session;

    if (filters.admissionNo) document.getElementById('filterAdmissionNo').value = filters.admissionNo;
    if (filters.studentName) document.getElementById('filterStudentName').value = filters.studentName;
    if (filters.month) document.getElementById('filterMonth').value = filters.month;
    if (filters.className) document.getElementById('filterClassName').value = filters.className;
    if (filters.particular) document.getElementById('filterParticular').value = filters.particular;
}

function renderTransactionDashboard(summary = {}) {
    const collected = document.getElementById('transactionsCollected');
    const outstanding = document.getElementById('transactionsOutstanding');
    const receipts = document.getElementById('transactionsReceipts');
    const balance = document.getElementById('transactionsBalance');

    if (!collected) {
        return;
    }

    document.getElementById('transactionsCollectedLabel').textContent = 'Total Collected';
    document.getElementById('transactionsOutstandingLabel').textContent = 'Total Outstanding';
    document.getElementById('transactionsReceiptsLabel').textContent = 'Receipts';
    document.getElementById('transactionsBalanceLabel').textContent = 'Net Balance';
    document.getElementById('transactionsCollectedPrefix').textContent = 'Rs. ';
    document.getElementById('transactionsOutstandingPrefix').textContent = 'Rs. ';
    document.getElementById('transactionsBalancePrefix').textContent = 'Rs. ';
    collected.textContent = formatTransactionsMoney(summary.totalCollected || 0);
    outstanding.textContent = formatTransactionsMoney(summary.totalOutstanding || 0);
    receipts.textContent = summary.receiptCount || 0;
    balance.textContent = formatTransactionsMoney(summary.netBalance || 0);
}

function hasActiveTransactionFilters(filters = {}) {
    return Object.entries(filters).some(([key, value]) => key !== 'limit' && value !== undefined && value !== null && value !== '');
}

function getTransactionLineTotal(transaction = {}, selectedParticular = '') {
    const particularKeywords = getTransactionKeywords(selectedParticular);
    const lineItems = Array.isArray(transaction.lineItems) ? transaction.lineItems : [];

    if (particularKeywords.length) {
        return lineItems
            .filter((item) => transactionKeywordMatch(item.particular, particularKeywords))
            .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    return Number(transaction.paidAmount) || 0;
}

function renderFilteredTransactionDashboard(transactions = [], filters = {}) {
    const total = transactions.reduce((sum, transaction) => {
        return sum + getTransactionLineTotal(transaction, filters.particular);
    }, 0);
    const dueTotal = transactions.reduce((sum, transaction) => sum + (Number(transaction.dueAmount) || 0), 0);

    document.getElementById('transactionsCollectedLabel').textContent = 'Filtered Total';
    document.getElementById('transactionsOutstandingLabel').textContent = 'Filtered Due';
    document.getElementById('transactionsReceiptsLabel').textContent = 'Receipts';
    document.getElementById('transactionsBalanceLabel').textContent = 'Net Balance';
    document.getElementById('transactionsCollectedPrefix').textContent = 'Rs. ';
    document.getElementById('transactionsOutstandingPrefix').textContent = 'Rs. ';
    document.getElementById('transactionsBalancePrefix').textContent = 'Rs. ';
    document.getElementById('transactionsCollected').textContent = formatTransactionsMoney(total);
    document.getElementById('transactionsOutstanding').textContent = formatTransactionsMoney(dueTotal);
    document.getElementById('transactionsReceipts').textContent = transactions.length;
    document.getElementById('transactionsBalance').textContent = formatTransactionsMoney(total - dueTotal);
}

function setupMonthFilter() {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const select = document.getElementById('filterMonth');
    select.innerHTML = `<option value="">All Months</option>${months.map((month) => `<option value="${month}">${month}</option>`).join('')}`;
}

function getTransactionPageSize() {
    return Number(document.getElementById('transactionsPageSize')?.value) || 25;
}

function updateTransactionsPagination(totalRows, startIndex, shownRows, totalPages) {
    const info = document.getElementById('transactionsPaginationInfo');
    const prev = document.getElementById('transactionsPrevPage');
    const next = document.getElementById('transactionsNextPage');

    if (!info || !prev || !next) return;

    if (!totalRows) {
        info.textContent = '0 rows';
        prev.disabled = true;
        next.disabled = true;
        return;
    }

    const from = startIndex + 1;
    const to = startIndex + shownRows;
    info.textContent = `${from}-${to} of ${totalRows} rows | Page ${feeTransactionCurrentPage} of ${totalPages}`;
    prev.disabled = feeTransactionCurrentPage <= 1;
    next.disabled = feeTransactionCurrentPage >= totalPages;
}

function setTransactionsPaginationVisible(isVisible) {
    const card = document.getElementById('transactionsPaginationCard');
    if (card) card.classList.toggle('d-none', !isVisible);
}

function renderTransactionPage() {
    renderTransactionsTable(feeTransactionRows);
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    const thead = document.getElementById('transactionsTableHead');
    const title = document.getElementById('transactionsTableTitle');
    const pageSize = getTransactionPageSize();
    const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));

    if (feeTransactionCurrentPage > totalPages) feeTransactionCurrentPage = totalPages;
    if (feeTransactionCurrentPage < 1) feeTransactionCurrentPage = 1;

    const startIndex = (feeTransactionCurrentPage - 1) * pageSize;
    const pageRows = transactions.slice(startIndex, startIndex + pageSize);

    setTransactionsPaginationVisible(true);
    if (title) title.textContent = 'Fee Transactions';

    thead.innerHTML = `
        <tr>
            <th>Date</th>
            <th>Admission No.</th>
            <th>Student</th>
            <th>Class</th>
            <th>Month</th>
            <th>Particulars</th>
            <th>Paid Amount</th>
            <th>Due Amount</th>
            <th>Mode</th>
            <th>Notes</th>
            <th>Receipt</th>
            <th>Actions</th>
        </tr>
    `;

    if (!transactions.length) {
        updateTransactionsPagination(0, 0, 0, 1);
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center text-muted py-4">No transactions found.</td>
            </tr>
        `;
        return;
    }

    updateTransactionsPagination(transactions.length, startIndex, pageRows.length, totalPages);

    tbody.innerHTML = pageRows.map((transaction) => `
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

function getClickedParticularRows(transactions = []) {
    const filters = getInitialTransactionFiltersFromUrl();
    const particularKeywords = getTransactionKeywords(filters.particular);

    return transactions.flatMap((transaction) => {
        const matchingItems = (transaction.lineItems || []).filter((item) => {
            if (!particularKeywords.length) return true;
            return transactionKeywordMatch(item.particular, particularKeywords);
        });

        return matchingItems.map((item) => ({
            transaction,
            particular: item.particular || filters.particular || '-',
            amount: Number(item.amount) || 0
        }));
    });
}

function renderClickedAmountDashboard(rows = []) {
    const filters = getInitialTransactionFiltersFromUrl();
    const total = rows.reduce((sum, row) => sum + row.amount, 0);

    document.getElementById('transactionsCollectedLabel').textContent = 'Total';
    document.getElementById('transactionsOutstandingLabel').textContent = 'Count';
    document.getElementById('transactionsReceiptsLabel').textContent = 'Session';
    document.getElementById('transactionsBalanceLabel').textContent = 'Particular';
    document.getElementById('transactionsCollectedPrefix').textContent = '';
    document.getElementById('transactionsOutstandingPrefix').textContent = '';
    document.getElementById('transactionsBalancePrefix').textContent = '';
    document.getElementById('transactionsCollected').textContent = formatTransactionsMoney(total);
    document.getElementById('transactionsOutstanding').textContent = rows.length;
    document.getElementById('transactionsReceipts').textContent = filters.session || '-';
    document.getElementById('transactionsBalance').textContent = filters.particular || 'All Particulars';
}

function renderClickedAmountDetails(transactions = []) {
    const tbody = document.getElementById('transactionsTableBody');
    const thead = document.getElementById('transactionsTableHead');
    const title = document.getElementById('transactionsTableTitle');
    const rows = getClickedParticularRows(transactions);
    const filters = getInitialTransactionFiltersFromUrl();

    setTransactionsPaginationVisible(false);
    renderClickedAmountDashboard(rows);
    if (title) {
        title.textContent = `${filters.particular || 'All Particulars'} Details${filters.month ? ` - ${filters.month}` : ''}`;
    }

    thead.innerHTML = `
        <tr>
            <th>Sl No.</th>
            <th>Adm No.</th>
            <th>Student Name</th>
            <th>Particular</th>
            <th>Date</th>
            <th class="text-end">Amount</th>
            <th>Receipt</th>
        </tr>
    `;

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">No detail found for the selected amount.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((row, index) => {
        const transaction = row.transaction || {};
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeTransactionsHtml(transaction.admissionNo || '-')}</td>
                <td>${escapeTransactionsHtml(transaction.studentName || '-')}</td>
                <td>${escapeTransactionsHtml(row.particular)}</td>
                <td>${new Date(transaction.receiptDate || transaction.createdAt).toLocaleDateString('en-IN')}</td>
                <td class="text-end">${formatTransactionsMoney(row.amount)}</td>
                <td>
                    <a href="fee-receipt.html?id=${encodeURIComponent(transaction._id || '')}" target="_blank" class="btn btn-sm btn-outline-primary">
                        View
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadTransactions(filters = {}) {
    const result = await API.fees.getTransactions({ limit: 500, ...filters });

    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch transactions');
    }

    if (isClickedAmountDetailMode()) {
        renderClickedAmountDetails(result.transactions || []);
    } else {
        feeTransactionRows = result.transactions || [];
        feeTransactionCurrentPage = 1;
        renderTransactionPage();
        if (hasActiveTransactionFilters(filters)) {
            renderFilteredTransactionDashboard(feeTransactionRows, filters);
        } else {
            await loadTransactionDashboard();
        }
    }
}

async function loadTransactionDashboard() {
    const result = await API.fees.getDashboard();
    if (result?.success) {
        renderTransactionDashboard(result.summary || {});
    }
}

function getTransactionFilters() {
    return {
        session: transactionSessionFilter,
        admissionNo: document.getElementById('filterAdmissionNo').value.trim(),
        studentName: document.getElementById('filterStudentName').value.trim(),
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
    applyInitialTransactionFilters();

    try {
        if (isClickedAmountDetailMode()) {
            await loadTransactions(getTransactionFilters());
        } else {
            await loadTransactions(getTransactionFilters());
        }
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
    document.getElementById('filterStudentName').addEventListener('input', scheduleLiveTransactionFilter);
    document.getElementById('transactionsPageSize').addEventListener('change', () => {
        feeTransactionCurrentPage = 1;
        renderTransactionPage();
    });
    document.getElementById('transactionsPrevPage').addEventListener('click', () => {
        feeTransactionCurrentPage -= 1;
        renderTransactionPage();
    });
    document.getElementById('transactionsNextPage').addEventListener('click', () => {
        feeTransactionCurrentPage += 1;
        renderTransactionPage();
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', async () => {
        transactionSessionFilter = '';
        document.getElementById('transactionFilterForm').reset();
        setupMonthFilter();
        try {
            await loadTransactions();
        } catch (error) {
            console.error(error);
        }
    });

    // Setup session dropdown and fee collection table
    await setupSessionDropdown();
    document.getElementById('sessionDropdown').addEventListener('change', loadFeeCollectionData);
    document.getElementById('exportToExcelBtn').addEventListener('click', exportToExcel);
});

async function setupSessionDropdown() {
    const dropdown = document.getElementById('sessionDropdown');
    dropdown.innerHTML = '<option value="">Loading sessions...</option>';

    try {
        const sessions = await API.sessions.getAll();
        const sessionNames = sessions
            .map((session) => typeof session === 'string' ? session : session.name)
            .filter(Boolean);
        const currentSession = sessions.find((session) => session?.isCurrent)?.name || sessionNames[0] || '';
        const initialFilters = getInitialTransactionFiltersFromUrl();

        dropdown.innerHTML = '<option value="">Select Session</option>' +
            sessionNames.map((session) => `<option value="${escapeTransactionsHtml(session)}">${escapeTransactionsHtml(session)}</option>`).join('');

        if (initialFilters.session && sessionNames.includes(initialFilters.session)) {
            dropdown.value = initialFilters.session;
            await loadFeeCollectionData();
        } else if (currentSession) {
            dropdown.value = currentSession;
            await loadFeeCollectionData();
        }
    } catch (error) {
        console.error('Session dropdown error:', error);
        dropdown.innerHTML = '<option value="">Unable to load sessions</option>';
    }
}

async function loadFeeCollectionData() {
    const selectedSession = document.getElementById('sessionDropdown').value;
    const tbody = document.getElementById('feeCollectionTableBody');
    const colspan = Math.max(1, feeCollectionParticulars.length + 1);
    
    if (!selectedSession) {
        feeCollectionParticulars = [];
        feeCollectionRows = [];
        visibleFeeCollectionParticulars = new Set();
        renderFeeCollectionHeader([]);
        tbody.innerHTML = `
            <tr>
                <td colspan="1" class="text-center text-muted py-4">Select a session to view fee collection data...</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = `
        <tr>
            <td colspan="${colspan}" class="text-center text-muted py-4">Loading fee collection data...</td>
        </tr>
    `;
    
    try {
        const result = await API.fees.getFeeCollectionBySession(selectedSession);
        if (result?.success) {
            feeCollectionParticulars = result.particulars || [];
            feeCollectionRows = result.feeCollectionData || [];
            visibleFeeCollectionParticulars = new Set(feeCollectionParticulars);
            renderFeeCollectionColumnControls(feeCollectionParticulars);
            renderFeeCollectionHeader(feeCollectionParticulars);
            renderFeeCollectionTable(feeCollectionRows, feeCollectionParticulars);
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colspan}" class="text-center text-danger py-4">Unable to load fee collection data</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading fee collection data:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center text-danger py-4">Error loading fee collection data</td>
            </tr>
        `;
    }
}

function getVisibleFeeCollectionParticulars(particulars = feeCollectionParticulars) {
    return particulars.filter((particular) => visibleFeeCollectionParticulars.has(particular));
}

function renderFeeCollectionColumnControls(particulars = []) {
    const container = document.getElementById('feeCollectionColumnControls');
    if (!container) return;

    if (!particulars.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="fw-bold me-2">Show Rows:</span>
            ${particulars.map((particular) => `
                <label class="form-check form-check-inline mb-0">
                    <input class="form-check-input fee-summary-column-toggle" type="checkbox" value="${escapeTransactionsHtml(particular)}" checked>
                    <span class="form-check-label">${escapeTransactionsHtml(particular)}</span>
                </label>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.fee-summary-column-toggle').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                visibleFeeCollectionParticulars.add(checkbox.value);
            } else {
                visibleFeeCollectionParticulars.delete(checkbox.value);
            }
            renderFeeCollectionHeader(feeCollectionParticulars);
            renderFeeCollectionTable(feeCollectionRows, feeCollectionParticulars);
        });
    });
}

function renderFeeCollectionHeader(particulars = []) {
    const thead = document.getElementById('feeCollectionTableHead');
    const months = feeCollectionRows.map((row) => row.month || '-');
    const columns = ['Particular', ...months, 'Total'];
    thead.innerHTML = `
        <tr>
            ${columns.map((column) => `<th>${escapeTransactionsHtml(column)}</th>`).join('')}
        </tr>
    `;
}

function buildFeeCollectionLink({ month = '', particular = '' } = {}) {
    const selectedSession = document.getElementById('sessionDropdown').value;
    const params = new URLSearchParams();
    if (selectedSession) params.set('session', selectedSession);
    if (month) params.set('collectionMonth', month);
    if (particular) params.set('particular', particular);
    return `fee-collection-details.html?${params.toString()}`;
}

function renderFeeCollectionAmount(value, filter = {}) {
    const amount = Number(value) || 0;
    if (amount === 0) {
        return '<span style="color: #999;">-</span>';
    }

    const label = `<strong>${formatTransactionsMoney(amount)}</strong>`;
    return `<a href="${buildFeeCollectionLink(filter)}" target="_blank" rel="noopener" class="text-decoration-none">${label}</a>`;
}

function renderFeeCollectionTable(feeCollectionData, particulars = []) {
    const tbody = document.getElementById('feeCollectionTableBody');
    const visibleParticulars = getVisibleFeeCollectionParticulars(particulars);
    const colspan = Math.max(1, feeCollectionData.length + 2);
    
    if (!particulars.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center text-muted py-4">No fee particulars found for this session</td>
            </tr>
        `;
        return;
    }

    if (!visibleParticulars.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center text-muted py-4">Select at least one row to view fee collection data</td>
            </tr>
        `;
        return;
    }
    
    const bodyRows = visibleParticulars.map((particular) => {
        const rowTotal = feeCollectionData.reduce((sum, monthData) => sum + (Number(monthData.particulars?.[particular]) || 0), 0);
        return `
        <tr>
            <td>${escapeTransactionsHtml(particular)}</td>
            ${feeCollectionData.map((monthData) => `<td>${renderFeeCollectionAmount(monthData.particulars?.[particular], { month: monthData.month, particular })}</td>`).join('')}
            <td>${renderFeeCollectionAmount(rowTotal, { particular })}</td>
        </tr>
    `;
    }).join('');

    const monthTotals = feeCollectionData.map((monthData) => {
        return visibleParticulars.reduce((sum, particular) => sum + (Number(monthData.particulars?.[particular]) || 0), 0);
    });
    const grandTotal = monthTotals.reduce((sum, amount) => sum + amount, 0);

    tbody.innerHTML = bodyRows + `
        <tr class="table-light fw-bold">
            <td>Total</td>
            ${feeCollectionData.map((monthData, index) => `<td>${renderFeeCollectionAmount(monthTotals[index], { month: monthData.month })}</td>`).join('')}
            <td>${renderFeeCollectionAmount(grandTotal)}</td>
        </tr>
    `;
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
        
        const particulars = summaryResult.particulars || [];
        const summaryRows = summaryResult.feeCollectionData || [];
        const months = summaryRows.map((row) => row.month || '-');
        const monthTotals = summaryRows.map((row) => particulars.reduce((sum, particular) => sum + (Number(row.particulars?.[particular]) || 0), 0));
        const summaryData = [
            ['Particular', ...months, 'Total'],
            ...particulars.map((particular) => {
                const rowTotal = summaryRows.reduce((sum, row) => sum + (Number(row.particulars?.[particular]) || 0), 0);
                return [
                    particular,
                    ...summaryRows.map((row) => row.particulars?.[particular] || 0),
                    rowTotal
                ];
            }),
            ['Total', ...monthTotals, monthTotals.reduce((sum, amount) => sum + amount, 0)]
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
