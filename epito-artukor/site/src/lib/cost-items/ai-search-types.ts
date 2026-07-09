export type AiSearchMatch = {
  itemId: string
  score: number
  reason: string
}

export type AiSearchResult = {
  matches: AiSearchMatch[]
  suggestNewItem: boolean
  suggestedText?: string
  suggestedTradeCode?: string
  suggestedCategoryCode?: string
  aiUsed: boolean
}
