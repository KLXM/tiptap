<?php

/*
 * Die Tests brauchen eine gestartete REDAXO-Installation (Profile, Konfiguration, Übersetzungen) – Pfad zu deren
 * Bootstrap in REDAXO_BOOTSTRAP, im Entwicklungs-Repository des Cores zum Beispiel:
 *
 *     REDAXO_BOOTSTRAP=/pfad/zu/redaxo/.tools/bootstrap.php vendor/bin/phpunit -c /pfad/zu/tiptap/phpunit.dist.xml
 *
 * Ohne REDAXO_BOOTSTRAP werden sie übersprungen.
 */

$bootstrap = getenv('REDAXO_BOOTSTRAP');
if (is_string($bootstrap) && '' !== $bootstrap) {
    require $bootstrap;
    define('TIPTAP_INTEGRATION', true);
} else {
    require dirname(__DIR__) . '/vendor/autoload.php';
    define('TIPTAP_INTEGRATION', false);
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'Klxm\\Tiptap\\Tests\\';
    if (str_starts_with($class, $prefix)) {
        $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
