import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { parseAirAstanaRoster, type ParsedAirAstanaRoster } from './parseAirAstanaRoster';
import { extractPdfPagesWeb } from './pdfWeb';

export async function pickAndParseRoster(): Promise<ParsedAirAstanaRoster | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: false, copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return undefined;
  const asset = result.assets[0];

  if (Platform.OS !== 'web') {
    throw new Error('Native PDF extraction will be enabled with the iOS/Android shell. Use the installed web app for this build.');
  }

  const webFile = asset.file;
  const data = webFile ? await webFile.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  const pages = await extractPdfPagesWeb(data);
  return parseAirAstanaRoster(pages);
}
