import { useEffect, useMemo, useState } from "react";
import { uid } from "./domain/ids";
import type { Match, SchoolClass, Student, StudentStatus, Tournament, TournamentMode, TournamentStore } from "./domain/types";
import { exportStore, importStore, loadStore, saveStore } from "./storage";
import { installIntegrationBridge } from "./integration";
import { fetchLanState, hasNativeLanHost, publishLanState, readLanActions, sendLanAction, startLanHost, stopLanHost, type LanInfo, type LanRole } from "./lan";
import { LanQrCode } from "./LanQrCode";

const sampleNames = ["Camille", "Noah", "Jules", "Inès", "Lina", "Hugo", "Zoé", "Louis"];
const newStudent = (name: string): Student => ({ id: uid("student"), name, level: 3, status: "present", points: 0, matches: 0, wins: 0, losses: 0, refereed: 0 });

function App() {
  const [store, setStore] = useState<TournamentStore>(() => loadStore());
  const [screen, setScreen] = useState<"home" | "class" | "tournament">("home");
  const [classId, setClassId] = useState<string>();
  const [tournamentId, setTournamentId] = useState<string>();
  const [newClassName, setNewClassName] = useState("");
  const [studentText, setStudentText] = useState("");
  const [mode, setMode] = useState<TournamentMode>("classic");
  const [tournamentName, setTournamentName] = useState("");
  const [message, setMessage] = useState("");
  const [lanRole, setLanRole] = useState<LanRole>("standalone");
  const [lanInfo, setLanInfo] = useState<LanInfo>();
  const [joinUrl, setJoinUrl] = useState("");
  const [lanError, setLanError] = useState("");
  const [lanActionCursor, setLanActionCursor] = useState(0);

  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => { installIntegrationBridge(() => store, (snapshot) => setStore(snapshot)); }, [store]);
  useEffect(() => {
    if (lanRole !== "master" || !lanInfo) return;
    publishLanState(store).catch((error) => setLanError(error instanceof Error ? error.message : "Publication locale impossible"));
  }, [store, lanInfo, lanRole]);
  useEffect(() => {
    if (lanRole !== "client" || !joinUrl) return;
    let cancelled = false;
    const poll = async () => { try { const snapshot = await fetchLanState(joinUrl); if (!cancelled) setStore(snapshot); setLanError(""); } catch (error) { if (!cancelled) setLanError(error instanceof Error ? error.message : "Connexion locale interrompue"); } };
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
          if (!cancelled && action.type === "record-match" && action.payload) setStore((current) => applyMatchAction(current, action.payload!));
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
  const openClass = (id: string) => { setClassId(id); setScreen("class"); };
  const openTournament = (id: string) => { setTournamentId(id); setScreen("tournament"); };

  const createClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const item: SchoolClass = { id: uid("class"), name, students: [], createdAt: new Date().toISOString() };
    setStore((current) => ({ ...current, classes: [...current.classes, item] }));
    setNewClassName(""); openClass(item.id);
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
    const item: Tournament = { id: uid("tournament"), classId: activeClass.id, name: tournamentName.trim() || `Tournoi ${mode === "atp" ? "ATP" : mode === "poule" ? "Poules" : "Classique"}`, mode, createdAt: new Date().toISOString(), pointsWin: 3, pointsLoss: 1, maxRankDiff: 3, courtCount: 2, groupSize: 4, matchFormat: "normal", matches: [] };
    setStore((current) => ({ ...current, tournaments: [...current.tournaments, item] }));
    setTournamentName(""); openTournament(item.id);
  };

  const seedDemo = () => {
    const demoClass: SchoolClass = { id: uid("class"), name: "4e EPS — Démonstration", createdAt: new Date().toISOString(), students: sampleNames.map(newStudent) };
    const demoTournament: Tournament = { id: uid("tournament"), classId: demoClass.id, name: "Badminton — séance 1", mode: "poule", createdAt: new Date().toISOString(), pointsWin: 3, pointsLoss: 1, maxRankDiff: 3, courtCount: 2, groupSize: 4, matchFormat: "normal", matches: [] };
    setStore((current) => ({ ...current, classes: [...current.classes, demoClass], tournaments: [...current.tournaments, demoTournament] }));
    openTournament(demoTournament.id); notify("Exemple EPS ajouté");
  };

  if (screen === "class" && activeClass) return <ClassScreen classItem={activeClass} tournaments={store.tournaments.filter((item) => item.classId === activeClass.id)} studentText={studentText} setStudentText={setStudentText} addStudents={addStudents} updateClass={updateClass} onBack={() => setScreen("home")} onOpenTournament={openTournament} mode={mode} setMode={setMode} tournamentName={tournamentName} setTournamentName={setTournamentName} createTournament={createTournament} />;
  if (screen === "tournament" && activeClass && activeTournament) return <TournamentScreen classItem={activeClass} tournament={activeTournament} updateClass={updateClass} updateTournament={updateTournament} onBack={() => setScreen("class")} notify={notify} lanRole={lanRole} joinUrl={joinUrl} />;

  return <main className="app-shell">
    <Header onExport={() => exportStore(store)} onImport={async (file) => { try { setStore(await importStore(file)); notify("Sauvegarde importée"); } catch (error) { notify(error instanceof Error ? error.message : "Import impossible"); } }} />
    <section className="hero"><div><p className="eyebrow">OUTIL EPS INDÉPENDANT</p><h1>Tournois EPS</h1><p className="hero-copy">Organisez vos classes, matchs et classements sur téléphone, tablette ou ordinateur. Les données restent dans l’application.</p></div><div className="hero-mark">🏆</div></section>
    <LanPanel role={lanRole} info={lanInfo} joinUrl={joinUrl} error={lanError} nativeAvailable={hasNativeLanHost()} onStart={async () => { try { const info = await startLanHost(); setLanInfo(info); setLanRole("master"); setLanError(""); notify("Tablette maître active sur le réseau local"); } catch (error) { setLanError(error instanceof Error ? error.message : "Impossible de démarrer le réseau local"); } }} onStop={async () => { await stopLanHost(); setLanInfo(undefined); setLanRole("standalone"); notify("Mode local arrêté"); }} onJoin={async () => { try { const snapshot = await fetchLanState(joinUrl.trim()); setStore(snapshot); setLanRole("client"); setLanError(""); notify("Tablette connectée à la séance"); } catch (error) { setLanError(error instanceof Error ? error.message : "Connexion locale impossible"); } }} onJoinUrlChange={setJoinUrl} />
    <div className="grid home-grid">
      <section className="panel"><div className="section-title"><div><p className="eyebrow">ESPACE ENSEIGNANT</p><h2>Mes classes</h2></div><span className="count-pill">{store.classes.length}</span></div>
        {!store.classes.length && <div className="empty"><strong>Aucune classe pour le moment.</strong><span>Créez une classe ou chargez l’exemple EPS.</span></div>}
        <div className="class-list">{store.classes.map((item) => <button className="class-card" key={item.id} onClick={() => openClass(item.id)}><span className="class-icon">{item.name.slice(0, 1).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.students.length} élève(s) · {store.tournaments.filter((t) => t.classId === item.id).length} tournoi(s)</small></span><span className="arrow">›</span></button>)}</div>
        <div className="create-row"><input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createClass()} placeholder="Nom de la classe (ex. 5e B)" /><button className="primary" onClick={createClass}>+ Créer</button></div>
        <button className="link-button" onClick={seedDemo}>Charger un exemple EPS</button>
      </section>
      <section className="panel guide-panel"><div className="section-title"><div><p className="eyebrow">POUR COMMENCER</p><h2>Trois modes de tournoi</h2></div></div><ModeCard mode="atp" title="ATP" text="Défis par proximité de classement, points et badges." /><ModeCard mode="classic" title="Classique" text="Championnat toutes rondes, idéal pour les sports collectifs." /><ModeCard mode="poule" title="Poules" text="Répartition par terrains, matchs et montées/descentes." /><div className="offline-note">✓ 100 % local · sans abonnement · sans publicité</div></section>
    </div>
    {message && <div className="toast">{message}</div>}
  </main>;
}

