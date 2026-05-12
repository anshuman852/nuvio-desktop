/// <reference types="vite/client" />
import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';

/**
 * Controls Discord Rich Presence media state.
 *
 * Assumes `DiscordRPCProvider` already manages the connection lifecycle.
 * Uses a ref for `enabled` so callbacks are stable (never cause effect re-runs
 * in VideoPlayer) but always read the latest value.
 */
export function useDiscordRPC() {
  const { settings } = useStore();
  const enabledRef = useRef(settings.discordEnabled);
  // Keep the ref in sync every render
  enabledRef.current = settings.discordEnabled;

  const startTimeRef = useRef<number | null>(null);
  const currentMediaRef = useRef<{
    title: string;
    subtitle: string;
    state: string;
  } | null>(null);

  /** Show "Watching X" with elapsed timer */
  const startPlaying = useCallback(
    (title: string, subtitle: string, mediaType: string) => {
      if (!enabledRef.current) return;
      console.log('[DiscordRPC] startPlaying:', title, subtitle, mediaType);
      const now = Math.floor(Date.now() / 1000);
      startTimeRef.current = now;

      let stateLine = subtitle || (mediaType === 'series' ? 'Watching a series' : 'Watching a movie');

      currentMediaRef.current = { title, subtitle, state: stateLine };

      invoke('discord_set_playing', {
        details: title,
        stateStr: stateLine,
        largeText: title,
        smallText: mediaType === 'movie' ? 'Watching movie' : 'Watching series',
        startTimestamp: now,
      }).catch((e) => {
        console.log('[DiscordRPC] startPlaying error:', e);
      });
    },
    [],
  );

  /** Show "Paused" without timer */
  const pausePlaying = useCallback(() => {
    if (!enabledRef.current || !currentMediaRef.current) return;
    console.log('[DiscordRPC] pausePlaying');
    invoke('discord_set_playing', {
      details: currentMediaRef.current.title,
      stateStr: 'Paused',
      largeText: currentMediaRef.current.title,
      smallText: 'Paused',
      startTimestamp: null as any,
    }).catch((e) => {
      console.log('[DiscordRPC] pausePlaying error:', e);
    });
  }, []);

  /** Resume timer on unpause */
  const resumePlaying = useCallback(() => {
    if (!enabledRef.current || !currentMediaRef.current) return;
    console.log('[DiscordRPC] resumePlaying');
    const now = Math.floor(Date.now() / 1000);
    startTimeRef.current = now;
    invoke('discord_set_playing', {
      details: currentMediaRef.current.title,
      stateStr: currentMediaRef.current.state,
      largeText: currentMediaRef.current.title,
      smallText: currentMediaRef.current.title,
      startTimestamp: now,
    }).catch((e) => {
      console.log('[DiscordRPC] resumePlaying error:', e);
    });
  }, []);

  /** Clear media presence, fall back to idle */
  const stopPlaying = useCallback(() => {
    if (!enabledRef.current) return;
    console.log('[DiscordRPC] stopPlaying');
    currentMediaRef.current = null;
    startTimeRef.current = null;
    invoke('discord_clear_presence').catch((e) => {
      console.log('[DiscordRPC] clear error:', e);
    });
    // Re-set idle browsing presence after a beat
    setTimeout(() => {
      if (enabledRef.current) {
        const now = Math.floor(Date.now() / 1000);
        invoke('discord_set_playing', {
          details: 'Nuvio Desktop',
          stateStr: 'Browsing catalog',
          largeText: 'Nuvio Desktop',
          smallText: 'Browsing',
          startTimestamp: now,
        }).catch((e) => {
          console.log('[DiscordRPC] idle error:', e);
        });
      }
    }, 1000);
  }, []);

  return { startPlaying, pausePlaying, resumePlaying, stopPlaying };
}
