"""
Google Cloud Vision API – Serverseitige Konfiguration für Safety Enforcement.

Nur SafeSearch aktiv. Keine Face Detection, keine Liveness/Spoof-Prüfungen
(vermeidet Fehlalarme bei Haustieren).
"""

from dataclasses import dataclass, field
from typing import List, Set

# ─── Aktivierte Features ────────────────────────────────────────────────────

ENABLED_FEATURES: List[str] = [
    "SAFE_SEARCH_DETECTION",
]
# Explizit NICHT aktiviert: FACE_DETECTION, LANDMARK_DETECTION, LOGO_DETECTION, etc.
# Keine Liveness/Spoof-Face-Prüfungen → keine Fehlalarme bei Haustieren.

# ─── Schwellenwerte (Thresholds) für SafeSearch ──────────────────────────────

@dataclass(frozen=True)
class SafeSearchThresholds:
    """
    Ab welchem Level gilt ein Snapshot als Verstoß.
    Nur LIKELY und VERY_LIKELY werden als Verstoß gewertet.
    """
    adult: Set[str] = field(default_factory=lambda: {"LIKELY", "VERY_LIKELY"})
    violence: Set[str] = field(default_factory=lambda: {"LIKELY", "VERY_LIKELY"})
    racy: Set[str] = field(default_factory=lambda: {"LIKELY", "VERY_LIKELY"})
    medical: Set[str] = field(default_factory=lambda: {"LIKELY", "VERY_LIKELY"})
    spoof: Set[str] = field(default_factory=lambda: {"LIKELY", "VERY_LIKELY"})

    def is_violation(self, category: str, level: str) -> bool:
        """Prüft, ob ein Level für die Kategorie einen Verstoß darstellt."""
        thresholds = getattr(self, category.lower(), set())
        return level in thresholds if thresholds else False


# Standard-Schwellenwerte
SAFE_SEARCH_THRESHOLDS = SafeSearchThresholds()

# ─── Blacklist für API-Response-Elemente ────────────────────────────────────

RESPONSE_BLACKLIST: Set[str] = {
    "faceAnnotations",
    "landmarkAnnotations",
    "logoAnnotations",
    "labelAnnotations",
    "localizedObjectAnnotations",
    "fullTextAnnotation",
    "textAnnotations",
    "imagePropertiesAnnotation",
    "cropHintsAnnotation",
    "webDetection",
    "productSearchResults",
    "error",
}
# Nur safeSearchAnnotation wird ausgewertet. Alle anderen werden ignoriert.

# ─── Kategorien, die geprüft werden ──────────────────────────────────────────

SAFE_SEARCH_CATEGORIES: List[str] = [
    "adult",
    "violence",
    "racy",
    "medical",
    "spoof",
]
