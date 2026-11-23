SpareParts 0.4 – öffentliche App-Hülle ohne private Katalogdaten.

Die App enthält sieben Maschinenkategorien mit festen Kategorie-Symbolbildern. Die Bilddateien liegen im Ordner `category-images` und werden zusammen mit der öffentlichen App bereitgestellt.

Die ZIP-Datei enthält ausschließlich die öffentliche PWA-Oberfläche. Die private Katalogdatei mit PDFs, Zeichnungen und Ersatzteildaten darf nicht in das öffentliche GitHub-Repository hochgeladen werden.

Für das Update die öffentlichen Dateien im Wurzelverzeichnis des bestehenden GitHub-Pages-Repositories ersetzen. Die App-URL beibehalten, damit lokal gespeicherte Merklisten und Positionsmarkierungen erhalten bleiben.

Anklickbare Positionen werden aus den Artikelnummern in den Explosionszeichnungen erkannt und mit der Ersatzteilliste derselben Baugruppe abgeglichen. Unsichere und nicht erkannte Markierungen bleiben für die manuelle Zuordnung offen. Automatische Zuordnungen vor einer Bestellung am Originalkatalog prüfen.

Version 0.4 unterstützt den Import der privaten JSON-Datei bis 250 MB und schreibt die PDF- und Bilddateien in kleinen Stapeln in den lokalen IndexedDB-Speicher.
