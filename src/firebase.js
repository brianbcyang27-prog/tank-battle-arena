import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, signInAnonymously, updateProfile, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase, ref, set, push, get, onValue, off, update, remove, serverTimestamp, query, orderByChild, limitToLast, onDisconnect, child, equalTo } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export {
    getDatabase, ref, set, push, get, onValue, off, update, remove, serverTimestamp, query, orderByChild, limitToLast, onDisconnect, child, equalTo
};

import { log } from './log.js';
import { G } from './state.js';

// ==================== FIREBASE CONFIG ====================
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

let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    log('info','FIREBASE','Firebase initialized successfully');
} catch(e) {
    log('error','FIREBASE','Firebase init failed: ' + e.message);
}

export { auth, db };

// ==================== AUTH ====================
// Track whether the login was from an explicit user action vs session restore
let _explicitSignIn = false;

onAuthStateChanged(auth, (user) => {
    G.currentUser = user;
    if (user) {
        log('info','AUTH','User logged in: ' + (user.email || 'guest'));
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('loggedInPanel').style.display = 'flex';
        document.getElementById('loginOverlay').classList.add('overlay-home');
        import('./ui.js').then(m => m.updateCurrencyDisplay());
        const dispName = user.email || user.displayName || 'Player';
        document.getElementById('displayName').textContent = dispName;
        const avatarEl = document.getElementById('homeAvatar');
        if (avatarEl) avatarEl.textContent = (dispName)[0].toUpperCase();

        const userRefInAuth = ref(db, 'users/' + user.uid);
        update(userRefInAuth, {
            email: user.email || (user.displayName ? user.displayName + '@guest.local' : 'guest@local'),
            lastLogin: Date.now(),
            online: true
        });
        onDisconnect(userRefInAuth).update({ online: false });
        log('info','AUTH','User data saved to database');

        // Initialize friend system (generates code once on first sign-in)
        import('./friends.js').then(m => m.initFriendSystem()).then(code => {
            if (code) document.getElementById('homeFriendCode').textContent = code;
        });

        get(ref(db, 'users/' + user.uid + '/profile')).then(snapshot => {
            if (!snapshot.exists()) {
                if (_explicitSignIn) {
                    document.getElementById('loggedInPanel').style.display = 'none';
                    const po = document.getElementById('profileOverlay');
                    po.style.display = 'flex';
                    po.classList.add('active');
                    log('info','AUTH','New user — showing profile setup');
                } else {
                    log('info','AUTH','Session restored — user has no profile, skipping overlay');
                }
                _explicitSignIn = false;
            } else {
                G.userProfile = snapshot.val();
                _explicitSignIn = false;
            }
        });

        // Load persistent settings from Firebase
        get(ref(db, 'users/' + user.uid + '/settings')).then(snapshot => {
            if (snapshot.exists()) {
                const fbSettings = snapshot.val();
                G.settings = { ...G.settings, ...fbSettings };
                localStorage.setItem('tankBattleSettings', JSON.stringify(G.settings));
                import('./ui.js').then(m => m.applySettingsToUI());
                log('info','AUTH','Settings loaded from Firebase');
            }
        }).catch(e => log('warn','AUTH','Failed to load settings: ' + e.message));
    } else {
        log('info','AUTH','No user signed in');
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('loggedInPanel').style.display = 'none';
        document.getElementById('loginOverlay').classList.remove('overlay-home');
        const poEl = document.getElementById('profileOverlay');
        poEl.style.display = 'none';
        poEl.classList.remove('active');
        document.getElementById('displayName').textContent = '';
        const avatarEl2 = document.getElementById('homeAvatar');
        if (avatarEl2) avatarEl2.textContent = 'P';
        const codeEl = document.getElementById('homeFriendCode');
        if (codeEl) codeEl.textContent = '—';
    }
});

window.signUp = async function() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('authError');

    if (!email || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        errorDiv.style.display = 'block';
        log('warn','AUTH','Sign up attempt with missing fields');
        return;
    }

    errorDiv.style.display = 'none';
    log('info','AUTH','Attempting sign up: ' + email);

    try {
        _explicitSignIn = true;
        await createUserWithEmailAndPassword(auth, email, password);
        log('info','AUTH','Sign up successful: ' + email);
    } catch(e) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = 'block';
        log('error','AUTH','Sign up failed: ' + e.message);
    }
};

