<?php

namespace Klxm\Tiptap\Tests;

use Klxm\Tiptap\Media\HtmlEmbed;
use Klxm\Tiptap\Media\Oembed;
use Klxm\Tiptap\Profile;
use Klxm\Tiptap\Tiptap;
use Klxm\Tiptap\TiptapAddon;
use Override;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Redaxo\Core\Filesystem\File;
use Redaxo\Core\Http\Response;

use function htmlspecialchars;
use function touch;

use const ENT_QUOTES;

/**
 * Medien-Blöcke: Erkennung von YouTube/Vimeo, Signatur der HTML-Embeds, Bereinigung und Ausgabe.
 *
 * @internal
 */
final class MediaTest extends TestCase
{
    #[Override]
    protected function setUp(): void
    {
        if (!TIPTAP_INTEGRATION) {
            self::markTestSkipped('REDAXO_BOOTSTRAP fehlt');
        }
    }

    /** @param array{provider: string, id: string, hash: ?string}|null $expected */
    #[DataProvider('provideParse')]
    public function testParse(string $url, ?array $expected): void
    {
        self::assertSame($expected, Oembed::parse($url));
    }

    /** @return iterable<string, array{string, ?array<string, ?string>}> */
    public static function provideParse(): iterable
    {
        yield 'watch' => ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', ['provider' => 'youtube', 'id' => 'dQw4w9WgXcQ', 'hash' => null]];
        yield 'watch mit Parametern' => ['https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=10', ['provider' => 'youtube', 'id' => 'dQw4w9WgXcQ', 'hash' => null]];
        yield 'kurz' => ['https://youtu.be/dQw4w9WgXcQ?si=x', ['provider' => 'youtube', 'id' => 'dQw4w9WgXcQ', 'hash' => null]];
        yield 'shorts' => ['https://youtube.com/shorts/dQw4w9WgXcQ', ['provider' => 'youtube', 'id' => 'dQw4w9WgXcQ', 'hash' => null]];
        yield 'nocookie' => ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', ['provider' => 'youtube', 'id' => 'dQw4w9WgXcQ', 'hash' => null]];
        yield 'vimeo' => ['https://vimeo.com/76979871', ['provider' => 'vimeo', 'id' => '76979871', 'hash' => null]];
        yield 'vimeo privat' => ['https://vimeo.com/76979871/abcdef1234', ['provider' => 'vimeo', 'id' => '76979871', 'hash' => 'abcdef1234']];
        yield 'vimeo player' => ['https://player.vimeo.com/video/76979871', ['provider' => 'vimeo', 'id' => '76979871', 'hash' => null]];
        yield 'fremde Seite' => ['https://example.com/watch?v=dQw4w9WgXcQ', null];
        yield 'falsche Domain' => ['https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', null];
        yield 'javascript' => ['javascript:alert(1)//youtu.be/dQw4w9WgXcQ', null];
    }

    public function testSignature(): void
    {
        $code = "<script>console.log(1)</script>\r\n<p>x</p>";
        $sig = HtmlEmbed::sign($code, 'maps');
        self::assertTrue(HtmlEmbed::verify(HtmlEmbed::normalize($code), 'maps', $sig));
        self::assertFalse(HtmlEmbed::verify(HtmlEmbed::normalize($code) . 'x', 'maps', $sig), 'veränderter Code');
        self::assertFalse(HtmlEmbed::verify(HtmlEmbed::normalize($code), '', $sig), 'anderer Dienst');
        self::assertFalse(HtmlEmbed::verify(HtmlEmbed::normalize($code), 'maps', ''), 'ohne Signatur');
    }

    public function testRenderEmbed(): void
    {
        $profile = $this->profile([['htmlEmbed']]);
        $code = '<script src="/x.js"></script><script>go()</script>';
        $signed = $this->embed($code, HtmlEmbed::sign($code, ''));
        $out = Tiptap::render($signed, $profile);
        $nonce = Response::getNonce();
        self::assertStringContainsString('<script nonce="' . $nonce . '" src="/x.js"></script>', $out);
        self::assertStringContainsString('<script nonce="' . $nonce . '">go()</script>', $out);
        self::assertStringNotContainsString('data-rex-embed', $out);

        self::assertSame('', Tiptap::render($this->embed($code, 'falsch'), $profile), 'falsche Signatur');
        self::assertSame('', Tiptap::render($this->embed('<b>x</b>', HtmlEmbed::sign($code, '')), $profile), 'anderer Code');
        self::assertStringNotContainsString('<script', Tiptap::render($signed, $this->profile([['bold']])), 'Profil ohne Werkzeug');
    }

