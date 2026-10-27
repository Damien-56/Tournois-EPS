import { useEffect, useMemo, useRef, useState } from "react";
import { uid } from "./domain/ids";
import type { Match, SchoolClass, Sport, Student, StudentStatus, Tournament, TournamentMode, TournamentStore } from "./domain/types";
import { exportStore, importStore, loadStore, saveStore } from "./storage";
import { installIntegrationBridge } from "./integration";
import { discoverLanHosts, fetchLanState, flushQueuedLanActions, hasNativeLanHost, publishLanState, queueLanAction, readLanActions, sendLanAction, startLanHost, stopLanHost, type LanAction, type LanInfo, type LanPeer, type LanRole } from "./lan";
import { LanQrCode } from "./LanQrCode";
import { getPouleCourt, isAtpMatchAllowed, splitIntoGroups } from "./domain/rules";
import { getClassPerformance, getTargetScore, recalculateClassStats } from "./domain/stats";
import { isValidMatchResult, replaceTournamentMatch } from "./domain/matches";

const sampleNames = ["Camille", "Noah", "Jules", "Inès", "Lina", "Hugo", "Zoé", "Louis"];
const newStudent = (name: string): Student => ({ id: uid("student"), name, level: 3, status: "present", points: 0, matches: 0, wins: 0, losses: 0, refereed: 0 });