window.signIn = async function() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('authError');

    if (!email || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        errorDiv.style.display = 'block';
        log('warn','AUTH','Login attempt with missing fields');
        return;
    }

    errorDiv.style.display = 'none';
    log('info','AUTH','Attempting login: ' + email);

    try {
        _explicitSignIn = true;
        await signInWithEmailAndPassword(auth, email, password);
        log('info','AUTH','Login successful: ' + email);
    } catch(e) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = 'block';
        log('error','AUTH','Login failed: ' + e.message);
    }
};

window.signOut = async function() {
    log('info','AUTH','User signing out');
    if (G.lobbyId) window.leaveLobby();
    try {
        const userRef = ref(db, 'users/' + G.currentUser.uid);
        await update(userRef, { online: false });
        await fbSignOut(auth);
        log('info','AUTH','Sign out successful');
    } catch(e) {
        log('error','AUTH','Sign out failed: ' + e.message);
    }
};

let _guestSigningIn = false;
window.signInAsGuest = async function(){
    if (_guestSigningIn) { log('warn','AUTH','Guest sign-in already in progress, ignoring'); return; }
    _guestSigningIn = true;
    const btn = document.getElementById('guestSignInBtn');
    if (btn) btn.disabled = true;
    const errorDiv = document.getElementById('authError');
    errorDiv.style.display = 'none';
    const nameInput = document.getElementById('guestNameInput');
    const name = nameInput ? nameInput.value.trim() : 'Guest';
    if(!name) { errorDiv.textContent = 'Please enter a name'; errorDiv.style.display = 'block'; _guestSigningIn = false; if(btn) btn.disabled = false; return; }
    log('info','AUTH','Attempting guest sign-in with name: '+name);
    try {
        _explicitSignIn = true;
        const result = await signInAnonymously(auth);
        const userRef = ref(db, 'users/'+result.user.uid);
        await set(userRef, { name: name, email: name+'@guest.local', createdAt: serverTimestamp() });
        await updateProfile(result.user, { displayName: name });
        log('info','AUTH','Guest sign-in successful: '+result.user.uid);
    } catch(e) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = 'block';
        log('error','AUTH','Guest sign-in failed: '+e.message);
    } finally {
        _guestSigningIn = false;
        if (btn) btn.disabled = false;
    }
};

window.signInWithGoogle = async function() {
    const provider = new GoogleAuthProvider();
    const errorDiv = document.getElementById('authError');
    errorDiv.style.display = 'none';
    log('info','AUTH','Attempting Google sign-in');
    try {
        _explicitSignIn = true;
        const result = await signInWithPopup(auth, provider);
        log('info','AUTH','Google sign-in successful: ' + result.user.email);
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user') {
            errorDiv.textContent = e.message;
            errorDiv.style.display = 'block';
            log('error','AUTH','Google sign-in failed: ' + e.message);
        }
    }
};

window.saveProfile = async function() {
    const birthday = document.getElementById('profileBirthday').value;
    const gender = document.getElementById('profileGender').value;
    const errorEl = document.getElementById('profileError');

    if (!birthday) {
        errorEl.textContent = 'Please select your birthday';
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';

    const profile = {
        birthday: birthday,
        gender: gender || 'prefer-not',
        createdAt: Date.now()
    };

    try {
        await set(ref(db, 'users/' + G.currentUser.uid + '/profile'), profile);
        G.userProfile = profile;
        const pp = document.getElementById('profileOverlay');
        pp.style.display = 'none';
        pp.classList.remove('active');
        document.getElementById('loggedInPanel').style.display = 'flex';
        import('./ui.js').then(m => m.updateCurrencyDisplay());
        log('info','AUTH','Profile saved successfully');
    } catch(e) {
        errorEl.textContent = 'Failed to save: ' + e.message;
        errorEl.style.display = 'block';
        log('error','AUTH','Profile save failed: ' + e.message);
    }
};
