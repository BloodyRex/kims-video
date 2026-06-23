export const parseJSON = (text) => {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```json?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (_) {}
    }
    const start = Math.max(text.indexOf("["), text.indexOf("{"));
    const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (_) {}
    }
    throw e;
  }
};