function applyMatchAction(store: TournamentStore, payload: Record<string, unknown>): TournamentStore {
  const classId = String(payload.classId || ""); const tournamentId = String(payload.tournamentId || "");
  const match = payload.match as Match | undefined; const winnerId = String(payload.winnerId || ""); const loserId = String(payload.loserId || ""); const refereeId = payload.refereeId ? String(payload.refereeId) : "";
  if (!match || !classId || !tournamentId) return store;
  const tournament = store.tournaments.find((item) => item.id === tournamentId); const schoolClass = store.classes.find((item) => item.id === classId);
  if (!tournament || !schoolClass || tournament.matches.some((item) => item.id === match.id)) return store;
  const students = schoolClass.students.map((student) => {
    if (student.id === winnerId) return { ...student, points: student.points + tournament.pointsWin, matches: student.matches + 1, wins: student.wins + 1 };
    if (student.id === loserId) return { ...student, points: student.points + tournament.pointsLoss, matches: student.matches + 1, losses: student.losses + 1 };
    if (refereeId && student.id === refereeId) return { ...student, points: student.points + 1, refereed: student.refereed + 1 };
    return student;
  });
  return { ...store, classes: store.classes.map((item) => item.id === classId ? { ...item, students } : item), tournaments: store.tournaments.map((item) => item.id === tournamentId ? { ...item, matches: [...item.matches, match] } : item) };
}

