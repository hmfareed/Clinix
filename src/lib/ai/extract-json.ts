/**
 * Extracts and parses a JSON object from an LLM response string.
 * Handles markdown code blocks, leading/trailing whitespace or text.
 */
export function extractJson<T = Record<string, unknown>>(rawContent: string): T {
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("Cannot extract JSON from empty or non-string input");
  }

  let text = rawContent.trim();

  // 1. Remove markdown code block fences if present (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = codeBlockRegex.exec(text);
  if (match && match[1]) {
    text = match[1].trim();
  }

  // 2. If text starts with '{' and ends with '}', try direct parse
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // Continue to bracket search if direct parse failed due to trailing commas or surrounding text
    }
  }

  // 3. Find outermost matching curly braces
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Clean common trailing commas or control characters and retry
      try {
        const sanitized = candidate
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
        return JSON.parse(sanitized) as T;
      } catch (parseError) {
        throw new Error(
          `Failed to parse extracted JSON candidate: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`
        );
      }
    }
  }

  throw new Error("No valid JSON object structure found in AI response");
}
