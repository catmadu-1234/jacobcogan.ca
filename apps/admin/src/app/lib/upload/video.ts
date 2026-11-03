import { canvasToWebp, fitWidth, makeCanvas, sampleColor } from "./resize";

const HEAD_TAIL_BYTES = 2 * 1024 * 1024;
const FALLBACK = { width: 1280, height: 720 };
const NEUTRAL = "#ededea";

const HVC1 = [0x68, 0x76, 0x63, 0x31]; // "hvc1"
const HEV1 = [0x68, 0x65, 0x76, 0x31]; // "hev1"

function includesBytes(haystack: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** True when the bytes contain an HEVC sample entry, a codec Chrome/Firefox on many machines cannot play. */
export function sniffHevc(bytes: Uint8Array): boolean {
  return includesBytes(bytes, HVC1) || includesBytes(bytes, HEV1);
}

/** Time of the poster frame: early in the clip, but not past the middle of a very short one. */
export function posterTime(duration: number): number {
  return Math.min(0.1, duration / 2);
}

/** The first and last 2 MB, which is where MP4/MOV store their codec info. */
async function readEnds(file: File): Promise<Uint8Array> {
  const head = new Uint8Array(await file.slice(0, HEAD_TAIL_BYTES).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(HEAD_TAIL_BYTES, file.size - HEAD_TAIL_BYTES)).arrayBuffer());
  const both = new Uint8Array(head.length + tail.length);
  both.set(head);
  both.set(tail, head.length);
  return both;
}

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  poster: Blob;
  color: string;
  hevc: boolean;
}

function once(target: HTMLVideoElement, event: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), ms);
    target.addEventListener(event, onEvent);
    target.addEventListener("error", onError);
  });
}

async function greyPoster(): Promise<Blob> {
  const canvas = makeCanvas(FALLBACK.width, FALLBACK.height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = NEUTRAL;
  ctx.fillRect(0, 0, FALLBACK.width, FALLBACK.height);
  return canvasToWebp(canvas);
}

/**
 * Reads size and duration, grabs a poster frame and checks for HEVC. If this browser cannot decode the video
 * at all it is reported as HEVC (so the editor warns) with a plain grey poster.
 */
export async function videoInfo(file: File): Promise<VideoInfo> {
  const hevcBytes = sniffHevc(await readEnds(file));
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    video.src = url;
    const loaded = await once(video, "loadeddata", 10_000);
    if (!loaded || video.videoWidth === 0) {
      return { ...FALLBACK, duration: 0, poster: await greyPoster(), color: NEUTRAL, hevc: true };
    }
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seeked = once(video, "seeked", 5_000);
    video.currentTime = posterTime(duration);
    await seeked;
    const size = fitWidth(video.videoWidth, video.videoHeight, 1200);
    const canvas = makeCanvas(size.width, size.height);
    (canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D).drawImage(video, 0, 0, size.width, size.height);
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration,
      poster: await canvasToWebp(canvas),
      color: sampleColor(video),
      hevc: hevcBytes,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
