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
 * Approves an HTML embed: signs code and service for users with the permission `tiptap[html_embed]`
 * (POST, with CSRF token). Without a valid signature {@see HtmlEmbed::render()} does not output the code.
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
