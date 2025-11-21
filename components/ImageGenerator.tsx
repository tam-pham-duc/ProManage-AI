import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon, Download, Maximize, Loader2 } from 'lucide-react';
import { AspectRatio } from '../types';
import { generateImageWithGemini } from '../services/geminiService';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const imageUrl = await generateImageWithGemini(prompt, aspectRatio);
      setGeneratedImage(imageUrl);
    } catch (err: any) {
      setError(err.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const aspectRatios: { value: AspectRatio; label: string; iconClass: string }[] = [
    { value: '1:1', label: 'Square (1:1)', iconClass: 'w-6 h-6' },
    { value: '4:3', label: 'Landscape (4:3)', iconClass: 'w-8 h-6' },
    { value: '3:4', label: 'Portrait (3:4)', iconClass: 'w-6 h-8' },
    { value: '16:9', label: 'Widescreen (16:9)', iconClass: 'w-10 h-5' },
    { value: '9:16', label: 'Story (9:16)', iconClass: 'w-5 h-10' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="text-indigo-600 dark:text-indigo-400" />
          Creative Asset Generator
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Generate high-quality visuals for your projects using Imagen 4.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Section */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Prompt Input */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="w-full h-32 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none transition-colors"
            />
          </div>

          {/* Aspect Ratio Selector */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Maximize size={16} />
              Aspect Ratio
            </label>
            <div className="grid grid-cols-2 gap-3">
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => setAspectRatio(ratio.value)}
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                    ${aspectRatio === ratio.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600 dark:ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }
                  `}
                >
                  <div className={`bg-current opacity-20 rounded-sm mb-2 ${ratio.iconClass}`}></div>
                  <span className="text-xs font-medium">{ratio.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`
              w-full py-3 px-4 rounded-xl font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95
              ${isGenerating || !prompt.trim()
                ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-xl hover:scale-[1.02]'
              }
            `}
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generate Image
              </>
            )}
          </button>
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2 border border-red-100 dark:border-red-800">
              <span className="mt-0.5">⚠️</span>
              {error}
            </div>
          )}
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 dark:bg-black/40 rounded-xl shadow-inner overflow-hidden min-h-[400px] flex items-center justify-center relative border border-slate-800 dark:border-slate-700">
            {generatedImage ? (
              <div className="relative group w-full h-full flex items-center justify-center p-4">
                <img 
                  src={generatedImage} 
                  alt={prompt} 
                  className="max-w-full max-h-[600px] object-contain rounded-lg shadow-2xl"
                />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={generatedImage} 
                      download={`generated-${aspectRatio}.jpg`}
                      className="bg-white/90 hover:bg-white text-slate-900 p-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium"
                    >
                      <Download size={16} />
                      Download
                    </a>
                </div>
              </div>
            ) : (
              <div className="text-center p-12">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                  <ImageIcon size={32} />
                </div>
                <h3 className="text-slate-300 font-medium text-lg">Ready to Create</h3>
                <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">
                  Select an aspect ratio and enter a prompt to generate high-resolution assets.
                </p>
              </div>
            )}
            
            {/* Loading Overlay inside the frame for better UX */}
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-900/80 dark:bg-black/80 flex flex-col items-center justify-center z-10">
                 <Loader2 size={48} className="text-indigo-500 animate-spin mb-4" />
                 <p className="text-white font-medium animate-pulse">Creating your masterpiece...</p>
                 <p className="text-slate-400 text-sm mt-2">This may take a few seconds.</p>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-right text-xs text-slate-500 dark:text-slate-400">
            Powered by Google Imagen 4.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;