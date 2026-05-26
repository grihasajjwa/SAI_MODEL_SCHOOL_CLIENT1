let salaryEmployees = [];
let editingSalaryEmployeeId = null;

function formatSalaryMoney(value) {
    return (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeSalaryHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function showSalaryEmployeeMessage(message) {
    const box = document.getElementById('salaryEmployeeMessage');
    box.textContent = message;
    box.classList.remove('d-none');
}

function hideSalaryEmployeeMessage() {
    const box = document.getElementById('salaryEmployeeMessage');
    box.textContent = '';
    box.classList.add('d-none');
}

function calculateEmployeeNet() {
    const basic = Number(document.getElementById('salaryBasic').value) || 0;
    const allowances = Number(document.getElementById('salaryAllowances').value) || 0;
    const deductions = Number(document.getElementById('salaryDeductions').value) || 0;
    document.getElementById('salaryNetPreview').value = `Rs. ${formatSalaryMoney(basic + allowances - deductions)}`;
}

function getSalaryEmployeePayload() {
    return {
        employeeType: document.getElementById('salaryEmployeeType').value,
        code: document.getElementById('salaryEmployeeCode').value.trim(),
        name: document.getElementById('salaryEmployeeName').value.trim(),
        designation: document.getElementById('salaryEmployeeDesignation').value.trim(),
        phone: document.getElementById('salaryEmployeePhone').value.trim(),
        basicSalary: Number(document.getElementById('salaryBasic').value) || 0,
        allowances: Number(document.getElementById('salaryAllowances').value) || 0,
        deductions: Number(document.getElementById('salaryDeductions').value) || 0,
        bankName: document.getElementById('salaryBankName').value.trim(),
        accountNo: document.getElementById('salaryAccountNo').value.trim(),
        isActive: document.getElementById('salaryEmployeeStatus').value === 'true'
    };
}

function setSalaryEmployeeFormMode() {
    document.getElementById('salaryEmployeeFormTitle').innerHTML = editingSalaryEmployeeId
        ? '<i class="fas fa-pen-to-square me-2"></i>Edit Teacher / Staff'
        : '<i class="fas fa-user-plus me-2"></i>Add Teacher / Staff';
    document.getElementById('saveSalaryEmployeeBtn').innerHTML = editingSalaryEmployeeId
        ? '<i class="fas fa-pen me-2"></i>Update Employee'
        : '<i class="fas fa-save me-2"></i>Save Employee';
    document.getElementById('cancelSalaryEmployeeEditBtn').classList.toggle('d-none', !editingSalaryEmployeeId);
}

function populateSalaryEmployeeForm(employee = {}) {
    editingSalaryEmployeeId = employee._id || null;
    document.getElementById('salaryEmployeeType').value = employee.employeeType || 'Teacher';
    document.getElementById('salaryEmployeeCode').value = employee.code || '';
    document.getElementById('salaryEmployeeStatus').value = employee.isActive === false ? 'false' : 'true';
    document.getElementById('salaryEmployeeName').value = employee.name || '';
    document.getElementById('salaryEmployeeDesignation').value = employee.designation || '';
    document.getElementById('salaryEmployeePhone').value = employee.phone || '';
    document.getElementById('salaryBasic').value = employee.basicSalary || 0;
    document.getElementById('salaryAllowances').value = employee.allowances || 0;
    document.getElementById('salaryDeductions').value = employee.deductions || 0;
    document.getElementById('salaryBankName').value = employee.bankName || '';
    document.getElementById('salaryAccountNo').value = employee.accountNo || '';
    calculateEmployeeNet();
    setSalaryEmployeeFormMode();
}

function resetSalaryEmployeeForm() {
    editingSalaryEmployeeId = null;
    document.getElementById('salaryEmployeeForm').reset();
    document.getElementById('salaryBasic').value = 0;
    document.getElementById('salaryAllowances').value = 0;
    document.getElementById('salaryDeductions').value = 0;
    document.getElementById('salaryEmployeeStatus').value = 'true';
    calculateEmployeeNet();
    hideSalaryEmployeeMessage();
    setSalaryEmployeeFormMode();
}

function getFilteredSalaryEmployees() {
    const type = document.getElementById('salaryEmployeeTypeFilter').value;
    const status = document.getElementById('salaryEmployeeStatusFilter').value;
    const search = document.getElementById('salaryEmployeeSearch').value.trim().toLowerCase();
    return salaryEmployees.filter((employee) => {
        const typeMatches = !type || employee.employeeType === type;
        const statusMatches =
            status === 'all' ||
            (status === 'active' && employee.isActive !== false) ||
            (status === 'inactive' && employee.isActive === false);
        const haystack = `${employee.name || ''} ${employee.code || ''} ${employee.designation || ''}`.toLowerCase();
        const searchMatches = !search || haystack.includes(search);
        return typeMatches && statusMatches && searchMatches;
    });
}

function updateSalaryEmployeeStats() {
    const active = salaryEmployees.filter((employee) => employee.isActive !== false);
    document.getElementById('salaryTotalEmployees').textContent = active.length;
    document.getElementById('salaryTotalTeachers').textContent = active.filter((employee) => employee.employeeType === 'Teacher').length;
    document.getElementById('salaryTotalStaff').textContent = active.filter((employee) => employee.employeeType === 'Staff').length;
}

function renderSalaryEmployees() {
    const tbody = document.getElementById('salaryEmployeeTableBody');
    const detailsTbody = document.getElementById('salaryEmployeeDetailsTableBody');
    const employees = getFilteredSalaryEmployees();
    updateSalaryEmployeeStats();

    if (!employees.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No teachers or staff found.</td></tr>';
        if (detailsTbody) {
            detailsTbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">No staff details found.</td></tr>';
        }
        return;
    }

    tbody.innerHTML = employees.map((employee) => {
        const net = (Number(employee.basicSalary) || 0) + (Number(employee.allowances) || 0) - (Number(employee.deductions) || 0);
        return `
            <tr>
                <td><span class="badge ${employee.employeeType === 'Teacher' ? 'bg-primary' : 'bg-secondary'}">${employee.employeeType}</span></td>
                <td><span class="badge ${employee.isActive === false ? 'bg-danger' : 'bg-success'}">${employee.isActive === false ? 'Inactive' : 'Active'}</span></td>
                <td class="fw-semibold">${escapeSalaryHtml(employee.name || '-')}</td>
                <td>${escapeSalaryHtml(employee.designation || '-')}</td>
                <td class="text-end">Rs. ${formatSalaryMoney(net)}</td>
                <td>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary edit-salary-employee-btn" data-employee-id="${employee._id}" title="Edit"><i class="fas fa-pen"></i></button>
                        ${employee.isActive === false
                            ? `<button type="button" class="btn btn-sm btn-outline-success activate-salary-employee-btn" data-employee-id="${employee._id}" title="Activate"><i class="fas fa-check"></i></button>`
                            : `<button type="button" class="btn btn-sm btn-outline-danger delete-salary-employee-btn" data-employee-id="${employee._id}" data-employee-name="${escapeSalaryHtml(employee.name || '-')}" title="Make inactive"><i class="fas fa-ban"></i></button>`}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (detailsTbody) {
        detailsTbody.innerHTML = employees.map((employee) => `
            <tr>
                <td><span class="badge ${employee.employeeType === 'Teacher' ? 'bg-primary' : 'bg-secondary'}">${employee.employeeType}</span></td>
                <td><span class="badge ${employee.isActive === false ? 'bg-danger' : 'bg-success'}">${employee.isActive === false ? 'Inactive' : 'Active'}</span></td>
                <td class="fw-semibold">${escapeSalaryHtml(employee.name || '-')}</td>
                <td>${escapeSalaryHtml(employee.designation || '-')}</td>
                <td>${escapeSalaryHtml(employee.code || '-')}</td>
                <td>${escapeSalaryHtml(employee.phone || '-')}</td>
                <td>${escapeSalaryHtml(employee.bankName || '-')}</td>
                <td>${escapeSalaryHtml(employee.accountNo || '-')}</td>
                <td class="text-end">Rs. ${formatSalaryMoney(employee.basicSalary || 0)}</td>
                <td class="text-end">Rs. ${formatSalaryMoney(employee.allowances || 0)}</td>
                <td class="text-end">Rs. ${formatSalaryMoney(employee.deductions || 0)}</td>
            </tr>
        `).join('');
    }

    document.querySelectorAll('.edit-salary-employee-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const employee = salaryEmployees.find((item) => item._id === button.dataset.employeeId);
            if (employee) populateSalaryEmployeeForm(employee);
        });
    });

    document.querySelectorAll('.delete-salary-employee-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            if (!window.confirm(`Mark ${button.dataset.employeeName} as inactive?`)) return;
            try {
                const result = await API.salary.deleteEmployee(button.dataset.employeeId);
                if (!result?.success) throw new Error(result?.message || 'Unable to make employee inactive');
                await loadSalaryEmployees();
            } catch (error) {
                showSalaryEmployeeMessage(error.message || 'Unable to make employee inactive');
            }
        });
    });

    document.querySelectorAll('.activate-salary-employee-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const employee = salaryEmployees.find((item) => item._id === button.dataset.employeeId);
            if (!employee) return;
            try {
                const result = await API.salary.updateEmployee(employee._id, { ...employee, isActive: true });
                if (!result?.success) throw new Error(result?.message || 'Unable to activate employee');
                await loadSalaryEmployees();
            } catch (error) {
                showSalaryEmployeeMessage(error.message || 'Unable to activate employee');
            }
        });
    });
}

async function loadSalaryEmployees() {
    const result = await API.salary.getEmployees({ includeInactive: true });
    salaryEmployees = result?.success ? (result.employees || []) : [];
    renderSalaryEmployees();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }
    if (!Auth.canManageSalary()) {
        alert('Only admin can access salary staff.');
        window.location.href = 'cashbook.html';
        return;
    }

    resetSalaryEmployeeForm();
    await loadSalaryEmployees();

    ['salaryBasic', 'salaryAllowances', 'salaryDeductions'].forEach((id) => {
        document.getElementById(id).addEventListener('input', calculateEmployeeNet);
    });

    document.getElementById('salaryEmployeeForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        hideSalaryEmployeeMessage();
        const payload = getSalaryEmployeePayload();
        if (!payload.name) {
            showSalaryEmployeeMessage('Name is required.');
            return;
        }

        try {
            const result = editingSalaryEmployeeId
                ? await API.salary.updateEmployee(editingSalaryEmployeeId, payload)
                : await API.salary.saveEmployee(payload);
            if (!result?.success) throw new Error(result?.message || 'Unable to save employee');
            resetSalaryEmployeeForm();
            await loadSalaryEmployees();
        } catch (error) {
            showSalaryEmployeeMessage(error.message || 'Unable to save employee');
        }
    });

    document.getElementById('salaryEmployeeFilterForm').addEventListener('submit', (event) => {
        event.preventDefault();
        renderSalaryEmployees();
    });
    document.getElementById('salaryEmployeeSearch').addEventListener('input', renderSalaryEmployees);
    document.getElementById('salaryEmployeeTypeFilter').addEventListener('change', renderSalaryEmployees);
    document.getElementById('salaryEmployeeStatusFilter').addEventListener('change', renderSalaryEmployees);
    document.getElementById('resetSalaryEmployeeFilterBtn').addEventListener('click', () => {
        document.getElementById('salaryEmployeeFilterForm').reset();
        renderSalaryEmployees();
    });
    document.getElementById('cancelSalaryEmployeeEditBtn').addEventListener('click', resetSalaryEmployeeForm);
});
