<?php

use PhpCsFixer\Finder;
use Redaxo\PhpCsFixerConfig\Config;

$finder = new Finder()
    ->in([__DIR__ . '/src', __DIR__ . '/pages', __DIR__ . '/examples', __DIR__ . '/tests'])
;

return Config::redaxo6()
    ->setFinder($finder)
;