function App() {
  const [store, setStore] = useState<TournamentStore>(() => loadStore());
  const [screen, setScreen] = useState<"home" | "settings" | "class" | "tournament">("home");
  const [classView, setClassView] = useState<"usage" | "setup">("usage");
  const [classId, setClassId] = useState<string>();
  const [tournamentId, setTournamentId] = useState<string>();
  const [newClassName, setNewClassName] = useState("");
  const [studentText, setStudentText] = useState("");
  const [mode, setMode] = useState<TournamentMode>("classic");
  const [sport, setSport] = useState<Sport>("badminton");
  const [tournamentName, setTournamentName] = useState("");
  const [message, setMessage] = useState("");
  const [lanRole, setLanRole] = useState<LanRole>("standalone");
  const [lanInfo, setLanInfo] = useState<LanInfo>();
  const [joinUrl, setJoinUrl] = useState("");
  const [lanError, setLanError] = useState("");
  const [lanActionCursor, setLanActionCursor] = useState(0);
  const [lanPeers, setLanPeers] = useState<LanPeer[]>([]);
  const storeRef = useRef(store);
  const integrationNotifyRef = useRef<((snapshot: TournamentStore) => void) | undefined>(undefined);
  storeRef.current = store;

  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => {
    integrationNotifyRef.current = installIntegrationBridge(() => storeRef.current, (snapshot) => setStore(snapshot));
    return () => {
      integrationNotifyRef.current = undefined;
      delete window.epsTournois;
    };
  }, []);
  useEffect(() => { integrationNotifyRef.current?.(store); }, [store]);
  useEffect(() => {
    if (lanRole !== "master" || !lanInfo) return;
    publishLanState(store).catch((error) => setLanError(error instanceof Error ? error.message : "Publication locale impossible"));
  }, [store, lanInfo, lanRole]);
  useEffect(() => {
    if (lanRole !== "client" || !joinUrl) return;
    let cancelled = false;
    const poll = async () => { try { await flushQueuedLanActions(joinUrl); const snapshot = await fetchLanState(joinUrl); if (!cancelled) setStore(snapshot); setLanError(""); } catch (error) { if (!cancelled) setLanError(error instanceof Error ? error.message : "Connexion locale interrompue"); } };
    void poll(); const timer = window.setInterval(poll, 1800);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [joinUrl, lanRole]);
  useEffect(() => {
    if (lanRole !== "master" || !lanInfo) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const actions = await readLanActions(lanActionCursor);
        for (const item of actions) {
          const action = JSON.parse(item.action) as { type?: string; payload?: Record<string, unknown> };
          if (!cancelled && action.payload) setStore((current) => applyLanAction(current, action));
          if (!cancelled) setLanActionCursor(item.sequence);
        }
      } catch (error) { if (!cancelled) setLanError(error instanceof Error ? error.message : "Lecture des actions locales impossible"); }
    };
    const timer = window.setInterval(poll, 1500); void poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [lanInfo, lanRole, lanActionCursor]);

  const activeClass = store.classes.find((item) => item.id === classId);
  const activeTournament = store.tournaments.find((item) => item.id === tournamentId);

  const updateClass = (updated: SchoolClass) => setStore((current) => ({ ...current, classes: current.classes.map((item) => item.id === updated.id ? updated : item) }));
  const updateTournament = (updated: Tournament) => setStore((current) => ({ ...current, tournaments: current.tournaments.map((item) => item.id === updated.id ? updated : item) }));

  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 2600); };
  const openClass = (id: string, view: "usage" | "setup" = "usage") => { setClassId(id); setClassView(view); setScreen("class"); };
  const openSettings = () => setScreen("settings");
  const openTournament = (id: string) => { setTournamentId(id); setScreen("tournament"); };

  const createClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const item: SchoolClass = { id: uid("class"), name, students: [], createdAt: new Date().toISOString() };
    setStore((current) => ({ ...current, classes: [...current.classes, item] }));
    setNewClassName(""); openClass(item.id, "setup");
  };

  const addStudents = () => {
    if (!activeClass) return;
    const names = studentText.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    updateClass({ ...activeClass, students: [...activeClass.students, ...names.map(newStudent)] });
    setStudentText(""); notify(`${names.length} élève(s) ajouté(s)`);
  };

  const createTournament = () => {
    if (!activeClass) return;
    const item: Tournament = { id: uid("tournament"), classId: activeClass.id, name: tournamentName.trim() || `Tournoi ${mode === "atp" ? "ATP" : mode === "poule" ? "Poules" : "Classique"}`, sport, mode, createdAt: new Date().toISOString(), pointsWin: 3, pointsLoss: 1, maxRankDiff: 3, courtCount: 2, groupSize: 4, matchFormat: "normal", targetScore: 21, matches: [] };
    setStore((current) => ({ ...current, tournaments: [...current.tournaments, item] }));
    setTournamentName(""); openTournament(item.id);
  };

  const seedDemo = () => {
    const demoClass: SchoolClass = { id: uid("class"), name: "4e EPS — Démonstration", createdAt: new Date().toISOString(), students: sampleNames.map(newStudent) };
    const demoTournament: Tournament = { id: uid("tournament"), classId: demoClass.id, name: "Badminton — séance 1", mode: "poule", createdAt: new Date().toISOString(), pointsWin: 3, pointsLoss: 1, maxRankDiff: 3, courtCount: 2, groupSize: 4, matchFormat: "normal", matches: [] };
    setStore((current) => ({ ...current, classes: [...current.classes, demoClass], tournaments: [...current.tournaments, demoTournament] }));
    openTournament(demoTournament.id); notify("Exemple EPS ajouté");
  };

  if (screen === "settings") return <SettingsScreen classes={store.classes} tournaments={store.tournaments} newClassName={newClassName} setNewClassName={setNewClassName} createClass={createClass} seedDemo={seedDemo} onBack={() => setScreen("home")} onOpenClass={(id) => openClass(id, "setup")} onExport={() => exportStore(store)} onImport={async (file) => { try { setStore(await importStore(file)); notify("Sauvegarde importée"); } catch (error) { notify(error instanceof Error ? error.message : "Import impossible"); } }} message={message} role={lanRole} info={lanInfo} peers={lanPeers} joinUrl={joinUrl} error={lanError} nativeAvailable={hasNativeLanHost()} onDiscover={async () => { try { const peers = await discoverLanHosts(); setLanPeers(peers); if (!peers.length) setLanError("Aucune tablette maître trouvée sur ce Wi‑Fi"); else setLanError(""); } catch (error) { setLanError(error instanceof Error ? error.message : "Découverte locale indisponible"); } }} onStart={async () => { try { const info = await startLanHost(); setLanInfo(info); setLanRole("master"); setLanError(""); notify("Tablette maître active sur le réseau local"); } catch (error) { setLanError(error instanceof Error ? error.message : "Impossible de démarrer le réseau local"); } }} onStop={async () => { await stopLanHost(); setLanInfo(undefined); setLanRole("standalone"); notify("Mode local arrêté"); }} onJoin={async () => { try { const snapshot = await fetchLanState(joinUrl.trim()); setStore(snapshot); setLanRole("client"); setLanError(""); notify("Tablette connectée à la séance"); } catch (error) { setLanError(error instanceof Error ? error.message : "Connexion locale impossible"); } }} onJoinUrlChange={setJoinUrl} />;
  if (screen === "class" && activeClass) return <ClassScreen classItem={activeClass} tournaments={store.tournaments.filter((item) => item.classId === activeClass.id)} view={classView} studentText={studentText} setStudentText={setStudentText} addStudents={addStudents} updateClass={updateClass} onBack={() => setScreen(classView === "setup" ? "settings" : "home")} onOpenSetup={() => openClass(activeClass.id, "setup")} onOpenUsage={() => openClass(activeClass.id, "usage")} onSettings={openSettings} onOpenTournament={openTournament} mode={mode} setMode={setMode} sport={sport} setSport={setSport} tournamentName={tournamentName} setTournamentName={setTournamentName} createTournament={createTournament} />;
  if (screen === "tournament" && activeClass && activeTournament) return <TournamentScreen classItem={activeClass} tournament={activeTournament} allTournaments={store.tournaments.filter((item) => item.classId === activeClass.id)} updateClass={updateClass} updateTournament={updateTournament} onBack={() => setScreen("class")} onSettings={openSettings} notify={notify} lanRole={lanRole} joinUrl={joinUrl} />;

  return <main className="app-shell">
    <Header onMenu={openSettings} />
    <section className="hero"><div><p className="eyebrow">ESPACE D’USAGE</p><h1>Mes séances EPS</h1><p className="hero-copy">Ouvrez une classe, préparez l’appel et lancez vos tournois. Les réglages de l’application sont accessibles depuis le menu.</p></div><div className="hero-mark">🏆</div></section>
    <div className="grid home-grid">
      <section className="panel"><div className="section-title"><div><p className="eyebrow">ESPACE ENSEIGNANT</p><h2>Mes classes</h2></div><span className="count-pill">{store.classes.length}</span></div>
        {!store.classes.length && <div className="empty"><strong>Aucune classe prête pour une séance.</strong><span>Ouvrez les réglages pour créer une classe ou charger l’exemple EPS.</span><button className="primary" onClick={openSettings}>Ouvrir les réglages</button></div>}
        <div className="class-list">{store.classes.map((item) => <button className="class-card" key={item.id} onClick={() => openClass(item.id, "usage")}><span className="class-icon">{item.name.slice(0, 1).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.students.length} élève(s) · {store.tournaments.filter((t) => t.classId === item.id).length} tournoi(s) · Ouvrir la séance</small></span><span className="arrow">›</span></button>)}</div>
      </section>
      <section className="panel guide-panel"><div className="section-title"><div><p className="eyebrow">POUR COMMENCER</p><h2>Trois modes de tournoi</h2></div></div><ModeCard mode="atp" title="ATP" text="Défis par proximité de classement, points et badges." /><ModeCard mode="classic" title="Classique" text="Championnat toutes rondes, idéal pour les sports collectifs." /><ModeCard mode="poule" title="Poules" text="Répartition par terrains, matchs et montées/descentes." /><div className="offline-note">✓ 100 % local · sans abonnement · sans publicité</div></section>
    </div>
    {message && <div className="toast">{message}</div>}
  </main>;
}

