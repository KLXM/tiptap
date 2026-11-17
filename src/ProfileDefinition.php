<?php

namespace Klxm\Tiptap;

/**
 * Basisklasse für Profile aus Code, siehe {@see AsProfile}.
 *
 * `config()` liefert dieselbe Struktur wie der Export der Profile (JSON) – fehlende Werte ergänzt das AddOn mit den
 * Voreinstellungen ({@see Profile::DEFAULTS}). Den Code für ein im Backend zusammengeklicktes Profil erzeugt
 * TipTap-Editor → Profile → „Als PHP-Klasse“.
 */
abstract class ProfileDefinition
{
    /** @return array<string, mixed> */
    abstract public function config(): array;
}
