'use client'

/**
 * filters.store：列表页共享筛选状态（搜索词/难度/分类），跨页保留。
 */
import { create } from 'zustand'

export type DifficultyFilter = 'ALL' | 'EASY' | 'MEDIUM' | 'HARD'

interface FiltersState {
  q: string
  difficulty: DifficultyFilter
  category: string
  setQ: (q: string) => void
  setDifficulty: (d: DifficultyFilter) => void
  setCategory: (c: string) => void
  reset: () => void
}

export const useFiltersStore = create<FiltersState>((set) => ({
  q: '',
  difficulty: 'ALL',
  category: 'all',
  setQ: (q) => set({ q }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setCategory: (category) => set({ category }),
  reset: () => set({ q: '', difficulty: 'ALL', category: 'all' }),
}))
