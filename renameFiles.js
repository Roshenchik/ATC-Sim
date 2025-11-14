const fs = require('fs');
const path = require('path');

// Папка, где лежат mp3
const dir = './responces/friendly guy'; // либо задай путь

// Фразы в порядке следования файлов
const phrases = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "climbing flight level",
  "descending flight level",
  "climbing to altitude",
  "descending to altitude",
  "feet",
  "flight level",
  "heading",
  "turning right",
  "turning left",
  "speed",
  "kilometers per hour",
  "knots",
  "mach number",
  "ready to land",
  "going around",
  "traffic on TCAS",
  "traffic in sight",
  "willco"
];

phrases.forEach((phrase, i) => {
  const oldName = `friendly guy.${String(i).padStart(2, '0')}.mp3`;

  // Новое имя — заменяем пробелы на подчеркивания
  const safeName = phrase.replace(/\s+/g, '_');
  const newName = `${safeName}.mp3`;

  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, newName);

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`✔ ${oldName} → ${newName}`);
  } else {
    console.warn(`⚠ Файл не найден: ${oldName}`);
  }
});

console.log("Готово!");
