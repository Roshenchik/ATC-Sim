// pilotReply.js - Web Audio API версия для последовательного (gap=0) воспроизведения коротких клипов

import { airlinePrefixes } from './callsignAliases.js';

const phraseList = [
  "CLIMBING FLIGHT LEVEL",
  "DESCENDING FLIGHT LEVEL",
  "CLIMBING TO ALTITUDE",
  "DESCENDING TO ALTITUDE",
  "FEET",
  "FLIGHT LEVEL",

  "HEADING",
  "TURNING RIGHT",
  "TURNING LEFT",

  "SPEED",
  "KILOMETERS PER HOUR",
  "KNOTS",
  "MACH NUMBER",

  "READY TO LAND",
  "GOING AROUND",
  "TRAFFIC ON TCAS",
  "TRAFFIC IN SIGHT",
  "WILCO",

  "AEROFLOT",
  "FINNAIR",
  "KLM",
  "LUFTHANSA",
  "RYANAIR",
  "SCANDINAVIAN",
  "SPEED BIRD",
];

const DEFAULT_BASE = './responces/friendly guy/'; // базовая папка с файлами
let basePath = DEFAULT_BASE;

// Web Audio API objects
let audioCtx = null; // AudioContext (создаётся лениво при первом воспроизведении/предзагрузке)
const bufferCache = new Map(); // Map: filename -> AudioBuffer

// // Список активных источников, чтобы можно было остановить воспроизведение
let activeSources = [];

// playback token для логики отмены (аналог currentPlayback)
let playbackToken = { cancelled: false, stopTime: null };

export function setAudioBasePath(path) {
  basePath = path;
}

// Получить список дефолтных символов A-Z и 0-9 (как раньше)
function getDefaultChars() {
  const chars = [];
  for (let i = 65; i <= 90; i++) chars.push(String.fromCharCode(i)); // A..Z
  for (let d = 0; d <= 9; d++) chars.push(String(d)); // 0..9
  return chars;
}

function phraseToFilename(phrase) {
  if (!phrase) return '';
  return phrase.toLowerCase().replace(/\s+/g, "_") + '.mp3';
}

// Создаёт AudioContext, если ещё не создан
function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Загружает и декодирует файл в AudioBuffer, кеширует результат
export async function loadAudioBuffer(filename) {
  // filename ожидается с расширением, например 'a.mp3' или 'climbing_flight_level.mp3'
  if (bufferCache.has(filename)) {
    return bufferCache.get(filename);
  }

  const ctx = ensureAudioContext();
  const url = basePath + filename;

  // fetch бинарного контента
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  // decodeAudioData возвращает Promise (в современных браузерах)
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  bufferCache.set(filename, audioBuffer);
  return audioBuffer;
}

// Предзагрузка всех нужных файлов
export async function preloadAssets() {
  const files = [];

  for (const phrase of phraseList) {
    files.push(phraseToFilename(phrase));
  }
  files.push(...getDefaultChars().map(ch => ch + '.mp3'));

  // создаём AudioContext заранее — полезно для обхода политики автозапуска при условии, что
  // это вызов происходит после пользовательского жеста; если нет — при первом play user gesture потребуется
  ensureAudioContext();

  // Загружаем и декодируем все файлы параллельно
  const promises = files.map(f => loadAudioBuffer(f).catch(e => {
    console.warn('preloadAssets: failed to load', f, e);
    return null;
  }));
  await Promise.all(promises);
  return true;
}

// Останавливаем текущее воспроизведение
export function stopPlayback() {
  playbackToken.cancelled = true;
  // Останавливаем все запущенные источники
  for (const src of activeSources) {
    try {
      src.stop(0);
    } catch (e) {}
  }
  activeSources = [];
  playbackToken = { cancelled: false, stopTime: null };
}