function LanPanel({ role, info, joinUrl, error, nativeAvailable, onStart, onStop, onJoin, onJoinUrlChange }: { role: LanRole; info?: LanInfo; joinUrl: string; error: string; nativeAvailable: boolean; onStart: () => void; onStop: () => void; onJoin: () => void; onJoinUrlChange: (value: string) => void }) {
  return <section className="lan-panel"><div className="lan-copy"><p className="eyebrow">MODE MULTI-TABLETTES</p><h2>Réseau local EPS</h2><p>Une tablette maître conserve les données et les autres tablettes se connectent directement sur le Wi‑Fi de la séance.</p><div className="lan-badges"><span className={role === "master" ? "active" : ""}>● Maître</span><span className={role === "client" ? "active" : ""}>● Cliente</span><span>● Sans Internet</span></div></div><div className="lan-actions">{role === "master" && info ? <div className="lan-share"><LanQrCode value={info.joinUrl} /><div><div className="lan-address"><small>Adresse à communiquer ou scanner</small><strong>{info.joinUrl}</strong></div><button className="secondary" onClick={onStop}>Arrêter le réseau</button></div></div> : <><button className="primary" onClick={onStart}>Démarrer comme maître</button><div className="join-row"><input value={joinUrl} onChange={(event) => onJoinUrlChange(event.target.value)} placeholder="http://192.168.x.x:8765" /><button className="secondary" onClick={onJoin}>Rejoindre</button></div><small className="lan-hint">{nativeAvailable ? "Serveur local Android disponible." : "Le serveur maître sera fourni par la version Android."}</small></>}{error && <span className="lan-error">{error}</span>}</div></section>;
}

function Header({ onExport, onImport }: { onExport: () => void; onImport: (file: File) => void }) {
  return <header className="topbar"><div className="brand"><span className="brand-dot">✦</span><span>Tournois <b>EPS</b></span></div><nav><button onClick={onExport}>Exporter</button><label className="button-like">Importer<input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ""; }} /></label></nav></header>;
}

function ModeCard({ mode, title, text }: { mode: TournamentMode; title: string; text: string }) {
  return <div className={`mode-card ${mode}`}><span>{mode === "atp" ? "↗" : mode === "poule" ? "◫" : "⇄"}</span><div><strong>Mode {title}</strong><small>{text}</small></div></div>;
}

