import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind class（clsx + tailwind-merge）。
 * 全站唯一的 className 合成入口（架构 §6.4 / §7.1）。
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-primary', 'px-4') // → 'py-1 bg-primary px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
