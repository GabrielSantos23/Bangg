import { useState, useEffect } from "react";
import {
  initializeWhisper,
  checkWhisperStatus,
  getModelPath,
  type WhisperStatus,
} from "../lib/whisper";
import {
  startSystemAudioRecording,
  stopSystemAudioRecordingAndTranscribe,
} from "../lib/systemAudioRecording";
import { useUser } from "../hooks/useUser";
import {
  createTranscription,
  saveTranscriptionSegments,
} from "../services/transcription.server";

export default function TranscriptionPanel() {
  const { user } = useUser();
  const userId = user?.id;
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus | null>(
    null
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [modelPath, setModelPath] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    checkStatus();
    loadModelPath();
  }, []);

  async function checkStatus() {
    try {
      const status = await checkWhisperStatus();
      setWhisperStatus(status);
    } catch (err) {
      console.error("Failed to check status:", err);
    }
  }

  async function loadModelPath() {
    try {
      const path = await getModelPath();
      setModelPath(path);
    } catch (err) {
      console.error("Failed to get model path:", err);
    }
  }

  async function handleInitialize() {
    setIsInitializing(true);
    setError("");
    try {
      const result = await initializeWhisper("ggml-base.en.bin");
      console.log(result);
      await checkStatus();
    } catch (err) {
      setError(err as string);
      console.error("Failed to initialize:", err);
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleStartRecording() {
    // Prevent multiple clicks
    if (isRecording || isTranscribing || isStartingRecording) {
      console.warn("Recording already in progress, ignoring click");
      return;
    }

    setError("");
    setSaveSuccess(false);
    setTranscription(""); // Clear previous transcription
    setIsStartingRecording(true);

    try {
      // Create a new transcription session in the database first
      if (userId) {
        try {
          const newTranscription = await createTranscription({
            data: { userId, title: undefined },
          });
          setCurrentTranscriptionId(newTranscription.id);
          console.log("Transcription session created:", newTranscription.id);
        } catch (dbError) {
          console.warn("Failed to create transcription in database:", dbError);
          // Continue anyway - we can still transcribe without saving
        }
      }

      // Start recording - this should happen after DB creation
      console.log("Starting system audio recording...");
      try {
        await startSystemAudioRecording();
        console.log("Recording started successfully");
        setIsRecording(true);
        setIsStartingRecording(false);
      } catch (recordingError) {
        const errorMessage =
          recordingError instanceof Error
            ? recordingError.message
            : String(recordingError);

        // If recording is already in progress, try to stop it first and retry
        if (errorMessage.includes("Recording already in progress")) {
          console.warn("Recording state was stuck, attempting to reset...");
          try {
            // Try to stop any existing recording
            await stopSystemAudioRecordingAndTranscribe();
          } catch (stopError) {
            console.warn("Failed to stop existing recording:", stopError);
          }

          // Wait a bit and try again
          await new Promise((resolve) => setTimeout(resolve, 500));

          try {
            await startSystemAudioRecording();
            console.log("Recording started successfully after reset");
            setIsRecording(true);
            setIsStartingRecording(false);
          } catch (retryError) {
            setIsStartingRecording(false);
            throw retryError;
          }
        } else {
          setIsStartingRecording(false);
          throw recordingError;
        }
      }
    } catch (err) {
      // Reset state on error
      setIsRecording(false);
      setIsStartingRecording(false);
      setCurrentTranscriptionId(null);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to start recording: ${errorMessage}`);
      console.error("Recording error:", err);
    }
  }

  async function handleStopRecording() {
    try {
      setIsRecording(false);
      setIsTranscribing(true);

      // Stop recording and transcribe (all done in Rust backend)
      const segments = await stopSystemAudioRecordingAndTranscribe();
      
      // Combine all segments into a single text for display
      const fullText = segments.map(seg => seg.text).join(" ");
      setTranscription(fullText);

      // Save transcription segments to database if we have a transcription ID and userId
      if (segments && segments.length > 0 && currentTranscriptionId && userId) {
        setIsSaving(true);
        try {
          await saveTranscriptionSegments({
            data: {
              transcriptionId: currentTranscriptionId,
              segments: segments.map(seg => ({
                text: seg.text,
                startTime: seg.start,
                endTime: seg.end,
              })),
            },
          });
          setSaveSuccess(true);
          // Clear the transcription ID after saving
          setTimeout(() => {
            setCurrentTranscriptionId(null);
            setSaveSuccess(false);
          }, 3000);
        } catch (dbError) {
          console.error("Failed to save transcription to database:", dbError);
          setError(`Transcription completed but failed to save: ${dbError}`);
        } finally {
          setIsSaving(false);
        }
      }
    } catch (err) {
      setError(`Transcription failed: ${err}`);
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Whisper Transcription</h2>

        {/* Status Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Status</h3>
          {whisperStatus ? (
            <div className="space-y-2">
              <p>
                <span className="font-medium">Initialized:</span>{" "}
                <span
                  className={
                    whisperStatus.initialized
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {whisperStatus.initialized ? "Yes" : "No"}
                </span>
              </p>
              <p>
                <span className="font-medium">Model Path:</span>{" "}
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {modelPath}
                </code>
              </p>
            </div>
          ) : (
            <p className="text-gray-500">Loading status...</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Initialize Button */}
        {!whisperStatus?.initialized && (
          <div className="mb-6">
            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isInitializing ? "Initializing..." : "Initialize Whisper Model"}
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Make sure you have downloaded ggml-base.en.bin to: {modelPath}
            </p>
          </div>
        )}

        {/* Recording Controls */}
        {whisperStatus?.initialized && (
          <div className="mb-6">
            <div className="space-x-4">
              {!isRecording && !isTranscribing && !isStartingRecording && (
                <button
                  onClick={handleStartRecording}
                  disabled={isSaving}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  🎤 Start Recording System Audio
                </button>
              )}

              {isStartingRecording && (
                <div className="inline-block px-6 py-3 bg-blue-200 text-blue-700 rounded-lg font-medium">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span>Starting recording...</span>
                  </div>
                </div>
              )}

              {isRecording && (
                <button
                  onClick={handleStopRecording}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium animate-pulse"
                >
                  ⏹️ Stop Recording
                </button>
              )}

              {isTranscribing && (
                <div className="inline-block px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span>Transcribing...</span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 mt-3">
              📢 Recording system audio directly - no permission prompts needed!
            </p>
          </div>
        )}

        {/* Transcription Results */}
        {transcription && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Transcription</h3>
              {isSaving && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span>Saving...</span>
                </div>
              )}
              {saveSuccess && !isSaving && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <span>✓ Saved to database</span>
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-800 whitespace-pre-wrap">
                {transcription}
              </p>
            </div>
            {!userId && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ Not logged in - transcription will not be saved to database
              </p>
            )}
          </div>
        )}

        {/* Instructions */}
        {/* <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold mb-3">Setup Instructions</h3>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold mb-1">1. Download Whisper Model</h4>
              <p className="mb-2">Download a model from:</p>
              <a
                href="https://huggingface.co/ggerganov/whisper.cpp/tree/main"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://huggingface.co/ggerganov/whisper.cpp
              </a>
              <p className="mt-2">
                Place the model file (e.g., ggml-base.en.bin) in: <br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {modelPath}
                </code>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">2. Record and Transcribe</h4>
              <p>
                Click "Start Recording" to begin capturing system audio. No
                permission prompts needed! Play audio or speak, then click "Stop
                Recording" to get the transcription.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                <strong>Note:</strong> Currently works on Windows. System audio
                capture uses WASAPI loopback to capture desktop audio directly.
              </p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
