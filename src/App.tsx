import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Shirt, User, Image as ImageIcon, Loader, AlertCircle, Camera, X, SwitchCamera } from 'lucide-react';

const API_KEY = import.meta.env.VITE_API_KEY;
const API_BASE_URL = 'https://api.fashn.ai/v1';

interface ErrorState {
  message: string;
  type: 'error' | 'warning' | 'info';
}

// Компонент камеры
const CameraModal = ({ onCapture, onClose }: { onCapture: (image: string) => void; onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startCamera = useCallback(async () => {
    try {
      // Остановим предыдущий стрим, если он есть
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      onClose();
    }
  }, [facingMode, onClose]);

  const toggleCamera = useCallback(() => {
    setFacingMode(current => current === 'user' ? 'environment' : 'user');
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Зеркально отображаем фото с фронтальной камеры
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL('image/jpeg', 0.8);
    onCapture(image);
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="relative flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={toggleCamera}
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 text-white rounded-full transition-colors backdrop-blur-sm"
            title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-red-600/80 hover:bg-red-700/80 text-white rounded-full transition-colors backdrop-blur-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="bg-slate-900 p-4 flex justify-center">
        <button
          onClick={takePhoto}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center"
        >
          <div className="w-14 h-14 rounded-full border-4 border-emerald-500" />
        </button>
      </div>
    </div>
  );
};

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [predictionStatus, setPredictionStatus] = useState<string | null>(null);
  const [garmentUrl, setGarmentUrl] = useState<string>('');
  const [error, setError] = useState<ErrorState | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showError = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setError({ message, type });
    setTimeout(() => setError(null), 5000);
  };

  useEffect(() => {
    // Get garment image URL from query parameters
    const params = new URLSearchParams(window.location.search);
    const garmentImageUrl = params.get('garment_image');
    if (garmentImageUrl) {
      try {
        new URL(garmentImageUrl);
        setGarmentUrl(garmentImageUrl);
      } catch {
        showError('Invalid garment image URL provided', 'warning');
      }
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      showError('No file selected', 'warning');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showError('Please select an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setModelPreview(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      showError('Error reading file', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (image: string) => {
    setModelPreview(image);
  };

  const startPrediction = async () => {
    if (!modelPreview) {
      showError('Please upload or take a photo of the model', 'warning');
      return;
    }
    if (!garmentUrl) {
      showError('Please provide a garment image URL', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Логируем данные запроса
      console.log('Sending request with:', {
        modelImage: modelPreview.substring(0, 100) + '...',
        garmentImage: garmentUrl
      });

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
      
      // Логируем ответ API
      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });

      if (!response.ok) {
        throw new Error(
          data?.error || 
          `API request failed with status ${response.status}: ${response.statusText}`
        );
      }

      if (data.error) {
        // Детальное логирование ошибки API
        console.error('API Error Details:', {
          error: data.error,
          fullResponse: data
        });
        throw new Error(typeof data.error === 'object' ? JSON.stringify(data.error) : data.error);
      }

      if (!data.id) {
        throw new Error('Invalid response: missing prediction ID');
      }

      setPredictionId(data.id);
      setPredictionStatus('starting');
    } catch (error) {
      console.error('Error details:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'Failed to start prediction';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }

      showError(errorMessage, 'error');
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

      // Логируем статус
      console.log('Status check response:', {
        predictionId,
        status: response.status,
        data: data
      });

      if (!response.ok) {
        throw new Error(
          data?.error || 
          `Status check failed with status ${response.status}: ${response.statusText}`
        );
      }

      if (data.error) {
        console.error('Status check error details:', data);
        throw new Error(typeof data.error === 'object' ? JSON.stringify(data.error) : data.error);
      }

      if (!data.status) {
        throw new Error('Invalid response: missing status');
      }

      setPredictionStatus(data.status);

      if (data.status === 'completed') {
        if (!data.output || !Array.isArray(data.output) || data.output.length === 0) {
          throw new Error('Invalid response: missing or empty output array');
        }
        setGeneratedResult(data.output[0]);
        setIsLoading(false);
        setPredictionId(null);
        setError(null);
      } else if (data.status === 'failed') {
        throw new Error(data.error || 'Prediction failed without specific error message');
      }
    } catch (error) {
      console.error('Status check error details:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'Failed to check prediction status';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }

      showError(errorMessage, 'error');
      setIsLoading(false);
      setPredictionId(null);
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

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      {error && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          error.type === 'error' ? 'bg-red-500' : 
          error.type === 'warning' ? 'bg-yellow-500' : 
          'bg-blue-500'
        } text-white flex items-center gap-2 max-w-md`}>
          <AlertCircle className="w-5 h-5" />
          <p>{error.message}</p>
        </div>
      )}

      {showCamera && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
      
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
                onError={() => showError('Failed to load garment image', 'error')}
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
            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                  Choose File
                </label>
              </div>
              <button
                onClick={() => setShowCamera(true)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
            </div>
            <div className="flex-1 bg-slate-700/50 rounded-lg flex items-center justify-center p-4">
              {modelPreview ? (
                <img
                  src={modelPreview}
                  alt="Model Preview"
                  className="max-w-full max-h-[300px] object-contain rounded-lg"
                  onError={() => showError('Failed to load model image', 'error')}
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
                onError={() => showError('Failed to load result image', 'error')}
              />
            ) : (
              <ImageIcon className="w-20 h-20 text-slate-600" />
            )}
          </div>
          {generatedResult && (
            <button
              onClick={() => {
                setModelPreview(null);
                setGeneratedResult(null);
                setPredictionId(null);
                setPredictionStatus(null);
                setError(null);
                setIsLoading(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
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