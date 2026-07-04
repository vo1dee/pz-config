#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds translations.json (EN/UK) for every parameter in config-schema.json."""
import json

UI = {
    "app_title": {"en": "Project Zomboid B42 Sandbox Config Editor", "uk": "Редактор конфігурації пісочниці Project Zomboid B42"},
    "search_placeholder": {"en": "Search parameters...", "uk": "Пошук параметрів..."},
    "load_file": {"en": "Import .lua", "uk": "Імпортувати .lua"},
    "export_lua": {"en": "Export .lua", "uk": "Експортувати .lua"},
    "reset_all": {"en": "Reset all to default", "uk": "Скинути все до типових значень"},
    "sections": {"en": "Sections", "uk": "Розділи"},
    "modified": {"en": "Modified", "uk": "Змінено"},
    "reset_to_default": {"en": "Reset to default", "uk": "Скинути до типового значення"},
    "default_label": {"en": "Default", "uk": "Типове"},
    "min_label": {"en": "Min", "uk": "Мін"},
    "max_label": {"en": "Max", "uk": "Макс"},
    "no_results": {"en": "No parameters match your search.", "uk": "Немає параметрів, що відповідають пошуку."},
    "param_count": {"en": "parameters", "uk": "параметрів"},
    "close": {"en": "Close", "uk": "Закрити"},
    "language": {"en": "Language", "uk": "Мова"},
    "export_confirm_title": {"en": "Confirm export", "uk": "Підтвердження експорту"},
    "export_confirm_body": {
        "en": "The exported SandboxVars.lua will always contain English comments, regardless of the UI language, since the file is read by the game server, not by a person browsing it in Ukrainian.",
        "uk": "Експортований SandboxVars.lua завжди міститиме англійські коментарі, незалежно від мови інтерфейсу, оскільки цей файл читає сервер гри, а не людина, яка переглядає його українською.",
    },
    "confirm": {"en": "Export", "uk": "Експортувати"},
    "cancel": {"en": "Cancel", "uk": "Скасувати"},
    "unsaved_notice": {"en": "Your edits are saved automatically in this browser.", "uk": "Ваші зміни автоматично зберігаються в цьому браузері."},
    "version_label": {"en": "Config version", "uk": "Версія конфігурації"},
    "load_file_hint": {"en": "Load a different SandboxVars.lua", "uk": "Завантажити інший SandboxVars.lua"},
    "drop_here": {"en": "Drop your SandboxVars.lua file here", "uk": "Перетягніть сюди файл SandboxVars.lua"},
    "parse_error": {"en": "Could not parse this file. Make sure it's a valid SandboxVars.lua.", "uk": "Не вдалося розібрати цей файл. Переконайтесь, що це коректний SandboxVars.lua."},
    "type_boolean": {"en": "Yes/No toggle", "uk": "Перемикач Так/Ні"},
    "type_enum": {"en": "Choice list", "uk": "Список вибору"},
    "type_integer": {"en": "Whole number", "uk": "Ціле число"},
    "type_float": {"en": "Decimal number", "uk": "Дробове число"},
    "type_string": {"en": "Text", "uk": "Текст"},
    "toggle_on": {"en": "On", "uk": "Увімкнено"},
    "toggle_off": {"en": "Off", "uk": "Вимкнено"},
}

SECTIONS = {
    "General": {"en": "General", "uk": "Загальні"},
    "Basement": {"en": "Basement", "uk": "Підвали"},
    "Map": {"en": "Map", "uk": "Карта"},
    "ZombieLore": {"en": "Zombie Lore", "uk": "Особливості зомбі"},
    "ZombieConfig": {"en": "Zombie Population Config", "uk": "Налаштування популяції зомбі"},
    "MultiplierConfig": {"en": "Skill XP Multipliers", "uk": "Множники досвіду навичок"},
}

# Each entry keyed by full "path" (matches config-schema.json param.path)
# value: { label: {en,uk}, description: {en,uk}, options: {"N": {en,uk}, ...} (optional) }
P = {}

def p(path, label_en, label_uk, desc_en, desc_uk, options=None):
    entry = {
        "label": {"en": label_en, "uk": label_uk},
        "description": {"en": desc_en, "uk": desc_uk},
    }
    if options:
        entry["options"] = {str(k): {"en": v[0], "uk": v[1]} for k, v in options.items()}
    P[path] = entry

# ---------------- General ----------------

p("Zombies", "Zombie Count", "Кількість зомбі",
  "Overall zombie population level. Also sets the Population Multiplier in Advanced Zombie Options.",
  "Загальний рівень популяції зомбі. Також встановлює Множник популяції в розширених налаштуваннях зомбі.",
  {1: ("Insane", "Божевільна"), 2: ("Very High", "Дуже висока"), 3: ("High", "Висока"),
   4: ("Normal", "Нормальна"), 5: ("Low", "Низька"), 6: ("None", "Відсутня")})

p("Distribution", "Distribution", "Розподіл",
  "How zombies are distributed across the map.",
  "Як зомбі розподілені по карті.",
  {1: ("Urban Focused", "Зосереджено в місті"), 2: ("Uniform", "Рівномірно")})

p("ZombieVoronoiNoise", "Voronoi Noise", "Шум Вороного",
  "Controls whether some randomization is applied to zombie distribution.",
  "Керує тим, чи застосовується випадковість до розподілу зомбі по карті.", None)

p("ZombieRespawn", "Zombie Respawn", "Відродження зомбі",
  "How frequently new zombies are added to the world.",
  "Як часто нові зомбі з'являються у світі.",
  {1: ("High", "Висока"), 2: ("Normal", "Нормальна"), 3: ("Low", "Низька"), 4: ("None", "Відсутнє")})

p("ZombieMigrate", "Zombie Migration", "Міграція зомбі",
  "Zombies are allowed to migrate to empty cells.",
  "Зомбі можуть мігрувати до порожніх осередків карти.", None)

p("DayLength", "Day Length", "Тривалість дня",
  "The length of one in-game day.",
  "Тривалість одного ігрового дня.",
  {1: ("15 Minutes", "15 хвилин"), 2: ("30 Minutes", "30 хвилин"), 3: ("1 Hour", "1 година"),
   4: ("1 Hour, 30 Minutes", "1 година 30 хвилин"), 5: ("2 Hours", "2 години"), 6: ("3 Hours", "3 години"),
   7: ("4 Hours", "4 години"), 8: ("5 Hours", "5 годин"), 9: ("6 Hours", "6 годин"), 10: ("7 Hours", "7 годин"),
   11: ("8 Hours", "8 годин"), 12: ("9 Hours", "9 годин"), 13: ("10 Hours", "10 годин"), 14: ("11 Hours", "11 годин"),
   15: ("12 Hours", "12 годин"), 16: ("13 Hours", "13 годин"), 17: ("14 Hours", "14 годин"), 18: ("15 Hours", "15 годин"),
   19: ("16 Hours", "16 годин"), 20: ("17 Hours", "17 годин"), 21: ("18 Hours", "18 годин"), 22: ("19 Hours", "19 годин"),
   23: ("20 Hours", "20 годин"), 24: ("21 Hours", "21 година"), 25: ("22 Hours", "22 години"), 26: ("23 Hours", "23 години"),
   27: ("Real-time", "Реальний час")})

p("StartYear", "Start Year", "Рік початку",
  "The in-game year the game starts in.",
  "Ігровий рік, у якому починається гра.", None)

p("StartMonth", "Start Month", "Місяць початку",
  "Month in which the game starts.",
  "Місяць, у якому починається гра.",
  {1: ("January", "Січень"), 2: ("February", "Лютий"), 3: ("March", "Березень"), 4: ("April", "Квітень"),
   5: ("May", "Травень"), 6: ("June", "Червень"), 7: ("July", "Липень"), 8: ("August", "Серпень"),
   9: ("September", "Вересень"), 10: ("October", "Жовтень"), 11: ("November", "Листопад"), 12: ("December", "Грудень")})

p("StartDay", "Start Day", "День початку",
  "Day of the month in which the game starts.",
  "День місяця, у якому починається гра.", None)

p("StartTime", "Start Time", "Час початку",
  "Hour of the day in which the game starts.",
  "Година доби, у якій починається гра.",
  {1: ("7 AM", "7:00"), 2: ("9 AM", "9:00"), 3: ("12 PM", "12:00"), 4: ("2 PM", "14:00"),
   5: ("5 PM", "17:00"), 6: ("9 PM", "21:00"), 7: ("12 AM", "0:00"), 8: ("2 AM", "2:00"), 9: ("5 AM", "5:00")})

p("DayNightCycle", "Day/Night Cycle", "Цикл дня і ночі",
  "Whether the time of day changes naturally, or it's always day/night.",
  "Чи змінюється час доби природно, чи завжди триває день/ніч.",
  {1: ("Normal", "Нормальний"), 2: ("Endless Day", "Нескінченний день"), 3: ("Endless Night", "Нескінченна ніч")})

p("ClimateCycle", "Climate Cycle", "Цикл клімату",
  "Whether weather changes or remains at a single state.",
  "Чи змінюється погода, чи залишається незмінною.",
  {1: ("Normal", "Нормальний"), 2: ("No Weather", "Без погодних явищ"), 3: ("Endless Rain", "Нескінченний дощ"),
   4: ("Endless Storm", "Нескінченна буря"), 5: ("Endless Snow", "Нескінченний сніг"), 6: ("Endless Blizzard", "Нескінченна заметіль")})

p("FogCycle", "Fog Cycle", "Цикл туману",
  "Whether fog occurs naturally, never occurs, or is always present.",
  "Чи виникає туман природно, чи не виникає взагалі, чи присутній завжди.",
  {1: ("Normal", "Нормальний"), 2: ("No Fog", "Без туману"), 3: ("Endless Fog", "Нескінченний туман")})

p("WaterShut", "Water Shutoff", "Відключення води",
  "How long after the default start date (July 9, 1993) that plumbing fixtures (eg. sinks) stop being infinite sources of water.",
  "Скільки часу після дати початку за замовчуванням (9 липня 1993 року) знадобиться, щоб сантехніка (наприклад, крани) перестала бути нескінченним джерелом води.",
  {1: ("Instant", "Миттєво"), 2: ("0 - 30 Days", "0-30 днів"), 3: ("0 - 2 Months", "0-2 місяці"),
   4: ("0 - 6 Months", "0-6 місяців"), 5: ("0 - 1 Year", "0-1 рік"), 6: ("0 - 5 Years", "0-5 років"),
   7: ("2 - 6 Months", "2-6 місяців"), 8: ("6 - 12 Months", "6-12 місяців"), 9: ("Disabled", "Вимкнено")})

p("ElecShut", "Electricity Shutoff", "Відключення електрики",
  "How long after the default start date (July 9, 1993) that the world's electricity turns off for good.",
  "Скільки часу після дати початку за замовчуванням (9 липня 1993 року) знадобиться, щоб електрика в світі вимкнулася назавжди.",
  {1: ("Instant", "Миттєво"), 2: ("14 - 30 Days", "14-30 днів"), 3: ("14 Days - 2 Months", "14 днів - 2 місяці"),
   4: ("14 Days - 6 Months", "14 днів - 6 місяців"), 5: ("14 Days - 1 Year", "14 днів - 1 рік"),
   6: ("14 Days - 5 Years", "14 днів - 5 років"), 7: ("2 - 6 Months", "2-6 місяців"),
   8: ("6 - 12 Months", "6-12 місяців"), 9: ("Disabled", "Вимкнено")})

