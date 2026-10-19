<?php

namespace Database\Seeders;

use App\Models\ContentItem;
use App\Models\User;
use Illuminate\Database\Seeder;

class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->where('role', 'superadmin')->first();

        if (! $admin) {
            return;
        }

        $items = [
            ['abc_prompt', 'Prompt Curhat ABC', 'abc-default', 'Kejadian (A) → Pikiran (B) → Akibat (C). Tulis fakta, lalu pikiran, lalu perasaan dan tindakan.', ['order' => 1]],
            ['reflection_question', 'Pertanyaan Refleksi Mingguan', 'reflection-weekly', 'Apa hal paling positif dan paling menguras emosi pekan ini?', ['order' => 1]],
            ['reflection_question', 'Pertanyaan Refleksi Terbimbing', 'reflection-guided', 'Apa yang bisa kamu kendalikan, dan apa yang perlu kamu lepaskan?', ['order' => 2]],
            ['emotion_category', 'Emosi Positif', 'emotion-positive', 'senang, tenang, bersemangat, bangga, syukur', ['valence' => 'positive']],
            ['emotion_category', 'Emosi Negatif', 'emotion-negative', 'sedih, marah, cemas, takut, kecewa, lelah', ['valence' => 'negative']],
            ['tip_article', 'Mengenali Emosi', 'mengenali-emosi', 'Emosi adalah sinyal, bukan kelemahan. Menamai emosi membantu otak menenangkan respons stres.', ['read_minutes' => 2]],
            ['tip_article', 'Tidur dan Mood', 'tidur-dan-mood', 'Kurang tidur membuat emosi lebih mudah meledak. Coba tidur pada jam yang sama setiap malam.', ['read_minutes' => 2]],
        ];

        foreach ($items as [$type, $title, $slug, $body, $metadata]) {
            ContentItem::updateOrCreate(
                ['type' => $type, 'slug' => $slug],
                [
                    'title' => $title,
                    'body' => $body,
                    'metadata' => $metadata,
                    'version' => 1,
                    'status' => 'published',
                    'published_at' => now(),
                    'created_by' => $admin->id,
                ],
            );
        }
    }
}
