import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Duty } from '@/src/domain/types';
import { verifyLovedModeCode } from '@/src/domain/lovedMode';
import { DEFAULT_PROFILE } from '@/src/domain/profile';
import { formatMinutes, rosterMonthLabel, rosterToDuties } from '@/src/domain/rosterView';
import { pickAndParseRoster } from '@/src/import/pickRoster';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { clearStoredRoster, loadStoredRoster, saveStoredRoster } from '@/src/storage/rosterStorage';

type Tab = 'Home' | 'Roster' | 'Money' | 'More';
const tabs: Tab[] = ['Home', 'Roster', 'Money', 'More'];

export default function IndexScreen() {
  const dark = useColorScheme() === 'dark';
  const [tab, setTab] = useState<Tab>('Home');
  const [lovedMode, setLovedMode] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [roster, setRoster] = useState<ParsedAirAstanaRoster>();
  const [selectedDuty, setSelectedDuty] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>();

  useEffect(() => { setRoster(loadStoredRoster()); }, []);
  const duties = useMemo(() => roster ? rosterToDuties(roster) : [], [roster]);
  const activeDuty = duties.find((duty) => duty.id === selectedDuty) ?? duties[0];
  const operatingSectors = roster?.sectors.filter((sector) => !sector.deadhead).length ?? 0;
  const palette = useMemo(() => ({
    background: dark ? '#11110F' : '#F4F1EC', surface: dark ? '#1B1A18' : '#FCFAF7', surfaceStrong: dark ? '#25231F' : '#FFFFFF',
    text: dark ? '#F7F4EF' : '#171714', muted: dark ? '#AAA49A' : '#747067', line: dark ? '#302E29' : '#E7E1D8',
    accent: lovedMode ? '#D98B74' : (dark ? '#C7BDAE' : '#2F3934'), accentSoft: lovedMode ? (dark ? '#34221F' : '#F6E3DC') : (dark ? '#222925' : '#E6ECE8'),
    rose: lovedMode ? '#B96A73' : (dark ? '#C7BDAE' : '#2F3934'), aqua: lovedMode ? '#7CC8D6' : (dark ? '#AAA49A' : '#747067'),
  }), [dark, lovedMode]);

  const importRoster = async () => {
    setImportError(undefined); setImporting(true);
    try {
      const parsed = await pickAndParseRoster();
      if (!parsed) return;
      saveStoredRoster(parsed); setRoster(parsed); setSelectedDuty(undefined); setTab('Roster');
    } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); }
    finally { setImporting(false); }
  };

  const requestLovedMode = () => {
    if (lovedMode) { setLovedMode(false); return; }
    setUnlockCode(''); setUnlockError(false); setUnlockOpen(true);
  };
  const submitCode = () => {
    if (!verifyLovedModeCode(unlockCode)) { setUnlockError(true); return; }
    setLovedMode(true); setUnlockOpen(false); setUnlockCode('');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top','bottom']}>
      <View style={styles.app}>
        <View style={styles.header}>
          <View><Text style={[styles.brand,{color:palette.text}]}>KhaVair</Text><Text style={[styles.kicker,{color:palette.muted}]}>CABIN CREW COMPANION</Text></View>
          <Pressable onPress={requestLovedMode} style={[styles.modeButton,{backgroundColor:palette.surface}]}><Text style={styles.modeGlyph}>{lovedMode?'🌹':'♡'}</Text></Pressable>
        </View>

        <View style={styles.viewport}>
          {tab === 'Home' && <Home roster={roster} duties={duties} palette={palette} onImport={importRoster} importing={importing} />}
          {tab === 'Roster' && <RosterScreen roster={roster} duties={duties} activeDuty={activeDuty} palette={palette} importing={importing} error={importError} onImport={importRoster} onSelect={setSelectedDuty} />}
          {tab === 'Money' && <View style={styles.screen}><Text style={[styles.sectionTitle,{color:palette.text}]}>Money</Text><Card palette={palette}><Text style={[styles.label,{color:palette.muted}]}>PER DIEM</Text><Text style={[styles.bigValue,{color:palette.text}]}>—</Text><Text style={[styles.meta,{color:palette.muted}]}>Rules engine is next. Salary remains disabled until the pay rules are supplied.</Text></Card></View>}
          {tab === 'More' && <View style={styles.screen}><Text style={[styles.sectionTitle,{color:palette.text}]}>More</Text><Card palette={palette}><Text style={[styles.cardTitle,{color:palette.text}]}>Profile</Text><Text style={[styles.meta,{color:palette.muted}]}>Contract position · {DEFAULT_PROFILE.contractRank}</Text><Text style={[styles.meta,{color:palette.muted}]}>Roster position is display-only and never changes pay.</Text></Card>{roster && <Pressable onPress={()=>{clearStoredRoster();setRoster(undefined);setSelectedDuty(undefined);}} style={[styles.secondaryButton,{borderColor:palette.line}]}><Text style={[styles.secondaryText,{color:palette.text}]}>Erase imported roster</Text></Pressable>}</View>}
        </View>

        <View style={[styles.tabBar,{backgroundColor:palette.surfaceStrong,borderColor:palette.line}]}>{tabs.map((item)=><Pressable key={item} onPress={()=>setTab(item)} style={styles.tabItem}><View style={[styles.tabDot,tab===item&&{backgroundColor:palette.accent}]}/><Text style={[styles.tabText,{color:tab===item?palette.text:palette.muted}]}>{item}</Text></Pressable>)}</View>
      </View>

      <Modal visible={unlockOpen} transparent animationType="fade" onRequestClose={()=>setUnlockOpen(false)}><View style={styles.modalBackdrop}><View style={[styles.unlockCard,{backgroundColor:palette.surfaceStrong,borderColor:palette.line}]}><Text style={[styles.label,{color:palette.rose}]}>FOR SOMEONE SPECIAL</Text><Text style={[styles.unlockTitle,{color:palette.text}]}>Enter the code</Text><TextInput autoFocus value={unlockCode} secureTextEntry keyboardType="number-pad" maxLength={7} onChangeText={(value)=>{setUnlockCode(value.replace(/\D/g,'').slice(0,7));setUnlockError(false);}} onSubmitEditing={submitCode} style={[styles.codeInput,{color:palette.text,backgroundColor:palette.surface,borderColor:unlockError?palette.rose:palette.line}]}/><Text style={[styles.codeHint,{color:unlockError?palette.rose:palette.muted}]}>{unlockError?'That code did not unlock the theme.':'7 digits'}</Text><View style={styles.actions}><Pressable onPress={()=>setUnlockOpen(false)} style={[styles.action,{borderColor:palette.line}]}><Text style={{color:palette.text}}>Cancel</Text></Pressable><Pressable onPress={submitCode} style={[styles.action,{backgroundColor:palette.accent,borderColor:palette.accent}]}><Text style={styles.actionText}>Unlock</Text></Pressable></View></View></View></Modal>
    </SafeAreaView>
  );
}

