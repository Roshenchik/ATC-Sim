import { globals } from './globals.js'; // planes, selectedPlane, updatePlaneInfo

const planes = globals.planes;
let selectedPlane = globals.selectedPlane;
const updatePlaneInfo = globals.updatePlaneInfo;

// =======================
// === VOICE CONTROL ====
// =======================

if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
  console.warn("Speech Recognition API not supported in this browser.");
} else {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const raw = event.results[event.results.length - 1][0].transcript.trim().toUpperCase();
    console.log("🎤 Heard:", raw);

    const { callsign, rest } = extractCallsign(raw);
    console.log("📡 Parsed callsign:", callsign, "| Rest:", rest);

    if (!callsign) return;

    // Ищем совпадение с позывным в списке самолётов
    const plane = planes.find(p => p.callsign === callsign);
    if (plane) {
      selectPlaneByVoice(plane);
      console.log(`🎯 Selected via voice: ${plane.callsign}`);
    } else {
      console.warn(`No plane found with callsign: ${callsign}`);
    }

    // (на будущее) можно будет распарсить остальную команду — "TURN RIGHT", "CLIMB" и т.д.
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    recognition.start(); // автоперезапуск
  };

  recognition.start();
}

// =======================
// === SELECT PLANE ====
// =======================
function selectPlaneByVoice(plane) {
  planes.forEach(p => p.selected = false);
  plane.selected = true;
  globals.selectedPlane = plane;
  selectedPlane = plane;
  if (updatePlaneInfo) updatePlaneInfo(plane);
}

// =======================
// === PARSE CALLSIGN ===
// =======================
function extractCallsign(text) {
  if (!text) return { callsign: "", rest: "" };

  const words = text.trim().toUpperCase().split(/\s+/);

  let airlineLetters = "";
  let flightNumbers = "";
  let i = 0;

  // Собираем подряд идущие буквы до первой цифры
  while (i < words.length && /^[A-Z]+$/.test(words[i])) {
    airlineLetters += words[i];
    i++;
    if (i < words.length && /(\d|ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)/.test(words[i])) break;
  }

  // Собираем цифры или слова-числа
  while (i < words.length && /(\d|ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)/.test(words[i])) {
    const map = {
      ZERO: "0", ONE: "1", TWO: "2", THREE: "3", FOUR: "4",
      FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9"
    };
    flightNumbers += map[words[i]] || words[i];
    i++;
  }

  const callsign = airlineLetters + flightNumbers;
  const rest = words.slice(i).join(" ");

  return { callsign, rest };
}