function ClassScreen({ classItem, tournaments, studentText, setStudentText, addStudents, updateClass, onBack, onOpenTournament, mode, setMode, tournamentName, setTournamentName, createTournament }: { classItem: SchoolClass; tournaments: Tournament[]; studentText: string; setStudentText: (value: string) => void; addStudents: () => void; updateClass: (item: SchoolClass) => void; onBack: () => void; onOpenTournament: (id: string) => void; mode: TournamentMode; setMode: (mode: TournamentMode) => void; tournamentName: string; setTournamentName: (value: string) => void; createTournament: () => void }) {
  const [tab, setTab] = useState<"overview" | "students" | "attendance">("overview");
  const presentCount = classItem.students.filter((student) => student.status === "present").length;
  const toggleStatus = (student: Student, status: StudentStatus) => updateClass({ ...classItem, students: classItem.students.map((item) => item.id === student.id ? { ...item, status } : item) });
  return <main className="app-shell"><Header onExport={() => {}} onImport={() => {}} /><div className="subbar"><button className="back" onClick={onBack}>← Accueil</button><span>{classItem.name}</span><span className="subbar-stat">{presentCount}/{classItem.students.length} présents</span></div><section className="page-heading"><div><p className="eyebrow">GESTION DE CLASSE</p><h1>{classItem.name}</h1><p>Préparez l’effectif puis lancez un tournoi adapté à votre séance.</p></div></section><div className="tabs">{([["overview", "Tournois"], ["students", "Élèves"], ["attendance", "Appel du jour"]] as const).map(([value, label]) => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === "overview" && <><div className="grid content-grid"><section className="panel"><div className="section-title"><div><p className="eyebrow">NOUVEAU</p><h2>Lancer un tournoi</h2></div></div><input className="wide-input" value={tournamentName} onChange={(event) => setTournamentName(event.target.value)} placeholder="Nom de la séance (facultatif)" /><div className="mode-selector">{([["classic", "Classique", "Championnat toutes rondes"], ["atp", "ATP", "Défis et classement"], ["poule", "Poules", "Terrains et groupes"]] as const).map(([value, label, desc]) => <button className={mode === value ? "selected" : ""} key={value} onClick={() => setMode(value)}><b>{label}</b><small>{desc}</small></button>)}</div><button className="primary full" onClick={createTournament}>Créer le tournoi</button></section><section className="panel"><div className="section-title"><div><p className="eyebrow">HISTORIQUE</p><h2>Mes tournois</h2></div><span className="count-pill">{tournaments.length}</span></div>{!tournaments.length && <div className="empty"><span>Les séances créées apparaîtront ici.</span></div>}{tournaments.map((tournament) => <button className="tournament-row" key={tournament.id} onClick={() => onOpenTournament(tournament.id)}><span className={`mode-badge ${tournament.mode}`}>{tournament.mode.toUpperCase()}</span><span><strong>{tournament.name}</strong><small>{tournament.matches.length} match(s) · {new Date(tournament.createdAt).toLocaleDateString("fr-FR")}</small></span><span className="arrow">›</span></button>)}</section></div><SecurityPanel classItem={classItem} updateClass={updateClass} /></>}
    {tab === "students" && <section className="panel single-panel"><div className="section-title"><div><p className="eyebrow">EFFECTIF</p><h2>Élèves</h2></div><span className="count-pill">{classItem.students.length}</span></div><div className="add-students"><textarea value={studentText} onChange={(event) => setStudentText(event.target.value)} placeholder="Collez une liste : un élève par ligne" /><button className="primary" onClick={addStudents}>Ajouter</button></div><StudentTable students={classItem.students} updateClass={updateClass} classItem={classItem} /></section>}
    {tab === "attendance" && <section className="panel single-panel"><div className="section-title"><div><p className="eyebrow">PRÉSENCES</p><h2>Appel du jour</h2></div><span className="count-pill">{presentCount} présents</span></div><p className="muted">Les absents et non-pratiquants sont exclus des nouveaux tirages de poules.</p><div className="attendance-list">{classItem.students.map((student) => <div className="attendance-row" key={student.id}><span className="student-avatar">{student.name.slice(0, 1)}</span><strong>{student.name}</strong><div className="attendance-actions"><button className={student.status === "present" ? "chosen present" : ""} onClick={() => toggleStatus(student, "present")}>Présent</button><button className={student.status === "absent" ? "chosen absent" : ""} onClick={() => toggleStatus(student, "absent")}>Absent</button><button className={student.status === "non-pratiquant" ? "chosen neutral" : ""} onClick={() => toggleStatus(student, "non-pratiquant")}>N.P.</button></div></div>)}</div></section>}
  </main>;
}

function SecurityPanel({ classItem, updateClass }: { classItem: SchoolClass; updateClass: (item: SchoolClass) => void }) {
  const [pin, setPin] = useState(classItem.exitPin || "");
  return <section className="security-panel"><div><p className="eyebrow">PROTECTION</p><strong>Mode élève sécurisé</strong><small>Un code PIN protège le retour aux réglages professeur.</small></div><div className="security-form"><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="PIN à 4–6 chiffres" /><button className="secondary" onClick={() => updateClass({ ...classItem, exitPin: pin || undefined })}>Enregistrer</button></div></section>;
}

function StudentTable({ students, classItem, updateClass }: { students: Student[]; classItem: SchoolClass; updateClass: (item: SchoolClass) => void }) {
  return <div className="student-list">{students.map((student) => <div className="student-row" key={student.id}><span className="student-avatar">{student.name.slice(0, 1)}</span><input value={student.name} onChange={(event) => updateClass({ ...classItem, students: students.map((item) => item.id === student.id ? { ...item, name: event.target.value } : item) })} /><span className="level">Niv. {student.level}</span><button className="icon-button" title="Supprimer" onClick={() => updateClass({ ...classItem, students: students.filter((item) => item.id !== student.id) })}>×</button></div>)}{!students.length && <div className="empty"><span>Ajoutez les élèves pour commencer.</span></div>}</div>;
}

function TournamentSettings({ tournament, updateTournament }: { tournament: Tournament; updateTournament: (item: Tournament) => void }) {
  const updateNumber = (field: "pointsWin" | "pointsLoss" | "maxRankDiff" | "courtCount" | "groupSize", value: string, minimum: number) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) updateTournament({ ...tournament, [field]: Math.max(minimum, Math.floor(parsed)) });
  };
  return <div className="tournament-settings"><div className="settings-title"><strong>Paramètres de séance</strong><small>Modifiables selon le niveau et le matériel disponible.</small></div><label>Victoire<input type="number" min="0" value={tournament.pointsWin} onChange={(event) => updateNumber("pointsWin", event.target.value, 0)} /></label><label>Défaite<input type="number" min="0" value={tournament.pointsLoss} onChange={(event) => updateNumber("pointsLoss", event.target.value, 0)} /></label><label>Écart ATP<input type="number" min="0" value={tournament.maxRankDiff} onChange={(event) => updateNumber("maxRankDiff", event.target.value, 0)} /></label><label>Terrains<input type="number" min="1" value={tournament.courtCount} onChange={(event) => updateNumber("courtCount", event.target.value, 1)} /></label><label>Taille poule<input type="number" min="2" value={tournament.groupSize} onChange={(event) => updateNumber("groupSize", event.target.value, 2)} /></label><label>Format<select value={tournament.matchFormat} onChange={(event) => updateTournament({ ...tournament, matchFormat: event.target.value as Tournament["matchFormat"] })}><option value="normal">Normal</option><option value="flash">Flash</option></select></label></div>;
}

