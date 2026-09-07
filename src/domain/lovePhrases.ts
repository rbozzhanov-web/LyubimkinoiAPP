/**
 * Curated, deterministic phrase pools for Special Mode's personal note on Home — short
 * messages written in Ramil's voice for Khava. Not an LLM-backed generator: every phrase
 * is hand-written ahead of time and picked from a shuffled per-context "bag" that empties
 * before any repeat -- every line in a pool is shown once before that pool reshuffles for a
 * new cycle. Selection is randomized within a pool, not "creative generation" — the pools
 * are the actual content.
 *
 * `intimate` is a deliberately separate, rarer pool for the small handful of phrases that
 * lean adult. detectLoveContext() never returns it -- same treatment already given to
 * good_sleep/poor_sleep/high_readiness/low_readiness/away/reunion/day_off/jealous_pride,
 * which have no honest automatic signal either. It only exists for a future opt-in surface
 * to call pickLovePhrase('intimate') directly; nothing today wires it into the automatic
 * picker.
 */

export type LoveContext =
  | 'morning'
  | 'good_sleep'
  | 'poor_sleep'
  | 'high_readiness'
  | 'low_readiness'
  | 'before_duty'
  | 'during_duty'
  | 'after_duty'
  | 'day_off'
  | 'away'
  | 'reunion'
  | 'night'
  | 'weather_cold'
  | 'weather_hot'
  | 'weather_rain'
  | 'random'
  | 'jealous_pride'
  | 'intimate';

type Phrase = { id: string; text: string };

function pool(context: LoveContext, lines: string[]): Phrase[] {
  return lines.map((text, index) => ({ id: `${context}-${index}`, text }));
}

