import { confirmAltitudeChange, confirmHeadingChange, confirmSpeedChange } from './pilotReplyAudioApi.js';
import { getPlanes } from './planesManager.js';
import { getSelectedPlane, setSelectedPlane, unsetSelectedPlane, setPttActive } from './ui.js';
import { MAX_SPEED_KPH, MIN_SPEED_KPH, PTT_BUTTON } from './constants.js';
import { callsignAliasesJoined } from './callsignAliases.js';

  const natoMap = {
    ALFA: "A", ALPHA: "A",
    BRAVO: "B",
    CHARLIE: "C", CHARLY: "C",
    DELTA: "D",
    ECHO: "E",
    FOXTROT: "F", FOX: "F",
    GOLF: "G",
    HOTEL: "H",
    INDIA: "I",
    JULIET: "J", JULIETT: "J",
    KILO: "K",
    LIMA: "L",
    MIKE: "M",
    NOVEMBER: "N",
    OSCAR: "O",
    PAPA: "P",
    QUEBEC: "Q", QUEBECK: "Q", QUEBIC: "Q",
    ROMEO: "R",
    SIERRA: "S",
    TANGO: "T",
    UNIFORM: "U",
    VICTOR: "V",
    WHISKEY: "W", WHISKY: "W",
    XRAY: "X", "X-RAY": "X", X_RAY: "X",
    YANKEE: "Y",
    ZULU: "Z",
  };
  const numMap = {
    ZERO: "0", ONE: "1", TWO: "2", THREE: "3", FOUR: "4",
    FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9",
    NINER: "9"
  };

// =======================
// === VOICE CONTROL ====
// =======================
let recognition = null;
let pttActive = false; // push-to-talk active
let allowRestart = false; // блокируем автоперезапуск

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = false;
} else {
  console.warn("Speech Recognition API not supported in this browser.");
}

if(recognition) {

  recognition.onresult = (event) => {
    const raw = event.results[event.results.length - 1][0].transcript.trim().toUpperCase();
    console.log("🎤 Heard:", raw);

    let workingText = raw;

    const { callsign, rest } = extractCallsign(workingText);
    console.log("📡 Parsed callsign:", callsign, "| Rest:", rest);

    const planes = getPlanes();
    unsetSelectedPlane(planes);
    if (!callsign) return;

    // Ищем совпадение с позывным в списке самолётов
    const plane = planes.find(p => p.callsign === callsign);
    if (!plane) {
      console.warn(`No plane found with callsign: ${callsign}`);
      return;
    }

    setSelectedPlane(plane);
    console.log(`🎯 Selected via voice: ${plane.callsign}`);

    const commands = parseCommands(rest);
    if (commands.length === 0) {
      console.log("ℹ️ No commands found in rest.");
    } else {
      console.log(`📝 Found ${commands.length} command(s):`, commands.map(c => c.type).join("; "));
    }

    const selectedPlane = getSelectedPlane();
    if (!selectedPlane) return;

    commands.forEach(cmd => {
      switch (cmd.type) {
        case "HEADING":
          setHeading(cmd.words, selectedPlane);
          break;
        case "SPEED":
          setSpeed(cmd.words, selectedPlane);
          break;
        case "LEVEL":
        case "ALTITUDE":
          setAltitude(cmd.words, selectedPlane, cmd.type);
          break;
        default:
          console.log("⚙️ Unknown command type:", cmd.type);
      }
    });
  };

  recognition.onerror = (event) => {
    //console.warn("Speech recognition error:", event.error); uncoment then
  };

  recognition.onend = () => {
    if (allowRestart) {
      recognition.start();
    }
  };
}

// push-to-talk: SPACE
window.addEventListener("keydown", (e) => {
  if (e.code === PTT_BUTTON && !pttActive) {
    pttActive = true;
    allowRestart = true;
    console.log("🎙 START LISTENING (PTT)");

    try {
      recognition.start();
    } catch (err) {
      if (err.name !== "InvalidStateError") throw err;
    }

    setPttActive(true);;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === PTT_BUTTON && pttActive) {
    pttActive = false;
    allowRestart = false;

    try {
      recognition.stop();
    } catch (err) {
      if (err.name !== "InvalidStateError") throw err;
    }
    
    setPttActive(false); // гаснет лампочка
    e.preventDefault();
  }
});

