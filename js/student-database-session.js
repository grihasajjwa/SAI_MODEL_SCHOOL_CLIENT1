// Load sessions when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
});

window.__sessionListCache = [];

function getPreferredSession(sessionList = []) {
    if (!Array.isArray(sessionList) || sessionList.length === 0) return '';

    const currentSession = sessionList.find(session => session?.isCurrent);
    if (currentSession) return currentSession.name || currentSession;

    const activeSession = sessionList.find(session => session?.active);
    if (activeSession) return activeSession.name || activeSession;

    const firstSession = sessionList[0];
    return firstSession?.name || firstSession || '';
}

function populateSessionSelect(selectId, sessionList, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;

    const placeholder = selectId === 'studentSessionFilter' ? 'Select Session' : 'Select Session';
    select.innerHTML = `<option value="">${placeholder}</option>`;

    sessionList.forEach(session => {
        const value = session.name || session;
        select.appendChild(new Option(value, value));
    });

    if (selectedValue) {
        select.value = selectedValue;
    }
}

// Session Management Functions
async function loadSessions() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/sessions`, {
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load sessions');
        }

        const sessions = await response.json();
        console.log('Sessions data:', sessions);

        // Update session dropdown in import form
        const sessionList = sessions.sessions || sessions;
        window.__sessionListCache = sessionList;
        const preferredSession = getPreferredSession(sessionList);

        populateSessionSelect('session', sessionList, document.getElementById('session')?.value || preferredSession);
        populateSessionSelect('studentSessionFilter', sessionList, document.getElementById('studentSessionFilter')?.value || preferredSession);
        populateSessionSelect('newSession', sessionList, document.getElementById('newSession')?.value || preferredSession);
        populateSessionSelect('bulkPreviousSession', sessionList, document.getElementById('bulkPreviousSession')?.value || preferredSession);
        populateSessionSelect('bulkNewSession', sessionList, document.getElementById('bulkNewSession')?.value || preferredSession);

        const studentSessionFilter = document.getElementById('studentSessionFilter');
        if (studentSessionFilter) {
            studentSessionFilter.dispatchEvent(new Event('change'));
        }

        // Update sessions list in modal
        updateSessionsList(sessionList);
        document.dispatchEvent(new CustomEvent('sessions:updated', {
            detail: {
                sessions: sessionList,
                preferredSession
            }
        }));
    } catch (error) {
        console.error('Error loading sessions:', error);
        alert('Error loading sessions: ' + error.message);
    }
}

function updateSessionsList(sessions) {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;

    sessionsList.innerHTML = '';
    
    if (sessions.length === 0) {
        sessionsList.innerHTML = '<p class="text-muted">No sessions found</p>';
        return;
    }

    sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'd-flex justify-content-between align-items-center p-2 border-bottom';
        sessionDiv.innerHTML = `
            <div>
                <strong>${session.name || session}</strong>
                <small class="text-muted">${session.isCurrent ? 'Current Session' : (session.active ? 'Active' : 'Inactive')}</small>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-success" onclick="setCurrentSession('${session.name || session}')">Set Current</button>
                <button class="btn btn-sm btn-outline-primary" onclick="editSession('${session._id}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteSession('${session._id}')">Delete</button>
            </div>
        `;
        sessionsList.appendChild(sessionDiv);
    });
}

// Save new session
document.getElementById('saveSessionBtn').addEventListener('click', async () => {
    const sessionName = document.getElementById('newSessionName').value.trim();
    const sessionStatus = document.getElementById('newSessionStatus').value;
    const startDate = document.getElementById('newSessionStartDate').value;
    const endDate = document.getElementById('newSessionEndDate').value;

    if (!sessionName) {
        alert('Please enter session name');
        return;
    }

    try {
        const shouldSetAsCurrent = !(window.__sessionListCache || []).some(session => {
            const sessionName = (session?.name || session || '').trim().toLowerCase();
            return sessionName && sessionName !== 'default' && session?.isCurrent;
        });

        const response = await fetch(`${CONFIG.API_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: sessionName,
                active: sessionStatus === 'active',
                isCurrent: shouldSetAsCurrent,
                startDate: startDate || null,
                endDate: endDate || null
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to save session');
        }

        alert('Session saved successfully!');
        document.getElementById('sessionForm').reset();
        const sessionModalEl = document.getElementById('sessionModal');
        const modal = bootstrap.Modal.getInstance(sessionModalEl) || new bootstrap.Modal(sessionModalEl);
        modal.hide();
        loadSessions(); // Reload sessions list
    } catch (error) {
        console.error('Error saving session:', error);
        alert('Error saving session: ' + error.message);
    }
});

// Edit session (placeholder function)
function editSession(sessionId) {
    // This would typically open a modal with session data
    alert('Edit session functionality coming soon!');
}

// Delete session
async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to delete session');
        }

        alert('Session deleted successfully!');
        loadSessions(); // Reload sessions list
    } catch (error) {
        console.error('Error deleting session:', error);
        alert('Error deleting session: ' + error.message);
    }
}

async function setCurrentSession(sessionName) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/sessions/current`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: sessionName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to set current session');
        loadSessions();
    } catch (error) {
        console.error('Error setting current session:', error);
        alert('Error setting current session: ' + error.message);
    }
}