function applyLanAction(store: TournamentStore, action: { type?: string; payload?: Record<string, unknown> }): TournamentStore {
  if (action.type === "delete-match") return deleteMatchAction(store, action.payload || {});
  if (action.type === "update-match") return updateMatchAction(store, action.payload || {});
  return applyMatchAction(store, action.payload || {});
}

function applyMatchAction(store: TournamentStore, payload: Record<string, unknown>): TournamentStore {
  const classId = String(payload.classId || ""); const tournamentId = String(payload.tournamentId || "");
  const match = payload.match as Match | undefined;
  if (!match || !classId || !tournamentId) return store;
  const tournament = store.tournaments.find((item) => item.id === tournamentId); const schoolClass = store.classes.find((item) => item.id === classId);
  const referee = match.refereeId ? schoolClass?.students.find((student) => student.id === match.refereeId) : undefined;
  const playersExist = schoolClass?.students.some((student) => student.id === match.playerAId) && schoolClass?.students.some((student) => student.id === match.playerBId);
  if (!tournament || tournament.classId !== classId || !schoolClass || match.tournamentId !== tournamentId || !playersExist || (match.refereeId && !referee) || !isValidMatchResult(match) || tournament.matches.some((item) => item.id === match.id)) return store;
  const tournaments = store.tournaments.map((item) => item.id === tournamentId ? { ...item, matches: [...item.matches, match] } : item);
  return { ...store, classes: store.classes.map((item) => item.id === classId ? recalculateClassStats(item, tournaments) : item), tournaments };
}

function updateMatchAction(store: TournamentStore, payload: Record<string, unknown>): TournamentStore {
  const classId = String(payload.classId || "");
  const tournamentId = String(payload.tournamentId || "");
  const match = payload.match as Match | undefined;
  if (!match || !classId || !tournamentId || match.tournamentId !== tournamentId || !isValidMatchResult(match)) return store;
  const tournament = store.tournaments.find((item) => item.id === tournamentId);
  const schoolClass = store.classes.find((item) => item.id === classId);
  const playersExist = schoolClass?.students.some((student) => student.id === match.playerAId) && schoolClass?.students.some((student) => student.id === match.playerBId);
  const refereeValid = !match.refereeId || schoolClass?.students.some((student) => student.id === match.refereeId);
  if (!tournament || tournament.classId !== classId || !schoolClass || !playersExist || !refereeValid) return store;
  const updatedTournament = replaceTournamentMatch(tournament, match);
  if (!updatedTournament) return store;
  const tournaments = store.tournaments.map((item) => item.id === tournamentId ? updatedTournament : item);
  return { ...store, classes: store.classes.map((item) => item.id === classId ? recalculateClassStats(item, tournaments) : item), tournaments };
}

function deleteMatchAction(store: TournamentStore, payload: Record<string, unknown>): TournamentStore {
  const classId = String(payload.classId || "");
  const tournamentId = String(payload.tournamentId || "");
  const matchId = String(payload.matchId || "");
  if (!classId || !tournamentId || !matchId) return store;
  const tournaments = store.tournaments.map((item) => item.id === tournamentId ? { ...item, matches: item.matches.filter((match) => match.id !== matchId) } : item);
  return { ...store, classes: store.classes.map((item) => item.id === classId ? recalculateClassStats(item, tournaments) : item), tournaments };
}

function LanPanel({ role, info, peers, joinUrl, error, nativeAvailable, onDiscover, onStart, onStop, onJoin, onJoinUrlChange }: { role: LanRole; info?: LanInfo; peers: LanPeer[]; joinUrl: string; error: string; nativeAvailable: boolean; onDiscover: () => void; onStart: () => void; onStop: () => void; onJoin: () => void; onJoinUrlChange: (value: string) => void }) {
  return <section className="lan-panel"><div className="lan-copy"><p className="eyebrow">MODE MULTI-TABLETTES</p><h2>Réseau local EPS</h2><p>Une tablette maître conserve les données et les autres tablettes se connectent directement sur le Wi‑Fi de la séance.</p><div className="lan-badges"><span className={role === "master" ? "active" : ""}>● Maître</span><span className={role === "client" ? "active" : ""}>● Cliente</span><span>● Sans Internet</span></div></div><div className="lan-actions">{role === "master" && info ? <div className="lan-share"><LanQrCode value={info.joinUrl} /><div><div className="lan-address"><small>Adresse à communiquer ou scanner</small><strong>{info.joinUrl}</strong></div><button className="secondary" onClick={onStop}>Arrêter le réseau</button></div></div> : <><button className="primary" onClick={onStart}>Démarrer comme maître</button><div className="join-row"><input value={joinUrl} onChange={(event) => onJoinUrlChange(event.target.value)} placeholder="http://192.168.x.x:8765" /><button className="secondary" onClick={onJoin}>Rejoindre</button></div><button className="discover-button" onClick={onDiscover} disabled={!nativeAvailable}>⌁ Rechercher une tablette maître</button>{!!peers.length && <div className="lan-peers">{peers.map((peer) => <button className="lan-peer" key={peer.joinUrl} onClick={() => onJoinUrlChange(peer.joinUrl)}><strong>{peer.name}</strong><small>{peer.address}:{peer.port}</small></button>)}</div>}<small className="lan-hint">{nativeAvailable ? "Recherche automatique disponible sur Android." : "Le serveur maître sera fourni par la version Android."}</small></>}{error && <span className="lan-error">{error}</span>}</div></section>;
}

