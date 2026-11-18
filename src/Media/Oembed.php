<?php

namespace Klxm\Tiptap\Media;

use Klxm\Tiptap\TiptapAddon;
use Redaxo\Core\Filesystem\File;
use Symfony\Component\HttpClient\HttpClient;
use Throwable;

use function filemtime;
use function in_array;
use function is_array;
use function is_file;
use function is_string;
use function json_decode;
use function json_encode;
use function mb_substr;
use function preg_match;
use function rawurlencode;
use function time;

use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

/**
 * YouTube und Vimeo: Adresse erkennen, Player-Adresse bilden, Titel und Vorschaubild über oEmbed holen.
 *
 * Titel und Vorschaubild werden auf dem Server geholt und abgelegt – so lädt der Browser der Besucher vor dem Klick
 * nichts von YouTube oder Vimeo (2-Klick-Lösung). Abgefragt werden nur die festen oEmbed-Endpunkte der Anbieter mit
 * einer geprüften Video-ID, keine beliebigen Adressen.
 */
final class Oembed
{
    public const array PROVIDERS = ['youtube' => 'YouTube', 'vimeo' => 'Vimeo'];

    /** Daten erneut holen nach (Sekunden); fehlgeschlagene Abfragen erst nach einem Tag wiederholen */
    private const int TTL = 30 * 86400;
    private const int TTL_FAILED = 86400;

    /** @return array{provider: 'youtube'|'vimeo', id: string, hash: ?string}|null */
    public static function parse(string $url): ?array
    {
        if (preg_match('~^(?:https?:)?//(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:[^#]*&)?v=|embed/|shorts/|live/)|youtu\.be/)([\w-]{11})~i', $url, $m)) {
            return ['provider' => 'youtube', 'id' => $m[1], 'hash' => null];
        }
        if (preg_match('~^(?:https?:)?//(?:www\.|player\.)?vimeo\.com/(?:video/|channels/[\w-]+/|groups/[\w-]+/videos/)?(\d{5,12})(?:/([\da-f]{6,20}))?~i', $url, $m)) {
            return ['provider' => 'vimeo', 'id' => $m[1], 'hash' => $m[2] ?? null];
        }

        return null;
    }

    /** Player ohne Cookies (YouTube) bzw. mit „do not track“ (Vimeo) */
    public static function playerUrl(array $video, bool $autoplay = false): string
    {
        if ('youtube' === $video['provider']) {
            return 'https://www.youtube-nocookie.com/embed/' . $video['id'] . '?rel=0' . ($autoplay ? '&autoplay=1' : '');
        }

        return 'https://player.vimeo.com/video/' . $video['id'] . '?dnt=1' . (null !== $video['hash'] ? '&h=' . $video['hash'] : '') . ($autoplay ? '&autoplay=1' : '');
    }

    /** Adresse zum Ansehen beim Anbieter (Link im Platzhalter) */
    public static function watchUrl(array $video): string
    {
        return 'youtube' === $video['provider']
            ? 'https://www.youtube.com/watch?v=' . $video['id']
            : 'https://vimeo.com/' . $video['id'] . (null !== $video['hash'] ? '/' . $video['hash'] : '');
    }

    /** Hosts für die Content-Security-Policy (frame-src) */
    public static function frameHosts(): array
    {
        return ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];
    }

    /**
     * Titel, Anbieter und ob ein Vorschaubild vorliegt; mit $fetch wird bei Bedarf beim Anbieter nachgefragt.
     *
     * @return array{provider: string, id: string, title: string, thumbnail: bool}|null
     */
    public static function meta(string $url, bool $fetch = true): ?array
    {
        $video = self::parse($url);
        if (null === $video) {
            return null;
        }
        $key = self::key($video);
        $file = self::path($key . '.json');
        $data = is_file($file) ? json_decode((string) File::get($file), true) : null;
        // ohne Vorschaubild (oder nach einem Fehler) früher erneut versuchen
        $complete = !($data['failed'] ?? false) && is_file(self::path($key . '.jpg'));
        $fresh = is_array($data) && filemtime($file) > time() - ($complete ? self::TTL : self::TTL_FAILED);

        if ((!$fresh || !is_array($data)) && $fetch) {
            $data = self::fetch($video, $key) ?? (is_array($data) && !($data['failed'] ?? false) ? $data : ['failed' => true]);
            File::put($file, json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        return [
            'provider' => $video['provider'],
            'id' => $video['id'],
            'title' => is_array($data) && is_string($data['title'] ?? null) ? $data['title'] : '',
            'thumbnail' => is_file(self::path($key . '.jpg')),
        ];
    }

    /** Pfad des abgelegten Vorschaubilds oder null */
    public static function thumbnail(string $url, bool $fetch = false): ?string
    {
        $video = self::parse($url);
        if (null === $video) {
            return null;
        }
        $file = self::path(self::key($video) . '.jpg');
        if (!is_file($file) && $fetch) {
            self::meta($url);
        }

        return is_file($file) ? $file : null;
    }

    /** @return array{title: string}|null */
    private static function fetch(array $video, string $key): ?array
    {
        $endpoint = 'youtube' === $video['provider']
            ? 'https://www.youtube.com/oembed?format=json&url=' . rawurlencode(self::watchUrl($video))
            : 'https://vimeo.com/api/oembed.json?width=1280&url=' . rawurlencode(self::watchUrl($video));
        try {
            $client = HttpClient::create(['timeout' => 4, 'max_duration' => 6, 'max_redirects' => 2, 'headers' => ['User-Agent' => 'REDAXO tiptap']]);
            $response = $client->request('GET', $endpoint);
            if (200 !== $response->getStatusCode()) {
                return null;
            }
            $data = $response->toArray(false);
            $title = is_string($data['title'] ?? null) ? mb_substr($data['title'], 0, 300) : '';

            // Vorschaubild: bei YouTube in hoher Auflösung, sonst das aus oEmbed (nur von den bekannten CDNs)
            $thumbs = 'youtube' === $video['provider']
                ? ['https://i.ytimg.com/vi/' . $video['id'] . '/maxresdefault.jpg', 'https://i.ytimg.com/vi/' . $video['id'] . '/hqdefault.jpg']
                : [is_string($data['thumbnail_url'] ?? null) ? $data['thumbnail_url'] : ''];
            foreach ($thumbs as $thumb) {
                if (!preg_match('~^https://(i\.ytimg\.com|i\.vimeocdn\.com)/~', $thumb)) {
                    continue;
                }
                $image = $client->request('GET', $thumb);
                $type = $image->getHeaders(false)['content-type'][0] ?? '';
                if (200 === $image->getStatusCode() && in_array($type, ['image/jpeg', 'image/jpg', 'image/webp', 'image/png'], true)) {
                    File::put(self::path($key . '.jpg'), $image->getContent());
                    break;
                }
            }

            return ['title' => $title];
        } catch (Throwable) {
            return null;
        }
    }

    private static function key(array $video): string
    {
        return $video['provider'] . '-' . $video['id'];
    }

    private static function path(string $file): string
    {
        return TiptapAddon::instance()->getDataPath('oembed/' . $file);
    }
}
