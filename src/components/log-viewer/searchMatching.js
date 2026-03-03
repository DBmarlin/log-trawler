const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createSearchRegExp = (searchTerm, isRegexSearch = false) => {
  const term = (searchTerm || "").trim();
  if (!term) return null;

  try {
    return isRegexSearch
      ? new RegExp(term, "gi")
      : new RegExp(escapeRegExp(term), "gi");
  } catch {
    return null;
  }
};

export const getSearchMatches = (text, searchTerm, isRegexSearch = false) => {
  if (!text) return [];
  const regex = createSearchRegExp(searchTerm, isRegexSearch);
  if (!regex) return [];

  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (!match[0]) {
      regex.lastIndex += 1;
      continue;
    }
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
  }

  return matches;
};

export const doesTextMatchSearch = (text, searchTerm, isRegexSearch = false) =>
  getSearchMatches(text, searchTerm, isRegexSearch).length > 0;

export const findSearchMatchIndex = (
  messages,
  searchTerm,
  isRegexSearch = false,
  startIndex = 0,
  direction = 1,
) => {
  const term = (searchTerm || "").trim();
  if (!term || !Array.isArray(messages) || messages.length === 0) {
    return -1;
  }

  const size = messages.length;
  const normalizedDirection = direction < 0 ? -1 : 1;

  for (let step = 1; step <= size; step++) {
    const candidate = (startIndex + normalizedDirection * step + size) % size;
    if (doesTextMatchSearch(messages[candidate], term, isRegexSearch)) {
      return candidate;
    }
  }

  return -1;
};