p("AlarmDecay", "Alarm Decay", "Розрядка сигналізації",
  "How long alarm batteries can last for after the power shuts off.",
  "Як довго можуть протриматися батареї сигналізації після відключення електрики.",
  {1: ("Instant", "Миттєво"), 2: ("0 - 30 Days", "0-30 днів"), 3: ("0 - 2 Months", "0-2 місяці"),
   4: ("0 - 6 Months", "0-6 місяців"), 5: ("0 - 1 Year", "0-1 рік"), 6: ("0 - 5 Years", "0-5 років")})

p("WaterShutModifier", "Water Shutoff (Days)", "Відключення води (днів)",
  "Custom number of days after the default start date (July 9, 1993) that plumbing fixtures stop being infinite sources of water.",
  "Власна кількість днів після дати початку за замовчуванням (9 липня 1993), через яку сантехніка перестає бути нескінченним джерелом води.", None)

p("ElecShutModifier", "Electricity Shutoff (Days)", "Відключення електрики (днів)",
  "Custom number of days after the default start date (July 9, 1993) that the world's electricity turns off for good.",
  "Власна кількість днів після дати початку за замовчуванням (9 липня 1993), через яку електрика в світі вимикається назавжди.", None)

p("AlarmDecayModifier", "Alarm Decay (Days)", "Розрядка сигналізації (днів)",
  "Custom number of days for how long alarm batteries can last after the power shuts off.",
  "Власна кількість днів, протягом яких можуть протриматися батареї сигналізації після відключення електрики.", None)

p("FoodLootNew", "Food", "Їжа",
  "Any food that can rot or spoil.",
  "Будь-яка їжа, яка може гнити або псуватися.", None)
p("LiteratureLootNew", "Literature", "Література",
  "All other items that can be read, including books, fliers, and newspapers.",
  "Усі інші предмети для читання, включно з книгами, листівками та газетами.", None)
p("SkillBookLoot", "Skill Books", "Книги навичок",
  "Books that provide skill XP multipliers.",
  "Книги, що надають множники досвіду навичок.", None)
p("RecipeResourceLoot", "Recipe Items", "Предмети з рецептами",
  "Items that teach recipes.",
  "Предмети, що навчають рецептам.", None)
p("MedicalLootNew", "Medical", "Медичні",
  "Medicine, bandages and first aid tools.",
  "Ліки, бинти та засоби першої допомоги.", None)
p("SurvivalGearsLootNew", "Survival Gear", "Спорядження для виживання",
  "Fishing rods, tents, camping gear etc.",
  "Вудки, намети, туристичне спорядження тощо.", None)
p("CannedFoodLootNew", "Canned Food", "Консерви",
  "Canned and dried food, beverages.",
  "Консервована та суха їжа, напої.", None)
p("WeaponLootNew", "Weapons", "Зброя",
  "Weapons that are not tools in other categories.",
  "Зброя, яка не є інструментом з інших категорій.", None)
p("RangedWeaponLootNew", "Ranged Weapons", "Дальня зброя",
  "Ranged weapons. Also includes weapon attachments.",
  "Дальня зброя. Також включає обвіси для зброї.", None)
p("AmmoLootNew", "Ammo", "Боєприпаси",
  "Loose ammo, boxes and magazines.",
  "Розсипні патрони, коробки з патронами та магазини.", None)
p("MechanicsLootNew", "Mechanics", "Механіка",
  "Vehicle parts and the tools needed to install them.",
  "Автозапчастини та інструменти, необхідні для їх встановлення.", None)
p("OtherLootNew", "Other", "Інше",
  "Everything else. Also affects foraging for all items in Town/Road zones.",
  "Все інше. Також впливає на збиральництво всіх предметів у міських зонах та на дорогах.", None)
p("ClothingLootNew", "Clothing", "Одяг",
  "All wearable items that are not containers.",
  "Весь одяг, який не є контейнером.", None)
p("ContainerLootNew", "Containers", "Контейнери",
  "Backpacks and other wearable/equippable containers, eg. cases.",
  "Рюкзаки та інші носимі контейнери, наприклад, кейси.", None)
p("KeyLootNew", "Keys", "Ключі",
  "Keys for buildings/cars, key rings, and locks.",
  "Ключі від будівель/машин, брелоки та замки.", None)
p("MediaLootNew", "Media", "Медіа",
  "VHS tapes and CDs.",
  "Відеокасети та диски.", None)
p("MementoLootNew", "Mementos", "Памʼятні речі",
  "Spiffo items, plushies, and other collectible keepsake items eg. photos.",
  "Предмети зі Спіффо, м'які іграшки та інші колекційні предмети на пам'ять, наприклад, фотографії.", None)
p("CookwareLootNew", "Cookware", "Кухонне начиння",
  "Items used in cooking, including those (eg. knives) which can be weapons. Does not include food. Includes both usable and unusable items.",
  "Предмети, що використовуються під час готування, включно з тими (наприклад, ножі), які можуть бути зброєю. Не включає їжу. Включає як придатні, так і непридатні до використання предмети.", None)
p("MaterialLootNew", "Materials", "Матеріали",
  "Items and weapons used as ingredients for crafting or building. A general category that does not include items belonging to other categories such as Cookware or Medical. Does not include Tools.",
  "Предмети та зброя, що використовуються як інгредієнти для крафту чи будівництва. Загальна категорія, яка не включає предмети з інших категорій, як-от кухонне начиння чи медичні засоби. Не включає інструменти.", None)
p("FarmingLootNew", "Farming", "Фермерство",
  "Items and weapons used in both animal and plant agriculture, such as seeds, trowels, or shovels.",
  "Предмети та зброя, що використовуються як у тваринництві, так і в рослинництві, наприклад, насіння, совки чи лопати.", None)
p("ToolLootNew", "Tools", "Інструменти",
  "Items and weapons which are Tools but don't fit in other categories such as Mechanics or Farming.",
  "Предмети та зброя, які є інструментами, але не підходять до інших категорій, як-от механіка чи фермерство.", None)

p("RollsMultiplier", "Loot Rolls Multiplier", "Множник спроб появи здобичі",
  "[!] It is recommended that you DO NOT change this. [!] Can be used to adjust the number of rolls made on loot tables when spawning loot. Will not reduce the number of rolls below 1. Can negatively affect performance if set to high values. It is highly recommended that this not be changed.",
  "[!] Рекомендується НЕ змінювати це значення. [!] Дозволяє налаштувати кількість спроб визначення здобичі з таблиць лута. Не зменшує кількість спроб нижче 1. Високі значення можуть негативно вплинути на продуктивність. Настійно рекомендується не змінювати це значення.", None)

p("LootItemRemovalList", "Loot Item Removal List", "Список видалення предметів здобичі",
  "A comma-separated list of item types that won't spawn as ordinary loot.",
  "Список типів предметів через кому, які не з'являтимуться як звичайна здобич.", None)
p("RemoveStoryLoot", "Remove Story Loot", "Прибрати сюжетну здобич",
  "If enabled, items on the Loot Item Removal List, or that have their rarity set to 'None', will not spawn in randomised world stories.",
  "Якщо увімкнено, предмети зі списку видалення здобичі або ті, чия рідкісність встановлена як 'Відсутня', не з'являтимуться у випадкових світових історіях.", None)
p("RemoveZombieLoot", "Remove Zombie Loot", "Прибрати здобич із зомбі",
  "If enabled, items on the Loot Item Removal List, or that have their rarity set to 'None', will not spawn worn by, or attached to, zombies.",
  "Якщо увімкнено, предмети зі списку видалення здобичі або ті, чия рідкісність встановлена як 'Відсутня', не з'являтимуться одягненими на зомбі чи прикріпленими до них.", None)
p("ZombiePopLootEffect", "Zombie Population Loot Effect", "Вплив популяції зомбі на здобич",
  "If greater than 0, the spawn of loot is increased relative to the number of nearby zombies, with the effect multiplied by this number.",
  "Якщо більше 0, поява здобичі збільшується відносно кількості зомбі поруч, а ефект множиться на це число.", None)

p("InsaneLootFactor", "Insane Rarity Factor", "Коефіцієнт рідкісності «Божевільна»",
  "Multiplier applied to items with 'Insane' rarity when calculating loot spawn chance.",
  "Множник, що застосовується до предметів з рідкісністю «Божевільна» під час розрахунку шансу появи здобичі.", None)
p("ExtremeLootFactor", "Extreme Rarity Factor", "Коефіцієнт рідкісності «Екстремальна»",
  "Multiplier applied to items with 'Extreme' rarity when calculating loot spawn chance.",
  "Множник, що застосовується до предметів з рідкісністю «Екстремальна» під час розрахунку шансу появи здобичі.", None)
p("RareLootFactor", "Rare Rarity Factor", "Коефіцієнт рідкісності «Рідкісна»",
  "Multiplier applied to items with 'Rare' rarity when calculating loot spawn chance.",
  "Множник, що застосовується до предметів з рідкісністю «Рідкісна» під час розрахунку шансу появи здобичі.", None)
p("NormalLootFactor", "Normal Rarity Factor", "Коефіцієнт рідкісності «Звичайна»",
  "Multiplier applied to items with 'Normal' rarity when calculating loot spawn chance.",
  "Множник, що застосовується до предметів з рідкісністю «Звичайна» під час розрахунку шансу появи здобичі.", None)
p("CommonLootFactor", "Common Rarity Factor", "Коефіцієнт рідкісності «Поширена»",
  "Multiplier applied to items with 'Common' rarity when calculating loot spawn chance.",
  "Множник, що застосовується до предметів з рідкісністю «Поширена» під час розрахунку шансу появи здобичі.", None)
p("AbundantLootFactor", "Abundant Rarity Factor", "Коефіцієнт рідкісності «Рясна»",
  "Multiplier applied to items with 'Abundant' rarity when calculating loot spawn chance.",
  "Множник, що застосовується до предметів з рідкісністю «Рясна» під час розрахунку шансу появи здобичі.", None)

p("Temperature", "Temperature", "Температура",
  "The global temperature.",
  "Загальна температура у світі.",
  {1: ("Very Cold", "Дуже холодно"), 2: ("Cold", "Холодно"), 3: ("Normal", "Нормально"),
   4: ("Hot", "Спекотно"), 5: ("Very Hot", "Дуже спекотно")})
p("Rain", "Rain", "Дощ",
  "How often it rains.",
  "Як часто йде дощ.",
  {1: ("Very Dry", "Дуже сухо"), 2: ("Dry", "Сухо"), 3: ("Normal", "Нормально"),
   4: ("Rainy", "Дощово"), 5: ("Very Rainy", "Дуже дощово")})