function SettingsScreen({ classes, tournaments, newClassName, setNewClassName, createClass, seedDemo, onBack, onOpenClass, onExport, onImport, message, role, info, peers, joinUrl, error, nativeAvailable, onDiscover, onStart, onStop, onJoin, onJoinUrlChange }: { classes: SchoolClass[]; tournaments: Tournament[]; newClassName: string; setNewClassName: (value: string) => void; createClass: () => void; seedDemo: () => void; onBack: () => void; onOpenClass: (id: string) => void; onExport: () => void; onImport: (file: File) => void; message: string; role: LanRole; info?: LanInfo; peers: LanPeer[]; joinUrl: string; error: string; nativeAvailable: boolean; onDiscover: () => void; onStart: () => void; onStop: () => void; onJoin: () => void; onJoinUrlChange: (value: string) => void }) {
  return <main className="app-shell">
    <Header onMenu={onBack} menuLabel="← Usage" />
    <div className="subbar"><button className="back" onClick={onBack}>← Interface d’usage</button><span>Réglages de l’application</span></div>
    <section className="page-heading"><div><p className="eyebrow">MISE EN PLACE & RÉGLAGES</p><h1>Configurer Tournois EPS</h1><p>Préparez les classes, les sauvegardes et le réseau avant de revenir à l’interface de séance.</p></div></section>
    <LanPanel role={role} info={info} peers={peers} joinUrl={joinUrl} error={error} nativeAvailable={nativeAvailable} onDiscover={onDiscover} onStart={onStart} onStop={onStop} onJoin={onJoin} onJoinUrlChange={onJoinUrlChange} />
    <div className="grid content-grid">
      <section className="panel"><div className="section-title"><div><p className="eyebrow">DONNÉES DE DÉPART</p><h2>Classes et effectifs</h2></div><span className="count-pill">{classes.length}</span></div><p className="muted">Créez une classe et préparez les élèves avant d’ouvrir une séance.</p><div className="class-list">{classes.map((item) => <button className="class-card" key={item.id} onClick={() => onOpenClass(item.id)}><span className="class-icon">{item.name.slice(0, 1).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.students.length} élève(s) · {tournaments.filter((tournament) => tournament.classId === item.id).length} tournoi(s) · Configurer</small></span><span className="arrow">›</span></button>)}</div><div className="create-row"><input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createClass()} placeholder="Nom de la classe (ex. 5e B)" /><button className="primary" onClick={createClass}>+ Créer</button></div><button className="link-button" onClick={seedDemo}>Charger un exemple EPS</button></section>
      <section className="panel"><div className="section-title"><div><p className="eyebrow">SAUVEGARDES</p><h2>Exporter et intégrer</h2></div></div><p className="muted">Les données restent locales. Utilisez l’export JSON pour une sauvegarde ou un échange avec les autres applications EPS.</p><div className="settings-actions"><button className="primary" onClick={onExport}>Exporter la sauvegarde</button><label className="button-like settings-import">Importer une sauvegarde<input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ""; }} /></label></div><div className="integration-note"><strong>Bridge EPS disponible</strong><small>`window.epsTournois` expose l’état courant, l’import et les notifications de changement aux autres applications.</small></div></section>
    </div>
    {message && <div className="toast">{message}</div>}
  </main>;
}

function Header({ onMenu, menuLabel = "⚙ Réglages" }: { onMenu: () => void; menuLabel?: string }) {
  return <header className="topbar"><div className="brand"><span className="brand-dot">✦</span><span>Tournois <b>EPS</b></span></div><nav><button className="menu-button" onClick={onMenu}>{menuLabel}</button></nav></header>;
}

function ModeCard({ mode, title, text }: { mode: TournamentMode; title: string; text: string }) {
  return <div className={`mode-card ${mode}`}><span>{mode === "atp" ? "↗" : mode === "poule" ? "◫" : "⇄"}</span><div><strong>Mode {title}</strong><small>{text}</small></div></div>;
}

