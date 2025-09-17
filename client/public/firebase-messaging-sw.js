// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js");

firebase.initializeApp({
    apiKey: "AIzaSyBrTgvnzTDErEcUYajR9yX6h8As8F2tT2s",
    authDomain: "diff-8b0c9.firebaseapp.com",
    projectId: "diff-8b0c9",
    storageBucket: "diff-8b0c9.firebasestorage.app",
    messagingSenderId: "604856083137",
    appId: "1:604856083137:web:229c1f85d8cbd87daeaa40",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

    const notificationTitle = payload.data?.title || "알림";
    const notificationOptions = {
        body: payload.data?.body || "내용 없음",
        icon: "/icon.png",
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});