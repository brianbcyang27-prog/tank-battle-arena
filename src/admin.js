// Tank Battle Arena — Admin Panel
// Uses Firebase compat SDK (loaded via CDN script tags)

const ADMIN_EMAIL = 'brian.bcyang27@gmail.com';

const firebaseConfig = {
    apiKey: "AIzaSyDom3iJV-ad6I04J9Vq_RiBLIMsCUs0sHw",
    authDomain: "tank-battle-arena-897c0.firebaseapp.com",
    databaseURL: "https://tank-battle-arena-897c0-default-rtdb.firebaseio.com",
    projectId: "tank-battle-arena-897c0",
    storageBucket: "tank-battle-arena-897c0.firebasestorage.app",
    messagingSenderId: "392398447255",
    appId: "1:392398447255:web:8bbe8593daf60388c27fd2",
    measurementId: "G-YHY6BSQZGG"
};

let app, auth, db;
let currentUser = null;
let cachedData = { users: null, leaderboard: null, lobbies: null };
let cachedProgression = {}; // uid -> progression data
let userFilter = 'all'; // 'all' | 'real' | 'test'
let selectedUsers = new Set();

// ===================== INIT =====================
function init() {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth(app);
    db = firebase.database(app);

    auth.onAuthStateChanged(user => {
        currentUser = user;
        const loginScreen = document.getElementById('loginScreen');
        const dashboard = document.getElementById('dashboard');
        const loginError = document.getElementById('loginError');

        if (user && user.email === ADMIN_EMAIL) {
            loginScreen.style.display = 'none';
            dashboard.style.display = 'flex';
            document.getElementById('adminUserEmail').textContent = user.email;
            loadAllData();
            loadProgressionTab();
        } else if (user && user.email) {
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            loginError.textContent = 'Access denied. Signed in as ' + user.email + '. Only ' + ADMIN_EMAIL + ' can access.';
            auth.signOut();
        } else {
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            loginError.textContent = '';
        }
    });
}

window.adminSignIn = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(result => {
        const email = result.user.email;
        if (email !== ADMIN_EMAIL) {
            document.getElementById('loginError').textContent = 'Access denied. Only ' + ADMIN_EMAIL + ' can access this panel.';
            auth.signOut();
            return;
        }
        document.getElementById('loginError').textContent = '';
    }).catch(e => {
        if (e.code !== 'auth/popup-closed-by-user') {
            document.getElementById('loginError').textContent = 'Login failed: ' + e.message;
        }
    });
};

window.adminSignOut = function() {
    auth.signOut();
};

// ===================== CLEANUP TEST DATA =====================
window.cleanupTestData = function() {
    const testUids = Object.keys(cachedData.users).filter(isTestUid);
    const testLbUids = Object.keys(cachedData.leaderboard).filter(isTestUid);
    const allTestUids = new Set([...testUids, ...testLbUids]);

    if (allTestUids.size === 0) {
        showToast('No test data found to clean up.');
        return;
    }

    const confirmMsg = `Delete ${allTestUids.size} test ${allTestUids.size === 1 ? 'entry' : 'entries'}?\n` +
        `This will remove data from users, leaderboard, and progression.\n\n` +
        `Test UIDs:\n${[...allTestUids].slice(0, 10).join('\n')}${allTestUids.size > 10 ? `\n...and ${allTestUids.size - 10} more` : ''}\n\nThis cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    const promises = [];
    let deletedCount = 0;

    allTestUids.forEach(uid => {
        promises.push(db.ref('users/' + uid).remove());
        promises.push(db.ref('leaderboard/' + uid).remove());
        promises.push(db.ref('user_progression/' + uid).remove());
        deletedCount++;
        delete cachedData.users[uid];
        delete cachedData.leaderboard[uid];
        delete cachedProgression[uid];
    });

    Promise.all(promises).then(() => {
        showToast(`Deleted ${deletedCount} test ${deletedCount === 1 ? 'entry' : 'entries'}`);
        renderUsers();
        renderLeaderboard();
        renderOverview();
    }).catch(e => showToast('Cleanup failed: ' + e.message, true));
};

// ===================== TOAST =====================
function showToast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = isError ? 'error show' : 'show';
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ===================== TAB SWITCHING =====================
window.switchTab = function(name) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.dash-tab[data-tab="${name}"]`).classList.add('active');
    document.getElementById('panel-' + name).classList.add('active');
    if (name === 'users') renderUsers();
    if (name === 'leaderboard') renderLeaderboard();
    if (name === 'lobbies') renderLobbies();
    if (name === 'controls') loadControlsData();
};

