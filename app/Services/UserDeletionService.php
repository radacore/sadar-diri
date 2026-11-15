<?php

namespace App\Services;

use App\Models\Attachment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Penghapusan akun permanen yang dipakai bersama halaman Pengguna dan hapus kelas.
 *
 * Berkas lampiran harus dilepas dulu: attachments.uploaded_by memakai FK restrictOnDelete
 * sehingga baris user tidak dapat dihapus selama lampiran masih menunjuk ke akun itu.
 * Data lain (profil, mood, jurnal, prestasi, refleksi, rencana) sudah cascadeOnDelete di skema.
 */
class UserDeletionService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function delete(User $user, string $reason, User $actor): void
    {
        $attachments = Attachment::query()
            ->where('uploaded_by', $user->id)
            ->orWhereHas('achievement', fn ($query) => $query->where('student_id', $user->id))
            ->get();

        foreach ($attachments as $attachment) {
            try {
                Storage::disk($attachment->disk)->delete($attachment->path);
            } catch (\Throwable $e) {
                report($e);
            }

            $attachment->delete();
        }

        // Dicatat sebelum baris user hilang: FK audit_logs nullOnDelete hanya mengosongkan subjek.
        $this->audit->record('user.deleted', 'users', $user->id, $user->id, $reason, [
            'name' => $user->name,
            'identity_number' => $user->identity_number,
            'role' => $user->role,
        ], $actor);

        DB::transaction(function () use ($user) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete();
        });
    }
}