// =======================
// === PARSE CALLSIGN ===
// =======================
function extractCallsign(text) {
  if (!text) return { callsign: "", rest: "" };

  const words = text.trim().toUpperCase().split(/\s+/);
  let airlineLetters = "";
  let flightNumbers = "";
  let i = 0;

  // === 1. Собираем буквы (включая NATO), пока не встретили цифру ===
  while (i < words.length) {
    const w = words[i];

    // Если слово — NATO буква → конвертируем
    if (natoMap[w]) {
      airlineLetters += natoMap[w];
      i++;
      // дальше может быть цифра — тогда выходим
      if (i < words.length && (numMap[words[i]] || /\d/.test(words[i]))) break;
      continue;
    }

    // Если обычные буквы (авиакомпания)
    if (/^[A-Z]+$/.test(w)) {
      airlineLetters += w;
      i++;
      // снова проверяем, не начинается ли номер рейса
      if (i < words.length && (numMap[words[i]] || /\d/.test(words[i]))) break;
      continue;
    }

    break; // встретили что-то не буквы → выходим
  }

  // Алиасы авиакомпаний
  airlineLetters = callsignAliasesJoined[airlineLetters] || airlineLetters;

  // === 2. Собираем цифры рейса ===
  while (i < words.length) {
    const w = words[i];

    if (numMap[w]) {
      flightNumbers += numMap[w];
      i++;
      continue;
    }

    if (/^\d+$/.test(w)) {
      flightNumbers += w;
      i++;
      continue;
    }

    break; // больше не цифры → конец callsign
  }

  // === 3. Остаток фразы (команды) ===
  const rest = words.slice(i).join(" ");

  return {
    callsign: airlineLetters + flightNumbers,
    rest
  };
}

function parseCommands(restText) {
  const commandKeys = ["HEADING", "SPEED", "LEVEL", "ALTITUDE"];
  const words = restText.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const commands = [];

  //console.log("🧩 parseCommands(): входные слова →", words);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (commandKeys.includes(word)) {
      const type = word;
      const commandWords = [];
      i++;

      // Собираем все слова до следующего ключевого слова
      while (i < words.length && !commandKeys.includes(words[i].toUpperCase())) {
        commandWords.push(words[i]);
        i++;
      }
      i--; // откатываем, чтобы не пропустить следующий ключ
      commands.push({ type, words: commandWords });
    }
  }

  console.log("🔍 Найдено команд →", commands);
  return commands;
}

function setHeading(words, selectedPlane ) {
  if (!selectedPlane) return;
  const heading = convertWordsToDigits(words) % 360;
  if (heading !== null && heading >= 0 && heading < 360) {
    selectedPlane.targetHeading = heading;
    confirmHeadingChange(selectedPlane, heading)
    console.log(`✅ HEADING ${heading}° for ${selectedPlane.callsign}`);
  } else console.warn("⚠️ Invalid heading:", heading);
}

function setAltitude(words, selectedPlane, type) {

  const types = {
    LEVEL: { max: 660, factor: 100, unit: "FL" },
    ALTITUDE: { max: 6000, factor: 1, unit: "feet" }
  };

  const cfg = types[type];
  if (!cfg) return console.warn("⚠️ Unknown altitude type:", type);

  const altitude = convertWordsToDigits(words);
  if (altitude !== null && altitude >= 0 && altitude < cfg.max) {
    selectedPlane.targetAltitude = altitude * cfg.factor;

    confirmAltitudeChange(selectedPlane, (altitude))
    console.log(`✅ Set ${cfg.unit} ${altitude} for ${selectedPlane.callsign}`);
  } else {
    console.warn("⚠️ Invalid altitude:", altitude);
  }
}

function setSpeed(words, selectedPlane) {

  if (!selectedPlane) return;
  const speed = convertWordsToDigits(words);
  if (speed !== null && speed >= MIN_SPEED_KPH && speed < MAX_SPEED_KPH) {
    selectedPlane.targetSpeed = speed;

    confirmSpeedChange(selectedPlane, speed)
    console.log(`✅ SPEED ${speed} km/h for ${selectedPlane.callsign}`);
  } else console.warn("⚠️ Invalid speed:", speed);
}

function convertWordsToDigits(wordsArray) {
  if (!Array.isArray(wordsArray)) return null;
  let result = "";
  for (let word of wordsArray) {
     word = word.replace(/[.,]/g, ""); // удаляем запятые и точки

    if (numMap[word]) {
      result += numMap[word]; // NATO слово → цифра
    } 
    else if (/^\d+$/.test(word)) {
      result += word; // чисто цифровое слово → добавляем как есть
    }
    else if (/^\d+[.,]?$/.test(word)) {
      result += word.replace(/[.,]/g, ""); // например "180," или "180." → "180"
    }
  }
  if (result.length === 0) return null;
  return parseInt(result, 10);
}