p("ErosionSpeed", "Erosion Speed", "Швидкість заростання",
  "Number of days until the erosion system (which adds vines, long grass, new trees etc. to the world) reaches 100% growth.",
  "Кількість днів до досягнення 100% заростання системою ерозії (яка додає лози, високу траву, нові дерева тощо у світ).",
  {1: ("Very Fast (20 Days)", "Дуже швидко (20 днів)"), 2: ("Fast (50 Days)", "Швидко (50 днів)"),
   3: ("Normal (100 Days)", "Нормально (100 днів)"), 4: ("Slow (200 Days)", "Повільно (200 днів)"),
   5: ("Very Slow (500 Days)", "Дуже повільно (500 днів)")})
p("ErosionDays", "Custom Erosion Days", "Власна кількість днів заростання",
  "For a custom Erosion Speed. Zero means use the Erosion Speed option. Maximum is 36,500 days (approximately 100 years).",
  "Для власної швидкості заростання. Нуль означає використання параметра «Швидкість заростання». Максимум 36500 днів (приблизно 100 років).", None)
p("Farming", "Plant Growth Speed", "Швидкість росту рослин",
  "The speed of plant growth.",
  "Швидкість росту рослин.",
  {1: ("Very Fast", "Дуже швидко"), 2: ("Fast", "Швидко"), 3: ("Normal", "Нормально"),
   4: ("Slow", "Повільно"), 5: ("Very Slow", "Дуже повільно")})
p("CompostTime", "Compost Time", "Час компостування",
  "How long it takes for food to break down in a composter.",
  "Скільки часу потрібно для розкладання їжі в компостері.",
  {1: ("1 Week", "1 тиждень"), 2: ("2 Weeks", "2 тижні"), 3: ("3 Weeks", "3 тижні"), 4: ("4 Weeks", "4 тижні"),
   5: ("6 Weeks", "6 тижнів"), 6: ("8 Weeks", "8 тижнів"), 7: ("10 Weeks", "10 тижнів"), 8: ("12 Weeks", "12 тижнів")})
p("StatsDecrease", "Stat Decrease Speed", "Швидкість зниження показників",
  "How fast the player's hunger, thirst, and fatigue will decrease.",
  "Як швидко знижуються показники голоду, спраги та втоми гравця.",
  {1: ("Very Fast", "Дуже швидко"), 2: ("Fast", "Швидко"), 3: ("Normal", "Нормально"),
   4: ("Slow", "Повільно"), 5: ("Very Slow", "Дуже повільно")})
p("NatureAbundance", "Foraging Abundance", "Рясність збиральництва",
  "The abundance of items found in Foraging mode.",
  "Рясність предметів, які можна знайти в режимі збиральництва.",
  {1: ("Very Poor", "Дуже бідно"), 2: ("Poor", "Бідно"), 3: ("Normal", "Нормально"),
   4: ("Abundant", "Рясно"), 5: ("Very Abundant", "Дуже рясно")})
p("Alarm", "House Alarm Chance", "Шанс домашньої сигналізації",
  "How likely the player is to activate a house alarm when breaking into a new house.",
  "Наскільки ймовірно гравець активує сигналізацію під час проникнення в новий будинок.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("LockedHouses", "Locked Houses", "Замкнені будинки",
  "How frequently the doors of homes and buildings will be locked when discovered.",
  "Як часто двері будинків і будівель будуть замкнені при виявленні.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("StarterKit", "Starter Kit", "Стартовий набір",
  "Spawn with chips, a water bottle, a small backpack, a baseball bat, and a hammer.",
  "З'явитися з чипсами, пляшкою води, маленьким рюкзаком, бейсбольною битою та молотком.", None)
p("Nutrition", "Nutrition", "Харчування",
  "Nutritional value of food affects the player's condition. Turning this off will stop the player gaining or losing weight.",
  "Поживна цінність їжі впливає на стан гравця. Вимкнення цього параметра зупинить набір або втрату ваги гравцем.", None)
p("FoodRotSpeed", "Food Rot Speed", "Швидкість псування їжі",
  "How fast food will spoil, inside or outside of a fridge.",
  "Як швидко псується їжа, у холодильнику чи поза ним.",
  {1: ("Very Fast", "Дуже швидко"), 2: ("Fast", "Швидко"), 3: ("Normal", "Нормально"),
   4: ("Slow", "Повільно"), 5: ("Very Slow", "Дуже повільно")})
p("FridgeFactor", "Fridge Factor", "Ефективність холодильника",
  "How effective a fridge will be at keeping food fresh for longer.",
  "Наскільки ефективно холодильник зберігатиме їжу свіжою довше.",
  {1: ("Very Low", "Дуже низька"), 2: ("Low", "Низька"), 3: ("Normal", "Нормальна"),
   4: ("High", "Висока"), 5: ("Very High", "Дуже висока"), 6: ("No decay", "Без псування")})
p("SeenHoursPreventLootRespawn", "Seen Hours Prevent Loot Respawn", "Години видимості, що блокують відродження здобичі",
  "When greater than 0, loot will not respawn in zones that have been visited within this number of in-game hours.",
  "Якщо більше 0, здобич не відроджуватиметься в зонах, які відвідувалися протягом цієї кількості ігрових годин.", None)
p("HoursForLootRespawn", "Hours For Loot Respawn", "Години до відродження здобичі",
  "When greater than 0, after X hours, all containers in towns and trailer parks in the world will respawn loot. To spawn loot a container must have been looted at least once. Loot respawn is not impacted by visibility or subsequent looting.",
  "Якщо більше 0, через X годин усі контейнери в містах і трейлерних парках отримають нову здобич. Щоб здобич з'явилася, контейнер мав бути обшуканий хоча б раз. На відродження здобичі не впливає видимість чи подальше обшукування.", None)
p("MaxItemsForLootRespawn", "Max Items For Loot Respawn", "Макс. предметів для відродження здобичі",
  "Containers with a number of items greater than, or equal to, this setting will not respawn loot.",
  "Контейнери з кількістю предметів більшою або рівною цьому значенню не отримають нову здобич.", None)
p("ConstructionPreventsLootRespawn", "Construction Prevents Loot Respawn", "Будівництво блокує відродження здобичі",
  "Items will not respawn in buildings that players have barricaded or built in.",
  "Предмети не відроджуватимуться в будівлях, які гравці забарикадували або добудували.", None)
p("WorldItemRemovalList", "World Item Removal List", "Список видалення предметів зі світу",
  "A comma-separated list of item types that will be removed after Hours For World Item Removal hours.",
  "Список типів предметів через кому, які буде видалено через задану кількість годин (Hours For World Item Removal).", None)
p("HoursForWorldItemRemoval", "Hours For World Item Removal", "Години до видалення предметів зі світу",
  "Number of hours since an item was dropped on the ground before it is removed. Items are removed the next time that part of the map is loaded. Zero means items are not removed.",
  "Кількість годин з моменту, коли предмет впав на землю, до його видалення. Предмети видаляються під час наступного завантаження цієї частини карти. Нуль означає, що предмети не видаляються.", None)
p("ItemRemovalListBlacklistToggle", "Invert World Item Removal List", "Інвертувати список видалення предметів",
  "If true, any items *not* in the World Item Removal List will be removed instead.",
  "Якщо увімкнено, видалятимуться всі предмети, яких *немає* у списку видалення предметів зі світу.", None)
p("TimeSinceApo", "Time Since Apocalypse", "Час з початку апокаліпсису",
  "How long after the end of the world to begin. This will affect starting world erosion and food spoilage. Does not affect the starting date.",
  "Скільки часу минуло від кінця світу до початку гри. Це впливає на початкове заростання світу та псування їжі. Не впливає на дату початку.",
  {1: ("0", "0"), 2: ("1", "1"), 3: ("2", "2"), 4: ("3", "3"), 5: ("4", "4"), 6: ("5", "5"), 7: ("6", "6"),
   8: ("7", "7"), 9: ("8", "8"), 10: ("9", "9"), 11: ("10", "10"), 12: ("11", "11"), 13: ("12", "12")})
p("PlantResilience", "Plant Resilience", "Стійкість рослин",
  "How much water plants will lose per day, and their ability to avoid disease.",
  "Скільки води втрачають рослини за день і їхня здатність уникати хвороб.",
  {1: ("Very High", "Дуже висока"), 2: ("High", "Висока"), 3: ("Normal", "Нормальна"),
   4: ("Low", "Низька"), 5: ("Very Low", "Дуже низька")})
p("PlantAbundance", "Plant Abundance", "Врожайність рослин",
  "The yield of plants when harvested.",
  "Врожайність рослин під час збору.",
  {1: ("Very Poor", "Дуже бідна"), 2: ("Poor", "Бідна"), 3: ("Normal", "Нормальна"),
   4: ("Abundant", "Рясна"), 5: ("Very Abundant", "Дуже рясна")})
p("EndRegen", "Endurance Regen", "Відновлення витривалості",
  "Recovery from being tired after performing actions.",
  "Відновлення після втоми від виконання дій.",
  {1: ("Very Fast", "Дуже швидко"), 2: ("Fast", "Швидко"), 3: ("Normal", "Нормально"),
   4: ("Slow", "Повільно"), 5: ("Very Slow", "Дуже повільно")})
p("Helicopter", "Helicopter Event", "Подія з гелікоптером",
  "How regularly a helicopter passes over the Event Zone.",
  "Як часто гелікоптер пролітає над зоною події.",
  {1: ("Never", "Ніколи"), 2: ("Once", "Один раз"), 3: ("Sometimes", "Іноді"), 4: ("Often", "Часто")})
p("MetaEvent", "Meta Event", "Мета-подія",
  "How often zombie-attracting metagame events like distant gunshots will occur.",
  "Як часто відбуваються мета-події, що приваблюють зомбі, наприклад, далекі постріли.",
  {1: ("Never", "Ніколи"), 2: ("Sometimes", "Іноді"), 3: ("Often", "Часто")})
p("SleepingEvent", "Sleeping Event", "Подія під час сну",
  "How often events during the player's sleep, like nightmares, occur.",
  "Як часто трапляються події під час сну гравця, наприклад, кошмари.",
  {1: ("Never", "Ніколи"), 2: ("Sometimes", "Іноді"), 3: ("Often", "Часто")})
p("GeneratorFuelConsumption", "Generator Fuel Consumption", "Витрата палива генератором",
  "How much fuel is consumed by generators per in-game hour.",
  "Скільки палива споживає генератор за одну ігрову годину.", None)
p("GeneratorSpawning", "Generator Spawn Chance", "Шанс появи генератора",
  "The chance of electrical generators spawning on the map.",
  "Шанс появи електрогенераторів на карті.",
  {1: ("None (not recommended)", "Відсутній (не рекомендовано)"), 2: ("Insanely Rare", "Надзвичайно рідко"),
   3: ("Extremely Rare", "Дуже рідко"), 4: ("Rare", "Рідко"), 5: ("Normal", "Нормально"),
   6: ("Common", "Часто"), 7: ("Abundant", "Рясно")})
p("AnnotatedMapChance", "Annotated Map Chance", "Шанс карти з нотатками",
  "How often a looted map will have notes on it, written by a deceased survivor.",
  "Як часто на знайденій карті є нотатки, залишені загиблим виживальцем.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("CharacterFreePoints", "Character Free Points", "Вільні очки персонажа",
  "Adds free trait points during character creation.",
  "Додає вільні очки рис під час створення персонажа.", None)
