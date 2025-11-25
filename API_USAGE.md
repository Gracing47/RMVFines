# RMV HAFAS API Dokumentation & Nutzung

Diese Datei beschreibt, wie die **RMV HAFAS API** in dieser Anwendung integriert wurde, um eine sprachgesteuerte Fahrplanauskunft zu ermöglichen.

## 1. Allgemeine Konfiguration

*   **Base URL:** `https://www.rmv.de/hapi`
*   **Format:** JSON (`format=json`)
*   **Authentifizierung:** Access ID Parameter (`accessId`)
*   **CORS-Proxy:** Da die API keine direkten Browser-Anfragen (CORS) erlaubt, werden alle Anfragen über `https://corsproxy.io/?` getunnelt.

## 2. Genutzte Endpunkte

Wir verwenden zwei Haupt-Endpunkte, um von einer gesprochenen Eingabe zu einer konkreten Verbindungsauskunft zu gelangen.

### A. Haltestellensuche (`/location.name`)

Dieser Endpunkt wandelt einen Namen (z.B. "Frankfurt Hauptbahnhof") in eine eindeutige System-ID (`extId`) um.

*   **Endpunkt:** `/location.name`
*   **Parameter:**
    *   `input`: Der Suchbegriff (z.B. "Wiesbaden").
    *   `type`: `S` (Station/Stop) - *implizit genutzt*.
*   **Nutzung im Code:**
    Wir rufen diesen Endpunkt zweimal auf:
    1.  Für den **Startort** (erkannt aus Spracheingabe).
    2.  Für den **Zielort** (erkannt aus Spracheingabe).
*   **Wichtige Rückgabewerte:**
    *   `StopLocation.name`: Der offizielle Name der Haltestelle.
    *   `StopLocation.extId`: Die ID, die für die Verbindungssuche benötigt wird (z.B. "3000010").
    *   `StopLocation.lat` / `lon`: Geokoordinaten.

### B. Verbindungssuche (`/trip`)

Dieser Endpunkt sucht Verbindungen zwischen zwei Haltestellen-IDs.

*   **Endpunkt:** `/trip`
*   **Parameter:**
    *   `originId`: Die `extId` des Startbahnhofs.
    *   `destId`: Die `extId` des Zielbahnhofs.
    *   `numF`: `3` (Anzahl der folgenden Verbindungen, die abgerufen werden sollen).
*   **Nutzung im Code:**
    Nachdem wir Start-ID und Ziel-ID haben, fragen wir hier die Route ab.
*   **Wichtige Rückgabewerte:**
    *   `Trip.LegList.Leg`: Eine Liste von Teilabschnitten (z.B. Fußweg zum Gleis -> S-Bahn Fahrt).
    *   `Leg.Origin.time` / `date`: Abfahrtszeit.
    *   `Leg.Origin.track`: Gleisangabe (falls verfügbar).
    *   `Leg.name`: Name des Verkehrsmittels (z.B. "S-Bahn S8").

## 3. Datenfluss der Anwendung

1.  **Spracheingabe (Voice Input):**
    *   User sagt: *"Von Frankfurt nach Mainz"*
    *   Parser extrahiert: `Start="Frankfurt"`, `Ziel="Mainz"`.

2.  **ID-Resolution (Schritt A):**
    *   Request 1: `GET /location.name?input=Frankfurt` -> Resultat ID: `3000010`
    *   Request 2: `GET /location.name?input=Mainz` -> Resultat ID: `3000001`

3.  **Routenberechnung (Schritt B):**
    *   Request 3: `GET /trip?originId=3000010&destId=3000001`

4.  **Anzeige & Sprachausgabe:**
    *   Die App zeigt die nächsten 3 Verbindungen als Karten an.
    *   Die App liest die Details der *ersten* Verbindung laut vor: *"Die nächste Verbindung... geht um 14:30 Uhr von Gleis 103."*

## 4. Besonderheiten bei der Implementierung

*   **Datenstruktur-Handling:** Die API gibt manchmal einzelne Objekte und manchmal Arrays zurück (z.B. bei `StopLocation`). Unsere `rmv-api.ts` normalisiert dies, indem sie Einzelobjekte immer in Arrays umwandelt, um Fehler zu vermeiden.
*   **Fehlertoleranz:** Wenn eine Haltestelle nicht eindeutig gefunden wird, nimmt die App den ersten Treffer der API (Best Match).