function Home({ roster, duties, palette, onImport, importing }: { roster?: ParsedAirAstanaRoster; duties: Duty[]; palette:any; onImport:()=>void; importing:boolean }) {
  const duty = duties[0];
  if (!roster || !duty) return <View style={styles.screen}><Text style={[styles.sectionTitle,{color:palette.text}]}>Your roster, simplified.</Text><Text style={[styles.intro,{color:palette.muted}]}>Import an Air Astana Personal Crew Schedule Report. Parsing happens on this device.</Text><PrimaryButton title="Import roster PDF" onPress={onImport} loading={importing} palette={palette}/><Privacy palette={palette}/></View>;
  const first = duty.sectors[0], last = duty.sectors[duty.sectors.length-1];
  return <View style={styles.screen}><Text style={[styles.label,{color:palette.muted}]}>IMPORTED · {rosterMonthLabel(roster)}</Text><Card palette={palette}><View style={styles.routeRow}><Text style={[styles.airport,{color:palette.text}]}>{first.departure}</Text><Text style={[styles.routeArrow,{color:palette.muted}]}>→</Text><Text style={[styles.airport,{color:palette.text}]}>{last.arrival}</Text></View><Text style={[styles.meta,{color:palette.muted}]}>Report {duty.reportTime} · Release {duty.releaseTime} · {duty.sectors.length} sector{duty.sectors.length===1?'':'s'}</Text></Card><View style={styles.summaryRow}><Summary title="BLOCK" value={formatMinutes(roster.totals.blockMinutes)} detail={`${operatingCount(roster)} operating sectors`} palette={palette}/><Summary title="NIGHT" value={formatMinutes(roster.totals.nightMinutes)} detail="airline reported" palette={palette}/></View><Privacy palette={palette}/></View>;
}