p("ConstructionBonusPoints", "Construction Bonus HP", "Бонус міцності будівель",
  "Gives player-built constructions extra hit points so they are more resistant to zombie damage.",
  "Надає побудованим гравцем спорудам додаткову міцність, щоб вони краще витримували атаки зомбі.",
  {1: ("Very Low", "Дуже низький"), 2: ("Low", "Низький"), 3: ("Normal", "Нормальний"),
   4: ("High", "Високий"), 5: ("Very High", "Дуже високий")})
p("NightDarkness", "Night Darkness", "Темрява вночі",
  "The level of ambient lighting at night.",
  "Рівень навколишнього освітлення вночі.",
  {1: ("Pitch Black", "Абсолютна темрява"), 2: ("Dark", "Темно"), 3: ("Normal", "Нормально"), 4: ("Bright", "Світло")})
p("NightLength", "Night Length", "Тривалість ночі",
  "The time from dusk to dawn.",
  "Час від сутінків до світанку.",
  {1: ("Always Night", "Завжди ніч"), 2: ("Long", "Довга"), 3: ("Normal", "Нормальна"),
   4: ("Short", "Коротка"), 5: ("Always Day", "Завжди день")})
p("BoneFracture", "Bone Fracture", "Переломи кісток",
  "If survivors can get broken limbs from impacts, zombie damage, falls etc.",
  "Чи можуть виживальці отримувати переломи кінцівок від ударів, атак зомбі, падінь тощо.", None)
p("InjurySeverity", "Injury Severity", "Тяжкість травм",
  "The impact that injuries have on your body, and their healing time.",
  "Вплив травм на тіло та час їх загоєння.",
  {1: ("Low", "Низька"), 2: ("Normal", "Нормальна"), 3: ("High", "Висока")})
p("HoursForCorpseRemoval", "Hours For Corpse Removal", "Години до видалення трупів",
  "How long, in hours, before dead zombie bodies disappear from the world. If 0, maggots will not spawn on corpses.",
  "Скільки годин минає, перш ніж трупи зомбі зникають зі світу. Якщо 0, на трупах не з'являтимуться личинки.", None)
p("DecayingCorpseHealthImpact", "Corpse Health Impact", "Вплив трупів на здоров'я",
  "The impact that nearby decaying bodies has on the player's health and emotions.",
  "Вплив трупів, що розкладаються поруч, на здоров'я та емоції гравця.",
  {1: ("None", "Відсутній"), 2: ("Low", "Низький"), 3: ("Normal", "Нормальний"), 4: ("High", "Високий"), 5: ("Insane", "Надзвичайний")})
p("ZombieHealthImpact", "Zombie Health Impact", "Вплив зомбі на здоров'я",
  "Whether nearby 'living' zombies have the same impact on the player's health and emotions as decaying corpses.",
  "Чи мають зомбі поруч ('живі') такий самий вплив на здоров'я та емоції гравця, як і трупи, що розкладаються.", None)
p("BloodLevel", "Blood Level", "Рівень крові",
  "How much blood is sprayed on floors and walls by injuries.",
  "Скільки крові розбризкується на підлозі та стінах через травми.",
  {1: ("None", "Відсутній"), 2: ("Low", "Низький"), 3: ("Normal", "Нормальний"), 4: ("High", "Високий"), 5: ("Ultra Gore", "Ультра криваво")})
p("ClothingDegradation", "Clothing Degradation", "Зношення одягу",
  "How quickly clothing degrades, becomes dirty, and bloodied.",
  "Як швидко одяг зношується, забруднюється та вкривається кров'ю.",
  {1: ("Disabled", "Вимкнено"), 2: ("Slow", "Повільно"), 3: ("Normal", "Нормально"), 4: ("Fast", "Швидко")})
p("FireSpread", "Fire Spread", "Розповсюдження вогню",
  "If fires spread when started.",
  "Чи розповсюджується вогонь після займання.", None)
p("DaysForRottenFoodRemoval", "Days For Rotten Food Removal", "Днів до видалення гнилої їжі",
  "Number of in-game days before rotten food is removed from the map. -1 means rotten food is never removed.",
  "Кількість ігрових днів до видалення гнилої їжі з карти. -1 означає, що гнила їжа ніколи не видаляється.", None)
p("AllowExteriorGenerator", "Allow Exterior Generator", "Дозволити генератор ззовні",
  "If enabled, generators will work on exterior tiles. This will allow, for example, the powering of gas pumps.",
  "Якщо увімкнено, генератори працюватимуть на зовнішніх тайлах. Це дозволить, наприклад, живити бензоколонки.", None)
p("MaxFogIntensity", "Max Fog Intensity", "Макс. інтенсивність туману",
  "Maximum intensity of fog.",
  "Максимальна інтенсивність туману.",
  {1: ("Normal", "Нормальна"), 2: ("Moderate", "Помірна"), 3: ("Low", "Низька"), 4: ("None", "Відсутня")})
p("MaxRainFxIntensity", "Max Rain FX Intensity", "Макс. інтенсивність ефекту дощу",
  "Maximum intensity of rain visual effects.",
  "Максимальна інтенсивність візуальних ефектів дощу.",
  {1: ("Normal", "Нормальна"), 2: ("Moderate", "Помірна"), 3: ("Low", "Низька")})
p("EnableSnowOnGround", "Snow Accumulation", "Накопичення снігу",
  "If snow will accumulate on the ground. If disabled, snow will still show on vegetation and rooftops.",
  "Чи накопичується сніг на землі. Якщо вимкнено, сніг усе одно з'являтиметься на рослинності та дахах.", None)
p("AttackBlockMovements", "Attack Blocks Movement", "Атака блокує рух",
  "If melee attacking slows you down.",
  "Чи сповільнює вас атака в ближньому бою.", None)