// ===================== USER FILTER =====================
function isTestUid(uid) {
    return uid.startsWith('test_user_') || uid === 'debug_test_entry';
}

window.setUserFilter = function(filter) {
    userFilter = filter;
    document.querySelectorAll('.user-filter-btn').forEach(b => {
        b.style.background = b.dataset.filter === filter ? 'rgba(52,152,219,0.3)' : 'transparent';
        b.style.color = b.dataset.filter === filter ? '#f39c12' : '#999';
    });
    renderUsers();
};

// ===================== DATA LOADING =====================
function loadAllData() {
    const ref = db.ref('/');
    ref.once('value').then(snap => {
        const data = snap.val() || {};
        cachedData.users = data.users || {};
        cachedData.leaderboard = data.leaderboard || {};
        cachedData.lobbies = data.lobbies || {};
        renderOverview();
        renderUsers();
        renderLeaderboard();
        renderLobbies();
    }).catch(e => showToast('Failed to load data: ' + e.message, true));
}

// ===================== OVERVIEW =====================
function renderOverview() {
    const users = cachedData.users || {};
    const lb = cachedData.leaderboard || {};
    const lobbies = cachedData.lobbies || {};

    const uids = Object.keys(users);
    const realUids = uids.filter(uid => !isTestUid(uid));
    const testUids = uids.filter(isTestUid);
    const onlineCount = uids.filter(uid => users[uid].online === true).length;
    const activeLobbies = Object.keys(lobbies).filter(id => lobbies[id].status === 'waiting' || lobbies[id].status === 'playing').length;

    document.getElementById('statUsers').textContent = uids.length;
    document.getElementById('statOnline').textContent = onlineCount;
    document.getElementById('statLB').textContent = Object.keys(lb).length;
    document.getElementById('statLobbies').textContent = activeLobbies;

    // Show breakdown
    const infoEl = document.getElementById('overviewRecent');
    infoEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
            <div class="stat-card"><div class="num">${realUids.length}</div><div class="lbl">REAL USERS</div></div>
            <div class="stat-card"><div class="num">${testUids.length}</div><div class="lbl">TEST PROFILES</div></div>
            <div class="stat-card"><div class="num">${Object.keys(lb).length}</div><div class="lbl">LEADERBOARD</div></div>
        </div>
        <p style="color:#888;font-size:9px;letter-spacing:1px;margin-bottom:8px;">RECENT REAL USER LOGINS</p>
    `;

    const recent = uids
        .filter(uid => !isTestUid(uid))
        .map(uid => ({ uid, ...users[uid] }))
        .filter(u => u.lastLogin)
        .sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0))
        .slice(0, 5);

    if (recent.length) {
        let html = '<table class="data-table"><thead><tr><th>Email</th><th>Last Login</th></tr></thead><tbody>';
        recent.forEach(u => {
            const d = new Date(u.lastLogin).toLocaleString();
            html += `<tr><td>${esc(u.email || u.uid)}</td><td style="color:#666;font-size:8px;">${d}</td></tr>`;
        });
        html += '</tbody></table>';
        infoEl.innerHTML += html;
    } else {
        infoEl.innerHTML += '<p style="color:#555;">No recent logins</p>';
    }
}

// ===================== USERS =====================
window.renderUsers = function() {
    const users = cachedData.users || {};
    const query = (document.getElementById('usersSearch').value || '').toLowerCase();

    let uids = Object.keys(users);
    // Apply filter
    if (userFilter === 'real') uids = uids.filter(uid => !isTestUid(uid));
    else if (userFilter === 'test') uids = uids.filter(isTestUid);
    // Apply search
    if (query) {
        uids = uids.filter(uid => {
            const u = users[uid];
            return uid.toLowerCase().includes(query)
                || (u.email || '').toLowerCase().includes(query)
                || (u.name || '').toLowerCase().includes(query);
        });
    }
    uids.sort();

    // Prune selectedUsers of UIDs no longer in the filtered list
    selectedUsers.forEach(uid => { if (!uids.includes(uid)) selectedUsers.delete(uid); });
    updateBulkActionBar();

    let html = '';
    uids.forEach(uid => {
        const u = users[uid];
        const email = u.email || '—';
        const name = u.name || uid.slice(0, 12);
        const online = u.online;
        const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '—';
        const hasProg = cachedProgression[uid] ? 'Yes' : '—';
        const dotClass = online ? 'dot-online' : 'dot-offline';
        const isTest = isTestUid(uid);
        const rowBg = isTest ? 'style="opacity:0.5;"' : '';
        const checked = selectedUsers.has(uid) ? 'checked' : '';

        html += `<tr ${rowBg}>
            <td><input type="checkbox" class="user-checkbox" value="${uid}" ${checked} onchange="toggleUserSelection('${uid}', this.checked)" style="accent-color:#f39c12;"></td>
            <td class="id-cell">${isTest ? '🧪 ' : ''}${esc(uid.slice(0, 20))}…</td>
            <td>${esc(email)}</td>
            <td>${esc(name)}</td>
            <td><span class="${dotClass}"></span>${online ? 'Online' : 'Offline'}</td>
            <td style="font-size:8px;color:#666;">${lastLogin}</td>
            <td>${hasProg}</td>
            <td>
                <button class="btn-sm" onclick="viewUser('${uid}')">VIEW</button>
                <button class="btn-sm danger" onclick="deleteUser('${uid}')">DELETE</button>
            </td>
        </tr>`;
    });
    document.getElementById('usersBody').innerHTML = html || '<tr><td colspan="8" style="text-align:center;color:#555;padding:20px;">No users found.</td></tr>';
    // Sync select-all checkbox state
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = uids.length > 0 && selectedUsers.size === uids.length;
};

// ===================== MULTI-SELECT DELETE =====================
function updateBulkActionBar() {
    const bar = document.getElementById('bulkActionBar');
    const count = document.getElementById('bulkCount');
    if (selectedUsers.size > 0) {
        bar.style.display = 'flex';
        count.textContent = selectedUsers.size + ' SELECTED';
    } else {
        bar.style.display = 'none';
    }
}

window.toggleUserSelection = function(uid, checked) {
    if (checked) selectedUsers.add(uid);
    else selectedUsers.delete(uid);
    updateBulkActionBar();
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll && !checked) selectAll.checked = false;
};

window.toggleSelectAll = function(checked) {
    const users = cachedData.users || {};
    const query = (document.getElementById('usersSearch').value || '').toLowerCase();
    let uids = Object.keys(users);
    if (userFilter === 'real') uids = uids.filter(uid => !isTestUid(uid));
    else if (userFilter === 'test') uids = uids.filter(isTestUid);
    if (query) {
        uids = uids.filter(uid => {
            const u = users[uid];
            return uid.toLowerCase().includes(query)
                || (u.email || '').toLowerCase().includes(query)
                || (u.name || '').toLowerCase().includes(query);
        });
    }
    if (checked) uids.forEach(uid => selectedUsers.add(uid));
    else selectedUsers.clear();
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = checked);
    updateBulkActionBar();
};

window.clearSelection = function() {
    selectedUsers.clear();
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = false;
    updateBulkActionBar();
};

window.deleteSelectedUsers = function() {
    if (selectedUsers.size === 0) return;
    const count = selectedUsers.size;
    if (!confirm(`Delete ${count} selected user${count > 1 ? 's' : ''}?\nThis will remove data from users, leaderboard, and progression for all selected UIDs.\n\nThis cannot be undone.`)) return;

    const promises = [];
    selectedUsers.forEach(uid => {
        promises.push(db.ref('users/' + uid).remove());
        promises.push(db.ref('leaderboard/' + uid).remove());
        promises.push(db.ref('user_progression/' + uid).remove());
    });

    Promise.all(promises).then(() => {
        showToast(`Deleted ${count} user${count > 1 ? 's' : ''}`);
        selectedUsers.forEach(uid => {
            delete cachedData.users[uid];
            delete cachedData.leaderboard[uid];
            delete cachedProgression[uid];
        });
        selectedUsers.clear();
        updateBulkActionBar();
        renderUsers();
        renderLeaderboard();
        renderOverview();
    }).catch(e => showToast('Bulk delete failed: ' + e.message, true));
};

// Load a single user's progression data from Firebase
function loadUserProgressionData(uid) {
    return db.ref('user_progression/' + uid).once('value').then(snap => {
        const data = snap.val() || {};
        cachedProgression[uid] = data;
        return data;
    });
}

window.viewUser = function(uid) {
    const u = cachedData.users[uid] || {};
    const isTest = isTestUid(uid);

    // Load progression first, then show modal
    loadUserProgressionData(uid).then(prog => {
        let fields = Object.keys(u).filter(k => k !== 'profile' && k !== 'settings').map(k => {
            const val = typeof u[k] === 'object' ? JSON.stringify(u[k]) : u[k];
            return `<div class="field"><label>${k}</label><input id="editUser_${k}" value="${esc(String(val))}"></div>`;
        }).join('');

        // Profile editor
        let profileFields = '';
        if (u.profile) {
            profileFields = '<div style="margin-top:12px;border-top:1px solid #333;padding-top:10px;"><p style="color:#888;font-size:9px;letter-spacing:1px;margin-bottom:6px;">PROFILE</p>';
            Object.keys(u.profile).forEach(k => {
                const val = typeof u.profile[k] === 'object' ? JSON.stringify(u.profile[k]) : u.profile[k];
                profileFields += `<div class="field"><label>profile.${k}</label><input id="editUser_profile_${k}" value="${esc(String(val))}"></div>`;
            });
            profileFields += '</div>';
        }

        // Settings editor
        let settingsFields = '';
        if (u.settings) {
            settingsFields = '<div style="margin-top:12px;border-top:1px solid #333;padding-top:10px;"><p style="color:#888;font-size:9px;letter-spacing:1px;margin-bottom:6px;">SETTINGS</p>';
            Object.keys(u.settings).forEach(k => {
                const val = typeof u.settings[k] === 'object' ? JSON.stringify(u.settings[k]) : u.settings[k];
                settingsFields += `<div class="field"><label>settings.${k}</label><input id="editUser_settings_${k}" value="${esc(String(val))}"></div>`;
            });
            settingsFields += '</div>';
        }

        // Progression editor
        const p = prog || {};
        const progHtml = `<div style="margin-top:12px;border-top:1px solid #333;padding-top:10px;">
            <p style="color:#f39c12;font-size:9px;letter-spacing:1px;margin-bottom:6px;">PROGRESSION (gems, coins, upgrades)
                <span style="color:#666;font-weight:400;">— saved to Firebase, user gets on next reload</span>
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <div class="field"><label>Gems</label><input id="prog_gems" type="number" value="${p.gems || 0}"></div>
                <div class="field"><label>Coins</label><input id="prog_coins" type="number" value="${p.coins || 0}"></div>
                <div class="field"><label>XP</label><input id="prog_xp" type="number" value="${p.xp || 0}"></div>
                <div class="field"><label>Upgrade Points</label><input id="prog_upgradePoints" type="number" value="${p.upgradePoints || 0}"></div>
                <div class="field"><label>Speed</label><input id="prog_up_speed" type="number" value="${(p.upgrades && p.upgrades.speed) || 0}"></div>
                <div class="field"><label>Fuel</label><input id="prog_up_fuel" type="number" value="${(p.upgrades && p.upgrades.fuel) || 0}"></div>
                <div class="field"><label>Mine Radius</label><input id="prog_up_mineRadius" type="number" value="${(p.upgrades && p.upgrades.mineRadius) || 0}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                <div class="field"><label>Owned Skins (comma-sep)</label><input id="prog_ownedSkins" value="${(p.ownedSkins || ['classic']).join(', ')}"></div>
                <div class="field"><label>Equipped Skin</label><input id="prog_equippedSkin" value="${p.equippedSkin || 'classic'}"></div>
                <div class="field"><label>Owned Weapons (comma-sep)</label><input id="prog_ownedWeapons" value="${(p.ownedWeapons || ['standard']).join(', ')}"></div>
                <div class="field"><label>Equipped Weapon</label><input id="prog_equippedWeapon" value="${p.equippedWeapon || 'standard'}"></div>
            </div>
        </div>`;

        showModal(`Edit User${isTest ? ' 🧪' : ''}: ${uid.slice(0, 20)}…`, `
            ${fields}
            ${profileFields}
            ${settingsFields}
            ${progHtml}
            <div class="modal-actions">
                <button class="btn-sm" onclick="closeModal()">CANCEL</button>
                <button class="btn-sm success" onclick="saveUser('${uid}')">SAVE USER DATA</button>
                <button class="btn-sm success" onclick="saveUserProgression('${uid}')" style="border-color:#27ae60;background:rgba(39,174,96,0.15);">SAVE PROGRESSION</button>
            </div>
        `);
    }).catch(e => showToast('Error loading progression: ' + e.message, true));
};

window.saveUser = function(uid) {
    const fields = document.querySelectorAll('#modalContent [id^="editUser_"]');
    const update = {};
    fields.forEach(el => {
        if (el.id.startsWith('editUser_prog_') || el.id.startsWith('prog_')) return; // skip progression fields
        const key = el.id.replace('editUser_', '');
        const val = el.value;
        let parsed;
        try { parsed = JSON.parse(val); } catch(e) { parsed = val; }
        if (key.startsWith('profile_')) {
            if (!update.profile) update.profile = cachedData.users[uid].profile || {};
            update.profile[key.replace('profile_', '')] = parsed;
        } else if (key.startsWith('settings_')) {
            if (!update.settings) update.settings = cachedData.users[uid].settings || {};
            update.settings[key.replace('settings_', '')] = parsed;
        } else {
            update[key] = parsed;
        }
    });

    db.ref('users/' + uid).update(update).then(() => {
        showToast('User data saved');
        cachedData.users[uid] = { ...cachedData.users[uid], ...update };
        renderUsers();
        renderOverview();
    }).catch(e => showToast('Save failed: ' + e.message, true));
};

// Save progression data for any user to Firebase user_progression/<uid>
window.saveUserProgression = function(uid) {
    const getVal = (id) => parseInt(document.getElementById(id).value) || 0;
    const getStr = (id) => document.getElementById(id).value.trim();

    const existing = cachedProgression[uid] || {};
    const progression = { ...existing };

    progression.gems = getVal('prog_gems');
    progression.coins = getVal('prog_coins');
    progression.xp = getVal('prog_xp');
    progression.upgradePoints = getVal('prog_upgradePoints');
    progression.upgrades = {
        speed: getVal('prog_up_speed'),
        fuel: getVal('prog_up_fuel'),
        mineRadius: getVal('prog_up_mineRadius')
    };
    progression.ownedSkins = getStr('prog_ownedSkins').split(',').map(s => s.trim()).filter(Boolean);
    progression.equippedSkin = getStr('prog_equippedSkin');
    progression.ownedWeapons = getStr('prog_ownedWeapons').split(',').map(s => s.trim()).filter(Boolean);
    progression.equippedWeapon = getStr('prog_equippedWeapon');
    progression.updatedAt = Date.now();

    db.ref('user_progression/' + uid).set(progression).then(() => {
        showToast('Progression saved to Firebase for ' + uid.slice(0, 12));
        cachedProgression[uid] = progression;
        renderUsers();
    }).catch(e => showToast('Save failed: ' + e.message, true));
};

window.deleteUser = function(uid) {
    if (!confirm('Delete user ' + uid + ' and all their data? This cannot be undone.')) return;
    const promises = [
        db.ref('users/' + uid).remove(),
        db.ref('leaderboard/' + uid).remove(),
        db.ref('user_progression/' + uid).remove()
    ];
    Promise.all(promises).then(() => {
        showToast('User deleted');
        delete cachedData.users[uid];
        delete cachedData.leaderboard[uid];
        delete cachedProgression[uid];
        renderUsers();
        renderLeaderboard();
        renderOverview();
    }).catch(e => showToast('Delete failed: ' + e.message, true));
};

// ===================== LEADERBOARD =====================
window.renderLeaderboard = function() {
    const lb = cachedData.leaderboard || {};
    const query = (document.getElementById('lbSearch').value || '').toLowerCase();
    let uids = Object.keys(lb);
    if (query) {
        uids = uids.filter(uid => {
            const e = lb[uid];
            return uid.toLowerCase().includes(query)
                || (e.name || '').toLowerCase().includes(query);
        });
    }
    uids.sort((a, b) => (lb[b].score || 0) - (lb[a].score || 0));

    let html = '';
    uids.forEach((uid, i) => {
        const e = lb[uid];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        const isTest = isTestUid(uid);
        html += `<tr${isTest ? ' style="opacity:0.5;"' : ''}>
            <td class="id-cell">${medal} ${isTest ? '🧪 ' : ''}${esc(uid.slice(0, 20))}…</td>
            <td>${esc(e.name || '—')}</td>
            <td style="color:#27ae60;font-weight:700;">${(e.score || 0).toLocaleString()}</td>
            <td>Lv.${e.level || 1}</td>
            <td style="font-size:8px;color:#666;">${e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</td>
            <td>
                <button class="btn-sm" onclick="editLBEntry('${uid}')">EDIT</button>
                <button class="btn-sm danger" onclick="deleteLBEntry('${uid}')">DELETE</button>
            </td>
        </tr>`;
    });
    document.getElementById('lbBody').innerHTML = html || '<tr><td colspan="6" style="text-align:center;color:#555;padding:20px;">No leaderboard entries.</td></tr>';
};

window.editLBEntry = function(uid) {
    const e = cachedData.leaderboard[uid] || {};
    showModal('Edit Leaderboard Entry', `
        <div class="field"><label>Name</label><input id="lbEditName" value="${esc(e.name || '')}"></div>
        <div class="field"><label>Score</label><input id="lbEditScore" value="${e.score || 0}"></div>
        <div class="field"><label>Level</label><input id="lbEditLevel" value="${e.level || 1}"></div>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">CANCEL</button>
            <button class="btn-sm success" onclick="saveLBEntry('${uid}')">SAVE</button>
        </div>
    `);
};

window.saveLBEntry = function(uid) {
    const name = document.getElementById('lbEditName').value.trim();
    const score = parseInt(document.getElementById('lbEditScore').value) || 0;
    const level = parseInt(document.getElementById('lbEditLevel').value) || 1;
    const timestamp = cachedData.leaderboard[uid]?.timestamp || Date.now();

    db.ref('leaderboard/' + uid).set({ name, score, level, timestamp }).then(() => {
        showToast('Leaderboard entry saved');
        closeModal();
        if (!cachedData.leaderboard[uid]) cachedData.leaderboard[uid] = {};
        cachedData.leaderboard[uid] = { name, score, level, timestamp };
        renderLeaderboard();
        renderOverview();
    }).catch(e => showToast('Save failed: ' + e.message, true));
};

window.deleteLBEntry = function(uid) {
    if (!confirm('Delete leaderboard entry for ' + uid + '?')) return;
    db.ref('leaderboard/' + uid).remove().then(() => {
        showToast('Entry deleted');
        delete cachedData.leaderboard[uid];
        renderLeaderboard();
        renderOverview();
    }).catch(e => showToast('Delete failed: ' + e.message, true));
};

// ===================== PROGRESSION (self) =====================
function loadProgressionTab() {
    let P;
    try {
        const raw = localStorage.getItem('tankBattle_progression');
        P = raw ? JSON.parse(raw) : null;
    } catch(e) { P = null; }

    const fields = document.getElementById('progFields');
    const upgrades = document.getElementById('progUpgrades');
    const inventory = document.getElementById('progInventory');

    if (!P) {
        fields.innerHTML = '<p style="color:#666;">No local progression data found. Play a game first to create progression data.</p>';
        upgrades.innerHTML = '';
        inventory.innerHTML = '';
        return;
    }

    // Currency fields
    const currencyFields = ['gems', 'coins', 'xp', 'upgradePoints', 'highestSingleScore', 'totalKills', 'aiWins'];
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    currencyFields.forEach(key => {
        html += `<div class="field"><label>${key}</label>
            <input id="prog_${key}" type="number" value="${P[key] || 0}" style="width:100%;"
                onchange="saveProgressionField('${key}')"></div>`;
    });
    html += '</div>';
    fields.innerHTML = html;

    // Upgrade levels
    if (P.upgrades) {
        let uhtml = '<p style="color:#888;font-size:9px;letter-spacing:1px;margin-bottom:6px;">UPGRADES</p>';
        uhtml += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
        Object.keys(P.upgrades).forEach(key => {
            uhtml += `<div class="field" style="flex:1;min-width:80px;"><label>${key}</label>
                <input id="prog_upgrade_${key}" type="number" value="${P.upgrades[key] || 0}"
                    onchange="saveProgressionUpgrade('${key}')"></div>`;
        });
        uhtml += '</div>';
        upgrades.innerHTML = uhtml;
    }

    // Inventory
    let ihtml = '<p style="color:#888;font-size:9px;letter-spacing:1px;margin-bottom:6px;">INVENTORY</p>';
    ['ownedSkins', 'equippedSkin', 'ownedWeapons', 'equippedWeapon'].forEach(key => {
        const val = Array.isArray(P[key]) ? P[key].join(', ') : P[key];
        ihtml += `<div class="field"><label>${key}</label>
            <input id="prog_inv_${key}" value="${esc(val || '')}"
                onchange="saveProgressionInventory('${key}')"></div>`;
    });
    inventory.innerHTML = ihtml;
}

window.saveProgressionField = function(key) {
    const val = parseInt(document.getElementById('prog_' + key).value) || 0;
    updateLocalProgression(key, val);
};

window.saveProgressionUpgrade = function(key) {
    const val = parseInt(document.getElementById('prog_upgrade_' + key).value) || 0;
    const keyPath = 'upgrades.' + key;
    updateLocalProgression(keyPath, val);
};

window.saveProgressionInventory = function(key) {
    const raw = document.getElementById('prog_inv_' + key).value;
    let val;
    if (key === 'equippedSkin' || key === 'equippedWeapon') {
        val = raw.trim();
    } else {
        val = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    updateLocalProgression(key, val);
};

function updateLocalProgression(key, val) {
    try {
        const raw = localStorage.getItem('tankBattle_progression');
        const P = raw ? JSON.parse(raw) : {};
        const keys = key.split('.');
        if (keys.length === 1) {
            P[keys[0]] = val;
        } else {
            if (!P[keys[0]]) P[keys[0]] = {};
            P[keys[0]][keys[1]] = val;
        }
        localStorage.setItem('tankBattle_progression', JSON.stringify(P));
        showToast(key + ' = ' + val);
    } catch(e) {
        showToast('Save failed: ' + e.message, true);
    }
}

// ===================== LOBBIES =====================
function renderLobbies() {
    const lobbies = cachedData.lobbies || {};
    const ids = Object.keys(lobbies);
    ids.sort();

    let html = '';
    ids.forEach(id => {
        const l = lobbies[id];
        const playerCount = l.players ? Object.keys(l.players).length : 0;
        const players = l.players ? Object.keys(l.players).map(pid => l.players[pid].name || pid.slice(0, 8)).join(', ') : '—';
        html += `<tr>
            <td class="id-cell">${esc(id.slice(0, 24))}…</td>
            <td>${esc(l.code || '—')}</td>
            <td>${esc(l.mode || '—')}</td>
            <td>${esc(l.status || '—')}</td>
            <td>${playerCount} (${esc(players)})</td>
            <td>
                <button class="btn-sm danger" onclick="deleteLobby('${id}')">DELETE</button>
            </td>
        </tr>`;
    });
    document.getElementById('lobbiesBody').innerHTML = html || '<tr><td colspan="6" style="text-align:center;color:#555;padding:20px;">No lobbies.</td></tr>';
}

window.deleteLobby = function(id) {
    if (!confirm('Delete lobby ' + id + '?')) return;
    db.ref('lobbies/' + id).remove().then(() => {
        showToast('Lobby deleted');
        delete cachedData.lobbies[id];
        renderLobbies();
        renderOverview();
    }).catch(e => showToast('Delete failed: ' + e.message, true));
};

// ===================== CONTROLS =====================
window.loadControlsData = function() {
    const panel = document.getElementById('panel-controls');
    if (!panel || !panel.classList.contains('active')) return;
    document.getElementById('controlsBody').innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';

    db.ref('user_progression').once('value').then(snap => {
        const allProg = snap.val() || {};
        Object.keys(allProg).forEach(uid => { cachedProgression[uid] = allProg[uid]; });
        Object.keys(cachedData.users).forEach(uid => {
            if (!cachedProgression[uid]) cachedProgression[uid] = {};
        });
        renderControls();
    }).catch(e => {
        document.getElementById('controlsBody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:#e94560;padding:20px;">Error: ' + esc(e.message) + '</td></tr>';
    });
}

window.renderControls = function() {
    const users = cachedData.users || {};
    const query = (document.getElementById('controlsSearch').value || '').toLowerCase();

    let uids = Object.keys(users);
    if (query) {
        uids = uids.filter(uid => {
            const u = users[uid];
            return uid.toLowerCase().includes(query) || (u.name || '').toLowerCase().includes(query);
        });
    }
    uids.sort();

    const isTest = (uid) => uid.startsWith('test_user_') || uid === 'debug_test_entry';

    let html = '';
    uids.forEach(uid => {
        const u = users[uid];
        const name = u.name || uid.slice(0, 12);
        const p = cachedProgression[uid] || {};
        const test = isTest(uid);
        const rowStyle = test ? 'opacity:0.5;' : '';

        html += `<tr style="${rowStyle}">
            <td class="id-cell">${test ? '🧪 ' : ''}${esc(uid.slice(0, 20))}…</td>
            <td>${esc(name)}</td>
            <td><input class="ctrl-input" id="ctrl_${uid}_gems" type="number" value="${p.gems || 0}"></td>
            <td><input class="ctrl-input" id="ctrl_${uid}_coins" type="number" value="${p.coins || 0}"></td>
            <td><input class="ctrl-input" id="ctrl_${uid}_xp" type="number" value="${p.xp || 0}"></td>
            <td><input class="ctrl-input" id="ctrl_${uid}_speed" type="number" value="${(p.upgrades && p.upgrades.speed) || 0}"></td>
            <td><input class="ctrl-input" id="ctrl_${uid}_fuel" type="number" value="${(p.upgrades && p.upgrades.fuel) || 0}"></td>
            <td><input class="ctrl-input" id="ctrl_${uid}_mineRadius" type="number" value="${(p.upgrades && p.upgrades.mineRadius) || 0}"></td>
            <td><input class="ctrl-input" id="ctrl_${uid}_upgradePoints" type="number" value="${p.upgradePoints || 0}"></td>
            <td>
                <button class="btn-sm success" onclick="saveControl('${uid}')" style="border-color:#27ae60;">SAVE</button>
            </td>
        </tr>`;
    });

    document.getElementById('controlsBody').innerHTML = html || '<tr><td colspan="10" style="text-align:center;color:#555;padding:20px;">No users found.</td></tr>';
};

window.saveControl = function(uid) {
    const getNum = (id) => parseInt(document.getElementById(id).value) || 0;

    // Start from existing data so admin saves don't wipe out missions, stats, etc.
    const existing = cachedProgression[uid] || {};
    const progression = { ...existing };

    progression.gems = getNum('ctrl_' + uid + '_gems');
    progression.coins = getNum('ctrl_' + uid + '_coins');
    progression.xp = getNum('ctrl_' + uid + '_xp');
    progression.upgradePoints = getNum('ctrl_' + uid + '_upgradePoints');
    progression.upgrades = {
        speed: getNum('ctrl_' + uid + '_speed'),
        fuel: getNum('ctrl_' + uid + '_fuel'),
        mineRadius: getNum('ctrl_' + uid + '_mineRadius')
    };
    progression.updatedAt = Date.now();

    db.ref('user_progression/' + uid).set(progression).then(() => {
        showToast('Saved: ' + uid.slice(0, 12));
        cachedProgression[uid] = progression;
    }).catch(e => showToast('Save failed: ' + e.message, true));
};

// ===================== RAW DATA =====================
window.loadRaw = function() {
    const path = document.getElementById('rawPath').value.trim() || '/';
    const ref = db.ref(path);
    ref.once('value').then(snap => {
        const val = snap.val();
        document.getElementById('rawOutput').textContent = val ? JSON.stringify(val, null, 2) : '(empty / null)';
    }).catch(e => {
        document.getElementById('rawOutput').textContent = 'Error: ' + e.message;
    });
};

// ===================== MODAL =====================
let modalOverlay, modalContent;

function showModal(title, body) {
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'modalOverlay';
        modalOverlay.innerHTML = '<div class="modal-box"><h2 id="modalTitle"></h2><div id="modalContent"></div></div>';
        document.body.appendChild(modalOverlay);
        modalContent = document.getElementById('modalContent');
        modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
    }
    document.getElementById('modalTitle').textContent = title;
    modalContent.innerHTML = body;
    modalOverlay.classList.add('open');
}

window.closeModal = function() {
    if (modalOverlay) modalOverlay.classList.remove('open');
};

// ===================== HELPERS =====================
function esc(s) {
    if (typeof s !== 'string') return String(s || '');
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===================== START =====================
document.addEventListener('DOMContentLoaded', init);
