/** AI configuration is missing or unavailable; the route should return 503. */
export class AnalysisUnavailableError extends Error {
  constructor() {
    super("AI analysis is unavailable.");
    this.name = "AnalysisUnavailableError";
  }
}

/** Claude failed or returned unusable feedback; the route should return 502. */
export class AnalysisProviderError extends Error {
  constructor() {
    super("AI analysis failed.");
    this.name = "AnalysisProviderError";
  }
}
