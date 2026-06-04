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
let _signingOut = false;
let _progUnsub = null;

onAuthStateChanged(auth, (user) => {
    G.currentUser = user;
    if (_progUnsub) { _progUnsub(); _progUnsub = null; }

    if (user) {
        log('info','AUTH','User logged in: ' + (user.email || 'guest'));
        // Clear local data on explicit sign-in to prevent cross-user data leaks.
        // Firebase sync will repopulate for the correct user.
        if (_explicitSignIn) {
            ['tankBattle_progression','tankBattle_campaign','tankBattle_lifetimeStats','tankBattle_personalBest','tankBattleLeaderboard'].forEach(k => {
                try { localStorage.removeItem(k); } catch(_) {}
            });
        }
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('loggedInPanel').style.display = 'flex';
        document.getElementById('homeTopBar').style.display = 'flex';
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
  }).catch(e => log('warn','AUTH','Failed to update user data: ' + e.message));
  onDisconnect(userRefInAuth).update({ online: false }).catch(e => log('warn','AUTH','Failed to set onDisconnect: ' + e.message));
  log('info','AUTH','User data saved to database');

        // Initialize friend system (generates code once on first sign-in)
  import('./friends.js').then(m => m.initFriendSystem()).then(code => {
    if (code) document.getElementById('homeFriendCode').textContent = code;
  }).catch(e => log('warn','AUTH','Friend system init failed: ' + e.message));

  get(ref(db, 'users/' + user.uid + '/profile')).then(snapshot => {
    if (!snapshot.exists()) {
      if (_explicitSignIn) {
        document.getElementById('loggedInPanel').style.display = 'none';
        document.getElementById('homeTopBar').style.display = 'none';
        document.getElementById('loginOverlay').classList.remove('active');
        document.getElementById('loginOverlay').classList.remove('overlay-home');
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
  }).catch(e => log('error','AUTH','Failed to load profile: ' + e.message));

        // Load persistent settings from Firebase
        get(ref(db, 'users/' + user.uid + '/settings')).then(snapshot => {
            if (snapshot.exists()) {
                const fbSettings = snapshot.val();
                G.settings = { ...G.settings, ...fbSettings };
                localStorage.setItem('tankBattleSettings', JSON.stringify(G.settings));
                import('./ui.js').then(m => m.applySettingsToUI()).catch(e => log('warn','AUTH','Apply settings UI failed: ' + e.message));
                log('info','AUTH','Settings loaded from Firebase');
            }
        }).catch(e => log('warn','AUTH','Failed to load settings: ' + e.message));

        // Reactive listener so admin Firebase edits propagate live to the game
        _progUnsub = onValue(ref(db, 'user_progression/' + user.uid), (snapshot) => {
            import('./progression.js').then(prog => {
                const P = prog.getPlayerData();
                if (snapshot.exists()) {
                    const fbProg = snapshot.val();
                    const localRaw = localStorage.getItem('tankBattle_progression');
                    const localProg = localRaw ? JSON.parse(localRaw) : {};
                    const merged = { ...localProg, ...fbProg };
                    if (fbProg.upgrades || localProg.upgrades) {
                        merged.upgrades = { ...(localProg.upgrades || {}), ...(fbProg.upgrades || {}) };
                    }
                    if (fbProg.ownedSkins) merged.ownedSkins = fbProg.ownedSkins;
                    if (fbProg.ownedWeapons) merged.ownedWeapons = fbProg.ownedWeapons;
                    localStorage.setItem('tankBattle_progression', JSON.stringify(merged));
                    Object.assign(P, merged);
                    // Sync campaign data to localStorage
                    if (fbProg.campaign) {
                        localStorage.setItem('tankBattle_campaign', JSON.stringify(fbProg.campaign));
                    }
                    // Sync lifetime stats to localStorage
                    if (fbProg.lifetimeStats) {
                        try {
                            const raw = localStorage.getItem('tankBattle_lifetimeStats');
                            const local = raw ? JSON.parse(raw) : {};
                            const mergedStats = { ...local, ...fbProg.lifetimeStats };
                            localStorage.setItem('tankBattle_lifetimeStats', JSON.stringify(mergedStats));
                        } catch(e) {}
                    }
    log('info','PROG','Progression live-synced from Firebase for ' + (user.email || user.uid));
    }
    import('./ui.js').then(m => m.updateCurrencyDisplay()).catch(e => log('warn','PROG','UI currency update failed: ' + e.message));
  });
        }, (err) => {
            log('warn','PROG','Progression listener error: ' + err.message);
        });
    } else {
        if (_signingOut) { log('info','AUTH','Signing out — not auto-signing as guest'); return; }
        log('info','AUTH','Showing login page');
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('loggedInPanel').style.display = 'none';
        document.getElementById('homeTopBar').style.display = 'none';
  document.getElementById('loginOverlay').classList.remove('overlay-home');
  import('./ui.js').then(m => m.showOverlay('loginOverlay')).catch(e => log('warn','AUTH','Show login overlay failed: ' + e.message));
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

let _signOutPending = false;
window.signOut = async function() {
  if (_signOutPending) return;
  _signOutPending = true;
  log('info','AUTH','User signing out');
  if (!G.currentUser) {
    log('warn','AUTH','No user — showing login page');
    try {
      document.getElementById('loginForm').style.display = 'flex';
      document.getElementById('loggedInPanel').style.display = 'none';
      document.getElementById('homeTopBar').style.display = 'none';
    } catch(e) {}
    import('./ui.js').then(m => m.showOverlay('loginOverlay')).catch(() => {}).finally(() => { _signOutPending = false; });
    return;
  }
  if (G.lobbyId) window.leaveLobby();
  // Clean up friend listeners before signing out
  import('./friends.js').then(m => {
    m.stopListeningFriendRequests();
    m.stopListeningFriends();
    m.stopListeningInvitations();
    m.resetFriendSystem();
  }).catch(() => {});
  try {
    _signingOut = true;
    const userRef = ref(db, 'users/' + G.currentUser.uid);
    await update(userRef, { online: false });
    await fbSignOut(auth);
    G.currentUser = null;
    G.friendCode = null;
    G.friendUids = [];
    log('info','AUTH','Sign out successful');
    import('./ui.js').then(m => m.showOverlay('loginOverlay')).catch(e => log('warn','AUTH','Show login overlay failed: ' + e.message));
    _signingOut = false;
    _signOutPending = false;
  } catch(e) {
    log('error','AUTH','Sign out failed: ' + e.message);
    _signingOut = false;
    _signOutPending = false;
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

// Save local progression to Firebase on page unload — so admin edits via the
// PROGRESSION tab (which writes to localStorage) are persisted to the server.
// This is a best-effort save (unload handlers don't support await).
window.addEventListener('beforeunload', () => {
    const u = G.currentUser;
    if (!u) return;
    try {
        const raw = localStorage.getItem('tankBattle_progression');
        if (raw) {
            const prog = JSON.parse(raw);
            // Merge lifetime stats for admin visibility
            try {
                const statsRaw = localStorage.getItem('tankBattle_lifetimeStats');
                if (statsRaw) {
                    prog.lifetimeStats = JSON.parse(statsRaw);
                }
            } catch(_) {}
    // Don't block unload — fire and forget
    // NOTE: campaign is intentionally NOT merged here. saveCampaignData() in
    // progression.js already syncs campaign to Firebase on level completion.
    // Merging it here would overwrite admin edits with stale local data on refresh.
    set(ref(db, 'user_progression/' + u.uid), prog).catch(e => log('warn','AUTH','beforeunload progression save failed: ' + e.message));
        }
    } catch (e) {
        // silently ignore — unload handlers must not throw
    }
});

window.saveProfile = async function() {
    const displayName = document.getElementById('profileDisplayName').value.trim();
    const birthday = document.getElementById('profileBirthday').value;
    const gender = document.getElementById('profileGender').value;
    const errorEl = document.getElementById('profileError');

    if (!displayName) {
        errorEl.textContent = 'Please enter your display name';
        errorEl.style.display = 'block';
        return;
    }
    if (!birthday) {
        errorEl.textContent = 'Please select your birthday';
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';

    const profile = {
        displayName: displayName,
        birthday: birthday,
        gender: gender || 'prefer-not',
        createdAt: Date.now()
    };

    try {
        await Promise.all([
            set(ref(db, 'users/' + G.currentUser.uid + '/profile'), profile),
            update(ref(db, 'users/' + G.currentUser.uid), { name: displayName }),
            updateProfile(G.currentUser, { displayName: displayName })
        ]);
        G.userProfile = profile;
        document.getElementById('displayName').textContent = displayName;
        const avatarEl = document.getElementById('homeAvatar');
        if (avatarEl) avatarEl.textContent = displayName[0].toUpperCase();
        const pp = document.getElementById('profileOverlay');
        pp.style.display = 'none';
        pp.classList.remove('active');
        document.getElementById('loginOverlay').classList.add('active');
        document.getElementById('loggedInPanel').style.display = 'flex';
        document.getElementById('homeTopBar').style.display = 'flex';
        import('./ui.js').then(m => m.updateCurrencyDisplay()).catch(e => log('warn','AUTH','UI update after profile save failed: ' + e.message));
        import('./tutorial.js').then(m => m.autoShowTutorial()).catch(e => log('warn','AUTH','Tutorial auto-show failed: ' + e.message));
        log('info','AUTH','Profile saved successfully');
    } catch(e) {
        errorEl.textContent = 'Failed to save: ' + e.message;
        errorEl.style.display = 'block';
        log('error','AUTH','Profile save failed: ' + e.message);
    }
};
