import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { parseAirAstanaRoster, type ParsedAirAstanaRoster } from './parseAirAstanaRoster';
import { extractPdfPagesWeb } from './pdfWeb';

export async function pickAndParseRoster(): Promise<ParsedAirAstanaRoster | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return undefined;
  const asset = result.assets[0];

  if (Platform.OS !== 'web') {
    throw new Error('Native PDF extraction will be enabled with the iOS/Android shell. Use the installed web app for this build.');
  }

  const webFile = asset.file;
  const data = webFile ? await webFile.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return parseRosterData(data, asset.name ?? '');
}

export async function parseRosterData(data: ArrayBuffer, name = ''): Promise<ParsedAirAstanaRoster> {
  const header = new TextDecoder('ascii').decode(data.slice(0, 8));
  if (header.startsWith('%PDF-')) {
    const pages = await extractPdfPagesWeb(data);
    return parseAirAstanaRoster(pages);
  }

  const isWebArchive = header.startsWith('bplist00') || /\.webarchive$/i.test(name);
  throw new Error(isWebArchive
    ? 'Web Archive import is not wired up in KhaVair yet. Generate the "Personal Crew Schedule Report" PDF in AIMS and import that file instead.'
    : 'Unsupported roster file. Import the Air Astana "Personal Crew Schedule Report" PDF, or a saved AIMS Web Archive once that import is enabled.');
}
