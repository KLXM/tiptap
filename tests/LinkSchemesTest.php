<?php

namespace Klxm\Tiptap\Tests;

use Klxm\Tiptap\Profile;
use Klxm\Tiptap\Tiptap;
use Override;
use PHPUnit\Framework\TestCase;

/**
 * Further link schemes of a profile (`link.schemes`): kept by the sanitizer, only with a valid name.
 *
 * @internal
 */
final class LinkSchemesTest extends TestCase
{
    #[Override]
    protected function setUp(): void
    {
        if (!TIPTAP_INTEGRATION) {
            self::markTestSkipped('REDAXO_BOOTSTRAP fehlt');
        }
    }

    public function testNormalized(): void
    {
        $profile = self::profile(['media', 'Detail', 'java script', 'javascript', 'route']);

        self::assertSame(['media', 'route'], $profile->config['link']['schemes']);
    }

    public function testSanitizer(): void
    {
        $html = '<p><a href="media://plan.pdf">Plan</a> <a href="detail://5/12">Eintrag</a></p>';

        $with = Tiptap::sanitize($html, self::profile(['media']));
        self::assertStringContainsString('href="media://plan.pdf"', $with);
        self::assertStringNotContainsString('detail://', $with);

        self::assertStringNotContainsString('media://', Tiptap::sanitize($html, self::profile([])));
    }

    /** @param list<string> $schemes */
    private static function profile(array $schemes): Profile
    {
        return Profile::fromArray([
            'name' => 'test_schemes',
            'label' => 'Test',
            'mode' => 'html',
            'config' => ['toolbar' => [['link']], 'link' => ['schemes' => $schemes]],
        ]);
    }
}
