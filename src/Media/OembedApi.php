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
 * Title and thumbnail of YouTube/Vimeo, fetched and stored by the server:
 * `?rex-api-call=tiptap_oembed&url=…` (JSON) or `&thumb=1` (image).
 *
 * Public so that placeholders in the frontend show the thumbnail. The provider is only queried for logged-in editors
 * in the backend (editor) and on output ({@see Output}) – visitors only get what is already stored.
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
