/// <reference types="vite/client" />
import { useState } from 'react';
import { Play } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';

interface TestStream {
  label: string;
  url: string;
  note?: string;
}

const SAMPLES: TestStream[] = [
  {
    label: 'Big Buck Bunny (MP4 H.264 AAC)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    note: 'Baseline — should play in HTML5 and MPV.',
  },
  {
    label: 'Sintel Trailer (MP4 H.264)',
    url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
  },
  {
    label: 'Tears of Steel Trailer (MP4)',
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/mp4/TearsOfSteel.mp4',
  },
  {
    label: 'Apple HLS Sample (m3u8)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    note: 'HLS — best in HTML5 mode (handled by hls.js / proxy).',
  },
];

export default function TestingPage() {
  const [playing, setPlaying] = useState<TestStream | null>(null);

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-1">Testing</h1>
      <p className="text-white/40 text-sm mb-6">
        Quick sample streams for debugging the player. Pick the player mode in Settings → Playback.
      </p>

      <div className="space-y-2 max-w-2xl">
        {SAMPLES.map(s => (
          <button
            key={s.url}
            onClick={() => setPlaying(s)}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Play size={16} className="fill-white text-white ml-0.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{s.label}</p>
              {s.note && <p className="text-white/40 text-xs mt-0.5">{s.note}</p>}
              <p className="text-white/30 text-[10px] mt-1 truncate font-mono">{s.url}</p>
            </div>
          </button>
        ))}
      </div>

      {playing && (
        <VideoPlayer
          url={playing.url}
          title={playing.label}
          subtitle="Test stream"
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}
