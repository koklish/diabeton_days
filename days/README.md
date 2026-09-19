# Реестр

Одна запись — одни сутки: файл `ГГГГ-ММ-ДД.json`. Внутри всё за день: приёмы пищи
с разбором, замеры сахара, движение, препараты, руки, состояние, ЖКТ, алкоголь,
эпизоды тяги. Файлы пишет приложение; править их руками не нужно — следующая
синхронизация того же дня перезапишет файл целиком.

`index.json` — сводка по всем дням для быстрого взгляда на динамику.

## Главное при чтении

- **`meals[].response` — самое ценное поле.** Это отклик сахара на конкретный приём:
  `before` → `peak` (+`delta`) через `peakOffsetMin` минут, и была ли прогулка.
  Связь «еда → сахар» уже разобрана, искать её по временам не нужно.
- **`meals[].plate` — структура тарелки**, как о еде думает владелец: сколько
  крахмалов, есть ли белок, доля овощей. Это важнее калорий.
- **Утро оценивается иначе, чем день.** Феномен зари: тот же крахмал на завтраке
  поднимает сахар сильнее, чем в обед. Сравнивать приёмы без учёта времени суток нельзя.
- **`editedByUser: true`** — цифры правил человек; им доверия больше, чем оценке модели.
- **`confidence: "low"` и широкий `gramsRange`** — вес оценён грубо. Если вывод
  опирается на такую позицию, это надо назвать вслух.
- **`carbs` включает клетчатку**, усвояемые углеводы — `netCarbs`.
- Записи за день перезаписываются целиком, поэтому история правок живёт в git-логе.

## Структура файла

```jsonc
{
  "schemaVersion": 3,
  "date": "2026-09-19",
  "updatedAt": "2026-09-19T18:42:11.000Z",

  // Личные целевые цифры на момент записи.
  "targets": {
    "dayRange": [5.4, 6.8],
    "fastingHigh": 6.5,
    "fastingBest": [5.8, 6.1],
    "peakOk": 7.5,        // пик после еды до этого — норма
    "peakReview": 8.5,    // от этого — разбирать приём
    "hypo": 3.9           // ниже — гипогликемия, нужен протокол
  },

  "totals": { "kcal": 1742, "protein": 88.4, "fat": 61.2,
              "carbs": 186.3, "fiber": 24.1, "netCarbs": 162.2,
              "gl": 92.4, "grams": 1630 },

  "meals": [{
    "id": "ab12cd34",
    "time": "08:30",
    "kind": "breakfast",             // breakfast | lunch | dinner | snack
    "title": "Гречка с курицей",
    "plannedTreat": false,           // запланированный вкусный приём — часть системы, не нарушение
    "source": "ai",                  // ai — разобрано по фото/описанию, manual — введено руками
    "model": "claude-opus-5",
    "editedByUser": true,
    "photo": "photos/2026-09-19/ab12cd34.jpg",  // null, если фото не выгружалось

    "plate": {
      "starches": 1,                 // правило владельца: один крахмал на приём
      "hasProtein": true,
      "vegShare": "half",            // none | some | half | most
      "hasSweet": false,
      "proteinFirst": true,          // порядок «белок → овощи → гарнир»; null — не видно
      "summary": "1 крахмал · белок есть · овощи ½"
    },

    // Как сахар отозвался на этот приём.
    "response": {
      "before": 6.1, "peak": 7.3, "peakOffsetMin": 120,
      "delta": 1.2, "walked": true, "walkMinutes": 20
    },

    // Разбор, который человек видел до еды.
    "verdict": {
      "verdict": "честно",           // только два значения: честно | не честно
      "isWin": false,
      "verdictReason": "Один крахмал, белок и овощи на месте",
      "explanation": "...",           // 1–2 предложения: почему сахар пойдёт так
      "expectedCurve": "...",
      "wins": ["..."],
      "fix": "Пройтись 20 минут после",  // одно действие или null
      "warnings": ["..."],
      "questions": ["..."],
      "basedOnPastMeals": ["2026-09-14 08:30 → 7,3"]
    },

    "items": [{
      "name": "Гречка отварная",
      "role": "starch",              // protein | starch | vegetable | fruit | fat | sweet | nuts | drink
      "portion": "с кулак",          // бытовая мерка — так владелец думает о еде
      "grams": 180,
      "gramsRange": [150, 210],
      "per100": { "kcal": 110, "protein": 4, "fat": 1.1, "carbs": 21, "fiber": 2.7 },
      "gi": 50,
      "confidence": "medium",
      "totals": { /* абсолютные значения порции */ }
    }]
  }],

  "glucose": [{
    "time": "07:10", "mmol": 6.4,
    "tag": "fasting",   // fasting | before_meal | post1h | post2h | post3h | bedtime | night | random | hypo
    "source": "meter",  // meter | cgm
    "mealId": null,     // к какому приёму относится замер
    "isHypo": false,
    "inDayRange": true
  }],

  // Сводка с датчика, перенесённая руками из приложения CGM.
  "cgm": { "periodDays": 14, "avgMmol": 7.2, "eHbA1c": 6.4,
           "timeInRangePct": 72, "timeLowPct": 3, "timeVeryLowPct": 1,
           "maxMmol": 12.1, "minMmol": 2.5 },

  "activity": [{ "time": "09:00", "kind": "walk", "minutes": 20, "afterMealId": "ab12cd34" }],

  "meds": [{ "time": "22:15", "name": "Метформин (вечер)", "dose": "1000 мг",
             "kind": "metformin_pm", "taken": true }],
  // kind: metformin_am | metformin_pm | gliclazide | dapagliflozin | semaglutide | psych | other
  // Время metformin_pm — проверяемая гипотеза: поздний приём даёт лучшее утро.

  "alcohol": [{ "time": "19:00", "drink": "вино сухое", "units": 2 }],

  // Руки. Обязательный раздел: доказательная база для невролога и МСЭ.
  "hands": {
    "numbness": 5, "burning": 3, "swelling": 7, "weakness": 0,
    "droppedThings": false,
    "minutesToNumb": 15,        // через сколько нагрузки затекает
    "minutesToRecover": 40,     // за сколько отдыха проходит
    "triggers": ["носил ребёнка", "телефон лёжа"]
  },

  "state": { "anxiety": 5, "mood": 5, "sleepHours": 6, "sleepQuality": null, "panicAttacks": 0 },

  "gut": { "nausea": 0, "pain": 3, "morningHungerPain": true, "stool": "norm" },

  "cravings": [{
    "time": "16:20", "intensity": 7, "trigger": "скука",
    "outcome": "passed",        // passed | safe_snack | ate | unknown
    "minutes": 18, "glucoseAtStart": 6.2
  }],

  "weightKg": 137.0,
  "steps": 5400,
  "notes": "Свободный текст за день"
}
```
