const axios = require('axios');
const readline = require('readline');
const { MongoClient } = require('mongodb');

// MongoDB connection URI and DB name
const mongoUrl = "mongodb://localhost:27017";
const dbName = "cred"; // change to your DB name

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB client once
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

async function saveChat(db, username, prompt, response) {
  await db.collection('chat').insertOne({
    username,
    prompt,
    response,
    timestamp: new Date()
  });
}

async function main() {
  const client = await connectMongo();
  const db = client.db(dbName);

  // Ask for username and password first
  rl.question('Username: ', (username) => {
    rl.question('Password: ', async (password) => {
      const isValidUser = await verifyUser(db, username, password);
      if (!isValidUser) {
        console.log("❌ Invalid username or password. Exiting.");
        rl.close();
        await client.close();
        return;
      }
      console.log("✅ User verified.");

      // Now ask for prompt
      rl.question('Enter your prompt for text generation: ', async (userPrompt) => {
        const modelName = "mistralai/mistral-7b-instruct:free";
        const headers = {
          "Authorization": "Bearer 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",  // Put your API key here
          "Content-Type": "application/json"
        };

        const payload = {
          model: modelName,
          messages: [
            { role: "user", content: userPrompt }
          ]
        };

        try {
          const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            payload,
            { headers }
          );

          if (response.status === 200) {
            const aiResponse = response.data.choices[0].message.content;
            console.log("\nAI Response:");
            console.log(aiResponse);

            // Save chat record
            await saveChat(db, username, userPrompt, aiResponse);
          } else {
            console.log("❌ Error:", response.status);
            console.log("Response:", response.data);
          }
        } catch (error) {
          if (error.response) {
            console.log("❌ Error:", error.response.status);
            console.log("Response:", error.response.data);
          } else {
            console.log("❌ Request error:", error.message);
          }
        } finally {
          rl.close();
          await client.close();
        }
      });
    });
  });
}

main().catch(console.error);