const PHRASES: Record<LoveContext, Phrase[]> = {
  morning: pool('morning', [
    'Доброе утро, любимка.',
    'Проснулась? Уже скучаю.',
    'Утро твоё — моё любимое время дня.',
    'Вставай, любовь моя. Мир подождёт.',
    'Доброе утро, любимая.',
    'Хава моя, доброе утро.',
    'Открыла глаза — уже красавица.',
    'Утро без тебя рядом — так себе утро.',
    'Ну что, соня, вернулась к нам?',
    'Проснулась моя Хава — день сразу лучше.',
    'Открываешь глаза — а я уже скучаю по тебе спящей.',
    'Доброе утро, родная моя.',
    'Я бы сейчас лучше будил тебя сам.',
    'Первая мысль с утра — ты. Как обычно.',
    'Утро. Ты. Больше ничего не нужно.',
    'Доброе утро, сладкая.',
    'Проснулась — уже моя маленькая победа дня.',
    'Хочу быть тем будильником, который тебя целует.',
    'Доброе утро, любимочка. Как спалось?',
    'Встала? Горжусь. Дальше сама справишься.',
  ]),
  good_sleep: pool('good_sleep', [
    'Выспалась — уже победа.',
    'Красавица. Выспавшаяся ещё опаснее.',
    'Спала хорошо — горжусь тобой.',
    'Моя любимка отдохнула. Отлично.',
    'Выспалась, значит опять всех очаруешь.',
    'Хорошо поспала — уже соскучился сильнее.',
    'Отдохнувшая Хава — моя любимая Хава. 💤',
    'Мой великий воин сна снова победил.',
    'Выспавшаяся Хава — страшная сила.',
    'Хорошо поспала? Вот это моя девочка.',
    'Сон хороший — значит, и день будет твой.',
    'Люблю видеть, что ты отдохнула.',
    'Отличный сон — отличная ты. Как всегда.',
    'Выспалась — можно снова свернуть горы.',
    'Спала как надо. Уважаю дисциплину.',
    'Хорошо поспала, любимочка? Тогда мир не готов.',
    'Отдохнувшая — значит, снова опасно обаятельная.',
  ]),
  poor_sleep: pool('poor_sleep', [
    'Мало поспала. Пожалей себя сегодня.',
    'Знаю, что не выспалась. Держись, любимка.',
    'Сегодня можно быть чуть слабее. Я рядом.',
    'Не выспалась — тем более, я горжусь тобой.',
    'Плохо спала? Обниму, когда вернёшься.',
    'Тяжёлая ночь. Ты всё равно моя любимая.',
    'Береги себя сегодня, соня моя недоспавшая.',
    'Мало сна — больше кофе. Я рядом.',
    'Не выспалась — сегодня можно медленнее жить.',
    'Знаю, что тяжело. Потерпи, любимочка, я жду.',
    'Плохая ночь — не повод быть строже к себе.',
    'Недоспала? Ничего. Долюблю за двоих.',
    'Тяжело сегодня — но ты справишься, как всегда.',
    'Мало сна — я бы тебя сейчас просто обнял и уложил.',
  ]),
  high_readiness: pool('high_readiness', [
    'Готова к бою — моя любимка.',
    'Сегодня ты особенно опасна. В хорошем смысле.',
    'Полна сил — люблю тебя такую.',
    'Заряжена и готова — узнаю свою любимку.',
    'Сегодня всё получится. Ты в форме.',
    'Такая собранная — обожаю.',
    'Сильная моя. Действуй.',
    'Заряженная Хава — это серьёзная сила.',
    'Сегодня явно твой день. Я в курсе первым.',
    'Готова горы сворачивать — и своротишь.',
  ]),
  low_readiness: pool('low_readiness', [
    'Сегодня можно медленнее. Я не тороплю.',
    'Побереги себя, любовь моя.',
    'Не геройствуй сегодня, любимка.',
    'Отдохни, где получится. Я подожду.',
    'Слушай своё тело сегодня, не меня.',
    'Полегче сегодня, любимая моя.',
    'Дай себе передышку. Заслужила.',
    'Организм просит отдыха — я на его стороне.',
    'Сегодня можно ничего не доказывать.',
    'Побереги силы. Я никуда не тороплюсь.',
  ]),
  before_duty: pool('before_duty', [
    'Береги сегодня мою Хаву.',
    'Удачной смены, любимка.',
    'Иди работай, любимая. Дома жду.',
    'Хорошего полёта. Возвращайся ко мне.',
    'Мягкой турбулентности и быстрого возвращения.',
    'Работай спокойно, я никуда не денусь.',
    'Взлетай, любимая. Я на связи мысленно.',
    'Лёгкого полёта тебе, моя Хава.',
    'Без приключений сегодня, договорились?',
    'Красиво слетай и возвращайся ко мне.',
    'Любимочка, пусть смена пройдёт спокойно.',
    'Хорошей смены. Жду дома, как обычно.',
    'Взлетай спокойно — я держу оборону тут.',
    'Пусть сегодня всё будет просто и без сюрпризов.',
    'Иди работай. Вечером — снова моя.',
    'Удачи там наверху, любимая.',
    'Спокойной смены. Возвращайся такой же красивой.',
  ]),
  during_duty: pool('during_duty', [
    'Где бы ты ни летала — ты всё равно моя любимка.',
    'Думаю о тебе где-то там, наверху. ✈️',
    'Ты сейчас работаешь, а я просто скучаю.',
    'Пока ты в небе, я тут держу оборону.',
    'Смена идёт — ты справляешься, как всегда.',
    'Лети спокойно. Я никуда не тороплюсь ждать.',
    'Ты там работаешь, а я просто горжусь.',
    'Дыши между делом, любимая. Я подожду.',
    'Ты в небе, я на земле — оба заняты, оба скучаем.',
    'Где-то там моя Хава сейчас работает. Горжусь.',
    'Пара часов — и снова будешь просто моей.',
    'Работай. Дома ждёт человек, который скучает.',
    'Ты там в форме — а я тут думаю только о тебе.',
    'Лети аккуратно. Мне ты нужна целой.',
  ]),
  after_duty: pool('after_duty', [
    'Смена закончилась — снова моя Хава.',
    'Люблю момент, когда твой день заканчивается и ты снова становишься просто моей Хавой.',
    'Ну вот и всё. Иди отдыхай, любимка.',
    'Молодец, что долетела. Как всегда.',
    'Смена позади. Теперь можно расслабиться.',
    'Закончила? Значит можно снова быть просто моей.',
    'Горжусь тобой, любимая моя.',
    'Долетела, отработала — снимай форму и выдыхай.',
    'Ну всё. Теперь снова просто моя Хава.',
    'Смена закрыта — включай режим "просто Хава".',
    'Отработала — молодец. Теперь можно и полениться.',
    'Форму долой, ноги на диван. Заслужила.',
    'Закончила смену — я как будто выдохнул тоже.',
    'Долетела — значит, всё как надо. Как обычно.',
    'Всё, отработали. Дальше только отдых и я.',
    'Снимай форму, надевай меня. В смысле — обнимашки.',
    'Освободилась — самое время написать мне.',
    'Долетела, справилась — горжусь молча и громко.',
  ]),
  day_off: pool('day_off', [
    'Выходной. Можно ничего не решать.',
    'Сегодня можно просто быть, а не выживать.',
    'День без формы — мой любимый день.',
    'Отдыхай по полной, любимка.',
    'Свободный день — используй во благо себе.',
    'Сегодня разрешается лениться. Я одобряю.',
    'День без графика — почти свидание с собой.',
    'Выходной — идеальный повод ничего не планировать.',
    'Сегодня можно валяться до обеда. Я не против.',
    'День без будильника — моё любимое расписание.',
    'Свободный день, любимочка. Наслаждайся.',
    'Выходной — значит, время только твоё.',
    'Ленивый день — лучший день. Проверено.',
    'Сегодня без графика, без формы, без спешки.',
    'День для себя. Хотя я бы тоже пригодился.',
    'Выходной — хороший повод ничего не делать вдвоём.',
  ]),
  away: pool('away', [
    'Слишком долго ты находишься вне зоны моих объятий.',
    'Расстояние временное, скучаю — постоянно.',
    'Не рядом, но всё равно моя.',
    'Города разные, любимка одна.',
    'Считаю дни, не признаваясь тебе в этом обычно.',
    'Далеко — не значит меньше.',
    'Разные города, одна команда.',
    'Поскорее бы уже закончилась наша разлука.',
    'Слишком далеко находится моя любимочка.',
    'Мне тебя рядом не хватает. Очень.',
    'Расстояние — единственное, что мне в нас не нравится.',
    'Далеко, но каждый день на связи мысленно.',
    'Скучаю по тебе так, будто не виделись месяц.',
    'Даже не рядом ты умудряешься быть рядом.',
    'Разлука временная. Скучаю — по-настоящему.',
    'Хочу, чтобы это расстояние уже закончилось.',
    'Города между нами — досадная формальность.',
    'Не хватает тебя рядом. Именно тебя, не абстрактно.',
    'Скучаю по голосу, по запаху, по тебе целиком.',
    'Далеко — это временно. Люблю — это навсегда.',
    'Считаю не дни, а часы уже, если честно.',
    'Разлука есть. Любовь больше разлуки.',
  ]),
  reunion: pool('reunion', [
    'Возвращайся. У меня на тебя очень личные планы.',
    'Скоро увидимся — веди себя хорошо. Или нет.',
    'Считаю часы, не минуты уже.',
    'Домой давай. Я скучаю.',
    'Уже готовлюсь тебя обнимать дольше обычного.',
    'Скоро моя любимка снова будет рядом.',
    'Возвращайся быстрее — соскучился конкретно.',
    'Иди сюда. Я тебя больше никуда не отпускаю.',
    'Ещё немного — и моя Хава будет рядом.',
    'Домой давай. Я очень по тебе соскучился.',
    'Жду тебя у двери мысленно уже сейчас.',
    'Возвращайся — обниму так, что не сразу отпущу.',
    'Скоро увижу твоё лицо. Наконец-то.',
    'Считаю часы до момента, когда ты снова рядом.',
    'Прилетай уже. У меня по тебе дефицит.',
    'Ты возвращаешься — и всё сразу становится на места.',
    'Жду не встречи вообще, а именно тебя.',
    'Возвращайся домой. Соскучившийся человек ждёт.',
    'Ещё чуть-чуть — и снова моя, целиком.',
  ]),
  night: pool('night', [
    'Спокойной ночи, любимка.',
    'Спи, любовь моя. Я тут, даже если не рядом.',
    'Закрывай глаза. Завтра снова будешь опасно хороша.',
    'Спокойной ночи, мой великий воин сна.',
    'Спи крепко. Я подежурю мысленно.',
    'Спокойной ночи, Хава моя.',
    'Закрывай день. Открывай сон.',
    'Слаадкая, прекрасных тебе снов.',
    'Отдыхай, любовь моя.',
    'Я тебя люблю люблю люблю до бесконечности.',
    'Спокойного сна, моя Хава.',
    'Любимка моя сладенькая, надеюсь, ты сегодня хорошо отдохнёшь.',
    'Спи, родная. Завтра будет ещё один твой день.',
    'Ложись, любимочка. Я мысленно рядом.',
    'Спокойной ночи. Скучаю уже сейчас.',
    'Спи сладко. Снись мне тоже, кстати.',
    'Закрывай глаза, сладенькая. Всё остальное подождёт.',
    'Ночь твоя — отдыхай честно, без чувства вины.',
    'Спокойной ночи, любимая. До завтра.',
    'Спи. Я подумаю о тебе за нас двоих.',
    'Хорошего сна. И пусть я там тоже буду.',
    'Ложись, моя девочка. День закончен.',
    'Спокойной ночи. Обнял бы, если б мог.',
    'Спи крепко — завтра снова быть красивой и опасной.',
    'Ночь наступила — значит, пора отпускать день.',
    'Спокойной ночи, сладкая. Люблю тебя даже во сне.',
    'Закрывай глаза. Я никуда не денусь до утра.',
    'Спи. Мысли обо мне не обязательны, но приветствуются.',
    'Доброй ночи, моя Хава. До скорого утра.',
  ]),
  weather_cold: pool('weather_cold', [
    'Холодно там у тебя — одевайся теплее, любимка.',
    'Мёрзнешь? Хотел бы согреть лично.',
    'На улице холодно — заходи ко мне мысленно погреться.',
    'Тепло одевайся. Я слежу издалека.',
    'Кутайся получше, любимая.',
    'Оденься тепло. Мне моя Хава нужна согретой.',
    'Холодно там — но у меня для тебя есть тёплые объятия в запасе.',
    'Не мёрзни. Шарф, шапка, и я мысленно рядом.',
  ]),
  weather_hot: pool('weather_hot', [
    'Жара там у тебя. Береги себя.',
    'Пей воду, а не только кофе.',
    'Жарко? А ты всё равно цветёшь.',
    'Ты цветешь и замечательно пахнешь — даже в такую жару.',
    'Солнце там сильное — прячься в тени иногда.',
    'Не перегрейся там, любимочка.',
    'Жара временная. Моя любовь — нет.',
    'Пей воду, любимая. И не забывай про тень.',
  ]),
  weather_rain: pool('weather_rain', [
    'Не промокни, любовь моя.',
    'Дождь там у тебя — возьми зонт, я переживаю.',
    'Дождливо? Идеальный повод скорее оказаться в тепле.',
    'Не забудь зонт, любимочка.',
    'Дождь — хороший повод скучать по тебе чуть сильнее.',
    'Там дождь, здесь скучаю. Взаимосвязь очевидна.',
    'Осторожно на мокром — и возвращайся сухой и целой.',
  ]),
  random: pool('random', [
    // everyday tenderness / simple declarations, including a dedicated ultra-short set
    'Моя любимочка.',
    'Мне только тебя и надо.',
    'Просто подумал о тебе.',
    'Счастье любить тебя. Каждый день.',
    'У меня сегодня снова одна любимая женщина. Ты.',
    'Мне только тебя и надо. Всё ещё. Всё сильнее.',
    'Хава моя. Просто напоминаю.',
    'Счастье любить тебя и быть любимым тобой.',
    'Мой великий воин сна.',
    'Люблю тебя без повода. Как обычно.',
    'Просто соскучился. Без причины.',
    'Моя любимая, даже без повода.',
    'Хава моя.',
    'Люблю тебя.',
    'Иди сюда.',
    'Скучаю.',
    'Домой давай.',
    'Ты мне нужна.',
    'Хочу рядом.',
    'Моя любовь.',
    'Обожаю тебя.',
    'Люблю тебя. Вот и весь мой план.',
    'Мне повезло, что ты у меня есть.',
    'Мне невероятно повезло любить тебя.',
    'Счастье — это быть любимым тобой.',
    'Ты моя любимая женщина.',
    'Люблю тебя безумно.',
    'Я тебя люблю, Хава моя.',
    'Как я соскучился.',
    'Вот чего я хочу всегда.',
    'Всё хочу с тобой делать.',
    'Все время с тобой прекрасно.',
    // admiration — personality, voice, the way she loves, not only looks
    'Люблю, как ты смеёшься, когда не ожидаешь.',
    'У тебя голос, который я узнаю из тысячи.',
    'Мне нравится, как ты умеешь любить — сильно и без полумер.',
    'Твоя нежность меня каждый раз обезоруживает.',
    'Люблю, как ты злишься понарошку.',
    'Ты умеешь быть сильной и мягкой одновременно. Это редкость.',
    'Мне нравится, какая ты настоящая. Без масок.',
    'Люблю твоё сонное лицо больше, чем любое красивое фото.',
    'Ты умеешь любить так, что это чувствуется физически.',
    'Мне нравится, как ты реагируешь на мои прикосновения.',
    'Люблю, что ты моя. Просто факт, а не заслуга.',
    'Ты сильная. Я это вижу каждый день.',
    'Мне нравится твой характер. Даже упрямый.',
    'Люблю, как загораются твои глаза, когда тебе весело.',
    // playful possessiveness — consensual, funny, never controlling
    'Моя. Всё правильно.',
    'Хава принадлежит Хаве. Но целовать буду я.',
    'Эксклюзивный доступ у меня, любимочка.',
    'Ты моя, и это не обсуждается.',
    'Только моя. Остальное — детали.',
    'Официально: моя. Неофициально: тоже моя.',
    'Мои эксклюзивные права на тебя пока никто не оспорил.',
    'Ты числишься за мной. Пожизненно.',
    'Моё — значит моё. В хорошем смысле.',
    // mutual desire
    'Как хорошо, что наши желания взаимны и совпадают.',
    'Самое красивое — что мы оба хотим одного.',
    'Люблю, как сильно мы хотим друг друга.',
    'Удивительно удобно: мне нужна ты, а тебе — я.',
    'Хорошо, когда оба хотят одного и того же. Редкость вообще-то.',
    'Мы оба одинаково скучаем. Это справедливо хотя бы.',
    // humor / teasing — light, no insults
    'Выспалась? Наконец-то организм договорился с хозяйкой.',
    'Опять красивая. Ну сколько можно.',
    'План на день: не уставать. Очень научный подход.',
    'Моя любимочка опять где-то летает вместо того, чтобы лежать рядом.',
    'Ты пропала. Официально объявляю розыск.',
    'Опять не пишешь — видимо, слишком занята быть потрясающей.',
    'Веди себя хорошо. Или как обычно, мне нравится и так.',
    'Ты как всегда права. Записал.',
    'Соскучился настолько, что это уже не смешно.',
    'Официальное уведомление: ты нужна дома.',
    // the peach motif — rare, private-joke energy
    'Любимочка, твой 🍑 сегодня снова в моих мыслях.',
    'Наш персик — только наш. Остальным не положено.',
    'Иконка приложения не просто так такая, ты в курсе.',
    // touch / hands — soft, affectionate, not explicit
    'Так хочу тобой дышать.',
    'Мне очень не хватает твоего тела рядом.',
    'Хочу положить руки на мою любимочку.',
    'Я бы сейчас просто зарылся в тебя.',
    'Скучаю по твоим рукам на мне так же, как по своим на тебе.',
    'Твои руки — моё любимое место на земле.',
    'Хочу обнять так, чтобы ты забыла, где мы.',
    // shared memories — used sparingly, only the one memory actually supplied
    'Сентябрь почему-то всегда напоминает мне ту Астану.',
    'Holiday Inn. Ты. Я. Хорошее было решение.',
    'До сих пор улыбаюсь, вспоминая, как ты прилетела ко мне.',
    // occasional longer phrases
    'Иногда мне просто хочется напомнить тебе, какое это счастье — любить тебя.',
    'Любимка моя сладенькая, надеюсь, ты сегодня смогла нормально отдохнуть.',
    'Красиво слетай, без приключений, а потом возвращайся ко мне.',
    'Каждый раз удивляюсь, как тебя можно любить ещё сильнее, чем вчера.',
    'Знаешь, что самое приятное? Что ты вообще есть в моей жизни.',
    'Хочется просто сказать: я по тебе скучаю сильнее, чем показываю.',
    // pride in her work / missing sharing a crew — soft enough for the general rotation;
    // the sharper jealousy lines live in the dedicated jealous_pride pool below
    'Бизнес-класс сегодня не знает, как ему повезло.',
    'Горжусь тобой каждый раз, когда думаю, где ты сейчас работаешь.',
    'Жаль, что нас почти никогда не ставят в один экипаж.',
    'Летаем в одном небе, а не вместе. Обидно, если честно.',
    'Может, однажды нас всё-таки поставят в одну смену.',
    'Ты в своём самолёте, я в своём — но мыслями я в твоём.',
  ]),
  // Dormant pool: pride in her looks and work, mixed with a light, self-aware jealousy that
  // is entirely his own feeling, never a note about her behavior. Written for a captain who
  // rarely shares a crew with her and knows exactly why business class stays fully booked.
  // No honest automatic signal for "flying together today" exists anywhere in KhaVair's
  // domain model (a duty's crew list has no notion of who "Khava" is), so this stays
  // reachable only via a direct pickLovePhrase('jealous_pride') call, same as the other
  // dormant pools above.
  jealous_pride: pool('jealous_pride', [
    'Знаю, что ты просто делаешь свою работу. Всё равно немного ревную.',
    'Ревную тебя к целому бизнес-классу. Мелочь, но неприятно.',
    'Моя любимка — лучшее, что случается с пассажирами сегодня. Ревную ко всем сразу.',
    'Ревность моя — это просто любовь, которая плохо считает.',
    'Как капитан — официально скучаю. Как Рамиль — ещё сильнее.',
    'Обидно, что мы почти никогда не летаем одним экипажем.',
    'Хочу хоть раз услышать твой голос по громкой связи не по громкой связи, а рядом.',
    'Знаю, что ты им просто улыбаешься по работе. Знаю. Всё равно немного бесит.',
    'Ты не виновата, что такая красивая в форме. Но мне от этого не легче.',
    'Если бы расписание спрашивало меня — мы бы летали вместе каждую неделю.',
    'Немного жаль весь бизнес-класс, который видит тебя чаще меня.',
    'Ревновать к работе, которую сам же уважаю, — моя личная нелепость.',
  ]),
  // Rare, opt-in-only pool. Never returned by detectLoveContext(); reachable only via a
  // direct pickLovePhrase('intimate') call from some future opt-in surface. Sensual, not
  // graphic -- desire framed as part of loving her, not detached one-liners.
  intimate: pool('intimate', [
    'У меня на тебя очень личные планы.',
    'Так скучаю по твоему телу, любимочка.',
    'Мои руки очень соскучились по тебе.',
    'Хочу тебя рядом. Всю.',
    'У меня к тебе сегодня исключительно личный интерес.',
    'Ты же понимаешь, что после такой разлуки я тебя просто так не отпущу?)',
    'Мои эксклюзивные возможности в твоём направлении.',
    'Мои руки соскучились по своему персику.',
    'Слишком долго мои руки живут без тебя.',
    'Обожаю тебя, Хава, люблю твоё тело и твою реакцию на мои прикосновения.',
    'Всё, что связано с тобой, — хочу.',
    'Любить тебя — моё наслаждение и моё желание, Хава.',
    'Хорошо, что нам обоим одного и того же хочется.',
    'Возвращайся. Дальше — не для переписки.',
  ]),
};

