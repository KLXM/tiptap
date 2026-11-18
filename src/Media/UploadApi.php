<?php

namespace Klxm\Tiptap\Media;

use Klxm\Meta\Alt;
use Klxm\Tiptap\Profiles;
use Override;
use Redaxo\Core\ApiFunction\ApiFunction;
use Redaxo\Core\ApiFunction\AsApiFunction;
use Redaxo\Core\ApiFunction\Result;
use Redaxo\Core\Core;
use Redaxo\Core\Exception\UserMessageException;
use Redaxo\Core\Filesystem\File;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;
use Redaxo\Core\MediaPool\MediaCategory;
use Redaxo\Core\MediaPool\MediaHandler;
use Redaxo\Core\Translation\I18n;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Throwable;

use function array_merge;
use function array_unique;
use function array_values;
use function in_array;
use function mb_strtolower;
use function pathinfo;

use const PATHINFO_FILENAME;

/**
 * Datei per Ziehen/Einfügen in den Editor: landet im Medienpool (POST, CSRF, angemeldete Redakteure).
 *
 * Geprüft auf dem Server: Upload im Profil erlaubt, Werkzeug Bild bzw. Video im Profil, Dateityp aus dem Profil (und
 * der Erlaubnisliste des Medienpools, die MediaHandler selbst prüft), Recht auf die Zielkategorie.
 * Antwort: {file, kind: image|video, title, alt}.
 */
#[AsApiFunction('tiptap_upload')]
final class UploadApi extends ApiFunction
{
    #[Override]
    public function execute(): Result
    {
        $user = Core::requireUser();
        Response::cleanOutputBuffers();
        Response::setHeader('Cache-Control', 'no-store');
        try {
            if ('post' !== Request::requestMethod()) {
                throw new UserMessageException('POST');
            }
            $profile = Profiles::getOrDefault(Request::post('profile', 'string', ''));
            $upload = $profile->config['upload'];
            if (!$upload['enabled']) {
                throw new UserMessageException(I18n::msg('tiptap_upload_disabled'));
            }
            $categoryId = $upload['category'] > 0 && null !== MediaCategory::get($upload['category']) ? $upload['category'] : null;
            if (!$user->getComplexPerm('media')->hasCategoryPerm($categoryId)) {
                throw new UserMessageException(I18n::msg('tiptap_upload_no_permission'));
            }

            $file = Core::getRequest()->files->get('file');
            if (!$file instanceof UploadedFile) {
                throw new UserMessageException(I18n::msg('pool_file_not_found'));
            }
            $extension = mb_strtolower(File::extension($file->getClientOriginalName()));
            $images = $profile->hasItem('image') ? $profile->config['image']['types'] : [];
            $videos = $profile->hasItem('video') ? $profile->config['video']['types'] : [];
            if (!in_array($extension, array_merge($images, $videos), true)) {
                throw new UserMessageException(I18n::msg('tiptap_upload_type', $extension));
            }

            $media = MediaHandler::add([
                'file' => $file,
                'category_id' => $categoryId,
                'title' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            ], [], types: array_values(array_unique(array_merge($images, $videos))));

            Response::sendJson([
                'ok' => true,
                'file' => $media->fileName,
                'kind' => in_array($extension, $videos, true) && !in_array($extension, $images, true) ? 'video' : 'image',
                'title' => $media->title,
                'alt' => Alt::of($media),
            ]);
        } catch (UserMessageException $e) {
            Response::setStatus(Response::HTTP_BAD_REQUEST);
            Response::sendJson(['ok' => false, 'error' => $e->getMessage()]);
        } catch (Throwable $e) {
            Response::setStatus(Response::HTTP_INTERNAL_ERROR);
            Response::sendJson(['ok' => false, 'error' => Core::isDevMode() ? $e->getMessage() : I18n::msg('tiptap_upload_error')]);
        }
        exit;
    }
}
