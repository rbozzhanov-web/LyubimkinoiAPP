// Checks the pay engine against an issued payslip, line by line.
//
//   npx tsx scripts/check-payslip.mts <roster.pdf> <payslip.json>
//
// Neither file belongs in this repository: a roster carries crew names and a payslip carries
// personal pay. Keep both outside it and pass paths.
//
// payslip.json shape — every field optional except the profile:
//   { "profile": { "hourlyRate": 3100, "monthlySalary": 0, "monthlyTransport": 0 },
//     "mrpKzt": 4325,
//     "overrides": { "paidHours": 0, "deadheadHours": 0, "sickAmountOverride": 0,
//                    "vacationAmountOverride": 0, "holidayHours": 0, "officialDayOffHours": 0 },
//     "expect": { "salary": 0, "transport": 0, "base": 0, "band6080": 0, "band80": 0,
//                 "night": 0, "sick": 0, "vacation": 0, "holiday": 0, "dayOff": 0,
//                 "deadhead": 0, "gross": 0, "osms": 0, "opv": 0, "ipn": 0, "net": 0 } }
import { readFileSync } from 'node:fs';
import { parseAirAstanaRoster } from '../src/import/parseAirAstanaRoster';
import { calculateRosterPay } from '../src/domain/pay';
import type { ExtractedPage } from '../src/import/types';

const [pdfPath, slipPath] = process.argv.slice(2);
if (!pdfPath || !slipPath) {
  console.error('usage: npx tsx scripts/check-payslip.mts <roster.pdf> <payslip.json>');
  process.exit(2);
}

const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), useSystemFonts: true }).promise;
const pages: ExtractedPage[] = [];
for (let n = 1; n <= doc.numPages; n += 1) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  pages.push({
    items: (content.items as any[]).filter((item) => 'str' in item).map((item) => ({
      str: item.str, x: item.transform[4], y: viewport.height - item.transform[5], width: item.width,
    })),
    width: viewport.width, height: viewport.height,
  });
}

const slip = JSON.parse(readFileSync(slipPath, 'utf8'));
const roster = parseAirAstanaRoster(pages);
const pay = calculateRosterPay(roster, slip.profile, slip.overrides ?? {}, slip.mrpKzt ?? 4325);

const actual: Record<string, number> = {
  salary: pay.salaryLine.amount, transport: pay.transportLine.amount, base: pay.hourBaseLine.amount,
  band6080: pay.hourSurchargeLines[0].amount, band80: pay.hourSurchargeLines[1].amount,
  night: pay.nightLine.amount, holiday: pay.holidayLine.amount, dayOff: pay.officialDayOffLine.amount,
  sick: pay.sickLine.amount, vacation: pay.vacationLine.amount, deadhead: pay.deadheadLine.amount,
  gross: pay.gross, osms: pay.osms, opv: pay.opv, ipn: pay.ipn, net: pay.net,
};

console.log(`${roster.period.start}..${roster.period.end}  paid days ${pay.paidDays}/${pay.daysInMonth}`);
console.log(`  sick ${pay.sickDays}  unfit ${pay.unfitDays}  vacation ${pay.vacationDays}  child leave ${pay.childLeaveDays}`);
console.log(`  operating sectors ${pay.operatingSectors}  deadhead ${pay.deadheadSectors}`);

let mismatched = 0;
for (const [key, want] of Object.entries((slip.expect ?? {}) as Record<string, number>)) {
  const got = actual[key] ?? 0;
  const delta = Math.round((got - want) * 100) / 100;
  if (Math.abs(delta) < 0.005) console.log(`  ok   ${key.padEnd(10)} ${want}`);
  else { console.log(`  DIFF ${key.padEnd(10)} payslip ${want}   app ${got}   ${delta > 0 ? '+' : ''}${delta}`); mismatched += 1; }
}
console.log(mismatched === 0 ? '\nEvery stated line matches.' : `\n${mismatched} line(s) differ.`);
process.exit(mismatched === 0 ? 0 : 1);
