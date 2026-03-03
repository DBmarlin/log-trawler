export interface SearchMatch {
  start: number;
  end: number;
  text: string;
}

export declare const getSearchMatches: (
  text: string,
  searchTerm: string,
  isRegexSearch?: boolean,
) => SearchMatch[];

export declare const doesTextMatchSearch: (
  text: string,
  searchTerm: string,
  isRegexSearch?: boolean,
) => boolean;

export declare const findSearchMatchIndex: (
  messages: string[],
  searchTerm: string,
  isRegexSearch?: boolean,
  startIndex?: number,
  direction?: number,
) => number;

