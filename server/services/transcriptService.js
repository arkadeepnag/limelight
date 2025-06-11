// file: services/transcriptService.js

import path from 'path';
import fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import { whisper } from 'whisper-node';

// Path to the downloaded Whisper model (ggml-base.en.bin or similar)
const modelPath = path.join(process.cwd(), 'models', 'ggml-base.en.bin');

/**
 * Generates a transcript from a video by:
 * 1. Extracting audio (WAV 16kHz mono),
 * 2. Running Whisper,
 * 3. Cleaning up temp audio,
 * 4. Returning the full transcript.
 */
export const generateTranscript = async (videoFilePath, videoId) => {
    console.log(`🔤 Starting transcript generation for video: ${videoId}`);

    // Ensure output directory for audio exists
    const audioOutputPath = path.join('uploads', `${videoId}_audio.wav`);
    await fs.ensureDir(path.dirname(audioOutputPath));

    // Step 1: Extract audio in proper format
    await new Promise((resolve, reject) => {
        ffmpeg(videoFilePath)
            .outputOptions([
                '-ar 16000', // 16 kHz sample rate
                '-ac 1',     // Mono channel
                '-f wav'     // Format WAV
            ])
            .output(audioOutputPath)
            .on('start', cmd => console.log('🎙️ ffmpeg started:', cmd))
            .on('end', () => {
                console.log('✅ Audio extracted to:', audioOutputPath);
                resolve();
            })
            .on('error', err => {
                console.error('❌ ffmpeg error:', err);
                reject(err);
            })
            .run();
    });

    // Step 2: Transcribe with Whisper
    let transcriptText = '';
    try {
        const transcript = await whisper(audioOutputPath, {
            modelPath,
            whisperOptions: {
                language: 'en',
            },
        });

        if (transcript && Array.isArray(transcript) && transcript.length > 0) {
            transcriptText = transcript.map(t => t.text).join(' ');
            console.log(`📝 Transcript generated successfully for ${videoId}`);
        } else {
            console.warn('⚠️ Empty or invalid transcript response from whisper.');
        }
    } catch (err) {
        console.error('❌ Whisper transcription failed:', err);
        throw new Error('Whisper failed to generate transcript');
    }

    // Step 3: Clean up extracted audio file
    try {
        await fs.remove(audioOutputPath);
        console.log('🧹 Temp audio cleaned up');
    } catch (cleanupErr) {
        console.warn('⚠️ Failed to delete temp audio file:', cleanupErr);
    }

    return transcriptText;
};