// Per-context "bag" of ids not yet shown in the current cycle, plus the last id shown per
// context (so a fresh cycle's first draw never repeats the previous cycle's last line).
const BAG_KEY = 'khavair.lovePhrase.bag.v1';
const LAST_SHOWN_KEY = 'khavair.lovePhrase.lastShown.v1';

type IdMap = Partial<Record<LoveContext, string[]>>;
type LastShownMap = Partial<Record<LoveContext, string>>;

function loadJsonObject<T extends object>(key: string): T {
  if (typeof localStorage === 'undefined') return {} as T;
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : ({} as T);
  } catch {
    return {} as T;
  }
}

function saveJsonObject(key: string, value: object) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or unavailable — this session just won't remember */ }
}

function shuffled(ids: string[]): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Returns one phrase for the given context, drawn from a shuffled bag that empties before
 * any repeat: every line in the pool is shown exactly once per cycle, in a random order,
 * before the bag reshuffles for the next cycle. This holds per context regardless of how
 * many other contexts get picked in between -- a small pool like weather_rain still gets a
 * full, non-repeating tour of itself instead of racing a shared global buffer. The one seam
 * that needs an explicit guard is the boundary between cycles, since a fresh shuffle could
 * otherwise land the same line that just closed out the previous cycle right back at the
 * front; that's the only case handled beyond a plain shuffle-and-draw.
 */