p("SurvivorHouseChance", "Survivor House Chance", "Шанс будинку виживальця",
  "The chance of finding randomized buildings on the map (eg. burnt out houses, ones containing loot stashes or dead bodies).",
  "Шанс знайти на карті випадково згенеровані будівлі (наприклад, спалені будинки, будинки зі схованками здобичі чи трупами).",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто"), 7: ("Always Tries", "Завжди намагається")})
p("VehicleStoryChance", "Vehicle Story Chance", "Шанс автомобільної історії",
  "The chance of road stories (eg. police roadblocks) spawning.",
  "Шанс появи дорожніх історій (наприклад, поліцейських блокпостів).",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто"), 7: ("Always Tries", "Завжди намагається")})
p("ZoneStoryChance", "Zone Story Chance", "Шанс зональної історії",
  "The chance of stories specific to map zones (eg. a campsite in a forest) spawning.",
  "Шанс появи історій, специфічних для зон карти (наприклад, табору в лісі).",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто"), 7: ("Always Tries", "Завжди намагається")})
p("AllClothesUnlocked", "All Clothes Unlocked", "Весь одяг розблоковано",
  "Allows you to select from every piece of clothing in the game when customizing your character.",
  "Дозволяє обрати будь-який предмет одягу в грі під час налаштування персонажа.", None)
p("EnableTaintedWaterText", "Tainted Water Warning", "Попередження про заражену воду",
  "If tainted water will show a warning marking it as such.",
  "Чи показує заражена вода попередження про це.", None)
p("EnableVehicles", "Enable Vehicles", "Увімкнути транспорт",
  "If vehicles will spawn.",
  "Чи з'являється транспорт у грі.", None)
p("CarSpawnRate", "Car Spawn Rate", "Частота появи авто",
  "How frequently vehicles can be discovered on the map.",
  "Як часто транспорт можна знайти на карті.",
  {1: ("None", "Відсутня"), 2: ("Very Low", "Дуже низька"), 3: ("Low", "Низька"), 4: ("Normal", "Нормальна"), 5: ("High", "Висока")})
p("ZombieAttractionMultiplier", "Zombie Attraction Multiplier", "Множник приваблення зомбі",
  "General engine loudness to zombies.",
  "Загальна гучність двигуна для зомбі.", None)
p("VehicleEasyUse", "Vehicle Easy Use", "Легке використання транспорту",
  "Whether found vehicles are locked, need keys to start etc.",
  "Чи замкнений знайдений транспорт, чи потрібні ключі для запуску тощо.", None)
p("InitialGas", "Initial Gas", "Початкова кількість пального",
  "How full the gas tank of discovered vehicles will be.",
  "Наскільки повний бак пального в знайденого транспорту.",
  {1: ("Very Low", "Дуже мало"), 2: ("Low", "Мало"), 3: ("Normal", "Нормально"),
   4: ("High", "Багато"), 5: ("Very High", "Дуже багато"), 6: ("Full", "Повний")})
p("FuelStationGasInfinite", "Infinite Gas Station Fuel", "Нескінченне пальне на заправках",
  "If enabled, gas pumps will never run out of fuel.",
  "Якщо увімкнено, бензоколонки ніколи не закінчать пальне.", None)
p("FuelStationGasMin", "Gas Station Fuel Min", "Мін. пальне на заправках",
  "The minimum amount of gasoline that can spawn in gas pumps. Check the Advanced box to use a custom amount.",
  "Мінімальна кількість пального, яка може з'явитися на бензоколонках. Позначте «Розширені», щоб використати власне значення.", None)
p("FuelStationGasMax", "Gas Station Fuel Max", "Макс. пальне на заправках",
  "The maximum amount of gasoline that can spawn in gas pumps. Check the Advanced box to use a custom amount.",
  "Максимальна кількість пального, яка може з'явитися на бензоколонках. Позначте «Розширені», щоб використати власне значення.", None)
p("FuelStationGasEmptyChance", "Gas Station Empty Chance", "Шанс порожньої заправки",
  "The chance, as a percentage, that individual gas pumps will initially have no fuel.",
  "Шанс у відсотках, що окрема бензоколонка спочатку буде без пального.", None)
p("LockedCar", "Locked Car Chance", "Шанс замкненого авто",
  "How likely cars will be locked.",
  "Наскільки ймовірно, що авто буде замкнене.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("CarGasConsumption", "Car Gas Consumption", "Витрата пального авто",
  "How gas-hungry vehicles are.",
  "Наскільки прожерливий транспорт до пального.", None)
p("CarGeneralCondition", "Car General Condition", "Загальний стан авто",
  "General condition discovered vehicles will be in.",
  "Загальний стан, у якому буде знайдений транспорт.",
  {1: ("Very Low", "Дуже поганий"), 2: ("Low", "Поганий"), 3: ("Normal", "Нормальний"),
   4: ("High", "Хороший"), 5: ("Very High", "Дуже хороший")})
p("CarDamageOnImpact", "Car Damage On Impact", "Пошкодження авто при зіткненні",
  "The amount of damage dealt to vehicles that crash.",
  "Кількість пошкоджень, що завдаються транспорту при аварії.",
  {1: ("Very Low", "Дуже мало"), 2: ("Low", "Мало"), 3: ("Normal", "Нормально"),
   4: ("High", "Багато"), 5: ("Very High", "Дуже багато")})
p("DamageToPlayerFromHitByACar", "Player Damage From Car", "Шкода гравцю від авто",
  "Damage received by the player from being hit by a car.",
  "Шкода, яку отримує гравець, коли його збиває авто.",
  {1: ("None", "Відсутня"), 2: ("Low", "Мала"), 3: ("Normal", "Нормальна"), 4: ("High", "Велика"), 5: ("Very High", "Дуже велика")})
p("TrafficJam", "Traffic Jam", "Затори з авто",
  "If traffic jams consisting of wrecked cars will appear on main roads.",
  "Чи з'являються на головних дорогах затори з розбитих авто.", None)
p("CarAlarm", "Car Alarm Chance", "Шанс автосигналізації",
  "How frequently discovered vehicles have active alarms.",
  "Як часто знайдений транспорт має активну сигналізацію.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("PlayerDamageFromCrash", "Player Damage From Crash", "Шкода гравцю від аварії",
  "If the player can get injured from being in a car accident.",
  "Чи може гравець отримати травми, потрапивши в автомобільну аварію.", None)
p("SirenShutoffHours", "Siren Shutoff Hours", "Годин до вимкнення сирени",
  "How many in-game hours before a wailing siren shuts off.",
  "Скільки ігрових годин минає до вимкнення сирени, що виє.", None)
p("ChanceHasGas", "Chance Has Gas", "Шанс наявності пального",
  "The chance of finding a vehicle with gas in its tank.",
  "Шанс знайти транспорт з пальним у баку.",
  {1: ("Low", "Малий"), 2: ("Normal", "Нормальний"), 3: ("High", "Великий")})
p("RecentlySurvivorVehicles", "Recently Survivor Vehicles", "Недавно доглянутий транспорт",
  "Whether a player can discover a car that has been cared for after the Knox infection struck.",
  "Чи може гравець знайти авто, за яким доглядали вже після спалаху інфекції Нокс.",
  {1: ("None", "Відсутньо"), 2: ("Low", "Мало"), 3: ("Normal", "Нормально"), 4: ("High", "Багато")})
p("MultiHitZombies", "Multi-Hit Zombies", "Багатоцільові удари по зомбі",
  "If certain melee weapons will be able to strike multiple zombies in one hit.",
  "Чи можуть певні види зброї ближнього бою вражати кількох зомбі одним ударом.", None)
p("RearVulnerability", "Rear Vulnerability", "Вразливість зі спини",
  "Chance of being bitten when a zombie attacks from behind.",
  "Шанс отримати укус, коли зомбі атакує ззаду.",
  {1: ("Low", "Малий"), 2: ("Medium", "Середній"), 3: ("High", "Великий")})
p("SirenEffectsZombies", "Siren Effects Zombies", "Сирени приваблюють зомбі",
  "If zombies will head towards the sound of vehicle sirens.",
  "Чи прямують зомбі на звук автомобільних сирен.", None)
p("AnimalStatsModifier", "Animal Stats Modifier", "Модифікатор показників тварин",
  "Speed at which animal stats (hunger, thirst etc.) reduce.",
  "Швидкість зниження показників тварин (голод, спрага тощо).",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalMetaStatsModifier", "Animal Meta Stats Modifier", "Модифікатор показників тварин (мета)",
  "Speed at which animal stats (hunger, thirst etc.) reduce while in meta (not actively simulated).",
  "Швидкість зниження показників тварин (голод, спрага тощо), коли вони не симулюються активно (мета-режим).",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalPregnancyTime", "Animal Pregnancy Time", "Тривалість вагітності тварин",
  "How long animals will be pregnant for before giving birth.",
  "Скільки часу триває вагітність тварин до народження потомства.",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalAgeModifier", "Animal Age Modifier", "Модифікатор віку тварин",
  "Speed at which animals age.",
  "Швидкість старіння тварин.",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalMilkIncModifier", "Animal Milk Increase Modifier", "Модифікатор надою молока",
  "Speed at which animal milk production increases.",
  "Швидкість збільшення надою молока в тварин.",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalWoolIncModifier", "Animal Wool Increase Modifier", "Модифікатор приросту вовни",
  "Speed at which animal wool growth increases.",
  "Швидкість збільшення приросту вовни в тварин.",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalRanchChance", "Animal Ranch Chance", "Шанс тварин на фермі",
  "The chance of finding animals on a farm.",
  "Шанс знайти тварин на фермі.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто"), 7: ("Always", "Завжди")})
p("AnimalGrassRegrowTime", "Animal Grass Regrow Time", "Час відростання трави",
  "The number of hours grass will regrow after being eaten by an animal or cut by the player.",
  "Кількість годин, за які трава відростає після того, як її з'їла тварина чи скосив гравець.", None)
p("AnimalMetaPredator", "Animal Meta Predator", "Мета-хижак для тварин",
  "If a meta (ie. not actually visible in-game) fox may attack your chickens if the hutch's door is left open at night.",
  "Чи може мета-лисиця (тобто не показана безпосередньо в грі) напасти на курей, якщо дверцята курника залишили відкритими на ніч.", None)
p("AnimalMatingSeason", "Animal Mating Season", "Сезон парування тварин",
  "If on, animals will only mate during their breeding season (if any). Otherwise they can reproduce/lay eggs all year round.",
  "Якщо увімкнено, тварини паруватимуться лише в сезон розмноження (якщо він є). Інакше вони можуть розмножуватися/нести яйця цілий рік.", None)
p("AnimalEggHatch", "Animal Egg Hatch Time", "Час виведення з яєць",
  "How long before baby animals will hatch from eggs.",
  "Скільки часу минає до вилуплення малят тварин з яєць.",
  {1: ("Ultra Fast", "Дуже швидко"), 2: ("Very Fast", "Дуже швидко"), 3: ("Fast", "Швидко"),
   4: ("Normal", "Нормально"), 5: ("Slow", "Повільно"), 6: ("Very Slow", "Дуже повільно")})
p("AnimalSoundAttractZombies", "Animal Sounds Attract Zombies", "Звуки тварин приваблюють зомбі",
  "If true, animal calls will attract nearby zombies.",
  "Якщо увімкнено, звуки тварин приваблюватимуть зомбі поруч.", None)
p("AnimalTrackChance", "Animal Track Chance", "Шанс слідів тварин",
  "The chance of animals leaving tracks.",
  "Шанс, що тварини залишать сліди.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("AnimalPathChance", "Animal Path Chance", "Шанс стежок тварин",
  "The chance of creating a path for animals to be hunted.",
  "Шанс створення стежки для полювання на тварин.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто")})
p("MaximumRatIndex", "Maximum Vermin Index", "Максимальний індекс шкідників",
  "The frequency and intensity of eg. rats in infested buildings.",
  "Частота та інтенсивність, наприклад, щурів у заражених будівлях.", None)
p("DaysUntilMaximumRatIndex", "Days Until Maximum Vermin Index", "Днів до макс. індексу шкідників",
  "How long it takes for the Maximum Vermin Index to be reached.",
  "Скільки часу потрібно для досягнення максимального індексу шкідників.", None)
p("MetaKnowledge", "Meta Knowledge", "Мета-знання",
  "If a piece of media hasn't been fully seen or read, this setting determines whether it's displayed fully, displayed as '???', or hidden completely.",
  "Якщо медіа-предмет не був повністю переглянутий чи прочитаний, цей параметр визначає, чи показувати його повністю, як '???' чи приховати повністю.",
  {1: ("Fully revealed", "Повністю відкрито"), 2: ("Shown as ???", "Показано як ???"), 3: ("Completely hidden", "Повністю приховано")})
p("SeeNotLearntRecipe", "See Not Learnt Recipes", "Бачити невивчені рецепти",
  "If true, you will be able to see any recipes that can be done with a station, even if you haven't learnt them yet.",
  "Якщо увімкнено, ви зможете бачити всі рецепти, доступні на верстаті, навіть якщо ще не вивчили їх.", None)
p("MaximumLootedBuildingRooms", "Max Looted Building Rooms", "Макс. кімнат в обшуканій будівлі",
  "If a building has more than this amount of rooms it will not be looted.",
  "Якщо в будівлі більше кімнат, ніж це значення, вона не буде попередньо обшукана.", None)
p("EnablePoisoning", "Enable Poisoning", "Увімкнути отруєння",
  "If poison can be added to food.",
  "Чи можна додавати отруту в їжу.",
  {1: ("True", "Так"), 2: ("False", "Ні"), 3: ("Only bleach poisoning is disabled", "Вимкнено лише отруєння відбілювачем")})
p("MaggotSpawn", "Maggot Spawn", "Поява личинок",
  "If/when maggots can spawn in corpses.",
  "Чи/коли личинки можуть з'являтися в трупах.",
  {1: ("In and Around Bodies", "У тілах і навколо них"), 2: ("In Bodies Only", "Лише в тілах"), 3: ("Never", "Ніколи")})
p("LightBulbLifespan", "Light Bulb Lifespan", "Термін служби лампочок",
  "The higher the value, the longer lightbulbs last before breaking. If 0, lightbulbs will never break. Does not affect vehicle headlights.",
  "Чим вище значення, тим довше служать лампочки до перегорання. Якщо 0, лампочки ніколи не перегорають. Не впливає на фари авто.", None)
p("FishAbundance", "Fish Abundance", "Рясність риби",
  "The abundance of fish in rivers and lakes.",
  "Рясність риби в річках і озерах.",
  {1: ("Very Poor", "Дуже бідна"), 2: ("Poor", "Бідна"), 3: ("Normal", "Нормальна"),
   4: ("Abundant", "Рясна"), 5: ("Very Abundant", "Дуже рясна")})
p("LevelForMediaXPCutoff", "Media XP Cutoff Level", "Рівень відсічення досвіду від медіа",
  "When a skill is at this level or above, television/VHS/other media will not provide XP for it.",
  "Коли навичка досягає цього рівня або вище, телебачення/відео/інші медіа більше не дають досвіду за неї.", None)
p("LevelForDismantleXPCutoff", "Dismantle XP Cutoff Level", "Рівень відсічення досвіду розбирання",
  "When a skill is at this level or above, scrapping furniture does not provide XP for the relevant skill. Does not apply to Electrical.",
  "Коли навичка досягає цього рівня або вище, розбирання меблів більше не дає досвіду за відповідну навичку. Не стосується електрики.", None)
p("BloodSplatLifespanDays", "Blood Splat Lifespan (Days)", "Тривалість плям крові (днів)",
  "Number of days before old blood splats are removed. Removal happens when map chunks are loaded. 0 means they will never disappear.",
  "Кількість днів до видалення старих плям крові. Видалення відбувається під час завантаження ділянок карти. 0 означає, що вони ніколи не зникнуть.", None)
p("LiteratureCooldown", "Literature Cooldown", "Перечитування літератури",
  "Number of days before one can benefit from reading previously read literature items.",
  "Кількість днів до того, як можна знову отримати користь від повторного читання прочитаної літератури.", None)
