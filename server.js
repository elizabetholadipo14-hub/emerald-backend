import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// CHAT ENDPOINT
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: process.env.MODEL,
        input: [
          { role: "system", content: process.env.SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // CORRECT FIELD FOR PROJECT KEYS
    const replyText = response.data.output[0].content[0].text;

    res.json({ reply: replyText });

  } catch (error) {
    console.error("OpenAI Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});



// HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send("Emerald Pantry Backend is running!");
});

// START SERVER
const PORT = process.env.PORT || 3000;
import xlsx from "xlsx";

app.post("/ask-sheet", async (req, res) => {
  try {
    const question = req.body.question;

    const workbook = xlsx.readFile("./data/emerald_pantry.xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const products = xlsx.utils.sheet_to_json(sheet);

    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: process.env.MODEL,
        input: [
          {
            role: "system",
            content:
              "You are Emerald Pantry. Answer ONLY using the sheet data provided. If the answer is not in the sheet, say 'Not found in sheet'."
          },
          {
            role: "user",
            content: `Sheet data: ${JSON.stringify(
              products
            )}\n\nQuestion: ${question}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.output[0].content[0].text;

    res.json({ reply });
  } catch (error) {
    console.error("Sheet Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
