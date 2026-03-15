import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AspectRatio, LyricLine } from '../types';
import { RESOLUTIONS } from '../constants';

interface VideoExporterProps {
    audioUrl: string;
    backgroundUrl: string;
    syncedLyrics: LyricLine[];
    aspectRatio: AspectRatio;
    textColor: string;
    onTextColorChange: (color: string) => void;
    onBack: () => void;
}

const hexToRgba = (hex: string, alpha: number) => {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return `rgba(255,255,255,${alpha})`;
}

const MALAYALAM_FONTS = [
    'Malayalam MN',
    'Malayalam Sangam MN',
    'Arial Unicode MS',
    '.SF Malayalam',
    'Anek Malayalam',
    'Noto Sans Malayalam',
    'Noto Sans Malayalam UI',
    'Noto Serif Malayalam'
];

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Format seconds to SRT timestamp: HH:MM:SS,mmm
const toSrtTimestamp = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

// Format seconds to SMI timestamp (milliseconds)
const toSmiTimestamp = (seconds: number): number => {
    return Math.round(seconds * 1000);
};

const generateSRT = (lyrics: LyricLine[]): string => {
    const timedLyrics = lyrics.filter(l => l.timestamp !== undefined);
    return timedLyrics.map((line, i) => {
        const start = line.timestamp!;
        const end = timedLyrics[i + 1]?.timestamp ?? start + 5;
        return `${i + 1}\n${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}\n${line.text}\n`;
    }).join('\n');
};

