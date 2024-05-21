// firebase-config.js
const firebaseConfig = {
    databaseURL: "https://voice-noter-default-rtdb.europe-west1.firebasedatabase.app",
  };
  
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  