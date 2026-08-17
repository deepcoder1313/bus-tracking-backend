import { Expo } from "expo-server-sdk";

console.log("🔥 NEW NOTIFICATION SERVICE LOADED");

const expo = new Expo();

export async function sendPushNotification(
  token,
  title,
  body,
  data = {}
) {
  console.log("🔥🔥 NEW sendPushNotification VERSION");
  console.log("📱 Token:", token);
  console.log("📝 Title:", title);
  console.log("📝 Body:", body);

  // Check token
  if (!Expo.isExpoPushToken(token)) {
    console.log("❌ INVALID EXPO PUSH TOKEN:", token);
    return;
  }

  const messages = [
    {
      to: token,
      sound: "default",
      title,
      body,
      data,
    },
  ];

  console.log("📦 Message prepared:", messages);

  try {
    const chunks = expo.chunkPushNotifications(messages);

    console.log("📦 Number of chunks:", chunks.length);

    for (const chunk of chunks) {
      console.log("📤 Sending chunk to Expo...");

      const tickets = await expo.sendPushNotificationsAsync(chunk);

      console.log(
        "📨 EXPO TICKETS:",
        JSON.stringify(tickets, null, 2)
      );

      // Check ticket errors
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          console.log("❌ EXPO ERROR:", ticket.message);
          console.log(
            "❌ EXPO ERROR DETAILS:",
            JSON.stringify(ticket.details, null, 2)
          );
        }
      }

      // Get successful ticket IDs
      const ticketIds = tickets
        .filter((ticket) => ticket.status === "ok")
        .map((ticket) => ticket.id);

      console.log("🎫 Ticket IDs:", ticketIds);

      if (ticketIds.length === 0) {
        console.log("❌ No successful ticket IDs");
        continue;
      }

      // Wait before checking receipts
      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      console.log("🔎 Checking Expo receipts...");

      const receipts =
        await expo.getPushNotificationReceiptsAsync(
          ticketIds
        );

      console.log(
        "🧾 EXPO RECEIPTS:",
        JSON.stringify(receipts, null, 2)
      );
    }

    console.log("✅ Notification process completed");

  } catch (error) {
    console.log(
      "🔥 PUSH SERVICE ERROR:",
      error
    );

    console.log(
      "🔥 PUSH ERROR MESSAGE:",
      error?.message
    );

    console.log(
      "🔥 PUSH ERROR STACK:",
      error?.stack
    );
  }
}