function detectAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

let primedStreamPromise: Promise<MediaStream> | null = null;

/** Call synchronously inside the Scan button click handler, before opening the modal. */
export function primeIosCameraFromUserGesture(): void {
  if (!detectAppleMobile()) return;
  cancelPrimedIosCamera();
  primedStreamPromise = requestIosCameraStream();
}

export function takePrimedIosCameraStream(): Promise<MediaStream> | null {
  const promise = primedStreamPromise;
  primedStreamPromise = null;
  return promise;
}

export function cancelPrimedIosCamera(): void {
  if (!primedStreamPromise) return;
  void primedStreamPromise.then(stopMediaStream).catch(() => {});
  primedStreamPromise = null;
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

/** iOS Safari requires these attributes for inline camera preview. */
export function patchIosVideoElement(video: HTMLVideoElement): void {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "true");
  video.setAttribute("autoplay", "true");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.minHeight = "100%";
  video.style.objectFit = "cover";
  video.style.display = "block";
  video.style.backgroundColor = "transparent";
}

export function getCameraVideoTrack(
  stream: MediaStream | null | undefined
): MediaTrack | undefined {
  return stream?.getVideoTracks()[0];
}

/** Invoke getUserMedia synchronously from a user-gesture handler (pass the returned promise onward). */
export function requestIosCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("Camera API not supported"));
  }

  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  });
}

export function waitForVideoDimensions(
  video: HTMLVideoElement,
  timeoutMs = 4000
): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();

    const done = () => {
      cleanup();
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
      } else {
        reject(new Error("Camera preview has no frame dimensions"));
      }
    };

    const onTick = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        done();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        cleanup();
        reject(new Error("Timed out waiting for camera frames"));
        return;
      }
      window.setTimeout(onTick, 80);
    };

    const onPlaying = () => done();
    const onLoadedMetadata = () => {
      if (video.videoWidth > 0) done();
    };

    const cleanup = () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    onTick();
  });
}

export async function startIosVideoPreview(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  video.srcObject = stream;
  patchIosVideoElement(video);
  await video.play();
  await waitForVideoDimensions(video);
}

export async function applyIosStreamEnhancements(stream: MediaStream): Promise<void> {
  const track = getCameraVideoTrack(stream);
  if (!track?.applyConstraints) return;

  await new Promise((resolve) => setTimeout(resolve, 700));

  const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
    focusMode?: string[];
    zoom?: { min: number; max: number };
  };

  const advanced: MediaTrackConstraintSet[] = [];

  if (Array.isArray(caps?.focusMode) && caps.focusMode.includes("continuous")) {
    advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
  }

  if (caps?.zoom && typeof caps.zoom.max === "number") {
    const target = Math.min(2, caps.zoom.max);
    if (target > (caps.zoom.min ?? 1)) {
      advanced.push({ zoom: target } as MediaTrackConstraintSet);
    }
  }

  if (!advanced.length) return;

  try {
    await track.applyConstraints({ advanced });
  } catch {
    /* optional enhancements */
  }
}

export function readIosZoomRange(stream: MediaStream | null): {
  min: number;
  max: number;
  step: number;
} | null {
  const track = getCameraVideoTrack(stream ?? null);
  const caps = track?.getCapabilities?.() as { zoom?: { min: number; max: number; step?: number } };
  if (!caps?.zoom) return null;
  return {
    min: caps.zoom.min ?? 1,
    max: caps.zoom.max ?? 1,
    step: caps.zoom.step ?? 0.1,
  };
}

export function isIosTorchSupported(stream: MediaStream | null): boolean {
  const track = getCameraVideoTrack(stream ?? null);
  const caps = track?.getCapabilities?.() as { torch?: boolean };
  return caps?.torch === true;
}

export async function setIosTorch(stream: MediaStream | null, enabled: boolean): Promise<void> {
  const track = getCameraVideoTrack(stream ?? null);
  if (!track) return;
  await track.applyConstraints({
    advanced: [{ torch: enabled } as MediaTrackConstraintSet],
  } as MediaTrackConstraints);
}

export async function setIosZoom(stream: MediaStream | null, zoom: number): Promise<void> {
  const track = getCameraVideoTrack(stream ?? null);
  if (!track) return;
  await track.applyConstraints({
    advanced: [{ zoom } as MediaTrackConstraintSet],
  } as MediaTrackConstraints);
}
