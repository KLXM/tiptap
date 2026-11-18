<?php

namespace Klxm\Tiptap\Media;

use Override;
use Redaxo\Core\ApiFunction\ApiFunction;
use Redaxo\Core\ApiFunction\AsApiFunction;
use Redaxo\Core\ApiFunction\Result;
use Redaxo\Core\Core;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;

/**
 * Gibt einen HTML-Embed frei: signiert Code und Dienst für Benutzer mit dem Recht `tiptap[html_embed]`
 * (POST, mit CSRF-Token). Ohne gültige Signatur gibt {@see HtmlEmbed::render()} den Code nicht aus.
 */
#[AsApiFunction('tiptap_embed_sign')]
final class EmbedSignApi extends ApiFunction
{
    #[Override]
    public function execute(): Result
    {
        $user = Core::requireUser();
        Response::cleanOutputBuffers();
        Response::sendCacheControl('no-store');
        if ('post' !== Request::requestMethod() || !HtmlEmbed::allowed($user)) {
            Response::setStatus(Response::HTTP_FORBIDDEN);
            Response::sendJson(['error' => 'forbidden']);
            exit;
        }
        $html = HtmlEmbed::normalize(Request::post('html', 'string', ''));
        $service = HtmlEmbed::service(Request::post('service', 'string', ''));
        Response::sendJson(['sig' => HtmlEmbed::sign($html, $service)]);
        exit;
    }
}
