import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import type { MenuItemOptions } from '@tauri-apps/api/menu';

export interface ContextMenuItem {
  id: string;
  text: string;
  action?: () => void;
  enabled?: boolean;
  accelerator?: string;
}

/**
 * Show a native Tauri context menu at the current cursor position.
 * Falls back gracefully if the Tauri API is unavailable (e.g. browser dev mode).
 */
export async function showContextMenu(items: (ContextMenuItem | '---')[]): Promise<void> {
  try {
    const menuItems: (MenuItem | PredefinedMenuItem)[] = [];
    for (const item of items) {
      if (item === '---') {
        menuItems.push(await PredefinedMenuItem.new({ item: 'Separator' }));
      } else {
        menuItems.push(await MenuItem.new({
          id: item.id,
          text: item.text,
          action: item.action ? (() => item.action!()) : undefined,
          enabled: item.enabled ?? true,
          accelerator: item.accelerator,
        }));
      }
    }

    const menu = await Menu.new({ items: menuItems });
    await menu.popup();
  } catch (err) {
    console.error('[ContextMenu] Native menu failed:', err);
  }
}

/**
 * Copy text to clipboard using a fallback approach that works in Tauri WebView2.
 */
export function copyText(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}