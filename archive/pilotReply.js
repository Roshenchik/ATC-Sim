// pilotReply.js - module to assemble and play callsign audio from single-character mp3 files
// Usage:
// import { setAudioBasePath, preloadAll, buildCallsignSequence, playPilotConfirm, stopPlayback } from './pilotReply.js'

import { airlinePrefixes } from '../callsignAliases.js';

const phraseList = [
  // Vertical movement
  "CLIMBING FLIGHT LEVEL",
  "DESCENDING FLIGHT LEVEL",
  "CLIMBING TO ALTITUDE",
  "DESCENDING TO ALTITUDE",
  "FEET",
  "FLIGHT LEVEL",

  // Heading / turning
  "HEADING",
  "TURNING RIGHT",
  "TURNING LEFT",

  // Speed
  "SPEED",
  "KILOMETERS PER HOUR",
  "KNOTS",
  "MACH NUMBER",

  // Status / situational
  "READY TO LAND",
  "GOING AROUND",
  "TRAFFIC ON TCAS",
  "TRAFFIC IN SIGHT",
  "WILCO",

  // Companies
  "AEROFLOT",
  "FINNAIR",
  "KLM",
  "LUFTHANSA",
  "RYANAIR",
  "SCANDINAVIAN",
  "SPEED BIRD",
];

const DEFAULT_BASE = './responces/friendly guy/'; // default folder for mp3 files
let basePath = DEFAULT_BASE;

// cache of Audio objects by filename (e.g. "A.mp3", "1.mp3")
const audioCache = new Map();
let currentPlayback = { cancelled: false };

export function setAudioBasePath(path) {
  basePath = path;
}

// preload a list of phrase files plus default chars A-Z,0-9
export async function preloadAssets() {
  const responces = [];

  for (const phrase of phraseList) {
    responces.push(phraseToFilename(phrase)); // e.g. "climbing_flight_level.mp3"
  }
  responces.push(...getDefaultChars()); // A-Z,0-9

  const promises = responces.map(ch => preloadOne(ch));
  await Promise.all(promises);
  return true;
}
console.log(audioCache)

async function preloadOne(char) {
  const key = `${char.toLowerCase()}.mp3`;
  if (audioCache.has(key)) return audioCache.get(key);

  const url = basePath + key;
  const audio = new Audio(url);
  audio.preload = 'auto';

  // Wrap load in a promise that resolves when 'canplaythrough' fires or rejects on error
  const p = new Promise((resolve, reject) => {
    const onCan = () => {
      cleanup();
      resolve(audio);
    };
    const onErr = (e) => {
      cleanup();
      reject(new Error(`Failed to preload ${url}: ${e?.message || e}`));
    };
    function cleanup() {
      audio.removeEventListener('canplaythrough', onCan);
      audio.removeEventListener('error', onErr);
    }
    audio.addEventListener('canplaythrough', onCan);
    audio.addEventListener('error', onErr);
    // start loading
    audio.load(); // trigger forced load, browsers may delay otherwise
  });

  // store placeholder promise to prevent double-load races
  audioCache.set(key, p);

  const resolved = await p;
  audioCache.set(key, resolved);
  return resolved;
}

function phraseToFilename(phrase) {
  if (!phrase) return;
  return phrase
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getDefaultChars() {
  const chars = []
  for (let i = 65; i <= 90; i++) chars.push(String.fromCharCode(i)); // A..Z
  for (let d = 0; d <= 9; d++) chars.push(String(d)); // 0..9
  return chars;
}

// stop any current playback
export function stopPlayback() {
  currentPlayback.cancelled = true;
}

// internal: play array of filenames sequentially, returns when done or cancelled
async function playFilesSequential(filenames, gapMs = 0) {
  // cancel any previous playback
  currentPlayback.cancelled = false;
  const token = currentPlayback;

  for (const file of filenames) {
    if (token.cancelled) break;

    let audioObj = audioCache.get(file);
    if (!audioObj) {
      try {
        audioObj = await preloadOne(file.replace(/\.mp3$/i, ''));
      } catch (e) {
        console.warn('playFilesSequential: failed to load', file, e);
        continue;
      }
    }

    // clone audio to avoid interfering with cached Audio playback state
    const instance = audioObj.cloneNode(true);
    try {
      // browsers require a user gesture to allow autoplay in some cases.
      await instance.play();
    } catch (err) {
      console.warn('Audio play blocked or failed for', file, err);
      // still wait for ended event if possible
    }

    // wait for ended or for approximate duration
    await new Promise(resolve => {
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        instance.removeEventListener('ended', onEnded);
        instance.removeEventListener('error', onError);
      };
      instance.addEventListener('ended', onEnded);
      instance.addEventListener('error', onError);

      // safety timeout: if 'ended' doesn't fire, resolve after duration + 200ms
      const safety = setTimeout(() => {
        cleanup();
        resolve();
      }, (instance.duration && !isNaN(instance.duration) ? instance.duration * 1000 : 700) + 200);

      // if cancelled meanwhile, stop the instance
      const checkCancel = () => {
        if (token.cancelled) {
          try { instance.pause(); instance.currentTime = 0; } catch (e) {}
          clearTimeout(safety);
          cleanup();
          resolve();
        }
      };
      // poll cancellation every 50ms
      const poll = setInterval(() => {
        if (token.cancelled) {
          clearInterval(poll);
          checkCancel();
        }
      }, 50);
    });

    // small gap between clips
    await new Promise(r => setTimeout(r, gapMs));
  }
}

