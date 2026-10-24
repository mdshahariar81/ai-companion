export type VoiceInput = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  getLevel: () => number;
  stop: () => void;
};

export async function startVoiceInput(): Promise<VoiceInput> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioContextClass =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("AudioContext is not supported.");
  }

  const context = new AudioContextClass();

  if (context.state === "suspended") {
    await context.resume();
  }

  const source = context.createMediaStreamSource(stream);

  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;

  source.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);

  const getLevel = () => {
    analyser.getByteTimeDomainData(data);

    let sum = 0;

    for (const value of data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / data.length);

    return Math.min(1, rms * 4);
  };

  const stop = () => {
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
  };

  return {
    stream,
    context,
    analyser,
    getLevel,
    stop,
  };
}
