import { confirmAltitudeChange, confirmHeadingChange, confirmSpeedChange } from './pilotReplyAudioApi.js';
import { getPlanes } from './planesManager.js';
import { getSelectedPlane, setSelectedPlane, unsetSelectedPlane, updatePlaneInfo } from './ui.js';
import { MAX_SPEED_KPH, MIN_SPEED_KPH } from './constants.js';
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
    recognition.start(); // автоперезапуск
  };

  recognition.start();
}

// =======================
// === PARSE CALLSIGN ===
// =======================
function extractCallsign(text) {
  if (!text) return { callsign: "", rest: "" };

  const words = text.trim().toUpperCase().split(/\s+/);

  // ===== 1. Конвертируем каждое слово из NATO → буква, или оставляем как есть
  const normalized = words.map(w => natoMap[w] || w);

  // ===== 2. Ищем индекс, где начинаются цифры
  let digitStart = normalized.findIndex(w => numMap[w] || /\d/.test(w));
  if (digitStart === -1) digitStart = normalized.length;

  // ===== 3. Авиакомпания = все буквы до цифр
  const airlineLettersRaw = normalized.slice(0, digitStart).join("");

  // применяем алиас, если есть
  const airlineLetters = callsignAliasesJoined[airlineLettersRaw] || airlineLettersRaw;

  // ===== 4. Номер рейса = все цифры после букв
  let flightNumbers = "";
  for (let i = digitStart; i < normalized.length; i++) {
    const w = normalized[i];
    if (numMap[w]) flightNumbers += numMap[w];
    else if (/^\d+$/.test(w)) flightNumbers += w;
    else break; // закончили цифры
  }

  // ===== 5. Остаток текста
  const restIndex = digitStart + flightNumbers.length;
  const rest = words.slice(restIndex).join(" ");

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
  const heading = convertWordsToDigits(words);
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