import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';
import { Model, Recognizer } from 'vosk';
import fsSync from 'fs';
import { Readable } from 'stream';

const audioDir = path.join('uploads');
const modelPath = '/home/arkadeep/limelight/server/services/models/vosk-model';


export const generateTranscript = async (videoPath, videoId) => {
    const wavPath = path.join(audioDir, `${videoId}_audio.wav`);
    const segments = [];

    try {
        console.log(`🎙️ Extracting audio from video: ${videoPath}`);

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .noVideo()
                .audioChannels(1)
                .audioFrequency(16000)
                .format('wav')
                .on('end', resolve)
                .on('error', (err) => {
                    console.error('❌ ffmpeg audio extraction error:', err.message);
                    reject(err);
                })
                .save(wavPath);
        });

        console.log(`🧠 Loading Vosk model from: ${modelPath}`);
        const model = new Model(modelPath);
        const recognizer = new Recognizer({ model, sampleRate: 16000 });
        recognizer.setWords(true); // enable word-level timestamps

        return await new Promise((resolve) => {
            const stream = fsSync.createReadStream(wavPath, { highWaterMark: 4096 });

            stream.on('data', (chunk) => {
                if (recognizer.acceptWaveform(chunk)) {
                    const result = recognizer.result();
                    if (result && result.text) {
                        const start = result.result?.[0]?.start || 0;
                        segments.push({
                            start: formatTime(start),

                            text: result.text
                        });
                    }
                }
            });

            stream.on('end', () => {
                const finalResult = recognizer.finalResult();
                if (finalResult?.text) {
                    const start = finalResult.result?.[0]?.start || 0;
                    segments.push({
                        start: formatTime(start),

                        text: finalResult.text
                    });
                }

                recognizer.free();
                model.free();

                resolve(segments); // resolved as JSON array
            });

            stream.on('error', (err) => {
                console.error('❌ Stream error during Vosk transcription:', err.message);
                recognizer.free();
                model.free();
                resolve(null);
            });
        });

    } catch (err) {
        console.error('❌ Transcription failed:', err.message);
        return null;
    } finally {
        // await fs.remove(wavPath); // optionally delete .wav after use
    }
};

// Convert seconds to HH:mm:ss
function formatTime(seconds) {
    const date = new Date(null);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}
