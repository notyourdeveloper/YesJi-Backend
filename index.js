// Run a reminder check every 4 hours (14400000 milliseconds)
setInterval(async () => {
    console.log("Running unread messages sweep...");
    try {
        const chatsSnap = await db.ref("/chats").once("value");
        const chats = chatsSnap.val() || {};
        
        // Keep track of unread counts per user
        const unreadData = {};

        // Loop through all rooms and messages
        Object.keys(chats).forEach(roomId => {
            const messages = chats[roomId].messages || {};
            
            Object.values(messages).forEach(msg => {
                // Find messages that have not been seen
                if (msg.seen === false && msg.senderId) {
                    const ids = roomId.split("_");
                    const receiverId = (ids[0] === msg.senderId) ? ids[1] : ids[0];
                    
                    if (receiverId) {
                        if (!unreadData[receiverId]) {
                            unreadData[receiverId] = { msgCount: 0, chatRooms: new Set() };
                        }
                        unreadData[receiverId].msgCount += 1;
                        unreadData[receiverId].chatRooms.add(roomId);
                    }
                }
            });
        });

        // Send out the summary notifications
        for (const [userId, data] of Object.entries(unreadData)) {
            const userSnap = await db.ref(`/users/${userId}/fcmToken`).once('value');
            const fcmToken = userSnap.val();
            
            if (fcmToken) {
                const roomCount = data.chatRooms.size;
                const chatWord = roomCount === 1 ? "chat" : "chats";
                const msgWord = data.msgCount === 1 ? "message" : "messages";
                
                await admin.messaging().send({
                    notification: { 
                        title: "Missed Messages on YesJi", 
                        body: `You have ${data.msgCount} unread ${msgWord} in ${roomCount} ${chatWord}.` 
                    },
                    token: fcmToken
                });
                console.log(`Sent reminder to ${userId}`);
            }
        }
    } catch (error) {
        console.error("Reminder Error:", error);
    }
}, 14400000); // 4 hours in milliseconds
