import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LyricLine } from '../types';

interface SyncEditorProps {
    audioUrl: string;
    lyrics: LyricLine[];
    onComplete: (syncedLyrics: LyricLine[]) => void;
    onBack: () => void;
}

const formatTime = (seconds: number) => {
    if (!seconds && seconds !== 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SyncEditor: React.FC<SyncEditorProps> = ({ audioUrl, lyrics, onComplete, onBack }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [syncedData, setSyncedData] = useState<LyricLine[]>(lyrics);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const audioRef = useRef<HTMLAudioElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLDivElement>(null);

    const handleStart = () => {
        if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
            // Reset timestamps if starting over
            if (currentIndex === 0) {
                const reset = lyrics.map(l => ({ ...l, timestamp: undefined }));
                setSyncedData(reset);
            }
        }
    };

    const handlePause = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };

    // The core sync logic: User taps SPACE or clicks button to mark start of CURRENT line
    const markCurrentLine = useCallback(() => {
        if (!audioRef.current || !isPlaying) return;

        if (currentIndex >= lyrics.length) {
            handlePause();
            return;
        }

        const time = audioRef.current.currentTime;

        setSyncedData(prev => {
            const updated = [...prev];
            updated[currentIndex] = { ...updated[currentIndex], timestamp: time };
            return updated;
        });

        setCurrentIndex(prev => prev + 1);
    }, [currentIndex, isPlaying, lyrics.length]);

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scroll
                if (!isPlaying && currentIndex === 0) {
                    handleStart();
                } else if (isPlaying) {
                    markCurrentLine();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, currentIndex, markCurrentLine]);

    // Auto-scroll to active line
    useEffect(() => {
        if (activeLineRef.current && scrollContainerRef.current) {
            activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentIndex]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
            {/* Card Container */}
            <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col h-[650px] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1A1A1A]">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-1">Sync Lyrics</h2>
                        <p className="text-sm text-zinc-500">Tap <kbd className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono text-xs border border-white/10">SPACE</kbd> when the line starts.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-mono text-zinc-200 font-medium tracking-tight">
                            {currentIndex}<span className="text-zinc-600">/</span>{lyrics.length}
                        </div>
                    </div>
                </div>

                {/* Lyric Viewport */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#141414]"
                >
                    {syncedData.map((line, idx) => {
                        const isActive = idx === currentIndex;
                        const isPast = idx < currentIndex;

                        return (
                            <div
                                key={line.id}
                                ref={isActive ? activeLineRef : null}
                                onClick={() => {
                                    // Allow manual jump (advanced usage)
                                    if (audioRef.current) {
                                        if (line.timestamp !== undefined) {
                                            audioRef.current.currentTime = line.timestamp;
                                            setCurrentIndex(idx);
                                        }
                                    }
                                }}
                                className={`p-4 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center relative group border
                                ${isActive
                                        ? 'bg-zinc-800 border-zinc-700 shadow-lg translate-x-2'
                                        : 'bg-transparent border-transparent hover:bg-zinc-900/50'
                                    }
                                ${isPast ? 'opacity-40 grayscale' : 'opacity-100'}
                            `}
                            >
                                <span className={`text-lg font-medium text-center transition-colors w-full px-12 ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                                    {line.text}
                                </span>
                                {line.timestamp !== undefined && (
                                    <span className="absolute right-4 text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-white/5">
                                        {line.timestamp.toFixed(2)}s
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Controls */}
                <div className="p-6 bg-[#1A1A1A] border-t border-white/5 z-10">
                    {/* Seek Bar */}
                    <div className="mb-6">
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white hover:accent-zinc-300"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onTimeUpdate={() => {
                                if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                            }}
                            onLoadedMetadata={() => {
                                if (audioRef.current) setDuration(audioRef.current.duration);
                            }}
                            onEnded={() => {
                                setIsPlaying(false);
                                // Auto complete if we reach end
                                if (currentIndex >= lyrics.length - 1) {
                                    onComplete(syncedData);
                                }
                            }}
                        />

                        {currentIndex >= lyrics.length ? (
                            <button
                                onClick={() => {
                                    handlePause();
                                    onComplete(syncedData);
                                }}
                                className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Finish Sync
                            </button>
                        ) : !isPlaying ? (
                            <button
                                onClick={handleStart}
                                className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {currentIndex === 0 && currentTime === 0 ? 'Start Syncing' : 'Resume'}
                            </button>
                        ) : (
                            <button
                                onClick={markCurrentLine}
                                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] shadow-lg"
                            >
                                TAP HERE (Spacebar)
                            </button>
                        )}
                    </div>
                    <div className="flex justify-between mt-6 items-center">
                        <button onClick={onBack} className="text-zinc-500 hover:text-white text-xs font-medium transition-colors">Back</button>
                        <button onClick={() => onComplete(syncedData)} className="text-zinc-500 hover:text-white text-xs font-medium transition-colors">Skip Sync</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncEditor;