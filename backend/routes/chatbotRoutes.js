const express = require("express");
const router = express.Router();
const engine = require("../chatbot/chatbotEngine");
const config = require("../chatbot/chatbotConfig");

router.post("/", async (req, res) => {
  try {
    const message = (req.body && req.body.message) ? req.body.message.toString().trim() : "";
    if (!message) {
      return res.json({ success: true, reply: "Please type a question about pets so I can help." });
    }
    const results = engine.query(message);
    if (!results || results.length === 0) {
      return res.json({ success: true, reply: "I'm Petzi, a pet-care assistant. I can help with questions related to pets and pet care." });
    }
    const best = results[0];
    const confidence = best.score || 0;
    if (confidence >= config.CONFIDENCE_THRESHOLD) {
      return res.json({ success: true, reply: best.response, confidence: confidence, matchedQuestion: best.question });
    }
    // low confidence fallback
    return res.json({ success: true, reply: "I'm Petzi, a pet-care assistant. I can help with questions related to pets and pet care." , confidence: confidence});
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ success: false, error: "Chatbot internal error" });
  }
});

module.exports = router;
