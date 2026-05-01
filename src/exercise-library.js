export const EXERCISE_LIB = {
  "Maschine": [
    { n: "Beinpresse", e: true, d: "Füße schulterbreit auf Platte, Knie 90°. Kontrolliert drücken, nicht überstrecken." },
    { n: "Beinbeuger", e: true, d: "Bäuchlings, Polster an Achillessehne. Kontrolliert beugen, langsam zurück." },
    { n: "Beinstrecker", e: true, d: "Sitzend, Polster am Schienbein. Strecken, oben halten, langsam zurück." },
    { n: "Adduktoren", e: false, d: "Polster innen an Knien. Zusammendrücken, kontrolliert öffnen." },
    { n: "Abduktoren", e: false, d: "Polster außen an Knien. Auseinanderdrücken, kontrolliert zurück." },
    { n: "Brustpresse", e: true, d: "Griffe auf Brusthöhe. Schulterblätter hinten. Nicht ganz durchstrecken." },
    { n: "Schulterpresse", e: false, d: "Sitzend, Griffe neben Ohren. Nach oben drücken, kontrolliert absenken." },
    { n: "Latzug", e: true, d: "Breiter Griff, Stange zur oberen Brust. Schulterblätter zusammen." },
    { n: "Rudermaschine (brustgestützt)", e: true, d: "Brust an Polster. Schulterblätter zusammenführen, kontrolliert zurück." },
    { n: "Bizepscurls", e: false, d: "Kontrollierte Beugung, Ellbogen fixiert. Kein Schwung. Langsam absenken." },
    { n: "Rückenstrecker", e: false, d: "Hüfte an Polster, Oberkörper absenken und aufrichten. Nicht überstrecken." },
    { n: "Butterfly", e: false, d: "Arme auf Polster, vor der Brust zusammenführen. Kontrolliert öffnen." },
    { n: "Reverse Butterfly", e: false, d: "Brust an Polster, Arme nach hinten öffnen. Schulterblätter zusammen." },
    { n: "Wadenheben Maschine", e: false, d: "Schulterpolster, auf Zehenspitzen heben, langsam absenken." },
  ],
  "Kabelzug": [
    { n: "Face Pulls", e: false, d: "Seilgriff auf Gesichtshöhe. Ellbogen hoch, Schulterblätter zusammen." },
    { n: "Pallof Press", e: true, d: "Kabelzug seitlich, Griff vor Brust. Arme strecken, Rotation widerstehen." },
    { n: "Trizeps-Pushdown", e: false, d: "Oberarme am Körper fixiert. Nur Unterarme strecken, kontrolliert zurück." },
    { n: "Schulter-Außenrotation", e: true, d: "Ellbogen 90° am Körper, nach außen rotieren. Leichtes Gewicht!" },
    { n: "Cable Woodchop", e: true, d: "Kabelzug oben/unten, diagonale Rotation. Core stabil, Arme gestreckt." },
    { n: "Cable Crunch", e: false, d: "Kniend vor Kabelzug, Seil hinter Kopf. Oberkörper einrollen." },
  ],
  "Eigengewicht": [
    { n: "Plank", e: false, d: "Unterarmstütz, Körper gerade. Bauch anspannen, nicht durchhängen." },
    { n: "Seitstütz", e: true, d: "Seitlicher Unterarmstütz, Hüfte hoch. Core aktiv." },
    { n: "Liegestütze", e: false, d: "Hände schulterbreit, Körper gerade. Brust fast zum Boden." },
    { n: "Bulgarian Split Squat", e: true, d: "Hinterer Fuß auf Bank. Vorderes Knie über Sprunggelenk." },
    { n: "Glute Bridge", e: false, d: "Rückenlage, Hüfte heben bis Körper gerade. Gesäß anspannen." },
    { n: "Dead Bug", e: true, d: "Rückenlage, Arme senkrecht, Beine 90°. Gegenseitig strecken." },
    { n: "Superman", e: false, d: "Bäuchlings, Arme+Beine gleichzeitig heben, kurz halten." },
    { n: "Dips (an Bank)", e: false, d: "Hände auf Bankkante, Körper absenken bis Ellbogen 90°." },
    { n: "Klimmzüge", e: false, d: "Obergriff, schulterbreit. Kinn über Stange, kontrolliert absenken." },
    { n: "Ausfallschritte", e: true, d: "Großer Schritt vor, hinteres Knie fast zum Boden. Aufrecht bleiben." },
    { n: "Mountain Climbers", e: false, d: "Liegestützposition, Knie abwechselnd zur Brust. Hüfte stabil." },
    { n: "Burpees", e: false, d: "Hocke, Liegestütz, Sprung. Flüssig, Brust berührt Boden." },
    { n: "Burpees Broad Jump", e: false, d: "Wie Burpees, aber mit Weitsprung statt Strecksprung." },
    { n: "Bear Crawl", e: false, d: "Auf allen Vieren, Knie über Boden. Vorwärts/rückwärts kriechen." },
    { n: "Scapula Push-Ups", e: false, d: "Liegestützposition, Schulterblätter zusammen/auseinander. Arme gestreckt." },
  ],
  "Kettlebell": [
    { n: "Russian Twist", e: true, d: "Sitzend, Oberkörper zurück. Mit KB seitlich rotieren." },
    { n: "Kettlebell Swing", e: false, d: "Hüftbreiter Stand, KB zwischen Beinen. Hüfte explosiv strecken." },
    { n: "Goblet Squat", e: false, d: "KB vor Brust, tiefe Kniebeuge. Ellbogen zwischen Knie. Aufrecht." },
    { n: "KB Turkish Get-Up", e: true, d: "Rückenlage, KB senkrecht. Aufstehen in 7 Schritten. Arm bleibt oben." },
    { n: "KB Single Arm Row", e: true, d: "Vorgebeugt, KB mit einer Hand rudern. Ellbogen eng." },
    { n: "KB Farmers Walk", e: true, d: "KB in einer/beiden Händen tragen. Aufrecht, Schultern tief." },
    { n: "KB Halo", e: false, d: "KB am Griff vor Brust, um Kopf kreisen. Beide Richtungen." },
    { n: "KB Sumo Deadlift", e: false, d: "Breiter Stand, KB mittig. Hüfte zurück, Rücken gerade heben." },
    { n: "Sandbag Lunges", e: true, d: "Sandbag auf Schultern, Ausfallschritte. Knie 90°, aufrecht." },
  ],
  "Cardio": [
    { n: "Bike", e: false, d: "Sattel Hüfthöhe. Knie leicht gebeugt am tiefsten Punkt." },
    { n: "Crosstrainer", e: false, d: "Aufrecht, ganze Fußsohle. Arme mitbewegen." },
    { n: "Laufen", e: false, d: "Aufrechte Haltung, Mittelfuß. Kadenz 170-180/min." },
    { n: "Schwimmen", e: false, d: "Kraul: Langer Armzug, Rotation. Brust: Zugphase + Gleiten." },
    { n: "Assault Bike", e: false, d: "Arme und Beine gleichzeitig. Für Intervalle: Vollgas, dann Pause." },
    { n: "SkiErg", e: false, d: "Stehend, Arme über Kopf, Zugseil nach unten. Körper leicht beugen." },
    { n: "Seilspringen", e: false, d: "Leicht auf Fußballen, Handgelenke drehen. Nicht zu hoch springen." },
    { n: "Sled Push", e: false, d: "Hände an Griffen, Körper 45°. Kleine schnelle Schritte." },
    { n: "Sled Pull", e: false, d: "Seil greifen, Hand über Hand ziehen. Stabiler Stand." },
  ],
  "Prävention Ferse": [
    { n: "Plantarfaszien-Rollen", e: true, d: "Ball unter Fußsohle, 60 Sek. pro Seite rollen. Schmerzpunkte halten." },
    { n: "Exzentrisches Wadenheben", e: true, d: "Auf Stufe, hoch auf Zehenspitzen, dann langsam (3 Sek.) Ferse absenken." },
    { n: "Wadendehnung", e: true, d: "Wand, Bein gestreckt hinten, Ferse am Boden. 60 Sek. Dann gebeugt." },
    { n: "Plantarfaszien-Massage", e: true, d: "Faszienrolle unter Fußsohle. Langsam rollen." },
    { n: "Plantarfaszien-Dehnung", e: true, d: "Zehen hochziehen, Fußgewölbe dehnen. 45 Sek. pro Seite." },
  ],
  "Prävention Schulter": [
    { n: "Schulterdislokationen", e: false, d: "Band/Stab breit, langsam über Kopf nach hinten. 15 Wdh." },
    { n: "Außenrotation Kabelzug", e: true, d: "Ellbogen 90°, nach außen drehen. 2x10, leicht." },
    { n: "Innenrotation Kabelzug", e: true, d: "Ellbogen 90°, nach innen drehen. 2x10, leicht." },
    { n: "BWS-Rotation", e: false, d: "Seitlage, Knie 90°. Oberen Arm öffnen, Blick folgt. 10/Seite." },
    { n: "Sleeper Stretch", e: true, d: "Seitlage, Unterarm sanft zum Boden drücken. 45 Sek." },
    { n: "Y-T-W Raises", e: false, d: "Bäuchlings, Arme in Y/T/W heben. Je 10, kein Gewicht." },
    { n: "Pec-Minor-Dehnung", e: true, d: "Arm an Türkante 90°, Körper wegdrehen. 30 Sek. pro Seite." },
    { n: "Scapula Push-Ups", e: false, d: "Liegestützpos., Schulterblätter zusammen/auseinander. Arme gestreckt." },
  ],
};

// Get exercise info by name
export function getExerciseInfo(name) {
  for (const cat of Object.values(EXERCISE_LIB)) {
    const found = cat.find(x => x.n === name);
    if (found) return found;
  }
  return null;
}