function RosterScreen({ roster, duties, activeDuty, palette, importing, error, onImport, onSelect }: { roster?:ParsedAirAstanaRoster; duties:Duty[]; activeDuty?:Duty; palette:any; importing:boolean; error?:string; onImport:()=>void; onSelect:(id:string)=>void }) {
  return <View style={styles.screen}><View style={styles.titleRow}><View><Text style={[styles.sectionTitle,{color:palette.text}]}>{roster?rosterMonthLabel(roster):'Roster'}</Text>{roster?.subject && <Text style={[styles.meta,{color:palette.muted}]}>{roster.subject.base ?? '—'} · contract FJ</Text>}</View><Pressable onPress={onImport} disabled={importing} style={[styles.compactButton,{backgroundColor:palette.accentSoft}]}>{importing?<ActivityIndicator/>:<Text style={[styles.compactText,{color:palette.accent}]}>{roster?'Replace':'Import'}</Text>}</Pressable></View>{error&&<Text style={[styles.error,{color:palette.rose}]}>{error}</Text>}{!roster?<Privacy palette={palette}/>:<View style={styles.rosterSplit}><View style={[styles.innerWindow,{backgroundColor:palette.surface,borderColor:palette.line}]}><FlatList data={duties} keyExtractor={(item)=>item.id} contentContainerStyle={styles.listContent} renderItem={({item})=><Pressable onPress={()=>onSelect(item.id)} style={[styles.rosterCard,{backgroundColor:activeDuty?.id===item.id?palette.accentSoft:palette.surfaceStrong,borderColor:palette.line}]}><Text style={[styles.label,{color:palette.muted}]}>{item.dateLabel}</Text><Text style={[styles.rosterRoute,{color:palette.text}]}>{item.sectors[0].departure} → {item.sectors[item.sectors.length-1].arrival}</Text><Text style={[styles.meta,{color:palette.muted}]}>Report {item.reportTime} · {item.sectors.map((s)=>s.flightNumber).join(' · ')}</Text></Pressable>}/></View>{activeDuty&&<DutyDetail duty={activeDuty} palette={palette}/>}</View>}</View>;
}

function DutyDetail({ duty, palette }: { duty:Duty; palette:any }) { return <View style={[styles.detailWindow,{backgroundColor:palette.surfaceStrong,borderColor:palette.line}]}><Text style={[styles.cardTitle,{color:palette.text}]}>{duty.dateLabel}</Text><FlatList data={duty.sectors} keyExtractor={(item)=>item.id} contentContainerStyle={{paddingBottom:8}} renderItem={({item})=><View style={[styles.sectorBlock,{borderTopColor:palette.line}]}><View style={styles.sectorHeader}><Text style={[styles.sectorRoute,{color:palette.text}]}>{item.departure} → {item.arrival}</Text><Text style={[styles.meta,{color:palette.muted}]}>{item.flightNumber}{item.deadhead?' · DHC':''}</Text></View><Text style={[styles.meta,{color:palette.muted}]}>{item.departureTime} – {item.arrivalTime}</Text><Text style={[styles.flyingWith,{color:palette.accent}]}>Flying with · {item.crew.length}</Text>{item.crew.map((member)=><View key={member.id} style={styles.crewRow}><View style={[styles.avatar,{backgroundColor:palette.accentSoft}]}><Text style={[styles.avatarText,{color:palette.accent}]}>{member.name[0]}</Text></View><View style={{flex:1}}><Text style={[styles.crewName,{color:palette.text}]}>{member.name}</Text><Text style={[styles.meta,{color:palette.muted}]}>{member.position}</Text></View></View>)}</View>}/></View> }

function PrimaryButton({ title, onPress, loading, palette }:{title:string;onPress:()=>void;loading:boolean;palette:any}) { return <Pressable onPress={onPress} disabled={loading} style={[styles.primaryButton,{backgroundColor:palette.accent}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.actionText}>{title}</Text>}</Pressable> }
function Card({children,palette}:{children:React.ReactNode;palette:any}) { return <View style={[styles.card,{backgroundColor:palette.surfaceStrong,borderColor:palette.line}]}>{children}</View> }
function Privacy({palette}:{palette:any}) { return <View style={[styles.privacy,{backgroundColor:palette.surface,borderColor:palette.line}]}><Text style={[styles.cardTitle,{color:palette.text}]}>Private by design</Text><Text style={[styles.meta,{color:palette.muted}]}>The PDF is parsed locally. KhaVair does not upload the roster or crew list.</Text></View> }
function Summary({title,value,detail,palette}:{title:string;value:string;detail:string;palette:any}) { return <View style={[styles.summary,{backgroundColor:palette.surface,borderColor:palette.line}]}><Text style={[styles.label,{color:palette.muted}]}>{title}</Text><Text style={[styles.summaryValue,{color:palette.text}]}>{value}</Text><Text style={[styles.meta,{color:palette.muted}]}>{detail}</Text></View> }
function operatingCount(roster:ParsedAirAstanaRoster){return roster.sectors.filter((sector)=>!sector.deadhead).length;}