const generateSMI = (lyrics: LyricLine[]): string => {
    const timedLyrics = lyrics.filter(l => l.timestamp !== undefined);
    let body = '';
    timedLyrics.forEach((line, i) => {
        const startMs = toSmiTimestamp(line.timestamp!);
        const endMs = timedLyrics[i + 1]?.timestamp !== undefined
            ? toSmiTimestamp(timedLyrics[i + 1].timestamp!)
            : startMs + 5000;
        body += `  <SYNC Start=${startMs}><P Class=ENCC>${line.text}</P></SYNC>\n`;
        body += `  <SYNC Start=${endMs}><P Class=ENCC>&nbsp;</P></SYNC>\n`;
    });
    return `<SAMI>\n<HEAD>\n  <STYLE TYPE="text/css">\n    P { font-family: Arial; font-size: 20pt; color: white; font-weight: bold; text-align: center; }\n    .ENCC { Name: English; lang: en-US; }\n  </STYLE>\n</HEAD>\n<BODY>\n${body}</BODY>\n</SAMI>`;
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const VideoExporter: React.FC<VideoExporterProps> = ({
    audioUrl,
    backgroundUrl,
    syncedLyrics,
    aspectRatio,
    textColor,
    onTextColorChange,
    onBack
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const bgImageRef = useRef<HTMLImageElement>(new Image());

    const [isPlaying, setIsPlaying] = useState(false);
    const [displayTime, setDisplayTime] = useState(0);
    const currentTimeRef = useRef(0);
    const [duration, setDuration] = useState(0);
    const [fontFamily, setFontFamily] = useState(MALAYALAM_FONTS[0]);

    // New controls
    const [showOverlay, setShowOverlay] = useState(true);
    const [overlayOpacity, setOverlayOpacity] = useState(0.6);
    const [showGlow, setShowGlow] = useState(true);

    const [isScrubbing, setIsScrubbing] = useState(false);
    const [wasPlayingBeforeScrub, setWasPlayingBeforeScrub] = useState(false);

    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // Preload Image
    useEffect(() => {
        if (backgroundUrl) {
            bgImageRef.current.src = backgroundUrl;
        }
    }, [backgroundUrl]);

    // Preload selected font for canvas rendering
    useEffect(() => {
        const fontName = fontFamily === '.SF Malayalam' ? 'system-ui' : fontFamily;
        document.fonts.load(`bold 48px "${fontName}"`).catch(() => { });
    }, [fontFamily]);

    // Low-frequency UI updater for the seek bar and time display (~4 Hz)
    useEffect(() => {
        const id = setInterval(() => {
            if (!isScrubbing) {
                setDisplayTime(currentTimeRef.current);
            }
        }, 250);
        return () => clearInterval(id);
    }, [isScrubbing]);

    // Easing function for smooth animation
    const easeOutCubic = (x: number): number => {
        return 1 - Math.pow(1 - x, 3);
    };

    // Setup main loop
    useEffect(() => {
        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            const audio = audioRef.current;

            const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = RESOLUTIONS[aspectRatio];

            if (canvas && ctx && audio) {
                const time = audio.currentTime;
                currentTimeRef.current = time;

                // 1. Draw Background (Object-Fit: Cover logic)
                if (bgImageRef.current.complete && bgImageRef.current.naturalWidth > 0) {
                    const img = bgImageRef.current;
                    const imgWidth = img.naturalWidth;
                    const imgHeight = img.naturalHeight;

                    const scale = Math.max(CANVAS_WIDTH / imgWidth, CANVAS_HEIGHT / imgHeight);
                    const scaledWidth = imgWidth * scale;
                    const scaledHeight = imgHeight * scale;

                    const xOffset = (CANVAS_WIDTH - scaledWidth) / 2;
                    const yOffset = (CANVAS_HEIGHT - scaledHeight) / 2;

                    ctx.drawImage(img, xOffset, yOffset, scaledWidth, scaledHeight);
                } else {
                    ctx.fillStyle = '#111';
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                }

                // 2. Overlay (conditionally)
                if (showOverlay) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                }

                // 3. Lyrics Logic
                let currentLineIndex = -1;
                for (let i = 0; i < syncedLyrics.length; i++) {
                    if (syncedLyrics[i].timestamp !== undefined && syncedLyrics[i].timestamp! <= time) {
                        currentLineIndex = i;
                    } else {
                        break;
                    }
                }

                const activeLine = syncedLyrics[currentLineIndex];
                const prevLine = syncedLyrics[currentLineIndex - 1];
                const nextLine = syncedLyrics[currentLineIndex + 1];

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // --- Animation Logic ---
                const TRANSITION_DURATION = 0.5;
                const timeSinceStart = activeLine && activeLine.timestamp ? time - activeLine.timestamp : 0;
                const isTransitioning = timeSinceStart < TRANSITION_DURATION && timeSinceStart >= 0;

                const drawLyric = (text: string, x: number, y: number, opacity: number, scale: number, glow: boolean) => {
                    if (opacity <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

                    const baseFontSize = CANVAS_WIDTH * 0.042;
                    const fontSize = baseFontSize * scale;

                    const effectiveFont = fontFamily === '.SF Malayalam' ? 'system-ui' : `"${fontFamily}"`;
                    ctx.font = `bold ${fontSize}px ${effectiveFont}, "Noto Sans Malayalam", "Inter", sans-serif`;

                    if (glow && showGlow) {
                        ctx.shadowColor = 'rgba(255,255,255,0.8)';
                        ctx.shadowBlur = isRecordingRef.current ? 15 : 40;
                        ctx.fillStyle = textColor;
                    } else if (glow && !showGlow) {
                        // Active line without glow
                        ctx.fillStyle = textColor;
                        ctx.shadowBlur = 0;
                    } else {
                        ctx.fillStyle = hexToRgba(textColor, 0.6);
                        ctx.shadowBlur = 0;
                    }

                    ctx.fillText(text, x, y);
                    ctx.restore();
                };

                const CENTER_Y = CANVAS_HEIGHT / 2;
                const OFFSET_Y = CANVAS_HEIGHT * 0.12;

                if (activeLine) {
                    if (isTransitioning) {
                        const t = easeOutCubic(timeSinceStart / TRANSITION_DURATION);

                        if (prevLine) {
                            drawLyric(prevLine.text, CANVAS_WIDTH / 2, CENTER_Y - (OFFSET_Y * 0.8 * t), 1 - t, 1.0, false);
                        }

                        const currentY = (CENTER_Y + OFFSET_Y) - (OFFSET_Y * t);
                        const currentScale = 0.6 + (0.4 * t);
                        const currentOpacity = 0.5 + (0.5 * t);

                        drawLyric(activeLine.text, CANVAS_WIDTH / 2, currentY, currentOpacity, currentScale, true);

                        if (nextLine) {
                            const nextStartY = CENTER_Y + (OFFSET_Y * 2);
                            const nextY = nextStartY - (OFFSET_Y * t);
                            drawLyric(nextLine.text, CANVAS_WIDTH / 2, nextY, 0.5 * t, 0.6, false);
                        }

                    } else {
                        drawLyric(activeLine.text, CANVAS_WIDTH / 2, CENTER_Y, 1, 1, true);

                        if (nextLine) {
                            drawLyric(nextLine.text, CANVAS_WIDTH / 2, CENTER_Y + OFFSET_Y, 0.5, 0.6, false);
                        }
                    }
                } else if (nextLine) {
                    drawLyric(nextLine.text, CANVAS_WIDTH / 2, CENTER_Y + OFFSET_Y, 0.5, 0.6, false);
                }
            }
            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [syncedLyrics, backgroundUrl, aspectRatio, textColor, fontFamily, showOverlay, overlayOpacity, showGlow]);

    const togglePlay = useCallback(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            currentTimeRef.current = time;
            setDisplayTime(time);
        }
    };

    const handleScrubStart = () => {
        setWasPlayingBeforeScrub(isPlaying);
        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
        setIsScrubbing(true);
    };

    const handleScrubEnd = () => {
        setIsScrubbing(false);
        if (wasPlayingBeforeScrub && audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const skipForward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, duration);
        }
    };

    const skipBackward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
        }
    };

    const handleRecordClick = () => {
        if (isRecording) {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
            }
            if (audioRef.current) audioRef.current.pause();
            setIsPlaying(false);
            isRecordingRef.current = false;
        } else {
            const canvas = canvasRef.current;
            const audioEl = audioRef.current as any;

            if (canvas && audioEl && audioEl.captureStream) {
                const canvasStream = canvas.captureStream(30);
                const audioStream = audioEl.captureStream();
                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioStream.getAudioTracks()
                ]);

                try {
                    const options = {
                        mimeType: 'video/webm; codecs=vp9',
                        videoBitsPerSecond: 25000000
                    };

                    const recorder = MediaRecorder.isTypeSupported(options.mimeType)
                        ? new MediaRecorder(combinedStream, options)
                        : new MediaRecorder(combinedStream);

                    mediaRecorderRef.current = recorder;
                    recordedChunksRef.current = [];

                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
                    };

                    recorder.onstop = () => {
                        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `karaoke-export-${aspectRatio === '16:9' ? 'landscape' : 'portrait'}.webm`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        setIsRecording(false);
                        isRecordingRef.current = false;
                    };

                    audioRef.current!.currentTime = 0;
                    audioRef.current!.play();
                    setIsPlaying(true);

                    recorder.start(1000);
                    setIsRecording(true);
                    isRecordingRef.current = true;
                } catch (e) {
                    console.error(e);
                    alert("Recording initialization failed.");
                }
            } else {
                alert("Browser does not support capturing audio from element (try Chrome).");
            }
        }
    };

    const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = RESOLUTIONS[aspectRatio];

    const seekProgress = duration > 0 ? (displayTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto animate-fade-slide-up">
            <audio
                ref={audioRef}
                src={audioUrl}
                crossOrigin="anonymous"
                className="hidden"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => {
                    setIsPlaying(false);
                    if (isRecording && mediaRecorderRef.current) {
                        mediaRecorderRef.current.stop();
                    }
                }}
            />

            {/* Video Preview */}
            <div className={`relative bg-[#000] rounded-2xl overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.8)] border border-white/[0.06] ${aspectRatio === '16:9' ? 'w-full aspect-video' : 'h-[600px] aspect-[9/16]'}`}>
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="w-full h-full object-contain"
                />
            </div>

            {/* ───────── Transport Bar ───────── */}
            <div className="w-full max-w-4xl mx-auto mt-6 transport-bar">
                {/* Seek Bar */}
                <div className="flex items-center gap-4 mb-4">
                    <span className="time-display text-xs text-zinc-500 w-10 text-right select-none">{formatTime(displayTime)}</span>
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 h-1 rounded-full bg-zinc-800 top-1/2 -translate-y-1/2 pointer-events-none"></div>
                        <div
                            className="absolute h-1 rounded-full bg-white/80 top-1/2 -translate-y-1/2 pointer-events-none transition-[width] duration-75"
                            style={{ width: `${seekProgress}%` }}
                        ></div>
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={displayTime}
                            onChange={handleSeek}
                            onMouseDown={handleScrubStart}
                            onMouseUp={handleScrubEnd}
                            onTouchStart={handleScrubStart}
                            onTouchEnd={handleScrubEnd}
                            className="seek-bar relative z-10"
                            style={{ background: 'transparent' }}
                        />
                    </div>
                    <span className="time-display text-xs text-zinc-500 w-10 select-none">{formatTime(duration)}</span>
                </div>

                {/* Transport Controls Row */}
                <div className="flex items-center justify-between">
                    {/* Left: Playback Controls */}
                    <div className="flex items-center gap-3">
                        {/* Skip Backward */}
                        <button
                            onClick={skipBackward}
                            className="ctrl-btn w-10 h-10 bg-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                            title="Skip 10s backward"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                        </button>

                        {/* Play / Pause */}
                        <button
                            onClick={togglePlay}
                            className="ctrl-btn w-14 h-14 bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.12)] hover:shadow-[0_0_32px_rgba(255,255,255,0.2)]"
                        >
                            {isPlaying ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                            ) : (
                                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                        </button>

                        {/* Skip Forward */}
                        <button
                            onClick={skipForward}
                            className="ctrl-btn w-10 h-10 bg-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                            title="Skip 10s forward"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                            </svg>
                        </button>
                    </div>

                    {/* Right: Record Button */}
                    <button
                        onClick={handleRecordClick}
                        className={`record-btn h-12 px-6 rounded-full flex items-center gap-3 border font-medium text-sm transition-all ${isRecording
                            ? 'bg-red-500/10 border-red-500/40 text-red-400'
                            : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:border-white/[0.16] hover:text-white'
                            }`}
                    >
                        <div className="relative flex items-center justify-center">
                            {isRecording && (
                                <div className="absolute w-6 h-6 rounded-full bg-red-500/20 recording-pulse"></div>
                            )}
                            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500' : 'bg-red-500/80'}`}></div>
                        </div>
                        <span>{isRecording ? 'Stop Recording' : 'Record Video'}</span>
                    </button>
                </div>
            </div>

            {/* ───────── Settings Panel ───────── */}
            <div className="w-full max-w-4xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Appearance Settings */}
                <div className="settings-card p-5">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-1">Appearance</h3>

                    {/* Text Color */}
                    <div className="setting-row flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.25" />
                            </svg>
                            <span className="text-sm text-zinc-300">Text Color</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-zinc-500 uppercase">{textColor}</span>
                            <div className="color-picker-wrapper" style={{ backgroundColor: textColor }}>
                                <input
                                    type="color"
                                    value={textColor}
                                    onChange={(e) => onTextColorChange(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Font Family */}
                    <div className="setting-row flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                            <span className="text-sm text-zinc-300">Font</span>
                        </div>
                        <select
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="font-select"
                        >
                            {MALAYALAM_FONTS.map(font => (
                                <option key={font} value={font}>{font}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Effects Settings */}
                <div className="settings-card p-5">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-1">Effects</h3>

                    {/* Overlay Toggle */}
                    <div className="setting-row flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                            <span className="text-sm text-zinc-300">Dark Overlay</span>
                        </div>
                        <div
                            className={`toggle-switch ${showOverlay ? 'active' : 'inactive'}`}
                            onClick={() => setShowOverlay(!showOverlay)}
                            role="switch"
                            aria-checked={showOverlay}
                        />
                    </div>

                    {/* Overlay Opacity (shown only when overlay is on) */}
                    {showOverlay && (
                        <div className="setting-row flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="w-4 h-4"></div>
                                <span className="text-sm text-zinc-500">Opacity</span>
                            </div>
                            <div className="flex items-center gap-3 flex-1 max-w-[200px]">
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={overlayOpacity}
                                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                                    className="overlay-slider flex-1"
                                />
                                <span className="text-xs text-zinc-500 font-mono w-8 text-right">{Math.round(overlayOpacity * 100)}%</span>
                            </div>
                        </div>
                    )}

                    {/* Glow Toggle */}
                    <div className="setting-row flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                            <span className="text-sm text-zinc-300">Text Glow</span>
                        </div>
                        <div
                            className={`toggle-switch ${showGlow ? 'active' : 'inactive'}`}
                            onClick={() => setShowGlow(!showGlow)}
                            role="switch"
                            aria-checked={showGlow}
                        />
                    </div>
                </div>

                {/* Export Settings */}
                <div className="settings-card p-5 md:col-span-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-1">Export Subtitles</h3>
                    <div className="flex items-center gap-3 px-1">
                        <button
                            onClick={() => downloadFile(generateSRT(syncedLyrics), 'karaoke-subtitles.srt', 'text/plain')}
                            className="h-10 px-5 rounded-xl flex items-center gap-2 border border-white/[0.08] bg-white/[0.04] text-zinc-300 text-sm font-medium transition-all hover:border-white/[0.16] hover:text-white hover:bg-white/[0.07]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            .SRT
                        </button>
                        <button
                            onClick={() => downloadFile(generateSMI(syncedLyrics), 'karaoke-subtitles.smi', 'text/plain')}
                            className="h-10 px-5 rounded-xl flex items-center gap-2 border border-white/[0.08] bg-white/[0.04] text-zinc-300 text-sm font-medium transition-all hover:border-white/[0.16] hover:text-white hover:bg-white/[0.07]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            .SMI
                        </button>
                    </div>
                </div>
            </div>

            {/* Back Link */}
            <div className="w-full max-w-4xl mx-auto mt-8 mb-12 px-1">
                <button onClick={onBack} className="back-link">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back to Sync
                </button>
            </div>
        </div>
    );
};

export default VideoExporter;