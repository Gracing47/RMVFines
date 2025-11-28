# RMV HAFAS API Dokumentation & Nutzung

Diese Datei beschreibt, wie die **RMV HAFAS API** in dieser Anwendung integriert wurde, um eine sprachgesteuerte Fahrplanauskunft zu ermöglichen. Sie dient als **Knowledge Base für das Entwickler-Team** und fokussiert sich auf Barrierefreiheit ("Barrier-Free").

## 1. Allgemeine Konfiguration

*   **Base URL:** `https://www.rmv.de/hapi`
*   **Authentifizierung:** Der Parameter `accessId` ist bei jedem Aufruf obligatorisch.
*   **Format:** Standard ist XML. Für JSON füge `format=json` an.
*   **CORS-Proxy:** Da die API keine direkten Browser-Anfragen (CORS) erlaubt, werden alle Anfragen über `https://corsproxy.io/?` getunnelt.

---

## 2. Funktion: Standortsuche & Zielwahl (GPS + Ziel)

Hier geht es darum, den aktuellen Standort (Koordinaten) in eine Haltestelle umzuwandeln und eine Verbindung zu einem gesuchten Ziel zu finden.

### Schritt A: GPS-Koordinaten in Haltestelle umwandeln
Verwende diesen Endpunkt, um Haltestellen im Umkreis der GPS-Position des Nutzers zu finden.

*   **Service:** `location.nearbystops`
*   **Wichtige Parameter:**
    *   `originCoordLat`: Breitengrad (Latitude).
    *   `originCoordLong`: Längengrad (Longitude).
    *   `r`: Radius in Metern (Standard 1000m). **Für Mobilitätseingeschränkte ggf. kleiner setzen**, um "machbare" Distanzen zu zeigen.
    *   `type`: Setze auf `S`, um nur Stationen zu finden (keine POIs).

**Beispiel-Call:**
`GET /location.nearbystops?accessId=...&originCoordLat=50.107&originCoordLong=8.663&r=500&format=json`

### Schritt B: Ziel suchen (Text-Input)
Wenn der Nutzer ein Ziel eingibt (z.B. "Hauptwache").

*   **Service:** `location.name`
*   **Wichtige Parameter:**
    *   `input`: Der Suchtext.
    *   `type`: `S` für Stationen oder `ALL` für Adressen und Stationen.

**Beispiel-Call:**
`GET /location.name?accessId=...&input=Hauptwache&type=S&format=json`

---

## 3. Funktion: Verbindungssuche (Routing)

Dies ist das Herzstück. Hier wird die Route berechnet. Für deine App ist entscheidend, wie wir Hindernisse filtern.

*   **Service:** `trip`
*   **Eingabe-Parameter:**
    *   `originId`: ID der Starthaltestelle (aus Schritt 1A oder 1B).
    *   `destId`: ID der Zielhaltestelle (aus Schritt 1B).
    *   Alternativ Koordinaten: `originCoordLat` / `destCoordLat` etc.

### ♿ Crucial: Einstellungen für Barrierefreiheit
Die HAFAS API bietet spezifische Filter, um Routen für Menschen mit Einschränkungen zu optimieren. Deine KI sollte diese Parameter basierend auf dem Nutzerprofil setzen:

1.  **Hindernisse vermeiden (`avoidPaths`):**
    Du kannst Treppen oder Rolltreppen explizit ausschließen.
    *   Parameter: `avoidPaths`
    *   Werte (kommagetrennt):
        *   `SW`: Stairs (Treppen vermeiden)
        *   `ES`: Escalator (Rolltreppen vermeiden - wichtig für Rollstühle/Hunde)
        *   `RA`: Ramp (Rampen vermeiden - selten gewünscht, aber möglich)
        *   `EA`: Elevator (Aufzüge vermeiden - selten gewünscht)
    *   *Beispiel für Rollstuhlfahrer:* `avoidPaths=SW,ES` (Keine Treppen, keine Rolltreppen).

2.  **Umsteigezeiten anpassen (`changeTimePercent`):**
    Menschen mit Mobilitätseinschränkungen brauchen oft länger zum Umsteigen.
    *   Parameter: `changeTimePercent`
    *   Wert: `100` ist normal. `200` verdoppelt die berechnete Umsteigezeit.
    *   *Empfehlung:* Setze dies standardmäßig auf 150 oder 200 für Profile mit Gehbehinderung.

3.  **Fahrzeug-Attribute (`attributes` / `mobilityProfile`):**
    Prüfe, ob Niederflurfahrzeuge oder Fahrzeuge mit Einstiegshilfe verfügbar sind.
    *   Parameter: `mobilityProfile` (falls im RMV konfiguriert, z.B. `!BLOCK_BACKWARDS_TRAVEL`).
    *   Parameter: `attributes`. Hier kann nach Attributen gefiltert werden (muss mit RMV-Daten abgeglichen werden, oft z.B. `bf` für barrierefrei).

**Beispiel-Call (Barrierefreie Route):**
`GET /trip?accessId=...&originId=...&destId=...&avoidPaths=SW,ES&changeTimePercent=200&format=json`

---

## 4. Funktion: Infos zum Standort (Abfahrstafel)

Zeigt an, welche Busse/Bahnen als Nächstes fahren und ob diese barrierefrei sind.

*   **Service:** `departureBoard` oder `nearbyDepartureBoard` (für GPS).
*   **Wichtige Parameter:**
    *   `id`: Die Stations-ID.
    *   `time`: Aktuelle Uhrzeit (oder gewünschte Zeit).
    *   `maxJourneys`: Anzahl der anzuzeigenden Abfahrten.

*   **Barrierefrei-Info in der Antwort:**
    Achte in der Antwort (`DepartureBoard` Response) auf das `Notes`-Element oder `Product`-Attribute. Dort stehen oft Hinweise wie "Niederflurfahrzeug" oder Symbole für Rollstuhleignung.

---

## Zusammenfassung für die Devs

1.  **Suche:** Nutzt `location.nearbystops` für GPS und `location.name` für Text.
2.  **Routing:** Nutzt `trip`. **Wichtigster Hebel:** Der Parameter `avoidPaths=SW,ES` (Keine Treppen/Rolltreppen) und `changeTimePercent` (längere Umsteigezeit).
3.  **Realtime:** Die API liefert Realtime-Daten (`rtMode`). Zeigt diese unbedingt an, da ein defekter Aufzug (HIM Meldungen) eine Route unpassierbar machen kann.

## Besonderheiten bei der Implementierung

*   **Datenstruktur-Handling:** Die API gibt manchmal einzelne Objekte und manchmal Arrays zurück (z.B. bei `StopLocation`). Unsere `rmv-api.ts` normalisiert dies, indem sie Einzelobjekte immer in Arrays umwandelt, um Fehler zu vermeiden.
*   **Fehlertoleranz:** Wenn eine Haltestelle nicht eindeutig gefunden wird, nimmt die App den ersten Treffer der API (Best Match).
