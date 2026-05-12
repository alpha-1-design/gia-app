export function extractJSON(text: string): any {
  // 1. Clean the text of markdown formatting
  let cleaned = text.replace(/```json|```/g, '').trim();

  // 2. Locate the first '[' and last ']' (array) or '{' and '}' (object)
  const firstArray = cleaned.indexOf('[');
  const lastArray = cleaned.lastIndexOf(']');
  const firstObj = cleaned.indexOf('{');
  const lastObj = cleaned.lastIndexOf('}');

  let start = -1;
  let end = -1;

  // Decide if we should treat it as an array (usually the case for lists of questions)
  if (firstArray !== -1 && lastArray > firstArray) {
    start = firstArray;
    end = lastArray + 1;
  } else if (firstObj !== -1 && lastObj > firstObj) {
    start = firstObj;
    end = lastObj + 1;
  } else {
    throw new Error('No valid JSON found');
  }

  const jsonCandidate = cleaned.slice(start, end);
  
  try {
    return JSON.parse(jsonCandidate);
  } catch (e) {
    // If strict JSON.parse fails, it might be due to trailing commas or malformed content in AI response
    // Attempt to fix common JSON errors
    const fixedCandidate = jsonCandidate.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(fixedCandidate);
  }
}
