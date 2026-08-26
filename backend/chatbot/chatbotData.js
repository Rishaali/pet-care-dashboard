const fs = require("fs");
const path = require("path");
const config = require("./chatbotConfig");

function loadDataset() {
  let data = null;
  for (const p of config.DATA_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        data = JSON.parse(raw);
        console.log(`Chatbot: loaded dataset from ${p} (${data.length} records)`);
        break;
      }
    } catch (err) {
      // try next path
      console.warn("Chatbot: failed to load dataset from", p);
    }
  }
  if (!data) {
    console.warn("Chatbot: dataset not found in configured paths. Continuing with empty dataset.");
    data = [];
  }
  return data;
}

module.exports = { loadDataset };