function TournamentScreen({ classItem, tournament, updateClass, updateTournament, onBack, notify, lanRole, joinUrl }: { classItem: SchoolClass; tournament: Tournament; updateClass: (item: SchoolClass) => void; updateTournament: (item: Tournament) => void; onBack: () => void; notify: (text: string) => void; lanRole: LanRole; joinUrl: string }) {
  const [playerAId, setPlayerAId] = useState("");
  const [playerBId, setPlayerBId] = useState("");
  const [refereeId, setRefereeId] = useState("");
  const [scoreA, setScoreA] = useState("21");
  const [scoreB, setScoreB] = useState("15");
  const [studentMode, setStudentMode] = useState(false);
  const activeStudents = classItem.students.filter((student) => student.status === "present");
  const ranking = useMemo(() => [...classItem.students].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name)), [classItem.students]);
  const fixtures = useMemo(() => { if (tournament.mode !== "classic") return []; const done = new Set(tournament.matches.flatMap((match) => [`${match.playerAId}:${match.playerBId}`, `${match.playerBId}:${match.playerAId}`])); return activeStudents.flatMap((a, i) => activeStudents.slice(i + 1).filter((b) => !done.has(`${a.id}:${b.id}`)).map((b) => [a, b] as const)); }, [activeStudents, tournament]);
  const groups = useMemo(() => { if (tournament.mode !== "poule") return []; const result: Student[][] = []; for (let index = 0; index < activeStudents.length; index += tournament.groupSize) result.push(activeStudents.slice(index, index + tournament.groupSize)); return result; }, [activeStudents, tournament]);

  const recordMatch = () => {
    const a = classItem.students.find((student) => student.id === playerAId);
    const b = classItem.students.find((student) => student.id === playerBId);
    const sa = Number(scoreA); const sb = Number(scoreB);
    if (!a || !b || a.id === b.id || !Number.isFinite(sa) || !Number.isFinite(sb) || sa === sb) { notify("Sélectionnez deux joueurs et un score gagnant"); return; }
    const winner = sa > sb ? a : b; const loser = sa > sb ? b : a;
    const match: Match = { id: uid("match"), tournamentId: tournament.id, playerAId: a.id, playerBId: b.id, scoreA: sa, scoreB: sb, refereeId: refereeId || undefined, playedAt: new Date().toISOString(), court: tournament.mode === "poule" ? 1 : undefined };
    const updatedStudents = classItem.students.map((student) => {
      if (student.id === winner.id) return { ...student, points: student.points + tournament.pointsWin, matches: student.matches + 1, wins: student.wins + 1 };
      if (student.id === loser.id) return { ...student, points: student.points + tournament.pointsLoss, matches: student.matches + 1, losses: student.losses + 1 };
      if (refereeId && student.id === refereeId) return { ...student, points: student.points + 1, refereed: student.refereed + 1 };
      return student;
    });
    const nextTournament = { ...tournament, matches: [...tournament.matches, match] };
    updateClass({ ...classItem, students: updatedStudents }); updateTournament(nextTournament);
    if (lanRole === "client" && joinUrl) sendLanAction(joinUrl, { id: match.id, type: "record-match", payload: { classId: classItem.id, tournamentId: tournament.id, match, winnerId: winner.id, loserId: loser.id, refereeId: refereeId || undefined } }).catch((error) => notify(error instanceof Error ? error.message : "Le maître n'a pas reçu le match"));
    setPlayerAId(""); setPlayerBId(""); notify(lanRole === "client" ? "Match envoyé à la tablette maître" : "Match enregistré et classement mis à jour");
  };
  const studentName = (id: string) => classItem.students.find((student) => student.id === id)?.name || "—";
  const exitStudentMode = () => {
    const expectedPin = classItem.exitPin;
    if (!expectedPin || window.prompt("Code PIN professeur") === expectedPin) setStudentMode(false);
  };
  return <main className="app-shell">{!studentMode && <Header onExport={() => {}} onImport={() => {}} />}<div className="subbar"><button className="back" onClick={studentMode ? exitStudentMode : onBack}>{studentMode ? "🔒 Quitter le mode élève" : `← ${classItem.name}`}</button><span>{tournament.name}</span><span className={`mode-badge ${tournament.mode}`}>{tournament.mode.toUpperCase()}</span></div><section className="page-heading tournament-heading"><div><p className="eyebrow">{tournament.mode === "atp" ? "DÉFIS & CLASSEMENT" : tournament.mode === "poule" ? "TERRAINS & POULES" : "CHAMPIONNAT"}</p><h1>{tournament.name}</h1><p>{tournament.matches.length} match(s) enregistré(s) · classe {classItem.name}</p></div><div className="heading-actions">{!studentMode && <button className="secondary" onClick={() => setStudentMode(true)}>Mode élève</button>}<button className="secondary" onClick={() => window.print()}>Imprimer / PDF</button></div></section><div className="grid tournament-grid"><section className="panel"><div className="section-title"><div><p className="eyebrow">SAISIE RAPIDE</p><h2>Enregistrer un match</h2></div></div><div className="match-form"><select value={playerAId} onChange={(event) => setPlayerAId(event.target.value)}><option value="">Joueur A</option>{activeStudents.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select><span className="versus">VS</span><select value={playerBId} onChange={(event) => setPlayerBId(event.target.value)}><option value="">Joueur B</option>{activeStudents.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select><div className="scores"><input type="number" min="0" value={scoreA} onChange={(event) => setScoreA(event.target.value)} /><b>—</b><input type="number" min="0" value={scoreB} onChange={(event) => setScoreB(event.target.value)} /></div><select value={refereeId} onChange={(event) => setRefereeId(event.target.value)}><option value="">Arbitre (facultatif)</option>{activeStudents.filter((student) => student.id !== playerAId && student.id !== playerBId).map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select><button className="primary full" onClick={recordMatch}>Valider le match</button></div><div className="match-history"><h3>Historique de la séance</h3>{!tournament.matches.length && <p className="muted">Aucun match enregistré.</p>}{[...tournament.matches].reverse().map((match) => <div className="history-row" key={match.id}><span>{studentName(match.playerAId)} <b>{match.scoreA}–{match.scoreB}</b> {studentName(match.playerBId)}</span><small>{new Date(match.playedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div></section><section className="panel"><div className="section-title"><div><p className="eyebrow">CLASSEMENT EN DIRECT</p><h2>Classement</h2></div></div><div className="ranking-list">{ranking.map((student, index) => <div className="ranking-row" key={student.id}><span className={`rank ${index < 3 ? "podium" : ""}`}>{index + 1}</span><span className="student-avatar">{student.name.slice(0, 1)}</span><span className="rank-name"><strong>{student.name}</strong><small>{student.wins} V · {student.losses} D · {student.refereed} arb.</small></span><b className="points">{student.points} <small>pts</small></b></div>)}</div></section></div>{!studentMode && <section className="panel planning-panel"><div className="section-title"><div><p className="eyebrow">ORGANISATION</p><h2>{tournament.mode === "poule" ? "Répartition des poules" : tournament.mode === "classic" ? "Matchs à venir" : "Règles ATP"}</h2></div></div><TournamentSettings tournament={tournament} updateTournament={updateTournament} />{tournament.mode === "poule" && <div className="group-grid">{groups.map((group, index) => <div className="group-card" key={index}><strong>Terrain {index + 1}</strong>{group.map((student) => <span key={student.id}>{student.name}</span>)}</div>)}{!groups.length && <p className="muted">Ajoutez des élèves présents pour générer les poules.</p>}</div>}{tournament.mode === "classic" && <div className="fixture-grid">{fixtures.slice(0, 12).map(([a, b]) => <span key={`${a.id}-${b.id}`}>{a.name} <b>vs</b> {b.name}</span>)}{!fixtures.length && <p className="muted">Tous les matchs disponibles sont joués.</p>}</div>}{tournament.mode === "atp" && <div className="rules-strip"><span>Victoire <b>+{tournament.pointsWin} pts</b></span><span>Défaite <b>+{tournament.pointsLoss} pt</b></span><span>Écart max <b>{tournament.maxRankDiff} places</b></span></div>}</section>}</main>;
}

export default App;
