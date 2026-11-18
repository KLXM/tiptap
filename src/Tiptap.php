<?php

namespace Klxm\Tiptap;

use Klxm\Tiptap\Media\EmbedSignApi;
use Klxm\Tiptap\Media\HtmlEmbed;
use Klxm\Tiptap\Media\MediaInfoApi;
use Klxm\Tiptap\Media\OembedApi;
use Klxm\Tiptap\Media\UploadApi;
use Klxm\VideoEditor\VideoEditor;
use Redaxo\Core\Core;
use Redaxo\Core\Filesystem\Url;
use Redaxo\Core\Http\Response;
use Redaxo\Core\Language\Language;
use Redaxo\Core\View\HtmlAttributes;

use function class_exists;
use function in_array;
use function json_encode;
use function mb_substr;
use function Redaxo\Core\View\escape;

use const JSON_HEX_AMP;
use const JSON_HEX_APOS;
use const JSON_HEX_QUOT;
use const JSON_HEX_TAG;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

/**
 * Öffentliche Schnittstelle des AddOns.
 *
 *     // Ausgabe im Modul/Template (Markdown → HTML, bereinigt, interne Links aufgelöst)
 *     echo Tiptap::render($this->text, 'tiptap.default');
 *
 *     // Frontend-Formular (z. B. für Gäste)
 *     echo Tiptap::assets();
 *     echo Tiptap::editor('comment', $value, 'tiptap.guest');
 *     $clean = Tiptap::sanitize(Request::post('comment', 'string'), 'tiptap.guest');
 */
final class Tiptap
{
    private const int JSON_ATTR = JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP;

    /** Frontend-Assets schon ausgegeben */
    private static bool $assetsDone = false;

    /** Erweiterung eines anderen AddOns anmelden – in dessen boot() */
    public static function register(Plugin $plugin): void
    {
        Registry::addPlugin($plugin);
    }

    public static function profile(string|Profile|null $profile = null): Profile
    {
        return $profile instanceof Profile ? $profile : Profiles::getOrDefault($profile);
    }

    /** Gespeicherten Inhalt ausgeben: HTML bereinigt, Markdown umgewandelt, `redaxo://ID` aufgelöst */
    public static function render(?string $value, string|Profile|null $profile = null): string
    {
        return Output::render($value, self::profile($profile));
    }

    /**
     * Eingabe bereinigen, bevor sie gespeichert wird (Frontend!). HTML-Profile: nur erlaubte Elemente/Klassen;
     * Markdown-Profile: unverändert (wird bei der Ausgabe bereinigt), auf maxLength gekürzt.
     */
    public static function sanitize(?string $value, string|Profile|null $profile = null): string
    {
        $profile = self::profile($profile);
        $value = (string) $value;
        if (Mode::Markdown === $profile->mode) {
            $max = $profile->config['maxLength'];

            return $max > 0 ? mb_substr($value, 0, $max * 2) : $value;
        }

        return Sanitizer::clean(HtmlEmbed::strip($value), $profile);
    }

    /**
     * Editor-Element mit Textarea – für eigene Formulare im Frontend oder Backend.
     *
     * @param array<literal-string, string|int|bool|null> $attributes zusätzliche Attribute der Textarea
     */
    public static function editor(string $name, ?string $value, string|Profile|null $profile = null, array $attributes = []): string
    {
        $profile = self::profile($profile);

        return '<rex-tiptap ' . new HtmlAttributes(['data-config' => self::configJson($profile)]) . '>'
            . '<textarea ' . new HtmlAttributes(['class' => ['rex-input', 'rex-tiptap-source'], 'name' => $name] + $attributes) . '>'
            . escape((string) $value) . '</textarea></rex-tiptap>';
    }

    /** Einstellungen eines Profils als JSON für `data-config` */
    public static function configJson(Profile $profile): string
    {
        return json_encode(self::clientConfig($profile), self::JSON_ATTR);
    }

