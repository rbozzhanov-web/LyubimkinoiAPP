import { Platform } from 'react-native';
import { pickAndParseRoster } from './pickRoster';
import type { ParsedAirAstanaRoster } from './parseAirAstanaRoster';

export type AimsWebArchiveResult = { roster: ParsedAirAstanaRoster };

type Copy = {
  title: string;
  help: string;
  helpPeriod: string;
  openAims: string;
  importArchive: string;
  cancel: string;
  picking: string;
  accent: string;
};

const NORMAL_COPY: Copy = {
  title: 'Import from AIMS',
  help: 'Open Crew Schedule, then Share → Options → Web Archive → Save to Files. Return to KhaVair and choose that Web Archive.',
  helpPeriod: 'Web Archive only ever captures the period currently open in AIMS. For a different month, generate the PDF "Personal Crew Schedule Report" for that period instead — you can import that file the same way, below.',
  openAims: 'Open AIMS Crew Schedule',
  importArchive: 'Import Web Archive or PDF',
  cancel: 'Cancel',
  picking: 'Choose the saved Web Archive or PDF…',
  accent: '#2D7DFF',
};

// Special Mode's own voice (see lovePhrases.ts): hand-written, in Ramil's words, for Khava.
// Same steps as Normal Mode underneath, so getting this wrong still leads to the right file.
const LOVED_COPY: Copy = {
  title: 'Загрузим твой график, любимка',
  help: 'Открой Crew Schedule в AIMS, дай странице полностью загрузиться, потом Поделиться → Опции → Web Archive → Сохранить в Файлы. Вернись сюда и выбери этот файл — а дальше я сам всё разложу.',
  helpPeriod: 'Web Archive хранит только тот месяц, что сейчас открыт в AIMS. Для другого — сформируй в AIMS PDF «Personal Crew Schedule Report» на нужный период, его тоже можно загрузить точно так же, ниже.',
  openAims: 'Открыть AIMS Crew Schedule',
  importArchive: 'Загрузить Web Archive или PDF',
  cancel: 'Не сейчас',
  picking: 'Выбери сохранённый Web Archive или PDF…',
  accent: '#FF6B6A',
};

export function openAimsWebArchiveFlow(lovedMode = false): Promise<AimsWebArchiveResult | undefined> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.reject(new Error('AIMS Web Archive import is available in the web app.'));
  }

  const copy = lovedMode ? LOVED_COPY : NORMAL_COPY;

  return new Promise((resolve) => {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646', display: 'flex', alignItems: 'flex-end',
      justifyContent: 'center', background: 'rgba(0,0,0,.28)', padding: '16px',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(100%, 620px)', borderRadius: '24px', padding: '18px',
      background: lovedMode ? (dark ? '#2B1F1B' : '#FFF7F2') : (dark ? '#182135' : '#FFFFFF'),
      color: lovedMode ? (dark ? '#FFF3EC' : '#2B1F1B') : (dark ? '#F5F7FA' : '#0F172A'),
      boxShadow: '0 20px 60px rgba(0,0,0,.28)', fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif',
      marginBottom: 'max(8px, env(safe-area-inset-bottom))',
    });

    const title = document.createElement('div');
    title.textContent = copy.title;
    Object.assign(title.style, { fontSize: '20px', fontWeight: '800', marginBottom: '6px' });

    const help = document.createElement('div');
    help.textContent = copy.help;
    Object.assign(help.style, { fontSize: '14px', lineHeight: '20px', opacity: '.72', marginBottom: '8px' });

    const helpPeriod = document.createElement('div');
    helpPeriod.textContent = copy.helpPeriod;
    Object.assign(helpPeriod.style, { fontSize: '13px', lineHeight: '18px', opacity: '.6', marginBottom: '14px' });

    const openAims = document.createElement('button');
    openAims.textContent = copy.openAims;
    Object.assign(openAims.style, {
      width: '100%', border: '0', borderRadius: '14px', padding: '13px', fontSize: '15px', fontWeight: '800',
      background: copy.accent, color: '#FFFFFF', marginBottom: '10px',
    });
    openAims.onclick = () => window.open('https://aims.airastana.com/eCrew/CrewSchedule', 'khavair-aims');

    const importArchive = document.createElement('button');
    importArchive.textContent = copy.importArchive;
    Object.assign(importArchive.style, {
      width: '100%',
      border: `1px solid ${lovedMode ? (dark ? '#4A2822' : '#FFD9CC') : (dark ? '#232D40' : '#E9EDF2')}`,
      borderRadius: '14px', padding: '13px', fontSize: '15px', fontWeight: '800',
      background: lovedMode ? (dark ? '#3A2A25' : '#FFEDE6') : (dark ? '#131B2C' : '#F6F7FA'),
      color: 'inherit', marginBottom: '8px',
    });

    const status = document.createElement('div');
    Object.assign(status.style, { minHeight: '20px', fontSize: '13px', lineHeight: '18px', opacity: '.72', marginTop: '4px' });

    const cancel = document.createElement('button');
    cancel.textContent = copy.cancel;
    Object.assign(cancel.style, {
      width: '100%', border: '0', borderRadius: '14px', padding: '13px', fontSize: '15px', fontWeight: '700',
      background: 'transparent', color: 'inherit', marginTop: '2px', opacity: '.74',
    });

    const cleanup = () => overlay.remove();
    cancel.onclick = () => { cleanup(); resolve(undefined); };
    overlay.onclick = (event) => { if (event.target === overlay) { cleanup(); resolve(undefined); } };

    importArchive.onclick = async () => {
      status.textContent = copy.picking;
      try {
        const roster = await pickAndParseRoster();
        if (!roster) {
          status.textContent = '';
          return;
        }
        cleanup();
        resolve({ roster });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    };

    card.append(title, help, helpPeriod, openAims, importArchive, status, cancel);
    overlay.append(card);
    document.body.append(overlay);
  });
}