function ClassScreen({ classItem, tournaments, view, studentText, setStudentText, addStudents, updateClass, onBack, onOpenSetup, onOpenUsage, onSettings, onOpenTournament, mode, setMode, sport, setSport, tournamentName, setTournamentName, createTournament }: { classItem: SchoolClass; tournaments: Tournament[]; view: "usage" | "setup"; studentText: string; setStudentText: (value: string) => void; addStudents: () => void; updateClass: (item: SchoolClass) => void; onBack: () => void; onOpenSetup: () => void; onOpenUsage: () => void; onSettings: () => void; onOpenTournament: (id: string) => void; mode: TournamentMode; setMode: (mode: TournamentMode) => void; sport: Sport; setSport: (sport: Sport) => void; tournamentName: string; setTournamentName: (value: string) => void; createTournament: () => void }) {
  const [tab, setTab] = useState<"overview" | "students" | "attendance">(view === "setup" ? "students" : "overview");
  useEffect(() => { setTab(view === "setup" ? "students" : "overview"); }, [view]);
  const presentCount = classItem.students.filter((student) => student.status === "present").length;
  const performance = getClassPerformance(classItem);
  const toggleStatus = (student: Student, status: StudentStatus) => updateClass({ ...classItem, students: classItem.students.map((item) => item.id === student.id ? { ...item, status } : item) });
  const tabs = view === "setup" ? ([['students', 'Élèves'], ['attendance', 'Appel du jour']] as const) : ([['overview', 'Tournois'], ['attendance', 'Appel du jour']] as const);
  return <main className="app-shell"><Header onMenu={onSettings} /><div className="subbar"><button className="back" onClick={onBack}>{view === "setup" ? "← Réglages" : "← Accueil"}</button><span>{classItem.name}</span><span className="subbar-stat">{presentCount}/{classItem.students.length} présents</span><button className="secondary subbar-action" onClick={view === "setup" ? onOpenUsage : onOpenSetup}>{view === "setup" ? "Voir les séances" : "Réglages de la classe"}</button></div><section className="page-heading"><div><p className="eyebrow">{view === "setup" ? "MISE EN PLACE" : "USAGE DE LA CLASSE"}</p><h1>{classItem.name}</h1><p>{view === "setup" ? "Préparez l’effectif et la protection de la classe avant la séance." : "Faites l’appel, ouvrez une séance et suivez les tournois de la classe."}</p></div></section><div className="tabs">{tabs.map(([value, label]) => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === "overview" && <><div className="grid content-grid"><section className="panel"><div className="section-title"><div><p className="eyebrow">NOUVEAU</p><h2>Lancer un tournoi</h2></div></div><input className="wide-input" value={tournamentName} onChange={(event) => setTournamentName(event.target.value)} placeholder="Nom de la séance (facultatif)" /><label className="sport-picker">Activité<select value={sport} onChange={(event) => setSport(event.target.value as Sport)}><option value="badminton">Badminton</option><option value="tennis-table">Tennis de table</option><option value="autre">Autre activité</option></select></label><div className="mode-selector">{([["classic", "Classique", "Championnat toutes rondes"], ["atp", "ATP", "Défis et classement"], ["poule", "Poules", "Terrains et groupes"]] as const).map(([value, label, desc]) => <button className={mode === value ? "selected" : ""} key={value} onClick={() => setMode(value)}><b>{label}</b><small>{desc}</small></button>)}</div><button className="primary full" onClick={createTournament}>Créer le tournoi</button></section><section className="panel"><div className="section-title"><div><p className="eyebrow">HISTORIQUE</p><h2>Mes tournois</h2></div><span className="count-pill">{tournaments.length}</span></div>{!tournaments.length && <div className="empty"><span>Les séances créées apparaîtront ici.</span></div>}{tournaments.map((tournament) => <button className="tournament-row" key={tournament.id} onClick={() => onOpenTournament(tournament.id)}><span className={`mode-badge ${tournament.mode}`}>{tournament.mode.toUpperCase()}</span><span><strong>{tournament.name}</strong><small>{tournament.matches.length} match(s) · {new Date(tournament.createdAt).toLocaleDateString("fr-FR")}</small></span><span className="arrow">›</span></button>)}</section></div><ClassInsights performance={performance} /></>}
    {tab === "students" && <section className="panel single-panel"><div className="section-title"><div><p className="eyebrow">EFFECTIF</p><h2>Élèves</h2></div><span className="count-pill">{classItem.students.length}</span></div><div className="add-students"><textarea value={studentText} onChange={(event) => setStudentText(event.target.value)} placeholder="Collez une liste : un élève par ligne" /><button className="primary" onClick={addStudents}>Ajouter</button></div><StudentTable students={classItem.students} updateClass={updateClass} classItem={classItem} /><SecurityPanel classItem={classItem} updateClass={updateClass} /></section>}
    {tab === "attendance" && <section className="panel single-panel"><div className="section-title"><div><p className="eyebrow">PRÉSENCES</p><h2>Appel du jour</h2></div><span className="count-pill">{presentCount} présents</span></div><p className="muted">Les absents et non-pratiquants sont exclus des nouveaux tirages de poules.</p><div className="attendance-list">{classItem.students.map((student) => <div className="attendance-row" key={student.id}><span className="student-avatar">{student.name.slice(0, 1)}</span><strong>{student.name}</strong><div className="attendance-actions"><button className={student.status === "present" ? "chosen present" : ""} onClick={() => toggleStatus(student, "present")}>Présent</button><button className={student.status === "absent" ? "chosen absent" : ""} onClick={() => toggleStatus(student, "absent")}>Absent</button><button className={student.status === "non-pratiquant" ? "chosen neutral" : ""} onClick={() => toggleStatus(student, "non-pratiquant")}>N.P.</button></div></div>)}</div></section>}
  </main>;
}

function SecurityPanel({ classItem, updateClass }: { classItem: SchoolClass; updateClass: (item: SchoolClass) => void }) {
  const [pin, setPin] = useState(classItem.exitPin || "");
  return <section className="security-panel"><div><p className="eyebrow">PROTECTION</p><strong>Mode élève sécurisé</strong><small>Un code PIN protège le retour aux réglages professeur.</small></div><div className="security-form"><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="PIN à 4–6 chiffres" /><button className="secondary" onClick={() => updateClass({ ...classItem, exitPin: pin || undefined })}>Enregistrer</button></div></section>;
}

function StudentTable({ students, classItem, updateClass }: { students: Student[]; classItem: SchoolClass; updateClass: (item: SchoolClass) => void }) {
  return <div className="student-list">{students.map((student) => <div className="student-row" key={student.id}><span className="student-avatar">{student.name.slice(0, 1)}</span><input value={student.name} onChange={(event) => updateClass({ ...classItem, students: students.map((item) => item.id === student.id ? { ...item, name: event.target.value } : item) })} /><select className="compact-select" value={student.gender || ""} aria-label={`Genre de ${student.name}`} onChange={(event) => updateClass({ ...classItem, students: students.map((item) => item.id === student.id ? { ...item, gender: event.target.value as Student["gender"] } : item) })}><option value="">—</option><option value="F">F</option><option value="G">G</option></select><label className="level-input">Niv.<input type="number" min="1" max="5" value={student.level} onChange={(event) => updateClass({ ...classItem, students: students.map((item) => item.id === student.id ? { ...item, level: Math.min(5, Math.max(1, Number(event.target.value) || 1)) } : item) })} /></label><span className="level">{student.points} pt</span><button className="icon-button" title="Supprimer" onClick={() => updateClass({ ...classItem, students: students.filter((item) => item.id !== student.id) })}>×</button></div>)}{!students.length && <div className="empty"><span>Ajoutez les élèves pour commencer.</span></div>}</div>;
}

function ClassInsights({ performance }: { performance: ReturnType<typeof getClassPerformance> }) {
  const totalMatches = performance.reduce((total, student) => total + student.matches, 0) / 2;
  const totalRefereed = performance.reduce((total, student) => total + student.refereed, 0);
  return <section className="panel insights-panel"><div className="section-title"><div><p className="eyebrow">BILAN PÉDAGOGIQUE</p><h2>Statistiques de classe</h2></div><span className="count-pill">{Math.round(totalMatches)} matchs</span></div><div className="insight-cards"><div><strong>{performance.filter((student) => student.wins > 0).length}</strong><small>élève(s) victorieux</small></div><div><strong>{totalRefereed}</strong><small>arbitrage(s)</small></div><div><strong>{performance.reduce((total, student) => total + student.badges.length, 0)}</strong><small>badge(s) obtenus</small></div></div><div className="insight-list">{performance.slice(0, 5).map((student) => <div key={student.id}><span className="student-avatar">{student.name.slice(0, 1)}</span><strong>{student.name}</strong><small>{student.winRate}% de victoires · {student.badges.slice(0, 2).join(" · ") || "Pas encore de badge"}</small><b>{student.points} pts</b></div>)}</div></section>;
}

function TournamentSettings({ tournament, updateTournament }: { tournament: Tournament; updateTournament: (item: Tournament) => void }) {
  const updateNumber = (field: "pointsWin" | "pointsLoss" | "maxRankDiff" | "courtCount" | "groupSize" | "targetScore", value: string, minimum: number) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) updateTournament({ ...tournament, [field]: Math.max(minimum, Math.floor(parsed)) });
  };
  return <div className="tournament-settings"><div className="settings-title"><strong>Paramètres de séance</strong><small>Modifiables selon le niveau et le matériel disponible.</small></div><label>Victoire<input type="number" min="0" value={tournament.pointsWin} onChange={(event) => updateNumber("pointsWin", event.target.value, 0)} /></label><label>Défaite<input type="number" min="0" value={tournament.pointsLoss} onChange={(event) => updateNumber("pointsLoss", event.target.value, 0)} /></label><label>Écart ATP<input type="number" min="0" value={tournament.maxRankDiff} onChange={(event) => updateNumber("maxRankDiff", event.target.value, 0)} /></label><label>Terrains<input type="number" min="1" value={tournament.courtCount} onChange={(event) => updateNumber("courtCount", event.target.value, 1)} /></label><label>Taille poule<input type="number" min="2" value={tournament.groupSize} onChange={(event) => updateNumber("groupSize", event.target.value, 2)} /></label><label>Format<select value={tournament.matchFormat} onChange={(event) => { const nextFormat = event.target.value as Tournament["matchFormat"]; updateTournament({ ...tournament, matchFormat: nextFormat, targetScore: nextFormat === "flash" ? 11 : 21 }); }}><option value="normal">Normal</option><option value="flash">Flash</option></select></label><label>Score cible<input type="number" min="1" value={getTargetScore(tournament.matchFormat, tournament.targetScore)} onChange={(event) => updateNumber("targetScore", event.target.value, 1)} /></label></div>;
}

