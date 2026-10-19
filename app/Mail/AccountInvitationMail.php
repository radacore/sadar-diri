<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $url,
        public readonly int $ttlHours = 72,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Undangan aktivasi SADAR DIRI');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.account-invitation');
    }
}
