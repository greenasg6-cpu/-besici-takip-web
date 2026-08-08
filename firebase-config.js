'use strict';

const firebaseConfig = {
  apiKey: 'AIzaSyDaffJ4jeok5JEZ2Evp-_jVjpYZs8cwnnY',
  authDomain: 'besicitakip.firebaseapp.com',
  projectId: 'besicitakip',
  storageBucket: 'besicitakip.firebasestorage.app',
  messagingSenderId: '755298650596',
  appId: '1:755298650596:web:d6fe1b42be39aa27965ff1',
  measurementId: 'G-XB04L3VESM',
};

let auth = null;
let db = null;
let storage = null;
window.firebaseReady = false;

try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  window.firebaseReady = true;
} catch (e) {
  console.warn('Firebase baslatilamadi (offline olabilir):', e);
}