function TournamentScreen({ classItem, tournament, allTournaments, updateClass, updateTournament, onBack, onSettings, notify, lanRole, joinUrl }: { classItem: SchoolClass; tournament: Tournament; allTournaments: Tournament[]; updateClass: (item: SchoolClass) => void; updateTournament: (item: Tournament) => void; onBack: () => void; onSettings: () => void; notify: (text: string) => void; lanRole: LanRole; joinUrl: string }) {
  const [playerAId, setPlayerAId] = useState("");
  const [playerBId, setPlayerBId] = useState("");
  const [refereeId, setRefereeId] = useState("");
  const [scoreA, setScoreA] = useState("21");
  const [scoreB, setScoreB] = useState("15");
  const [studentMode, setStudentMode] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string>();
  const activeStudents = classItem.students.filter((student) => student.status === "present");
  const playerOptions = editingMatchId ? classItem.students : activeStudents;
  const refereeOptions = editingMatchId ? classItem.students : activeStudents;
  const ranking = useMemo(() => [...classItem.students].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name)), [classItem.students]);
  const activeRanking = useMemo(() => ranking.filter((student) => student.status === "present"), [ranking]);
  const rankingPosition = useMemo(() => new Map(activeRanking.map((student, index) => [student.id, index])), [activeRanking]);
  const fixtures = useMemo(() => { if (tournament.mode !== "classic") return []; const done = new Set(tournament.matches.flatMap((match) => [`${match.playerAId}:${match.playerBId}`, `${match.playerBId}:${match.playerAId}`])); return activeStudents.flatMap((a, i) => activeStudents.slice(i + 1).filter((b) => !done.has(`${a.id}:${b.id}`)).map((b) => [a, b] as const)); }, [activeStudents, tournament]);
  const groups = useMemo(() => tournament.mode === "poule" ? splitIntoGroups(activeStudents, tournament.groupSize) : [], [activeStudents, tournament]);
  const atpSuggestions = useMemo(() => {
    if (tournament.mode !== "atp" || !playerAId) return [];
    const played = new Set(tournament.matches.flatMap((match) => [`${match.playerAId}:${match.playerBId}`, `${match.playerBId}:${match.playerAId}`]));
    const playerRank = rankingPosition.get(playerAId);
    if (playerRank === undefined) return [];
    return activeRanking.filter((student) => student.id !== playerAId && Math.abs((rankingPosition.get(student.id) ?? playerRank) - playerRank) <= tournament.maxRankDiff && !played.has(`${playerAId}:${student.id}`)).slice(0, 5);
  }, [activeRanking, playerAId, rankingPosition, tournament]);

  const recordMatch = () => {
    const a = classItem.students.find((student) => student.id === playerAId);
    const b = classItem.students.find((student) => student.id === playerBId);
    const sa = Number(scoreA); const sb = Number(scoreB);
    if (!a || !b || !isValidMatchResult({ playerAId: a.id, playerBId: b.id, scoreA: sa, scoreB: sb })) { notify("Sélectionnez deux joueurs et un score gagnant"); return; }
    if (tournament.mode === "atp") {
      const rankA = rankingPosition.get(a.id); const rankB = rankingPosition.get(b.id);
      if (!isAtpMatchAllowed(rankA, rankB, tournament.maxRankDiff)) { notify(`En ATP, l’écart maximum est de ${tournament.maxRankDiff} place(s)`); return; }
    }
    const previousMatch = editingMatchId ? tournament.matches.find((item) => item.id === editingMatchId) : undefined;
    const match: Match = { ...(previousMatch || {}), id: previousMatch?.id || uid("match"), tournamentId: tournament.id, playerAId: a.id, playerBId: b.id, scoreA: sa, scoreB: sb, refereeId: refereeId || undefined, playedAt: previousMatch?.playedAt || new Date().toISOString(), court: previousMatch?.court ?? (tournament.mode === "poule" ? getPouleCourt(tournament.matches.length, tournament.courtCount) : undefined) };
    const nextTournament = previousMatch ? replaceTournamentMatch(tournament, match) : { ...tournament, matches: [...tournament.matches, match] };
    if (!nextTournament) { notify("Ce match n'existe plus dans la séance"); return; }
    const nextTournaments = allTournaments.map((item) => item.id === tournament.id ? nextTournament : item);
    updateClass(recalculateClassStats(classItem, nextTournaments)); updateTournament(nextTournament);
    if (lanRole === "client" && joinUrl) {
      const action: LanAction = { id: editingMatchId ? uid("update") : match.id, type: editingMatchId ? "update-match" : "record-match", payload: { classId: classItem.id, tournamentId: tournament.id, match } };
      sendLanAction(joinUrl, action).catch(() => { queueLanAction(joinUrl, action); notify("Match enregistré localement, en attente du maître"); });
    }
    setPlayerAId(""); setPlayerBId(""); setRefereeId(""); setEditingMatchId(undefined); notify(lanRole === "client" ? (editingMatchId ? "Correction envoyée à la tablette maître" : "Match envoyé à la tablette maître") : (editingMatchId ? "Match corrigé et classement mis à jour" : "Match enregistré et classement mis à jour"));
  };
  const editMatch = (match: Match) => {
    setEditingMatchId(match.id); setPlayerAId(match.playerAId); setPlayerBId(match.playerBId); setRefereeId(match.refereeId || ""); setScoreA(String(match.scoreA)); setScoreB(String(match.scoreB));
  };
  const cancelEdit = () => { setEditingMatchId(undefined); setPlayerAId(""); setPlayerBId(""); setRefereeId(""); };
  const deleteMatch = (matchId: string) => {
    if (!window.confirm("Annuler ce match et recalculer le classement ?")) return;
    const nextTournament = { ...tournament, matches: tournament.matches.filter((match) => match.id !== matchId) };
    const nextTournaments = allTournaments.map((item) => item.id === tournament.id ? nextTournament : item);
    updateClass(recalculateClassStats(classItem, nextTournaments)); updateTournament(nextTournament); if (editingMatchId === matchId) cancelEdit();
    if (lanRole === "client" && joinUrl) {
      const action: LanAction = { id: `delete-${matchId}`, type: "delete-match", payload: { classId: classItem.id, tournamentId: tournament.id, matchId } };
      sendLanAction(joinUrl, action).catch(() => { queueLanAction(joinUrl, action); notify("Annulation en attente du maître"); });
    }
    notify("Match annulé et classement recalculé");
  };
  const studentName = (id: string) => classItem.students.find((student) => student.id === id)?.name || "—";
  const exitStudentMode = () => {
    const expectedPin = classItem.exitPin;
    if (!expectedPin || window.prompt("Code PIN professeur") === expectedPin) setStudentMode(false);
  };
  return <main className="app-shell">{!studentMode && <Header onMenu={onSettings} />}<div className="subbar"><button className="back" onClick={studentMode ? exitStudentMode : onBack}>{studentMode ? "🔒 Quitter le mode élève" : `← ${classItem.name}`}</button><span>{tournament.name}</span><span className={`mode-badge ${tournament.mode}`}>{tournament.mode.toUpperCase()}</span></div><section className="page-heading tournament-heading"><div><p className="eyebrow">{tournament.mode === "atp" ? "DÉFIS & CLASSEMENT" : tournament.mode === "poule" ? "TERRAINS & POULES" : "CHAMPIONNAT"}</p><h1>{tournament.name}</h1><p>{tournament.matches.length} match(s) enregistré(s) · {tournament.sport === "tennis-table" ? "Tennis de table" : tournament.sport === "autre" ? "Autre activité" : "Badminton"} · score cible {getTargetScore(tournament.matchFormat, tournament.targetScore)}</p></div><div className="heading-actions">{!studentMode && <button className="secondary" onClick={() => setStudentMode(true)}>Mode élève</button>}<button className="secondary" onClick={() => window.print()}>Imprimer / PDF</button></div></section><div className="grid tournament-grid"><section className="panel"><div className="section-title"><div><p className="eyebrow">SAISIE RAPIDE</p><h2>{editingMatchId ? "Corriger un match" : "Enregistrer un match"}</h2></div></div><div className="match-form"><select value={playerAId} onChange={(event) => setPlayerAId(event.target.value)}><option value="">Joueur A</option>{playerOptions.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select>{tournament.mode === "atp" && <div className="atp-suggestions">{atpSuggestions.length ? <><small>Adversaires compatibles avec l’écart configuré :</small><div>{atpSuggestions.map((student) => <button className="suggestion" key={student.id} onClick={() => setPlayerBId(student.id)}>{student.name}</button>)}</div></> : <small>{playerAId ? "Aucun adversaire non joué dans l’écart configuré." : "Choisissez Joueur A pour voir les défis compatibles."}</small>}</div>}<span className="versus">VS</span><select value={playerBId} onChange={(event) => setPlayerBId(event.target.value)}><option value="">Joueur B</option>{playerOptions.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select><div className="scores"><input type="number" min="0" value={scoreA} onChange={(event) => setScoreA(event.target.value)} /><b>—</b><input type="number" min="0" value={scoreB} onChange={(event) => setScoreB(event.target.value)} /></div><select value={refereeId} onChange={(event) => setRefereeId(event.target.value)}><option value="">Arbitre (facultatif)</option>{refereeOptions.filter((student) => student.id !== playerAId && student.id !== playerBId).map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select><div className="match-form-actions"><button className="primary full" onClick={recordMatch}>{editingMatchId ? "Enregistrer la correction" : "Valider le match"}</button>{editingMatchId && <button className="secondary full" onClick={cancelEdit}>Annuler la correction</button>}</div></div><div className="match-history"><h3>Historique de la séance</h3>{tournament.matches.length > 0 && <button className="link-button" onClick={() => deleteMatch(tournament.matches[tournament.matches.length - 1].id)}>Annuler le dernier match</button>}{!tournament.matches.length && <p className="muted">Aucun match enregistré.</p>}{[...tournament.matches].reverse().map((match) => <div className="history-row" key={match.id}><span>{studentName(match.playerAId)} <b>{match.scoreA}–{match.scoreB}</b> {studentName(match.playerBId)}</span><div className="history-actions">{!studentMode && <button className="link-button" onClick={() => editMatch(match)}>Modifier</button>}<small>{new Date(match.playedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</small></div></div>)}</div></section><section className="panel"><div className="section-title"><div><p className="eyebrow">CLASSEMENT EN DIRECT</p><h2>Classement</h2></div></div><div className="ranking-list">{ranking.map((student, index) => <div className="ranking-row" key={student.id}><span className={`rank ${index < 3 ? "podium" : ""}`}>{index + 1}</span><span className="student-avatar">{student.name.slice(0, 1)}</span><span className="rank-name"><strong>{student.name}</strong><small>{student.wins} V · {student.losses} D · {student.refereed} arb.</small></span><b className="points">{student.points} <small>pts</small></b></div>)}</div></section></div>{!studentMode && <section className="panel planning-panel"><div className="section-title"><div><p className="eyebrow">ORGANISATION</p><h2>{tournament.mode === "poule" ? "Répartition des poules" : tournament.mode === "classic" ? "Matchs à venir" : "Règles ATP"}</h2></div></div><TournamentSettings tournament={tournament} updateTournament={updateTournament} />{tournament.mode === "poule" && <div className="group-grid">{groups.map((group, index) => <div className="group-card" key={index}><strong>Terrain {(index % tournament.courtCount) + 1} · Poule {Math.floor(index / tournament.courtCount) + 1}</strong>{group.map((student) => <span key={student.id}>{student.name}</span>)}</div>)}{!groups.length && <p className="muted">Ajoutez des élèves présents pour générer les poules.</p>}</div>}{tournament.mode === "classic" && <div className="fixture-grid">{fixtures.slice(0, 12).map(([a, b]) => <span key={`${a.id}-${b.id}`}>{a.name} <b>vs</b> {b.name}</span>)}{!fixtures.length && <p className="muted">Tous les matchs disponibles sont joués.</p>}</div>}{tournament.mode === "atp" && <div className="rules-strip"><span>Victoire <b>+{tournament.pointsWin} pts</b></span><span>Défaite <b>+{tournament.pointsLoss} pt</b></span><span>Écart max <b>{tournament.maxRankDiff} places</b></span></div>}</section>}</main>;
}

export default App;
