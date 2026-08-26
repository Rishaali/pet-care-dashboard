const config = require("./chatbotConfig");
const { loadDataset } = require("./chatbotData");

// Simple tokenizer / normalizer
function normalize(text) {
  return (text || "").toString().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text) {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function buildIndex(docs) {
  const N = docs.length;
  const vocab = new Map();
  const df = {}; // document frequency
  const docTokens = [];

  for (let i = 0; i < docs.length; i++) {
    const q = docs[i].question || docs[i].Question || docs[i].prompt || "";
    const tokens = Array.from(new Set(tokenize(q)));
    docTokens.push(tokenize(q));
    tokens.forEach(t => {
      df[t] = (df[t] || 0) + 1;
      if (!vocab.has(t)) vocab.set(t, vocab.size);
    });
  }

  const idf = {};
  for (const term in df) {
    idf[term] = Math.log( (N + 1) / (df[term] + 1) ) + 1;
  }

  // build tf-idf vectors (sparse maps)
  const docVectors = docs.map((doc, idx) => {
    const tokens = tokenize(doc.question || doc.Question || "");
    const tf = {};
    tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
    // convert to tf-idf
    const vec = {};
    for (const t in tf) {
      if (idf[t]) vec[t] = tf[t] * idf[t];
    }
    // normalize length
    const norm = Math.sqrt(Object.values(vec).reduce((s,v)=>s+v*v,0)) || 1;
    for (const k in vec) vec[k] = vec[k] / norm;
    return vec;
  });

  return {N, vocab, idf, docVectors, docTokens};
}

function dotProduct(a, b) {
  let s = 0;
  for (const k in a) {
    if (b[k]) s += a[k] * b[k];
  }
  return s;
}

// Levenshtein distance
function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1));
  for (let i=0;i<=m;i++) dp[i][0]=i;
  for (let j=0;j<=n;j++) dp[0][j]=j;
  for (let i=1;i<=m;i++){
    for (let j=1;j<=n;j++){
      const cost = a[i-1]===b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[m][n];
}

class ChatbotEngine {
  constructor(){
    this.dataset = loadDataset();
    this.index = buildIndex(this.dataset);
  }

  query(text) {
    const cleaned = normalize(text);
    const qTokens = tokenize(cleaned);
    const tf = {};
    qTokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
    const qvec = {};
    for (const t in tf) {
      if (this.index.idf[t]) qvec[t] = tf[t] * this.index.idf[t];
    }
    const qnorm = Math.sqrt(Object.values(qvec).reduce((s,v)=>s+v*v,0)) || 1;
    for (const k in qvec) qvec[k] = qvec[k] / qnorm;

    const scores = [];
    for (let i=0;i<this.dataset.length;i++){
      const docVec = this.index.docVectors[i];
      const tfidfScore = dotProduct(qvec, docVec);
      // fuzzy similarity based on normalized levenshtein between full strings
      const docText = normalize(this.dataset[i].question || this.dataset[i].Question || "");
      const lev = levenshtein(cleaned, docText);
      const maxLen = Math.max(cleaned.length, docText.length, 1);
      const fuzzy = 1 - (lev / maxLen);
      const combined = (config.WEIGHTS.TFIDF * tfidfScore) + (config.WEIGHTS.FUZZY * fuzzy);
      scores.push({i, tfidfScore, fuzzy, combined});
    }
    scores.sort((a,b)=>b.combined - a.combined);
    const top = scores.slice(0, config.MAX_RESULTS).map(s => ({
      index: s.i,
      score: s.combined,
      tfidf: s.tfidfScore,
      fuzzy: s.fuzzy,
      question: this.dataset[s.i].question || this.dataset[s.i].Question,
      response: this.dataset[s.i].response || this.dataset[s.i].answer || this.dataset[s.i].Response
    }));
    return top;
  }
}

module.exports = new ChatbotEngine();
