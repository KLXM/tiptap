<?php

namespace FriendsOfRedaxo\Tiptap;

use Override;
use Redaxo\Core\ApiFunction\ApiFunction;
use Redaxo\Core\ApiFunction\AsApiFunction;
use Redaxo\Core\ApiFunction\Result;
use Redaxo\Core\Core;
use Redaxo\Core\Http\Request;
use Redaxo\Core\Http\Response;

use function mb_substr;

/**
 * Datensätze für den Link-Dialog (nur lesend, nach den Rechten des Benutzers):
 * ?rex-api-call=tiptap_records&table=…&q=… bzw. &id=… für die Bezeichnung eines Datensatzes.
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

        $data = $id > 0
            ? ['label' => RecordLinks::label($table, $id)]
            : ['records' => RecordLinks::search($table, mb_substr(Request::get('q', 'string', ''), 0, 100), $user)];

        Response::cleanOutputBuffers();
        Response::setHeader('Cache-Control', 'no-store');
        Response::sendJson($data);
        exit;
    }
}
