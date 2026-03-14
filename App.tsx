import React, { useState, useEffect } from 'react';
import { AppStep, ProjectState, AspectRatio } from './types';
import { DEFAULT_BACKGROUND_PROMPT, STEP_IDS } from './constants';
import StepIndicator from './components/StepIndicator';
import SyncEditor from './components/SyncEditor';
import VideoExporter from './components/VideoExporter';
import { suggestVisualPrompt } from './services/geminiService';

const App: React.FC = () => {
  // --- Global State ---
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  
  const [project, setProject] = useState<ProjectState>({
    audioFile: null,
    audioUrl: null,
    rawLyrics: '',
    parsedLyrics: [],
    backgroundVideoUrl: null,
    backgroundImageUrl: null,
    backgroundPrompt: DEFAULT_BACKGROUND_PROMPT,
    aspectRatio: '16:9',
    textColor: '#FFFFFF',
  });

  // Track max step
  useEffect(() => {
    const currentStepId = STEP_IDS[step];
    if (currentStepId > maxStepReached) {
        setMaxStepReached(currentStepId);
    }
  }, [step, maxStepReached]);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProject(prev => ({
        ...prev,
        audioFile: file,
        audioUrl: URL.createObjectURL(file),
      }));
      // Reset max step if audio changes, as it invalidates sync
      if (maxStepReached > 2) setMaxStepReached(2); 
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setProject(prev => ({
            ...prev,
            backgroundImageUrl: URL.createObjectURL(file),
        }));
    }
  };

  const parseLyrics = (text: string) => {
    // Split by new line, remove empty lines
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => ({ id: Math.random().toString(36).substr(2, 9), text: l }));
    
    setProject(prev => ({ ...prev, rawLyrics: text, parsedLyrics: lines }));
    
    // Auto suggest prompt (still useful for ideas, though we upload image now)
    if (lines.length > 0) {
      suggestVisualPrompt(text).then(prompt => {
         setProject(prev => ({ ...prev, backgroundPrompt: prompt }));
      }).catch(console.error);
    }
    
    // If lyrics change, sync might be off, but we don't strictly enforce reset unless needed.
    // However, moving to background usually implies we are moving forward.
    setStep(AppStep.BACKGROUND);
  };

  // --- Render Steps ---

  const renderUpload = () => (
    <div className="flex flex-col items-center justify-center p-12 border border-white/5 rounded-2xl bg-[#1A1A1A] w-full max-w-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-6 border border-white/5">
        <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
      </div>
      <h2 className="text-xl font-semibold mb-2 text-white">Upload Audio</h2>
      <p className="text-zinc-500 mb-8 text-center text-sm">Select the song you want to create a karaoke video for.</p>
      
      <input 
        type="file" 
        accept="audio/*" 
        onChange={handleFileChange} 
        className="hidden" 
        id="audio-upload"
      />
      <label 
        htmlFor="audio-upload"
        className="px-6 py-2.5 bg-white text-black font-medium text-sm rounded-lg cursor-pointer hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
      >
        Choose Audio File
      </label>
      {project.audioFile && (
        <div className="mt-8 flex flex-col items-center w-full animate-fade-in">
             <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-4 py-2 rounded-full border border-green-400/20 mb-6">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                <span className="text-xs font-medium">{project.audioFile.name}</span>
             </div>
             <button 
                onClick={() => setStep(AppStep.LYRICS)}
                className="w-full max-w-xs py-3 bg-zinc-800 text-white font-medium text-sm rounded-lg hover:bg-zinc-700 transition-all border border-white/5"
             >
                Continue to Lyrics
             </button>
        </div>
      )}
    </div>
  );

  const renderLyrics = () => (
    <div className="w-full max-w-2xl bg-[#1A1A1A] p-8 rounded-2xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">Lyrics</h2>
          <p className="text-zinc-500 text-sm">Paste your lyrics below. Each line represents a karaoke screen.</p>
      </div>
      <textarea
        className="w-full h-80 bg-[#121212] border border-zinc-800 rounded-xl p-6 text-zinc-300 focus:border-white/20 focus:outline-none mb-8 resize-none text-base leading-relaxed font-mono transition-colors"
        placeholder="Line 1&#10;Line 2&#10;..."
        value={project.rawLyrics}
        onChange={(e) => setProject(prev => ({ ...prev, rawLyrics: e.target.value }))}
      />
      <div className="flex justify-between items-center">
         <button onClick={() => setStep(AppStep.UPLOAD)} className="text-zinc-500 hover:text-white text-sm font-medium transition-colors">Back</button>
         <button 
            onClick={() => parseLyrics(project.rawLyrics)}
            disabled={!project.rawLyrics.trim()}
            className="px-6 py-2.5 bg-white text-black font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
         >
            Next: Background
         </button>
      </div>
    </div>
  );

  const renderBackground = () => (
    <div className="w-full max-w-2xl flex flex-col gap-6 bg-[#1A1A1A] p-8 rounded-2xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      
      {/* Aspect Ratio Selector */}
      <div className="grid grid-cols-2 gap-4 mb-2">
         <button 
            onClick={() => setProject(prev => ({...prev, aspectRatio: '16:9'}))}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${project.aspectRatio === '16:9' ? 'bg-zinc-800 border-white text-white' : 'bg-[#121212] border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
         >
            <div className="w-12 h-8 border-2 border-current rounded-sm"></div>
            <span className="text-xs font-semibold">16:9 Landscape</span>
         </button>
         <button 
            onClick={() => setProject(prev => ({...prev, aspectRatio: '9:16'}))}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${project.aspectRatio === '9:16' ? 'bg-zinc-800 border-white text-white' : 'bg-[#121212] border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
         >
            <div className="w-6 h-10 border-2 border-current rounded-sm"></div>
            <span className="text-xs font-semibold">9:16 Portrait</span>
         </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Background Image</h2>
        <p className="text-zinc-500 text-sm">Upload a high-quality 4K image.</p>
      </div>
      
      <div className="bg-[#121212] p-8 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center min-h-[300px] transition-colors hover:border-zinc-700">
        {project.backgroundImageUrl ? (
            <div className={`relative rounded-lg overflow-hidden mb-6 group border border-zinc-800 ${project.aspectRatio === '16:9' ? 'w-full aspect-video' : 'h-[400px] aspect-[9/16]'}`}>
                <img src={project.backgroundImageUrl} alt="Background" className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-white font-medium bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10">Change Image</span>
                </div>
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                />
            </div>
        ) : (
            <>
                <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                    <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-zinc-500 mb-6 text-center text-sm">Drop your image here or browse</p>
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="hidden" 
                    id="bg-upload"
                />
                <label 
                    htmlFor="bg-upload"
                    className="px-5 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white font-medium text-sm rounded-lg cursor-pointer transition-all border border-white/5"
                >
                    Select File
                </label>
            </>
        )}
      </div>

      <div className="flex justify-between items-center mt-4">
          <button onClick={() => setStep(AppStep.LYRICS)} className="text-zinc-500 hover:text-white text-sm font-medium transition-colors">Back</button>
          
          <button 
             onClick={() => setStep(AppStep.SYNC)} 
             disabled={!project.backgroundImageUrl}
             className="px-6 py-2.5 bg-white text-black font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
          >
             Next: Sync Lyrics
          </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch(step) {
      case AppStep.UPLOAD: return renderUpload();
      case AppStep.LYRICS: return renderLyrics();
      case AppStep.BACKGROUND: return renderBackground();
      case AppStep.SYNC: 
        return project.audioUrl ? (
            <SyncEditor 
                audioUrl={project.audioUrl} 
                lyrics={project.parsedLyrics}
                onBack={() => setStep(AppStep.BACKGROUND)}
                onComplete={(synced) => {
                    setProject(prev => ({ ...prev, parsedLyrics: synced }));
                    setStep(AppStep.PREVIEW);
                }}
            />
        ) : null;
      case AppStep.PREVIEW:
        return project.audioUrl ? (
            <VideoExporter 
                audioUrl={project.audioUrl}
                backgroundUrl={project.backgroundImageUrl || ''} 
                syncedLyrics={project.parsedLyrics}
                aspectRatio={project.aspectRatio}
                textColor={project.textColor}
                onTextColorChange={(color) => setProject(prev => ({...prev, textColor: color}))}
                onBack={() => setStep(AppStep.SYNC)}
            />
        ) : null;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-200 flex flex-col font-sans">
        {/* Header */}
        <header className="p-6 border-b border-white/5 sticky top-0 z-50 backdrop-blur-md bg-[#121212]/80">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                        <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-white">KaraokeGenius<span className="text-zinc-500 font-light ml-1">4K</span></h1>
                </div>
            </div>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center py-12 px-4">
            <StepIndicator 
                currentStep={step} 
                maxStep={maxStepReached}
                onStepClick={setStep}
            />
            
            <div className="w-full flex justify-center mt-4 mb-20">
                {renderContent()}
            </div>
        </main>
    </div>
  );
};

export default App;