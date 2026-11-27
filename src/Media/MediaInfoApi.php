<?php

namespace Klxm\Tiptap\Media;

use Klxm\Meta\Alt;
use Override;
use Redaxo\Core\ApiFunction\ApiFunction;
use Redaxo\Core\ApiFunction\AsApiFunction;
use Redaxo\Core\ApiFunction\Result;
use Redaxo\Core\Core;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;
use Redaxo\Core\MediaPool\Media;

/**
 * Alt text of a medium for the image dialog (read-only, logged-in editors):
 * `?rex-api-call=tiptap_media&file=…&language=…` → {alt, decorative, title}.
 */
#[AsApiFunction('tiptap_media')]
final class MediaInfoApi extends ApiFunction
{
    #[Override]
    public function execute(): Result
    {
        Core::requireUser();
        $language = Request::get('language', 'int', 0);
        $media = Media::get(Request::get('file', 'string', ''), $language > 0 ? $language : null);

        Response::cleanOutputBuffers();
        Response::setHeader('Cache-Control', 'no-store');
        Response::sendJson(null === $media ? ['error' => 'not found'] : [
            'alt' => Alt::of($media),
            'decorative' => Alt::isDecorative($media),
            'title' => $media->title,
        ]);
        exit;
    }
}
