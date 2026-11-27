<?php

namespace Klxm\Tiptap\Media;

use Klxm\Tiptap\Output;
use Override;
use Redaxo\Core\ApiFunction\ApiFunction;
use Redaxo\Core\ApiFunction\AsApiFunction;
use Redaxo\Core\ApiFunction\Result;
use Redaxo\Core\Core;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;

use function mb_substr;

/**
 * Titel und Vorschaubild von YouTube/Vimeo, vom Server geholt und abgelegt:
 * `?rex-api-call=tiptap_oembed&url=…` (JSON) bzw. `&thumb=1` (Bild).
 *
 * Öffentlich, damit Platzhalter im Frontend das Vorschaubild zeigen. Beim Anbieter nachgefragt wird nur für angemeldete
 * Redakteure im Backend (Editor) und bei der Ausgabe ({@see Output}) – Besucher bekommen nur, was schon
 * abgelegt ist.
 */
#[AsApiFunction('tiptap_oembed')]
final class OembedApi extends ApiFunction
{
    protected bool $published = true;
    protected bool $requiresCsrfProtection = false;

    #[Override]
    public function execute(): Result
    {
        $url = mb_substr(Request::get('url', 'string', ''), 0, 500);
        $fetch = Core::isBackend() && null !== Core::getUser();

        Response::cleanOutputBuffers();
        if (Request::get('thumb', 'bool', false)) {
            $file = Oembed::thumbnail($url, $fetch);
            if (null === $file) {
                Response::setStatus(Response::HTTP_NOT_FOUND);
                Response::sendContent('', 'text/plain');
                exit;
            }
            Response::sendCacheControl('public, max-age=604800');
            Response::sendFile($file, 'image/jpeg');
            exit;
        }

        $meta = Oembed::meta($url, $fetch);
        Response::sendCacheControl($fetch ? 'no-store' : 'public, max-age=86400');
        Response::sendJson($meta ?? ['error' => 'unsupported']);
        exit;
    }
}
