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

// Listen for all chat rooms
db.ref("/chats").on("child_added", (roomSnapshot) => {
    const roomId = roomSnapshot.key;
    const messagesRef = db.ref(`/chats/${roomId}/messages`);
    
    let isInitialLoad = true;

    // Listen for new messages inside this specific room
    messagesRef.limitToLast(1).on("child_added", async (msgSnapshot) => {
        if (isInitialLoad) return; 

        const messageData = msgSnapshot.val();
        const senderId = messageData.senderId; 
        const text = messageData.text; 
        const senderName = messageData.senderUsername || "Someone";
        
        if (!senderId || !text) return;

        // Figure out the receiver by splitting the Room ID
        const ids = roomId.split("_");
        const receiverId = (ids[0] === senderId) ? ids[1] : ids[0];
        
        if (!receiverId) return;

        try {
            // Fetch the receiver's push token
            const userSnap = await db.ref(`/users/${receiverId}/fcmToken`).once('value');
            const fcmToken = userSnap.val();

            if (fcmToken) {
                await admin.messaging().send({
                    notification: { 
                        title: `New Message from ${senderName}`, 
                        body: text 
                    },
                    token: fcmToken
                });
                console.log(`Notification successfully sent to ${receiverId} in room ${roomId}`);
            } else {
                console.log(`User ${receiverId} does not have an FCM token saved.`);
            }
        } catch (error) { 
            console.error("Failed to send notification:", error); 
        }
    });

    // Ignore old messages loaded on boot
    setTimeout(() => { isInitialLoad = false; }, 5000);
});

// Required for Render to keep the server alive
app.get("/", (req, res) => res.send("YesJi Server is Active & Watching Deep Chats"));
app.listen(process.env.PORT || 3000, () => console.log("Server listening for nested messages..."));
