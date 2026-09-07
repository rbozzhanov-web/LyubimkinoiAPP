/**
 * Curated, deterministic phrase pools for Special Mode's personal note on Home — short
 * messages written in Ramil's voice for Khava. Not an LLM-backed generator: every phrase
 * is hand-written ahead of time and picked from a pool, with a small recent-history buffer
 * so the same line doesn't repeat back-to-back. Selection is randomized within a pool, not
 * "creative generation" — the pools are the actual content.
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
  | 'random';

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
    'Доброе утро, королева моя.',
    'Хава моя, доброе утро.',
    'Открыла глаза — уже красавица.',
    'Утро без тебя рядом — так себе утро.',
  ]),
  good_sleep: pool('good_sleep', [
    'Выспалась — уже победа.',
    'Красавица. Выспавшаяся ещё опаснее.',
    'Спала хорошо — горжусь тобой.',
    'Моя любимка отдохнула. Отлично.',
    'Выспалась, значит опять всех очаруешь.',
    'Хорошо поспала — уже соскучился сильнее.',
    'Отдохнувшая Хава — моя любимая Хава. 💤',
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
  ]),
  high_readiness: pool('high_readiness', [
    'Готова к бою — моя любимка.',
    'Сегодня ты особенно опасна. В хорошем смысле.',
    'Полна сил — люблю тебя такую.',
    'Заряжена и готова — узнаю свою королеву.',
    'Сегодня всё получится. Ты в форме.',
    'Такая собранная — обожаю.',
    'Сильная моя. Действуй.',
  ]),
  low_readiness: pool('low_readiness', [
    'Сегодня можно медленнее. Я не тороплю.',
    'Побереги себя, любовь моя.',
    'Не геройствуй сегодня, любимка.',
    'Отдохни, где получится. Я подожду.',
    'Слушай своё тело сегодня, не меня.',
    'Полегче сегодня, королева моя.',
    'Дай себе передышку. Заслужила.',
  ]),
  before_duty: pool('before_duty', [
    'Береги сегодня мою Хаву.',
    'Удачной смены, любимка.',
    'Иди работай, королева. Дома жду.',
    'Хорошего полёта. Возвращайся ко мне.',
    'Мягкой турбулентности и быстрого возвращения.',
    'Работай спокойно, я никуда не денусь.',
    'Взлетай, любимая. Я на связи мысленно.',
  ]),
  during_duty: pool('during_duty', [
    'Где бы ты ни летала — ты всё равно моя любимка.',
    'Думаю о тебе где-то там, наверху. ✈️',
    'Ты сейчас работаешь, а я просто скучаю.',
    'Пока ты в небе, я тут держу оборону.',
    'Улыбнись кому-нибудь на борту. Знаю, что умеешь.',
    'Смена идёт — ты справляешься, как всегда.',
    'Лети спокойно. Я никуда не тороплюсь ждать.',
    'Ты там работаешь, а я просто горжусь.',
  ]),
  after_duty: pool('after_duty', [
    'Смена закончилась — снова моя Хава.',
    'Люблю момент, когда твой день заканчивается и ты снова становишься просто моей Хавой.',
    'Ну вот и всё. Иди отдыхай, любимка.',
    'Молодец, что долетела. Как всегда.',
    'Смена позади. Теперь можно расслабиться.',
    'Закончила? Значит можно снова быть просто моей.',
    'Горжусь тобой, королева моя.',
    'Долетела, отработала — снимай форму и выдыхай.',
  ]),
  day_off: pool('day_off', [
    'Выходной. Можно ничего не решать.',
    'Сегодня можно просто быть, а не выживать.',
    'День без формы — мой любимый день.',
    'Отдыхай по полной, любимка.',
    'Свободный день — используй во благо себе.',
    'Сегодня разрешается лениться. Я одобряю.',
    'День без графика — почти свидание с собой.',
  ]),
  away: pool('away', [
    'Слишком долго ты находишься вне зоны моих объятий.',
    'Расстояние временное, скучаю — постоянно.',
    'Не рядом, но всё равно моя.',
    'Города разные, любимка одна.',
    'Считаю дни, не признаваясь тебе в этом обычно.',
    'Далеко — не значит меньше.',
    'Разные города, одна команда.',
  ]),
  reunion: pool('reunion', [
    'Возвращайся. У меня на тебя очень личные планы.',
    'Скоро увидимся — веди себя хорошо. Или нет.',
    'Считаю часы, не минуты уже.',
    'Домой давай. Я скучаю.',
    'Уже готовлюсь тебя обнимать дольше обычного.',
    'Скоро моя любимка снова будет рядом.',
    'Возвращайся быстрее — соскучился конкретно.',
  ]),
  night: pool('night', [
    'Спокойной ночи, любимка.',
    'Спи, королева моя. Я тут, даже если не рядом.',
    'Закрывай глаза. Завтра снова будешь опасно хороша.',
    'Спокойной ночи, мой великий воин сна.',
    'Спи крепко. Я подежурю мысленно.',
    'Спокойной ночи, Хава моя.',
    'Закрывай день. Открывай сон.',
  ]),
  weather_cold: pool('weather_cold', [
    'Холодно там у тебя — одевайся теплее, любимка.',
    'Мёрзнешь? Хотел бы согреть лично.',
    'На улице холодно — заходи ко мне мысленно погреться.',
    'Тепло одевайся. Я слежу издалека.',
    'Кутайся получше, королева моя.',
  ]),
  weather_hot: pool('weather_hot', [
    'Жара там у тебя. Береги себя.',
    'Пей воду, а не только кофе.',
    'Жарко? А ты всё равно цветёшь.',
    'Ты цветешь и замечательно пахнешь — даже в такую жару.',
    'Солнце там сильное — прячься в тени иногда.',
  ]),
  random: pool('random', [
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
    'Моя королева, даже если ты не в короне.',
  ]),
};

const HISTORY_KEY = 'khavair.lovePhrase.history.v1';
// Big enough to cover a full pass through the smallest pools (weather_*, ~5 lines) plus
// some slack, so a phrase reliably cycles out of recent memory before it can repeat.
const HISTORY_LIMIT = 24;

function loadHistory(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveHistory(ids: string[]) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(ids)); } catch { /* storage full or unavailable — this session just won't remember */ }
}