const styles=StyleSheet.create({safe:{flex:1},app:{flex:1,width:'100%',maxWidth:620,alignSelf:'center',paddingHorizontal:16},header:{height:72,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontSize:27,fontWeight:'700',letterSpacing:-.8},kicker:{fontSize:9,fontWeight:'700',letterSpacing:1.35},modeButton:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center'},modeGlyph:{fontSize:19},viewport:{flex:1,minHeight:0},screen:{flex:1,paddingTop:8,gap:12},sectionTitle:{fontSize:27,lineHeight:31,fontWeight:'700',letterSpacing:-.8},intro:{fontSize:15,lineHeight:22,maxWidth:440},label:{fontSize:10,fontWeight:'700',letterSpacing:1.1},card:{borderWidth:1,borderRadius:24,padding:18},cardTitle:{fontSize:15,fontWeight:'700'},meta:{fontSize:12,lineHeight:17},bigValue:{fontSize:42,fontWeight:'700',marginTop:8},routeRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},airport:{fontSize:34,fontWeight:'700'},routeArrow:{fontSize:22},summaryRow:{flexDirection:'row',gap:10},summary:{flex:1,borderWidth:1,borderRadius:20,padding:14,minHeight:112},summaryValue:{fontSize:25,fontWeight:'700',marginTop:8},privacy:{borderWidth:1,borderRadius:20,padding:14},primaryButton:{height:50,borderRadius:16,alignItems:'center',justifyContent:'center'},actionText:{color:'#fff',fontWeight:'700'},titleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},compactButton:{height:38,minWidth:72,borderRadius:14,alignItems:'center',justifyContent:'center',paddingHorizontal:12},compactText:{fontWeight:'700',fontSize:13},error:{fontSize:12},rosterSplit:{flex:1,minHeight:0,gap:10},innerWindow:{flex:1,minHeight:120,borderWidth:1,borderRadius:20,overflow:'hidden'},detailWindow:{flex:1.2,minHeight:0,borderWidth:1,borderRadius:20,padding:14,overflow:'hidden'},listContent:{padding:8,gap:7},rosterCard:{borderWidth:1,borderRadius:16,padding:13},rosterRoute:{fontSize:20,fontWeight:'700',marginTop:4},sectorBlock:{borderTopWidth:StyleSheet.hairlineWidth,paddingVertical:12},sectorHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectorRoute:{fontSize:19,fontWeight:'700'},flyingWith:{fontSize:12,fontWeight:'700',marginTop:9,marginBottom:4},crewRow:{minHeight:42,flexDirection:'row',alignItems:'center'},avatar:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',marginRight:9},avatarText:{fontSize:11,fontWeight:'800'},crewName:{fontSize:13,fontWeight:'600'},secondaryButton:{height:48,borderWidth:1,borderRadius:15,alignItems:'center',justifyContent:'center'},secondaryText:{fontWeight:'600'},tabBar:{height:64,marginTop:10,marginBottom:4,borderWidth:1,borderRadius:22,flexDirection:'row'},tabItem:{flex:1,alignItems:'center',justifyContent:'center',gap:5},tabDot:{width:5,height:5,borderRadius:3,backgroundColor:'transparent'},tabText:{fontSize:11,fontWeight:'600'},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.46)',alignItems:'center',justifyContent:'center',padding:20},unlockCard:{width:'100%',maxWidth:390,borderWidth:1,borderRadius:26,padding:20},unlockTitle:{fontSize:26,fontWeight:'700',marginTop:7},codeInput:{height:54,borderWidth:1,borderRadius:15,marginTop:18,paddingHorizontal:16,fontSize:22,letterSpacing:5,textAlign:'center'},codeHint:{fontSize:11,marginTop:6},actions:{flexDirection:'row',gap:9,marginTop:18},action:{flex:1,height:46,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center'}});
