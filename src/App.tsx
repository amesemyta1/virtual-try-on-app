import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Shirt, User, Image as ImageIcon, Loader } from 'lucide-react';

const API_KEY = import.meta.env.VITE_API_KEY;
const API_BASE_URL = 'https://api.fashn.ai/v1';

function App() {
  const [modelUrl, setModelUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [predictionStatus, setPredictionStatus] = useState<string | null>(null);
  const [garmentUrl, setGarmentUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get garment image URL from query parameters
    const params = new URLSearchParams(window.location.search);
    const garmentImageUrl = params.get('garment_image');
    if (garmentImageUrl) {
      // Validate URL
      try {
        new URL(garmentImageUrl);
        setGarmentUrl(garmentImageUrl);
      } catch {
        console.error('Invalid garment image URL:', garmentImageUrl);
      }
    }
  }, []);

  const handleLoadModel = () => {
    if (modelUrl) {
      setModelPreview(modelUrl);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setModelPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startPrediction = async () => {
    if (!modelPreview || !garmentUrl) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_image: modelPreview,
          garment_image: garmentUrl,
          category: "auto"
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setPredictionId(data.id);
      setPredictionStatus('starting');
    } catch (error) {
      console.error('Error starting prediction:', error);
      setIsLoading(false);
    }
  };

  const checkPredictionStatus = useCallback(async () => {
    if (!predictionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/status/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      });

      const data = await response.json();
      setPredictionStatus(data.status);

      if (data.status === 'completed' && data.output) {
        setGeneratedResult(data.output[0]);
        setIsLoading(false);
        setPredictionId(null);
      } else if (data.status === 'failed') {
        console.error('Prediction failed:', data.error);
        setIsLoading(false);
        setPredictionId(null);
      }
    } catch (error) {
      console.error('Error checking prediction status:', error);
    }
  }, [predictionId]);

  useEffect(() => {
    let intervalId: number;

    if (predictionId && predictionStatus !== 'completed' && predictionStatus !== 'failed') {
      intervalId = window.setInterval(checkPredictionStatus, 5000);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [predictionId, predictionStatus, checkPredictionStatus]);

  const handleGenerateTryOn = () => {
    startPrediction();
  };

  const handleTryAgain = () => {
    setModelUrl('');
    setModelPreview(null);
    setGeneratedResult(null);
    setPredictionId(null);
    setPredictionStatus(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Garment Preview Section */}
        <div className="bg-slate-800 rounded-xl p-6 flex flex-col">
          <h2 className="text-slate-200 text-xl font-semibold mb-4 flex items-center gap-2">
            <Shirt className="w-5 h-5" />
            Garment Preview
          </h2>
          <div className="flex-1 bg-slate-700/50 rounded-lg flex items-center justify-center p-4">
            {garmentUrl ? (
              <img
                src={garmentUrl}
                alt="Garment Preview"
                className="max-w-full max-h-[400px] object-contain rounded-lg"
              />
            ) : (
              <div className="text-slate-400 text-center">
                <Shirt className="w-20 h-20 mx-auto mb-2" />
                <p>No garment image provided</p>
                <p className="text-sm mt-2">Add ?garment_image=URL to the page URL</p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Model Section */}
        <div className="bg-slate-800 rounded-xl p-6 flex flex-col">
          <h2 className="text-slate-200 text-xl font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Upload Model Photo
          </h2>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                placeholder="Paste model photo URL"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLoadModel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Load URL
              </button>
            </div>
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
              >
                Choose File
              </label>
            </div>
            <div className="flex-1 bg-slate-700/50 rounded-lg flex items-center justify-center p-4">
              {modelPreview ? (
                <img
                  src={modelPreview}
                  alt="Model Preview"
                  className="max-w-full max-h-[300px] object-contain rounded-lg"
                />
              ) : (
                <User className="w-20 h-20 text-slate-600" />
              )}
            </div>
            <button
              onClick={handleGenerateTryOn}
              disabled={!modelPreview || !garmentUrl || isLoading}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {predictionStatus ? `Status: ${predictionStatus}` : 'Generating...'}
                </>
              ) : (
                'Generate Try-On'
              )}
            </button>
          </div>
        </div>

        {/* Result Section */}
        <div className="bg-slate-800 rounded-xl p-6 flex flex-col">
          <h2 className="text-slate-200 text-xl font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Result
          </h2>
          <div className="flex-1 bg-slate-700/50 rounded-lg flex items-center justify-center p-4">
            {generatedResult ? (
              <img
                src={generatedResult}
                alt="Generated Result"
                className="max-w-full max-h-[400px] object-contain rounded-lg"
              />
            ) : (
              <ImageIcon className="w-20 h-20 text-slate-600" />
            )}
          </div>
          {generatedResult && (
            <button
              onClick={handleTryAgain}
              className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;