p("NegativeTraitsPenalty", "Negative Traits Penalty", "Штраф за негативні риси",
  "If there are diminishing returns on bonus trait points provided from selecting multiple negative traits.",
  "Чи зменшується віддача бонусних очок рис при виборі кількох негативних рис.",
  {1: ("None", "Відсутній"), 2: ("1 point penalty for every 3 negative traits selected", "Штраф 1 очко за кожні 3 обрані негативні риси"),
   3: ("1 point penalty for every 2 negative traits selected", "Штраф 1 очко за кожні 2 обрані негативні риси"),
   4: ("1 point penalty for every negative trait selected after the first", "Штраф 1 очко за кожну негативну рису після першої")})
p("MinutesPerPage", "Minutes Per Page", "Хвилин на сторінку",
  "The number of in-game minutes it takes to read one page of a skill book.",
  "Кількість ігрових хвилин, потрібних для прочитання однієї сторінки книги навичок.", None)
p("KillInsideCrops", "Kill Indoor Crops", "Знищувати рослини в приміщенні",
  "When enabled, crops and herbs grown inside buildings will die. Does not affect houseplants.",
  "Якщо увімкнено, культури та трави, вирощені в приміщеннях, гинуть. Не впливає на кімнатні рослини.", None)
p("PlantGrowingSeasons", "Plant Growing Seasons", "Сезонність росту рослин",
  "When enabled, the growth of plants is affected by seasons.",
  "Якщо увімкнено, ріст рослин залежить від пори року.", None)
p("PlaceDirtAboveground", "Place Dirt Aboveground", "Розміщення землі над рівнем землі",
  "[!] It is recommended that you DO NOT change this. Changing this can result in performance issues. [!] When enabled, dirt can be placed, and farming performed, on levels other than the ground level.",
  "[!] Рекомендується НЕ змінювати це значення. Зміна може призвести до проблем з продуктивністю. [!] Якщо увімкнено, землю можна розміщувати, а фермерство здійснювати на рівнях, відмінних від рівня землі.", None)
p("FarmingSpeedNew", "Farming Speed", "Швидкість фермерства",
  "The speed of plant growth.",
  "Швидкість росту рослин.", None)
p("FarmingAmountNew", "Farming Amount", "Кількість врожаю",
  "The abundance of harvested crops.",
  "Рясність зібраного врожаю.", None)
p("MaximumLooted", "Maximum Looted Chance", "Макс. шанс обшуканості",
  "The chance that any building will already be looted when found. Check the Advanced box to use a custom number.",
  "Шанс, що будь-яка будівля вже буде обшукана при знаходженні. Позначте «Розширені», щоб використати власне значення.", None)
p("DaysUntilMaximumLooted", "Days Until Maximum Looted", "Днів до макс. шансу обшуканості",
  "How long it takes for Maximum Looted Building Chance to be reached.",
  "Скільки часу потрібно для досягнення максимального шансу обшуканості будівлі.", None)
p("RuralLooted", "Rural Looted Chance", "Шанс обшуканості сільських будівель",
  "The chance that any rural building will already be looted when found. Check the Advanced box to use a custom number.",
  "Шанс, що будь-яка сільська будівля вже буде обшукана при знаходженні. Позначте «Розширені», щоб використати власне значення.", None)
p("MaximumDiminishedLoot", "Maximum Diminished Loot", "Макс. зменшення здобичі",
  "The maximum loot that won't spawn when Days Until Maximum Diminished Loot is reached. Check the Advanced box to use an exact percentage.",
  "Максимальна частка здобичі, яка не з'явиться після досягнення «Днів до максимального зменшення здобичі». Позначте «Розширені», щоб використати точний відсоток.", None)
p("DaysUntilMaximumDiminishedLoot", "Days Until Maximum Diminished Loot", "Днів до макс. зменшення здобичі",
  "How long it takes for Maximum Diminished Loot Percentage to be reached.",
  "Скільки часу потрібно для досягнення максимального відсотка зменшення здобичі.", None)
p("MuscleStrainFactor", "Muscle Strain Factor", "Коефіцієнт м'язового навантаження",
  "Functions as a multiplier when applying muscle strain from swinging weapons or carrying heavy loads.",
  "Діє як множник при застосуванні м'язового навантаження від розмахування зброєю чи перенесення важких вантажів.", None)
p("DiscomfortFactor", "Discomfort Factor", "Коефіцієнт дискомфорту",
  "Functions as a multiplier when applying discomfort from worn items.",
  "Діє як множник при застосуванні дискомфорту від одягнених предметів.", None)
p("WoundInfectionFactor", "Wound Infection Factor", "Коефіцієнт зараження ран",
  "If greater than zero, damage can be taken from serious wound infections.",
  "Якщо більше нуля, можна отримувати шкоду від серйозних заражень ран.", None)
p("NoBlackClothes", "No Black Clothes", "Без чорного одягу",
  "If true, clothing with randomized tints will not be so dark as to be virtually black.",
  "Якщо увімкнено, одяг з випадковим відтінком не буде настільки темним, щоб виглядати практично чорним.", None)
p("EasyClimbing", "Easy Climbing", "Легке лазіння",
  "Disables the failure chances when climbing sheet ropes or over walls.",
  "Вимикає шанс невдачі при лазінні по мотузках зі простирадл чи через стіни.", None)
p("MaximumFireFuelHours", "Maximum Fire Fuel Hours", "Макс. годин палива для вогню",
  "The maximum hours of fuel that can be placed in a campfire, wood stove etc.",
  "Максимальна кількість годин палива, яку можна закласти у вогнище, дров'яну пічку тощо.", None)
p("FirearmUseDamageChance", "Firearm Chance-To-Damage Mode", "Режим шансу пошкодження зброї",
  "Replaces Chance-To-Hit mechanics with Chance-To-Damage calculations. This mode prioritizes player aiming.",
  "Замінює механіку «шанс влучання» на розрахунки «шанс пошкодження». Цей режим надає пріоритет прицілюванню гравця.",
  {1: ("Disabled", "Вимкнено"), 2: ("Zombies only", "Лише зомбі"), 3: ("All types of target", "Усі типи цілей")})
p("FirearmNoiseMultiplier", "Firearm Noise Multiplier", "Множник шуму зброї",
  "A multiplier for the distance at which zombies can hear gunshots.",
  "Множник відстані, на якій зомбі чують постріли.", None)
p("FirearmJamMultiplier", "Firearm Jam Multiplier", "Множник заклинювання зброї",
  "Multiplier for firearm jamming chance. 0 disables jamming.",
  "Множник шансу заклинювання вогнепальної зброї. 0 вимикає заклинювання.", None)
p("FirearmMoodleMultiplier", "Firearm Moodle Multiplier", "Множник впливу муддлів на зброю",
  "Multiplier for Moodle effects on hit chance. 0 disables the Moodle penalty.",
  "Множник впливу муддлів на шанс влучання. 0 вимикає штраф від муддлів.", None)
p("FirearmWeatherMultiplier", "Firearm Weather Multiplier", "Множник впливу погоди на зброю",
  "Multiplier for the effects of weather (wind, rain and fog) on hit chance. 0 disables the weather effect.",
  "Множник впливу погоди (вітер, дощ і туман) на шанс влучання. 0 вимикає вплив погоди.", None)
p("FirearmHeadGearEffect", "Firearm Headgear Effect", "Вплив головних уборів на зброю",
  "Enable to have headgear like welding masks affect hit chance.",
  "Увімкніть, щоб головні убори, як-от зварювальні маски, впливали на шанс влучання.", None)
p("ClayLakeChance", "Clay Lake Chance", "Шанс глини в озерах",
  "Chance to turn a dirt floor into a clay floor. Applies to lakes.",
  "Шанс перетворення земляної підлоги на глиняну. Стосується озер.", None)
p("ClayRiverChance", "Clay River Chance", "Шанс глини в річках",
  "Chance to turn a dirt floor into a clay floor. Applies to rivers.",
  "Шанс перетворення земляної підлоги на глиняну. Стосується річок.", None)
p("GeneratorTileRange", "Generator Tile Range", "Радіус дії генератора (тайли)",
  "The radius, in tiles, that a generator can provide electricity to.",
  "Радіус у тайлах, на який генератор може подавати електрику.", None)
p("GeneratorVerticalPowerRange", "Generator Vertical Power Range", "Вертикальний радіус дії генератора",
  "How many levels both above and below a generator it can provide electricity to.",
  "На скільки поверхів вище та нижче генератор може подавати електрику.", None)

