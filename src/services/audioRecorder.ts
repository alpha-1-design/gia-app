export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private _isRecording = false;
  private stopReject: ((reason?: unknown) => void) | null = null;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;

  get isRecording() { return this._isRecording; }

  async start(): Promise<void> {
    if (this._isRecording) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
    this._isRecording = true;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this._isRecording) {
        reject(new Error('Not recording'));
        return;
      }

      this.stopReject = reject;

      this.stopTimeout = setTimeout(() => {
        this.stopReject = null;
        this.stopTimeout = null;
        reject(new Error('Recording stop timed out'));
        this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
        this.mediaRecorder = null;
        this.chunks = [];
        this._isRecording = false;
      }, 5000);

      this.mediaRecorder.onstop = () => {
        if (this.stopTimeout) clearTimeout(this.stopTimeout);
        this.stopTimeout = null;
        this.stopReject = null;
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
        this.mediaRecorder = null;
        this.chunks = [];
        this._isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    if (this.stopReject) {
      this.stopReject(new Error('Recording cancelled'));
      this.stopReject = null;
    }
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.mediaRecorder) {
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      this.mediaRecorder = null;
    }
    this.chunks = [];
    this._isRecording = false;
  }
}
