module.exports = {
  // Minimum combined confidence (0-1) required to return a dataset answer
  CONFIDENCE_THRESHOLD: 0.60,

  // Weights to combine retrieval (tf-idf cosine) and fuzzy (levenshtein)
  WEIGHTS: {
    TFIDF: 0.75,
    FUZZY: 0.25
  },

  // Path fallback for dataset (first checks local data folder, then user's Downloads)
  DATA_PATHS: [
    __dirname + "/data/brbc_dataset.json",
    "c:/Users/HP/Downloads/brbc_dataset.json"
  ],

  // Maximum number of results to consider
  MAX_RESULTS: 5
};