# ---------------- Basement ----------------
p("Basement.SpawnFrequency", "Basement Spawn Frequency", "Частота появи підвалів",
  "How frequently basements spawn at random locations.",
  "Як часто підвали з'являються у випадкових місцях.",
  {1: ("Never", "Ніколи"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто"), 7: ("Always", "Завжди")})

# ---------------- Map ----------------
p("Map.AllowMiniMap", "Allow Mini-Map", "Дозволити міні-карту",
  "If enabled, a mini-map window will be available.",
  "Якщо увімкнено, буде доступне вікно міні-карти.", None)
p("Map.AllowWorldMap", "Allow World Map", "Дозволити карту світу",
  "If enabled, the world map can be accessed.",
  "Якщо увімкнено, можна відкрити карту світу.", None)
p("Map.MapAllKnown", "Map Fully Revealed", "Карта повністю відкрита",
  "If enabled, the world map will be completely filled in on starting the game.",
  "Якщо увімкнено, карта світу буде повністю заповнена на початку гри.", None)
p("Map.MapNeedsLight", "Map Needs Light", "Карті потрібне світло",
  "If enabled, maps can't be read unless there's a source of light available.",
  "Якщо увімкнено, карту не можна читати без джерела світла.", None)

# ---------------- ZombieLore ----------------
p("ZombieLore.Speed", "Zombie Speed", "Швидкість зомбі",
  "How fast zombies move.",
  "Як швидко рухаються зомбі.",
  {1: ("Sprinters", "Спринтери"), 2: ("Fast Shamblers", "Швидкі шаркуни"), 3: ("Shamblers", "Шаркуни"), 4: ("Random", "Випадково")})
p("ZombieLore.SprinterPercentage", "Sprinter Percentage", "Відсоток спринтерів",
  "If Random Speed is enabled, this controls what percentage of zombies are Sprinters. Check the Advanced box to use a custom percentage.",
  "Якщо ввімкнено випадкову швидкість, цей параметр визначає, який відсоток зомбі є спринтерами. Позначте «Розширені», щоб використати власний відсоток.", None)
p("ZombieLore.Strength", "Zombie Strength", "Сила зомбі",
  "The damage zombies inflict per attack.",
  "Шкода, яку завдають зомбі за одну атаку.",
  {1: ("Superhuman", "Надлюдська"), 2: ("Normal", "Нормальна"), 3: ("Weak", "Слабка"), 4: ("Random", "Випадково")})
p("ZombieLore.Toughness", "Zombie Toughness", "Живучість зомбі",
  "The difficulty of killing a zombie.",
  "Складність знищення зомбі.",
  {1: ("Tough", "Живучі"), 2: ("Normal", "Нормальна"), 3: ("Fragile", "Тендітні"), 4: ("Random", "Випадково")})
p("ZombieLore.Transmission", "Infection Transmission", "Передача інфекції",
  "How the Knox Virus spreads.",
  "Як розповсюджується вірус Нокс.",
  {1: ("Blood and Saliva", "Кров і слина"), 2: ("Saliva Only", "Лише слина"),
   3: ("Everyone's Infected", "Усі вже інфіковані"), 4: ("None", "Не передається")})
p("ZombieLore.Mortality", "Infection Mortality", "Швидкість дії інфекції",
  "How quickly the infection takes effect.",
  "Як швидко інфекція починає діяти.",
  {1: ("Instant", "Миттєво"), 2: ("0-30 Seconds", "0-30 секунд"), 3: ("0-1 Minutes", "0-1 хвилина"),
   4: ("0-12 Hours", "0-12 годин"), 5: ("2-3 Days", "2-3 дні"), 6: ("1-2 Weeks", "1-2 тижні"), 7: ("Never", "Ніколи")})
p("ZombieLore.Reanimate", "Reanimate Time", "Час воскресіння",
  "How quickly infected corpses rise as zombies.",
  "Як швидко заражені трупи повстають зомбі.",
  {1: ("Instant", "Миттєво"), 2: ("0-30 Seconds", "0-30 секунд"), 3: ("0-1 Minutes", "0-1 хвилина"),
   4: ("0-12 Hours", "0-12 годин"), 5: ("2-3 Days", "2-3 дні"), 6: ("1-2 Weeks", "1-2 тижні")})
p("ZombieLore.Cognition", "Zombie Cognition", "Інтелект зомбі",
  "Zombie intelligence.",
  "Інтелект зомбі.",
  {1: ("Navigate and Use Doors", "Орієнтуються і відчиняють двері"), 2: ("Navigate", "Орієнтуються"),
   3: ("Basic Navigation", "Базове орієнтування"), 4: ("Random", "Випадково")})
p("ZombieLore.DoorOpeningPercentage", "Door Opening Percentage", "Відсоток відчинення дверей",
  "The percentage chance that a zombie capable of opening doors will succeed.",
  "Відсотковий шанс, що зомбі, здатний відчиняти двері, зробить це успішно.", None)
p("ZombieLore.CrawlUnderVehicle", "Crawl Under Vehicle", "Повзання під транспортом",
  "How often zombies can crawl under parked vehicles.",
  "Як часто зомбі можуть повзати під припаркованим транспортом.",
  {1: ("Crawlers Only", "Лише повзаючі"), 2: ("Extremely Rare", "Надзвичайно рідко"), 3: ("Rare", "Рідко"),
   4: ("Sometimes", "Іноді"), 5: ("Often", "Часто"), 6: ("Very Often", "Дуже часто"), 7: ("Always", "Завжди")})
p("ZombieLore.Memory", "Zombie Memory", "Пам'ять зомбі",
  "How long zombies remember a player after seeing or hearing them.",
  "Як довго зомбі пам'ятають гравця після того, як побачили чи почули його.",
  {1: ("Long", "Довга"), 2: ("Normal", "Нормальна"), 3: ("Short", "Коротка"), 4: ("None", "Відсутня"),
   5: ("Random", "Випадково"), 6: ("Random between Normal and None", "Випадково між нормальною та відсутньою")})
p("ZombieLore.Sight", "Zombie Sight", "Зір зомбі",
  "Zombie vision radius.",
  "Радіус зору зомбі.",
  {1: ("Eagle", "Орлиний"), 2: ("Normal", "Нормальний"), 3: ("Poor", "Слабкий"), 4: ("Random", "Випадково"),
   5: ("Random between Normal and Poor", "Випадково між нормальним і слабким")})
p("ZombieLore.Hearing", "Zombie Hearing", "Слух зомбі",
  "Zombie hearing radius.",
  "Радіус слуху зомбі.",
  {1: ("Pinpoint", "Точний"), 2: ("Normal", "Нормальний"), 3: ("Poor", "Слабкий"), 4: ("Random", "Випадково"),
   5: ("Random between Normal and Poor", "Випадково між нормальним і слабким")})
p("ZombieLore.SpottedLogic", "Advanced Stealth (Spotted Logic)", "Розширена скритність (логіка помічання)",
  "Activates the new advanced stealth mechanics, which allows you to hide from zombies behind cars, takes traits and weather into account, and much more.",
  "Активує нову розширену механіку скритності, яка дозволяє ховатися від зомбі за машинами, враховує риси персонажа й погоду та багато іншого.", None)
p("ZombieLore.ThumpNoChasing", "Thump Without Chasing", "Стукіт без переслідування",
  "If zombies that have not seen/heard the player can attack doors and constructions while roaming.",
  "Чи можуть зомбі, які не бачили/не чули гравця, атакувати двері та споруди під час блукання.", None)
p("ZombieLore.ThumpOnConstruction", "Thump On Construction", "Атака на споруди",
  "If zombies can destroy player constructions and defenses.",
  "Чи можуть зомбі руйнувати споруди й захисні конструкції гравця.", None)
p("ZombieLore.ActiveOnly", "Zombies Active During", "Активність зомбі",
  "Whether zombies are more 'active' during the day or night. 'Active' zombies use the speed set in the Speed setting. 'Inactive' zombies are slower, and tend not to give chase.",
  "Чи є зомбі більш «активними» вдень чи вночі. «Активні» зомбі використовують швидкість зі значення параметра «Швидкість». «Неактивні» зомбі повільніші й зазвичай не переслідують.",
  {1: ("Both", "Завжди"), 2: ("Night", "Вночі"), 3: ("Day", "Вдень")})
p("ZombieLore.TriggerHouseAlarm", "Trigger House Alarm", "Активація сигналізації",
  "If zombies trigger house alarms when breaking through windows or doors.",
  "Чи активують зомбі сигналізацію будинку, проламуючись через вікна чи двері.", None)
p("ZombieLore.ZombiesDragDown", "Zombies Drag Down", "Зомбі валять з ніг",
  "If multiple attacking zombies can drag you down and kill you. Dependent on zombie strength.",
  "Чи можуть кілька зомбі, що атакують одночасно, звалити вас з ніг і вбити. Залежить від сили зомбі.", None)
p("ZombieLore.ZombiesCrawlersDragDown", "Crawlers Contribute To Drag Down", "Повзаючі теж валять з ніг",
  "If crawler zombies beside a player contribute to the chance of being dragged down and killed by a group of zombies.",
  "Чи впливають повзаючі зомбі поруч з гравцем на шанс бути звaленим з ніг і вбитим групою зомбі.", None)
p("ZombieLore.ZombiesFenceLunge", "Zombies Fence Lunge", "Випад через паркан",
  "If zombies have a chance to lunge at you after climbing over a fence or through a window if you're too close.",
  "Чи мають зомбі шанс кинутися на вас після перелізання через паркан чи вікно, якщо ви стоїте занадто близько.", None)
p("ZombieLore.ZombiesArmorFactor", "Zombie Armor Factor", "Коефіцієнт броні зомбі",
  "Serves as a multiplier when determining the effectiveness of armor worn by zombies.",
  "Слугує множником при визначенні ефективності броні, одягненої на зомбі.", None)
p("ZombieLore.ZombiesMaxDefense", "Zombie Max Defense", "Макс. захист зомбі",
  "The maximum defense percentage that any worn protective garments can provide to a zombie.",
  "Максимальний відсоток захисту, який одягнений захисний одяг може надати зомбі.", None)
p("ZombieLore.ChanceOfAttachedWeapon", "Chance Of Attached Weapon", "Шанс прикріпленої зброї",
  "Percentage chance of a zombie having a random attached weapon.",
  "Відсотковий шанс, що зомбі матиме випадково прикріплену зброю.", None)
p("ZombieLore.ZombiesFallDamage", "Zombie Fall Damage", "Шкода зомбі від падіння",
  "How much damage zombies take when falling from height.",
  "Скільки шкоди отримують зомбі при падінні з висоти.", None)
p("ZombieLore.DisableFakeDead", "Disable Fake Dead", "Вимкнути «фальшиву смерть»",
  "Whether some dead-looking zombies will reanimate and attack the player.",
  "Чи можуть деякі зомбі, що виглядають мертвими, ожити й атакувати гравця.",
  {1: ("World Zombies", "Зомбі у світі"), 2: ("World and Combat Zombies", "Зомбі у світі та в бою"), 3: ("Never", "Ніколи")})
p("ZombieLore.PlayerSpawnZombieRemoval", "Player Spawn Zombie Removal", "Видалення зомбі біля спавну гравця",
  "Zombies will not spawn where players spawn.",
  "Зомбі не з'являтимуться там, де з'являється гравець.",
  {1: ("Inside the building and around it", "Усередині будівлі та навколо неї"), 2: ("Inside the building", "Усередині будівлі"),
   3: ("Inside the room", "Усередині кімнати"), 4: ("Zombies can spawn anywhere", "Зомбі можуть з'являтися будь-де")})
p("ZombieLore.FenceThumpersRequired", "Fence Thumpers Required", "Потрібно зомбі для паркану",
  "How many zombies it takes to damage a tall fence.",
  "Скільки зомбі потрібно, щоб пошкодити високий паркан.", None)
p("ZombieLore.FenceDamageMultiplier", "Fence Damage Multiplier", "Множник шкоди паркану",
  "How quickly zombies damage tall fences.",
  "Як швидко зомбі пошкоджують високі паркани.", None)

# ---------------- ZombieConfig ----------------
p("ZombieConfig.PopulationMultiplier", "Population Multiplier", "Множник популяції",
  "Set by the Zombie Count population option, or by a custom number here. Insane = 2.5, Very High = 1.6, High = 1.2, Normal = 0.65, Low = 0.15, None = 0.0.",
  "Встановлюється параметром «Кількість зомбі», або власним числом тут. Божевільна = 2.5, Дуже висока = 1.6, Висока = 1.2, Нормальна = 0.65, Низька = 0.15, Відсутня = 0.0.", None)
p("ZombieConfig.PopulationStartMultiplier", "Population Start Multiplier", "Початковий множник популяції",
  "A multiplier for the desired zombie population at the start of the game. Insane = 3.0, Very High = 2.0, High = 1.5, Normal = 1.0, Low = 0.5, None = 0.0.",
  "Множник бажаної популяції зомбі на початку гри. Божевільна = 3.0, Дуже висока = 2.0, Висока = 1.5, Нормальна = 1.0, Низька = 0.5, Відсутня = 0.0.", None)
p("ZombieConfig.PopulationPeakMultiplier", "Population Peak Multiplier", "Піковий множник популяції",
  "A multiplier for the desired zombie population on the peak day. Insane = 3.0, Very High = 2.0, High = 1.5, Normal = 1.0, Low = 0.5, None = 0.0.",
  "Множник бажаної популяції зомбі в піковий день. Божевільна = 3.0, Дуже висока = 2.0, Висока = 1.5, Нормальна = 1.0, Низька = 0.5, Відсутня = 0.0.", None)
p("ZombieConfig.PopulationPeakDay", "Population Peak Day", "День піку популяції",
  "The day when the population reaches its peak.",
  "День, коли популяція досягає піку.", None)
p("ZombieConfig.RespawnHours", "Respawn Hours", "Годин до відродження",
  "The number of hours that must pass before zombies may respawn in a cell. If 0, spawning is disabled.",
  "Кількість годин, яка має минути, перш ніж зомбі можуть відродитися в осередку. Якщо 0, відродження вимкнено.", None)
p("ZombieConfig.RespawnUnseenHours", "Respawn Unseen Hours", "Годин непомітності до відродження",
  "The number of hours that a chunk must be unseen before zombies may respawn in it.",
  "Кількість годин, протягом яких ділянка карти має бути непоміченою, перш ніж у ній можуть відродитися зомбі.", None)
p("ZombieConfig.RespawnMultiplier", "Respawn Multiplier", "Множник відродження",
  "The fraction of a cell's desired population that may respawn every Respawn Hours.",
  "Частка бажаної популяції осередку, яка може відродитися кожні «Години до відродження».", None)
p("ZombieConfig.RedistributeHours", "Redistribute Hours", "Годин до перерозподілу",
  "The number of hours that must pass before zombies migrate to empty parts of the same cell. If 0, migration is disabled.",
  "Кількість годин, яка має минути, перш ніж зомбі мігрують до порожніх частин того самого осередку. Якщо 0, міграцію вимкнено.", None)
p("ZombieConfig.FollowSoundDistance", "Follow Sound Distance", "Відстань переслідування звуку",
  "The distance a zombie will try to walk towards the last sound it heard.",
  "Відстань, на яку зомбі намагатиметься пройти до останнього почутого звуку.", None)
p("ZombieConfig.RallyGroupSize", "Rally Group Size", "Розмір групи зомбі",
  "The size of groups real zombies form when idle. 0 means zombies don't form groups. Groups don't form inside buildings or forest zones.",
  "Розмір груп, які формують справжні зомбі в стані спокою. 0 означає, що зомбі не формують групи. Групи не формуються всередині будівель чи в лісових зонах.", None)
p("ZombieConfig.RallyGroupSizeVariance", "Rally Group Size Variance", "Розкид розміру групи",
  "The amount, as a percentage, that zombie groups can vary in size from the default (both larger and smaller). For example, at 50% variance with a default group size of 20, groups will vary in size from 10-30.",
  "Відсоток, на який розмір груп зомбі може відхилятися від типового (як більше, так і менше). Наприклад, при розкиді 50% і типовому розмірі групи 20, групи будуть від 10 до 30.", None)
p("ZombieConfig.RallyTravelDistance", "Rally Travel Distance", "Дистанція збору групи",
  "The distance real zombies travel to form groups when idle.",
  "Відстань, яку проходять справжні зомбі, щоб сформувати групи в стані спокою.", None)
p("ZombieConfig.RallyGroupSeparation", "Rally Group Separation", "Відстань між групами",
  "The distance between zombie groups.",
  "Відстань між групами зомбі.", None)
p("ZombieConfig.RallyGroupRadius", "Rally Group Radius", "Радіус групи",
  "How close members of a zombie group stay to the group's 'leader'.",
  "Наскільки близько члени групи зомбі тримаються біля «лідера» групи.", None)
p("ZombieConfig.ZombiesCountBeforeDelete", "Zombies Count Before Delete", "Кількість зомбі до видалення",
  "The maximum number of zombie corpses kept in memory before old ones are deleted.",
  "Максимальна кількість трупів зомбі, що зберігаються в пам'яті, перш ніж старі почнуть видалятися.", None)

# ---------------- MultiplierConfig ----------------
p("MultiplierConfig.Global", "Global Multiplier", "Загальний множник",
  "The rate at which all skills level up.",
  "Швидкість, з якою підвищуються всі навички.", None)
p("MultiplierConfig.GlobalToggle", "Use Global Multiplier", "Використовувати загальний множник",
  "When enabled, all skills will use the Global Multiplier.",
  "Якщо увімкнено, всі навички використовуватимуть загальний множник.", None)
p("MultiplierConfig.Fitness", "Fitness Multiplier", "Множник фізпідготовки",
  "Rate at which the Fitness skill levels up.",
  "Швидкість підвищення навички «Фізпідготовка».", None)
p("MultiplierConfig.Strength", "Strength Multiplier", "Множник сили",
  "Rate at which the Strength skill levels up.",
  "Швидкість підвищення навички «Сила».", None)
p("MultiplierConfig.Sprinting", "Sprinting Multiplier", "Множник спринту",
  "Rate at which the Sprinting skill levels up.",
  "Швидкість підвищення навички «Спринт».", None)
p("MultiplierConfig.Lightfoot", "Lightfooted Multiplier", "Множник легкоходу",
  "Rate at which the Lightfooted skill levels up.",
  "Швидкість підвищення навички «Легкохід».", None)
p("MultiplierConfig.Nimble", "Nimble Multiplier", "Множник спритності",
  "Rate at which the Nimble skill levels up.",
  "Швидкість підвищення навички «Спритність».", None)
p("MultiplierConfig.Sneak", "Sneaking Multiplier", "Множник скритності",
  "Rate at which the Sneaking skill levels up.",
  "Швидкість підвищення навички «Скритність».", None)
p("MultiplierConfig.Axe", "Axe Multiplier", "Множник сокир",
  "Rate at which the Axe skill levels up.",
  "Швидкість підвищення навички «Сокира».", None)
p("MultiplierConfig.Blunt", "Long Blunt Multiplier", "Множник довгої тупої зброї",
  "Rate at which the Long Blunt skill levels up.",
  "Швидкість підвищення навички «Довга тупа зброя».", None)
p("MultiplierConfig.SmallBlunt", "Short Blunt Multiplier", "Множник короткої тупої зброї",
  "Rate at which the Short Blunt skill levels up.",
  "Швидкість підвищення навички «Коротка тупа зброя».", None)
p("MultiplierConfig.LongBlade", "Long Blade Multiplier", "Множник довгих клинків",
  "Rate at which the Long Blade skill levels up.",
  "Швидкість підвищення навички «Довгий клинок».", None)
p("MultiplierConfig.SmallBlade", "Short Blade Multiplier", "Множник коротких клинків",
  "Rate at which the Short Blade skill levels up.",
  "Швидкість підвищення навички «Короткий клинок».", None)
p("MultiplierConfig.Spear", "Spear Multiplier", "Множник списів",
  "Rate at which the Spear skill levels up.",
  "Швидкість підвищення навички «Спис».", None)
p("MultiplierConfig.Maintenance", "Maintenance Multiplier", "Множник обслуговування зброї",
  "Rate at which the Maintenance skill levels up.",
  "Швидкість підвищення навички «Обслуговування зброї».", None)
p("MultiplierConfig.Woodwork", "Carpentry Multiplier", "Множник теслярства",
  "Rate at which the Carpentry skill levels up.",
  "Швидкість підвищення навички «Теслярство».", None)
p("MultiplierConfig.Cooking", "Cooking Multiplier", "Множник кулінарії",
  "Rate at which the Cooking skill levels up.",
  "Швидкість підвищення навички «Кулінарія».", None)
p("MultiplierConfig.Farming", "Agriculture Multiplier", "Множник агрономії",
  "Rate at which the Agriculture skill levels up.",
  "Швидкість підвищення навички «Агрономія».", None)
p("MultiplierConfig.Doctor", "First Aid Multiplier", "Множник першої допомоги",
  "Rate at which the First Aid skill levels up.",
  "Швидкість підвищення навички «Перша допомога».", None)
p("MultiplierConfig.Electricity", "Electrical Multiplier", "Множник електрики",
  "Rate at which the Electrical skill levels up.",
  "Швидкість підвищення навички «Електрика».", None)
p("MultiplierConfig.MetalWelding", "Welding Multiplier", "Множник зварювання",
  "Rate at which the Welding skill levels up.",
  "Швидкість підвищення навички «Зварювання».", None)
p("MultiplierConfig.Mechanics", "Mechanics Multiplier", "Множник механіки",
  "Rate at which the Mechanics skill levels up.",
  "Швидкість підвищення навички «Механіка».", None)
p("MultiplierConfig.Tailoring", "Tailoring Multiplier", "Множник кравецтва",
  "Rate at which the Tailoring skill levels up.",
  "Швидкість підвищення навички «Кравецтво».", None)
p("MultiplierConfig.Aiming", "Aiming Multiplier", "Множник прицілювання",
  "Rate at which the Aiming skill levels up.",
  "Швидкість підвищення навички «Прицілювання».", None)
p("MultiplierConfig.Reloading", "Reloading Multiplier", "Множник перезарядки",
  "Rate at which the Reloading skill levels up.",
  "Швидкість підвищення навички «Перезарядка».", None)
p("MultiplierConfig.Fishing", "Fishing Multiplier", "Множник рибальства",
  "Rate at which the Fishing skill levels up.",
  "Швидкість підвищення навички «Рибальство».", None)
p("MultiplierConfig.Trapping", "Trapping Multiplier", "Множник встановлення пасток",
  "Rate at which the Trapping skill levels up.",
  "Швидкість підвищення навички «Встановлення пасток».", None)
p("MultiplierConfig.PlantScavenging", "Foraging Multiplier", "Множник збиральництва",
  "Rate at which the Foraging skill levels up.",
  "Швидкість підвищення навички «Збиральництво».", None)
p("MultiplierConfig.FlintKnapping", "Knapping Multiplier", "Множник оброблення каменю",
  "Rate at which the Knapping skill levels up.",
  "Швидкість підвищення навички «Оброблення каменю».", None)
p("MultiplierConfig.Masonry", "Masonry Multiplier", "Множник муляра",
  "Rate at which the Masonry skill levels up.",
  "Швидкість підвищення навички «Муляр».", None)
p("MultiplierConfig.Pottery", "Pottery Multiplier", "Множник гончарства",
  "Rate at which the Pottery skill levels up.",
  "Швидкість підвищення навички «Гончарство».", None)
p("MultiplierConfig.Carving", "Carving Multiplier", "Множник різьблення",
  "Rate at which the Carving skill levels up.",
  "Швидкість підвищення навички «Різьблення».", None)
p("MultiplierConfig.Husbandry", "Animal Care Multiplier", "Множник догляду за тваринами",
  "Rate at which the Animal Care skill levels up.",
  "Швидкість підвищення навички «Догляд за тваринами».", None)
p("MultiplierConfig.Tracking", "Tracking Multiplier", "Множник вистежування",
  "Rate at which the Tracking skill levels up.",
  "Швидкість підвищення навички «Вистежування».", None)
p("MultiplierConfig.Blacksmith", "Blacksmithing Multiplier", "Множник ковальства",
  "Rate at which the Blacksmithing skill levels up.",
  "Швидкість підвищення навички «Ковальство».", None)
p("MultiplierConfig.Butchering", "Butchering Multiplier", "Множник обробки туш",
  "Rate at which the Butchering skill levels up.",
  "Швидкість підвищення навички «Обробка туш».", None)
p("MultiplierConfig.Glassmaking", "Glassmaking Multiplier", "Множник склодувства",
  "Rate at which the Glassmaking skill levels up.",
  "Швидкість підвищення навички «Склодувство».", None)

output = {
    "ui": UI,
    "sections": SECTIONS,
    "params": P,
}

with open("translations.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(P)} parameter translations to translations.json")
