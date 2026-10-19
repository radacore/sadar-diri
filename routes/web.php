<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home']);

Route::middleware('guest')->group(function () {
    Route::get('/masuk', [PageController::class, 'login'])->name('login');
    Route::get('/lupa-sandi', [PageController::class, 'forgot'])->name('password.request');
    Route::get('/reset-password', [PageController::class, 'reset'])->name('password.reset');
});

Route::get('/aktivasi/{user}', [\App\Http\Controllers\AuthController::class, 'activationForm'])
    ->middleware('signed')
    ->name('activate.form');

Route::middleware('auth')->group(function () {
    Route::get('/2fa/challenge', [PageController::class, 'twoFactorChallenge'])->name('2fa.challenge');
    Route::get('/2fa/enroll', [PageController::class, 'twoFactorEnroll'])->name('2fa.enroll');

    Route::get('/onboarding/consent', [PageController::class, 'consent'])->name('onboarding.consent');

    Route::middleware('role:student')->prefix('siswa')->group(function () {
        Route::get('/beranda', fn (PageController $page) => $page->student('Dashboard'));
        Route::get('/profil', fn (PageController $page) => $page->student('Profile'));
        Route::get('/jurnal', fn (PageController $page) => $page->student('Journal'));
        Route::get('/portofolio', fn (PageController $page) => $page->student('Portfolio'));
        Route::get('/refleksi', fn (PageController $page) => $page->student('Reflection'));
        Route::get('/rencana', fn (PageController $page) => $page->student('Plan'));
        Route::get('/privasi', fn (PageController $page) => $page->student('Privacy'));
    });

    Route::middleware('role:counselor')->prefix('bk')->group(function () {
        Route::get('/dashboard', fn (PageController $page) => $page->counselor('Dashboard'));
        Route::get('/alert', fn (PageController $page) => $page->counselor('Alerts'));
        Route::get('/siswa', fn (PageController $page) => $page->counselor('Students'));
        Route::get('/siswa/{student}', fn (PageController $page, \App\Models\User $student) => $page->counselor('StudentDetail', $student));
        Route::get('/refleksi', fn (PageController $page) => $page->counselor('Reflections'));
        Route::get('/verifikasi', fn (PageController $page) => $page->counselor('Verification'));
        Route::get('/catatan', fn (PageController $page) => $page->counselor('Notes'));
        Route::get('/laporan', fn (PageController $page) => $page->counselor('Reports'));
    });

    Route::middleware(['role:superadmin', 'twofactor'])->prefix('admin')->group(function () {
        Route::get('/dashboard', fn (PageController $page) => $page->admin('Dashboard'));
        Route::get('/pengguna', fn (PageController $page) => $page->admin('Users'));
        Route::get('/kelas', fn (PageController $page) => $page->admin('Classes'));
        Route::get('/tahun-ajaran', fn (PageController $page) => $page->admin('AcademicYears'));
        Route::get('/konten', fn (PageController $page) => $page->admin('Content'));
        Route::get('/pengaturan', fn (PageController $page) => $page->admin('Settings'));
        Route::get('/audit', fn (PageController $page) => $page->admin('Audit'));
        Route::get('/laporan', fn (PageController $page) => $page->admin('Reports'));
        Route::get('/pengumuman', fn (PageController $page) => $page->admin('Announcements'));
        Route::get('/retensi', fn (PageController $page) => $page->admin('Retention'));
    });
});