    public function testRenderEmbedWithService(): void
    {
        $profile = $this->profile([['htmlEmbed']]);
        $code = '<iframe src="https://maps.example/x"></iframe>';
        $html = '<div data-rex-embed="' . htmlspecialchars($code, ENT_QUOTES) . '" data-consent-service="google_maps" data-rex-label="Anfahrt" data-rex-sig="' . HtmlEmbed::sign($code, 'google_maps') . '"></div>';
        $out = Tiptap::render($html, $profile);
        self::assertStringContainsString('<div class="rex-embed-consent" data-consent-service="google_maps"><template>' . $code . '</template>', $out);
        self::assertStringContainsString('Anfahrt', $out);
    }

    public function testRenderVideo(): void
    {
        $profile = $this->profile([['video']], ['image' => ['styles' => [['label' => 'Breit', 'class' => 'wide', 'media' => 'video']]]]);
        $html = '<video src="x" data-rex-media="film.mp4" data-rex-poster="bild.jpg" controls muted onplay="alert(1)" class="wide rex-ratio-4x3 fremd" preload="metadata"></video>';
        $out = Tiptap::render($html, $profile);
        // Adresse aus dem Medienpool (im Test ../media/, im Frontend /media/)
        self::assertMatchesRegularExpression('~<video src="[./]*media/film\.mp4"~', $out);
        self::assertMatchesRegularExpression('~ poster="[./]*media/bild\.jpg"~', $out);
        self::assertStringContainsString('class="rex-video wide rex-ratio-4x3"', $out);
        self::assertStringNotContainsString('onplay', $out);
        self::assertStringNotContainsString('data-rex-', $out);
    }

    public function testRenderOembed(): void
    {
        // ohne Netz: Titel vorab ablegen
        $cache = TiptapAddon::instance()->getDataPath('oembed/youtube-test1234567.json');
        File::put($cache, '{"title":"Testvideo"}');
        touch($cache);
        $html = '<figure data-rex-oembed="https://youtu.be/test1234567" class="rex-ratio-9x16"><a href="https://youtu.be/test1234567">x</a></figure>';

        $out = Tiptap::render($html, $this->profile([['oembed']]));
        self::assertStringContainsString('class="rex-oembed rex-ratio-9x16"', $out);
        self::assertStringContainsString('data-consent-service="youtube"', $out);
        self::assertStringContainsString('data-consent-src="https://www.youtube-nocookie.com/embed/test1234567?rel=0&amp;autoplay=1"', $out);
        self::assertStringContainsString('data-consent-load', $out);
        self::assertStringContainsString('Testvideo', $out);
        self::assertStringNotContainsString('<iframe', $out);

        $direct = Tiptap::render($html, $this->profile([['oembed']], ['embed' => ['consent' => false]]));
        self::assertStringContainsString('<iframe src="https://www.youtube-nocookie.com/embed/test1234567?rel=0"', $direct);

        self::assertSame('', Tiptap::render('<figure data-rex-oembed="https://example.com/x"></figure>', $this->profile([['oembed']])));
        File::delete($cache);
    }

    public function testImageAlt(): void
    {
        $file = 'tiptap-alt-test.gif';
        $media = \Redaxo\Core\MediaPool\Media::get($file);
        if (null === $media) {
            $source = \Redaxo\Core\Filesystem\Path::addonCache('tiptap', $file);
            File::put($source, (string) base64_decode('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', true));
            $file = \Redaxo\Core\MediaPool\MediaHandler::add(['title' => 'Titel', 'category_id' => null, 'file' => new \Symfony\Component\HttpFoundation\File\File($source)], ['alt' => 'Aus dem Pool'], subindexing: false)->fileName;
        }
        try {
            $profile = $this->profile([['image']]);
            self::assertStringContainsString('alt="Aus dem Pool"', Tiptap::render('<img src="x" data-rex-media="' . $file . '">', $profile));
            self::assertStringContainsString('alt=""', Tiptap::render('<img src="x" data-rex-media="' . $file . '" alt="">', $profile));
            self::assertStringContainsString('alt="Eigen"', Tiptap::render('<img src="x" data-rex-media="' . $file . '" alt="Eigen">', $profile));
        } finally {
            \Redaxo\Core\MediaPool\MediaHandler::delete($file);
        }
    }

    /**
     * @param list<list<string>> $toolbar
     * @param array<string, mixed> $config
     */
    private function profile(array $toolbar, array $config = []): Profile
    {
        return new Profile('test', 'Test', config: Profile::normalize(['toolbar' => $toolbar] + $config));
    }

    private function embed(string $code, string $sig): string
    {
        return '<div data-rex-embed="' . htmlspecialchars($code, ENT_QUOTES) . '" data-rex-sig="' . $sig . '"></div>';
    }
}
