const express = require("express");
const admin = require("firebase-admin");
const app = express();

// Securely load credentials from Render's Environment Variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "yesji-fbd31",
    clientEmail: process.env.CLIENT_EMAIL,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: "https://yesji-fbd31-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();
const messagesRef = db.ref("/chats"); // <--- MAKE SURE THIS MATCHES YOUR DATABASE

let isInitialLoad = true;

messagesRef.limitToLast(1).on("child_added", async (snapshot) => {
  if (isInitialLoad) return; 

  const data = snapshot.val();
  const receiverId = data.receiver; 
  const messageText = data.message; 
  
  if (!receiverId) return;

  try {
      const userSnap = await db.ref(`/users/${receiverId}/fcmToken`).once('value');
      const fcmToken = userSnap.val();

      if (fcmToken) {
          await admin.messaging().send({
              notification: { title: "New Message on YesJi", body: messageText || "You have a new message" },
              token: fcmToken
          });
          console.log("Notification sent to", receiverId);
      }
  } catch (error) { console.error(error); }
});

setTimeout(() => { isInitialLoad = false; }, 5000);

// Required for Render to keep the server alive
app.get("/", (req, res) => res.send("YesJi Server is Active"));
app.listen(process.env.PORT || 3000, () => console.log("Server listening..."));