/** Returns one phrase for the given context, avoiding whatever was shown most recently. */
export function pickLovePhrase(context: LoveContext): string {
  const candidates = PHRASES[context]?.length ? PHRASES[context] : PHRASES.random;
  const history = loadHistory();
  // If every line in a small pool (e.g. weather_cold) is already in recent history, fall
  // back to the full pool rather than getting stuck with no candidates.
  const fresh = candidates.filter((phrase) => !history.includes(phrase.id));
  const pickFrom = fresh.length ? fresh : candidates;
  const choice = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  saveHistory([choice.id, ...history.filter((id) => id !== choice.id)].slice(0, HISTORY_LIMIT));
  return choice.text;
}

export type LoveContextInput = {
  now: number;
  isActive: boolean;
  isUpcoming: boolean;
  reportMs?: number;
  releaseMs?: number;
  /** Current temperature (°C) at the relevant station, if already known. */
  arrivalTemp?: number;
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * Picks a context from real, currently-available app state only. Contexts like
 * good_sleep/poor_sleep/high_readiness/low_readiness/away/reunion have no honest signal
 * anywhere in KhaVair today (no sleep tracking, no concept of Ramil's location) — their
 * phrase pools exist and are reachable via pickLovePhrase() directly, but this detector
 * deliberately never selects them rather than guessing.
 */
export function detectLoveContext(input: LoveContextInput): LoveContext {
  if (input.isActive) return 'during_duty';
  if (input.isUpcoming && input.reportMs !== undefined && input.reportMs - input.now <= 6 * HOUR_MS) return 'before_duty';
  if (!input.isActive && !input.isUpcoming && input.releaseMs !== undefined && input.now - input.releaseMs <= 3 * HOUR_MS) return 'after_duty';
  if (input.arrivalTemp !== undefined) {
    if (input.arrivalTemp <= 0) return 'weather_cold';
    if (input.arrivalTemp >= 32) return 'weather_hot';
  }
  const hour = new Date(input.now).getHours();
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 22 || hour < 5) return 'night';
  return 'random';
}