export function pickLovePhrase(context: LoveContext): string {
  const poolContext: LoveContext = PHRASES[context]?.length ? context : 'random';
  const candidates = PHRASES[poolContext];
  const validIds = new Set(candidates.map((phrase) => phrase.id));

  const bags = loadJsonObject<IdMap>(BAG_KEY);
  const lastShown = loadJsonObject<LastShownMap>(LAST_SHOWN_KEY);
  const previousId = lastShown[poolContext];

  // Ids from a stale bag (e.g. a phrase that got removed in an app update) are dropped
  // rather than drawn; an empty result here also covers "no bag yet" and "cycle just ended".
  let bag = (bags[poolContext] ?? []).filter((id) => validIds.has(id));
  if (bag.length === 0) {
    bag = shuffled(candidates.map((phrase) => phrase.id));
    if (bag.length > 1 && bag[0] === previousId) {
      const swapWith = 1 + Math.floor(Math.random() * (bag.length - 1));
      [bag[0], bag[swapWith]] = [bag[swapWith], bag[0]];
    }
  }

  const [chosenId, ...rest] = bag;
  bags[poolContext] = rest;
  saveJsonObject(BAG_KEY, bags);
  lastShown[poolContext] = chosenId;
  saveJsonObject(LAST_SHOWN_KEY, lastShown);

  return candidates.find((phrase) => phrase.id === chosenId)!.text;
}

