import { G } from './state.js';
import { log } from './log.js';
import { db, ref, set, get, update, remove, serverTimestamp, onValue, off, query, orderByChild, equalTo } from './firebase.js';

const CODE_LENGTH = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
}

export async function ensureFriendCode(uid) {
  const userSnap = await get(ref(db, 'users/' + uid + '/friendCode'));
  if (userSnap.exists()) return userSnap.val();

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const codeRef = ref(db, 'friendCodes/' + code);
    const codeSnap = await get(codeRef);
    if (!codeSnap.exists()) {
      // Use set with a prior check to avoid race: if another user wrote it since our get, this will fail
      // We rely on Firebase security rules or the retry loop to handle the rare collision
      await set(codeRef, uid);
      // Verify we actually own it (in case of race)
      const verifySnap = await get(codeRef);
      if (verifySnap.val() === uid) {
        await update(ref(db, 'users/' + uid), { friendCode: code });
        return code;
      }
      // Another user won the race — retry
      log('warn', 'FRIENDS', 'Friend code collision on attempt ' + attempt + ', retrying');
    }
  }
  throw new Error('Could not generate unique friend code');
}

// ==================== FRIEND REQUESTS ====================

export async function sendFriendRequest(code) {
    const c = code.toUpperCase().trim();
    if (!c || c.length !== CODE_LENGTH) throw new Error('Enter a valid 6-character friend code');

    const uidSnap = await get(ref(db, 'friendCodes/' + c));
    if (!uidSnap.exists()) throw new Error('No player found with that code');
    const targetUid = uidSnap.val();
    if (targetUid === G.currentUser.uid) throw new Error('Cannot add yourself as a friend');

    const friendSnap = await get(ref(db, 'friends/' + G.currentUser.uid + '/' + targetUid));
    if (friendSnap.exists()) throw new Error('Already friends with this player');

    const reqId = G.currentUser.uid + '_' + targetUid;
    const existingSnap = await get(ref(db, 'friendRequests/' + reqId));
    if (existingSnap.exists()) {
        const existing = existingSnap.val();
        if (existing.status === 'accepted') throw new Error('Already friends');
        if (existing.status === 'pending') throw new Error('Friend request already sent');
    }

  await set(ref(db, 'friendRequests/' + reqId), {
    from: G.currentUser.uid,
    to: targetUid,
    fromName: G.currentUser.displayName || G.currentUser.email || 'Player',
    fromCode: c,
    status: 'pending',
    createdAt: serverTimestamp()
  }).catch(e => {
    log('error', 'FRIENDS', 'Failed to send friend request: ' + e.message);
    throw e;
  });
    log('info', 'FRIENDS', 'Friend request sent to ' + targetUid);
}

export async function respondToFriendRequest(fromUid, accept) {
  const reqId = fromUid + '_' + G.currentUser.uid;
  const status = accept ? 'accepted' : 'declined';
  await update(ref(db, 'friendRequests/' + reqId), { status }).catch(e => {
    log('error', 'FRIENDS', 'Failed to update friend request status: ' + e.message);
    throw e;
  });

  if (accept) {
    await set(ref(db, 'friends/' + G.currentUser.uid + '/' + fromUid), true).catch(e => {
      log('error', 'FRIENDS', 'Failed to add friend (self): ' + e.message);
      throw e;
    });
    await set(ref(db, 'friends/' + fromUid + '/' + G.currentUser.uid), true).catch(e => {
      log('error', 'FRIENDS', 'Failed to add friend (other): ' + e.message);
      throw e;
    });
    log('info', 'FRIENDS', 'Friend request accepted from ' + fromUid);
  }
}

// ==================== QUERIES ====================

let _requestListener = null;
export function listenFriendRequests(callback) {
    if (_requestListener) { off(_requestListener.ref, 'value', _requestListener.handler); }
    const reqRef = query(ref(db, 'friendRequests'), orderByChild('to'), equalTo(G.currentUser.uid));
  const handler = onValue(reqRef, snapshot => {
    const requests = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const val = child.val();
        if (val.status === 'pending') requests.push({ id: child.key, ...val });
      });
    }
    callback(requests);
  });
    _requestListener = { ref: reqRef, handler };
}

export function stopListeningFriendRequests() {
    if (_requestListener) {
        off(_requestListener.ref, 'value', _requestListener.handler);
        _requestListener = null;
    }
}

let _friendsListener = null;
export function listenFriends(callback) {
    if (_friendsListener) { off(_friendsListener.ref, 'value', _friendsListener.handler); }
    const friendsRef = ref(db, 'friends/' + G.currentUser.uid);
  const handler = onValue(friendsRef, async snapshot => {
    const friendUids = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => friendUids.push(child.key));
    }
        const friendList = [];
        for (const uid of friendUids) {
            try {
                const userSnap = await get(ref(db, 'users/' + uid));
                if (userSnap.exists()) {
                    const d = userSnap.val();
                    friendList.push({ uid, name: d.name || d.email || 'Unknown', friendCode: d.friendCode || '—', online: d.online || false });
                }
            } catch (e) { log('warn', 'FRIENDS', 'Failed to lookup friend ' + uid + ': ' + e.message); }
        }
        callback(friendList);
    });
    _friendsListener = { ref: friendsRef, handler };
}

export function stopListeningFriends() {
    if (_friendsListener) {
        off(_friendsListener.ref, 'value', _friendsListener.handler);
        _friendsListener = null;
    }
}

// ==================== LOBBY INVITES ====================

export async function inviteToLobby(friendUid, lobbyId, roomCode, mode) {
  await set(ref(db, 'invitations/' + friendUid + '/' + G.currentUser.uid), {
    from: G.currentUser.uid,
    fromName: G.currentUser.displayName || G.currentUser.email || 'Player',
    lobbyId: lobbyId,
    roomCode: roomCode,
    mode: mode,
    createdAt: serverTimestamp()
  }).catch(e => {
    log('error', 'INVITE', 'Failed to send lobby invite: ' + e.message);
    throw e;
  });
  log('info', 'INVITE', 'Invited friend to lobby');
}

export async function clearInvitation(fromUid) {
  await remove(ref(db, 'invitations/' + G.currentUser.uid + '/' + fromUid)).catch(e => {
    log('warn', 'INVITE', 'Failed to clear invitation: ' + e.message);
  });
}

let _invitationListener = null;
export function listenInvitations(callback) {
    if (!G.currentUser) return;
    if (_invitationListener) { off(_invitationListener.ref, 'value', _invitationListener.handler); }
    const invRef = ref(db, 'invitations/' + G.currentUser.uid);
  const handler = onValue(invRef, snapshot => {
    const invites = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        invites.push({ from: child.key, ...child.val() });
      });
    }
    callback(invites);
  });
    _invitationListener = { ref: invRef, handler };
}

export function stopListeningInvitations() {
    if (_invitationListener) {
        off(_invitationListener.ref, 'value', _invitationListener.handler);
        _invitationListener = null;
    }
}

// ==================== INIT ====================

let _initialized = false;
export async function initFriendSystem() {
  if (!G.currentUser || _initialized) return;
  _initialized = true;
  try {
    const code = await ensureFriendCode(G.currentUser.uid);
    G.friendCode = code;
    log('info', 'FRIENDS', 'Your friend code: ' + code);
    return code;
  } catch (e) {
    log('warn', 'FRIENDS', 'Failed to init friend system: ' + e.message);
  }
}

export function resetFriendSystem() {
  _initialized = false;
  stopListeningFriendRequests();
  stopListeningFriends();
  stopListeningInvitations();
}
