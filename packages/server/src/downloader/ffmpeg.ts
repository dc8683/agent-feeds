export async function videoToAudio(_videoPath: string, _outputDir: string): Promise<string> {
  throw new Error('Video processing not available in MVP');
}

export async function splitAudio(_audioPath: string, _chunkSeconds: number, _outputDir: string): Promise<string[]> {
  throw new Error('Audio splitting not available in MVP');
}
