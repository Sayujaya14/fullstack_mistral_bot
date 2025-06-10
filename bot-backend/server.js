const axios = require('axios');
const readline = require('readline');
const { MongoClient } = require('mongodb');

// MongoDB connection URI and DB name
const mongoUrl = "mongodb://localhost:27017";
const dbName = "cred";

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
async function connectMongo() {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  console.log("✅ Connected to MongoDB");
  return client;
}

async function verifyUser(db, username, password) {
  const user = await db.collection('users').findOne({ username, password });
  return user !== null;
}

async function saveConversation(db, username, chatHistory) {
  await db.collection('conversations').insertOne({
    username,
    chat: chatHistory,
    startedAt: chatHistory[0]?.timestamp || new Date(),
    endedAt: new Date()
  });
}

// Helper to prompt user with promise
function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function chatLoop(db, username) {
  const chatHistory = [];

  while (true) {
    const userPrompt = await askQuestion("\nYou: ");

    if (userPrompt.toLowerCase() === 'exit') {
      console.log("👋 Ending chat session...");
      break;
    }

    const modelName = "mistralai/mistral-7b-instruct:free";
    const headers = {
      "Authorization": "Bearer ",  // Put your API key here
      "Content-Type": "application/json"
    };

    const payload = {
      model: modelName,
      messages: [{ role: "user", content: userPrompt }]
    };

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        payload,
        { headers }
      );

      if (response.status === 200) {
        const aiResponse = response.data.choices[0].message.content;
        console.log("AI:", aiResponse);

        chatHistory.push({
          prompt: userPrompt,
          response: aiResponse,
          timestamp: new Date()
        });
      } else {
        console.log("❌ Error:", response.status);
      }
    } catch (err) {
      console.log("❌ Request error:", err.message);
    }
  }

  // Save entire conversation
  if (chatHistory.length > 0) {
    await saveConversation(db, username, chatHistory);
    console.log("💾 Conversation saved.");
  } else {
    console.log("⚠️ No chat to save.");
  }
}

async function main() {
  const client = await connectMongo();
  const db = client.db(dbName);

  try {
    const username = await askQuestion("Username: ");
    const password = await askQuestion("Password: ");

    const isValidUser = await verifyUser(db, username, password);
    if (!isValidUser) {
      console.log("❌ Invalid credentials.");
      rl.close();
      await client.close();
      return;
    }

    console.log(`✅ Welcome, ${username}! Type 'exit' to quit.`);

    await chatLoop(db, username);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    rl.close();
    await client.close();
  }
}

main();
