import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import xlsx from "xlsx";

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

// ASK-SHEET (Hybrid Mode)
app.post("/ask-sheet", async (req, res) => {
  try {
    const question = req.body.question || req.body.message || "";

    const workbook = xlsx.readFile("./data/emerald_pantry.xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const products = xlsx.utils.sheet_to_json(sheet);

    // 1) Ask model to answer using ONLY the sheet
    const sheetResponse = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: process.env.MODEL,
        input: [
          {
            role: "system",
            content:
              "You are Emerald Pantry. Answer ONLY using the sheet data provided. If the answer is not in the sheet, reply exactly: Not found in sheet."
          },
          {
            role: "user",
            content: `Sheet data: ${JSON.stringify(products)}\n\nQuestion: ${question}`
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

    const sheetReply = sheetResponse.data.output[0].content[0].text.trim();

    // 2) If sheet has it, return it. Otherwise, fallback to normal chat.
    if (sheetReply && sheetReply !== "Not found in sheet.") {
      return res.json({ reply: sheetReply });
    }

    // Fallback: normal chat behavior
    const chatResponse = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: process.env.MODEL,
        input: [
          { role: "system", content: process.env.SYSTEM_PROMPT },
          { role: "user", content: question }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const chatReply = chatResponse.data.output[0].content[0].text;
    res.json({ reply: chatReply });

  } catch (error) {
    console.error("Ask-sheet Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// OPEN FOOD FACTS API
app.post("/ask-openfood", async (req, res) => {
  try {
    const question = req.body.question || req.body.message || "";
    const barcode = req.body.barcode;

    if (!barcode) {
      return res.status(400).json({ error: "Please provide a barcode." });
    }

    const offResponse = await axios.get(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );

    const offData = offResponse.data;

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: process.env.MODEL,
        input: [
          {
            role: "system",
            content:
              "You are Emerald Pantry. Use the Open Food Facts data to help customers understand nutrition, allergens, eco-score, and healthiness. Do not invent values."
          },
          {
            role: "user",
            content: `Open Food Facts data: ${JSON.stringify(
              offData
            )}\n\nCustomer question: ${question}`
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

    const reply = aiResponse.data.output[0].content[0].text;
    res.json({ reply });

  } catch (error) {
    console.error("OpenFood Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// COMBINED SHEET + OPEN FOOD FACTS
app.post("/ask-combined-food", async (req, res) => {
  try {
    const question = req.body.question || req.body.message || "";
    const barcode = req.body.barcode;

    const workbook = xlsx.readFile("./data/emerald_pantry.xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const products = xlsx.utils.sheet_to_json(sheet);

    const offResponse = await axios.get(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const offData = offResponse.data;

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: process.env.MODEL,
        input: [
          {
            role: "system",
            content:
              "You are Emerald Pantry. Use BOTH the sheet data and Open Food Facts data to help customers. Do not invent values."
          },
          {
            role: "user",
            content: `Sheet data: ${JSON.stringify(
              products
            )}\n\nOpen Food Facts data: ${JSON.stringify(
              offData
            )}\n\nCustomer question: ${question}`
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

    const reply = aiResponse.data.output[0].content[0].text;
    res.json({ reply });

  } catch (error) {
    console.error("Combined Food Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