// Public: play callsign letters and digits (e.g. 'BAW232')
export async function buildCallsignSequence(prefix, number) {
  const fileSeq = [];
  const prefUp = prefix.toUpperCase();
  const isFullName = airlinePrefixes.hasOwnProperty(prefUp);

  if (isFullName) {
    const audioFileName = phraseToFilename(airlinePrefixes[prefUp]);
    let isAudioFile = audioCache.has(`${audioFileName}.mp3`);
    if (!isAudioFile) {
      try {
        await preloadOne(audioFileName);
        isAudioFile = audioCache.has(`${audioFileName}.mp3`);
      } catch (e) {
        console.warn('Failed to preload airline audio:', audioFileName, e);
        isAudioFile = false;
      }
    }

    if (isAudioFile) {
      fileSeq.push(`${audioFileName}.mp3`);
    } else {
      prefix.toLowerCase().split('').forEach(ch => fileSeq.push(`${ch}.mp3`));
    }
  } else {
    prefix.toLowerCase().split('').forEach(ch => fileSeq.push(`${ch}.mp3`));
  }

  number.split('').forEach(num => fileSeq.push(`${num}.mp3`));

  return fileSeq
}


export async function playPilotConfirm(prefix, number, extraWords  = ['wilco']) {
  if (!prefix && !number) return;

  const files = []
  const callsign = await buildCallsignSequence(prefix, number)
  
  if (extraWords) {
    extraWords.forEach(extra => {
      if (extra === null) return
      return files.push(`${phraseToFilename(extra)}.mp3`);
    });
  }

  callsign.forEach(s => files.push(s));

  await playFilesSequential(files);
}

export async function playPilotReport(prefix, number, extraWords = null) {
  if (!prefix && !number) return;

  const files = []
  const callsign = await buildCallsignSequence(prefix, number)

  callsign.forEach(s => files.push(s));

  if (extraWords) {
    extraWords.forEach(extra => {
      if (extra === null) return
      return files.push(`${phraseToFilename(extra)}.mp3`);
    });
  }

  await playFilesSequential(files);
}



export function confirmHeadingChange(plane, newAngle) {
  const angle = plane.angle
  const side = plane.turnDirection(newAngle, angle)
  let nums = newAngle.toString().padStart(3, '0').split('')
  let affirmWord = 'wilco' //just in case, instead of null

  if (side > 0) {
    affirmWord = 'turning right'
  } else if (side < 0) {
    affirmWord = 'turning left'
  } else {
    sayReachedHeading(plane);
    return;
  }
  const confirm = [affirmWord, 'heading', nums].flat();

  playPilotConfirm(plane.callsignPrefix, plane.callsignNum, confirm)
}
export function sayReachedHeading(plane) {
  let nums = plane.angle.toString().split('')
  const report = ['heading', nums].flat();

  playPilotReport(plane.callsignPrefix, plane.callsignNum, report)
}


export function confirmAltitudeChange(plane, newFL) {
  let nums = newFL.toString().split('')
  let affirmWord = 'wilco' //just in case, instead of null

  if (plane.altitude < plane.targetAltitude) {
    affirmWord = 'climbing flight level';
  } else if (plane.altitude > plane.targetAltitude) {
    affirmWord = 'descending flight level';
  } else {
    sayReachedAltitude(plane);
    return;
  }
  const confirm = [affirmWord, nums].flat();

  playPilotConfirm(plane.callsignPrefix, plane.callsignNum, confirm)
}
export function sayReachedAltitude(plane) {
  let nums = plane.flightLevel.toString().split('')
  const report = ['flight level', nums].flat();

  playPilotReport(plane.callsignPrefix, plane.callsignNum, report)
}

export function confirmSpeedChange(plane, newSpeed) {
  if (plane.groundSpeed == newSpeed) {
    sayReachedSpeed(plane);
    return;
  };

  let nums = newSpeed.toString().split('')
  let affirmWord = 'wilco' //just in case, instead of null
  const confirm = [affirmWord, nums, 'kilometers per hour'].flat();
  playPilotConfirm(plane.callsignPrefix, plane.callsignNum, confirm)
}
export function sayReachedSpeed(plane) {
  let nums = plane.groundSpeed.toString().split('')
  const report = ['speed', nums, 'kilometers per hour'].flat();
  playPilotReport(plane.callsignPrefix, plane.callsignNum, report)
}

await preloadAssets();
