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
    const [hasSyncStarted, setHasSyncStarted] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [wasPlayingBeforeScrub, setWasPlayingBeforeScrub] = useState(false);

    // Inline edit state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLDivElement>(null);

    const handleStart = () => {
        if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
            setHasSyncStarted(true);
            // Reset timestamps if starting over
            if (currentIndex === 0 && currentTime === 0) {
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

    const handleResume = () => {
        if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const togglePlayback = () => {
        if (isPlaying) {
            handlePause();
        } else {
            handleResume();
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

    // --- Inline Edit Handlers ---
    const startEditing = (idx: number) => {
        // Pause playback when entering edit mode
        if (isPlaying) {
            handlePause();
        }
        setEditingIndex(idx);
        setEditText(syncedData[idx].text);
    };

    const saveEdit = () => {
        if (editingIndex === null) return;
        const trimmed = editText.trim();
        if (trimmed.length > 0) {
            setSyncedData(prev => {
                const updated = [...prev];
                updated[editingIndex] = { ...updated[editingIndex], text: trimmed };
                return updated;
            });
        }
        setEditingIndex(null);
        setEditText('');
    };

    const cancelEdit = () => {
        setEditingIndex(null);
        setEditText('');
    };

    // Focus input when editing starts
    useEffect(() => {
        if (editingIndex !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingIndex]);

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture keys when editing a line
            if (editingIndex !== null) return;

            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scroll
                if (!isPlaying && !hasSyncStarted && currentIndex === 0) {
                    handleStart();
                } else if (isPlaying) {
                    markCurrentLine();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, currentIndex, markCurrentLine, editingIndex, hasSyncStarted]);

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

    const handleDoubleClick = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        startEditing(idx);
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
            {/* Card Container */}
            <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col h-[650px] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1A1A1A]">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-1">Sync Lyrics</h2>
                        <p className="text-sm text-zinc-500">
                            Tap <kbd className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono text-xs border border-white/10">SPACE</kbd> when the line starts.
                            <span className="text-zinc-600 ml-2">•</span>
                            <span className="text-zinc-600 ml-2">Double-click a line to edit</span>
                        </p>
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
                        const isEditing = editingIndex === idx;

                        return (
                            <div
                                key={line.id}
                                ref={isActive ? activeLineRef : null}
                                onClick={() => {
                                    if (isEditing) return;
                                    // Allow manual jump (advanced usage)
                                    if (audioRef.current) {
                                        if (line.timestamp !== undefined) {
                                            audioRef.current.currentTime = line.timestamp;
                                            setCurrentIndex(idx);
                                        }
                                    }
                                }}
                                onDoubleClick={(e) => handleDoubleClick(idx, e)}
                                className={`p-4 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center relative group border
                                ${isEditing
                                        ? 'bg-zinc-800/80 border-white/20 shadow-lg shadow-white/5 ring-1 ring-white/10'
                                        : isActive
                                            ? 'bg-zinc-800 border-zinc-700 shadow-lg'
                                            : 'bg-transparent border-transparent hover:bg-zinc-900/50'
                                    }
                                ${isPast && !isEditing ? 'opacity-40 grayscale' : 'opacity-100'}
                            `}
                            >
                                {isEditing ? (
                                    <>
                                        <input
                                            ref={editInputRef}
                                            type="text"
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    saveEdit();
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    cancelEdit();
                                                }
                                            }}
                                            className="sync-edit-input w-full bg-transparent text-lg font-medium text-white text-center outline-none border-none transition-colors px-12"
                                            placeholder="Enter lyrics..."
                                        />
                                        {/* Save / Cancel buttons – absolutely positioned to the right */}
                                        <div className="absolute right-3 flex items-center gap-1.5">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    saveEdit();
                                                }}
                                                className="sync-edit-save flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-green-500/20 text-zinc-400 hover:text-green-400 flex items-center justify-center transition-all border border-white/10 hover:border-green-500/30"
                                                title="Save (Enter)"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    cancelEdit();
                                                }}
                                                className="sync-edit-cancel flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-all border border-white/10 hover:border-red-500/30"
                                                title="Cancel (Esc)"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className={`text-lg font-medium text-center transition-colors w-full px-12 ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                                            {line.text}
                                        </span>
                                        {/* Clickable edit icon on hover */}
                                        <button
                                            className="absolute left-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-zinc-300"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                startEditing(idx);
                                            }}
                                            title="Edit line"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                                {line.timestamp !== undefined && !isEditing && (
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
                            onMouseDown={handleScrubStart}
                            onMouseUp={handleScrubEnd}
                            onTouchStart={handleScrubStart}
                            onTouchEnd={handleScrubEnd}
                            className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white hover:accent-zinc-300"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onTimeUpdate={() => {
                                if (audioRef.current && !isScrubbing) setCurrentTime(audioRef.current.currentTime);
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
                        ) : !hasSyncStarted ? (
                            /* Initial start button – before any syncing has begun */
                            <button
                                onClick={handleStart}
                                className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Start Syncing
                            </button>
                        ) : (
                            /* Active syncing: Pause and Sync buttons */
                            <div className="flex flex-1 gap-3 h-12">
                                {/* Pause button - only shown during playback */}
                                {isPlaying && (
                                    <button
                                        onClick={handlePause}
                                        className="sync-pause-btn w-12 h-12 rounded-xl flex items-center justify-center border transition-all flex-shrink-0 bg-white/10 border-white/15 text-white hover:bg-white/15"
                                        title="Pause audio"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                        </svg>
                                    </button>
                                )}

                                {/* Main Action Button */}
                                {isPlaying ? (
                                    <button
                                        onClick={markCurrentLine}
                                        className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] shadow-lg"
                                    >
                                        Tap when line starts (Spacebar)
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleResume}
                                        className="flex-1 h-12 bg-white text-black hover:bg-zinc-200 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Resume Syncing
                                    </button>
                                )}
                            </div>
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