export type LoveContextInput = {
  now: number;
  isActive: boolean;
  isUpcoming: boolean;
  reportMs?: number;
  releaseMs?: number;
  /** Current temperature (°C) at the relevant station, if already known. */
  arrivalTemp?: number;
  /** Open-Meteo WMO current weather code at the relevant station, if already known. */
  arrivalWeatherCode?: number;
};

const HOUR_MS = 60 * 60 * 1000;

function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
}

/**
 * Picks a context from real, currently-available app state only. Contexts like
 * good_sleep/poor_sleep/high_readiness/low_readiness/away/reunion/day_off have no honest
 * signal anywhere in KhaVair today (no sleep tracking, no concept of Ramil's location) --
 * their phrase pools exist and are reachable via pickLovePhrase() directly, but this
 * detector deliberately never selects them rather than guessing. `jealous_pride` is the
 * same story: a duty's crew list has no notion of who "Khava" is, so there's no honest way
 * to detect "flying together today" vs. not. `intimate` is excluded for a different reason:
 * it's meant to stay rare and opt-in, not part of the automatic rotation at all.
 */
export function detectLoveContext(input: LoveContextInput): LoveContext {
  if (input.isActive) return 'during_duty';
  if (input.isUpcoming && input.reportMs !== undefined && input.reportMs - input.now <= 6 * HOUR_MS) return 'before_duty';
  if (!input.isActive && !input.isUpcoming && input.releaseMs !== undefined && input.now - input.releaseMs <= 3 * HOUR_MS) return 'after_duty';
  if (input.arrivalTemp !== undefined) {
    if (input.arrivalTemp <= 0) return 'weather_cold';
    if (input.arrivalTemp >= 32) return 'weather_hot';
  }
  if (input.arrivalWeatherCode !== undefined && isRainCode(input.arrivalWeatherCode)) return 'weather_rain';
  const hour = new Date(input.now).getHours();
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 22 || hour < 5) return 'night';
  return 'random';
}
