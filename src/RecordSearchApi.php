<?php

namespace Klxm\Tiptap;

use Override;
use Redaxo\Core\ApiFunction\ApiFunction;
use Redaxo\Core\ApiFunction\AsApiFunction;
use Redaxo\Core\ApiFunction\Result;
use Redaxo\Core\Content\Article;
use Redaxo\Core\Core;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;

use function mb_substr;

/**
 * Records for the link dialog (read-only, according to the user's permissions):
 * ?rex-api-call=tiptap_records&table=…&q=… or &id=… for the label of a record, &article=… for the name of an
 * article (link bubble).
 */
#[AsApiFunction('tiptap_records')]
final class RecordSearchApi extends ApiFunction
{
    #[Override]
    public function execute(): Result
    {
        $user = Core::requireUser();
        $table = Request::get('table', 'string', '');
        $id = Request::get('id', 'int', 0);
        $article = Request::get('article', 'int', 0);

        $data = $article > 0
            ? ['label' => Article::get($article)?->name, 'url' => Article::get($article)?->getUrl()]
            : ($id > 0
            ? ['label' => RecordLinks::label($table, $id), 'url' => RecordLinks::url($table, $id)]
            : ['records' => RecordLinks::search($table, mb_substr(Request::get('q', 'string', ''), 0, 100), $user)]);

        Response::cleanOutputBuffers();
        Response::setHeader('Cache-Control', 'no-store');
        Response::sendJson($data);
        exit;
    }
}
