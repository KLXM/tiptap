<?php

/*
 * The tests need a booted REDAXO installation (profiles, configuration, translations) – path to its bootstrap in
 * REDAXO_BOOTSTRAP, in the core's development repository for example:
 *
 *     REDAXO_BOOTSTRAP=/path/to/redaxo/.tools/bootstrap.php vendor/bin/phpunit -c /path/to/tiptap/phpunit.dist.xml
 *
 * Without REDAXO_BOOTSTRAP they are skipped.
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
