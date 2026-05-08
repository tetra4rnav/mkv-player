import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import styles from './VideoPlayer.module.css';

export default function VideoPlayer({
  src,
  type,
  subtitleKey,
  seekTo,
  onTimeUpdate,
  onEnded,
  onReady,
}) {
  const containerRef = useRef(null);
  const playerRef    = useRef(null);
  const trackRef     = useRef(null);
  const trackUrlRef  = useRef(null);

  // ── Init player ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || playerRef.current) return;

    const videoEl = document.createElement('video');
    videoEl.className = 'video-js vjs-big-play-centered';
    videoEl.playsInline = true;
    containerRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      controls:  true,
      fluid:     true,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      sources: [{ src, type }],
      html5: {
        vhs: {
          overrideNative:     !videojs.browser.IS_SAFARI,
          enableLowInitialPlaylist: true,
        },
        nativeAudioTracks: videojs.browser.IS_SAFARI,
        nativeVideoTracks: videojs.browser.IS_SAFARI,
      },
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'audioTrackButton',       // 🎵 音声トラック切替
          'captionsButton',         // 💬 字幕切替
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
    });

    // Resume seek
    if (seekTo > 0) {
      player.on('loadedmetadata', () => { player.currentTime(seekTo); });
    }

    player.on('timeupdate', () => { onTimeUpdate?.(player.currentTime()); });
    player.on('ended',      () => { onEnded?.(); });
    player.on('ready',      () => { onReady?.(); });

    // Keyboard shortcuts
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === ' ')           { player.paused() ? player.play() : player.pause(); e.preventDefault(); }
      if (e.key === 'ArrowLeft')   { player.currentTime(Math.max(0, player.currentTime() - 10)); e.preventDefault(); }
      if (e.key === 'ArrowRight')  { player.currentTime(player.currentTime() + 10); e.preventDefault(); }
      if (e.key === 'f')           { player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen(); }
      if (e.key === 'm')           { player.muted(!player.muted()); }
    };
    document.addEventListener('keydown', handleKey);

    playerRef.current = player;
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subtitle loader ──────────────────────────────────────────
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    // Remove previous track
    if (trackRef.current) {
      try { player.removeRemoteTextTrack(trackRef.current); } catch {}
      trackRef.current = null;
    }
    if (trackUrlRef.current) {
      URL.revokeObjectURL(trackUrlRef.current);
      trackUrlRef.current = null;
    }

    if (!subtitleKey) return;

    // Fetch subtitle → convert to Blob URL (avoids CORS issues)
    fetch('/api/subtitle/' + encodeURIComponent(subtitleKey))
      .then(r => r.text())
      .then(vtt => {
        const blob = new Blob([vtt], { type: 'text/vtt; charset=utf-8' });
        trackUrlRef.current = URL.createObjectURL(blob);

        trackRef.current = player.addRemoteTextTrack({
          kind:    'subtitles',
          label:   decodeURIComponent(subtitleKey).split('/').pop(),
          srclang: 'ja',
          src:     trackUrlRef.current,
          default: true,
        }, false);

        // Force show
        setTimeout(() => {
          const tracks = player.textTracks();
          for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind === 'subtitles') tracks[i].mode = 'showing';
          }
        }, 200);
      })
      .catch(err => console.warn('Subtitle load error:', err));

    return () => {
      if (trackRef.current && playerRef.current && !playerRef.current.isDisposed()) {
        try { playerRef.current.removeRemoteTextTrack(trackRef.current); } catch {}
      }
      if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
    };
  }, [subtitleKey]);

  return <div className={styles.wrap} ref={containerRef} />;
}