    /** @return array<string, mixed> */
    public static function clientConfig(Profile $profile): array
    {
        $config = $profile->clientConfig();
        $user = Core::isBackend() ? Core::getUser() : null;
        $config['backend'] = null !== $user;
        // Adressen ab der Website-Wurzel: stimmen im Backend wie im Frontend
        $base = Output::basePath();
        $config['mediaUrl'] = $base . 'media/';
        $config['mediaManagerUrl'] = $base . 'index.php?rex_media_type=__TYPE__&rex_media_file=__FILE__';
        if (null === $user) {
            // Im Frontend gibt es weder Linkmap noch Medienpool noch Datensatz-Auswahl
            $config['link']['internal'] = false;
            $config['link']['media'] = false;
            $config['link']['records'] = [];
        } else {
            $tables = RecordLinks::tables($user);
            $config['recordTables'] = [];
            foreach ($config['link']['records'] as $name) {
                if (isset($tables[$name])) {
                    $config['recordTables'][] = ['name' => $name, 'label' => $tables[$name]];
                }
            }
            $config['recordApi'] = Url::backendController(RecordSearchApi::getUrlParams());
            // Dateien per Ziehen/Einfügen in den Medienpool (Recht auf die Zielkategorie prüft der Server noch einmal)
            if ($config['upload']['enabled'] && $user->getComplexPerm('media')->hasMediaPerm()) {
                $config['uploadApi'] = Url::backendController(UploadApi::getUrlParams());
            }
            // Alternativtext aus dem Medienpool (klxm_meta) in der Sprache des Inhalts
            $config['mediaInfoApi'] = Url::backendController(MediaInfoApi::getUrlParams());
            $config['language'] = Language::getCurrentId();
            // Titel/Vorschaubild von YouTube/Vimeo, Freigabe von HTML-Embeds (Recht tiptap[html_embed])
            $config['oembedApi'] = Url::backendController(OembedApi::getUrlParams());
            // Video-Editor (optional): Standbild als Poster, Bearbeiten im Medienpool
            if (class_exists(VideoEditor::class)) {
                $config['videoEditor'] = ['api' => VideoEditor::apiUrl(), 'edit' => VideoEditor::editUrlTemplate()];
            }
            if (HtmlEmbed::allowed($user)) {
                $config['htmlEmbed'] = true;
                $config['embedSignApi'] = Url::backendController(EmbedSignApi::getUrlParams());
            }
        }

        return $config;
    }

    /**
     * Skripte und Stile für das Frontend (einmal je Seite). Im Backend lädt das AddOn sie selbst.
     *
     * @param bool $withProfiles Einstellungen aller Profile mitschicken – nötig für `<textarea data-tiptap="name">`
     */
    public static function assets(bool $withProfiles = false): string
    {
        if (self::$assetsDone) {
            return '';
        }
        self::$assetsDone = true;
        $addon = TiptapAddon::instance();
        $nonce = escape(Response::getNonce());

        $html = '<link rel="stylesheet" href="' . escape($addon->assetUrl('tiptap.css')) . '">';
        $html .= '<script defer nonce="' . $nonce . '" src="' . escape($addon->assetUrl('tiptap-loader.js')) . '"></script>';
        foreach (Registry::plugins() as $plugin) {
            if (!$plugin->frontend) {
                continue;
            }
            if ($plugin->style) {
                $html .= '<link rel="stylesheet" href="' . escape($plugin->style) . '">';
            }
            if ($plugin->script) {
                $html .= '<script defer nonce="' . $nonce . '" src="' . escape($plugin->script) . '"></script>';
            }
        }
        if ($withProfiles) {
            $html .= self::profilesScript();
        }

        return $html;
    }

    /**
     * Alle Profile als JSON-Block (für `textarea[data-tiptap]`, z. B. in YForm-Formularen).
     *
     * @param list<string>|null $names nur diese Profile
     */
    public static function profilesScript(?array $names = null): string
    {
        $profiles = [];
        foreach (Profiles::all() as $profile) {
            if (null === $names || in_array($profile->name, $names, true)) {
                $profiles[$profile->name] = self::clientConfig($profile);
            }
        }

        // type=application/json wird nicht ausgeführt, die CSP greift hier nicht
        return '<script type="application/json" id="rex-tiptap-profiles">' . json_encode($profiles, self::JSON_ATTR) . '</script>';
    }
}
