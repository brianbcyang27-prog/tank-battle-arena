import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, signInAnonymously, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase, ref, set, push, get, onValue, off, update, remove, serverTimestamp, query, orderByChild, limitToLast, onDisconnect, child } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, fbSignOut as signOut, onAuthStateChanged, signInAnonymously, updateProfile,
    getDatabase, ref, set, push, get, onValue, off, update, remove, serverTimestamp, query, orderByChild, limitToLast, onDisconnect, child
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
onAuthStateChanged(auth, (user) => {
    G.currentUser = user;
    if (user) {
        log('info','AUTH','User logged in: ' + user.email);
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('loggedInPanel').style.display = 'flex';
        document.getElementById('displayName').textContent = user.email;

        const userRefInAuth = ref(db, 'users/' + user.uid);
        set(userRefInAuth, {
            email: user.email,
            lastLogin: Date.now(),
            online: true
        });
        onDisconnect(userRefInAuth).update({ online: false });
        log('info','AUTH','User data saved to database');
    } else {
        log('info','AUTH','No user signed in');
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('loggedInPanel').style.display = 'none';
        document.getElementById('displayName').textContent = '';
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

window.signInAsGuest = async function(){
    const errorDiv = document.getElementById('authError');
    errorDiv.style.display = 'none';
    const nameInput = document.getElementById('guestNameInput');
    const name = nameInput ? nameInput.value.trim() : 'Guest';
    if(!name) { errorDiv.textContent = 'Please enter a name'; errorDiv.style.display = 'block'; return; }
    log('info','AUTH','Attempting guest sign-in with name: '+name);
    try {
        const result = await signInAnonymously(auth);
        const userRef = ref(db, 'users/'+result.user.uid);
        await set(userRef, { name: name, email: name+'@guest.local', createdAt: serverTimestamp() });
        await updateProfile(result.user, { displayName: name });
        log('info','AUTH','Guest sign-in successful: '+result.user.uid);
    } catch(e) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = 'block';
        log('error','AUTH','Guest sign-in failed: '+e.message);
    }
};
