/// <reference types="vite/client" />
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';

const CLIENT_ID = '1503701124635557949';

export default function DiscordRPCProvider() {
  const { settings } = useStore();

  useEffect(() => {
    if (!settings.discordEnabled) return;

    invoke('discord_connect', { clientId: CLIENT_ID }).then(() => {
      console.log('[DiscordRPC] Connected');
      const now = Math.floor(Date.now() / 1000);
      invoke('discord_set_playing', {
        details: 'Nuvio Desktop',
        stateStr: 'Browsing catalog',
        largeText: 'Nuvio Desktop',
        smallText: 'Browsing',
        startTimestamp: now,
      }).catch(() => {});
    }).catch(() => {
      console.log('[DiscordRPC] Connection failed (Discord not running?)');
    });
  }, [settings.discordEnabled]);

  return null;
}
