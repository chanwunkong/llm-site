const firebaseConfig = {
    apiKey: "AIzaSyAI5lx2XT3ysBhTREBW637s_AlWC49LYJQ",
    authDomain: "test-5dbba.firebaseapp.com",
    projectId: "test-5dbba",
    storageBucket: "test-5dbba.firebasestorage.app",
    messagingSenderId: "878665537417",
    appId: "1:878665537417:web:0c5b32f6a01ff9df803358"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('user-info');
const syncStatus = document.getElementById('sync-status');

loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("登入失敗：" + err.message));
};
logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user) => {
    if (user) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        userInfo.textContent = `已登入：${user.email}`;
        await loadMetadata();
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        userInfo.textContent = '未登入 (進度僅儲存於本機)';
        syncStatus.textContent = '';
        await loadMetadata();
    }
});