// Воспроизведение последовательности AudioBuffer'ов с точным таймингом
export async function playSequence(filenames, gapSeconds = 0) {
  if (!filenames || filenames.length === 0) return;

  const ctx = ensureAudioContext();

  // Если контекст находится в suspended (блокирован) — попытаемся возобновить.
  // Возвращаем промис, который выполнится успешно, но если пользователь не сделал жеста, resume может отклониться.
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      // если resume невозможно (нет user gesture) — всё равно продолжим, но play может быть заблокирован
      console.warn('AudioContext resume failed (needs user gesture?)', e);
    }
  }

  // Отмена предыдущего воспроизведения — пометим старый токен
  playbackToken.cancelled = false;
  playbackToken.stopTime = null;

  // Текущее планируемое начало последовательности
  // Немного сдвигаем старт в будущее на 0.03s чтобы дать время планировщику (это мелкая страховка)
  let currentTime = ctx.currentTime + 0.03;

  // Собираем AudioBuffers для всех файлов (загружаем при необходимости)
  const buffers = [];
  for (const f of filenames) {
    if (playbackToken.cancelled) break;
    try {
      const buf = await loadAudioBuffer(f);
      if (buf) buffers.push({ filename: f, buffer: buf });
      else console.warn('playSequence: buffer missing for', f);
    } catch (e) {
      console.warn('playSequence: failed to load', f, e);
    }
  }

  // Запускаем источники по тайм-коду
  activeSources = [];
  for (const item of buffers) {
    if (playbackToken.cancelled) break;

    const source = ctx.createBufferSource();
    source.buffer = item.buffer;
    source.connect(ctx.destination);

    // Запоминаем источник, чтобы иметь возможность остановить
    activeSources.push(source);

    // Запускаем точно в currentTime
    source.start(currentTime);

    // Событие onended — удаляем из activeSources
    source.onended = () => {
      const idx = activeSources.indexOf(source);
      if (idx !== -1) activeSources.splice(idx, 1);
    };

    // При планировании следующего звука добавляем длительность и gap
    currentTime += item.buffer.duration + gapSeconds;
  }

  // Ждём полного окончания (или отмены)
  // Если воспроизведение отменят, мы выйдем досрочно
  const endTime = currentTime;
  return new Promise(resolve => {
    const check = () => {
      if (playbackToken.cancelled) {
        resolve();
        return;
      }
      if (audioCtx.currentTime >= endTime && activeSources.length === 0) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

// Вспомогательная: строит последовательность имён файлов для callsign (как у тебя)
export async function playCallsignSequence(prefix, number) {
  const fileSeq = [];
  const prefUp = (prefix || '').toUpperCase();
  const isFullName = Object.prototype.hasOwnProperty.call(airlinePrefixes, prefUp);

  if (isFullName) {
    const audioFileName = phraseToFilename(airlinePrefixes[prefUp]);
    let isAudioFile = bufferCache.has(audioFileName);
    if (!isAudioFile) {
      try {
        await loadAudioBuffer(audioFileName);
        isAudioFile = bufferCache.has(audioFileName);
      } catch (e) {
        console.warn('Failed to preload airline audio:', audioFileName, e);
        isAudioFile = false;
      }
    }

    if (isAudioFile) {
      fileSeq.push(audioFileName);
    } else {
      (prefix || '').toLowerCase().split('').forEach(ch => fileSeq.push(ch + '.mp3'));
    }
  } else {
    (prefix || '').toLowerCase().split('').forEach(ch => fileSeq.push(ch + '.mp3'));
  }

  (number || '').split('').forEach(num => fileSeq.push(num + '.mp3'));

  //return fileSeq;
  await playSequence(fileSeq);
}

const confirmationQueue = [];
let isQueueProcessing = false;
const planeId = task => task.prefix + task.number;
async function processConfirmationQueue() {
  if (isQueueProcessing) return;
  if (confirmationQueue.length === 0) return;

  isQueueProcessing = true;

  while (confirmationQueue.length > 0) {
    const task = confirmationQueue[0];

    // Обрабатываем REPORT и CONFIRM через вспомогательную функцию
    if (task.type === "report") {
      await processGroup("report");
    } else if (task.type === "confirm") {
      await processGroup("confirm");
    }
  }

  isQueueProcessing = false;
}

// Вспомогательная функция обработки группы одного типа для одного самолета
async function processGroup(type) {
  if (confirmationQueue.length === 0) return;

  const firstTask = confirmationQueue[0];
  const plane = planeId(firstTask);

  // Для report — сначала позывной
  if (type === "report") {
    await playCallsignSequence(firstTask.prefix, firstTask.number, null);
  }

  // Проигрываем все задачи этого типа для текущего самолета
  while (confirmationQueue[0] && confirmationQueue[0].type === type && planeId(confirmationQueue[0]) === plane) {
    const task = confirmationQueue.shift();
    await playPilotMessage(task.prefix, task.number, task.extraWords);
  }

  // Для confirm — позывной после серии
  if (type === "confirm") {
    await playCallsignSequence(firstTask.prefix, firstTask.number, null);
  }
}

export function enqueuePilotMessage(prefix, number, extraWords = ['wilco'], type) {
  confirmationQueue.push({ prefix, number, extraWords, type });
  processConfirmationQueue();
}

export async function playPilotMessage(prefix, number, extraWords = ['wilco']) {
  if (!prefix && !number) return;

  const files = [];

  if (extraWords) {
    extraWords.forEach(extra => {
      if (extra === null) return;
      files.push(phraseToFilename(extra));
    });
  }

  await playSequence(files, 0);
}

// helper functions that use the above
export function confirmHeadingChange(plane, newHeading) {
  const type = 'confirm'
  const crntHeading = plane.heading;
  const side = plane.turnDirection(newHeading, crntHeading);
  let nums = newHeading.toString().padStart(3, '0').split('');
  let affirmWord = 'wilco';

  if (side > 0) {
    affirmWord = 'turning right';
  } else if (side < 0) {
    affirmWord = 'turning left';
  } else {
    sayReachedHeading(plane);
    return;
  }
  const confirm = [affirmWord, 'heading', nums].flat();
  enqueuePilotMessage(plane.callsignPrefix, plane.callsignNum, confirm, type);
}
export function sayReachedHeading(plane) {
  const type = 'report'
  let nums = plane.heading.toString().split('');
  const report = ['heading', nums].flat();
  enqueuePilotMessage(plane.callsignPrefix, plane.callsignNum, report, type);
}

export function confirmAltitudeChange(plane, newFL) {
  const type = 'confirm'
  let nums = newFL.toString().split('');
  let affirmWord = 'wilco';

  if (plane.altitude < plane.targetAltitude) {
    affirmWord = 'climbing flight level';
  } else if (plane.altitude > plane.targetAltitude) {
    affirmWord = 'descending flight level';
  } else {
    sayReachedAltitude(plane);
    return;
  }
  const confirm = [affirmWord, nums].flat();
  enqueuePilotMessage(plane.callsignPrefix, plane.callsignNum, confirm, type);
}
export function sayReachedAltitude(plane) {
  const type = 'report'
  let nums = plane.flightLevel.toString().split('');
  const report = ['flight level', nums].flat();

  enqueuePilotMessage(plane.callsignPrefix, plane.callsignNum, report, type);
}

export function confirmSpeedChange(plane, newSpeed) {
  const type = 'confirm'
  if (plane.groundSpeed == newSpeed) {
    sayReachedSpeed(plane);
    return;
  }

  let nums = newSpeed.toString().split('');
  let affirmWord = 'wilco';
  const confirm = [affirmWord, nums, 'kilometers per hour'].flat();
  enqueuePilotMessage(plane.callsignPrefix, plane.callsignNum, confirm, type);
}
export function sayReachedSpeed(plane) {
  const type = 'report'
  let nums = plane.groundSpeed.toString().split('');
  const report = ['speed', nums, 'kilometers per hour'].flat();
  enqueuePilotMessage(plane.callsignPrefix, plane.callsignNum, report, type);
}

export function reportTcasAlarm(planeA, planeB) {
  console.log('here')
  if (!planeA.stca) return;
  console.log('here2')
  const type = 'report'
  const report = ['traffic on TCAS'].flat();
  enqueuePilotMessage(planeA.callsignPrefix, planeA.callsignNum, report, type);
}

// Предзагрузим автоматически (по желанию) — можно закомментировать, если не нужен автозапуск
// (await preloadAssets();) // НЕ вызывать на уровне модуля без пользовательского жеста в некоторых браузерах
await preloadAssets();
